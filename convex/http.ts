import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { manejarResend } from "./correoWebhook";
import { descargarAdjunto } from "./correoArchivos";

/**
 * Rutas HTTP de Convex. Solo se exponen las de Convex Auth; la ingesta del
 * formulario publico NO pasa por aqui, entra por una action con secreto.
 */
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/resend-webhook", method: "POST", handler: manejarResend });
http.route({ path: "/correo-adjunto", method: "GET", handler: descargarAdjunto });

export default http;
