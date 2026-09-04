// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { beforeAll, describe, expect, it } from "vitest";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Pruebas de las funciones de Convex.
 *
 * Lo que se comprueba aqui no es que el codigo corra, sino que las promesas de
 * seguridad se cumplan: que un lector no pueda escribir, que un editor no
 * pueda invitar, que la ingesta exija su secreto y que los limites frenen.
 */

const SECRETO = "x".repeat(64);
const modulos = import.meta.glob("../convex/**/*.ts");

beforeAll(() => {
  process.env.INGEST_SECRET = SECRETO;
});

/** Crea una cuenta con rol y devuelve un contexto que actua como ella. */
async function comoUsuario(t: ReturnType<typeof convexTest>, rol: "admin" | "editor" | "lector") {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: `${rol}@tec.mx`,
      name: rol,
      rol,
      activo: true,
      creadoEn: Date.now(),
    }),
  );
  // Convex Auth codifica la identidad como "<userId>|<sessionId>".
  return { userId, sesion: t.withIdentity({ subject: `${userId}|sesion` }) };
}

const datosBase = {
  tipo: "miembro" as const,
  nombre: "Mariela Reyes",
  correo: "a01234567@tec.mx",
  carrera: "LAF",
  semestre: "3.er semestre",
  canales: { correo: true, whatsapp: false },
  areas: [],
  ipHash: "hash-ip",
  userAgent: "vitest",
};

describe("ingesta del formulario publico", () => {
  it("rechaza un secreto invalido", async () => {
    const t = convexTest(schema, modulos);
    await expect(
      t.action(api.ingesta.registrar, { secreto: "incorrecto", datos: datosBase }),
    ).rejects.toThrow(/No autorizado/);
  });

  it("guarda el registro cuando el secreto es correcto", async () => {
    const t = convexTest(schema, modulos);
    const r = await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    expect(r.ok).toBe(true);

    const filas = await t.run(async (ctx) => ctx.db.query("registrations").collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]?.correo).toBe("a01234567@tec.mx");
    expect(filas[0]?.estado).toBe("nuevo");
    // La IP nunca se guarda en claro: solo llega el hash que calculo Next.
    expect(filas[0]?.ipHash).toBe("hash-ip");
  });

  it("un mismo correo no duplica ni permite sobrescribir datos", async () => {
    const t = convexTest(schema, modulos);
    await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    await t.action(api.ingesta.registrar, {
      secreto: SECRETO,
      datos: {
        ...datosBase,
        nombre: "Nombre manipulado",
        carrera: "Otra carrera",
        semestre: "4.º semestre",
      },
    });

    const filas = await t.run(async (ctx) => ctx.db.query("registrations").collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]?.nombre).toBe("Mariela Reyes");
    expect(filas[0]?.carrera).toBe("LAF");
    expect(filas[0]?.semestre).toBe("3.er semestre");
  });

  it("un aliado conserva su telefono obligatorio, pero no los canales de miembro", async () => {
    const t = convexTest(schema, modulos);
    await t.action(api.ingesta.registrar, {
      secreto: SECRETO,
      datos: {
        ...datosBase,
        tipo: "aliado",
        canales: { correo: true, whatsapp: true },
        telefono: "5512345678",
        areas: ["finanzas", "finanzas"],
      },
    });

    const fila = await t.run(async (ctx) => ctx.db.query("registrations").first());
    expect(fila?.canales).toEqual({ correo: false, whatsapp: false });
    expect(fila?.telefono).toBe("5512345678");
    // Las areas repetidas se colapsan.
    expect(fila?.areas).toEqual(["finanzas"]);
  });

  it("corta despues de cinco envios desde el mismo origen", async () => {
    const t = convexTest(schema, modulos);
    for (let i = 0; i < 5; i++) {
      const r = await t.action(api.ingesta.registrar, {
        secreto: SECRETO,
        datos: { ...datosBase, correo: `a0000000${i}@tec.mx` },
      });
      expect(r.ok).toBe(true);
    }
    const sexto = await t.action(api.ingesta.registrar, {
      secreto: SECRETO,
      datos: { ...datosBase, correo: "a09999999@tec.mx" },
    });
    expect(sexto).toEqual({ ok: false, motivo: "limite" });
  });
});

const datosEvento = {
  nombre: "Aaron Martinez",
  correo: "a07654321@tec.mx",
  carrera: "LAF",
  semestre: "7.º semestre",
  matricula: "A07654321",
  canales: { correo: true, whatsapp: false },
  ipHash: "hash-evento",
  userAgent: "vitest",
};

