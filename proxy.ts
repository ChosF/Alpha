import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

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

  if (esPanel(request) && !esPublica(request) && !(await convexAuth.isAuthenticated())) {
    return conCsp(nextjsMiddlewareRedirect(request, "/dashboard/acceso"), politica);
  }
  if (esPublica(request) && (await convexAuth.isAuthenticated()) && request.nextUrl.pathname === "/dashboard/acceso") {
    return conCsp(nextjsMiddlewareRedirect(request, "/dashboard"), politica);
  }

  return conCsp(NextResponse.next({ request: { headers } }), politica);
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/auth/:path*"],
};
