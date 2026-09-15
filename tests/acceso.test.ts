import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn: vi.fn() }) }));
import Acceso from "@/app/dashboard/acceso/page";

async function pagina(next?: string | string[]) {
  const element = await Acceso({ searchParams: Promise.resolve({ next }) });
  return { destino: element.props.destino, html: renderToStaticMarkup(element) };
}

describe("acceso contextual", () => {
  it("presenta el dashboard sin instrucciones de boletos", async () => {
    const { destino, html } = await pagina();
    expect(destino).toBe("/dashboard");
    expect(html).toContain("INICIAR SESIÓN");
    expect(html).not.toContain("Muestra tu QR");
  });
  it("explica quién debe entrar y conserva el boleto", async () => {
    const { destino, html } = await pagina("/dashboard/boletos?id=abc123");
    expect(destino).toBe("/dashboard/boletos?id=abc123");
    expect(html).toContain("ACCESO DEL STAFF");
    expect(html).toContain("Inicia sesión solo si eres administrador o parte del staff de Alpha.");
    expect(html).toContain("no necesitas iniciar sesión");
    expect(html).toContain("Entrar como staff");
  });
  it.each(["https://evil.example/dashboard/boletos", "//evil.example/dashboard/boletos", ["/dashboard/boletos", "https://evil.example"]])("descarta retornos externos o ambiguos: %s", async next => {
    const { destino, html } = await pagina(next);
    expect(destino).toBe("/dashboard");
    expect(html).not.toContain("ACCESO DEL STAFF");
  });
});
