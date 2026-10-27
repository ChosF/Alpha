import { v } from "convex/values";
import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { comparaSegura, limpiarTexto, normalizarCorreo, normalizarTelefono, sha256Hex } from "./lib/texto";
import { CUOTAS, consumirLimite } from "./lib/limites";
import { CALLING_LAF, registroCallingLafDisponible } from "../lib/calling-laf";
import { MARIO_KART_CHALLENGE } from "../lib/mario-kart";
import {
  INTERESES_NETWORKING_NIGHT,
  MAX_CV_BYTES_NETWORKING_NIGHT,
  MAX_HABILIDADES_NETWORKING_NIGHT,
  MAX_INTERESES_NETWORKING_NIGHT,
  NETWORKING_NIGHT,
  SEMESTRES_NETWORKING_NIGHT,
  type PagoBoleto,
} from "../lib/networking-night";
import { estadoPagoValidador, metodoPagoValidador } from "./lib/validadores";
import { enviarConfirmacionCallingLaf } from "./correo";

const SLUG_CALLING_LAF = CALLING_LAF.slug;
const SLUG_MARIO_KART = MARIO_KART_CHALLENGE.slug;
const SLUG_NETWORKING_NIGHT = NETWORKING_NIGHT.slug;
const SUBIDAS_CV_POR_IP = { maximo: 6, ventanaMs: 10 * 60 * 1000 };
const pagoBoletoValidador = v.object({
  metodo: metodoPagoValidador,
  estado: estadoPagoValidador,
  montoMxn: v.number(),
});

function pagoDelBoleto(pago: NonNullable<Doc<"eventRegistrations">["pago"]>): PagoBoleto {
  return { metodo: pago.metodo, estado: pago.estado, montoMxn: pago.montoMxn };
}

const datosRegistroEvento = v.object({
  nombre: v.string(),
  correo: v.string(),
  carrera: v.string(),
  semestre: v.string(),
  matricula: v.optional(v.string()),
  canales: v.object({ correo: v.boolean(), whatsapp: v.boolean() }),
  telefono: v.optional(v.string()),
  ipHash: v.string(),
  userAgent: v.string(),
});

function exigirSecreto(secreto: string) {
  const esperado = process.env.INGEST_SECRET;
  if (typeof esperado !== "string" || esperado.length < 32) {
    throw new Error("INGEST_SECRET no esta configurado en Convex.");
  }
  if (!comparaSegura(secreto, esperado)) throw new Error("No autorizado.");
}

/**
 * Crea el registro fijo de Calling LAF de forma idempotente. Solo acepta el
 * secreto del servidor y no recibe contenido editable desde el cliente.
 */
export const asegurarCallingLaf = action({
  args: { secreto: v.string() },
  returns: v.id("events"),
  handler: async (ctx, args): Promise<Id<"events">> => {
    exigirSecreto(args.secreto);
    return await ctx.runMutation(internal.ingestaEventos.asegurarEventoCallingLaf, {});
  },
});

