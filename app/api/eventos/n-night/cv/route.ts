import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { hashDeIp, ipDePeticion, secretoDeIngesta, verificarToken } from "@/lib/seguridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esquema = z.object({ token: z.string().min(10).max(512) });

/**
 * El CV no pasa por Vercel (su límite de cuerpo es menor que el del archivo):
 * esta ruta entrega una URL de subida de Convex y el navegador sube el PDF
 * directo. Convex revisa tipo y tamaño al guardar el registro.
 */
export async function POST(peticion: Request): Promise<NextResponse> {
  try {
    const crudo = await peticion.text();
    if (crudo.length > 1024) return NextResponse.json({ error: "Envío demasiado grande." }, { status: 413 });
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ error: "Envío mal formado." }, { status: 400 });
    }
    const analisis = esquema.safeParse(cuerpo);
    if (!analisis.success) return NextResponse.json({ error: "Envío mal formado." }, { status: 400 });

    const ipHash = hashDeIp(ipDePeticion(peticion.headers));
    const token = verificarToken(analisis.data.token, ipHash);
    if (!token.valido && token.motivo !== "rapido") {
      return NextResponse.json({ error: "Tu sesión del formulario caducó.", token: "renovar" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return NextResponse.json({ error: "No disponible." }, { status: 503 });
    const resultado = await new ConvexHttpClient(url).action(api.ingestaEventos.urlSubidaCvNetworkingNight, {
      secreto: secretoDeIngesta(),
      ipHash,
    });
    if (!resultado.ok) {
      return NextResponse.json({ error: "Subiste varios archivos seguidos. Espera unos minutos." }, { status: 429 });
    }
    return NextResponse.json({ url: resultado.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("n-night/cv:", error);
    return NextResponse.json({ error: "No pudimos preparar la subida de tu CV." }, { status: 500 });
  }
}
