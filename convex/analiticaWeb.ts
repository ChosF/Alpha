import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requiereRol } from "./lib/rbac";
import { rutaAnalitica } from "../lib/rutas-analitica";
import { completarDias, informeValidador, periodoValidador, rangoWeb, respuestaVercel, type InformeWeb } from "./lib/analiticaWeb";

export const autorizar = internalQuery({
  args: {}, returns: v.null(),
  handler: async (ctx) => { await requiereRol(ctx, "lector"); return null; },
});
export const leerCache = internalQuery({
  args: { clave: v.string() }, returns: v.union(informeValidador, v.null()),
  handler: async (ctx, { clave }) => {
    const fila = await ctx.db.query("webAnalyticsCache").withIndex("by_clave", q => q.eq("clave", clave)).unique();
    return fila?.informe ?? null;
  },
});
export const guardarCache = internalMutation({
  args: { clave: v.string(), informe: informeValidador }, returns: v.null(),
  handler: async (ctx, args) => {
    const fila = await ctx.db.query("webAnalyticsCache").withIndex("by_clave", q => q.eq("clave", args.clave)).unique();
    if (fila) await ctx.db.patch(fila._id, { informe: args.informe });
    else await ctx.db.insert("webAnalyticsCache", args);
    return null;
  },
});

export const obtener = action({
  args: { dias: periodoValidador },
  returns: v.union(
    v.object({ estado: v.literal("disponible"), informe: informeValidador }),
    v.object({ estado: v.literal("sin_configurar") }),
  ),
  handler: async (ctx, { dias }): Promise<{ estado: "disponible"; informe: InformeWeb } | { estado: "sin_configurar" }> => {
    await ctx.runQuery(internal.analiticaWeb.autorizar, {});
    const token = process.env.VERCEL_ANALYTICS_TOKEN;
    const proyecto = process.env.VERCEL_ANALYTICS_PROJECT_ID;
    const equipo = process.env.VERCEL_ANALYTICS_TEAM_ID;
    if (!token || !proyecto) return { estado: "sin_configurar" };
    const ahora = Date.now();
    const { desde, hasta } = rangoWeb(dias, ahora);
    const clave = `v2:${equipo ?? "personal"}:${proyecto}:${dias}`;
    const cache = await ctx.runQuery(internal.analiticaWeb.leerCache, { clave });
    if (cache && cache.desde === desde && ahora - cache.actualizadoEn < 300_000) {
      return { estado: "disponible", informe: cache };
    }
    async function consultar(dimension?: string) {
      const url = new URL("https://api.vercel.com/v1/query/web-analytics/visits/aggregate");
      url.search = new URLSearchParams({ projectId: proyecto!, since: desde, until: new Date(Date.parse(hasta) - 1).toISOString(),
        filter: "environment eq 'production'", limit: dimension === "day" ? "31" : "100",
        by: dimension ?? "environment", ...(equipo ? { teamId: equipo } : {}),
      }).toString();
      let respuesta: Response;
      try {
        respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      } catch { throw new ConvexError("No se pudo conectar con las estadísticas. Intenta de nuevo en unos minutos."); }
      if (!respuesta.ok) {
        const mensaje = respuesta.status === 401 || respuesta.status === 403
          ? "Vercel no autorizó la consulta. Un administrador debe revisar el acceso de la integración."
          : respuesta.status === 429 ? "Se alcanzó el límite de consultas. Intenta de nuevo en unos minutos."
          : "Las estadísticas no están disponibles en este momento. Intenta de nuevo más tarde.";
        throw new ConvexError(mensaje);
      }
      const resultado = respuestaVercel.safeParse(await respuesta.json());
      if (!resultado.success) throw new ConvexError("No se pudo interpretar la respuesta de estadísticas.");
      return resultado.data.data;
    }
    const [totales, diario, paginas, fuentes, dispositivos, paises, navegadores] = await Promise.all([
      consultar(), consultar("day"), consultar("requestPath"), consultar("referrerHostname"),
      consultar("deviceType"), consultar("country"), consultar("browserName"),
    ]);
    if (totales.length > 1) throw new ConvexError("La consulta no devolvió un total único para el periodo.");
    const agrupar = (filas: typeof paginas, dimension: "requestPath" | "referrerHostname" | "deviceType" | "country" | "browserName") => {
      const grupos = new Map<string, number>();
      for (const fila of filas) {
        const original = fila[dimension] || (dimension === "referrerHostname" ? "Directo" : "Desconocido");
        const clave = dimension === "requestPath" ? rutaAnalitica(original) : original;
        grupos.set(clave, (grupos.get(clave) ?? 0) + fila.pageviews);
      }
      const ordenados = [...grupos].filter(([clave]) => clave !== "Others").map(([clave, cantidad]) => ({ clave, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
      const otros = (grupos.get("Others") ?? 0) + ordenados.slice(5).reduce((total, fila) => total + fila.cantidad, 0);
      return [...ordenados.slice(0, 5), ...(otros ? [{ clave: "Others", cantidad: otros }] : [])];
    };
    if (diario.some(fila => !fila.timestamp)) throw new ConvexError("La serie de visitas no incluye fechas válidas.");
    const informe: InformeWeb = {
      desde, hasta, actualizadoEn: ahora, visitantes: totales[0]?.visitors ?? 0, vistas: totales[0]?.pageviews ?? 0,
      diario: completarDias(diario.map(fila => ({ clave: fila.timestamp!, cantidad: fila.pageviews })), desde, hasta),
      paginas: agrupar(paginas, "requestPath"), fuentes: agrupar(fuentes, "referrerHostname"),
      dispositivos: agrupar(dispositivos, "deviceType"), paises: agrupar(paises, "country"), navegadores: agrupar(navegadores, "browserName"),
    };
    await ctx.runMutation(internal.analiticaWeb.guardarCache, { clave, informe });
    return { estado: "disponible", informe };
  },
});
