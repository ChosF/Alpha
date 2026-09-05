import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requiereRol } from "./lib/rbac";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo } from "./lib/texto";

const MAX_COMENTARIOS = 2_000;
const TOKEN_VALIDO = /^[a-zA-Z0-9_-]{24,100}$/;

const estadoPublicoValidador = v.union(
  v.literal("disponible"),
  v.literal("respondida"),
  v.literal("invalida"),
);

const opinionContenidoValidador = v.union(
  v.literal("excelente"),
  v.literal("bueno"),
  v.literal("regular"),
  v.literal("malo"),
);

const origenValidador = v.union(
  v.literal("instagram"),
  v.literal("whatsapp"),
  v.literal("correo"),
);

function tokenLimpio(token: string): string {
  const limpio = token.trim();
  return TOKEN_VALIDO.test(limpio) ? limpio : "";
}

async function insertarInvitacion(
  ctx: MutationCtx,
  datos: {
    eventId?: Id<"events">;
    mailJobId?: Id<"eventMailJobs">;
    token: string;
    eventoTitulo: string;
    destinatarioCorreo: string;
    destinatarioNombre: string;
    esPrueba: boolean;
  },
) {
  const ahora = Date.now();
  return await ctx.db.insert("eventSurveyInvitations", {
    ...(datos.eventId ? { eventId: datos.eventId } : {}),
    ...(datos.mailJobId ? { mailJobId: datos.mailJobId } : {}),
    token: datos.token,
    eventoTitulo: limpiarTexto(datos.eventoTitulo, 120),
    destinatarioCorreo: normalizarCorreo(datos.destinatarioCorreo),
    destinatarioNombre: limpiarTexto(datos.destinatarioNombre, 120),
    estado: "preparando",
    esPrueba: datos.esPrueba,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });
}

