import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hashDeIp, ipDePeticion, secretoDeIngesta, verificarToken } from "@/lib/seguridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const tokenSeguro = z.string().regex(/^[a-f0-9]{64}$/);
const esquema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("participar"), token: z.string(), sitio_web: z.string().max(200).default(""), correo: z.email().max(120), equipoId: z.string().max(64).optional(), invitacion: tokenSeguro.optional(), nombreEquipo: z.string().trim().min(2).max(50).optional(), privado: z.boolean().optional(), persona: z.object({ nombre: z.string().trim().min(2).max(80), carrera: z.string().trim().min(2).max(80), semestre: z.string().trim().min(1).max(30), matricula: z.string().trim().toUpperCase().regex(/^A[0-9]{8}$/) }).optional() }),
  z.object({ accion: z.literal("solicitud"), codigo: tokenSeguro }),
  z.object({ accion: z.literal("responder"), codigo: tokenSeguro, aceptar: z.boolean() }),
  z.object({ accion: z.literal("listar"), invitacion: tokenSeguro.optional() }),
]);

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Formato no admitido." }, { status: 415 });
    const raw = await request.text();
    if (raw.length > 8192) return Response.json({ error: "Envío demasiado grande." }, { status: 413 });
    const datos = esquema.safeParse(JSON.parse(raw));
    if (!datos.success) return Response.json({ error: "Revisa los datos del formulario." }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return Response.json({ error: "El torneo no está disponible. Intenta más tarde." }, { status: 503 });
    const cliente = new ConvexHttpClient(url);
    const d = datos.data;
    let resultado;
    if (d.accion === "listar") resultado = await cliente.query(api.equiposMarioKart.listar, { invitacion: d.invitacion });
    else if (d.accion === "solicitud") resultado = await cliente.query(api.equiposMarioKart.solicitud, { token: d.codigo });
    else if (d.accion === "responder") resultado = await cliente.mutation(api.equiposMarioKart.responder, { token: d.codigo, aceptar: d.aceptar });
    else {
      const ipHash = hashDeIp(ipDePeticion(request.headers));
      if (d.sitio_web) return Response.json({ estado: "pendiente", mensaje: "Solicitud recibida." });
      if (!verificarToken(d.token, ipHash).valido) return Response.json({ error: "Vuelve a intentar en unos segundos. Si el problema continúa, cierra y abre el formulario." }, { status: 400 });
      resultado = await cliente.mutation(api.equiposMarioKart.participar, { secreto: secretoDeIngesta(), ipHash, userAgent: request.headers.get("user-agent") ?? "", correo: d.correo, equipoId: d.equipoId as Id<"tournamentTeams"> | undefined, invitacion: d.invitacion, nombreEquipo: d.nombreEquipo, privado: d.privado, persona: d.persona, nuevoToken: randomBytes(32).toString("hex") });
    }
    return Response.json(resultado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mensaje = error instanceof ConvexError && typeof error.data === "string" ? error.data : "No se pudo completar. Revisa tu conexión e intenta de nuevo.";
    return Response.json({ error: mensaje }, { status: error instanceof ConvexError ? 409 : 500 });
  }
}
