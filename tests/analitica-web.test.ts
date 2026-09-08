// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { completarDias, rangoWeb } from "@/convex/lib/analiticaWeb";
import { rutaAnalitica } from "@/lib/rutas-analitica";

const modulos = import.meta.glob("../convex/**/*.ts");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function sesion(activo = true) {
  const t = convexTest(schema, modulos);
  const id = await t.run(ctx => ctx.db.insert("users", { rol: "lector", activo, creadoEn: Date.now() }));
  return { t, usuario: t.withIdentity({ subject: id }) };
}

describe("tráfico web", () => {
  it("rechaza visitantes anónimos y cuentas desactivadas antes de consultar Vercel", async () => {
    const { t, usuario } = await sesion(false);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(t.action(api.analiticaWeb.obtener, { dias: 7 })).rejects.toThrow();
    await expect(usuario.action(api.analiticaWeb.obtener, { dias: 7 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("distingue una conexión pendiente de un periodo sin visitas", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "");
    const { usuario } = await sesion();
    expect(await usuario.action(api.analiticaWeb.obtener, { dias: 7 })).toEqual({ estado: "sin_configurar" });
  });
  it("consulta totales únicos del periodo, oculta identificadores y reutiliza el caché", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "secret-test");
    vi.stubEnv("VERCEL_ANALYTICS_PROJECT_ID", "project-test");
    const { usuario } = await sesion();
    const { desde, hasta } = rangoWeb(7, Date.now());
    const fetchMock = vi.fn(async (input: URL, init: RequestInit) => {
      const url = new URL(input);
      expect(url.searchParams.get("since")).toBe(desde);
      expect(url.searchParams.get("until")).toBe(new Date(Date.parse(hasta) - 1).toISOString());
      expect(init.headers).toEqual({ Authorization: "Bearer secret-test" });
      const by = url.searchParams.get("by");
      const data = by === "environment" ? [{ visitors: 3, pageviews: 10 }]
        : by === "day" ? [{ timestamp: desde, visitors: 3, pageviews: 10 }]
        : by === "requestPath" ? [{ requestPath: "/encuesta/private-token", visitors: 3, pageviews: 10 }]
        : [{ [by!]: "test", visitors: 3, pageviews: 10 }];
      return Response.json({ data });
    });
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await usuario.action(api.analiticaWeb.obtener, { dias: 7 });
    expect(resultado.estado).toBe("disponible");
    if (resultado.estado !== "disponible") throw new Error("Sin informe");
    expect(resultado.informe.visitantes).toBe(3);
    expect(resultado.informe.diario).toHaveLength(7);
    expect(resultado.informe.paginas).toEqual([{ clave: "/encuesta/[identificador]", cantidad: 10 }]);
    expect(JSON.stringify(resultado)).not.toContain("secret-test");
    expect(await usuario.action(api.analiticaWeb.obtener, { dias: 7 })).toEqual(resultado);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
  it("no convierte errores de Vercel en ceros ni expone su respuesta", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "secret-test"); vi.stubEnv("VERCEL_ANALYTICS_PROJECT_ID", "project-test");
    const { usuario } = await sesion();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("private diagnostics", { status: 403 })));
    await expect(usuario.action(api.analiticaWeb.obtener, { dias: 7 })).rejects.toThrow("Vercel no autorizó");
  });
  it("rechaza una respuesta inesperada y periodos fuera del plan", async () => {
    vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "secret-test"); vi.stubEnv("VERCEL_ANALYTICS_PROJECT_ID", "project-test");
    const { usuario } = await sesion();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ pageviews: "wrong" }] })));
    await expect(usuario.action(api.analiticaWeb.obtener, { dias: 7 })).rejects.toThrow("interpretar");
    // @ts-expect-error Deliberately verify runtime validation for untrusted clients.
    await expect(usuario.action(api.analiticaWeb.obtener, { dias: 90 })).rejects.toThrow();
  });
  it("completa días ausentes y elimina identificadores de rutas sensibles", () => {
    expect(completarDias([{ clave: "2026-09-02T00:00:00Z", cantidad: 4 }], "2026-09-01", "2026-09-03")).toEqual([{ clave: "2026-09-01", cantidad: 0 }, { clave: "2026-09-02", cantidad: 4 }]);
    expect(rutaAnalitica("/registro/secret")).toBe("/registro/[identificador]");
    expect(rutaAnalitica("/events/mario-kart")).toBe("/events/mario-kart");
  });
});
