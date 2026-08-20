"use node";

import { Resend } from "resend";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const MAX_INTENTOS = 5;
const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ADJUNTOS_BYTES = 18 * 1024 * 1024;

function cabecera(
  headers: Record<string, string> | null,
  nombre: string,
): string | undefined {
  if (!headers) return undefined;
  const objetivo = nombre.toLowerCase();
  for (const [clave, valor] of Object.entries(headers)) {
    if (clave.toLowerCase() === objetivo) return valor;
  }
  return undefined;
}

function referenciasDesde(headers: Record<string, string> | null): string[] {
  const valor = cabecera(headers, "references") ?? "";
  return valor.match(/<[^<>]+>/g)?.slice(-20) ?? [];
}

function textoDesdeHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const procesarEntrada = internalAction({
  args: { jobId: v.id("mailInboundJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trabajo = await ctx.runQuery(internal.correo.obtenerTrabajo, { jobId: args.jobId });
    if (!trabajo || trabajo.estado === "completado" || trabajo.estado === "fallido") return null;

    const reservado = await ctx.runMutation(internal.correo.marcarTrabajoProcesando, {
      jobId: args.jobId,
    });
    if (!reservado) return null;

    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error("RESEND_API_KEY no esta configurada en Convex.");
      const cliente = new Resend(apiKey);
      const respuesta = await cliente.emails.receiving.get(trabajo.providerEmailId, {
        html_format: "cid",
      });
      if (respuesta.error || !respuesta.data) {
        throw new Error(respuesta.error?.message ?? "Resend no devolvio el correo entrante.");
      }

      const correo = respuesta.data;
      const respuestaAdjuntos = await cliente.emails.receiving.attachments.list({
        emailId: trabajo.providerEmailId,
        limit: 100,
      });
      if (respuestaAdjuntos.error || !respuestaAdjuntos.data) {
        throw new Error(
          respuestaAdjuntos.error?.message ?? "Resend no devolvio la lista de adjuntos.",
        );
      }

      let totalGuardado = 0;
      const omitidos: string[] = [];
      const adjuntos: Array<{
        storageId: Awaited<ReturnType<typeof ctx.storage.store>>;
        providerAttachmentId: string;
        nombre: string;
        tipoContenido: string;
        tamano: number;
      }> = [];

      for (const adjunto of respuestaAdjuntos.data.data) {
        const nombre = adjunto.filename || "adjunto";
        if (
          adjunto.size > MAX_ADJUNTO_BYTES ||
          totalGuardado + adjunto.size > MAX_TOTAL_ADJUNTOS_BYTES
        ) {
          omitidos.push(`${nombre} (${adjunto.size} bytes)`);
          continue;
        }
        const descarga = await fetch(adjunto.download_url);
        if (!descarga.ok) {
          omitidos.push(`${nombre} (no se pudo descargar)`);
          continue;
        }
        const contenido = await descarga.arrayBuffer();
        const storageId = await ctx.storage.store(
          new Blob([contenido], { type: adjunto.content_type }),
        );
        totalGuardado += contenido.byteLength;
        adjuntos.push({
          storageId,
          providerAttachmentId: adjunto.id,
          nombre,
          tipoContenido: adjunto.content_type,
          tamano: contenido.byteLength,
        });
      }

      const base = correo.text?.trim() || textoDesdeHtml(correo.html ?? "");
      const avisoOmitidos = omitidos.length
        ? `\n\n[Adjuntos no guardados por tamano o descarga: ${omitidos.join(", ")}]`
        : "";
      await ctx.runMutation(internal.correo.guardarEntrada, {
        jobId: args.jobId,
        texto: `${base || "Mensaje sin contenido de texto."}${avisoOmitidos}`,
        inReplyTo: cabecera(correo.headers, "in-reply-to"),
        referencias: referenciasDesde(correo.headers),
        adjuntos,
      });
    } catch (error) {
      const intento = trabajo.intentos + 1;
      const terminal = intento >= MAX_INTENTOS;
      await ctx.runMutation(internal.correo.registrarFalloEntrada, {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
        terminal,
      });
      if (!terminal) {
        const espera = Math.min(15 * 60 * 1000, 15_000 * 2 ** Math.max(0, intento - 1));
        await ctx.scheduler.runAfter(espera, internal.correoActions.procesarEntrada, {
          jobId: args.jobId,
        });
      }
    }
    return null;
  },
});
