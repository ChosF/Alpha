// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { enlaceAsistenciaRegistro } from "@/lib/registro-asistencia";
import { destinoDashboard } from "@/lib/destino-dashboard";

const modulos = import.meta.glob("../convex/**/*.ts");
async function preparar(rol: "admin" | "editor" | "lector" = "editor", activo = true) {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-14T18:00:00Z"));
  const t = convexTest(schema, modulos);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { email: "staff@example.com", name: "Staff", rol, activo, creadoEn: Date.now() });
    const eventId = await ctx.db.insert("events", { slug: "otro-evento", titulo: "Otro evento", resumen: "", pilar: "comunidad", estado: "publicado", fechaEvento: "2026-09-14", horaInicio: "10:00", horaFin: "20:00", registroAbierto: false, totalRegistros: 1, creadoEn: Date.now(), actualizadoEn: Date.now() });
    const registroId = await ctx.db.insert("eventRegistrations", { eventId, nombre: "Asistente de prueba", correo: "ticket@example.com", carrera: "LAF", semestre: "3", canales: { correo: true, whatsapp: false }, estado: "registrado", origen: "web", ipHash: "", userAgent: "", creadoEn: Date.now(), actualizadoEn: Date.now() });
    return { userId, eventId, registroId };
  });
  return { t, ...ids, sesion: t.withIdentity({ subject: `${ids.userId}|sesion` }), args: { codigo: ids.registroId } };
}
afterEach(() => vi.useRealTimers());

describe("boletos reutilizables", () => {
  it.each(["admin", "editor"] as const)("%s valida sin consumir y confirma una sola vez", async rol => {
    const { t, sesion, args, registroId, userId } = await preparar(rol);
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("valido");
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("valido");
    expect((await t.run(ctx => ctx.db.get(registroId)))?.estado).toBe("registrado");
    await Promise.all([sesion.mutation(api.boletos.confirmar, args), sesion.mutation(api.boletos.confirmar, args)]);
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("utilizado");
    expect(await t.run(ctx => ctx.db.get(registroId))).toMatchObject({ estado: "asistio", boletoUtilizadoPor: userId, boletoUtilizadoEn: Date.now() });
    expect(await t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(1);
    // Ordinary attendance edits must not revive a redeemed QR.
    await sesion.mutation(api.eventos.cambiarEstadoRegistro, { id: registroId, estado: "confirmado" });
    expect((await sesion.mutation(api.boletos.confirmar, args)).estado).toBe("utilizado");
    await expect(sesion.query(api.eventos.listarRegistros, { eventId: (await t.run(ctx => ctx.db.get(registroId)))!.eventId })).resolves.toBeDefined();
  });
  it.each([["lector", true], ["editor", false]] as const)("niega datos y confirmación a %s activo=%s", async (rol, activo) => {
    const { sesion, args } = await preparar(rol, activo);
    expect(await sesion.query(api.boletos.validar, args)).toEqual({ estado: "sin_acceso" });
    await expect(sesion.mutation(api.boletos.confirmar, args)).rejects.toThrow();
  });
  it("niega anónimos y revocación de rol después de escanear", async () => {
    const { t, sesion, args, userId } = await preparar();
    expect(await t.query(api.boletos.validar, args)).toEqual({ estado: "sin_acceso" });
    await expect(t.mutation(api.boletos.confirmar, args)).rejects.toThrow();
    await sesion.query(api.boletos.validar, args);
    await t.run(ctx => ctx.db.patch(userId, { rol: "lector" }));
    await expect(sesion.mutation(api.boletos.confirmar, args)).rejects.toThrow();
  });
  it("rechaza códigos malformados, de otra tabla, inexistentes y cancelados", async () => {
    const { t, sesion, args, registroId, eventId } = await preparar();
    for (const codigo of ["", "invalid", "a".repeat(100), eventId]) {
      expect(await sesion.query(api.boletos.validar, { codigo })).toEqual({ estado: "invalido" });
      expect(await sesion.mutation(api.boletos.confirmar, { codigo })).toEqual({ estado: "invalido" });
    }
    await t.run(ctx => ctx.db.patch(registroId, { estado: "cancelado" }));
    expect((await sesion.mutation(api.boletos.confirmar, args)).estado).toBe("invalido");
    await t.run(ctx => ctx.db.delete(registroId));
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("invalido");
  });
  it("revalida vencimiento exacto al confirmar y no escribe asistencia", async () => {
    const { t, sesion, args, registroId } = await preparar();
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("valido");
    vi.setSystemTime(new Date("2026-09-15T02:00:00Z"));
    expect((await sesion.mutation(api.boletos.confirmar, args)).estado).toBe("vencido");
    expect((await t.run(ctx => ctx.db.get(registroId)))?.estado).toBe("registrado");
    expect(await t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(0);
  });
  it("maneja eventos cerrados, sin fecha, futuros, sin hora final y nocturnos", async () => {
    const { t, sesion, args, eventId } = await preparar();
    for (const [patch, esperado] of [
      [{ estado: "cerrado" as const }, "vencido"],
      [{ estado: "borrador" as const }, "invalido"],
      [{ estado: "publicado" as const, fechaEvento: undefined }, "pendiente"],
      [{ fechaEvento: "2026-09-15" }, "pendiente"],
      [{ fechaEvento: "2026-09-14", horaFin: undefined }, "valido"],
    ] as const) {
      await t.run(ctx => ctx.db.patch(eventId, patch));
      expect((await sesion.mutation(api.boletos.confirmar, { codigo: "invalid" })).estado).toBe("invalido");
      expect((await sesion.query(api.boletos.validar, args)).estado).toBe(esperado);
    }
    vi.setSystemTime(new Date("2026-09-15T06:00:00Z"));
    expect((await sesion.mutation(api.boletos.confirmar, args)).estado).toBe("vencido");
    await t.run(ctx => ctx.db.patch(eventId, { horaInicio: "22:00", horaFin: "02:00" }));
    expect((await sesion.query(api.boletos.validar, args)).estado).toBe("valido");
  });
  it("conserva la URL histórica y limita el retorno después del login", () => {
    const url = new URL(enlaceAsistenciaRegistro("https://alphaccm.org", "abc123"));
    expect(url.pathname).toBe("/registro/id"); expect(url.searchParams.get("")).toBe("abc123");
    expect(destinoDashboard("/dashboard/boletos?id=abc123")).toBe("/dashboard/boletos?id=abc123");
    for (const value of ["https://evil.com/dashboard/boletos", "//evil.com", "/dashboard/ajustes", "javascript:alert(1)"]) expect(destinoDashboard(value)).toBe("/dashboard");
  });
});
