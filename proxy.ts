import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { destinoDashboard } from "./lib/destino-dashboard";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const convexOrigins = convexUrl
  ? `${convexUrl} ${convexUrl.replace(/^https:/, "wss:")}`
  : "";

function prepararCsp(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const permiteEvaluacion = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const politica = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${permiteEvaluacion}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${convexOrigins}`.trim(),
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", politica);
  return { headers, politica };
}

function conCsp(response: NextResponse, politica: string) {
  response.headers.set("Content-Security-Policy", politica);
  return response;
}

/**
  * Todo /dashboard exige sesion, salvo la pantalla de acceso y el alta por
 * invitacion. La comprobacion ocurre antes de renderizar nada, asi que ni
 * siquiera el esqueleto del panel llega a un visitante sin sesion.
 */
const esPublica = createRouteMatcher(["/dashboard/acceso", "/dashboard/invitacion(.*)"]);
const esPanel = createRouteMatcher(["/dashboard(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { headers, politica } = prepararCsp(request);

  // Next page searchParams can discard an empty key. Read the original QR
  // query before routing so /registro/id?=<id> survives unchanged.
  if (request.nextUrl.pathname === "/registro/id") {
    const codigo = new URL(request.url).searchParams.get("");
    const destino = destinoDashboard(`/dashboard/boletos?id=${encodeURIComponent(codigo ?? "")}`);
    return conCsp(nextjsMiddlewareRedirect(request, destino), politica);
  }

  if (esPanel(request) && !esPublica(request) && !(await convexAuth.isAuthenticated())) {
    const destino = destinoDashboard(request.nextUrl.pathname + request.nextUrl.search);
    const acceso = destino.startsWith("/dashboard/boletos")
      ? `/dashboard/acceso?next=${encodeURIComponent(destino)}` : "/dashboard/acceso";
    return conCsp(nextjsMiddlewareRedirect(request, acceso), politica);
  }
  if (esPublica(request) && (await convexAuth.isAuthenticated()) && request.nextUrl.pathname === "/dashboard/acceso") {
    return conCsp(nextjsMiddlewareRedirect(request, destinoDashboard(request.nextUrl.searchParams.get("next"))), politica);
  }

  return conCsp(NextResponse.next({ request: { headers } }), politica);
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/auth/:path*", "/registro/id"],
};
