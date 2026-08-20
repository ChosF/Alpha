import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
  * Todo /panel exige sesion, salvo la pantalla de acceso y el alta por
 * invitacion. La comprobacion ocurre antes de renderizar nada, asi que ni
 * siquiera el esqueleto del panel llega a un visitante sin sesion.
 */
const esPublica = createRouteMatcher(["/panel/acceso", "/panel/invitacion(.*)"]);
const esPanel = createRouteMatcher(["/panel(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (esPanel(request) && !esPublica(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/panel/acceso");
  }
  if (esPublica(request) && (await convexAuth.isAuthenticated()) && request.nextUrl.pathname === "/panel/acceso") {
    return nextjsMiddlewareRedirect(request, "/panel");
  }
  return undefined;
});

export const config = {
  matcher: ["/panel/:path*", "/api/auth/:path*"],
};
