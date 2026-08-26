import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requiereRol } from "./lib/rbac";
import { registrarEnBitacora } from "./lib/auditoria";
import { limpiarMultilinea, limpiarTexto } from "./lib/texto";
import {
  areaValidador,
  estadoRegistroValidador,
  tipoRegistroValidador,
} from "./lib/validadores";

/**
 * Los datos personales solo se leen con sesion y las escrituras exigen rol de
 * editor. La unica consulta publica devuelve los cupos por area, nunca registros.
 */

const LIMITE_PAGINA = 50;

export const areasCerradasPublicas = query({
  args: {},
  returns: v.array(areaValidador),
  handler: async (ctx) => {
    const configuracion = await ctx.db
      .query("registrationSettings")
      .withIndex("by_clave", (q) => q.eq("clave", "aliados"))
      .unique();
    return configuracion?.areasCerradas ?? [];
  },
});

export const cambiarCupoArea = mutation({
  args: { area: areaValidador, lleno: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const configuracion = await ctx.db
      .query("registrationSettings")
      .withIndex("by_clave", (q) => q.eq("clave", "aliados"))
      .unique();
    const actuales = configuracion?.areasCerradas ?? [];
    const yaEstaCerrada = actuales.includes(args.area);

    if (yaEstaCerrada === args.lleno) return null;

    const areasCerradas = args.lleno
      ? [...actuales, args.area]
      : actuales.filter((area) => area !== args.area);
    const actualizadoEn = Date.now();

    const configuracionId =
      configuracion === null
        ? await ctx.db.insert("registrationSettings", {
            clave: "aliados",
            areasCerradas,
            actualizadoEn,
          })
        : configuracion._id;
    if (configuracion !== null) {
      await ctx.db.patch(configuracion._id, { areasCerradas, actualizadoEn });
    }

    await registrarEnBitacora(ctx, {
      actor,
      accion: "registro.cupo_area",
      entidad: "registrationSettings",
      entidadId: configuracionId,
      detalle: `${args.area} -> ${args.lleno ? "cupo lleno" : "disponible"}`,
    });
    return null;
  },
});

export const listar = query({
  args: {
    busqueda: v.optional(v.string()),
    tipo: v.optional(tipoRegistroValidador),
    estado: v.optional(estadoRegistroValidador),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");

    // El indice se elige segun el filtro mas selectivo disponible.
    const base =
      args.estado !== undefined
        ? ctx.db.query("registrations").withIndex("by_estado", (q) => q.eq("estado", args.estado!))
        : args.tipo !== undefined
          ? ctx.db.query("registrations").withIndex("by_tipo", (q) => q.eq("tipo", args.tipo!))
          : ctx.db.query("registrations").withIndex("by_creado");

    const pagina = await base
      .order("desc")
      .paginate({ numItems: LIMITE_PAGINA, cursor: args.cursor ?? null });

    const termino = limpiarTexto(args.busqueda ?? "", 80).toLowerCase();
    let filtrados = pagina.page;

    // Los filtros que no dictaron el indice se aplican en memoria sobre la
    // pagina, que como maximo trae 50 documentos.
    if (args.estado !== undefined && args.tipo !== undefined) {
      filtrados = filtrados.filter((r) => r.tipo === args.tipo);
    }
    if (termino !== "") {
      filtrados = filtrados.filter(
        (r) =>
          r.nombre.toLowerCase().includes(termino) ||
          r.correo.toLowerCase().includes(termino) ||
          r.carrera.toLowerCase().includes(termino) ||
          (r.semestre?.toLowerCase().includes(termino) ?? false),
      );
    }

    return { ...pagina, page: filtrados };
  },
});

export const obtener = query({
  args: { id: v.id("registrations") },
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    return await ctx.db.get(args.id);
  },
});

export const cambiarEstado = mutation({
  args: { id: v.id("registrations"), estado: estadoRegistroValidador },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const registro = await ctx.db.get(args.id);
    if (registro === null) throw new Error("Ese registro ya no existe.");

    await ctx.db.patch(args.id, { estado: args.estado, actualizadoEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "registro.estado",
      entidad: "registrations",
      entidadId: args.id,
      detalle: `${registro.estado} -> ${args.estado}`,
    });
    return null;
  },
});

export const cambiarTipo = mutation({
  args: { id: v.id("registrations"), tipo: tipoRegistroValidador },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const registro = await ctx.db.get(args.id);
    if (registro === null) throw new Error("Ese registro ya no existe.");
    if (registro.tipo === args.tipo) return null;

    await ctx.db.patch(args.id, { tipo: args.tipo, actualizadoEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "registro.tipo",
      entidad: "registrations",
      entidadId: args.id,
      detalle: `${registro.tipo} -> ${args.tipo}`,
    });
    return null;
  },
});

export const guardarNotas = mutation({
  args: { id: v.id("registrations"), notas: v.string() },
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
      accion: "registro.notas",
      entidad: "registrations",
      entidadId: args.id,
    });
    return null;
  },
});

/**
 * Datos para exportar. Solo admin: es la operacion que saca de la aplicacion
 * la lista completa de correos y telefonos.
 */
export const paraExportar = query({
  args: {
    tipo: v.optional(tipoRegistroValidador),
    estado: v.optional(estadoRegistroValidador),
  },
  handler: async (ctx, args) => {
    await requiereRol(ctx, "admin");

    const todos = await ctx.db.query("registrations").withIndex("by_creado").order("desc").take(5000);
    return todos.filter(
      (r) =>
        (args.tipo === undefined || r.tipo === args.tipo) &&
        (args.estado === undefined || r.estado === args.estado),
    );
  },
});

export const registrarExportacion = mutation({
  args: { cantidad: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    await registrarEnBitacora(ctx, {
      actor,
      accion: "registro.exportacion",
      entidad: "registrations",
      detalle: `${Math.max(0, Math.floor(args.cantidad))} filas`,
    });
    return null;
  },
});
