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
  it("la consulta abierta no expone notas ni responsable", async () => {
    const t = convexTest(schema, modulos);
    await t.mutation(internal.admin.sembrarProgramas, {});
    await t.run(async (ctx) => {
      const fila = await ctx.db.query("programs").first();
      await ctx.db.patch(fila!._id, { notas: "secreto interno", responsable: "Cynthia" });
    });

    const publicos = await t.query(api.programas.publicos, {});
    expect(publicos.length).toBeGreaterThan(0);
    for (const p of publicos) {
      expect(p).not.toHaveProperty("notas");
      expect(p).not.toHaveProperty("responsable");
    }
  });
});
