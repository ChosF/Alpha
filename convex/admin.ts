import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  enviarInvitacionPorCorreo,
  redactarEnlacesInvitacion,
  tokensEnEnlacesInvitacion,
} from "./correo";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import type { EstadoEvento, EstadoPrograma, Pilar } from "./lib/validadores";
import { CALLING_LAF } from "../lib/calling-laf";
import { MARIO_KART_CHALLENGE } from "../lib/mario-kart";

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

type FilaPrograma = {
  slug: string;
  titulo: string;
  periodo: string;
  pilar: Pilar;
  estado: EstadoPrograma;
  resumen?: string;
  rutaPublica?: string;
  fechaEvento?: string;
  horaInicio?: string;
  horaFin?: string;
  sede?: string;
  estadoEvento?: EstadoEvento;
  registroAbierto?: boolean;
};

const PROGRAMA_2026_2027: FilaPrograma[] = [
  {
    slug: "calling-laf",
    titulo: "Calling LAF",
    periodo: "Ago — Dic 2026",
    pilar: "desarrollo",
    estado: "planeacion",
    resumen:
      "Un encuentro para entender concentraciones, certificaciones y rutas profesionales antes de elegir el siguiente paso de la carrera.",
    rutaPublica: "/eventos/calling-laf",
    fechaEvento: CALLING_LAF.fechaIso,
    horaInicio: "15:00",
    horaFin: "17:00",
    sede: `${CALLING_LAF.sede}, ${CALLING_LAF.campus}`,
    estadoEvento: "publicado",
    registroAbierto: true,
  },
  {
    slug: "mario-kart",
    titulo: MARIO_KART_CHALLENGE.titulo,
    periodo: "Sep 2026",
    pilar: "comunidad",
    estado: "planeacion",
    resumen: MARIO_KART_CHALLENGE.resumen,
    rutaPublica: MARIO_KART_CHALLENGE.ruta,
    fechaEvento: MARIO_KART_CHALLENGE.fechaIso,
    horaInicio: "13:00",
    horaFin: "17:00",
    sede: `${MARIO_KART_CHALLENGE.sede}, ${MARIO_KART_CHALLENGE.campus}`,
    estadoEvento: "publicado",
    registroAbierto: true,
  },
  { slug: "alpha-integration", titulo: "Alpha Integration", periodo: "Ago — Dic 2026", pilar: "comunidad", estado: "planeacion" },
  { slug: "quantitative-finance-workshop", titulo: "Quantitative Finance Workshop", periodo: "Ago — Dic 2026", pilar: "desarrollo", estado: "planeacion" },
  { slug: "networking-night", titulo: "Networking Night", periodo: "Ago — Dic 2026", pilar: "industria", estado: "planeacion" },
  { slug: "finance-bootcamp", titulo: "Finance Bootcamp", periodo: "Ago — Dic 2026", pilar: "desarrollo", estado: "planeacion" },
  { slug: "finanzas-para-todos", titulo: "Finanzas para Todos", periodo: "Ago — Dic 2026", pilar: "comunidad", estado: "propuesto" },
  { slug: "viaje-academico-wall-street", titulo: "Viaje académico a Wall Street", periodo: "Dic 2026", pilar: "industria", estado: "exploratorio" },
  { slug: "servicio-social-asesoria-financiera", titulo: "Servicio social de asesoría financiera", periodo: "Ago — Dic 2026", pilar: "comunidad", estado: "exploratorio" },
  { slug: "welcome-laf", titulo: "Welcome LAF", periodo: "Feb — Jun 2027", pilar: "comunidad", estado: "propuesto" },
  { slug: "flag-football-super-bowl", titulo: "Flag Football · Super Bowl", periodo: "Feb 2027", pilar: "comunidad", estado: "propuesto" },
  { slug: "quantitative-finance-bootcamp-modulo-2", titulo: "Quantitative Finance Bootcamp · Módulo 2", periodo: "Feb — Jun 2027", pilar: "desarrollo", estado: "propuesto" },
  { slug: "finanzas-para-todos-2-edicion", titulo: "Finanzas para Todos · 2.ª edición", periodo: "Feb — Jun 2027", pilar: "comunidad", estado: "propuesto" },
  { slug: "mastering-money", titulo: "Mastering Money", periodo: "Feb — Jun 2027", pilar: "desarrollo", estado: "propuesto" },
  { slug: "cena-cierre-reconocimiento", titulo: "Cena de cierre y reconocimiento", periodo: "Jun 2027", pilar: "comunidad", estado: "propuesto" },
];

/**
 * Convierte el catalogo de la landing en eventos reales, sin reemplazar las
 * filas existentes de Calling LAF o Mario Kart ni sus registros asociados.
 */
export const migrarProgramaAEventos = internalMutation({
  args: {},
  returns: v.object({
    creados: v.number(),
    actualizados: v.number(),
    legadosEliminados: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const ahora = Date.now();
    let creados = 0;
    let actualizados = 0;

    for (const [indice, fila] of PROGRAMA_2026_2027.entries()) {
      const existente = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", fila.slug))
        .unique();
      const programa = {
        titulo: fila.titulo,
        pilar: fila.pilar,
        periodoPrograma: fila.periodo,
        estadoPrograma: fila.estado,
        ordenPrograma: indice + 1,
        publicadoEnLanding: true,
        ...(fila.rutaPublica ? { rutaPublica: fila.rutaPublica } : {}),
        ...(fila.fechaEvento ? { fechaEvento: fila.fechaEvento } : {}),
        ...(fila.horaInicio ? { horaInicio: fila.horaInicio } : {}),
        ...(fila.horaFin ? { horaFin: fila.horaFin } : {}),
        ...(fila.sede ? { sede: fila.sede } : {}),
        actualizadoEn: ahora,
      };

      if (existente) {
        await ctx.db.patch(existente._id, programa);
        actualizados += 1;
        continue;
      }

      await ctx.db.insert("events", {
        slug: fila.slug,
        resumen: fila.resumen ?? "",
        estado: fila.estadoEvento ?? "borrador",
        registroAbierto: fila.registroAbierto ?? false,
        totalRegistros: 0,
        creadoEn: ahora,
        ...programa,
      });
      creados += 1;
    }

    const legados = await ctx.db.query("programs").collect();
    await Promise.all(legados.map((fila) => ctx.db.delete(fila._id)));
    return {
      creados,
      actualizados,
      legadosEliminados: legados.length,
      total: PROGRAMA_2026_2027.length,
    };
  },
});
