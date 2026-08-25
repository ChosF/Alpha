import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { aPayloadEventoConvex, esquemaRegistroEvento, primerError } from "@/lib/validacion";
import { hashDeIp, ipDePeticion, secretoDeIngesta, verificarToken } from "@/lib/seguridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMO_BYTES = 8 * 1024;

export async function POST(
  peticion: Request,
  contexto: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const generico = { error: "No pudimos guardar tu registro. Intenta de nuevo." };

  try {
    if (peticion.headers.get("content-type")?.includes("application/json") !== true) {
      return NextResponse.json({ error: "Formato no admitido." }, { status: 415 });
    }
    const crudo = await peticion.text();
    if (crudo.length > MAXIMO_BYTES) {
      return NextResponse.json({ error: "Envio demasiado grande." }, { status: 413 });
    }

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ error: "Envio mal formado." }, { status: 400 });
    }

    const analisis = esquemaRegistroEvento.safeParse(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: primerError(analisis.error) }, { status: 400 });
    }
    const datos = analisis.data;
    const ipHash = hashDeIp(ipDePeticion(peticion.headers));

    if (datos.sitio_web !== "") {
      console.warn("evento/registro: campo trampa lleno", { ipHash });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const token = verificarToken(datos.token, ipHash);
    if (!token.valido) {
      console.warn("evento/registro: token rechazado", { motivo: token.motivo, ipHash });
      const mensaje =
        token.motivo === "rapido"
          ? "Tomate un momento para revisar tus datos y vuelve a enviar."
          : "Tu sesion del formulario caduco. Recarga la pagina e intenta de nuevo.";
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return NextResponse.json(generico, { status: 503 });

    const { slug } = await contexto.params;
    const cliente = new ConvexHttpClient(url);
    const resultado = await cliente.action(api.ingestaEventos.registrar, {
      secreto: secretoDeIngesta(),
      slug,
      datos: aPayloadEventoConvex(datos, {
        ipHash,
        userAgent: peticion.headers.get("user-agent") ?? "",
      }),
    });

    if (!resultado.ok) {
      if (resultado.motivo === "cerrado") {
        return NextResponse.json(
          { error: "El registro para este evento no esta disponible." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Ya recibimos varios registros con ese correo. Escribenos si necesitas ayuda." },
        { status: 429 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("evento/registro:", error);
    return NextResponse.json(generico, { status: 500 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ error: "Metodo no permitido." }, { status: 405 });
}
