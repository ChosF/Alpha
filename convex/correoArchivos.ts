import { getAuthUserId } from "@convex-dev/auth/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const IMAGENES_SEGURAS = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function nombreAscii(nombre: string): string {
  const limpio = nombre
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\\r\n]/g, "_")
    .trim();
  return limpio || "archivo";
}

export const descargarAdjunto = httpAction(async (ctx, request) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return new Response("Sesion requerida", { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const adjunto = await ctx.runQuery(internal.correo.obtenerAdjuntoDescarga, {
    actorId: userId as Id<"users">,
    id,
  });
  if (!adjunto) return new Response("Archivo no disponible", { status: 404 });

  const archivo = await ctx.storage.get(adjunto.storageId);
  if (!archivo) return new Response("Archivo no disponible", { status: 404 });

  const tipo = IMAGENES_SEGURAS.has(adjunto.tipoContenido)
    ? adjunto.tipoContenido
    : "application/octet-stream";
  const disposicion = IMAGENES_SEGURAS.has(adjunto.tipoContenido) ? "inline" : "attachment";
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": tipo,
    "Content-Length": String(archivo.size),
    "Content-Disposition": `${disposicion}; filename="${nombreAscii(adjunto.nombre)}"; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
    "X-Content-Type-Options": "nosniff",
  });
  return new Response(archivo, { headers });
});
