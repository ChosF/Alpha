import { afterEach, describe, expect, it, vi } from "vitest";
import { sitioPublico } from "@/lib/sitio-publico";

const peticion = new Request("https://www.alphaccm.org/api/boletos/qr/abc.png");

afterEach(() => vi.unstubAllEnvs());

describe("sitioPublico", () => {
  it("usa SITE_URL cuando es una URL válida", () => {
    vi.stubEnv("SITE_URL", "https://alphaccm.org/");
    expect(sitioPublico(peticion)).toBe("https://alphaccm.org");
  });

  it("cae al origen de la petición si SITE_URL está vacía o sin protocolo", () => {
    for (const valor of ["", "   ", "www.alphaccm.org"]) {
      vi.stubEnv("SITE_URL", valor);
      expect(sitioPublico(peticion)).toBe("https://www.alphaccm.org");
    }
  });
});
