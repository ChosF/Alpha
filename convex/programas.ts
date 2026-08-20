import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requiereRol } from "./lib/rbac";
import { registrarEnBitacora } from "./lib/auditoria";
import { limpiarMultilinea, limpiarTexto } from "./lib/texto";
import { estadoProgramaValidador, pilarValidador } from "./lib/validadores";

/**
 * Programa de trabajo. `publicos` es la unica query sin sesion de todo el
 * proyecto, y por eso devuelve nada mas los campos que la landing muestra:
 * ni notas internas ni responsable salen de aqui.
 */

export const publicos = query({
  args: {},
  handler: async (ctx) => {
    const filas = await ctx.db
      .query("programs")
      .withIndex("by_publicado", (q) => q.eq("publicado", true))
      .collect();

    return filas
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({
        titulo: p.titulo,
        periodo: p.periodo,
        pilar: p.pilar,
        estado: p.estado,
        orden: p.orden,
      }));
  },
});

export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requiereRol(ctx, "lector");
    const filas = await ctx.db.query("programs").withIndex("by_orden").collect();
    return filas.sort((a, b) => a.orden - b.orden);
  },
});

export const crear = mutation({
  args: {
    titulo: v.string(),
    periodo: v.string(),
    pilar: pilarValidador,
    estado: estadoProgramaValidador,
    responsable: v.optional(v.string()),
    notas: v.optional(v.string()),
    publicado: v.boolean(),
  },
  returns: v.id("programs"),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const existentes = await ctx.db.query("programs").withIndex("by_orden").collect();
    const ahora = Date.now();

    const id = await ctx.db.insert("programs", {
      titulo: limpiarTexto(args.titulo, 120),
      periodo: limpiarTexto(args.periodo, 40),
      pilar: args.pilar,
      estado: args.estado,
      ...(args.responsable ? { responsable: limpiarTexto(args.responsable, 60) } : {}),
      ...(args.notas ? { notas: limpiarMultilinea(args.notas, 1000) } : {}),
      orden: existentes.length + 1,
      publicado: args.publicado,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });

    await registrarEnBitacora(ctx, {
      actor,
      accion: "programa.creado",
      entidad: "programs",
      entidadId: id,
      detalle: limpiarTexto(args.titulo, 80),
    });
    return id;
  },
});

export const actualizar = mutation({
  args: {
    id: v.id("programs"),
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
    if (previo === null) throw new Error("Ese programa ya no existe.");

    await ctx.db.patch(args.id, {
      titulo: limpiarTexto(args.titulo, 120),
      periodo: limpiarTexto(args.periodo, 40),
      pilar: args.pilar,
      estado: args.estado,
      responsable: args.responsable ? limpiarTexto(args.responsable, 60) : undefined,
      notas: args.notas ? limpiarMultilinea(args.notas, 1000) : undefined,
      publicado: args.publicado,
      actualizadoEn: Date.now(),
    });

    await registrarEnBitacora(ctx, {
      actor,
      accion: "programa.actualizado",
      entidad: "programs",
      entidadId: args.id,
      detalle: limpiarTexto(args.titulo, 80),
    });
    return null;
  },
});

export const reordenar = mutation({
  args: { ids: v.array(v.id("programs")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    let orden = 1;
    for (const id of args.ids) {
      const fila = await ctx.db.get(id);
      if (fila === null) continue;
      await ctx.db.patch(id, { orden, actualizadoEn: Date.now() });
      orden += 1;
    }
    await registrarEnBitacora(ctx, { actor, accion: "programa.reordenado", entidad: "programs" });
    return null;
  },
});

export const eliminar = mutation({
  args: { id: v.id("programs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    const fila = await ctx.db.get(args.id);
    if (fila === null) return null;

    await ctx.db.delete(args.id);
    await registrarEnBitacora(ctx, {
      actor,
      accion: "programa.eliminado",
      entidad: "programs",
      entidadId: args.id,
      detalle: fila.titulo,
    });
    return null;
  },
});