describe("registro de Calling LAF", () => {
  it("crea el evento una vez y guarda asistentes separados de miembros", async () => {
    const t = convexTest(schema, modulos);
    const primero = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    const segundo = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    expect(segundo).toBe(primero);

    const resultado = await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: datosEvento,
    });
    expect(resultado).toEqual({ ok: true });

    const guardado = await t.run(async (ctx) => ({
      asistentes: await ctx.db.query("eventRegistrations").collect(),
      miembros: await ctx.db.query("registrations").collect(),
      evento: await ctx.db.get(primero),
    }));
    expect(guardado.asistentes).toHaveLength(1);
    expect(guardado.miembros).toHaveLength(0);
    expect(guardado.evento?.totalRegistros).toBe(1);
    expect(guardado.evento).toMatchObject({
      fechaEvento: "2026-09-04",
      horaInicio: "15:00",
      horaFin: "17:00",
      sede: "SUM 1102, Tec CCM",
    });
  });

  it("un correo repetido no duplica ni sobrescribe el registro", async () => {
    const t = convexTest(schema, modulos);
    await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: datosEvento,
    });
    await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: { ...datosEvento, nombre: "Nombre manipulado" },
    });
    const filas = await t.run(async (ctx) => ctx.db.query("eventRegistrations").collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]?.nombre).toBe("Aaron Martinez");
  });

  it("rechaza registros cuando el evento esta cerrado", async () => {
    const t = convexTest(schema, modulos);
    const eventId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.run(async (ctx) => ctx.db.patch(eventId, { registroAbierto: false }));
    await expect(
      t.action(api.ingestaEventos.registrar, {
        secreto: SECRETO,
        slug: "calling-laf",
        datos: datosEvento,
      }),
    ).resolves.toEqual({ ok: false, motivo: "cerrado" });
  });

  it("protege la lista y reserva los cambios para editores", async () => {
    const t = convexTest(schema, modulos);
    const eventId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: datosEvento,
    });
    const registroId = await t.run(async (ctx) => (await ctx.db.query("eventRegistrations").first())!._id);
    const lector = await comoUsuario(t, "lector");
    const editor = await comoUsuario(t, "editor");

    await expect(t.query(api.eventos.listar, {})).rejects.toThrow(/Sesion no valida/);
    await expect(lector.sesion.query(api.eventos.listarRegistros, { eventId })).resolves.toHaveLength(1);
    await expect(
      lector.sesion.mutation(api.eventos.cambiarEstadoRegistro, {
        id: registroId,
        estado: "confirmado",
      }),
    ).rejects.toThrow(/no permite/);
    await expect(
      editor.sesion.mutation(api.eventos.cambiarEstadoRegistro, {
        id: registroId,
        estado: "confirmado",
      }),
    ).resolves.toBeNull();
  });

  it("registra asistentes en puerta con campos opcionales y asistencia automatica", async () => {
    const t = convexTest(schema, modulos);
    const eventId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    const lector = await comoUsuario(t, "lector");
    const editor = await comoUsuario(t, "editor");
    const datosVacios = {
      eventId,
      nombre: "",
      matricula: "",
      correo: "",
      semestre: "",
      carrera: "",
    };

    await expect(
      lector.sesion.mutation(api.eventos.registrarAsistenteEnPuerta, datosVacios),
    ).rejects.toThrow(/no permite/);
    const resultado = await editor.sesion.mutation(
      api.eventos.registrarAsistenteEnPuerta,
      datosVacios,
    );

    const guardado = await t.run(async (ctx) => ({
      registro: await ctx.db.get(resultado.id),
      evento: await ctx.db.get(eventId),
    }));
    expect(resultado.creado).toBe(true);
    expect(guardado.registro).toMatchObject({
      estado: "asistio",
      origen: "panel:asistencia",
      nombre: "",
      correo: "",
      carrera: "",
      semestre: "",
    });
    expect(guardado.evento?.totalRegistros).toBe(1);
  });

  it("reutiliza el registro existente por correo al registrar en puerta", async () => {
    const t = convexTest(schema, modulos);
    const eventId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: datosEvento,
    });
    const editor = await comoUsuario(t, "editor");

    const resultado = await editor.sesion.mutation(api.eventos.registrarAsistenteEnPuerta, {
      eventId,
      nombre: "Otro nombre",
      matricula: "",
      correo: " A07654321@TEC.MX ",
      semestre: "",
      carrera: "",
    });
    const filas = await t.run(async (ctx) => ctx.db.query("eventRegistrations").collect());

    expect(resultado.creado).toBe(false);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ nombre: "Aaron Martinez", estado: "asistio" });
  });

  it("permite a un editor eliminar un evento y limpia sus registros asociados", async () => {
    const t = convexTest(schema, modulos);
    const eventId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO,
      slug: "calling-laf",
      datos: datosEvento,
    });
    const lector = await comoUsuario(t, "lector");
    const editor = await comoUsuario(t, "editor");

    await expect(lector.sesion.mutation(api.eventos.eliminar, { id: eventId })).rejects.toThrow(
      /no permite/,
    );

    await expect(editor.sesion.mutation(api.eventos.eliminar, { id: eventId })).resolves.toBeNull();

    const evento = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(evento).toBeNull();

    const registros = await t.run(async (ctx) =>
      ctx.db
        .query("eventRegistrations")
        .withIndex("by_event_and_creado", (q) => q.eq("eventId", eventId))
        .collect(),
    );
    expect(registros).toHaveLength(0);

    const bitacora = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_creado")
        .filter((q) => q.eq(q.field("accion"), "evento.eliminado"))
        .first(),
    );
    expect(bitacora).not.toBeNull();
    expect(bitacora?.entidadId).toBe(eventId);
  });
});

