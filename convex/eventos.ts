import { ConvexError, v, type GenericId } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { registrarEnBitacora } from "./lib/auditoria";
import { requiereRol } from "./lib/rbac";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo } from "./lib/texto";
import {
  estadoAsistenteValidador,
  estadoEventoValidador,
  estadoProgramaValidador,
  pilarValidador,
} from "./lib/validadores";
import { esFechaEventoValida, esHoraEventoValida } from "../lib/correo-evento";

const eventoValidador = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  slug: v.string(),
  titulo: v.string(),
  resumen: v.string(),
  fechaEvento: v.optional(v.string()),
  horaInicio: v.optional(v.string()),
  horaFin: v.optional(v.string()),
  sede: v.optional(v.string()),
  pilar: v.union(v.literal("desarrollo"), v.literal("industria"), v.literal("comunidad")),
  estado: v.union(v.literal("borrador"), v.literal("publicado"), v.literal("cerrado")),
  registroAbierto: v.boolean(),
  totalRegistros: v.number(),
  periodoPrograma: v.optional(v.string()),
  estadoPrograma: v.optional(estadoProgramaValidador),
  ordenPrograma: v.optional(v.number()),
  publicadoEnLanding: v.optional(v.boolean()),
  responsablePrograma: v.optional(v.string()),
  notasPrograma: v.optional(v.string()),
  rutaPublica: v.optional(v.string()),
  confirmados: v.number(),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

const programaPublicoValidador = v.object({
  slug: v.string(),
  titulo: v.string(),
  periodo: v.string(),
  pilar: pilarValidador,
  estado: estadoProgramaValidador,
  orden: v.number(),
  rutaPublica: v.optional(v.string()),
});

const eventoDestacadoValidador = v.object({
  slug: v.string(),
  titulo: v.string(),
  fechaEvento: v.string(),
  horaInicio: v.optional(v.string()),
  horaFin: v.optional(v.string()),
  sede: v.optional(v.string()),
  rutaPublica: v.string(),
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
    const ordenados = [...eventos].sort((a, b) => {
      const ordenA = a.ordenPrograma ?? Number.MAX_SAFE_INTEGER;
      const ordenB = b.ordenPrograma ?? Number.MAX_SAFE_INTEGER;
      return ordenA - ordenB || b.actualizadoEn - a.actualizadoEn;
    });
    return await conConfirmados(ctx, ordenados);
  },
});

/**
 * Proyeccion publica de la landing. El programa y los avisos de eventos salen
 * de las mismas filas que administran registros, asistencia y correos.
 */
export const publicosLanding = query({
  args: {},
  returns: v.object({
    programas: v.array(programaPublicoValidador),
    destacados: v.array(eventoDestacadoValidador),
  }),
  handler: async (ctx) => {
    const programas = await ctx.db
      .query("events")
      .withIndex("by_landing_order", (q) => q.eq("publicadoEnLanding", true))
      .take(100);

    const destacados = programas
      .filter(
        (evento) =>
          evento.estado === "publicado" &&
          evento.registroAbierto &&
          evento.fechaEvento !== undefined &&
          evento.rutaPublica !== undefined,
      )
      .sort((a, b) => a.fechaEvento!.localeCompare(b.fechaEvento!))
      .map((evento) => ({
        slug: evento.slug,
        titulo: evento.titulo,
        fechaEvento: evento.fechaEvento!,
        horaInicio: evento.horaInicio,
        horaFin: evento.horaFin,
        sede: evento.sede,
        rutaPublica: evento.rutaPublica!,
      }));

    return {
      programas: programas
        .filter(
          (evento) =>
            evento.periodoPrograma !== undefined &&
            evento.estadoPrograma !== undefined &&
            evento.ordenPrograma !== undefined,
        )
        .map((evento) => ({
          slug: evento.slug,
          titulo: evento.titulo,
          periodo: evento.periodoPrograma!,
          pilar: evento.pilar,
          estado: evento.estadoPrograma!,
          orden: evento.ordenPrograma!,
          rutaPublica: evento.rutaPublica,
        })),
      destacados,
    };
  },
});

