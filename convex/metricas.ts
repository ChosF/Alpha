import { v } from "convex/values";
import { query } from "./_generated/server";
import { puede, requiereRol } from "./lib/rbac";
import { AREAS, ESTADOS_REGISTRO } from "./lib/validadores";

/**
 * Resumen para la pantalla de inicio del panel.
 *
 * Se calcula sobre los ultimos 5000 registros. Con el volumen esperado de una
 * sociedad estudiantil eso es la tabla entera; si algun dia deja de serlo, hay
 * que pasar a contadores incrementales en vez de recorrer.
 */

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export const resumen = query({
  args: {},
  handler: async (ctx) => {
    await requiereRol(ctx, "lector");

    const registros = await ctx.db
      .query("registrations")
      .withIndex("by_creado")
      .order("desc")
      .take(5000);

    const ahora = Date.now();

    const porEstado: Record<string, number> = {};
    for (const e of ESTADOS_REGISTRO) porEstado[e] = 0;

    const porArea: Record<string, number> = {};
    for (const a of AREAS) porArea[a] = 0;

    let miembros = 0;
    let aliados = 0;
    let conCorreo = 0;
    let conWhatsapp = 0;

    // Ocho semanas hacia atras, de la mas vieja a la mas reciente.
    const semanas = Array.from({ length: 8 }, (_, i) => ({
      inicio: ahora - (8 - i) * SEMANA_MS,
      fin: ahora - (7 - i) * SEMANA_MS,
      total: 0,
    }));

    for (const r of registros) {
      if (r.tipo === "miembro") miembros += 1;
      else aliados += 1;

      porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
      if (r.canales.correo) conCorreo += 1;
      if (r.canales.whatsapp) conWhatsapp += 1;
      for (const area of r.areas) porArea[area] = (porArea[area] ?? 0) + 1;

      for (const semana of semanas) {
        if (r.creadoEn >= semana.inicio && r.creadoEn < semana.fin) {
          semana.total += 1;
          break;
        }
      }
    }

    return {
      total: registros.length,
      miembros,
      aliados,
      conCorreo,
      conWhatsapp,
      nuevosEstaSemana: semanas[semanas.length - 1]?.total ?? 0,
      porEstado,
      porArea,
      porSemana: semanas.map((s) => ({ inicio: s.inicio, total: s.total })),
    };
  },
});

/**
 * Contadores que la barra de navegacion muestra junto a cada seccion. Una
 * sola consulta para todo el armazon; los que el rol no puede ver van en null.
 */
export const contadores = query({
  args: {},
  returns: v.object({
    eventos: v.number(),
    registrosNuevos: v.number(),
    correoNoLeido: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const usuario = await requiereRol(ctx, "lector");

    const [eventos, nuevos] = await Promise.all([
      ctx.db.query("events").take(100),
      ctx.db
        .query("registrations")
        .withIndex("by_estado", (q) => q.eq("estado", "nuevo"))
        .take(1000),
    ]);

    let correoNoLeido: number | null = null;
    if (puede(usuario, "editor")) {
      const abiertos = await ctx.db
        .query("mailThreads")
        .withIndex("by_estado_ultimo", (q) => q.eq("estado", "abierto"))
        .take(2000);
      correoNoLeido = abiertos.reduce((total, hilo) => total + hilo.noLeidos, 0);
    }

    return { eventos: eventos.length, registrosNuevos: nuevos.length, correoNoLeido };
  },
});

/**
 * Inicio. Los eventos son el centro del panel; la convocatoria, el correo y
 * las invitaciones aparecen solo como pendientes que piden una decision.
 */
export const inicio = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await requiereRol(ctx, "lector");
    const ahora = Date.now();
    const esEditor = puede(usuario, "editor");
    const esAdmin = puede(usuario, "admin");

    const [eventos, programas, nuevos, actividad] = await Promise.all([
      ctx.db.query("events").take(100),
      ctx.db.query("programs").withIndex("by_orden").collect(),
      ctx.db
        .query("registrations")
        .withIndex("by_estado", (q) => q.eq("estado", "nuevo"))
        .take(1000),
      ctx.db.query("auditLog").withIndex("by_creado").order("desc").take(8),
    ]);

    // Confirmados por evento: una lectura indexada por evento, acotada.
    const confirmadosPorEvento = await Promise.all(
      eventos.map(async (e) => {
        const filas = await ctx.db
          .query("eventRegistrations")
          .withIndex("by_event_and_estado", (q) => q.eq("eventId", e._id).eq("estado", "confirmado"))
          .take(5000);
        return [e._id, filas.length] as const;
      }),
    );
    const confirmados = new Map(confirmadosPorEvento);

    let correo: { abiertos: number; noLeidos: number } | null = null;
    if (esEditor) {
      const abiertos = await ctx.db
        .query("mailThreads")
        .withIndex("by_estado_ultimo", (q) => q.eq("estado", "abierto"))
        .take(2000);
      correo = {
        abiertos: abiertos.length,
        noLeidos: abiertos.reduce((total, hilo) => total + hilo.noLeidos, 0),
      };
    }

    let invitacionesPorVencer: number | null = null;
    if (esAdmin) {
      const invitaciones = await ctx.db.query("invites").collect();
      const tresDias = 3 * 24 * 60 * 60 * 1000;
      invitacionesPorVencer = invitaciones.filter(
        (i) =>
          i.usadaEn === undefined &&
          i.revocadaEn === undefined &&
          i.expiraEn > ahora &&
          i.expiraEn - ahora < tresDias,
      ).length;
    }

    const ordenados = [...eventos].sort((a, b) => {
      const peso = (e: typeof a) =>
        e.estado === "publicado" && e.registroAbierto ? 0 : e.estado === "publicado" ? 1 : e.estado === "borrador" ? 2 : 3;
      return peso(a) - peso(b) || b.actualizadoEn - a.actualizadoEn;
    });

    return {
      eventos: ordenados.map((e) => ({
        _id: e._id,
        slug: e.slug,
        titulo: e.titulo,
        resumen: e.resumen,
        pilar: e.pilar,
        estado: e.estado,
        registroAbierto: e.registroAbierto,
        totalRegistros: e.totalRegistros,
        confirmados: confirmados.get(e._id) ?? 0,
        actualizadoEn: e.actualizadoEn,
      })),
      resumen: {
        eventosActivos: eventos.filter((e) => e.estado === "publicado" && e.registroAbierto).length,
        eventosBorrador: eventos.filter((e) => e.estado === "borrador").length,
        asistentes: eventos.reduce((total, e) => total + e.totalRegistros, 0),
        programasPublicados: programas.filter((p) => p.publicado).length,
        programasTotal: programas.length,
      },
      programa: programas
        .sort((a, b) => a.orden - b.orden)
        .slice(0, 6)
        .map((p) => ({
          _id: p._id,
          titulo: p.titulo,
          periodo: p.periodo,
          pilar: p.pilar,
          estado: p.estado,
          publicado: p.publicado,
        })),
      registrosNuevos: nuevos.length,
      correo,
      invitacionesPorVencer,
      actividad: actividad.map((a) => ({
        _id: a._id,
        actorCorreo: a.actorCorreo,
        accion: a.accion,
        detalle: a.detalle,
        creadoEn: a.creadoEn,
      })),
    };
  },
});

export const actividad = query({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    const limite = Math.min(Math.max(args.limite ?? 20, 1), 100);
    return await ctx.db.query("auditLog").withIndex("by_creado").order("desc").take(limite);
  },
});