export const crearInvitacion = internalMutation({
  args: {
    eventId: v.id("events"),
    mailJobId: v.id("eventMailJobs"),
    token: v.string(),
    eventoTitulo: v.string(),
    destinatarioCorreo: v.string(),
    destinatarioNombre: v.string(),
  },
  returns: v.object({
    id: v.id("eventSurveyInvitations"),
    token: v.string(),
    estado: v.union(
      v.literal("preparando"),
      v.literal("activa"),
      v.literal("respondida"),
      v.literal("fallida"),
    ),
  }),
  handler: async (ctx, args) => {
    const token = tokenLimpio(args.token);
    if (!token) throw new ConvexError("Identificador de encuesta no válido.");
    const correo = normalizarCorreo(args.destinatarioCorreo);
    const existente = await ctx.db
      .query("eventSurveyInvitations")
      .withIndex("by_job_and_correo", (q) =>
        q.eq("mailJobId", args.mailJobId).eq("destinatarioCorreo", correo),
      )
      .unique();
    if (existente) return { id: existente._id, token: existente.token, estado: existente.estado };

    const porToken = await ctx.db
      .query("eventSurveyInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (porToken) throw new ConvexError("Identificador de encuesta duplicado.");

    const id = await insertarInvitacion(ctx, {
      eventId: args.eventId,
      mailJobId: args.mailJobId,
      token,
      eventoTitulo: args.eventoTitulo,
      destinatarioCorreo: correo,
      destinatarioNombre: args.destinatarioNombre,
      esPrueba: false,
    });
    return { id, token, estado: "preparando" as const };
  },
});

/** Solo la utiliza una acción temporal durante la prueba real de producción. */
export const crearInvitacionPrueba = internalMutation({
  args: {
    token: v.string(),
    eventoTitulo: v.string(),
    destinatarioCorreo: v.string(),
    destinatarioNombre: v.string(),
  },
  returns: v.id("eventSurveyInvitations"),
  handler: async (ctx, args) => {
    const token = tokenLimpio(args.token);
    if (!token) throw new ConvexError("Identificador de encuesta no válido.");
    return await insertarInvitacion(ctx, {
      token,
      eventoTitulo: args.eventoTitulo,
      destinatarioCorreo: args.destinatarioCorreo,
      destinatarioNombre: args.destinatarioNombre,
      esPrueba: true,
    });
  },
});

export const marcarActiva = internalMutation({
  args: { id: v.id("eventSurveyInvitations"), emailId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitacion = await ctx.db.get(args.id);
    if (!invitacion || invitacion.estado !== "preparando") return null;
    const ahora = Date.now();
    await ctx.db.patch(args.id, {
      estado: "activa",
      emailId: limpiarTexto(args.emailId, 160),
      enviadoEn: ahora,
      actualizadoEn: ahora,
    });
    return null;
  },
});

export const marcarFallida = internalMutation({
  args: { id: v.id("eventSurveyInvitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitacion = await ctx.db.get(args.id);
    if (!invitacion || invitacion.estado !== "preparando") return null;
    await ctx.db.patch(args.id, { estado: "fallida", actualizadoEn: Date.now() });
    return null;
  },
});

export const obtener = query({
  args: { token: v.string() },
  returns: v.object({
    estado: estadoPublicoValidador,
    eventoTitulo: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const token = tokenLimpio(args.token);
    if (!token) return { estado: "invalida" as const };
    const invitacion = await ctx.db
      .query("eventSurveyInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invitacion) return { estado: "invalida" as const };
    if (invitacion.estado === "respondida") {
      return { estado: "respondida" as const, eventoTitulo: invitacion.eventoTitulo };
    }
    if (invitacion.estado !== "activa") {
      return { estado: "invalida" as const };
    }
    return { estado: "disponible" as const, eventoTitulo: invitacion.eventoTitulo };
  },
});

export const responder = mutation({
  args: {
    token: v.string(),
    calificacionEvento: v.number(),
    opinionContenido: opinionContenidoValidador,
    origen: origenValidador,
    comentarios: v.optional(v.string()),
  },
  returns: v.object({ estado: v.union(v.literal("enviada"), v.literal("respondida")) }),
  handler: async (ctx, args) => {
    const token = tokenLimpio(args.token);
    if (!token) throw new ConvexError("Esta encuesta no está disponible.");
    const invitacion = await ctx.db
      .query("eventSurveyInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invitacion) throw new ConvexError("Esta encuesta no está disponible.");
    if (invitacion.estado === "respondida") return { estado: "respondida" as const };
    if (invitacion.estado !== "activa") {
      throw new ConvexError("Esta encuesta todavía no está disponible.");
    }
    if (!Number.isInteger(args.calificacionEvento) || args.calificacionEvento < 1 || args.calificacionEvento > 5) {
      throw new ConvexError("Selecciona una calificación de 1 a 5 estrellas.");
    }

    const ahora = Date.now();
    const comentarios = limpiarMultilinea(args.comentarios ?? "", MAX_COMENTARIOS);
    await ctx.db.patch(invitacion._id, {
      estado: "respondida",
      calificacionEvento: args.calificacionEvento,
      opinionContenido: args.opinionContenido,
      origen: args.origen,
      ...(comentarios ? { comentarios } : {}),
      respondidoEn: ahora,
      actualizadoEn: ahora,
    });
    return { estado: "enviada" as const };
  },
});

const desgloseValidador = v.object({ clave: v.string(), cantidad: v.number() });

export const analytics = query({
  args: {},
  returns: v.array(
    v.object({
      eventId: v.id("events"),
      titulo: v.string(),
      campanas: v.number(),
      enviadas: v.number(),
      respuestas: v.number(),
      tasaRespuesta: v.number(),
      promedio: v.optional(v.number()),
      ultimoEnvioEn: v.optional(v.number()),
      calificaciones: v.array(desgloseValidador),
      contenido: v.array(desgloseValidador),
      origen: v.array(desgloseValidador),
      comentarios: v.array(
        v.object({
          texto: v.string(),
          calificacionEvento: v.number(),
          respondidoEn: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requiereRol(ctx, "lector");
    const eventos = await ctx.db.query("events").order("desc").take(200);
    const resultados = await Promise.all(
      eventos.map(async (evento) => {
        const invitaciones = await ctx.db
          .query("eventSurveyInvitations")
          .withIndex("by_event_and_created", (q) => q.eq("eventId", evento._id))
          .collect();
        if (invitaciones.length === 0) return null;

        const enviadas = invitaciones.filter(
          (invitacion) => invitacion.estado === "activa" || invitacion.estado === "respondida",
        );
        const respuestas = enviadas.filter((invitacion) => invitacion.estado === "respondida");
        const suma = respuestas.reduce(
          (total, invitacion) => total + (invitacion.calificacionEvento ?? 0),
          0,
        );
        const campanas = new Set(
          invitaciones.flatMap((invitacion) => (invitacion.mailJobId ? [invitacion.mailJobId] : [])),
        ).size;
        const ultimoEnvioEn = enviadas.reduce(
          (ultimo, invitacion) => Math.max(ultimo, invitacion.enviadoEn ?? 0),
          0,
        );
        const contar = (
          claves: readonly string[],
          campo: "opinionContenido" | "origen",
        ) =>
          claves.map((clave) => ({
            clave,
            cantidad: respuestas.filter((item) => item[campo] === clave).length,
          }));

        return {
          eventId: evento._id,
          titulo: evento.titulo,
          campanas,
          enviadas: enviadas.length,
          respuestas: respuestas.length,
          tasaRespuesta: enviadas.length ? Math.round((respuestas.length / enviadas.length) * 1_000) / 10 : 0,
          ...(respuestas.length ? { promedio: Math.round((suma / respuestas.length) * 10) / 10 } : {}),
          ...(ultimoEnvioEn ? { ultimoEnvioEn } : {}),
          calificaciones: [1, 2, 3, 4, 5].map((clave) => ({
            clave: String(clave),
            cantidad: respuestas.filter((item) => item.calificacionEvento === clave).length,
          })),
          contenido: contar(["excelente", "bueno", "regular", "malo"], "opinionContenido"),
          origen: contar(["instagram", "whatsapp", "correo"], "origen"),
          comentarios: respuestas
            .filter(
              (item): item is typeof item & { comentarios: string; calificacionEvento: number; respondidoEn: number } =>
                Boolean(item.comentarios && item.calificacionEvento && item.respondidoEn),
            )
            .sort((a, b) => b.respondidoEn - a.respondidoEn)
            .slice(0, 50)
            .map((item) => ({
              texto: item.comentarios,
              calificacionEvento: item.calificacionEvento,
              respondidoEn: item.respondidoEn,
            })),
        };
      }),
    );
    return resultados.filter((resultado): resultado is NonNullable<typeof resultado> => resultado !== null);
  },
});
