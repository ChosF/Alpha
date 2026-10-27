import QRCode from "qrcode";
import { enlaceAsistenciaRegistro } from "@/lib/registro-asistencia";

export const runtime = "nodejs";

/**
 * QR del boleto como imagen pública para los correos: muchos clientes no
 * muestran imágenes incrustadas por cid. El QR solo codifica el enlace de
 * asistencia del registro, que no revela datos personales.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
): Promise<Response> {
  const { archivo } = await params;
  const id = /^([0-9a-z]{16,64})\.png$/.exec(archivo)?.[1];
  if (!id) return new Response("No encontrado.", { status: 404 });

  const sitio = process.env.SITE_URL?.replace(/\/$/, "") ?? new URL(peticion.url).origin;
  const png = await QRCode.toBuffer(enlaceAsistenciaRegistro(sitio, id), {
    type: "png",
    width: 640,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#020612", light: "#FFFFFFFF" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
