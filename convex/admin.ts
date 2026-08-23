import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  enviarInvitacionPorCorreo,
  redactarEnlacesInvitacion,
  tokensEnEnlacesInvitacion,
} from "./correo";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import { ESTADOS_PROGRAMA, PILARES } from "./lib/validadores";

/**
 * Arranque del sistema.
 *
 * Son internalMutation a proposito: no se pueden llamar desde el navegador,
 * solo con `npx convex run`, que exige credenciales del despliegue. Asi el
 * primer administrador no puede crearlo un visitante.
 */

/**
 * Crea la invitacion del primer administrador y devuelve el enlace.
 *
 *   npx convex run admin:sembrarAdmin '{"correo":"a01@tec.mx","nombre":"Mariela"}'
 */
export const sembrarAdmin = internalMutation({
  args: { correo: v.string(), nombre: v.string(), sitio: v.optional(v.string()) },
  returns: v.object({ enlace: v.string(), expiraEn: v.number(), correoEnviado: v.boolean() }),
  handler: async (ctx, args) => {
    const correo = normalizarCorreo(args.correo);
    const nombre = limpiarTexto(args.nombre, 80);
    const existentes = await ctx.db.query("users").collect();
    const cuentaExistente = existentes.find((u) => u.email === correo);
    if (cuentaExistente?.activo) {
      throw new Error("Ese correo ya tiene cuenta.");
    }
    if (cuentaExistente !== undefined && cuentaExistente.rol !== "admin") {
      throw new Error("Ese correo ya esta reservado para otro rol.");
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ahora = Date.now();
    const expiraEn = ahora + 7 * 24 * 60 * 60 * 1000;

    // La primera invitacion no tiene autor: se apunta a si misma una vez que
    // exista el usuario, pero el campo pide un id, asi que se usa el de un
    // administrador existente si lo hay.
    const algunAdmin = cuentaExistente ?? existentes.find((u) => u.rol === "admin");
    const creadaPor = algunAdmin?._id;
    if (creadaPor === undefined && existentes.length > 0) {
      throw new Error("Ya hay cuentas pero ningun administrador: revisa la base.");
    }

    const semilla =
      cuentaExistente?._id ??
      creadaPor ??
      (await ctx.db.insert("users", {
        email: correo,
        name: nombre,
        rol: "admin",
        activo: false, // se activa cuando complete el alta con su contrasena
        creadoEn: ahora,
      }));

    if (cuentaExistente !== undefined) {
      await ctx.db.patch(cuentaExistente._id, { name: nombre });
    }

    const anteriores = await ctx.db
      .query("invites")
      .withIndex("by_correo", (q) => q.eq("correo", correo))
      .collect();
    for (const anterior of anteriores) {
      if (anterior.usadaEn === undefined && anterior.revocadaEn === undefined) {
        await ctx.db.patch(anterior._id, { revocadaEn: ahora });
      }
    }

    await ctx.db.insert("invites", {
      correo,
      nombre,
      rol: "admin",
      tokenHash: await sha256Hex(token),
      expiraEn,
      creadaPor: semilla,
      creadaEn: ahora,
    });

    const actor = await ctx.db.get(semilla);
    if (actor === null) throw new Error("No se pudo preparar el remitente de la invitacion.");

    const correoEnviado = await enviarInvitacionPorCorreo(ctx, {
      actor,
      correo,
      nombre,
      token,
      expiraEn,
    });

    const sitio = (args.sitio ?? "http://localhost:3000").replace(/\/+$/, "");
    return { enlace: `${sitio}/dashboard/invitacion/${token}`, expiraEn, correoEnviado };
  },
});

/** Reenvia una invitacion inicial cuyo token aun conserva el administrador. */
export const reenviarInvitacionInicial = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{64}$/.test(args.token)) return false;

    const tokenHash = await sha256Hex(args.token);
    const invitacion = await ctx.db
      .query("invites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (
      invitacion === null ||
      invitacion.usadaEn !== undefined ||
      invitacion.revocadaEn !== undefined ||
      invitacion.expiraEn < Date.now()
    ) {
      return false;
    }

    const actor = await ctx.db.get(invitacion.creadaPor);
    if (actor === null) throw new Error("No se encontro al remitente de la invitacion.");

    return await enviarInvitacionPorCorreo(ctx, {
      actor,
      correo: invitacion.correo,
      nombre: invitacion.nombre,
      token: args.token,
      expiraEn: invitacion.expiraEn,
    });
  },
});

/**
 * Revoca invitaciones cuyo enlace quedo guardado en la bandeja y retira esas
 * copias. Es idempotente para poder ejecutarla con seguridad tras desplegar.
 */