describe("registro de Mario Kart Challenge", () => {
  it("crea el evento de forma idempotente y lo mantiene separado de Calling LAF", async () => {
    const t = convexTest(schema, modulos);
    const primero = await t.action(api.ingestaEventos.asegurarMarioKart, { secreto: SECRETO });
    await t.run(async (ctx) =>
      ctx.db.patch(primero, {
        titulo: "Borrador",
        estado: "borrador",
        registroAbierto: false,
      }),
    );
    const segundo = await t.action(api.ingestaEventos.asegurarMarioKart, { secreto: SECRETO });
    expect(segundo).toBe(primero);

    const evento = await t.run(async (ctx) => ctx.db.get(primero));
    expect(evento).toMatchObject({
      slug: "mario-kart",
      titulo: "Mario Kart Challenge",
      pilar: "comunidad",
      estado: "publicado",
      registroAbierto: true,
    });
  });

  it("crea el evento al recibir el primer registro y no reabre uno cerrado", async () => {
    const t = convexTest(schema, modulos);
    await expect(
      t.action(api.ingestaEventos.registrar, {
        secreto: SECRETO,
        slug: "mario-kart",
        datos: datosEvento,
      }),
    ).resolves.toEqual({ ok: true });

    const evento = await t.run(async (ctx) =>
      ctx.db.query("events").withIndex("by_slug", (q) => q.eq("slug", "mario-kart")).unique(),
    );
    expect(evento?.totalRegistros).toBe(1);

    await t.run(async (ctx) => ctx.db.patch(evento!._id, { registroAbierto: false }));
    await expect(
      t.action(api.ingestaEventos.registrar, {
        secreto: SECRETO,
        slug: "mario-kart",
        datos: { ...datosEvento, correo: "otra-persona@tec.mx" },
      }),
    ).resolves.toEqual({ ok: false, motivo: "cerrado" });
  });

  it("exige correo y no guarda WhatsApp ni teléfono", async () => {
    const t = convexTest(schema, modulos);

    await expect(
      t.action(api.ingestaEventos.registrar, {
        secreto: SECRETO,
        slug: "mario-kart",
        datos: {
          ...datosEvento,
          canales: { correo: false, whatsapp: true },
          telefono: "5512345678",
        },
      }),
    ).rejects.toThrow(/necesita correo electrónico/);

    await expect(
      t.action(api.ingestaEventos.registrar, {
        secreto: SECRETO,
        slug: "mario-kart",
        datos: {
          ...datosEvento,
          correo: "correo-obligatorio@tec.mx",
          canales: { correo: true, whatsapp: true },
          telefono: "5512345678",
          ipHash: "hash-evento-correo",
        },
      }),
    ).resolves.toEqual({ ok: true });

    const registro = await t.run(async (ctx) =>
      (await ctx.db.query("eventRegistrations").collect()).find(
        (fila) => fila.correo === "correo-obligatorio@tec.mx",
      ),
    );
    expect(registro?.canales).toEqual({ correo: true, whatsapp: false });
    expect(registro?.telefono).toBeUndefined();
  });
});

