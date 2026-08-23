import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

export const dynamic = "force-dynamic";

function urlConvexSite(): string | null {
  const configurada = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!configurada) return null;
  const url = new URL(configurada);
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  return url.origin;
}

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ id: string }> },
) {
  const [token, { id }] = await Promise.all([convexAuthNextjsToken(), contexto.params]);
  if (!token) return new Response("Sesion requerida", { status: 401 });

  const sitio = urlConvexSite();
  if (!sitio) return new Response("Convex no esta configurado", { status: 503 });

  const respuesta = await fetch(`${sitio}/correo-adjunto?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!respuesta.ok || !respuesta.body) {
    return new Response(respuesta.status === 401 ? "Sesion requerida" : "Archivo no disponible", {
      status: respuesta.status === 401 ? 401 : 404,
    });
  }

  const headers = new Headers();
  for (const nombre of [
    "content-type",
    "content-length",
    "content-disposition",
    "x-content-type-options",
  ]) {
    const valor = respuesta.headers.get(nombre);
    if (valor) headers.set(nombre, valor);
  }
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return new Response(respuesta.body, { status: 200, headers });
}
