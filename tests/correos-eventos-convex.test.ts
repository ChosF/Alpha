// @vitest-environment edge-runtime
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { fechaEnCiudadDeMexico } from "@/lib/correo-evento";

const modulos = import.meta.glob("../convex/**/*.ts");
const apiKeyAnterior = process.env.RESEND_API_KEY;
const modoPruebaAnterior = process.env.RESEND_TEST_MODE;

beforeAll(() => {
  process.env.RESEND_API_KEY = "re_prueba_local";
  process.env.RESEND_TEST_MODE = "false";
});

afterAll(() => {
  process.env.RESEND_API_KEY = apiKeyAnterior;
  process.env.RESEND_TEST_MODE = modoPruebaAnterior;
});

async function escenario() {
  const t = convexTest(schema, modulos);
  const ahora = Date.now();
  const manana = ahora + 24 * 60 * 60 * 1000;
  const eventId = await t.run(async (ctx) =>
    ctx.db.insert("events", {
      slug: "evento-prueba",
      titulo: "Evento de prueba",
      resumen: "Prueba de campaña",
      fechaEvento: fechaEnCiudadDeMexico(manana),
      horaInicio: "10:00",
      horaFin: "12:00",
      sede: "SUM 1102, Tec CCM",
      pilar: "desarrollo",
      estado: "publicado",
      registroAbierto: true,
      totalRegistros: 3,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }),
  );
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "editor@tec.mx",
      name: "Editor",
      rol: "editor",
      activo: true,
      creadoEn: ahora,
    }),
  );
  await t.run(async (ctx) => {
    const base = {
      eventId,
      carrera: "LAF",
      semestre: "5",
      origen: "prueba",
      ipHash: "hash",
      userAgent: "vitest",
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    await ctx.db.insert("eventRegistrations", {
      ...base,
      nombre: "Ana",
      correo: "ana@tec.mx",
      canales: { correo: true, whatsapp: false },
      estado: "registrado",
    });
    await ctx.db.insert("eventRegistrations", {
      ...base,
      nombre: "Beto",
      correo: "beto@tec.mx",
      canales: { correo: true, whatsapp: false },
      estado: "cancelado",
    });
    await ctx.db.insert("eventRegistrations", {
      ...base,
      nombre: "Caro",
      correo: "caro@tec.mx",
      canales: { correo: false, whatsapp: true },
      estado: "confirmado",
    });
  });
  return {
    t,
    eventId,
    manana,
    sesion: t.withIdentity({ subject: `${userId}|sesion` }),
  };
}

describe("correos programados de eventos", () => {
  it("cuenta solo asistentes activos que autorizaron correo", async () => {
    const { sesion, eventId } = await escenario();
    await expect(sesion.query(api.correosEventos.resumen, { eventId })).resolves.toMatchObject({
      cantidad: 1,
      limiteExcedido: false,
      correoListo: true,
      modoPrueba: false,
    });
  });

  it("persiste un correo normal futuro sin ejecutarlo antes de tiempo", async () => {
    const { t, sesion, eventId, manana } = await escenario();
    const resultado = await sesion.mutation(api.correosEventos.programar, {
      eventId,
      tipo: "normal",
      asunto: "Informacion del evento",
      texto: "Este es un mensaje de prueba.",
      programadoPara: manana,
      clientRequestId: "prueba-programacion-001",
    });
    expect(resultado.destinatarios).toBe(1);
    const trabajo = await t.run(async (ctx) => ctx.db.get(resultado.id));
    expect(trabajo).toMatchObject({
      estado: "programado",
      destinatariosEstimados: 1,
      encolados: 0,
    });
  });

  it("impide programar el recordatorio en un dia distinto al evento", async () => {
    const { sesion, eventId, manana } = await escenario();
    await expect(
      sesion.mutation(api.correosEventos.programar, {
        eventId,
        tipo: "recordatorio",
        programadoPara: manana + 24 * 60 * 60 * 1000,
        clientRequestId: "prueba-recordatorio-otro-dia",
      }),
    ).rejects.toThrow(/mismo día del evento/);
  });
});