export const asegurarEventoCallingLaf = internalMutation({
  args: {},
  returns: v.id("events"),
  handler: async (ctx) => {
    const existente = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", SLUG_CALLING_LAF))
      .unique();
    if (existente !== null) {
      await ctx.db.patch(existente._id, {
        fechaEvento: CALLING_LAF.fechaIso,
        horaInicio: "15:00",
        horaFin: "17:00",
        sede: `${CALLING_LAF.sede}, ${CALLING_LAF.campus}`,
        periodoPrograma: "Ago — Dic 2026",
        estadoPrograma: "planeacion",
        ordenPrograma: 1,
        publicadoEnLanding: true,
        rutaPublica: "/eventos/calling-laf",
        actualizadoEn: Date.now(),
      });
      return existente._id;
    }

    const ahora = Date.now();
    return await ctx.db.insert("events", {
      slug: SLUG_CALLING_LAF,
      titulo: "Calling LAF",
      resumen:
        "Un encuentro para entender concentraciones, certificaciones y rutas profesionales antes de elegir el siguiente paso de la carrera.",
      pilar: "desarrollo",
      fechaEvento: CALLING_LAF.fechaIso,
      horaInicio: "15:00",
      horaFin: "17:00",
      sede: `${CALLING_LAF.sede}, ${CALLING_LAF.campus}`,
      estado: "publicado",
      registroAbierto: true,
      totalRegistros: 0,
      periodoPrograma: "Ago — Dic 2026",
      estadoPrograma: "planeacion",
      ordenPrograma: 1,
      publicadoEnLanding: true,
      rutaPublica: "/eventos/calling-laf",
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  },
});

/** Crea el evento de Mario Kart sin recibir contenido editable del cliente. */
export const asegurarMarioKart = action({
  args: { secreto: v.string() },
  returns: v.id("events"),
  handler: async (ctx, args): Promise<Id<"events">> => {
    exigirSecreto(args.secreto);
    return await ctx.runMutation(internal.ingestaEventos.asegurarEventoMarioKart, {
      activar: true,
    });
  },
});

export const asegurarEventoMarioKart = internalMutation({
  args: { activar: v.boolean() },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", SLUG_MARIO_KART))
      .unique();
    if (existente !== null) {
      if (args.activar) {
        await ctx.db.patch(existente._id, {
          titulo: MARIO_KART_CHALLENGE.titulo,
          resumen: MARIO_KART_CHALLENGE.resumen,
          pilar: "comunidad",
          fechaEvento: MARIO_KART_CHALLENGE.fechaIso,
          horaInicio: "13:00",
          horaFin: "17:00",
          sede: `${MARIO_KART_CHALLENGE.sede}, ${MARIO_KART_CHALLENGE.campus}`,
          estado: "publicado",
          registroAbierto: true,
          periodoPrograma: "Sep 2026",
          estadoPrograma: "planeacion",
          ordenPrograma: 2,
          publicadoEnLanding: true,
          rutaPublica: MARIO_KART_CHALLENGE.ruta,
          actualizadoEn: Date.now(),
        });
      }
      return existente._id;
    }

    const ahora = Date.now();
    return await ctx.db.insert("events", {
      slug: SLUG_MARIO_KART,
      titulo: MARIO_KART_CHALLENGE.titulo,
      resumen: MARIO_KART_CHALLENGE.resumen,
      pilar: "comunidad",
      fechaEvento: MARIO_KART_CHALLENGE.fechaIso,
      horaInicio: "13:00",
      horaFin: "17:00",
      sede: `${MARIO_KART_CHALLENGE.sede}, ${MARIO_KART_CHALLENGE.campus}`,
      estado: "publicado",
      registroAbierto: true,
      totalRegistros: 0,
      periodoPrograma: "Sep 2026",
      estadoPrograma: "planeacion",
      ordenPrograma: 2,
      publicadoEnLanding: true,
      rutaPublica: MARIO_KART_CHALLENGE.ruta,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  },
});

export const registrar = action({
  args: { secreto: v.string(), slug: v.string(), datos: datosRegistroEvento },
  returns: v.object({ ok: v.boolean(), motivo: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; motivo?: string }> => {
    exigirSecreto(args.secreto);
    const slug = limpiarTexto(args.slug, 80).toLowerCase();
    if (slug === SLUG_MARIO_KART) {
      await ctx.runMutation(internal.ingestaEventos.asegurarEventoMarioKart, {
        activar: false,
      });
    }
    const resultado = await ctx.runMutation(internal.ingestaEventos.guardar, {
      slug,
      datos: args.datos,
    });
    const debeEnviarConfirmacion =
      slug === SLUG_MARIO_KART || args.datos.canales.correo;
    if (resultado.ok && resultado.creado && debeEnviarConfirmacion) {
      try {
        const datosCorreo = { nombre: args.datos.nombre, correo: args.datos.correo };
        const encolado =
          slug === SLUG_MARIO_KART
            ? resultado.registroId
              ? await ctx.runAction(internal.correoActions.enviarConfirmacionMarioKart, {
                  ...datosCorreo,
                  registroId: resultado.registroId,
                })
              : false
            : slug === SLUG_CALLING_LAF
              ? await enviarConfirmacionCallingLaf(ctx, datosCorreo)
              : false;
        if (!encolado) {
          console.error(`No se encoló la confirmación de ${slug}: correo automático no configurado.`);
        }
      } catch (error) {
        console.error(
          `No se pudo encolar la confirmación de ${slug}.`,
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
  args: { slug: v.string(), datos: datosRegistroEvento },
  returns: v.object({
    ok: v.boolean(),
    creado: v.boolean(),
    motivo: v.optional(v.string()),
    registroId: v.optional(v.id("eventRegistrations")),
  }),
  handler: async (ctx, args) => {
    const slug = limpiarTexto(args.slug, 80).toLowerCase();
    if (slug === SLUG_CALLING_LAF && !registroCallingLafDisponible()) {
      return { ok: false, creado: false, motivo: "cerrado" };
    }
    // Networking Night pide pago y perfil; solo entra por su propio flujo.
    if (slug === SLUG_NETWORKING_NIGHT) return { ok: false, creado: false, motivo: "cerrado" };
    const evento = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (evento === null || evento.estado !== "publicado" || !evento.registroAbierto) {
      return { ok: false, creado: false, motivo: "cerrado" };
    }

    const datos = args.datos;
    const correo = normalizarCorreo(datos.correo);
    const soloCorreo = slug === SLUG_MARIO_KART;
    const canales = soloCorreo
      ? { correo: true, whatsapp: false }
      : datos.canales;
    const telefono =
      !soloCorreo && datos.telefono ? normalizarTelefono(datos.telefono) : undefined;
    if (soloCorreo && !datos.canales.correo) {
      throw new Error("El registro de Mario Kart necesita correo electrónico.");
    }
    if (!canales.correo && !canales.whatsapp) {
      throw new Error("El registro necesita un canal de contacto.");
    }
    if (canales.whatsapp && !telefono) {
      throw new Error("El registro de WhatsApp necesita telefono.");
    }
    if (telefono && !/^\d{10}$/.test(telefono)) {
      throw new Error("El telefono debe tener 10 digitos.");
    }

    const limiteIp = await consumirLimite(
      ctx,
      `evento:${evento._id}:ip:${datos.ipHash}`,
      CUOTAS.registroPorIp.maximo,
      CUOTAS.registroPorIp.ventanaMs,
    );
    if (!limiteIp.permitido) return { ok: false, creado: false, motivo: "limite" };

    const claveCorreo = `evento:${evento._id}:correo:${await sha256Hex(correo)}`;
    const limiteCorreo = await consumirLimite(
      ctx,
      claveCorreo,
      CUOTAS.registroPorCorreo.maximo,
      CUOTAS.registroPorCorreo.ventanaMs,
    );
    if (!limiteCorreo.permitido) return { ok: false, creado: false, motivo: "limite" };

    const existente = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_correo", (q) =>
        q.eq("eventId", evento._id).eq("correo", correo),
      )
      .unique();
    if (existente !== null) {
      return { ok: true, creado: false, registroId: existente._id };
    }

    const ahora = Date.now();
    const registroId = await ctx.db.insert("eventRegistrations", {
      eventId: evento._id,
      nombre: limpiarTexto(datos.nombre, 80),
      correo,
      carrera: limpiarTexto(datos.carrera, 80),
      semestre: limpiarTexto(datos.semestre, 30),
      ...(datos.matricula
        ? { matricula: limpiarTexto(datos.matricula, 12).toUpperCase() }
        : {}),
      canales,
      ...(telefono ? { telefono } : {}),
      estado: "registrado",
      origen: `evento:${slug}`,
      ipHash: limpiarTexto(datos.ipHash, 128),
      userAgent: limpiarTexto(datos.userAgent, 200),
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await ctx.db.patch(evento._id, {
      totalRegistros: evento.totalRegistros + 1,
      actualizadoEn: ahora,
    });
    return { ok: true, creado: true, registroId };
  },
});

/* ---------- Networking Night ---------- */

const datosNetworkingNight = v.object({
  nombre: v.string(),
  correo: v.string(),
  matricula: v.string(),
  carrera: v.string(),
  semestre: v.string(),
  intereses: v.array(v.string()),
  habilidades: v.array(v.string()),
  cvStorageId: v.optional(v.id("_storage")),
  metodoPago: v.literal("efectivo"),
  ipHash: v.string(),
  userAgent: v.string(),
});

/**
 * Crea la fila del evento si aún no existe. Después manda el panel: fecha,
 * sede, resumen y apertura del registro se editan ahí y aquí no se tocan.
 */
async function asegurarEventoNetworkingNight(ctx: MutationCtx): Promise<Doc<"events">> {
  const existente = await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", SLUG_NETWORKING_NIGHT))
    .unique();
  if (existente !== null) return existente;

  const ahora = Date.now();
  const id = await ctx.db.insert("events", {
    slug: SLUG_NETWORKING_NIGHT,
    titulo: NETWORKING_NIGHT.titulo,
    resumen: NETWORKING_NIGHT.resumen,
    pilar: "industria",
    fechaEvento: NETWORKING_NIGHT.fechaIso,
    horaInicio: NETWORKING_NIGHT.horaInicio,
    horaFin: NETWORKING_NIGHT.horaFin,
    sede: `${NETWORKING_NIGHT.sede}, ${NETWORKING_NIGHT.campus}`,
    estado: "publicado",
    registroAbierto: true,
    totalRegistros: 0,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });
  return (await ctx.db.get(id))!;
}

function listaLimpia(valores: string[], maximo: number, largo: number): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const valor of valores) {
    const limpio = limpiarTexto(valor, largo);
    const clave = limpio.toLowerCase();
    if (!limpio || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(limpio);
    if (salida.length === maximo) break;
  }
  return salida;
}

export const consumirSubidaCv = internalMutation({
  args: { ipHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const limite = await consumirLimite(
      ctx,
      `evento:${SLUG_NETWORKING_NIGHT}:cv:ip:${limpiarTexto(args.ipHash, 128)}`,
      SUBIDAS_CV_POR_IP.maximo,
      SUBIDAS_CV_POR_IP.ventanaMs,
    );
    return limite.permitido;
  },
});

/** URL de subida de un solo uso para el CV. El archivo se revisa al registrar. */
export const urlSubidaCvNetworkingNight = action({
  args: { secreto: v.string(), ipHash: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), url: v.string() }),
    v.object({ ok: v.literal(false) }),
  ),
  handler: async (ctx, args): Promise<{ ok: true; url: string } | { ok: false }> => {
    exigirSecreto(args.secreto);
    const permitido: boolean = await ctx.runMutation(internal.ingestaEventos.consumirSubidaCv, {
      ipHash: args.ipHash,
    });
    if (!permitido) return { ok: false };
    return { ok: true, url: await ctx.storage.generateUploadUrl() };
  },
});

export const guardarNetworkingNight = internalMutation({
  args: { datos: datosNetworkingNight },
  returns: v.object({
    ok: v.boolean(),
    creado: v.boolean(),
    motivo: v.optional(v.string()),
    registroId: v.optional(v.id("eventRegistrations")),
    nombre: v.optional(v.string()),
    correo: v.optional(v.string()),
    pago: v.optional(pagoBoletoValidador),
  }),
  handler: async (
    ctx,
    { datos },
  ): Promise<{
    ok: boolean;
    creado: boolean;
    motivo?: string;
    registroId?: Id<"eventRegistrations">;
    nombre?: string;
    correo?: string;
    pago?: PagoBoleto;
  }> => {
    const descartarCv = async () => {
      if (datos.cvStorageId && (await ctx.db.system.get(datos.cvStorageId))) {
        await ctx.storage.delete(datos.cvStorageId);
      }
    };

    const evento = await asegurarEventoNetworkingNight(ctx);
    if (evento.estado !== "publicado" || !evento.registroAbierto) {
      await descartarCv();
      return { ok: false, creado: false, motivo: "cerrado" };
    }

    const correo = normalizarCorreo(datos.correo);
    const nombre = limpiarTexto(datos.nombre, 80);
    const matricula = limpiarTexto(datos.matricula, 12).toUpperCase();
    const carrera = limpiarTexto(datos.carrera, 60);
    const semestre = limpiarTexto(datos.semestre, 2);
    const intereses = listaLimpia(datos.intereses, MAX_INTERESES_NETWORKING_NIGHT, 40).filter(
      (interes) => (INTERESES_NETWORKING_NIGHT as readonly string[]).includes(interes),
    );
    const habilidades = listaLimpia(datos.habilidades, MAX_HABILIDADES_NETWORKING_NIGHT, 32);
    if (
      nombre.length < 3 ||
      !/^[^@\s]+@tec\.mx$/.test(correo) ||
      !/^[AL]\d{8}$/.test(matricula) ||
      carrera.length < 2 ||
      !(SEMESTRES_NETWORKING_NIGHT as readonly string[]).includes(semestre)
    ) {
      await descartarCv();
      return { ok: false, creado: false, motivo: "datos" };
    }

    const limiteIp = await consumirLimite(
      ctx,
      `evento:${evento._id}:ip:${datos.ipHash}`,
      CUOTAS.registroPorIp.maximo,
      CUOTAS.registroPorIp.ventanaMs,
    );
    if (!limiteIp.permitido) {
      await descartarCv();
      return { ok: false, creado: false, motivo: "limite" };
    }
    const limiteCorreo = await consumirLimite(
      ctx,
      `evento:${evento._id}:correo:${await sha256Hex(correo)}`,
      CUOTAS.registroPorCorreo.maximo,
      CUOTAS.registroPorCorreo.ventanaMs,
    );
    if (!limiteCorreo.permitido) {
      await descartarCv();
      return { ok: false, creado: false, motivo: "limite" };
    }

    const existente = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_correo", (q) => q.eq("eventId", evento._id).eq("correo", correo))
      .unique();
    if (existente !== null) {
      await descartarCv();
      return {
        ok: true,
        creado: false,
        registroId: existente._id,
        nombre: existente.nombre,
        correo: existente.correo,
        ...(existente.pago ? { pago: pagoDelBoleto(existente.pago) } : {}),
      };
    }

    let cvStorageId: Id<"_storage"> | undefined;
    if (datos.cvStorageId) {
      const archivo = await ctx.db.system.get(datos.cvStorageId);
      if (
        archivo === null ||
        archivo.size > MAX_CV_BYTES_NETWORKING_NIGHT ||
        archivo.contentType !== "application/pdf"
      ) {
        await descartarCv();
        return { ok: false, creado: false, motivo: "cv" };
      }
      cvStorageId = archivo._id;
    }

    const ahora = Date.now();
    const pago = { metodo: datos.metodoPago, estado: "pendiente" as const, montoMxn: NETWORKING_NIGHT.cuotaMxn };
    const registroId = await ctx.db.insert("eventRegistrations", {
      eventId: evento._id,
      nombre,
      correo,
      carrera,
      semestre,
      matricula,
      canales: { correo: true, whatsapp: false },
      perfil: { intereses, habilidades, ...(cvStorageId ? { cvStorageId } : {}) },
      pago,
      estado: "registrado",
      origen: `evento:${SLUG_NETWORKING_NIGHT}`,
      ipHash: limpiarTexto(datos.ipHash, 128),
      userAgent: limpiarTexto(datos.userAgent, 200),
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await ctx.db.patch(evento._id, {
      totalRegistros: evento.totalRegistros + 1,
      actualizadoEn: ahora,
    });
    return { ok: true, creado: true, registroId, nombre, correo, pago };
  },
});

/**
 * Punto de entrada para el webhook de Stripe cuando se active: marca la cuota
 * como pagada en línea y reenvía el boleto, que ya no pide efectivo.
 */
export const confirmarPagoEnLineaNetworkingNight = internalMutation({
  args: { registroId: v.id("eventRegistrations"), montoMxn: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const registro = await ctx.db.get(args.registroId);
    if (registro === null || registro.estado === "cancelado" || registro.pago?.estado === "pagado") return false;
    if (args.montoMxn < (registro.pago?.montoMxn ?? NETWORKING_NIGHT.cuotaMxn)) return false;
    const ahora = Date.now();
    const pago = { metodo: "stripe" as const, estado: "pagado" as const, montoMxn: args.montoMxn };
    await ctx.db.patch(registro._id, { pago: { ...pago, pagadoEn: ahora }, actualizadoEn: ahora });
    await ctx.scheduler.runAfter(0, internal.correoActions.enviarConfirmacionNetworkingNight, {
      nombre: registro.nombre,
      correo: registro.correo,
      registroId: registro._id,
      pago,
    });
    return true;
  },
});

/**
 * Un correo repetido no devuelve el boleto en pantalla: se reenvía al buzón
 * del titular, para que nadie obtenga el QR de otra persona con su correo.
 */
export const registrarNetworkingNight = action({
  args: { secreto: v.string(), datos: datosNetworkingNight },
  returns: v.object({
    ok: v.boolean(),
    motivo: v.optional(v.string()),
    creado: v.optional(v.boolean()),
    registroId: v.optional(v.id("eventRegistrations")),
    nombre: v.optional(v.string()),
    pago: v.optional(pagoBoletoValidador),
    correoEnviado: v.optional(v.boolean()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    motivo?: string;
    creado?: boolean;
    registroId?: Id<"eventRegistrations">;
    nombre?: string;
    pago?: PagoBoleto;
    correoEnviado?: boolean;
  }> => {
    exigirSecreto(args.secreto);
    const resultado = await ctx.runMutation(internal.ingestaEventos.guardarNetworkingNight, {
      datos: args.datos,
    });
    if (!resultado.ok || !resultado.registroId || !resultado.nombre || !resultado.correo) {
      return { ok: false, ...(resultado.motivo ? { motivo: resultado.motivo } : {}) };
    }

    let correoEnviado = false;
    try {
      correoEnviado = await ctx.runAction(internal.correoActions.enviarConfirmacionNetworkingNight, {
        nombre: resultado.nombre,
        correo: resultado.correo,
        registroId: resultado.registroId,
        ...(resultado.pago ? { pago: resultado.pago } : {}),
      });
      if (!correoEnviado) {
        console.error("No se encoló el boleto de Networking Night: correo automático no configurado.");
      }
    } catch (error) {
      console.error(
        "No se pudo encolar el boleto de Networking Night.",
        error instanceof Error ? error.message : "Error desconocido",
      );
    }

    return resultado.creado
      ? {
          ok: true,
          creado: true,
          registroId: resultado.registroId,
          nombre: resultado.nombre,
          ...(resultado.pago ? { pago: resultado.pago } : {}),
          correoEnviado,
        }
      : { ok: true, creado: false, correoEnviado };
  },
});
