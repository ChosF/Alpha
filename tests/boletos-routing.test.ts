import { describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

vi.mock("@convex-dev/auth/nextjs/server", async () => {
  const { NextResponse } = await import("next/server");
  return {
    convexAuthNextjsMiddleware: (handler: unknown) => handler,
    createRouteMatcher: (paths: string[]) => (request: NextRequest) =>
      paths.some(path => new RegExp(`^${path}$`).test(request.nextUrl.pathname)),
    nextjsMiddlewareRedirect: (request: NextRequest, destination: string) =>
      NextResponse.redirect(new URL(destination, request.url)),
  };
});
import proxy from "@/proxy";

const route = proxy as unknown as (req: NextRequest, ctx: {
  convexAuth: { isAuthenticated: () => Promise<boolean> };
}) => Promise<NextResponse>;
async function redirigir(path: string, authenticated = false) {
  const response = await route(new NextRequest(`https://www.alphaccm.org${path}`), {
    convexAuth: { isAuthenticated: async () => authenticated },
  });
  return response.headers.get("location");
}
describe("rutas de boletos", () => {
  it("preserva la clave vacía del QR original y el retorno del login", async () => {
    const ticket = await redirigir("/registro/id?=abc123");
    expect(ticket).toBe("https://www.alphaccm.org/dashboard/boletos?id=abc123");
    const login = await redirigir(new URL(ticket!).pathname + new URL(ticket!).search);
    expect(new URL(login!).searchParams.get("next")).toBe("/dashboard/boletos?id=abc123");
    expect(await redirigir(new URL(login!).pathname + new URL(login!).search, true)).toBe(ticket);
  });
  it("no permite redirigir a otro sitio después del login", async () => {
    expect(await redirigir("/dashboard/acceso?next=https://evil.example", true)).toBe("https://www.alphaccm.org/dashboard");
  });
});
