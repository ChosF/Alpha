import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return Response.json({ error: "Convex no está configurado." }, { status: 503 });
  }

  try {
    const cliente = new ConvexHttpClient(url);
    const contenido = await cliente.query(api.eventos.publicosLanding, {});
    return Response.json(contenido, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("programa-publico: no se pudo consultar Convex", error);
    return Response.json({ error: "No se pudo cargar el programa." }, { status: 502 });
  }
}
