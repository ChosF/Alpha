import { ConvexError, v, type Infer } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { comparaSegura, normalizarCorreo, sha256Hex } from "./lib/texto";
import { consumirLimite } from "./lib/limites";
import { resend } from "./correo";
import { renderizarCorreoDashboard, textoConFirma } from "./lib/plantillaCorreo";
import { correoContacto } from "./lib/direccionesCorreo";
import { CIERRE_TORNEO, MAX_EQUIPOS_INICIAL, REGLA_TORNEO, TAMANO_EQUIPO } from "../lib/torneo-mario-kart";
import { AVISO_REGISTRO_MARIO_KART } from "../lib/mario-kart";

const equipoPublico = v.object({ id: v.id("tournamentTeams"), nombre: v.string(), privado: v.boolean(), miembros: v.number(), descalificado: v.boolean() });
const resultado = v.object({ estado: v.union(v.literal("registro"), v.literal("unido"), v.literal("pendiente"), v.literal("creado"), v.literal("rechazada"), v.literal("error")), mensaje: v.string() });
const ficha = (equipo: Doc<"tournamentTeams">) => ({ id: equipo._id, nombre: equipo.nombre, privado: equipo.privado, miembros: equipo.miembros.length, descalificado: equipo.descalificado || (Date.now() >= CIERRE_TORNEO && equipo.miembros.length !== TAMANO_EQUIPO) });
const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export const listar = query({
  args: { invitacion: v.optional(v.string()) },
  returns: v.object({ equipos: v.array(equipoPublico), invitado: v.union(equipoPublico, v.null()), maxEquipos: v.number(), cerrado: v.boolean(), cierre: v.number() }),
  handler: async (ctx, { invitacion }) => {
    const evento = await ctx.db.query("events").withIndex("by_slug", q => q.eq("slug", "mario-kart")).unique();
    const equipos = evento ? await ctx.db.query("tournamentTeams").withIndex("by_event", q => q.eq("eventId", evento._id)).collect() : [];
    const hash = invitacion && /^[a-f0-9]{64}$/.test(invitacion) ? await sha256Hex(invitacion) : "";
    const invitado = equipos.find(e => e.invitacionHash === hash);
    return { equipos: equipos.map(ficha), invitado: invitado ? ficha(invitado) : null, maxEquipos: evento?.maxEquipos ?? MAX_EQUIPOS_INICIAL, cerrado: !evento || evento.estado !== "publicado" || !evento.registroAbierto || Date.now() >= CIERRE_TORNEO, cierre: CIERRE_TORNEO };
  },
});

export const solicitud = query({
  args: { token: v.string() },
  returns: v.union(v.null(), v.object({ equipo: v.string(), nombre: v.string(), correo: v.string(), estado: v.string(), cerrado: v.boolean() })),
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = await sha256Hex(token);
    const peticion = await ctx.db.query("tournamentRequests").withIndex("by_token", q => q.eq("tokenHash", hash)).unique();
    if (!peticion || peticion.estado !== "pendiente" || Date.now() >= CIERRE_TORNEO) return null;
    const [equipo, persona] = await Promise.all([ctx.db.get(peticion.equipoId), ctx.db.get(peticion.registroId)]);
    if (!equipo || !persona || equipo.descalificado || persona.estado === "cancelado" || persona.equipoId) return null;
    const evento = await ctx.db.get(equipo.eventId);
    if (!evento || evento.estado !== "publicado" || !evento.registroAbierto) return null;
    return { equipo: equipo.nombre, nombre: persona.nombre, correo: persona.correo, estado: peticion.estado, cerrado: Date.now() >= CIERRE_TORNEO };
  },
});

async function enviar(ctx: MutationCtx, para: string, asunto: string, texto: string, accion?: { url: string; etiqueta: string }, tabla = "") {
  if (!process.env.RESEND_API_KEY || !process.env.SITE_URL || process.env.RESEND_TEST_MODE !== "false") {
    throw new ConvexError("Los correos del torneo no están disponibles. Intenta más tarde.");
  }
  const remitente = process.env.ALPHA_AUTO_EMAIL ?? "auto@alphaccm.org";
  texto = `${texto}\n\n${AVISO_REGISTRO_MARIO_KART}`;
  const html = renderizarCorreoDashboard({ asunto, texto, remitente, accion }).replace("</body>", `${tabla}</body>`);
  await resend.sendEmail(ctx, { from: `Alpha CCM <${remitente}>`, to: para, subject: asunto, text: textoConFirma(`${texto}${accion ? `\n\n${accion.url}` : ""}`, remitente), html, replyTo: [correoContacto()] });
}

