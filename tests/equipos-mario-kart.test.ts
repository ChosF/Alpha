// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import resendTest from "@convex-dev/resend/test";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";
import { CIERRE_TORNEO } from "@/lib/torneo-mario-kart";

const modules = import.meta.glob("../convex/**/*.ts");
const secreto = "test-secret-for-tournament-32-characters";
const token = (n: number) => n.toString(16).padStart(64, "0");
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-15T18:00:00Z"));
  vi.stubEnv("INGEST_SECRET", secreto); vi.stubEnv("RESEND_API_KEY", "re_test"); vi.stubEnv("RESEND_TEST_MODE", "false"); vi.stubEnv("SITE_URL", "https://alphaccm.org");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function preparar(maxEquipos = 5) {
  const t = convexTest(schema, modules); resendTest.register(t);
  const eventId = await t.run(ctx => ctx.db.insert("events", { slug: "mario-kart", titulo: "Mario Kart", resumen: "", pilar: "comunidad", estado: "publicado", registroAbierto: true, totalRegistros: 0, maxEquipos, fechaEvento: "2026-09-21", horaFin: "17:00", creadoEn: Date.now(), actualizadoEn: Date.now() }));
  const persona = { nombre: "Persona de prueba", carrera: "LAF", semestre: "5", matricula: "A01234567" };
  const args = (n: number) => ({ secreto, correo: `persona${n}@example.com`, ipHash: `ip${n}`, userAgent: "vitest", nuevoToken: token(n), persona });
  const crear = async (n: number, privado = false) => {
    await t.mutation(api.equiposMarioKart.participar, { ...args(n), nombreEquipo: `Equipo ${n}`, privado });
    return (await t.query(api.equiposMarioKart.listar, { invitacion: token(n) })).invitado!;
  };
  return { t, eventId, args, crear };
}

