import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import QRCode from "qrcode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NETWORKING_NIGHT } from "@/lib/networking-night";
import { enlaceAsistenciaRegistro } from "@/lib/registro-asistencia";
import { esquemaRegistroNetworkingNight, primerError } from "@/lib/validacion";
import { hashDeIp, ipDePeticion, secretoDeIngesta, verificarToken } from "@/lib/seguridad";
import { sitioPublico } from "@/lib/sitio-publico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMO_BYTES = 8 * 1024;

/**
 * Registro de Networking Night. Un registro nuevo devuelve el boleto con su
 * QR para mostrarlo y descargarlo en la página. Un correo ya registrado solo
 * recibe el boleto en su buzón: así nadie obtiene el QR de otra persona.
 */
export async function POST(peticion: Request): Promise<NextResponse> {
  const generico = { error: "No pudimos guardar tu registro. Intenta de nuevo." };

  try {
    if (peticion.headers.get("content-type")?.includes("application/json") !== true) {
      return NextResponse.json({ error: "Formato no admitido." }, { status: 415 });
    }
    const crudo = await peticion.text();
    if (crudo.length > MAXIMO_BYTES) {
      return NextResponse.json({ error: "Envío demasiado grande." }, { status: 413 });
    }

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ error: "Envío mal formado." }, { status: 400 });
    }

    const analisis = esquemaRegistroNetworkingNight.safeParse(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: primerError(analisis.error) }, { status: 400 });
    }
    const datos = analisis.data;
    const ipHash = hashDeIp(ipDePeticion(peticion.headers));

    if (datos.sitio_web !== "") {
      console.warn("n-night/registro: campo trampa lleno", { ipHash });
      return NextResponse.json({ ok: true, creado: false, correoEnviado: true }, { status: 200 });
    }

    const token = verificarToken(datos.token, ipHash);
    if (!token.valido) {
      console.warn("n-night/registro: token rechazado", { motivo: token.motivo, ipHash });
      return NextResponse.json(
        {
          error:
            token.motivo === "rapido"
              ? "Tómate un momento para revisar tus datos y vuelve a enviar."
              : "Tu sesión del formulario caducó. Intenta de nuevo.",
          token: token.motivo === "rapido" ? undefined : "renovar",
        },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const sitio = sitioPublico(peticion);
    if (!url) return NextResponse.json(generico, { status: 503 });

    const cliente = new ConvexHttpClient(url);
    const resultado = await cliente.action(api.ingestaEventos.registrarNetworkingNight, {
      secreto: secretoDeIngesta(),
      datos: {
        nombre: datos.nombre,
        correo: datos.correo,
        matricula: datos.matricula,
        carrera: datos.carrera,
        semestre: datos.semestre,
        intereses: datos.intereses,
        habilidades: datos.habilidades.filter(Boolean),
        ...(datos.cvStorageId ? { cvStorageId: datos.cvStorageId as Id<"_storage"> } : {}),
        metodoPago: datos.metodoPago,
        ipHash,
        userAgent: peticion.headers.get("user-agent") ?? "",
      },
    });

    if (!resultado.ok) {
      const [mensaje, estado] =
        resultado.motivo === "cerrado"
          ? ["El registro para Networking Night no está disponible.", 409]
          : resultado.motivo === "cv"
            ? ["Tu CV debe ser un PDF de máximo 5 MB. Vuelve a subirlo o continúa sin él.", 400]
            : resultado.motivo === "datos"
              ? ["Revisa tus datos e intenta de nuevo.", 400]
              : ["Recibimos varios intentos seguidos. Espera unos minutos y vuelve a intentar.", 429];
      return NextResponse.json({ error: mensaje }, { status: estado });
    }

    if (!resultado.creado || !resultado.registroId) {
      return NextResponse.json({ ok: true, creado: false, correoEnviado: resultado.correoEnviado === true });
    }

    const registroId = String(resultado.registroId);
    const qr = await QRCode.toDataURL(enlaceAsistenciaRegistro(sitio, registroId), {
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0D2140", light: "#FFFFFFFF" },
    });

    return NextResponse.json({
      ok: true,
      creado: true,
      correoEnviado: resultado.correoEnviado === true,
      boleto: {
        nombre: resultado.nombre ?? datos.nombre,
        folio: `NN-${registroId.slice(-6).toUpperCase()}`,
        qr,
        pago: resultado.pago ?? { metodo: "efectivo", estado: "pendiente", montoMxn: NETWORKING_NIGHT.cuotaMxn },
      },
    });
  } catch (error) {
    console.error("n-night/registro:", error);
    return NextResponse.json(generico, { status: 500 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ error: "Método no permitido." }, { status: 405 });
}
