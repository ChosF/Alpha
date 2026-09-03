import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  ACENTOS_PANEL,
  DENSIDADES_PANEL,
  GRAFICAS_INICIO,
  TEMAS_PANEL,
  acentoPanelValidador,
  densidadPanelValidador,
  graficaInicioValidador,
  temaPanelValidador,
  type GraficaInicio,
} from "./lib/validadores";
import { requiereRol } from "./lib/rbac";

const preferenciasValidador = v.object({
  guardadas: v.boolean(),
  tema: temaPanelValidador,
  densidad: densidadPanelValidador,
  acento: acentoPanelValidador,
  barraContraida: v.boolean(),
  graficasInicio: v.array(graficaInicioValidador),
});

const PREDETERMINADAS = {
  tema: TEMAS_PANEL[0],
  densidad: DENSIDADES_PANEL[0],
  acento: ACENTOS_PANEL[1],
  barraContraida: false,
  graficasInicio: [...GRAFICAS_INICIO],
} as const;

export const obtener = query({
  args: {},
  returns: preferenciasValidador,
  handler: async (ctx) => {
    const usuario = await requiereRol(ctx, "lector");
    const guardadas = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_user", (q) => q.eq("userId", usuario._id))
      .unique();

    if (!guardadas) {
      return {
        ...PREDETERMINADAS,
        guardadas: false,
        graficasInicio: [...PREDETERMINADAS.graficasInicio],
      };
    }
    return {
      guardadas: true,
      tema: guardadas.tema,
      densidad: guardadas.densidad,
      acento: guardadas.acento,
      barraContraida: guardadas.barraContraida,
      graficasInicio: guardadas.graficasInicio,
    };
  },
});

export const guardar = mutation({
  args: {
    tema: v.optional(temaPanelValidador),
    densidad: v.optional(densidadPanelValidador),
    acento: v.optional(acentoPanelValidador),
    barraContraida: v.optional(v.boolean()),
    graficasInicio: v.optional(v.array(graficaInicioValidador)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const usuario = await requiereRol(ctx, "lector");
    const existentes = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_user", (q) => q.eq("userId", usuario._id))
      .unique();

    const graficasInicio = args.graficasInicio
      ? Array.from(new Set(args.graficasInicio)) as GraficaInicio[]
      : existentes?.graficasInicio ?? [...GRAFICAS_INICIO];
    const valores = {
      tema: args.tema ?? existentes?.tema ?? PREDETERMINADAS.tema,
      densidad: args.densidad ?? existentes?.densidad ?? PREDETERMINADAS.densidad,
      acento: args.acento ?? existentes?.acento ?? PREDETERMINADAS.acento,
      barraContraida:
        args.barraContraida ?? existentes?.barraContraida ?? PREDETERMINADAS.barraContraida,
      graficasInicio,
      actualizadoEn: Date.now(),
    };

    if (existentes) {
      await ctx.db.patch(existentes._id, valores);
    } else {
      await ctx.db.insert("dashboardPreferences", { userId: usuario._id, ...valores });
    }
    return null;
  },
});