async function avisarCapitan(ctx: MutationCtx, equipo: Doc<"tournamentTeams">, mensaje: string, accion?: { url: string; etiqueta: string }) {
  const personas = await Promise.all(equipo.miembros.map(id => ctx.db.get(id)));
  const capitan = await ctx.db.get(equipo.capitanId);
  if (!capitan) throw new ConvexError("No se encontró al capitán.");
  const miembros = personas.filter(p => p !== null);
  const lista = miembros.map(p => `${p.nombre} · ${p.correo}`).join("\n");
  const tabla = `<table style="width:100%;max-width:600px;margin:20px auto;border-collapse:collapse;font:14px Arial;color:#194270;background:#fff"><caption style="padding:12px;font-weight:bold">${escapar(equipo.nombre)} · ${miembros.length}/4 integrantes</caption><thead><tr><th style="padding:10px;text-align:left">Nombre</th><th style="padding:10px;text-align:left">Correo</th></tr></thead><tbody>${miembros.map(p => `<tr><td style="padding:10px;border-top:1px solid #ddd">${escapar(p.nombre)}</td><td style="padding:10px;border-top:1px solid #ddd;overflow-wrap:anywhere">${escapar(p.correo)}</td></tr>`).join("")}</tbody></table>`;
  await enviar(ctx, capitan.correo, `${equipo.nombre} · Mario Kart Challenge`, `${mensaje}\n\n${REGLA_TORNEO}\n\nIntegrantes (${miembros.length}/4):\n${lista}`, accion, tabla);
}

async function agregar(ctx: MutationCtx, equipo: Doc<"tournamentTeams">, persona: Doc<"eventRegistrations">) {
  if (persona.equipoId) throw new ConvexError("Ya formas parte de un equipo.");
  if (persona.estado === "cancelado") throw new ConvexError("Tu registro está cancelado. Contacta a Alpha.");
  if (equipo.miembros.length >= TAMANO_EQUIPO) throw new ConvexError("Este equipo ya tiene 4 integrantes. Elige otro.");
  const miembros = [...equipo.miembros, persona._id];
  await ctx.db.patch(equipo._id, { miembros });
  await ctx.db.patch(persona._id, { equipoId: equipo._id, equipoNombre: equipo.nombre, actualizadoEn: Date.now() });
  const pendientes = await ctx.db.query("tournamentRequests").withIndex("by_registration", q => q.eq("registroId", persona._id)).collect();
  for (const pendiente of pendientes) if (pendiente.estado === "pendiente") await ctx.db.patch(pendiente._id, { estado: pendiente.equipoId === equipo._id ? "aceptada" : "rechazada" });
  await avisarCapitan(ctx, { ...equipo, miembros }, `${persona.nombre} se unió a tu equipo.`);
  await enviar(ctx, persona.correo, `Ya estás en ${equipo.nombre}`, `Tu lugar en el equipo ${equipo.nombre} está confirmado.\n\n${REGLA_TORNEO}`);
}

const argumentosParticipar = { secreto: v.string(), correo: v.string(), ipHash: v.string(), userAgent: v.string(),
    equipoId: v.optional(v.id("tournamentTeams")), invitacion: v.optional(v.string()),
    nombreEquipo: v.optional(v.string()), privado: v.optional(v.boolean()), nuevoToken: v.string(),
    persona: v.optional(v.object({ nombre: v.string(), carrera: v.string(), semestre: v.string(), matricula: v.string() })),
};

/** Commit the attempt before running the membership transaction, even if it fails. */
export const participar = action({
  args: argumentosParticipar,
  returns: resultado,
  handler: async (ctx, args): Promise<Infer<typeof resultado>> => {
    if (!process.env.INGEST_SECRET || process.env.INGEST_SECRET.length < 32 || !comparaSegura(args.secreto, process.env.INGEST_SECRET)) throw new ConvexError("No autorizado.");
    const permitido = await ctx.runMutation(internal.equiposMarioKart.consumirIntento, { correo: args.correo, ipHash: args.ipHash });
    if (!permitido) return { estado: "error", mensaje: "Recibimos varios intentos. Intenta más tarde." };
    return await ctx.runMutation(internal.equiposMarioKart.ejecutarParticipacion, args);
  },
});

export const consumirIntento = internalMutation({
  args: { correo: v.string(), ipHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const correo = normalizarCorreo(args.correo);
    for (const [clave, maximo] of [[`torneo:ip:${args.ipHash}`, 40], [`torneo:correo:${await sha256Hex(correo)}`, 10]] as const) {
      if (!(await consumirLimite(ctx, clave, maximo, 60 * 60 * 1000)).permitido) return false;
    }
    return true;
  },
});