describe("control de acceso", () => {
  it("sin sesion no se puede leer nada del panel", async () => {
    const t = convexTest(schema, modulos);
    await expect(t.query(api.registros.listar, {})).rejects.toThrow(/Sesion no valida/);
    await expect(t.query(api.metricas.resumen, {})).rejects.toThrow(/Sesion no valida/);
  });

  it("un lector consulta pero no modifica", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "lector");
    await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    const id = await t.run(async (ctx) => {
      const fila = await ctx.db.query("registrations").first();
      return fila!._id;
    });

    await expect(sesion.query(api.registros.listar, {})).resolves.toBeDefined();
    await expect(
      sesion.mutation(api.registros.cambiarEstado, { id, estado: "contactado" }),
    ).rejects.toThrow(/no permite/);
  });

  it("un editor cambia registros pero no invita ni exporta", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "editor");
    await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    const id = await t.run(async (ctx) => (await ctx.db.query("registrations").first())!._id);

    await expect(
      sesion.mutation(api.registros.cambiarEstado, { id, estado: "activo" }),
    ).resolves.toBeNull();
    await expect(
      sesion.mutation(api.usuarios.invitar, {
        correo: "otro@tec.mx",
        nombre: "Otro",
        rol: "lector",
      }),
    ).rejects.toThrow(/no permite/);
    await expect(sesion.query(api.registros.paraExportar, {})).rejects.toThrow(/no permite/);
  });

  it("una cuenta revocada pierde el acceso de inmediato", async () => {
    const t = convexTest(schema, modulos);
    const { userId, sesion } = await comoUsuario(t, "admin");
    await expect(sesion.query(api.registros.listar, {})).resolves.toBeDefined();

    await t.run(async (ctx) => ctx.db.patch(userId, { activo: false }));
    await expect(sesion.query(api.registros.listar, {})).rejects.toThrow(/Sesion no valida/);
  });

  it("el cambio de estado queda en la bitacora", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "editor");
    await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    const id = await t.run(async (ctx) => (await ctx.db.query("registrations").first())!._id);

    await sesion.mutation(api.registros.cambiarEstado, { id, estado: "contactado" });
    const bitacora = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(bitacora.some((l) => l.accion === "registro.estado")).toBe(true);
    expect(bitacora[0]?.actorCorreo).toBe("editor@tec.mx");
  });
});

