import { ConvexError, v, type GenericId } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { resend } from "./correo";
import { registrarEnBitacora } from "./lib/auditoria";
import { correoContacto } from "./lib/direccionesCorreo";
import {
  prepararCorreoEncuesta,
  renderizarCorreoDashboard,
  textoConFirma,
} from "./lib/plantillaCorreo";
import { requiereRol } from "./lib/rbac";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo } from "./lib/texto";
import {
  asuntoRecordatorioEvento,
  fechaEnCiudadDeMexico,
  textoRecordatorioEvento,
} from "../lib/correo-evento";

const MAX_DESTINATARIOS = 500;
const MAX_TEXTO = 20_000;
const UN_ANO_MS = 366 * 24 * 60 * 60 * 1000;

const tipoCorreoEventoValidador = v.union(
  v.literal("recordatorio"),
  v.literal("encuesta"),
  v.literal("normal"),
);
const estadoCorreoEventoValidador = v.union(
  v.literal("programado"),
  v.literal("procesando"),
  v.literal("encolado"),
  v.literal("cancelado"),
  v.literal("fallido"),
);

const trabajoValidador = v.object({
  _id: v.id("eventMailJobs"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  tipo: tipoCorreoEventoValidador,
  asunto: v.string(),
  texto: v.string(),
  estado: estadoCorreoEventoValidador,
  destinatariosEstimados: v.number(),
  encolados: v.number(),
  fallidos: v.number(),
  programadoPara: v.number(),
  programacionId: v.optional(v.string()),
  clientRequestId: v.string(),
  creadoPor: v.id("users"),
  autorCorreo: v.string(),
  error: v.optional(v.string()),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

const destinatarioValidador = v.object({ nombre: v.string(), correo: v.string() });

type ContextoLectura = QueryCtx | MutationCtx;

async function destinatariosDeEvento(ctx: ContextoLectura, eventId: Id<"events">) {
  const registros = await ctx.db
    .query("eventRegistrations")
    .withIndex("by_event_and_creado", (q) => q.eq("eventId", eventId))
    .order("asc")
    .take(5000);
  const unicos = new Map<string, { nombre: string; correo: string }>();
  for (const registro of registros) {
    if (!registro.canales.correo) continue;
    if (
      registro.estado !== "registrado" &&
      registro.estado !== "confirmado" &&
      registro.estado !== "asistio"
    ) continue;
    const correo = normalizarCorreo(registro.correo);
    if (!correo) continue;
    unicos.set(correo, { nombre: registro.nombre, correo });
  }
  return {
    destinatarios: [...unicos.values()].slice(0, MAX_DESTINATARIOS),
    limiteExcedido: unicos.size > MAX_DESTINATARIOS,
  };
}

function detallesCompletos(evento: Doc<"events">) {
  if (!evento.fechaEvento || !evento.horaInicio || !evento.sede) return null;
  return {
    titulo: evento.titulo,
    fechaEvento: evento.fechaEvento,
    horaInicio: evento.horaInicio,
    ...(evento.horaFin ? { horaFin: evento.horaFin } : {}),
    sede: evento.sede,
  };
}

function personalizarSaludo(texto: string, nombre: string): string {
  return texto.startsWith("Hola.\n") ? texto.replace("Hola.\n", `Hola, ${nombre.trim()}.\n`) : texto;
}

export const resumen = query({
  args: { eventId: v.id("events") },
  returns: v.object({
    cantidad: v.number(),
    limiteExcedido: v.boolean(),
    correoListo: v.boolean(),
    modoPrueba: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "editor");
    const resultado = await destinatariosDeEvento(ctx, args.eventId);
    return {
      cantidad: resultado.destinatarios.length,
      limiteExcedido: resultado.limiteExcedido,
      correoListo: Boolean(process.env.RESEND_API_KEY),
      modoPrueba: process.env.RESEND_TEST_MODE !== "false",
    };
  },
});

export const listar = query({
  args: { eventId: v.id("events") },
  returns: v.array(trabajoValidador),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "editor");
    return await ctx.db
      .query("eventMailJobs")
      .withIndex("by_event_and_time", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(8);
  },
});

export const programar = mutation({
  args: {
    eventId: v.id("events"),
    tipo: tipoCorreoEventoValidador,
    asunto: v.optional(v.string()),
    texto: v.optional(v.string()),
    programadoPara: v.number(),
    clientRequestId: v.string(),
  },
  returns: v.object({
    id: v.id("eventMailJobs"),
    destinatarios: v.number(),
    programadoPara: v.number(),
  }),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const clientRequestId = limpiarTexto(args.clientRequestId, 80);
    if (clientRequestId.length < 8) throw new ConvexError("Identificador de envío no válido.");
    const existente = await ctx.db
      .query("eventMailJobs")
      .withIndex("by_client_request", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
    if (existente) {
      return {
        id: existente._id,
        destinatarios: existente.destinatariosEstimados,
        programadoPara: existente.programadoPara,
      };
    }

    const evento = await ctx.db.get(args.eventId);
    if (!evento) throw new ConvexError("Ese evento ya no existe.");
    if (!process.env.RESEND_API_KEY) throw new ConvexError("El correo no esta configurado en Convex.");
    if (process.env.RESEND_TEST_MODE !== "false") {
      throw new ConvexError("Resend sigue en modo de prueba y no permite enviar a los asistentes.");
    }

    const ahora = Date.now();
    if (!Number.isFinite(args.programadoPara)) throw new ConvexError("La fecha de envío no es válida.");
    if (args.programadoPara < ahora - 60_000) throw new ConvexError("La hora de envío ya pasó.");
    if (args.programadoPara > ahora + UN_ANO_MS) {
      throw new ConvexError("El envío no puede programarse con más de un año de anticipación.");
    }
    const programadoPara = Math.max(ahora, Math.floor(args.programadoPara));

    let asunto: string;
    let texto: string;
    if (args.tipo === "recordatorio") {
      const detalles = detallesCompletos(evento);
      if (!detalles) {
        throw new ConvexError("Completa la fecha, la hora y la sede del evento antes de enviar el recordatorio.");
      }
      if (fechaEnCiudadDeMexico(programadoPara) !== detalles.fechaEvento) {
        throw new ConvexError("El recordatorio debe enviarse el mismo día del evento, en horario de Ciudad de México.");
      }
      asunto = asuntoRecordatorioEvento(evento.titulo);
      texto = textoRecordatorioEvento(detalles);
    } else if (args.tipo === "encuesta") {
      asunto = `Cuéntanos qué te pareció ${evento.titulo}`;
      texto = `Gracias por acompañarnos en ${evento.titulo}. Tu opinión nos ayuda a mejorar los próximos eventos de Alpha.`;
    } else {
      asunto = limpiarTexto(args.asunto ?? "", 180);
      texto = limpiarMultilinea(args.texto ?? "", MAX_TEXTO);
      if (!asunto) throw new ConvexError("Escribe el asunto del correo.");
      if (!texto) throw new ConvexError("Escribe el contenido del correo.");
    }

    const resultado = await destinatariosDeEvento(ctx, args.eventId);
    if (resultado.limiteExcedido) {
      throw new ConvexError(`Este envío supera el límite de ${MAX_DESTINATARIOS} destinatarios.`);
    }
    if (resultado.destinatarios.length === 0) {
      throw new ConvexError("No hay asistentes elegibles con correo autorizado.");
    }

    const id = await ctx.db.insert("eventMailJobs", {
      eventId: args.eventId,
      tipo: args.tipo,
      asunto,
      texto,
      estado: "programado",
      destinatariosEstimados: resultado.destinatarios.length,
      encolados: 0,
      fallidos: 0,
      programadoPara,
      clientRequestId,
      creadoPor: actor._id,
      autorCorreo: actor.email ?? "",
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    const programacionId =
      programadoPara <= ahora + 1_000
        ? await ctx.scheduler.runAfter(0, internal.correosEventos.ejecutar, { id })
        : await ctx.scheduler.runAt(programadoPara, internal.correosEventos.ejecutar, { id });
    await ctx.db.patch(id, { programacionId });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.correo.programado",
      entidad: "eventMailJobs",
      entidadId: id,
      detalle: `${evento.titulo}: ${resultado.destinatarios.length} destinatarios`,
    });
    return { id, destinatarios: resultado.destinatarios.length, programadoPara };
  },
});

export const cancelar = mutation({
  args: { id: v.id("eventMailJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const trabajo = await ctx.db.get(args.id);
    if (!trabajo) throw new ConvexError("Ese envío ya no existe.");
    if (trabajo.estado !== "programado") {
      throw new ConvexError("El envío ya comenzó y no se puede cancelar.");
    }
    if (trabajo.programacionId) {
      await ctx.scheduler.cancel(trabajo.programacionId as GenericId<"_scheduled_functions">);
    }
    await ctx.db.patch(args.id, { estado: "cancelado", actualizadoEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.correo.cancelado",
      entidad: "eventMailJobs",
      entidadId: args.id,
    });
    return null;
  },
});

export const prepararEjecucion = internalMutation({
  args: { id: v.id("eventMailJobs") },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("eventMailJobs"),
      tipo: tipoCorreoEventoValidador,
      asunto: v.string(),
      texto: v.string(),
      remitente: v.string(),
      eventId: v.id("events"),
      eventoTitulo: v.string(),
      destinatarios: v.array(destinatarioValidador),
    }),
  ),
  handler: async (ctx, args) => {
    const trabajo = await ctx.db.get(args.id);
    if (!trabajo || trabajo.estado !== "programado") return null;
    const evento = await ctx.db.get(trabajo.eventId);
    if (!evento) {
      await ctx.db.patch(args.id, {
        estado: "fallido",
        error: "El evento ya no existe.",
        actualizadoEn: Date.now(),
      });
      return null;
    }
    const resultado = await destinatariosDeEvento(ctx, trabajo.eventId);
    if (resultado.destinatarios.length === 0) {
      await ctx.db.patch(args.id, {
        estado: "fallido",
        error: "No había asistentes elegibles al llegar la hora de envío.",
        actualizadoEn: Date.now(),
      });
      return null;
    }
    if (resultado.limiteExcedido) {
      await ctx.db.patch(args.id, {
        estado: "fallido",
        error: `El envío superó el límite de ${MAX_DESTINATARIOS} destinatarios.`,
        actualizadoEn: Date.now(),
      });
      return null;
    }
    await ctx.db.patch(args.id, {
      estado: "procesando",
      destinatariosEstimados: resultado.destinatarios.length,
      actualizadoEn: Date.now(),
    });
    return {
      id: trabajo._id,
      tipo: trabajo.tipo,
      asunto: trabajo.asunto,
      texto: trabajo.texto,
      remitente: normalizarCorreo(process.env.ALPHA_AUTO_EMAIL ?? "auto@alphaccm.org"),
      eventId: trabajo.eventId,
      eventoTitulo: evento.titulo,
      destinatarios: resultado.destinatarios,
    };
  },
});