export const ejecutarParticipacion = internalMutation({
  args: argumentosParticipar,
  returns: resultado,
  handler: async (ctx, args) => {
    if (!process.env.INGEST_SECRET || process.env.INGEST_SECRET.length < 32 || !comparaSegura(args.secreto, process.env.INGEST_SECRET)) throw new ConvexError("No autorizado.");
    const correo = normalizarCorreo(args.correo);
    if (correo.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || !/^[a-f0-9]{64}$/.test(args.nuevoToken)) throw new ConvexError("Revisa tu correo.");
    const evento = await ctx.db.query("events").withIndex("by_slug", q => q.eq("slug", "mario-kart")).unique();
    if (!evento || evento.estado !== "publicado" || !evento.registroAbierto || Date.now() >= CIERRE_TORNEO) throw new ConvexError("El registro al torneo está cerrado.");
    let equipo = args.equipoId ? await ctx.db.get(args.equipoId) : null;
    let invitado = false;
    if (args.invitacion) {
      if (!/^[a-f0-9]{64}$/.test(args.invitacion)) throw new ConvexError("La invitación no es válida.");
      const hash = await sha256Hex(args.invitacion);
      equipo = await ctx.db.query("tournamentTeams").withIndex("by_invitation", q => q.eq("invitacionHash", hash)).unique();
      if (!equipo) throw new ConvexError("La invitación no es válida.");
      invitado = true;
    }
    const creando = !args.equipoId && !args.invitacion;
    if (!creando && (!equipo || equipo.eventId !== evento._id || equipo.descalificado)) throw new ConvexError("Este equipo no está disponible.");
    let persona = await ctx.db.query("eventRegistrations").withIndex("by_event_and_correo", q => q.eq("eventId", evento._id).eq("correo", correo)).unique();
    if (persona?.estado === "cancelado") throw new ConvexError("Tu registro está cancelado. Contacta a Alpha.");
    if (persona?.equipoId) {
      if (equipo?._id === persona.equipoId || creando) return { estado: "unido" as const, mensaje: "Este correo ya pertenece a un equipo. Revisa la confirmación en tu correo." };
      throw new ConvexError("Este correo ya pertenece a otro equipo.");
    }
    const nombre = args.nombreEquipo?.trim() ?? "";
    if (creando) {
      if (nombre.length < 2 || nombre.length > 50) throw new ConvexError("El nombre del equipo debe tener entre 2 y 50 caracteres.");
      const equipos = await ctx.db.query("tournamentTeams").withIndex("by_event", q => q.eq("eventId", evento._id)).collect();
      if (equipos.length >= (evento.maxEquipos ?? MAX_EQUIPOS_INICIAL)) throw new ConvexError("Ya no hay espacio para crear equipos. Únete a uno disponible.");
      if (equipos.some(e => e.nombre.toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"))) throw new ConvexError("Ya existe un equipo con ese nombre.");
    } else if (equipo!.miembros.length >= TAMANO_EQUIPO) throw new ConvexError("Este equipo ya tiene 4 integrantes. Elige otro.");
    if (!persona && !args.persona) return { estado: "registro" as const, mensaje: "Completa tu registro al evento para continuar." };
    if (!persona) {
      const datos = args.persona!;
      if (datos.nombre.trim().length < 2 || datos.nombre.length > 80 || datos.carrera.trim().length < 2 || datos.carrera.length > 80 || !datos.semestre.trim() || datos.semestre.length > 30 || !/^A[0-9]{8}$/.test(datos.matricula)) throw new ConvexError("Revisa tu nombre, carrera, semestre y matrícula.");
      const id = await ctx.db.insert("eventRegistrations", { eventId: evento._id, nombre: datos.nombre.trim(), correo, carrera: datos.carrera.trim(), semestre: datos.semestre.trim(), matricula: datos.matricula, canales: { correo: true, whatsapp: false }, estado: "registrado", origen: "evento:mario-kart:torneo", ipHash: args.ipHash, userAgent: args.userAgent.slice(0, 200), creadoEn: Date.now(), actualizadoEn: Date.now() });
      await ctx.db.patch(evento._id, { totalRegistros: evento.totalRegistros + 1, actualizadoEn: Date.now() });
      persona = (await ctx.db.get(id))!;
      await ctx.scheduler.runAfter(0, internal.correoActions.enviarConfirmacionMarioKart, { nombre: persona.nombre, correo, registroId: id });
    }
    const sitio = process.env.SITE_URL?.replace(/\/$/, "");
    if (creando) {
      const id = await ctx.db.insert("tournamentTeams", { eventId: evento._id, nombre, privado: args.privado ?? false, capitanId: persona._id, miembros: [persona._id], invitacionHash: await sha256Hex(args.nuevoToken), descalificado: false });
      await ctx.db.patch(persona._id, { equipoId: id, equipoNombre: nombre, actualizadoEn: Date.now() });
      const pendientes = await ctx.db.query("tournamentRequests").withIndex("by_registration", q => q.eq("registroId", persona._id)).collect();
      for (const p of pendientes) if (p.estado === "pendiente") await ctx.db.patch(p._id, { estado: "rechazada" });
      await avisarCapitan(ctx, (await ctx.db.get(id))!, `Creaste ${nombre}. Comparte este enlace para invitar a tus compañeros. Quien lo use se unirá directamente, también si el equipo es privado.`, { etiqueta: "Invitar a mi equipo", url: `${sitio}/events/mario-kart#equipo=${args.nuevoToken}` });
      await ctx.scheduler.runAt(CIERRE_TORNEO, internal.equiposMarioKart.cerrarEquipo, { id });
      return { estado: "creado" as const, mensaje: "Tu equipo está creado. Enviamos a tu correo el enlace para invitar a tus 3 compañeros." };
    }
    if (equipo!.privado && !invitado) {
      const solicitudes = await ctx.db.query("tournamentRequests").withIndex("by_registration", q => q.eq("registroId", persona._id)).collect();
      if (!solicitudes.some(p => p.equipoId === equipo!._id && p.estado === "pendiente")) {
        await ctx.db.insert("tournamentRequests", { equipoId: equipo!._id, registroId: persona._id, tokenHash: await sha256Hex(args.nuevoToken), estado: "pendiente" });
        const capitan = await ctx.db.get(equipo!.capitanId);
        await enviar(ctx, capitan!.correo, `Solicitud para ${equipo!.nombre}`, `${persona.nombre} (${persona.correo}) quiere unirse a ${equipo!.nombre}. Revisa la solicitud para aceptar o rechazar.\n\n${REGLA_TORNEO}`, { etiqueta: "Revisar solicitud", url: `${sitio}/events/mario-kart#solicitud=${args.nuevoToken}` });
        await enviar(ctx, correo, `Solicitud enviada a ${equipo!.nombre}`, `El capitán recibió tu solicitud. Te avisaremos por correo cuando responda. Tu lugar en el equipo aún no está confirmado.\n\n${REGLA_TORNEO}`);
      }
      return { estado: "pendiente" as const, mensaje: "Solicitud enviada. Te avisaremos por correo cuando el capitán responda. Tu lugar en el equipo aún no está confirmado." };
    }
    await agregar(ctx, equipo!, persona);
    return { estado: "unido" as const, mensaje: "Ya formas parte del equipo. Te enviamos la confirmación por correo." };
  },
});

export const responder = mutation({
  args: { token: v.string(), aceptar: v.boolean() }, returns: resultado,
  handler: async (ctx, { token, aceptar }) => {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ConvexError("Solicitud no válida.");
    const hash = await sha256Hex(token);
    const solicitud = await ctx.db.query("tournamentRequests").withIndex("by_token", q => q.eq("tokenHash", hash)).unique();
    if (!solicitud) throw new ConvexError("Solicitud no válida.");
    if (solicitud.estado !== "pendiente") return { estado: solicitud.estado === "aceptada" ? "unido" as const : "rechazada" as const, mensaje: "Esta solicitud ya fue atendida." };
    const [equipo, persona] = await Promise.all([ctx.db.get(solicitud.equipoId), ctx.db.get(solicitud.registroId)]);
    const evento = equipo ? await ctx.db.get(equipo.eventId) : null;
    if (!equipo || !persona || !evento || evento.estado !== "publicado" || !evento.registroAbierto || equipo.descalificado || Date.now() >= CIERRE_TORNEO) throw new ConvexError("El registro al torneo está cerrado.");
    if (aceptar) await agregar(ctx, equipo, persona);
    else {
      await ctx.db.patch(solicitud._id, { estado: "rechazada" });
      await enviar(ctx, persona.correo, `Respuesta de ${equipo.nombre}`, `El capitán no aceptó tu solicitud. Puedes elegir otro equipo desde la página del torneo.\n\n${REGLA_TORNEO}`, { etiqueta: "Ver equipos", url: `${process.env.SITE_URL?.replace(/\/$/, "")}/events/mario-kart#torneo` });
    }
    return { estado: aceptar ? "unido" as const : "rechazada" as const, mensaje: aceptar ? "Integrante aceptado. Ya avisamos por correo." : "Solicitud rechazada. Ya avisamos por correo." };
  },
});

export const cerrarEquipo = internalMutation({
  args: { id: v.id("tournamentTeams") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const equipo = await ctx.db.get(id);
    if (!equipo || equipo.descalificado || Date.now() < CIERRE_TORNEO || equipo.miembros.length === TAMANO_EQUIPO) return null;
    await ctx.db.patch(id, { descalificado: true });
    for (const registroId of equipo.miembros) {
      const persona = await ctx.db.get(registroId);
      if (persona) await enviar(ctx, persona.correo, `${equipo.nombre} · Equipo descalificado`, `El plazo terminó y ${equipo.nombre} no reunió a sus 4 integrantes. El equipo queda descalificado del torneo. Tu registro para asistir al evento sigue vigente.`);
    }
    return null;
  },
});
