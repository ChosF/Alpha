// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";
import { cuerpoConfirmacionNetworkingNight, textoConfirmacionNetworkingNight } from "@/convex/correo";
import { NETWORKING_NIGHT } from "@/lib/networking-night";

const modulos = import.meta.glob("../convex/**/*.ts");
const SECRETO = "secreto-de-prueba-networking-night";

const datos = {
  nombre: "Ana Pérez Ruiz",
  correo: "a01234567@tec.mx",
  matricula: "A01234567",
  carrera: "LAF",
  semestre: "5",
  intereses: ["Banca", "Fintech", "Inventado"],
  habilidades: ["Excel", "excel", "Python"],
  metodoPago: "efectivo" as const,
  ipHash: "ip-1",
  userAgent: "vitest",
};

function preparar() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T18:00:00Z"));
  vi.stubEnv("INGEST_SECRET", SECRETO);
  return convexTest(schema, modulos);
}

async function eventoNetworkingNight(t: ReturnType<typeof preparar>) {
  return t.run((ctx) =>
    ctx.db.query("events").withIndex("by_slug", (q) => q.eq("slug", NETWORKING_NIGHT.slug)).unique(),
  );
}

async function staff(t: ReturnType<typeof preparar>) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "staff@example.com", name: "Staff", rol: "editor", activo: true, creadoEn: Date.now() }),
  );
  return t.withIdentity({ subject: `${userId}|sesion` });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Networking Night", () => {
  it("abre la fila del programa sin promoverla en la landing y guarda perfil y cuota en efectivo", async () => {
    const t = preparar();
    await t.run((ctx) =>
      ctx.db.insert("events", {
        slug: NETWORKING_NIGHT.slug, titulo: "Networking Night", resumen: "", pilar: "industria",
        estado: "borrador", registroAbierto: false, totalRegistros: 0, periodoPrograma: "4 de Noviembre",
        estadoPrograma: "planeacion", creadoEn: Date.now(), actualizadoEn: Date.now(),
      }),
    );

    const resultado = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    expect(resultado).toMatchObject({ ok: true, creado: true, nombre: datos.nombre, correoEnviado: false });
    expect(resultado.pago).toEqual({ metodo: "efectivo", estado: "pendiente", montoMxn: 70 });

    const evento = await eventoNetworkingNight(t);
    expect(evento).toMatchObject({
      estado: "publicado", registroAbierto: true, fechaEvento: "2026-11-05", horaInicio: "17:00",
      horaFin: "21:00", periodoPrograma: "5 de Noviembre", totalRegistros: 1,
    });
    expect(evento?.rutaPublica).toBeUndefined();

    const registro = await t.run((ctx) => ctx.db.get(resultado.registroId!));
    expect(registro).toMatchObject({
      matricula: "A01234567",
      perfil: { intereses: ["Banca", "Fintech"], habilidades: ["Excel", "Python"] },
      pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 },
    });
  });

  it("no devuelve el boleto de un correo ya registrado y respeta el cierre del panel", async () => {
    const t = preparar();
    const primero = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    const segundo = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO, datos: { ...datos, nombre: "Otra persona", ipHash: "ip-2" },
    });
    expect(primero.registroId).toBeDefined();
    expect(segundo).toEqual({ ok: true, creado: false, correoEnviado: false });

    const evento = await eventoNetworkingNight(t);
    await t.run((ctx) => ctx.db.patch(evento!._id, { registroAbierto: false }));
    const cerrado = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO, datos: { ...datos, correo: "a07654321@tec.mx", matricula: "A07654321", ipHash: "ip-3" },
    });
    expect(cerrado).toEqual({ ok: false, motivo: "cerrado" });
  });

  it("rechaza datos inválidos, el secreto incorrecto y el registro genérico", async () => {
    const t = preparar();
    for (const cambio of [{ correo: "ana@gmail.com" }, { matricula: "12345" }, { semestre: "12" }]) {
      expect(
        await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos: { ...datos, ...cambio } }),
      ).toEqual({ ok: false, motivo: "datos" });
    }
    await expect(
      t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: "otro", datos }),
    ).rejects.toThrow();
    const generico = await t.action(api.ingestaEventos.registrar, {
      secreto: SECRETO, slug: NETWORKING_NIGHT.slug,
      datos: { nombre: datos.nombre, correo: datos.correo, carrera: "LAF", semestre: "5", canales: { correo: true, whatsapp: false }, ipHash: "ip-4", userAgent: "vitest" },
    });
    expect(generico).toMatchObject({ ok: false, motivo: "cerrado" });
  });

  it("cobra en efectivo al confirmar el ingreso", async () => {
    const t = preparar();
    const { registroId } = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    vi.setSystemTime(new Date("2026-11-05T23:30:00Z"));
    const sesion = await staff(t);

    const escaneo = await sesion.query(api.boletos.validar, { codigo: registroId! });
    expect(escaneo).toMatchObject({ estado: "valido", pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 } });
    const confirmado = await sesion.mutation(api.boletos.confirmar, { codigo: registroId! });
    expect(confirmado).toMatchObject({ estado: "utilizado", pago: { metodo: "efectivo", estado: "pagado" } });
    expect(await t.run((ctx) => ctx.db.get(registroId!))).toMatchObject({
      estado: "asistio", pago: { metodo: "efectivo", estado: "pagado", pagadoEn: Date.now() },
    });
  });

  it("un pago en línea confirmado no pide efectivo y uno sin confirmar se cobra en la entrada", async () => {
    const t = preparar();
    const pagado = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    const pendiente = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO, datos: { ...datos, correo: "a07654321@tec.mx", matricula: "A07654321", ipHash: "ip-2" },
    });

    expect(await t.mutation(internal.ingestaEventos.confirmarPagoEnLineaNetworkingNight, { registroId: pagado.registroId!, montoMxn: 50 })).toBe(false);
    expect(await t.mutation(internal.ingestaEventos.confirmarPagoEnLineaNetworkingNight, { registroId: pagado.registroId!, montoMxn: 70 })).toBe(true);
    expect(await t.mutation(internal.ingestaEventos.confirmarPagoEnLineaNetworkingNight, { registroId: pagado.registroId!, montoMxn: 70 })).toBe(false);
    await t.run((ctx) => ctx.db.patch(pendiente.registroId!, { pago: { metodo: "stripe", estado: "pendiente", montoMxn: 70 } }));

    vi.setSystemTime(new Date("2026-11-05T23:30:00Z"));
    const sesion = await staff(t);
    await sesion.mutation(api.boletos.confirmar, { codigo: pagado.registroId! });
    expect((await t.run((ctx) => ctx.db.get(pagado.registroId!)))?.pago).toMatchObject({ metodo: "stripe", estado: "pagado" });

    await sesion.mutation(api.boletos.confirmar, { codigo: pendiente.registroId! });
    expect((await t.run((ctx) => ctx.db.get(pendiente.registroId!)))?.pago).toMatchObject({ metodo: "efectivo", estado: "pagado" });
    const bitacora = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(bitacora.map((entrada) => entrada.detalle)).toEqual([
      "Asistencia confirmada con boleto QR",
      "Asistencia confirmada con boleto QR; cobro en efectivo de $70 MXN",
    ]);
  });

  it("el correo cambia según la cuota", () => {
    const base = { nombre: "Ana Pérez", correo: "a01234567@tec.mx", registroId: "j97abc123xyz" };
    const sitio = "https://www.alphaccm.org";
    const efectivo = cuerpoConfirmacionNetworkingNight({ ...base, pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 } }, sitio);
    const enLinea = cuerpoConfirmacionNetworkingNight({ ...base, pago: { metodo: "stripe", estado: "pagado", montoMxn: 70 } }, sitio);
    const textoEnLinea = textoConfirmacionNetworkingNight({ ...base, pago: { metodo: "stripe", estado: "pagado", montoMxn: 70 } }, sitio);

    expect(efectivo).toContain("Lleva $70 MXN en efectivo");
    expect(efectivo).toContain("Si la cuota cambia");
    expect(enLinea).toContain("Tu cuota ya está pagada");
    expect(enLinea).not.toContain("Lleva $70 MXN en efectivo");
    expect(enLinea).not.toContain("Si la cuota cambia");
    expect(textoEnLinea).toContain("Cuota: $70 MXN, pagada en línea");
    expect(efectivo).toContain("NN-123XYZ");
    expect(efectivo).not.toMatch(/—/);
  });
});
