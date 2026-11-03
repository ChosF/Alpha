// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";
import {
  cuerpoConfirmacionNetworkingNight,
  cuerpoRechazoNetworkingNight,
  cuerpoSolicitudNetworkingNight,
  textoConfirmacionNetworkingNight,
} from "@/convex/correo";
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

async function staff(t: ReturnType<typeof preparar>, rol: "editor" | "admin" = "editor") {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: `${rol}@example.com`, name: "Staff", rol, activo: true, creadoEn: Date.now() }),
  );
  return t.withIdentity({ subject: `${userId}|sesion` });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Networking Night", () => {
  it("el panel manda sobre una fila existente: no la reabre ni le cambia datos", async () => {
    const t = preparar();
    const eventId = await t.run((ctx) =>
      ctx.db.insert("events", {
        slug: NETWORKING_NIGHT.slug, titulo: "Networking Night", resumen: "Editado en el panel", pilar: "industria",
        fechaEvento: "2026-11-06", sede: "Otra sede", estado: "publicado", registroAbierto: false, totalRegistros: 0,
        periodoPrograma: "4 de Noviembre", estadoPrograma: "planeacion", creadoEn: Date.now(), actualizadoEn: Date.now(),
      }),
    );

    expect(await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos })).toEqual({
      ok: false, motivo: "cerrado",
    });
    await (await staff(t)).mutation(api.eventos.cambiarRegistroAbierto, { eventId, abierto: true });
    const abierto = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    expect(abierto).toMatchObject({ ok: true, creado: true });
    expect(await eventoNetworkingNight(t)).toMatchObject({
      resumen: "Editado en el panel", fechaEvento: "2026-11-06", sede: "Otra sede",
      periodoPrograma: "4 de Noviembre", registroAbierto: true, totalRegistros: 1,
    });
  });

  it("crea el evento sin promoverlo en la landing y guarda perfil y cuota en efectivo", async () => {
    const t = preparar();
    const resultado = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    expect(resultado).toMatchObject({
      ok: true,
      creado: true,
      resultado: "boleto",
      tipo: "estudiante",
      nombre: datos.nombre,
      correoEnviado: false,
    });
    expect(resultado.pago).toEqual({ metodo: "efectivo", estado: "pendiente", montoMxn: 70 });

    const evento = await eventoNetworkingNight(t);
    expect(evento).toMatchObject({
      estado: "publicado", registroAbierto: true, fechaEvento: "2026-11-05", horaInicio: "17:00",
      horaFin: "19:30", totalRegistros: 1,
    });
    expect(evento?.rutaPublica).toBeUndefined();

    const registro = await t.run((ctx) => ctx.db.get(resultado.registroId!));
    expect(registro).toMatchObject({
      tipoAsistente: "estudiante",
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
    expect(segundo).toEqual({ ok: true, creado: false, resultado: "boleto", correoEnviado: false });

    const evento = await eventoNetworkingNight(t);
    await t.run((ctx) => ctx.db.patch(evento!._id, { registroAbierto: false }));
    const cerrado = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO, datos: { ...datos, correo: "a07654321@tec.mx", matricula: "A07654321", ipHash: "ip-3" },
    });
    expect(cerrado).toEqual({ ok: false, motivo: "cerrado" });
  });

  it("un registro repetido no reenvía el boleto antes de 30 minutos", async () => {
    const t = preparar();
    const guardar = () => t.mutation(internal.ingestaEventos.guardarNetworkingNight, { datos });
    const nuevo = await guardar();
    expect(nuevo).toMatchObject({ creado: true, enviarBoleto: true });
    vi.setSystemTime(new Date("2026-10-27T18:29:00Z"));
    expect(await guardar()).toMatchObject({ creado: false, enviarBoleto: false });
    vi.setSystemTime(new Date("2026-10-27T18:31:00Z"));
    expect(await guardar()).toMatchObject({ creado: false, enviarBoleto: true });

    await t.mutation(internal.ingestaEventos.liberarEnvioBoletoNetworkingNight, { registroId: nuevo.registroId! });
    expect((await t.run((ctx) => ctx.db.get(nuevo.registroId!)))?.boletoEnviadoEn).toBeUndefined();
  });

  it("rechaza datos inválidos, el secreto incorrecto y el registro genérico", async () => {
    const t = preparar();
    expect(await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos: { ...datos, correo: "ana@gmail.com" } })).toMatchObject({ ok: true, creado: true });
    for (const cambio of [{ correo: "correo-invalido" }, { correo: "ana@sin-dominio" }, { matricula: "12345" }, { semestre: "12" }]) {
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
    expect(escaneo).toMatchObject({
      estado: "valido",
      tipo: "estudiante",
      pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 },
    });
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

  it("el panel cobra al marcar asistencia, corrige pagos a mano y cobra en puerta", async () => {
    const t = preparar();
    const uno = await t.action(api.ingestaEventos.registrarNetworkingNight, { secreto: SECRETO, datos });
    const dos = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO, datos: { ...datos, correo: "a07654321@tec.mx", matricula: "A07654321", ipHash: "ip-2" },
    });
    const evento = (await eventoNetworkingNight(t))!;
    const sesion = await staff(t);

    await sesion.mutation(api.eventos.cambiarEstadoRegistro, { id: uno.registroId!, estado: "asistio" });
    expect((await t.run((ctx) => ctx.db.get(uno.registroId!)))?.pago).toMatchObject({ metodo: "efectivo", estado: "pagado" });

    await sesion.mutation(api.eventos.cambiarPagoRegistro, { id: dos.registroId!, pagado: true });
    await sesion.mutation(api.eventos.cambiarPagoRegistro, { id: dos.registroId!, pagado: false });
    expect((await t.run((ctx) => ctx.db.get(dos.registroId!)))?.pago).toEqual({ metodo: "efectivo", estado: "pendiente", montoMxn: 70 });

    const puerta = await sesion.mutation(api.eventos.registrarAsistenteEnPuerta, {
      eventId: evento._id, nombre: "Sin registro", matricula: "", correo: "a09999999@tec.mx", semestre: "", carrera: "",
    });
    expect((await t.run((ctx) => ctx.db.get(puerta.id)))?.pago).toMatchObject({ metodo: "efectivo", estado: "pagado", montoMxn: 70 });

    expect(await sesion.query(api.eventos.resumenPagos, { eventId: evento._id })).toEqual({
      pagados: 2, pendientes: 1, enLinea: 0, cobradoMxn: 140,
    });
    expect(await sesion.query(api.eventos.urlCvRegistro, { id: uno.registroId! })).toBeNull();

    await t.mutation(internal.ingestaEventos.confirmarPagoEnLineaNetworkingNight, { registroId: dos.registroId!, montoMxn: 70 });
    await expect(sesion.mutation(api.eventos.cambiarPagoRegistro, { id: dos.registroId!, pagado: false })).rejects.toThrow(/Stripe/);
  });

  it("valida ponentes en el servidor: emite boleto al primer reclamo y manda a revisión duplicados o no listados", async () => {
    const t = preparar();
    // 1. Ponente canónico válido -> boleto inmediato, sin pago
    const maritza = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "ponente",
        nombre: "Maritza Lara Aguillón",
        correo: "maritza@mercadolibre.com",
        ponenteId: "maritza-lara",
        ipHash: "ip-p1",
        userAgent: "vitest",
      },
    });
    expect(maritza).toMatchObject({
      ok: true,
      creado: true,
      resultado: "boleto",
      tipo: "ponente",
    });
    expect(maritza.registroId).toBeDefined();
    expect(maritza.pago).toBeUndefined();

    // 2. Otra persona intenta reclamar el mismo ponenteId -> va a revisión manual, sin exponer registroId
    const impostor = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "ponente",
        nombre: "Maritza Lara Aguillón",
        correo: "otro@correo.com",
        ponenteId: "maritza-lara",
        ipHash: "ip-p2",
        userAgent: "vitest",
      },
    });
    expect(impostor).toMatchObject({
      ok: true,
      creado: true,
      resultado: "revision",
      tipo: "ponente",
    });
    expect(impostor.registroId).toBeUndefined();

    // 3. Ponente no listado ("otro") -> va a revisión manual
    const otroPonente = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "ponente",
        nombre: "Roberto Garza",
        correo: "roberto@firma.com",
        ponenteId: "otro",
        ipHash: "ip-p3",
        userAgent: "vitest",
      },
    });
    expect(otroPonente).toMatchObject({
      ok: true,
      creado: true,
      resultado: "revision",
      tipo: "ponente",
    });
    expect(otroPonente.registroId).toBeUndefined();
  });

  it("exige CV para Exatec, bloquea escaneo mientras está en revisión y permite aprobar, rechazar o convertir a Aliados/Exatecs", async () => {
    const t = preparar();
    const cvStorageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["%PDF-1.4 fake cv"], { type: "application/pdf" }));
      await (ctx.db as unknown as { patch: (id: unknown, valor: unknown) => Promise<void> }).patch(
        id,
        { contentType: "application/pdf" },
      );
      return id;
    });

    // Exatec sin CV falla validación en Convex
    expect(
      await t.action(api.ingestaEventos.registrarNetworkingNight, {
        secreto: SECRETO,
        datos: {
          tipo: "exatec",
          nombre: "Luis Exatec",
          correo: "luis@exatec.tec.mx",
          generacion: "2020",
          carrera: "LAF",
          ipHash: "ip-ex1",
          userAgent: "vitest",
        },
      }),
    ).toEqual({ ok: false, motivo: "cv" });

    // Exatec con CV queda en revisión manual
    const exatec = await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "exatec",
        nombre: "Luis Exatec",
        correo: "luis@exatec.tec.mx",
        generacion: "2020",
        carrera: "LAF",
        empresa: "BlackRock",
        puesto: "VP",
        cvStorageId,
        ipHash: "ip-ex2",
        userAgent: "vitest",
      },
    });
    expect(exatec).toMatchObject({
      ok: true,
      creado: true,
      resultado: "revision",
      tipo: "exatec",
    });
    expect(exatec.registroId).toBeUndefined();

    // Sembrar padrón de integrantes: un Aliado real y un Miembro regular
    await t.run(async (ctx) => {
      await ctx.db.insert("registrations", {
        tipo: "aliado",
        nombre: "Sofía Aliada",
        correo: "sofia.aliada@tec.mx",
        carrera: "LAF",
        semestre: "6",
        matricula: "A01112222",
        canales: { correo: false, whatsapp: false },
        telefono: "5512345678",
        areas: ["finanzas"],
        estado: "activo",
        origen: "web",
        ipHash: "h1",
        userAgent: "vitest",
        creadoEn: Date.now(),
        actualizadoEn: Date.now(),
      });
      await ctx.db.insert("registrations", {
        tipo: "miembro",
        nombre: "Pedro Miembro",
        correo: "pedro.miembro@tec.mx",
        carrera: "LAF",
        semestre: "4",
        matricula: "A03334444",
        canales: { correo: true, whatsapp: false },
        areas: [],
        estado: "activo",
        origen: "web",
        ipHash: "h2",
        userAgent: "vitest",
        creadoEn: Date.now(),
        actualizadoEn: Date.now(),
      });
    });

    // Aliado real y Miembro regular se registran como "aliado"
    await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "aliado",
        nombre: "Sofía Aliada",
        correo: "sofia.aliada@tec.mx",
        matricula: "A01112222",
        semestre: "6",
        carrera: "LAF",
        area: "finanzas",
        ipHash: "ip-al1",
        userAgent: "vitest",
      },
    });
    await t.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: SECRETO,
      datos: {
        tipo: "aliado",
        nombre: "Pedro Miembro",
        correo: "pedro.miembro@tec.mx",
        matricula: "A03334444",
        semestre: "4",
        carrera: "LAF",
        area: "comunicacion",
        ipHash: "ip-al2",
        userAgent: "vitest",
      },
    });

    const sesionEditor = await staff(t, "editor");
    const evento = (await eventoNetworkingNight(t))!;

    const resumen = await sesionEditor.query(api.verificaciones.resumen, { eventId: evento._id });
    expect(resumen).toEqual({
      pendientes: 3,
      aprobadas: 0,
      rechazadas: 0,
      cortesias: 0,
      porTipo: { estudiante: 0, exatec: 1, ponente: 0, aliado: 2 },
    });

    const filas = await sesionEditor.query(api.eventos.listarRegistros, { eventId: evento._id });
    const filaExatec = filas.find((f) => f.correo === "luis@exatec.tec.mx")!;
    const filaSofia = filas.find((f) => f.correo === "sofia.aliada@tec.mx")!;
    const filaPedro = filas.find((f) => f.correo === "pedro.miembro@tec.mx")!;

    // Mientras está en revisión, el escáner QR bloquea el ingreso con estado "en_revision"
    expect(await sesionEditor.query(api.boletos.validar, { codigo: filaExatec._id })).toMatchObject({
      estado: "en_revision",
      tipo: "exatec",
    });
    expect(await sesionEditor.mutation(api.boletos.confirmar, { codigo: filaExatec._id })).toMatchObject({
      estado: "en_revision",
    });

    // Cruce con padrón distingue Aliado (Cortesía) de Miembro (Paga $70)
    const padronSofia = await sesionEditor.query(api.verificaciones.buscarEnPadron, { id: filaSofia._id });
    expect(padronSofia[0]).toMatchObject({
      correo: "sofia.aliada@tec.mx",
      tipo: "aliado",
    });
    const padronPedro = await sesionEditor.query(api.verificaciones.buscarEnPadron, { id: filaPedro._id });
    expect(padronPedro[0]).toMatchObject({
      correo: "pedro.miembro@tec.mx",
      tipo: "miembro",
    });

    // Editor aprueba a Sofía (Aliada) y a Luis (Exatec)
    await sesionEditor.mutation(api.verificaciones.resolver, { id: filaSofia._id, decision: "aprobar" });
    await sesionEditor.mutation(api.verificaciones.resolver, { id: filaExatec._id, decision: "aprobar" });

    // Editor convierte a Pedro (Miembro regular) en estudiante con cuota de $70 MXN
    await sesionEditor.mutation(api.verificaciones.resolver, {
      id: filaPedro._id,
      decision: "convertir_estudiante",
    });

    const pedroActualizado = await t.run((ctx) => ctx.db.get(filaPedro._id));
    expect(pedroActualizado).toMatchObject({
      tipoAsistente: "estudiante",
      pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 },
      verificacion: { estado: "aprobada" },
    });

    // Ahora Luis Exatec sí puede ingresar con QR sin cobro en puerta
    vi.setSystemTime(new Date("2026-11-05T23:30:00Z"));
    const confirmadoExatec = await sesionEditor.mutation(api.boletos.confirmar, { codigo: filaExatec._id });
    expect(confirmadoExatec).toMatchObject({
      estado: "utilizado",
      tipo: "exatec",
    });
    expect(confirmadoExatec.pago).toBeUndefined();
  });

  it("el correo cambia según la cuota y el tipo de registro", () => {
    const base = { nombre: "Ana Pérez", correo: "a01234567@tec.mx", registroId: "j97abc123xyz" };
    const sitio = "https://www.alphaccm.org";
    const efectivo = cuerpoConfirmacionNetworkingNight({ ...base, pago: { metodo: "efectivo", estado: "pendiente", montoMxn: 70 } }, sitio);
    const enLinea = cuerpoConfirmacionNetworkingNight({ ...base, pago: { metodo: "stripe", estado: "pagado", montoMxn: 70 } }, sitio);
    const textoEnLinea = textoConfirmacionNetworkingNight({ ...base, pago: { metodo: "stripe", estado: "pagado", montoMxn: 70 } }, sitio);
    const cortesiaPonente = cuerpoConfirmacionNetworkingNight({ ...base, tipo: "ponente" }, sitio);
    const solicitudExatec = cuerpoSolicitudNetworkingNight({ nombre: "Luis Exatec", correo: "luis@exatec.tec.mx", tipo: "exatec" }, sitio);
    const rechazoAliado = cuerpoRechazoNetworkingNight({ nombre: "Pedro", tipo: "aliado" }, sitio);

    expect(efectivo).toContain("Lleva $70 MXN en efectivo");
    expect(efectivo).toContain("Si la cuota cambia");
    expect(enLinea).toContain("Tu cuota ya está pagada");
    expect(enLinea).not.toContain("Lleva $70 MXN en efectivo");
    expect(enLinea).not.toContain("Si la cuota cambia");
    expect(textoEnLinea).toContain("Cuota: $70 MXN, pagada en línea");
    expect(efectivo).toContain('src="https://www.alphaccm.org/api/boletos/qr/j97abc123xyz.png"');
    expect(efectivo).not.toContain("cid:");
    expect(efectivo).toContain("NN-123XYZ");
    expect(efectivo).not.toMatch(/—/);

    expect(cortesiaPonente).toContain("Cortesía");
    expect(cortesiaPonente).toContain("PONENTE · GAFETE DORADO");
    expect(solicitudExatec).toContain("Estamos verificando tu perfil");
    expect(rechazoAliado).toContain("registrarte como estudiante");
  });
});
