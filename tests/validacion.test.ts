import { describe, expect, it } from "vitest";
import { aPayloadConvex, esquemaRegistro } from "@/lib/validacion";

/**
 * Validacion del formulario publico: lo que se acepta y, sobre todo, lo que no.
 */

const base = {
  tipo: "miembro" as const,
  nombre: "Mariela Reyes",
  correo: "a01234567@tec.mx",
  carrera: "LAF, 3.er semestre",
  token: "1700000000.abc.firma",
};

describe("campos obligatorios", () => {
  it("acepta un registro de miembro bien formado", () => {
    const r = esquemaRegistro.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.correo).toBe("a01234567@tec.mx");
      expect(r.data.areas).toEqual([]);
    }
  });

  it("normaliza el correo a minusculas y sin espacios", () => {
    const r = esquemaRegistro.safeParse({ ...base, correo: "  A01234567@TEC.MX  " });
    expect(r.success && r.data.correo).toBe("a01234567@tec.mx");
  });

  it("exige nombre y carrera con contenido real", () => {
    expect(esquemaRegistro.safeParse({ ...base, nombre: " " }).success).toBe(false);
    expect(esquemaRegistro.safeParse({ ...base, carrera: "" }).success).toBe(false);
  });

  it("rechaza correos fuera del dominio institucional", () => {
    expect(esquemaRegistro.safeParse({ ...base, correo: "alguien@gmail.com" }).success).toBe(false);
    expect(esquemaRegistro.safeParse({ ...base, correo: "ex@exatec.tec.mx" }).success).toBe(true);
  });

  it("rechaza un correo mal formado aunque acabe en el dominio", () => {
    expect(esquemaRegistro.safeParse({ ...base, correo: "sin-arroba.tec.mx" }).success).toBe(false);
  });
});

describe("reglas por tipo", () => {
  it("pide telefono si el miembro quiere el grupo de WhatsApp", () => {
    const sinTelefono = esquemaRegistro.safeParse({ ...base, whatsapp: true });
    expect(sinTelefono.success).toBe(false);

    const conTelefono = esquemaRegistro.safeParse({
      ...base,
      whatsapp: true,
      telefono: "55 1234 5678",
    });
    expect(conTelefono.success && conTelefono.data.telefono).toBe("5512345678");
  });

  it("solo admite areas de la lista cerrada", () => {
    const valido = esquemaRegistro.safeParse({
      ...base,
      tipo: "aliado",
      areas: ["finanzas", "comunicacion"],
    });
    expect(valido.success).toBe(true);

    const invalido = esquemaRegistro.safeParse({
      ...base,
      tipo: "aliado",
      areas: ["presidencia"],
    });
    expect(invalido.success).toBe(false);
  });

  it("valida el formato de matricula", () => {
    expect(esquemaRegistro.safeParse({ ...base, matricula: "A01234567" }).success).toBe(true);
    expect(esquemaRegistro.safeParse({ ...base, matricula: "" }).success).toBe(true);
    expect(esquemaRegistro.safeParse({ ...base, matricula: "12345" }).success).toBe(false);
  });
});

describe("defensas", () => {
  it("acepta el campo trampa en la validacion para poder fingir exito despues", () => {
    // El rechazo NO ocurre aqui a proposito: el route handler responde 200 sin
    // guardar nada, para no ensenarle al bot que fue detectado. Si esta
    // validacion fallara, el 400 lo delataria.
    const r = esquemaRegistro.safeParse({ ...base, sitio_web: "http://spam" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.sitio_web).toBe("http://spam");
  });

  it("exige token de formulario", () => {
    const { token: _token, ...sinToken } = base;
    expect(esquemaRegistro.safeParse(sinToken).success).toBe(false);
  });

  it("recorta el texto en lugar de aceptar cargas enormes", () => {
    const r = esquemaRegistro.safeParse({ ...base, nombre: "a".repeat(500) });
    expect(r.success && r.data.nombre.length).toBe(80);
  });

  it("no deja pasar etiquetas con guion bajo de Convex ni campos extra", () => {
    const r = esquemaRegistro.safeParse({ ...base, estado: "activo", _id: "trampa" });
    // Zod descarta lo que no esta declarado: el payload nunca lleva estado.
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data)).not.toContain("estado");
      expect(Object.keys(r.data)).not.toContain("_id");
    }
  });
});

describe("traduccion al payload de Convex", () => {
  it("un aliado no arrastra canales ni telefono", () => {
    const r = esquemaRegistro.safeParse({
      ...base,
      tipo: "aliado",
      whatsapp: true,
      telefono: "5512345678",
      areas: ["finanzas"],
      aporte: "Modelado en Excel",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;

    const payload = aPayloadConvex(r.data, { ipHash: "h", userAgent: "ua" });
    expect(payload.canales).toEqual({ correo: false, whatsapp: false });
    expect(payload).not.toHaveProperty("telefono");
    expect(payload.areas).toEqual(["finanzas"]);
    expect(payload.aporte).toBe("Modelado en Excel");
  });

  it("un miembro no arrastra areas ni aporte", () => {
    const r = esquemaRegistro.safeParse({
      ...base,
      avisosCorreo: true,
      areas: ["finanzas"],
      aporte: "algo",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;

    const payload = aPayloadConvex(r.data, { ipHash: "h", userAgent: "ua" });
    expect(payload.areas).toEqual([]);
    expect(payload).not.toHaveProperty("aporte");
    expect(payload.canales.correo).toBe(true);
  });
});