export const remediarInvitacionesExpuestas = internalMutation({
  args: {},
  returns: v.object({
    invitacionesRevocadas: v.number(),
    mensajesSaneados: v.number(),
    hilosSaneados: v.number(),
  }),
  handler: async (ctx) => {
    const mensajes = await ctx.db.query("mailMessages").collect();
    const hilos = new Set<string>();
    const tokens = new Set<string>();
    let mensajesSaneados = 0;

    for (const mensaje of mensajes) {
      const fuentes = [
        mensaje.texto,
        mensaje.html ?? "",
        ...(mensaje.segmentos?.map((segmento) => segmento.texto) ?? []),
      ];
      const encontrados = fuentes.flatMap(tokensEnEnlacesInvitacion);
      if (encontrados.length === 0) continue;

      encontrados.forEach((token) => tokens.add(token));
      const html = mensaje.html ? redactarEnlacesInvitacion(mensaje.html) : undefined;
      const segmentos = mensaje.segmentos?.map((segmento) => ({
        ...segmento,
        texto: redactarEnlacesInvitacion(segmento.texto),
      }));
      await ctx.db.patch(mensaje._id, {
        texto: redactarEnlacesInvitacion(mensaje.texto),
        ...(html !== undefined ? { html } : {}),
        ...(segmentos !== undefined ? { segmentos } : {}),
      });
      hilos.add(mensaje.threadId);
      mensajesSaneados += 1;
    }

    let invitacionesRevocadas = 0;
    const ahora = Date.now();
    for (const token of tokens) {
      const tokenHash = await sha256Hex(token);
      const invitacion = await ctx.db
        .query("invites")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .unique();
      if (
        invitacion &&
        invitacion.usadaEn === undefined &&
        invitacion.revocadaEn === undefined
      ) {
        await ctx.db.patch(invitacion._id, { revocadaEn: ahora });
        invitacionesRevocadas += 1;
      }
    }

    let hilosSaneados = 0;
    for (const threadId of hilos) {
      const id = ctx.db.normalizeId("mailThreads", threadId);
      if (!id) continue;
      const hilo = await ctx.db.get(id);
      if (!hilo) continue;
      await ctx.db.patch(id, {
        ultimoResumen: "Invitacion enviada. El enlace personal se retiro de la bandeja.",
        actualizadoEn: ahora,
      });
      hilosSaneados += 1;
    }

    return { invitacionesRevocadas, mensajesSaneados, hilosSaneados };
  },
});

/** Carga el programa 2026-2027 que hoy esta escrito a mano en la landing. */
export const sembrarProgramas = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existentes = await ctx.db.query("programs").collect();
    if (existentes.length > 0) return 0;

    const base: Array<[string, string, (typeof PILARES)[number], (typeof ESTADOS_PROGRAMA)[number]]> = [
      ["Calling LAF's", "Ago - Dic 2026", "comunidad", "planeacion"],
      ["Alpha Integration", "Ago - Dic 2026", "comunidad", "planeacion"],
      ["Quantitative Finance Workshop", "Ago - Dic 2026", "desarrollo", "planeacion"],
      ["Networking Night", "Ago - Dic 2026", "industria", "planeacion"],
      ["Finance Bootcamp", "Ago - Dic 2026", "desarrollo", "planeacion"],
      ["Finanzas para Todos", "Ago - Dic 2026", "comunidad", "propuesto"],
      ["Viaje academico a Wall Street", "Dic 2026", "industria", "exploratorio"],
      ["Servicio social de asesoria financiera", "Ago - Dic 2026", "comunidad", "exploratorio"],
      ["Welcome LAF", "Feb - Jun 2027", "comunidad", "propuesto"],
      ["Flag Football / Super Bowl", "Feb 2027", "comunidad", "propuesto"],
      ["Quantitative Finance Bootcamp - Modulo 2", "Feb - Jun 2027", "desarrollo", "propuesto"],
      ["Finanzas para Todos - 2.a edicion", "Feb - Jun 2027", "comunidad", "propuesto"],
      ["Mastering Money", "Feb - Jun 2027", "desarrollo", "propuesto"],
      ["Cena de cierre y reconocimiento", "Jun 2027", "comunidad", "propuesto"],
    ];

    const ahora = Date.now();
    let orden = 1;
    for (const [titulo, periodo, pilar, estado] of base) {
      await ctx.db.insert("programs", {
        titulo,
        periodo,
        pilar,
        estado,
        orden,
        publicado: true,
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
      orden += 1;
    }
    return base.length;
  },
});
