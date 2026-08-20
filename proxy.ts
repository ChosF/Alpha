import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
  * Todo /dashboard exige sesion, salvo la pantalla de acceso y el alta por
 * invitacion. La comprobacion ocurre antes de renderizar nada, asi que ni
 * siquiera el esqueleto del panel llega a un visitante sin sesion.
 */
const esPublica = createRouteMatcher(["/dashboard/acceso", "/dashboard/invitacion(.*)"]);
const esPanel = createRouteMatcher(["/dashboard(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (esPanel(request) && !esPublica(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard/acceso");
  }
  if (esPublica(request) && (await convexAuth.isAuthenticated()) && request.nextUrl.pathname === "/dashboard/acceso") {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
  return undefined;
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/auth/:path*"],
};