describe("invitaciones", () => {
  it("el token en claro no se guarda y sirve una sola vez", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "admin");

    const { token } = await sesion.mutation(api.usuarios.invitar, {
      correo: "nueva@tec.mx",
      nombre: "Nueva",
      rol: "editor",
    });
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const guardadas = await t.run(async (ctx) => ctx.db.query("invites").collect());
    expect(guardadas[0]?.tokenHash).not.toBe(token);

    await expect(t.query(api.usuarios.verificarInvitacion, { token })).resolves.toMatchObject({
      correo: "nueva@tec.mx",
      rol: "editor",
    });

    // Una vez usada deja de valer.
    await t.run(async (ctx) => ctx.db.patch(guardadas[0]!._id, { usadaEn: Date.now() }));
    await expect(t.query(api.usuarios.verificarInvitacion, { token })).resolves.toBeNull();
  });

  it("una invitacion caducada o revocada no sirve", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "admin");

    const { token } = await sesion.mutation(api.usuarios.invitar, {
      correo: "tarde@tec.mx",
      nombre: "Tarde",
      rol: "lector",
    });
    const id = await t.run(async (ctx) => (await ctx.db.query("invites").first())!._id);
    await t.run(async (ctx) => ctx.db.patch(id, { expiraEn: Date.now() - 1000 }));
    await expect(t.query(api.usuarios.verificarInvitacion, { token })).resolves.toBeNull();
  });

  it("un token inventado no toca la base", async () => {
    const t = convexTest(schema, modulos);
    await expect(
      t.query(api.usuarios.verificarInvitacion, { token: "no-hexadecimal" }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.usuarios.verificarInvitacion, { token: "a".repeat(64) }),
    ).resolves.toBeNull();
  });

  it("revoca y retira invitaciones que quedaron copiadas en la bandeja", async () => {
    const t = convexTest(schema, modulos);
    const { userId } = await comoUsuario(t, "admin");
    const token = "b".repeat(64);
    const enlace = `https://alphaccm.org/dashboard/invitacion/${token}`;
    const ids = await t.run(async (ctx) => {
      const inviteId = await ctx.db.insert("invites", {
        correo: "pendiente@tec.mx",
        nombre: "Pendiente",
        rol: "editor",
        tokenHash: await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(token))
          .then((buffer) =>
            Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join(""),
          ),
        expiraEn: Date.now() + 60_000,
        creadaPor: userId,
        creadaEn: Date.now(),
      });
      const threadId = await ctx.db.insert("mailThreads", {
        asunto: "Tu acceso al panel de Alpha",
        asuntoClave: "tu acceso al panel de alpha",
        contactoCorreo: "pendiente@tec.mx",
        estado: "resuelto",
        noLeidos: 0,
        ultimoMensajeEn: Date.now(),
        ultimoResumen: enlace,
        asignadoA: userId,
        creadoEn: Date.now(),
        actualizadoEn: Date.now(),
      });
      const messageId = await ctx.db.insert("mailMessages", {
        threadId,
        direccion: "saliente",
        de: "auto@alphaccm.org",
        para: ["pendiente@tec.mx"],
        cc: [],
        asunto: "Tu acceso al panel de Alpha",
        texto: `Abre ${enlace}`,
        estado: "enviado",
        referencias: [],
        creadoEn: Date.now(),
      });
      return { inviteId, threadId, messageId };
    });

    await expect(
      t.mutation(internal.admin.remediarInvitacionesExpuestas, {}),
    ).resolves.toEqual({
      invitacionesRevocadas: 1,
      mensajesSaneados: 1,
      hilosSaneados: 1,
    });
    const estado = await t.run(async (ctx) => ({
      invitacion: await ctx.db.get(ids.inviteId),
      hilo: await ctx.db.get(ids.threadId),
      mensaje: await ctx.db.get(ids.messageId),
    }));
    expect(estado.invitacion?.revocadaEn).toBeTypeOf("number");
    expect(estado.mensaje?.texto).not.toContain(token);
    expect(estado.hilo?.ultimoResumen).not.toContain(token);

    await expect(
      t.mutation(internal.admin.remediarInvitacionesExpuestas, {}),
    ).resolves.toEqual({
      invitacionesRevocadas: 0,
      mensajesSaneados: 0,
      hilosSaneados: 0,
    });
  });

  it("no se puede invitar a alguien que ya tiene cuenta", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "admin");
    await expect(
      sesion.mutation(api.usuarios.invitar, {
        correo: "admin@tec.mx",
        nombre: "Duplicado",
        rol: "lector",
      }),
    ).rejects.toThrow(/ya tiene cuenta/);
  });
});

describe("personalizacion e Inicio del dashboard", () => {
  it("cada usuario guarda una sola configuracion personal del dashboard", async () => {
    const t = convexTest(schema, modulos);
    const { userId, sesion } = await comoUsuario(t, "lector");

    await expect(sesion.query(api.preferencias.obtener, {})).resolves.toEqual({
      guardadas: false,
      tema: "light",
      densidad: "comfortable",
      acento: "bright",
      barraContraida: false,
      graficasInicio: ["tendencia", "estados", "tipos", "areas"],
    });

    await sesion.mutation(api.preferencias.guardar, {
      tema: "dark",
      densidad: "compact",
      acento: "classic",
      barraContraida: true,
      graficasInicio: ["tendencia", "areas", "areas"],
    });
    await sesion.mutation(api.preferencias.guardar, { tema: "light" });

    await expect(sesion.query(api.preferencias.obtener, {})).resolves.toEqual({
      guardadas: true,
      tema: "light",
      densidad: "compact",
      acento: "classic",
      barraContraida: true,
      graficasInicio: ["tendencia", "areas"],
    });
    const filas = await t.run(async (ctx) =>
      ctx.db
        .query("dashboardPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(filas).toHaveLength(1);
  });

  it("Inicio entrega analitica de registros y ya no consulta actividad", async () => {
    const t = convexTest(schema, modulos);
    const { sesion } = await comoUsuario(t, "lector");
    await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    await t.action(api.ingesta.registrar, { secreto: SECRETO, datos: datosBase });
    await t.action(api.ingesta.registrar, {
      secreto: SECRETO,
      datos: {
        ...datosBase,
        tipo: "aliado",
        correo: "aliado@tec.mx",
        telefono: "5512345678",
        canales: { correo: false, whatsapp: false },
        areas: ["finanzas"],
      },
    });

    const inicio = await sesion.query(api.metricas.inicio, {});
    expect(inicio).not.toHaveProperty("actividad");
    expect(inicio.eventos).toContainEqual(
      expect.objectContaining({ slug: "calling-laf", fechaEvento: "2026-09-04" }),
    );
    expect(inicio.analitica.total).toBe(2);
    expect(inicio.analitica.porTipo).toEqual([
      { tipo: "miembro", total: 1 },
      { tipo: "aliado", total: 1 },
    ]);
    expect(inicio.analitica.porArea).toContainEqual({ area: "finanzas", total: 1 });
    expect(inicio.analitica.porSemana).toHaveLength(8);
  });
});

describe("cuentas del panel", () => {
  it("no se puede dejar el sistema sin administradores", async () => {
    const t = convexTest(schema, modulos);
    const { userId, sesion } = await comoUsuario(t, "admin");

    await expect(
      sesion.mutation(api.usuarios.cambiarRol, { id: userId, rol: "lector" }),
    ).rejects.toThrow(/a ti mismo/);

    const otro = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "otro@tec.mx",
        rol: "admin" as const,
        activo: false,
        creadoEn: Date.now(),
      }),
    );
    // El otro admin esta inactivo, asi que degradarlo tampoco puede dejar cero.
    await expect(
      sesion.mutation(api.usuarios.cambiarRol, { id: otro as Id<"users">, rol: "editor" }),
    ).resolves.toBeNull();
  });
});

