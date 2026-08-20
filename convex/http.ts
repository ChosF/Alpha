import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * Rutas HTTP de Convex. Solo se exponen las de Convex Auth; la ingesta del
 * formulario publico NO pasa por aqui, entra por una action con secreto.
 */
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
