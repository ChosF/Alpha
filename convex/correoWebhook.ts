import { Webhook } from "svix";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resend } from "./correo";

type EventoEntrante = {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    message_id: string;
  };
};

function esEventoEntrante(valor: unknown): valor is EventoEntrante {
  if (!valor || typeof valor !== "object") return false;
  const evento = valor as Record<string, unknown>;
  if (evento.type !== "email.received" || !evento.data || typeof evento.data !== "object") {
    return false;
  }
  const data = evento.data as Record<string, unknown>;
  return (
    typeof evento.created_at === "string" &&
    typeof data.email_id === "string" &&
    typeof data.created_at === "string" &&
    typeof data.from === "string" &&
    Array.isArray(data.to) &&
    data.to.every((correo) => typeof correo === "string") &&
    typeof data.subject === "string" &&
    typeof data.message_id === "string"
  );
}

function cabecerasSvix(request: Request) {
  return {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };
}

function correoPlano(valor: string): string {
  const entreAngulos = valor.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (entreAngulos?.[1] ?? valor).trim().toLowerCase();
}

export const manejarResend = httpAction(async (ctx, request) => {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) return new Response("Webhook no configurado", { status: 503 });

  const raw = await request.text();
  let evento: unknown;
  try {
    evento = new Webhook(secreto).verify(raw, cabecerasSvix(request));
  } catch {
    return new Response("Firma no valida", { status: 401 });
  }

  if (esEventoEntrante(evento)) {
    const destino = (process.env.ALPHA_CONTACT_EMAIL ?? "contacto@alphaccm.org").toLowerCase();
    const corresponde = evento.data.to.some((correo) => correoPlano(correo) === destino);
    if (!corresponde) return new Response(null, { status: 204 });

    const recibidoEn = Date.parse(evento.data.created_at || evento.created_at);
    await ctx.runMutation(internal.correo.registrarEntrada, {
      eventId: request.headers.get("svix-id") ?? evento.data.email_id,
      providerEmailId: evento.data.email_id,
      de: evento.data.from,
      para: evento.data.to,
      cc: Array.isArray(evento.data.cc) ? evento.data.cc : [],
      asunto: evento.data.subject,
      internetMessageId: evento.data.message_id,
      recibidoEn: Number.isFinite(recibidoEn) ? recibidoEn : Date.now(),
    });
    return new Response(null, { status: 201 });
  }

  if (
    evento &&
    typeof evento === "object" &&
    typeof (evento as { type?: unknown }).type === "string" &&
    (evento as { type: string }).type.startsWith("email.")
  ) {
    const reconstruida = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: raw,
    });
    return await resend.handleResendEventWebhook(ctx, reconstruida);
  }

  return new Response(null, { status: 204 });
});