describe("programa publico", () => {
  it("migra el catalogo a eventos sin duplicar Calling LAF ni Mario Kart", async () => {
    const t = convexTest(schema, modulos);
    const callingId = await t.action(api.ingestaEventos.asegurarCallingLaf, { secreto: SECRETO });
    const marioId = await t.action(api.ingestaEventos.asegurarMarioKart, { secreto: SECRETO });
    await t.run(async (ctx) => {
      await ctx.db.patch(callingId, {
        totalRegistros: 75,
        notasPrograma: "secreto interno",
        responsablePrograma: "Cynthia",
      });
      await ctx.db.insert("programs", {
        titulo: "Fila heredada",
        periodo: "2026",
        pilar: "comunidad",
        estado: "propuesto",
        orden: 1,
        publicado: true,
        creadoEn: Date.now(),
        actualizadoEn: Date.now(),
      });
    });

    await expect(t.mutation(internal.admin.migrarProgramaAEventos, {})).resolves.toEqual({
      creados: 13,
      actualizados: 2,
      legadosEliminados: 1,
      total: 15,
    });
    await expect(t.mutation(internal.admin.migrarProgramaAEventos, {})).resolves.toMatchObject({
      creados: 0,
      actualizados: 15,
      total: 15,
    });

    const contenido = await t.query(api.eventos.publicosLanding, {});
    expect(contenido.programas).toHaveLength(15);
    expect(contenido.programas.slice(0, 2)).toMatchObject([
      { slug: "calling-laf", rutaPublica: "/eventos/calling-laf", orden: 1 },
      { slug: "mario-kart", rutaPublica: "/events/mario-kart", orden: 2 },
    ]);
    expect(contenido.destacados.map((evento) => evento.slug)).toEqual([
      "calling-laf",
      "mario-kart",
    ]);
    for (const p of contenido.programas) {
      expect(p).not.toHaveProperty("notasPrograma");
      expect(p).not.toHaveProperty("responsablePrograma");
    }

    const estado = await t.run(async (ctx) => ({
      eventos: await ctx.db.query("events").collect(),
      programasLegados: await ctx.db.query("programs").collect(),
      calling: await ctx.db.get(callingId),
      mario: await ctx.db.get(marioId),
    }));
    expect(estado.eventos).toHaveLength(15);
    expect(estado.programasLegados).toHaveLength(0);
    expect(estado.calling?.totalRegistros).toBe(75);
    expect(estado.calling?._id).toBe(callingId);
    expect(estado.mario?._id).toBe(marioId);
  });

  it("los eventos migrados aparecen en la lista autenticada del dashboard", async () => {
    const t = convexTest(schema, modulos);
    await t.mutation(internal.admin.migrarProgramaAEventos, {});
    const lector = await comoUsuario(t, "lector");

    const eventos = await lector.sesion.query(api.eventos.listar, {});
    expect(eventos).toHaveLength(15);
    expect(eventos[0]).toMatchObject({ slug: "calling-laf", ordenPrograma: 1 });
    expect(eventos[1]).toMatchObject({ slug: "mario-kart", ordenPrograma: 2 });
  });
});
