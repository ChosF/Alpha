import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NETWORKING_NIGHT } from "@/lib/networking-night";

/**
 * La fila de Networking Night en Convex no tiene `rutaPublica`, así que
 * `publicosLanding` no la incluye en `destacados`. Mientras eso no cambie,
 * la agregamos aquí desde `lib/networking-night.ts` para que el banner de la
 * landing la promueva. La landing ya la oculta sola cuando el evento termina.
 */
function conNetworkingNight<T extends { destacados: Array<{ slug: string }> }>(contenido: T): T {
  if (contenido.destacados.some((evento) => evento.slug === NETWORKING_NIGHT.slug)) return contenido;
  const destacado = {
    slug: NETWORKING_NIGHT.slug,
    titulo: NETWORKING_NIGHT.titulo,
    fechaEvento: NETWORKING_NIGHT.fechaIso,
    horaInicio: NETWORKING_NIGHT.horaInicio,
    horaFin: NETWORKING_NIGHT.horaFin,
    sede: NETWORKING_NIGHT.sede,
    rutaPublica: NETWORKING_NIGHT.ruta,
  };
  return {
    ...contenido,
    destacados: [...contenido.destacados, destacado].sort((a, b) =>
      String((a as { fechaEvento?: string }).fechaEvento ?? "").localeCompare(String((b as { fechaEvento?: string }).fechaEvento ?? "")),
    ),
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return Response.json({ error: "Convex no está configurado." }, { status: 503 });
  }

  try {
    const cliente = new ConvexHttpClient(url);
    const contenido = await cliente.query(api.eventos.publicosLanding, {});
    return Response.json(conNetworkingNight(contenido), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("programa-publico: no se pudo consultar Convex", error);
    return Response.json({ error: "No se pudo cargar el programa." }, { status: 502 });
  }
}
