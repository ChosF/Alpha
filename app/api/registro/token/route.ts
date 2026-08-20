import { NextResponse } from "next/server";
import { emitirToken, hashDeIp, ipDePeticion } from "@/lib/seguridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emite el token firmado que la ventana de registro adjunta al enviar.
 *
 * Se pide cuando la persona abre la ventana. Al ir firmado con el secreto del
 * servidor y atado al hash de su IP, no se puede fabricar desde fuera, y su
 * marca de tiempo permite exigir un minimo de segundos de llenado sin confiar
 * en el reloj del navegador.
 */
export function GET(peticion: Request): NextResponse {
  try {
    const ipHash = hashDeIp(ipDePeticion(peticion.headers));
    return NextResponse.json(
      { token: emitirToken(ipHash) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("registro/token:", error);
    return NextResponse.json({ error: "No disponible." }, { status: 503 });
  }
}
