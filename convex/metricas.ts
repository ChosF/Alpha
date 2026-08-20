import { v } from "convex/values";
import { query } from "./_generated/server";
import { requiereRol } from "./lib/rbac";
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

export const actividad = query({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    const limite = Math.min(Math.max(args.limite ?? 20, 1), 100);
    return await ctx.db.query("auditLog").withIndex("by_creado").order("desc").take(limite);
  },
});