describe("torneo Mario Kart", () => {
  it("pide datos solo a nuevos asistentes y conserva el registro y QR existentes", async () => {
    const { t, args, crear, eventId } = await preparar();
    const equipo = await crear(1);
    const datos = args(2);
    expect((await t.mutation(api.equiposMarioKart.participar, { ...datos, persona: undefined, equipoId: equipo.id })).estado).toBe("registro");
    expect((await t.run(ctx => ctx.db.get(eventId)))!.totalRegistros).toBe(1);
    await t.mutation(api.equiposMarioKart.participar, { ...datos, equipoId: equipo.id });
    const antes = await t.run(ctx => ctx.db.query("eventRegistrations").collect());
    expect((await t.mutation(api.equiposMarioKart.participar, { ...datos, persona: undefined, equipoId: equipo.id })).estado).toBe("unido");
    expect(await t.run(ctx => ctx.db.query("eventRegistrations").collect())).toEqual(antes);
    expect((await t.run(ctx => ctx.db.get(eventId)))!.totalRegistros).toBe(2);
    expect(antes.find(p => p.correo === datos.correo)).toMatchObject({ equipoNombre: equipo.nombre, equipoId: equipo.id });
    const userId = await t.run(ctx => ctx.db.insert("users", { email: "staff@example.com", rol: "editor", activo: true, creadoEn: Date.now() }));
    const staff = t.withIdentity({ subject: `${userId}|session` });
    expect((await staff.query(api.boletos.validar, { codigo: antes[1]._id })).equipo).toBe(equipo.nombre);
    await expect(staff.query(api.eventos.listarRegistros, { eventId })).resolves.toHaveLength(2);
  });

  it("acepta correo de asistentes anteriores sin pedir sus datos ni exponerlos", async () => {
    const { t, args, crear, eventId } = await preparar();
    const equipo = await crear(1);
    const id = await t.run(ctx => ctx.db.insert("eventRegistrations", { eventId, nombre: "Nombre privado", correo: "ya@example.com", carrera: "LAF", semestre: "1", canales: { correo: true, whatsapp: false }, estado: "registrado", origen: "previo", ipHash: "", userAgent: "", creadoEn: Date.now(), actualizadoEn: Date.now() }));
    const result = await t.mutation(api.equiposMarioKart.participar, { ...args(2), correo: "YA@example.com", persona: undefined, equipoId: equipo.id });
    expect(result.estado).toBe("unido"); expect(JSON.stringify(result)).not.toContain("Nombre privado");
    expect((await t.run(ctx => ctx.db.get(id)))?.equipoId).toBe(equipo.id);
    const publico = JSON.stringify(await t.query(api.equiposMarioKart.listar, {}));
    expect(publico).not.toContain("@example.com"); expect(publico).not.toContain("invitacionHash"); expect(publico).not.toContain(token(1));
  });

  it("limita a cuatro miembros incluso con intentos simultáneos y evita dos equipos por persona", async () => {
    const { t, args, crear } = await preparar();
    const equipo = await crear(1); const otro = await crear(8);
    await t.mutation(api.equiposMarioKart.participar, { ...args(2), equipoId: equipo.id });
    await t.mutation(api.equiposMarioKart.participar, { ...args(3), equipoId: equipo.id });
    const respuestas = await Promise.allSettled([4, 5].map(n => t.mutation(api.equiposMarioKart.participar, { ...args(n), equipoId: equipo.id })));
    expect(respuestas.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await t.run(ctx => ctx.db.get(equipo.id)))!.miembros).toHaveLength(4);
    await expect(t.mutation(api.equiposMarioKart.participar, { ...args(2), equipoId: otro.id })).rejects.toThrow("otro equipo");
  });

  it("las solicitudes privadas no ocupan cupo; aprobar es idempotente y el enlace compartido evita aprobación", async () => {
    const { t, args, crear } = await preparar(); const equipo = await crear(1, true);
    expect((await t.mutation(api.equiposMarioKart.participar, { ...args(2), equipoId: equipo.id })).estado).toBe("pendiente");
    await t.mutation(api.equiposMarioKart.participar, { ...args(2), persona: undefined, equipoId: equipo.id });
    expect(await t.run(ctx => ctx.db.query("tournamentRequests").collect())).toHaveLength(1);
    expect((await t.run(ctx => ctx.db.get(equipo.id)))!.miembros).toHaveLength(1);
    expect(await t.query(api.equiposMarioKart.solicitud, { token: token(77) })).toBeNull();
    expect((await t.query(api.equiposMarioKart.solicitud, { token: token(2) }))?.estado).toBe("pendiente");
    await t.mutation(api.equiposMarioKart.responder, { token: token(2), aceptar: true });
    await t.mutation(api.equiposMarioKart.responder, { token: token(2), aceptar: true });
    expect((await t.run(ctx => ctx.db.get(equipo.id)))!.miembros).toHaveLength(2);
    expect((await t.mutation(api.equiposMarioKart.participar, { ...args(3), invitacion: token(1) })).estado).toBe("unido");
    expect(await t.run(ctx => ctx.db.query("tournamentRequests").collect())).toHaveLength(1);
    expect((await t.mutation(api.equiposMarioKart.participar, { ...args(4), equipoId: equipo.id })).estado).toBe("pendiente");
    await t.mutation(api.equiposMarioKart.responder, { token: token(4), aceptar: false });
    expect((await t.run(ctx => ctx.db.get(equipo.id)))!.miembros).toHaveLength(3);
  });

  it("revalida el último lugar al aprobar y rechaza invitaciones falsas", async () => {
    const { t, args, crear } = await preparar(); const equipo = await crear(1, true);
    for (const n of [2, 3, 4, 5]) await t.mutation(api.equiposMarioKart.participar, { ...args(n), equipoId: equipo.id });
    for (const n of [2, 3, 4]) await t.mutation(api.equiposMarioKart.responder, { token: token(n), aceptar: true });
    await expect(t.mutation(api.equiposMarioKart.responder, { token: token(5), aceptar: true })).rejects.toThrow("4 integrantes");
    await expect(t.mutation(api.equiposMarioKart.participar, { ...args(6), invitacion: token(77) })).rejects.toThrow("invitación");
  });

  it("respeta el límite editable y exige rol editor para cambiarlo", async () => {
    const { t, args, crear, eventId } = await preparar(1); await crear(1);
    await expect(crear(2)).rejects.toThrow("espacio");
    const data = { id: eventId, titulo: "Mario Kart", resumen: "", pilar: "comunidad" as const, estado: "publicado" as const, maxEquipos: 2 };
    await expect(t.mutation(api.eventos.actualizar, data)).rejects.toThrow();
    const userId = await t.run(ctx => ctx.db.insert("users", { rol: "editor", activo: true, creadoEn: Date.now() }));
    const staff = t.withIdentity({ subject: `${userId}|session` });
    await staff.mutation(api.eventos.actualizar, data); await crear(2);
    await expect(staff.mutation(api.eventos.actualizar, { ...data, maxEquipos: 1 })).rejects.toThrow("2 equipos");
    await expect(staff.mutation(api.eventos.actualizar, { ...data, maxEquipos: 2.5 })).rejects.toThrow("entero");
    await expect(t.mutation(api.equiposMarioKart.participar, { ...args(4), secreto: "bad", nombreEquipo: "Bad" })).rejects.toThrow("autorizado");
  });

  it("cierra exactamente al terminar el 19 de septiembre y descalifica solo equipos incompletos", async () => {
    const { t, args, crear } = await preparar(); const incompleto = await crear(1); const completo = await crear(8);
    for (const n of [9, 10]) await t.mutation(api.equiposMarioKart.participar, { ...args(n), equipoId: completo.id });
    vi.setSystemTime(CIERRE_TORNEO - 1);
    await t.mutation(api.equiposMarioKart.participar, { ...args(11), equipoId: completo.id });
    vi.setSystemTime(CIERRE_TORNEO);
    await expect(t.mutation(api.equiposMarioKart.participar, { ...args(3), equipoId: incompleto.id })).rejects.toThrow("cerrado");
    await t.mutation(internal.equiposMarioKart.cerrarEquipo, { id: incompleto.id });
    await t.mutation(internal.equiposMarioKart.cerrarEquipo, { id: completo.id });
    expect((await t.run(ctx => ctx.db.get(incompleto.id)))?.descalificado).toBe(true);
    expect((await t.run(ctx => ctx.db.get(completo.id)))?.descalificado).toBe(false);
    expect((await t.run(ctx => ctx.db.query("eventRegistrations").collect())).every(p => p.estado === "registrado")).toBe(true);
  });
});
