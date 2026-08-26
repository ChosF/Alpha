import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { aPayloadConvex, esquemaRegistro, primerError } from "@/lib/validacion";
import { hashDeIp, ipDePeticion, secretoDeIngesta, verificarToken } from "@/lib/seguridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuerpo maximo aceptado. Un registro legitimo no llega ni a 2 KB. */
const MAXIMO_BYTES = 8 * 1024;

/**
 * Unica puerta de entrada del formulario publico.
 *
 * Orden deliberado: primero lo barato (tamano, tipo de contenido, trampa,
 * token) y al final lo caro (validacion completa y escritura). Asi un bot que
 * insiste consume lo minimo.
 *
 * La respuesta es siempre igual de escueta: al que envia no se le dice si el
 * correo ya existia, si el token fallo por firma o por tiempo, ni cuantos
 * intentos le quedan. Los detalles quedan en los logs del servidor.
 */
export async function POST(peticion: Request): Promise<NextResponse> {
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

    const ipHash = hashDeIp(ipDePeticion(peticion.headers));

    const analisis = esquemaRegistro.safeParse(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: primerError(analisis.error) }, { status: 400 });
    }
    const datos = analisis.data;

    // El campo trampa ya lo valida el esquema (max 0), pero se comprueba
    // aparte para poder responder como si todo hubiera salido bien: al bot no
    // se le avisa que cayo en la trampa.
    if (datos.sitio_web !== "") {
      console.warn("registro: campo trampa lleno", { ipHash });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const token = verificarToken(datos.token, ipHash);
    if (!token.valido) {
      console.warn("registro: token rechazado", { motivo: token.motivo, ipHash });
      const mensaje =
        token.motivo === "rapido"
          ? "Tomate un momento para revisar tus datos y vuelve a enviar."
          : "Tu sesion del formulario caduco. Recarga la pagina e intenta de nuevo.";
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (typeof url !== "string" || url === "") {
      console.error("registro: falta NEXT_PUBLIC_CONVEX_URL");
      return NextResponse.json(generico, { status: 503 });
    }

    const cliente = new ConvexHttpClient(url);
    const resultado = await cliente.action(api.ingesta.registrar, {
      secreto: secretoDeIngesta(),
      datos: aPayloadConvex(datos, {
        ipHash,
        userAgent: peticion.headers.get("user-agent") ?? "",
      }),
    });

    if (!resultado.ok) {
      if (resultado.motivo?.startsWith("area_cerrada:") === true) {
        return NextResponse.json(
          { error: "Una de las áreas que elegiste ya tiene cupo lleno. Selecciona otra." },
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
    // El detalle no sale al cliente: se queda en los registros de Vercel.
    console.error("registro:", error);
    return NextResponse.json(generico, { status: 500 });
  }
}

/** Cualquier otro metodo se rechaza explicitamente. */
export function GET(): NextResponse {
  return NextResponse.json({ error: "Metodo no permitido." }, { status: 405 });
}
