import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMO_BYTES = 8 * 1024;
const OPINIONES = new Set(["excelente", "bueno", "regular", "malo"]);
const ORIGENES = new Set(["instagram", "whatsapp", "correo"]);

function clienteConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

function respuesta(datos: unknown, status = 200) {
  return NextResponse.json(datos, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(
  _peticion: Request,
  contexto: { params: Promise<{ token: string }> },
) {
  const cliente = clienteConvex();
  if (!cliente) return respuesta({ error: "La encuesta no está disponible." }, 503);
  try {
    const { token } = await contexto.params;
    const encuesta = await cliente.query(api.encuestas.obtener, { token });
    return respuesta(encuesta);
  } catch (error) {
    console.error("encuesta/consulta:", error);
    return respuesta({ error: "No pudimos abrir la encuesta. Intenta de nuevo." }, 500);
  }
}

export async function POST(
  peticion: Request,
  contexto: { params: Promise<{ token: string }> },
) {
  if (peticion.headers.get("content-type")?.includes("application/json") !== true) {
    return respuesta({ error: "Formato no admitido." }, 415);
  }
  const crudo = await peticion.text();
  if (crudo.length > MAXIMO_BYTES) {
    return respuesta({ error: "La respuesta es demasiado grande." }, 413);
  }

  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return respuesta({ error: "La respuesta no tiene un formato válido." }, 400);
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return respuesta({ error: "Completa las preguntas obligatorias." }, 400);
  }
  const entrada = datos as Record<string, unknown>;
  const calificacionEvento = entrada.calificacionEvento;
  const opinionContenido = entrada.opinionContenido;
  const origen = entrada.origen;
  const comentarios = entrada.comentarios;
  if (
    !Number.isInteger(calificacionEvento) ||
    (calificacionEvento as number) < 1 ||
    (calificacionEvento as number) > 5 ||
    typeof opinionContenido !== "string" ||
    !OPINIONES.has(opinionContenido) ||
    typeof origen !== "string" ||
    !ORIGENES.has(origen) ||
    (comentarios !== undefined && typeof comentarios !== "string")
  ) {
    return respuesta({ error: "Completa las preguntas obligatorias." }, 400);
  }

  const cliente = clienteConvex();
  if (!cliente) return respuesta({ error: "La encuesta no está disponible." }, 503);
  try {
    const { token } = await contexto.params;
    const resultado = await cliente.mutation(api.encuestas.responder, {
      token,
      calificacionEvento: calificacionEvento as number,
      opinionContenido: opinionContenido as "excelente" | "bueno" | "regular" | "malo",
      origen: origen as "instagram" | "whatsapp" | "correo",
      ...(typeof comentarios === "string" ? { comentarios } : {}),
    });
    return respuesta({ ok: true, yaRespondida: resultado.estado === "respondida" });
  } catch (error) {
    console.error("encuesta/respuesta:", error);
    return respuesta({ error: "Este enlace ya no acepta respuestas." }, 409);
  }
}
