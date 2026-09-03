import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { registrarEnBitacora } from "./lib/auditoria";
import { requiereRol } from "./lib/rbac";
import { limpiarMultilinea, limpiarTexto } from "./lib/texto";
import {
  estadoAsistenteValidador,
  estadoEventoValidador,
  pilarValidador,
} from "./lib/validadores";

const eventoValidador = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  slug: v.string(),
  titulo: v.string(),
  resumen: v.string(),
  pilar: v.union(v.literal("desarrollo"), v.literal("industria"), v.literal("comunidad")),
  estado: v.union(v.literal("borrador"), v.literal("publicado"), v.literal("cerrado")),
  registroAbierto: v.boolean(),
  totalRegistros: v.number(),
  confirmados: v.number(),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

const asistenteValidador = v.object({
  _id: v.id("eventRegistrations"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  nombre: v.string(),
  correo: v.string(),
  carrera: v.string(),
  semestre: v.string(),
  matricula: v.optional(v.string()),
  canales: v.object({ correo: v.boolean(), whatsapp: v.boolean() }),
  telefono: v.optional(v.string()),
  estado: estadoAsistenteValidador,
  notas: v.optional(v.string()),
  origen: v.string(),
  ipHash: v.string(),
  userAgent: v.string(),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

function slugDe(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "evento";
}

async function conConfirmados(ctx: QueryCtx, eventos: Doc<"events">[]) {
  const pares = await Promise.all(
    eventos.map(async (evento) => {
      const filas = await ctx.db
        .query("eventRegistrations")
        .withIndex("by_event_and_estado", (q) =>
          q.eq("eventId", evento._id).eq("estado", "confirmado"),
        )
        .take(5000);
      return [evento._id, filas.length] as const;
    }),
  );
  const mapa = new Map(pares);
  return eventos.map((evento) => ({ ...evento, confirmados: mapa.get(evento._id) ?? 0 }));
}

export const listar = query({
  args: {},
  returns: v.array(eventoValidador),
  handler: async (ctx) => {
    await requiereRol(ctx, "lector");
    const eventos = await ctx.db.query("events").take(100);
    return await conConfirmados(ctx, eventos);
  },
});

export const crear = mutation({
  args: {
    titulo: v.string(),
    resumen: v.string(),
    pilar: pilarValidador,
    slug: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    const resumen = limpiarMultilinea(args.resumen, 400);
    let slug = slugDe(limpiarTexto(args.slug ?? titulo, 60));
    const choque = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (choque) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const ahora = Date.now();
    const id = await ctx.db.insert("events", {
      slug,
      titulo,
      resumen,
      pilar: args.pilar,
      estado: "borrador",
      registroAbierto: false,
      totalRegistros: 0,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.creado",
      entidad: "events",
      entidadId: id,
      detalle: titulo,
    });
    return id;
  },
});

export const actualizar = mutation({
  args: {
    id: v.id("events"),
    titulo: v.string(),
    resumen: v.string(),
    pilar: pilarValidador,
    estado: estadoEventoValidador,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const previo = await ctx.db.get(args.id);
    if (previo === null) throw new Error("Ese evento ya no existe.");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    await ctx.db.patch(args.id, {
      titulo,
      resumen: limpiarMultilinea(args.resumen, 400),
      pilar: args.pilar,
      estado: args.estado,
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.actualizado",
      entidad: "events",
      entidadId: args.id,
      detalle: titulo,
    });
    return null;
  },
});

export const listarRegistros = query({
  args: {
    eventId: v.id("events"),
    busqueda: v.optional(v.string()),
    estado: v.optional(estadoAsistenteValidador),
  },
  returns: v.array(asistenteValidador),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    const filas = args.estado
      ? await ctx.db
          .query("eventRegistrations")
          .withIndex("by_event_and_estado", (q) =>
            q.eq("eventId", args.eventId).eq("estado", args.estado!),
          )
          .order("desc")
          .take(500)
      : await ctx.db
          .query("eventRegistrations")
          .withIndex("by_event_and_creado", (q) => q.eq("eventId", args.eventId))
          .order("desc")
          .take(500);

    const termino = limpiarTexto(args.busqueda ?? "", 80).toLowerCase();
    if (!termino) return filas;
    return filas.filter(
      (r) =>
        r.nombre.toLowerCase().includes(termino) ||
        r.correo.toLowerCase().includes(termino) ||
        r.carrera.toLowerCase().includes(termino) ||
        r.semestre.toLowerCase().includes(termino) ||
        (r.matricula?.toLowerCase().includes(termino) ?? false),
    );
  },
});

export const cambiarEstadoRegistro = mutation({
  args: { id: v.id("eventRegistrations"), estado: estadoAsistenteValidador },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const registro = await ctx.db.get(args.id);
    if (registro === null) throw new Error("Ese registro ya no existe.");
    if (registro.estado === args.estado) return null;
    await ctx.db.patch(args.id, { estado: args.estado, actualizadoEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.registro.estado",
      entidad: "eventRegistrations",
      entidadId: args.id,
      detalle: `${registro.estado} -> ${args.estado}`,
    });
    return null;
  },
});

export const guardarNotasRegistro = mutation({
  args: { id: v.id("eventRegistrations"), notas: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const registro = await ctx.db.get(args.id);
    if (registro === null) throw new Error("Ese registro ya no existe.");
    await ctx.db.patch(args.id, {
      notas: limpiarMultilinea(args.notas, 2000),
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.registro.notas",
      entidad: "eventRegistrations",
      entidadId: args.id,
    });
    return null;
  },
});

export const cambiarRegistroAbierto = mutation({
  args: { eventId: v.id("events"), abierto: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const evento = await ctx.db.get(args.eventId);
    if (evento === null) throw new Error("Ese evento ya no existe.");
    if (evento.registroAbierto === args.abierto) return null;
    await ctx.db.patch(args.eventId, {
      registroAbierto: args.abierto,
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: args.abierto ? "evento.registro.abierto" : "evento.registro.cerrado",
      entidad: "events",
      entidadId: args.eventId,
      detalle: evento.titulo,
    });
    return null;
  },
});

export const paraExportar = query({
  args: { eventId: v.id("events"), estado: v.optional(estadoAsistenteValidador) },
  returns: v.array(asistenteValidador),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "admin");
    if (args.estado) {
      return await ctx.db
        .query("eventRegistrations")
        .withIndex("by_event_and_estado", (q) =>
          q.eq("eventId", args.eventId).eq("estado", args.estado!),
        )
        .order("desc")
        .take(5000);
    }
    return await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_creado", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(5000);
  },
});

export const registrarExportacion = mutation({
  args: { eventId: v.id("events"), cantidad: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.registros.exportacion",
      entidad: "events",
      entidadId: args.eventId,
      detalle: `${Math.max(0, Math.floor(args.cantidad))} filas`,
    });
    return null;
  },
});
