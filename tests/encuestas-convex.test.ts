// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";

const modulos = import.meta.glob("../convex/**/*.ts");

describe("encuestas de satisfacción", () => {
  it("mantiene el enlace activo al abrirlo y lo cierra después de responder", async () => {
    const t = convexTest(schema, modulos);
    const token = "a".repeat(32);
    const id = await t.mutation(internal.encuestas.crearInvitacionPrueba, {
      token,
      eventoTitulo: "Networking Night",
      destinatarioCorreo: "persona@example.com",
      destinatarioNombre: "Ana",
    });
    await t.mutation(internal.encuestas.marcarActiva, { id, emailId: "correo-prueba-1" });

    await expect(t.query(api.encuestas.obtener, { token })).resolves.toEqual({
      estado: "disponible",
      eventoTitulo: "Networking Night",
    });
    await expect(t.query(api.encuestas.obtener, { token })).resolves.toEqual({
      estado: "disponible",
      eventoTitulo: "Networking Night",
    });

    await expect(
      t.mutation(api.encuestas.responder, {
        token,
        calificacionEvento: 5,
        opinionContenido: "excelente",
        origen: "instagram",
        comentarios: "  Más tiempo para preguntas.  ",
      }),
    ).resolves.toEqual({ estado: "enviada" });
    await expect(t.query(api.encuestas.obtener, { token })).resolves.toEqual({
      estado: "respondida",
      eventoTitulo: "Networking Night",
    });
    await expect(
      t.mutation(api.encuestas.responder, {
        token,
        calificacionEvento: 1,
        opinionContenido: "malo",
        origen: "correo",
      }),
    ).resolves.toEqual({ estado: "respondida" });

    const guardada = await t.run(async (ctx) => ctx.db.get(id));
    expect(guardada).toMatchObject({
      estado: "respondida",
      calificacionEvento: 5,
      opinionContenido: "excelente",
      origen: "instagram",
      comentarios: "Más tiempo para preguntas.",
    });
  });

  it("agrega resultados sin devolver nombres ni correos", async () => {
    const t = convexTest(schema, modulos);
    const ahora = Date.now();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "lector@tec.mx",
        name: "Lector",
        rol: "lector",
        activo: true,
        creadoEn: ahora,
      }),
    );
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        slug: "evento-analytics",
        titulo: "Taller cuantitativo",
        resumen: "Evento de prueba",
        pilar: "desarrollo",
        estado: "publicado",
        registroAbierto: false,
        totalRegistros: 1,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }),
    );
    const jobId = await t.run(async (ctx) =>
      ctx.db.insert("eventMailJobs", {
        eventId,
        tipo: "encuesta",
        asunto: "Encuesta",
        texto: "Comparte tu opinión.",
        estado: "encolado",
        destinatariosEstimados: 1,
        encolados: 1,
        fallidos: 0,
        programadoPara: ahora,
        clientRequestId: "analytics-prueba-001",
        creadoPor: userId,
        autorCorreo: "lector@tec.mx",
        creadoEn: ahora,
        actualizadoEn: ahora,
      }),
    );
    const token = "b".repeat(32);
    const invitacion = await t.mutation(internal.encuestas.crearInvitacion, {
      eventId,
      mailJobId: jobId,
      token,
      eventoTitulo: "Taller cuantitativo",
      destinatarioCorreo: "persona@example.com",
      destinatarioNombre: "Persona",
    });
    await t.mutation(internal.encuestas.marcarActiva, {
      id: invitacion.id,
      emailId: "correo-analytics-1",
    });
    await t.mutation(api.encuestas.responder, {
      token,
      calificacionEvento: 4,
      opinionContenido: "bueno",
      origen: "whatsapp",
      comentarios: "Agregar un ejemplo práctico.",
    });

    const sesion = t.withIdentity({ subject: `${userId}|sesion` });
    const resultados = await sesion.query(api.encuestas.analytics, {});
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      eventId,
      titulo: "Taller cuantitativo",
      campanas: 1,
      enviadas: 1,
      respuestas: 1,
      tasaRespuesta: 100,
      promedio: 4,
      comentarios: [
        {
          texto: "Agregar un ejemplo práctico.",
          calificacionEvento: 4,
        },
      ],
    });
    expect(JSON.stringify(resultados)).not.toContain("persona@example.com");
    expect(JSON.stringify(resultados)).not.toContain("Persona");
  });
});