export const crear = mutation({
  args: {
    titulo: v.string(),
    resumen: v.string(),
    pilar: pilarValidador,
    slug: v.optional(v.string()),
    fechaEvento: v.optional(v.string()),
    horaInicio: v.optional(v.string()),
    horaFin: v.optional(v.string()),
    sede: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    const resumen = limpiarMultilinea(args.resumen, 400);
    const detalles = limpiarDetallesEvento(args);
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
      ...detalles,
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
    fechaEvento: v.optional(v.string()),
    horaInicio: v.optional(v.string()),
    horaFin: v.optional(v.string()),
    sede: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const previo = await ctx.db.get(args.id);
    if (previo === null) throw new Error("Ese evento ya no existe.");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    const detalles = limpiarDetallesEvento(args);
    await ctx.db.patch(args.id, {
      titulo,
      resumen: limpiarMultilinea(args.resumen, 400),
      fechaEvento: detalles.fechaEvento,
      horaInicio: detalles.horaInicio,
      horaFin: detalles.horaFin,
      sede: detalles.sede,
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

export const eliminar = mutation({
  args: { id: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const evento = await ctx.db.get(args.id);
    if (evento === null) throw new ConvexError("Ese evento ya no existe.");

    const registros = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_creado", (q) => q.eq("eventId", args.id))
      .take(5000);
    for (const reg of registros) {
      await ctx.db.delete(reg._id);
    }

    const trabajosCorreo = await ctx.db
      .query("eventMailJobs")
      .withIndex("by_event_and_time", (q) => q.eq("eventId", args.id))
      .take(5000);
    for (const trabajo of trabajosCorreo) {
      if (trabajo.estado === "programado" && trabajo.programacionId) {
        try {
          await ctx.scheduler.cancel(
            trabajo.programacionId as GenericId<"_scheduled_functions">,
          );
        } catch {
          // Ignorar si el trabajo programado ya finalizó o fue cancelado
        }
      }
      await ctx.db.delete(trabajo._id);
    }

    await ctx.db.delete(args.id);

    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.eliminado",
      entidad: "events",
      entidadId: args.id,
      detalle: evento.titulo,
    });

    return null;
  },
});

export const crearDesdePrograma = mutation({
  args: {
    titulo: v.string(),
    periodo: v.string(),
    pilar: pilarValidador,
    estado: estadoProgramaValidador,
    responsable: v.optional(v.string()),
    notas: v.optional(v.string()),
    publicado: v.boolean(),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    const eventos = await ctx.db.query("events").take(100);
    let slug = slugDe(titulo);
    if (eventos.some((evento) => evento.slug === slug)) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }
    const ordenPrograma =
      eventos.reduce((maximo, evento) => Math.max(maximo, evento.ordenPrograma ?? 0), 0) + 1;
    const ahora = Date.now();
    const id = await ctx.db.insert("events", {
      slug,
      titulo,
      resumen: "",
      pilar: args.pilar,
      estado: "borrador",
      registroAbierto: false,
      totalRegistros: 0,
      periodoPrograma: limpiarTexto(args.periodo, 40),
      estadoPrograma: args.estado,
      ordenPrograma,
      publicadoEnLanding: args.publicado,
      ...(args.responsable
        ? { responsablePrograma: limpiarTexto(args.responsable, 60) }
        : {}),
      ...(args.notas ? { notasPrograma: limpiarMultilinea(args.notas, 1000) } : {}),
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.programa.creado",
      entidad: "events",
      entidadId: id,
      detalle: titulo,
    });
    return id;
  },
});

export const actualizarPrograma = mutation({
  args: {
    id: v.id("events"),
    titulo: v.string(),
    periodo: v.string(),
    pilar: pilarValidador,
    estado: estadoProgramaValidador,
    responsable: v.optional(v.string()),
    notas: v.optional(v.string()),
    publicado: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const previo = await ctx.db.get(args.id);
    if (previo === null) throw new Error("Ese evento ya no existe.");
    const titulo = limpiarTexto(args.titulo, 120);
    if (titulo.length < 3) throw new Error("El titulo necesita al menos 3 caracteres.");
    const ordenPrograma =
      previo.ordenPrograma ??
      (await ctx.db
        .query("events")
        .take(100))
        .reduce((maximo, evento) => Math.max(maximo, evento.ordenPrograma ?? 0), 0) +
        1;
    await ctx.db.patch(args.id, {
      titulo,
      pilar: args.pilar,
      periodoPrograma: limpiarTexto(args.periodo, 40),
      estadoPrograma: args.estado,
      ordenPrograma,
      publicadoEnLanding: args.publicado,
      responsablePrograma: args.responsable
        ? limpiarTexto(args.responsable, 60)
        : undefined,
      notasPrograma: args.notas ? limpiarMultilinea(args.notas, 1000) : undefined,
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.programa.actualizado",
      entidad: "events",
      entidadId: args.id,
      detalle: titulo,
    });
    return null;
  },
});

export const quitarDelPrograma = mutation({
  args: { id: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    const evento = await ctx.db.get(args.id);
    if (evento === null || evento.estadoPrograma === undefined) return null;
    await ctx.db.patch(args.id, {
      periodoPrograma: undefined,
      estadoPrograma: undefined,
      ordenPrograma: undefined,
      publicadoEnLanding: false,
      responsablePrograma: undefined,
      notasPrograma: undefined,
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.programa.retirado",
      entidad: "events",
      entidadId: args.id,
      detalle: evento.titulo,
    });
    return null;
  },
});

function limpiarDetallesEvento(args: {
  fechaEvento?: string;
  horaInicio?: string;
  horaFin?: string;
  sede?: string;
}) {
  const fechaEvento = limpiarTexto(args.fechaEvento ?? "", 10);
  const horaInicio = limpiarTexto(args.horaInicio ?? "", 5);
  const horaFin = limpiarTexto(args.horaFin ?? "", 5);
  const sede = limpiarTexto(args.sede ?? "", 160);
  const hayDetalle = Boolean(fechaEvento || horaInicio || horaFin || sede);
  if (!hayDetalle) {
    return {
      fechaEvento: undefined,
      horaInicio: undefined,
      horaFin: undefined,
      sede: undefined,
    };
  }
  if (!esFechaEventoValida(fechaEvento)) throw new Error("Escribe una fecha válida para el evento.");
  if (!esHoraEventoValida(horaInicio)) throw new Error("Escribe una hora de inicio válida.");
  if (horaFin && !esHoraEventoValida(horaFin)) throw new Error("Escribe una hora de cierre válida.");
  if (!sede) throw new Error("Escribe la sede del evento.");
  return {
    fechaEvento,
    horaInicio,
    ...(horaFin ? { horaFin } : { horaFin: undefined }),
    sede,
  };
}

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

export const registrarAsistenteEnPuerta = mutation({
  args: {
    eventId: v.id("events"),
    nombre: v.string(),
    matricula: v.string(),
    correo: v.string(),
    semestre: v.string(),
    carrera: v.string(),
  },
  returns: v.object({
    id: v.id("eventRegistrations"),
    creado: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const evento = await ctx.db.get(args.eventId);
    if (evento === null) throw new Error("Ese evento ya no existe.");

    const nombre = limpiarTexto(args.nombre, 80);
    const matricula = limpiarTexto(args.matricula, 12).toUpperCase();
    const correo = normalizarCorreo(args.correo).slice(0, 254);
    const semestre = limpiarTexto(args.semestre, 30);
    const carrera = limpiarTexto(args.carrera, 80);
    const ahora = Date.now();

    if (correo) {
      const existente = await ctx.db
        .query("eventRegistrations")
        .withIndex("by_event_and_correo", (q) =>
          q.eq("eventId", args.eventId).eq("correo", correo),
        )
        .unique();
      if (existente !== null) {
        if (existente.estado !== "asistio") {
          await ctx.db.patch(existente._id, { estado: "asistio", actualizadoEn: ahora });
          await registrarEnBitacora(ctx, {
            actor,
            accion: "evento.registro.asistencia_puerta",
            entidad: "eventRegistrations",
            entidadId: existente._id,
            detalle: "Registro existente",
          });
        }
        return { id: existente._id, creado: false };
      }
    }

    const id = await ctx.db.insert("eventRegistrations", {
      eventId: args.eventId,
      nombre,
      correo,
      carrera,
      semestre,
      ...(matricula ? { matricula } : {}),
      canales: { correo: false, whatsapp: false },
      estado: "asistio",
      origen: "panel:asistencia",
      ipHash: "no-aplica",
      userAgent: "panel-interno",
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await ctx.db.patch(args.eventId, {
      totalRegistros: evento.totalRegistros + 1,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.registro.creado_en_puerta",
      entidad: "eventRegistrations",
      entidadId: id,
      detalle: nombre || correo || matricula || "Sin datos",
    });
    return { id, creado: true };
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
