import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Pruebas de las defensas del borde publico.
 *
 * Cada bloque corresponde a un ataque concreto, no a una funcion: es la unica
 * forma de que la prueba siga significando algo cuando el codigo se mueva.
 */

// Los secretos se fijan antes de importar: los modulos los exigen al usarlos.
beforeAll(() => {
  process.env.INGEST_SECRET = "s".repeat(64);
  process.env.IP_SALT = "p".repeat(64);
});

describe("saneado de texto", () => {
  it("quita caracteres de control y marcas invisibles", async () => {
    const { limpiarTexto } = await import("@/convex/lib/texto");
    const sucio = `Mar${String.fromCharCode(0)}iela${String.fromCharCode(0x200b)}`;
    expect(limpiarTexto(sucio, 80)).toBe("Mariela");
  });

  it("colapsa espacios y recorta al maximo", async () => {
    const { limpiarTexto } = await import("@/convex/lib/texto");
    expect(limpiarTexto("  Juan   Pablo  ", 80)).toBe("Juan Pablo");
    expect(limpiarTexto("abcdefghij", 4)).toBe("abcd");
  });

  it("conserva los saltos de linea en campos multilinea", async () => {
    const { limpiarMultilinea } = await import("@/convex/lib/texto");
    expect(limpiarMultilinea("uno\n\n\n\ndos", 100)).toBe("uno\n\ndos");
  });

  it("normaliza correo y telefono a su forma canonica", async () => {
    const { normalizarCorreo, normalizarTelefono } = await import("@/convex/lib/texto");
    expect(normalizarCorreo("  A01234567@TEC.MX ")).toBe("a01234567@tec.mx");
    expect(normalizarTelefono("+52 (55) 1234-5678")).toBe("5512345678");
  });
});

describe("comparacion de secretos", () => {
  it("acepta el valor exacto y rechaza cualquier variacion", async () => {
    const { comparaSegura } = await import("@/convex/lib/texto");
    expect(comparaSegura("secreto", "secreto")).toBe(true);
    expect(comparaSegura("secreto", "secretO")).toBe(false);
    expect(comparaSegura("secreto", "secreto ")).toBe(false);
    expect(comparaSegura("", "")).toBe(true);
  });
});

describe("token del formulario", () => {
  it("acepta el token propio pasado el tiempo minimo", async () => {
    const { emitirToken, verificarToken, TOKEN_MIN_MS } = await import("@/lib/seguridad");
    const token = emitirToken("hash-de-ip");

    // Recien emitido se rechaza: nadie llena el formulario en cero segundos.
    expect(verificarToken(token, "hash-de-ip")).toEqual({ valido: false, motivo: "rapido" });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + TOKEN_MIN_MS + 1000);
    expect(verificarToken(token, "hash-de-ip")).toEqual({ valido: true });
    vi.useRealTimers();
  });

  it("rechaza un token de otra IP", async () => {
    const { emitirToken, verificarToken, TOKEN_MIN_MS } = await import("@/lib/seguridad");
    const token = emitirToken("ip-a");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + TOKEN_MIN_MS + 1000);
    expect(verificarToken(token, "ip-b")).toEqual({ valido: false, motivo: "firma" });
    vi.useRealTimers();
  });

  it("rechaza un token manipulado y uno caduco", async () => {
    const { emitirToken, verificarToken, TOKEN_MAX_MS } = await import("@/lib/seguridad");
    const token = emitirToken("ip");
    const partes = token.split(".");

    expect(verificarToken(`${partes[0]}.${partes[1]}.firmaFalsa`, "ip")).toEqual({
      valido: false,
      motivo: "firma",
    });
    expect(verificarToken("no-es-un-token", "ip")).toEqual({ valido: false, motivo: "formato" });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + TOKEN_MAX_MS + 1000);
    expect(verificarToken(token, "ip")).toEqual({ valido: false, motivo: "caduco" });
    vi.useRealTimers();
  });
});

describe("hash de IP", () => {
  it("es estable, no reversible a simple vista y depende de la sal", async () => {
    const { hashDeIp } = await import("@/lib/seguridad");
    const a = hashDeIp("187.190.1.1");
    expect(a).toHaveLength(64);
    expect(a).not.toContain("187.190");
    expect(hashDeIp("187.190.1.1")).toBe(a);
    expect(hashDeIp("187.190.1.2")).not.toBe(a);
  });
});

describe("politica de contrasenas", () => {
  it("exige largo, variedad y rechaza las comunes", async () => {
    const { validarContrasena } = await import("@/convex/lib/contrasena");
    expect(validarContrasena("corta1!A")).toContain("al menos 12");
    expect(validarContrasena("todoenminusculas")).toContain("tres de");
    expect(validarContrasena("contrasena123")).toContain("comun");
    expect(validarContrasena("aaaaaaaaaaaaaa")).not.toBeNull();
    expect(validarContrasena("Alpha-Finanzas-2026!")).toBeNull();
  });
});
