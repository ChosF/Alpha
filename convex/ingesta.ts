import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { areaValidador, tipoRegistroValidador } from "./lib/validadores";
import { comparaSegura, limpiarMultilinea, limpiarTexto, normalizarCorreo, normalizarTelefono, sha256Hex } from "./lib/texto";
import { CUOTAS, consumirLimite } from "./lib/limites";
import { enviarConfirmacionRegistro } from "./correo";

/**
 * Ingesta del formulario publico.
 *
 * La landing NO llama aqui directamente: primero pasa por /api/registro en
 * Next, que es donde existe la IP real y donde se aplica el limite por IP.
 * Esta action exige ademas un secreto compartido que solo vive en el servidor,
 * de modo que conocer la URL del despliegue de Convex no alcanza para escribir.
 */

const datosRegistro = v.object({
  tipo: tipoRegistroValidador,
  nombre: v.string(),
  correo: v.string(),
  carrera: v.string(),
  // Opcional durante la transicion para aceptar clientes anteriores al cambio.
  semestre: v.optional(v.string()),
  matricula: v.optional(v.string()),
  canales: v.object({ correo: v.boolean(), whatsapp: v.boolean() }),
  telefono: v.optional(v.string()),
  areas: v.array(areaValidador),
  aporte: v.optional(v.string()),
  ipHash: v.string(),
  userAgent: v.string(),
});

export const registrar = action({
  args: { secreto: v.string(), datos: datosRegistro },
  returns: v.object({ ok: v.boolean(), motivo: v.optional(v.string()) }),
  // El tipo de retorno va explicito porque la action referencia a una funcion
  // de su propio modulo (internal.ingesta.guardar) y TypeScript no puede
  // inferirlo sin caer en circularidad.
  handler: async (ctx, args): Promise<{ ok: boolean; motivo?: string }> => {
    const esperado = process.env.INGEST_SECRET;
    if (typeof esperado !== "string" || esperado.length < 32) {
      throw new Error("INGEST_SECRET no esta configurado en Convex.");
    }
    if (!comparaSegura(args.secreto, esperado)) {
      // Mismo error generico: no se confirma si el secreto existe o no.
      throw new Error("No autorizado.");
    }

    const resultado = await ctx.runMutation(internal.ingesta.guardar, { datos: args.datos });
    const debeRecibirCorreo =
      resultado.ok &&
      resultado.creado &&
      (args.datos.tipo === "aliado" || args.datos.canales.correo);

    if (debeRecibirCorreo) {
      try {
        const encolado = await enviarConfirmacionRegistro(ctx, args.datos);
        if (!encolado) {
          console.error("No se encoló la confirmación de registro: correo automático no configurado.");
        }
      } catch (error) {
        // El registro ya quedó guardado. Una falla externa de correo no debe
        // convertirlo en un error ambiguo ni provocar registros repetidos.
        console.error(
          "No se pudo encolar la confirmación de registro.",
          error instanceof Error ? error.message : "Error desconocido",
        );
      }
    }

    return resultado.ok
      ? { ok: true }
      : { ok: false, ...(resultado.motivo ? { motivo: resultado.motivo } : {}) };
  },
});

export const guardar = internalMutation({
  args: { datos: datosRegistro },
  returns: v.object({
    ok: v.boolean(),
    creado: v.boolean(),
    motivo: v.optional(v.string()),
  }),
  handler: async (ctx, { datos }) => {
    const correo = normalizarCorreo(datos.correo);
    const ahora = Date.now();
    const esMiembro = datos.tipo === "miembro";
    const telefono = datos.telefono ? normalizarTelefono(datos.telefono) : undefined;

    if (esMiembro && !datos.canales.correo && !datos.canales.whatsapp) {
      throw new Error("El miembro necesita un canal de contacto.");
    }
    if (esMiembro && datos.canales.whatsapp && !telefono) {
      throw new Error("El registro de WhatsApp necesita telefono.");
    }
    if (!esMiembro && !telefono) {
      throw new Error("El aliado necesita telefono.");
    }
    if (telefono && !/^\d{10}$/.test(telefono)) {
      throw new Error("El telefono debe tener 10 digitos.");
    }

    if (!esMiembro) {
      const configuracion = await ctx.db
        .query("registrationSettings")
        .withIndex("by_clave", (q) => q.eq("clave", "aliados"))
        .unique();
      const areaCerrada = datos.areas.find((area) => configuracion?.areasCerradas.includes(area));
      if (areaCerrada) {
        return { ok: false, creado: false, motivo: `area_cerrada:${areaCerrada}` };
      }
    }

    // Primer limite: por origen. El hash de IP lo calcula Next, que es el
    // unico que ve la direccion real; aqui solo se cuenta contra ese hash.
    const limiteIp = await consumirLimite(
      ctx,
      `registro:ip:${datos.ipHash}`,
      CUOTAS.registroPorIp.maximo,
      CUOTAS.registroPorIp.ventanaMs,
    );
    if (!limiteIp.permitido) {
      return { ok: false, creado: false, motivo: "limite" };
    }

    // Segundo limite, esta vez por correo: frena el reenvio del mismo
    // formulario desde varias redes.
    const claveCorreo = `registro:correo:${await sha256Hex(correo)}`;
    const limite = await consumirLimite(
      ctx,
      claveCorreo,
      CUOTAS.registroPorCorreo.maximo,
      CUOTAS.registroPorCorreo.ventanaMs,
    );
    if (!limite.permitido) {
      return { ok: false, creado: false, motivo: "limite" };
    }

    const comun = {
      tipo: datos.tipo,
      nombre: limpiarTexto(datos.nombre, 80),
      correo,
      carrera: limpiarTexto(datos.carrera, 80),
      ...(datos.semestre
        ? { semestre: limpiarTexto(datos.semestre, 30) }
        : {}),
      ...(datos.matricula ? { matricula: limpiarTexto(datos.matricula, 12).toUpperCase() } : {}),
      canales: esMiembro ? datos.canales : { correo: false, whatsapp: false },
      ...(telefono ? { telefono } : {}),
      areas: esMiembro ? [] : Array.from(new Set(datos.areas)),
      ...(!esMiembro && datos.aporte ? { aporte: limpiarMultilinea(datos.aporte, 300) } : {}),
      ipHash: datos.ipHash,
      userAgent: limpiarTexto(datos.userAgent, 200),
      actualizadoEn: ahora,
    };

    // Un correo, un registro. Conocer una direccion no prueba que quien envia
    // el formulario sea su titular, asi que un duplicado nunca puede modificar
    // datos ya guardados. La respuesta sigue siendo exitosa para no revelar si
    // el correo existe.
    const existente = await ctx.db
      .query("registrations")
      .withIndex("by_correo", (q) => q.eq("correo", correo))
      .unique();

    if (existente !== null) {
      return { ok: true, creado: false };
    }

    await ctx.db.insert("registrations", {
      ...comun,
      estado: "nuevo",
      origen: "landing",
      creadoEn: ahora,
    });

    return { ok: true, creado: true };
  },
});