export const finalizarEjecucion = internalMutation({
  args: {
    id: v.id("eventMailJobs"),
    encolados: v.number(),
    fallidos: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trabajo = await ctx.db.get(args.id);
    if (!trabajo || trabajo.estado !== "procesando") return null;
    await ctx.db.patch(args.id, {
      estado: args.encolados > 0 ? "encolado" : "fallido",
      encolados: Math.max(0, Math.floor(args.encolados)),
      fallidos: Math.max(0, Math.floor(args.fallidos)),
      ...(args.error ? { error: limpiarTexto(args.error, 300) } : {}),
      actualizadoEn: Date.now(),
    });
    const actor = await ctx.db.get(trabajo.creadoPor);
    await registrarEnBitacora(ctx, {
      actor,
      accion: args.encolados > 0 ? "evento.correo.encolado" : "evento.correo.fallido",
      entidad: "eventMailJobs",
      entidadId: args.id,
      detalle: `${args.encolados} encolados, ${args.fallidos} fallidos`,
    });
    return null;
  },
});

export const ejecutar = internalAction({
  args: { id: v.id("eventMailJobs") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const trabajo = await ctx.runMutation(internal.correosEventos.prepararEjecucion, { id: args.id });
    if (!trabajo) return null;

    let encolados = 0;
    const errores: string[] = [];
    for (let inicio = 0; inicio < trabajo.destinatarios.length; inicio += 25) {
      const lote = trabajo.destinatarios.slice(inicio, inicio + 25);
      const resultados = await Promise.allSettled(
        lote.map(async (destinatario) => {
          if (trabajo.tipo === "encuesta") {
            const token = crypto.randomUUID().replaceAll("-", "");
            const invitacion = await ctx.runMutation(internal.encuestas.crearInvitacion, {
              eventId: trabajo.eventId,
              mailJobId: trabajo.id,
              token,
              eventoTitulo: trabajo.eventoTitulo,
              destinatarioCorreo: destinatario.correo,
              destinatarioNombre: destinatario.nombre,
            });
            if (invitacion.estado === "activa" || invitacion.estado === "respondida") return;
            if (invitacion.estado === "fallida") {
              throw new Error(`La invitación de ${destinatario.correo} ya había fallado.`);
            }
            const url = `https://alphaccm.org/encuesta/${encodeURIComponent(invitacion.token)}`;
            const correo = prepararCorreoEncuesta({
              eventoTitulo: trabajo.eventoTitulo,
              nombre: destinatario.nombre,
              url,
              remitente: trabajo.remitente,
            });
            try {
              const emailId = await resend.sendEmail(ctx, {
                from: `Alpha CCM <${trabajo.remitente}>`,
                to: destinatario.correo,
                subject: correo.asunto,
                text: textoConFirma(correo.texto, trabajo.remitente),
                html: correo.html,
                replyTo: [correoContacto()],
              });
              await ctx.runMutation(internal.encuestas.marcarActiva, {
                id: invitacion.id,
                emailId,
              });
              return;
            } catch (error) {
              await ctx.runMutation(internal.encuestas.marcarFallida, { id: invitacion.id });
              throw error;
            }
          }
          const texto =
            trabajo.tipo === "recordatorio"
              ? personalizarSaludo(trabajo.texto, destinatario.nombre)
              : trabajo.texto;
          return resend.sendEmail(ctx, {
            from: `Alpha CCM <${trabajo.remitente}>`,
            to: destinatario.correo,
            subject: trabajo.asunto,
            text: textoConFirma(texto, trabajo.remitente),
            html: renderizarCorreoDashboard({
              asunto: trabajo.asunto,
              texto,
              remitente: trabajo.remitente,
            }),
            replyTo: [correoContacto()],
          });
        }),
      );
      for (const resultado of resultados) {
        if (resultado.status === "fulfilled") {
          encolados += 1;
        } else {
          errores.push(resultado.reason instanceof Error ? resultado.reason.message : String(resultado.reason));
        }
      }
    }

    await ctx.runMutation(internal.correosEventos.finalizarEjecucion, {
      id: trabajo.id,
      encolados,
      fallidos: errores.length,
      ...(errores[0] ? { error: errores[0] } : {}),
    });
    return null;
  },
});
