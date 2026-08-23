import { ConvexError, v } from "convex/values";
import { Resend, vOnEmailEventArgs, type EmailEvent } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { registrarEnBitacora } from "./lib/auditoria";
import { correoContacto, esRemitenteManual, remitentesManuales } from "./lib/direccionesCorreo";
import { CUOTAS, consumirLimite } from "./lib/limites";
import {
  renderizarCorreoDashboard,
  textoConFirma,
  type SegmentoCorreo,
} from "./lib/plantillaCorreo";
import { puede, requiereRol } from "./lib/rbac";
import {
  limpiarFragmentoMultilinea,
  limpiarMultilinea,
  limpiarTexto,
  normalizarCorreo,
} from "./lib/texto";
import {
  estadoHiloCorreoValidador,
  estadoIngestaCorreoValidador,
  estadoMensajeCorreoValidador,
} from "./lib/validadores";

const MAX_HILOS = 160;
const MAX_MENSAJES = 300;
const MAX_SEGMENTOS = 500;
const MAX_TEXTO_CORREO = 20_000;
const MAX_ADJUNTOS = 10;
const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ADJUNTOS_BYTES = 18 * 1024 * 1024;
const CADUCIDAD_CARGA_MS = 24 * 60 * 60 * 1000;
const VENTANA_HILO_MS = 180 * 24 * 60 * 60 * 1000;
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ENLACE_COMUNIDAD = "https://chat.whatsapp.com/CDRLe4FEHZN0jrdf2WkH8n";

const segmentoCorreoValidador = v.object({
  texto: v.string(),
  negrita: v.boolean(),
  cursiva: v.boolean(),
});

function normalizarContenido(
  textoOriginal: string,
  segmentosOriginales?: SegmentoCorreo[],
): { texto: string; segmentos?: SegmentoCorreo[] } {
  if (!segmentosOriginales?.length) {
    return { texto: limpiarMultilinea(textoOriginal, MAX_TEXTO_CORREO) };
  }

  const segmentos: SegmentoCorreo[] = [];
  let restantes = MAX_TEXTO_CORREO;
  for (const original of segmentosOriginales.slice(0, MAX_SEGMENTOS)) {
    if (restantes <= 0) break;
    const texto = limpiarFragmentoMultilinea(original.texto, restantes);
    restantes -= texto.length;
    if (!texto) continue;
    const anterior = segmentos.at(-1);
    if (
      anterior &&
      anterior.negrita === original.negrita &&
      anterior.cursiva === original.cursiva
    ) {
      anterior.texto += texto;
    } else {
      segmentos.push({
        texto,
        negrita: Boolean(original.negrita),
        cursiva: Boolean(original.cursiva),
      });
    }
  }

  if (segmentos[0]) segmentos[0].texto = segmentos[0].texto.replace(/^\s+/, "");
  if (segmentos.at(-1)) segmentos.at(-1)!.texto = segmentos.at(-1)!.texto.replace(/\s+$/, "");
  const limpios = segmentos.filter((segmento) => segmento.texto.length > 0);
  const texto = limpiarMultilinea(
    limpios.map((segmento) => segmento.texto).join(""),
    MAX_TEXTO_CORREO,
  );
  return limpios.length ? { texto, segmentos: limpios } : { texto };
}

export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
  onEmailEvent: internal.correo.actualizarEstadoEnvio,
});

function nombreDireccion(correo: string, nombre: string): string {
  return `${limpiarTexto(nombre, 80)} <${normalizarCorreo(correo)}>`;
}

function extraerDireccion(valor: string): { nombre?: string; correo: string } {
  const coincidencia = valor.match(/^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (coincidencia) {
    const nombre = limpiarTexto(coincidencia[1] ?? "", 100).replace(/^['"]|['"]$/g, "");
    return {
      ...(nombre ? { nombre } : {}),
      correo: normalizarCorreo(coincidencia[2] ?? ""),
    };
  }
  return { correo: normalizarCorreo(valor) };
}

function claveAsunto(asunto: string): string {
  return limpiarTexto(asunto, 180)
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "")
    .toLowerCase();
}

function resumenTexto(texto: string): string {
  return limpiarTexto(texto, 180);
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type ConfirmacionRegistro = {
  tipo: "miembro" | "aliado";
  nombre: string;
  correo: string;
  canales: { correo: boolean; whatsapp: boolean };
};

function primerNombre(nombre: string): string {
  return limpiarTexto(nombre, 80).split(/\s+/)[0] || "";
}

function contenidoConfirmacionRegistro(args: ConfirmacionRegistro): {
  asunto: string;
  preencabezado: string;
  etiqueta: string;
  titulo: string;
  introduccion: string;
  comunidad: string;
} {
  if (args.tipo === "aliado") {
    return {
      asunto: "Recibimos tu registro como aliado de Alpha",
      preencabezado: "Revisaremos tu registro y nos pondremos en contacto contigo.",
      etiqueta: "REGISTRO DE ALIADO",
      titulo: "Gracias por sumarte.",
      introduccion:
        "Recibimos tus datos y las áreas en las que te interesa colaborar. La mesa directiva revisará tu registro y se pondrá en contacto contigo para conversar sobre los siguientes pasos.",
      comunidad:
        "Mientras tanto, únete a nuestra comunidad. Ahí compartimos actividades, oportunidades y noticias de Alpha.",
    };
  }

  return {
    asunto: "Tu registro en Alpha está listo",
    preencabezado: "Ya recibimos tus datos. Te escribiremos cuando haya nuevas actividades.",
    etiqueta: "REGISTRO DE MIEMBRO",
    titulo: "Ya eres parte.",
    introduccion:
      "Recibimos tu registro como miembro de Alpha. Elegiste el correo electrónico como medio de contacto, así que por aquí te compartiremos convocatorias, talleres y próximas actividades.",
    comunidad: args.canales.whatsapp
      ? "También elegiste WhatsApp. Si todavía no estás dentro, entra al grupo para mantenerte cerca de la comunidad."
      : "También puedes entrar a nuestro grupo de WhatsApp para mantenerte cerca de la comunidad.",
  };
}

function textoConfirmacionRegistro(args: ConfirmacionRegistro): string {
  const contenido = contenidoConfirmacionRegistro(args);
  const nombre = primerNombre(args.nombre);
  return [
    `Hola${nombre ? ` ${nombre}` : ""},`,
    "",
    contenido.titulo,
    "",
    contenido.introduccion,
    "",
    contenido.comunidad,
    ENLACE_COMUNIDAD,
    "",
    "Si tienes alguna pregunta, responde a este correo.",
    "",
    "Sociedad Estudiantil Alpha",
    "Tecnológico de Monterrey, Campus Ciudad de México",
  ].join("\n");
}

function cuerpoConfirmacionRegistro(args: ConfirmacionRegistro, sitio: string): string {
  const contenido = contenidoConfirmacionRegistro(args);
  const nombre = escaparHtml(primerNombre(args.nombre));
  const saludo = nombre ? `Hola, ${nombre}.` : "Hola.";
  const logo = `${sitio}/alpha-mark-white.png`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escaparHtml(contenido.asunto)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light only; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; display: block; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 600px) {
      .page-pad { padding: 0 !important; }
      .shell { width: 100% !important; max-width: 100% !important; }
      .hero-pad { padding: 26px 22px 34px !important; }
      .content-pad { padding: 34px 22px 28px !important; }
      .title { font-size: 38px !important; line-height: 1.03 !important; letter-spacing: -1.4px !important; }
      .lead { font-size: 16px !important; line-height: 1.68 !important; }
      .community-pad { padding: 24px 20px !important; }
      .button { display: block !important; padding: 16px 18px !important; text-align: center !important; }
      .footer-pad { padding: 24px 22px 32px !important; }
      .footer-col { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#DDE3EA;color:#0D2140;font-family:'Montserrat',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escaparHtml(contenido.preencabezado)}&#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#DDE3EA;">
    <tr>
      <td class="page-pad" align="center" style="padding:32px 18px;">
        <table role="presentation" class="shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background-color:#F4F6F8;">
          <tr>
            <td class="hero-pad" style="padding:30px 42px 46px;background-color:#0D2140;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="width:54px;">
                    <img src="${escaparHtml(logo)}" width="48" alt="Alpha" style="width:48px;max-width:48px;height:auto;">
                  </td>
                  <td valign="middle" style="padding-left:12px;color:#FFFFFF;font-family:'Poppins',Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Alpha</td>
                  <td valign="middle" align="right" style="color:#AFCFFF;font-size:10px;font-weight:600;letter-spacing:2px;white-space:nowrap;">2026 — 2027</td>
                </tr>
              </table>
              <div style="margin-top:42px;color:#79AFFF;font-size:10px;font-weight:600;letter-spacing:2.2px;line-height:1.4;">${contenido.etiqueta}</div>
              <h1 class="title" style="margin:14px 0 0;color:#FFFFFF;font-family:'Poppins',Arial,sans-serif;font-size:52px;font-weight:700;letter-spacing:-2.2px;line-height:1.02;">${escaparHtml(contenido.titulo)}</h1>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:46px 42px 38px;background-color:#F4F6F8;">
              <p style="margin:0 0 18px;color:#0066FF;font-family:'Poppins',Arial,sans-serif;font-size:13px;font-weight:600;line-height:1.5;">${saludo}</p>
              <p class="lead" style="margin:0;color:#33445D;font-size:17px;font-weight:400;line-height:1.72;">${escaparHtml(contenido.introduccion)}</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:34px;background-color:#AFCFFF;border-left:5px solid #0066FF;">
                <tr>
                  <td class="community-pad" style="padding:28px 28px 30px;">
                    <div style="color:#194270;font-size:10px;font-weight:600;letter-spacing:2px;line-height:1.4;">COMUNIDAD ALPHA</div>
                    <h2 style="margin:10px 0 10px;color:#0D2140;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.6px;line-height:1.18;">La conversación sigue.</h2>
                    <p style="margin:0 0 22px;color:#233A59;font-size:14px;line-height:1.65;">${escaparHtml(contenido.comunidad)}</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td bgcolor="#0066FF" style="background-color:#0066FF;">
                          <a class="button" href="${ENLACE_COMUNIDAD}" target="_blank" style="display:inline-block;padding:15px 22px;color:#FFFFFF;font-family:'Montserrat',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2px;line-height:1;text-decoration:none;">Entrar a WhatsApp&nbsp;&nbsp;→</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:30px 0 0;color:#6B7482;font-size:12px;line-height:1.7;">Si tienes alguna pregunta, responde a este correo.</p>
              <p style="margin:12px 0 0;color:#7A8492;font-size:10px;line-height:1.7;">Recibes este mensaje porque completaste el registro de Alpha. Puedes pedir que te demos de baja en cualquier momento escribiendo a contacto@alphaccm.org.</p>
            </td>
          </tr>
          <tr>
            <td class="footer-pad" style="padding:25px 42px 34px;background-color:#E6EAF0;border-top:1px solid #CCD3DC;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="footer-col" style="color:#596577;font-size:11px;line-height:1.65;">Sociedad Estudiantil Alpha<br>Tecnológico de Monterrey, Campus Ciudad de México</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function enviarConfirmacionRegistro(
  ctx: ActionCtx,
  args: ConfirmacionRegistro,
): Promise<boolean> {
  const sitio = process.env.SITE_URL?.replace(/\/$/, "");
  if (!sitio || !process.env.RESEND_API_KEY || process.env.RESEND_TEST_MODE !== "false") {
    return false;
  }

  const contenido = contenidoConfirmacionRegistro(args);
  const auto = normalizarCorreo(process.env.ALPHA_AUTO_EMAIL ?? "auto@alphaccm.org");
  await resend.sendEmail(ctx, {
    from: nombreDireccion(auto, "Alpha CCM"),
    to: normalizarCorreo(args.correo),
    subject: contenido.asunto,
    text: textoConfirmacionRegistro(args),
    html: cuerpoConfirmacionRegistro(args, sitio),
    replyTo: [correoContacto()],
  });
  return true;
}

const hiloValidador = v.object({
  _id: v.id("mailThreads"),
  _creationTime: v.number(),
  asunto: v.string(),
  asuntoClave: v.string(),
  contactoCorreo: v.string(),
  contactoNombre: v.optional(v.string()),
  estado: estadoHiloCorreoValidador,
  noLeidos: v.number(),
  ultimoMensajeEn: v.number(),
  ultimoResumen: v.string(),
  asignadoA: v.optional(v.id("users")),
  asignadoNombre: v.optional(v.string()),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

const mensajeValidador = v.object({
  _id: v.id("mailMessages"),
  _creationTime: v.number(),
  direccion: v.union(v.literal("entrante"), v.literal("saliente")),
  de: v.string(),
  para: v.array(v.string()),
  cc: v.array(v.string()),
  asunto: v.string(),
  texto: v.string(),
  segmentos: v.optional(v.array(segmentoCorreoValidador)),
  html: v.optional(v.string()),
  estado: estadoMensajeCorreoValidador,
  autorCorreo: v.optional(v.string()),
  error: v.optional(v.string()),
  creadoEn: v.number(),
  adjuntos: v.array(
    v.object({
      _id: v.id("mailAttachments"),
      nombre: v.string(),
      tipoContenido: v.string(),
      tamano: v.number(),
      contentId: v.optional(v.string()),
      disposicion: v.optional(v.union(v.literal("inline"), v.literal("attachment"))),
    }),
  ),
});

const trabajoValidador = v.object({
  _id: v.id("mailInboundJobs"),
  _creationTime: v.number(),
  eventId: v.string(),
  providerEmailId: v.string(),
  de: v.string(),
  para: v.array(v.string()),
  cc: v.array(v.string()),
  asunto: v.string(),
  internetMessageId: v.string(),
  recibidoEn: v.number(),
  estado: estadoIngestaCorreoValidador,
  intentos: v.number(),
  ultimoError: v.optional(v.string()),
  creadoEn: v.number(),
  actualizadoEn: v.number(),
});

export const configuracion = query({
  args: {},
  returns: v.object({
    listo: v.boolean(),
    modoPrueba: v.boolean(),
    remitente: v.string(),
    remitentes: v.array(v.string()),
    entrada: v.string(),
  }),
  handler: async (ctx) => {
    await requiereRol(ctx, "editor");
    return {
      listo: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET),
      modoPrueba: process.env.RESEND_TEST_MODE !== "false",
      remitente: correoContacto(),
      remitentes: remitentesManuales(),
      entrada: correoContacto(),
    };
  },
});

export const resumen = query({
  args: {},
  returns: v.object({ abiertos: v.number(), noLeidos: v.number(), fallidos: v.number() }),
  handler: async (ctx) => {
    await requiereRol(ctx, "editor");
    const [abiertos, fallidos] = await Promise.all([
      ctx.db
        .query("mailThreads")
        .withIndex("by_estado_ultimo", (q) => q.eq("estado", "abierto"))
        .take(5000),
      ctx.db
        .query("mailMessages")
        .withIndex("by_thread_time")
        .order("desc")
        .take(5000),
    ]);
    return {
      abiertos: abiertos.length,
      noLeidos: abiertos.reduce((total, hilo) => total + hilo.noLeidos, 0),
      fallidos: fallidos.filter((mensaje) =>
        mensaje.estado === "fallido" || mensaje.estado === "rebotado",
      ).length,
    };
  },
});

export const listarHilos = query({
  args: {
    estado: v.optional(estadoHiloCorreoValidador),
    busqueda: v.optional(v.string()),
  },
  returns: v.array(hiloValidador),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "editor");
    const hilos = args.estado
      ? await ctx.db
          .query("mailThreads")
          .withIndex("by_estado_ultimo", (q) => q.eq("estado", args.estado!))
          .order("desc")
          .take(MAX_HILOS)
      : await ctx.db.query("mailThreads").withIndex("by_ultimo").order("desc").take(MAX_HILOS);

    const termino = limpiarTexto(args.busqueda ?? "", 100).toLowerCase();
    const filtrados = termino
      ? hilos.filter((hilo) =>
          [hilo.asunto, hilo.contactoCorreo, hilo.contactoNombre ?? "", hilo.ultimoResumen]
            .some((valor) => valor.toLowerCase().includes(termino)),
        )
      : hilos;

    const ids = [...new Set(filtrados.flatMap((hilo) => hilo.asignadoA ? [hilo.asignadoA] : []))];
    const usuarios = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const nombres = new Map(
      usuarios
        .filter((usuario): usuario is Doc<"users"> => usuario !== null)
        .map((usuario) => [usuario._id, usuario.name ?? usuario.email ?? "Sin nombre"]),
    );

    return filtrados.map((hilo) => ({
      ...hilo,
      ...(hilo.asignadoA ? { asignadoNombre: nombres.get(hilo.asignadoA) } : {}),
    }));
  },
});

export const detalle = query({
  args: { id: v.id("mailThreads") },
  returns: v.union(
    v.null(),
    v.object({
      hilo: hiloValidador,
      mensajes: v.array(mensajeValidador),
    }),
  ),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "editor");
    const hilo = await ctx.db.get(args.id);
    if (hilo === null) return null;

    const [mensajes, asignado] = await Promise.all([
      ctx.db
        .query("mailMessages")
        .withIndex("by_thread_time", (q) => q.eq("threadId", args.id))
        .order("asc")
        .take(MAX_MENSAJES),
      hilo.asignadoA ? ctx.db.get(hilo.asignadoA) : Promise.resolve(null),
    ]);

    const enriquecidos = await Promise.all(
      mensajes.map(async (mensaje) => {
        const adjuntos = await ctx.db
          .query("mailAttachments")
          .withIndex("by_message", (q) => q.eq("messageId", mensaje._id))
          .collect();
        const adjuntosSeguros = adjuntos.map((adjunto) => ({
          _id: adjunto._id,
          nombre: adjunto.nombre,
          tipoContenido: adjunto.tipoContenido,
          tamano: adjunto.tamano,
          contentId: adjunto.contentId,
          disposicion: adjunto.disposicion,
        }));
        return {
          _id: mensaje._id,
          _creationTime: mensaje._creationTime,
          direccion: mensaje.direccion,
          de: mensaje.de,
          para: mensaje.para,
          cc: mensaje.cc,
          asunto: mensaje.asunto,
          texto: mensaje.texto,
          segmentos: mensaje.segmentos,
          html: mensaje.html,
          estado: mensaje.estado,
          autorCorreo: mensaje.autorCorreo,
          error: mensaje.error,
          creadoEn: mensaje.creadoEn,
          adjuntos: adjuntosSeguros,
        };
      }),
    );

    return {
      hilo: {
        ...hilo,
        ...(asignado
          ? { asignadoNombre: asignado.name ?? asignado.email ?? "Sin nombre" }
          : {}),
      },
      mensajes: enriquecidos,
    };
  },
});

export const obtenerAdjuntoDescarga = internalQuery({
  args: { actorId: v.id("users"), id: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      storageId: v.id("_storage"),
      nombre: v.string(),
      tipoContenido: v.string(),
      tamano: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!puede(actor, "editor")) return null;
    const id = ctx.db.normalizeId("mailAttachments", args.id);
    if (!id) return null;
    const adjunto = await ctx.db.get(id);
    if (!adjunto) return null;
    return {
      storageId: adjunto.storageId,
      nombre: adjunto.nombre,
      tipoContenido: adjunto.tipoContenido,
      tamano: adjunto.tamano,
    };
  },
});

export const enviar = mutation({
  args: {
    clientRequestId: v.string(),
    threadId: v.optional(v.id("mailThreads")),
    para: v.optional(v.string()),
    remitente: v.string(),
    asunto: v.string(),
    texto: v.string(),
    segmentos: v.optional(v.array(segmentoCorreoValidador)),
  },
  returns: v.object({ threadId: v.id("mailThreads"), messageId: v.id("mailMessages") }),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const clientRequestId = limpiarTexto(args.clientRequestId, 80);
    if (clientRequestId.length < 8) throw new ConvexError("Identificador de envio no valido.");
    const existente = await ctx.db
      .query("mailMessages")
      .withIndex("by_client_request", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
    if (existente) return { threadId: existente.threadId, messageId: existente._id };

    if (!process.env.RESEND_API_KEY) {
      throw new ConvexError("El correo todavia no esta configurado en Convex.");
    }

    const remitente = normalizarCorreo(args.remitente);
    if (!esRemitenteManual(remitente)) {
      throw new ConvexError("La direccion de envio no pertenece a Alpha.");
    }

    const limite = await consumirLimite(
      ctx,
      `correo:${actor._id}`,
      CUOTAS.correosPorUsuario.maximo,
      CUOTAS.correosPorUsuario.ventanaMs,
    );
    if (!limite.permitido) {
      throw new ConvexError("Alcanzaste el limite de correos por hora. Intenta mas tarde.");
    }

    const contenido = normalizarContenido(args.texto, args.segmentos);
    const texto = contenido.texto;
    const asuntoSolicitado = limpiarTexto(args.asunto, 180);
    if (texto.length < 1) throw new ConvexError("Escribe el contenido del correo.");

    let hilo: Doc<"mailThreads"> | null = null;
    if (args.threadId) {
      hilo = await ctx.db.get(args.threadId);
      if (hilo === null) throw new ConvexError("La conversacion ya no existe.");
    }

    const para = hilo ? hilo.contactoCorreo : normalizarCorreo(args.para ?? "");
    if (!CORREO_VALIDO.test(para)) throw new ConvexError("Escribe un destinatario valido.");
    const asunto = asuntoSolicitado || hilo?.asunto || "Mensaje de Alpha";
    const ahora = Date.now();

    let threadId: Id<"mailThreads">;
    if (hilo) {
      threadId = hilo._id;
    } else {
      threadId = await ctx.db.insert("mailThreads", {
        asunto,
        asuntoClave: claveAsunto(asunto),
        contactoCorreo: para,
        estado: "abierto",
        noLeidos: 0,
        ultimoMensajeEn: ahora,
        ultimoResumen: resumenTexto(texto),
        asignadoA: actor._id,
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
    }

    const ultimo = hilo
      ? await ctx.db
          .query("mailMessages")
          .withIndex("by_thread_time", (q) => q.eq("threadId", hilo!._id))
          .order("desc")
          .first()
      : null;
    const referencias = ultimo
      ? [...ultimo.referencias, ...(ultimo.internetMessageId ? [ultimo.internetMessageId] : [])]
          .slice(-20)
      : [];
    const headers = ultimo?.internetMessageId
      ? [
          { name: "In-Reply-To", value: ultimo.internetMessageId },
          ...(referencias.length > 0
            ? [{ name: "References", value: referencias.join(" ") }]
            : []),
        ]
      : undefined;

    const asuntoEnvio = ultimo && !/^re\s*:/i.test(asunto) ? `Re: ${asunto}` : asunto;
    const resendComponentId = await resend.sendEmail(ctx, {
      from: nombreDireccion(remitente, "Alpha CCM"),
      to: para,
      subject: asuntoEnvio,
      text: textoConFirma(texto, remitente),
      html: renderizarCorreoDashboard({
        asunto: asuntoEnvio,
        texto,
        segmentos: contenido.segmentos,
        remitente,
      }),
      replyTo: [remitente],
      ...(headers ? { headers } : {}),
    });

    const messageId = await ctx.db.insert("mailMessages", {
      threadId,
      direccion: "saliente",
      de: remitente,
      para: [para],
      cc: [],
      asunto,
      texto,
      ...(contenido.segmentos ? { segmentos: contenido.segmentos } : {}),
      estado: "en_cola",
      clientRequestId,
      resendComponentId,
      inReplyTo: ultimo?.internetMessageId,
      referencias,
      autorId: actor._id,
      autorCorreo: actor.email ?? "",
      creadoEn: ahora,
    });

    await ctx.db.patch(threadId, {
      asunto,
      asuntoClave: claveAsunto(asunto),
      estado: "abierto",
      ultimoMensajeEn: ahora,
      ultimoResumen: resumenTexto(texto),
      asignadoA: hilo?.asignadoA ?? actor._id,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "correo.enviado",
      entidad: "mailThreads",
      entidadId: threadId,
      detalle: para,
    });

    return { threadId, messageId };
  },
});

export const crearCargaAdjunto = mutation({
  args: {},
  returns: v.object({
    id: v.id("mailAttachmentDrafts"),
    url: v.string(),
  }),
  handler: async (ctx) => {
    const actor = await requiereRol(ctx, "editor");
    const id = await ctx.db.insert("mailAttachmentDrafts", {
      actorId: actor._id,
      creadoEn: Date.now(),
    });
    const url = await ctx.storage.generateUploadUrl();
    await ctx.scheduler.runAfter(CADUCIDAD_CARGA_MS, internal.correo.limpiarCargaAdjunto, { id });
    return { id, url };
  },
});

export const completarCargaAdjunto = mutation({
  args: {
    id: v.id("mailAttachmentDrafts"),
    storageId: v.id("_storage"),
    nombre: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      nombre: v.string(),
      tipoContenido: v.string(),
      tamano: v.number(),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const borrador = await ctx.db.get(args.id);
    if (!borrador || borrador.actorId !== actor._id || borrador.storageId) {
      return { ok: false as const, error: "La carga ya no esta disponible." };
    }

    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) {
      await ctx.db.delete(borrador._id);
      return { ok: false as const, error: "Convex no recibio el archivo." };
    }
    if (metadata.size <= 0 || metadata.size > MAX_ADJUNTO_BYTES) {
      await ctx.storage.delete(args.storageId);
      await ctx.db.delete(borrador._id);
      return { ok: false as const, error: "Cada archivo debe pesar 10 MB o menos." };
    }

    const nombre = limpiarTexto(args.nombre, 180) || "archivo";
    const tipoContenido = limpiarTexto(
      metadata.contentType || "application/octet-stream",
      120,
    );
    await ctx.db.patch(borrador._id, {
      storageId: args.storageId,
      nombre,
      tipoContenido,
      tamano: metadata.size,
    });
    return { ok: true as const, nombre, tipoContenido, tamano: metadata.size };
  },
});

export const descartarCargaAdjunto = mutation({
  args: { id: v.id("mailAttachmentDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const borrador = await ctx.db.get(args.id);
    if (!borrador || borrador.actorId !== actor._id) return null;
    if (borrador.storageId) await ctx.storage.delete(borrador.storageId);
    await ctx.db.delete(borrador._id);
    return null;
  },
});

export const limpiarCargaAdjunto = internalMutation({
  args: { id: v.id("mailAttachmentDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const borrador = await ctx.db.get(args.id);
    if (!borrador) return null;
    const restante = borrador.creadoEn + CADUCIDAD_CARGA_MS - Date.now();
    if (restante > 1_000) {
      await ctx.scheduler.runAfter(restante, internal.correo.limpiarCargaAdjunto, { id: args.id });
      return null;
    }
    if (borrador.storageId) await ctx.storage.delete(borrador.storageId);
    await ctx.db.delete(borrador._id);
    return null;
  },
});

const envioAdjuntosValidador = v.object({
  threadId: v.id("mailThreads"),
  messageId: v.id("mailMessages"),
  yaEnviado: v.boolean(),
  clientRequestId: v.string(),
  para: v.string(),
  remitente: v.string(),
  asunto: v.string(),
  asuntoEnvio: v.string(),
  texto: v.string(),
  segmentos: v.optional(v.array(segmentoCorreoValidador)),
  headers: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
  adjuntos: v.array(
    v.object({
      storageId: v.id("_storage"),
      nombre: v.string(),
      tipoContenido: v.string(),
      tamano: v.number(),
    }),
  ),
});

export const prepararEnvioConAdjuntos = internalMutation({
  args: {
    actorId: v.id("users"),
    clientRequestId: v.string(),
    threadId: v.optional(v.id("mailThreads")),
    para: v.optional(v.string()),
    remitente: v.string(),
    asunto: v.string(),
    texto: v.string(),
    segmentos: v.optional(v.array(segmentoCorreoValidador)),
    adjuntos: v.array(v.id("mailAttachmentDrafts")),
  },
  returns: envioAdjuntosValidador,
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor || !puede(actor, "editor")) {
      throw new ConvexError("Tu sesion ya no permite enviar correo.");
    }

    const clientRequestId = limpiarTexto(args.clientRequestId, 80);
    if (clientRequestId.length < 8) throw new ConvexError("Identificador de envio no valido.");

    const existente = await ctx.db
      .query("mailMessages")
      .withIndex("by_client_request", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
    if (existente) {
      if (existente.autorId !== actor._id) throw new ConvexError("Identificador de envio no valido.");
      const adjuntos = await ctx.db
        .query("mailAttachments")
        .withIndex("by_message", (q) => q.eq("messageId", existente._id))
        .collect();
      const referencias = existente.referencias.slice(-20);
      const headers = existente.inReplyTo
        ? [
            { name: "In-Reply-To", value: existente.inReplyTo },
            ...(referencias.length ? [{ name: "References", value: referencias.join(" ") }] : []),
          ]
        : undefined;
      if (!existente.resendEmailId && existente.estado === "fallido") {
        await ctx.db.patch(existente._id, { estado: "en_cola", error: undefined });
      }
      return {
        threadId: existente.threadId,
        messageId: existente._id,
        yaEnviado: Boolean(existente.resendEmailId),
        clientRequestId,
        para: existente.para[0] ?? "",
        remitente: existente.de,
        asunto: existente.asunto,
        asuntoEnvio:
          existente.inReplyTo && !/^re\s*:/i.test(existente.asunto)
            ? `Re: ${existente.asunto}`
            : existente.asunto,
        texto: existente.texto,
        segmentos: existente.segmentos,
        headers,
        adjuntos: adjuntos.map((adjunto) => ({
          storageId: adjunto.storageId,
          nombre: adjunto.nombre,
          tipoContenido: adjunto.tipoContenido,
          tamano: adjunto.tamano,
        })),
      };
    }

    if (!process.env.RESEND_API_KEY) {
      throw new ConvexError("El correo todavia no esta configurado en Convex.");
    }
    if (args.adjuntos.length < 1 || args.adjuntos.length > MAX_ADJUNTOS) {
      throw new ConvexError("Puedes adjuntar entre 1 y 10 archivos por correo.");
    }
    if (new Set(args.adjuntos).size !== args.adjuntos.length) {
      throw new ConvexError("La lista de archivos contiene duplicados.");
    }

    const remitente = normalizarCorreo(args.remitente);
    if (!esRemitenteManual(remitente)) {
      throw new ConvexError("La direccion de envio no pertenece a Alpha.");
    }
    const limite = await consumirLimite(
      ctx,
      `correo:${actor._id}`,
      CUOTAS.correosPorUsuario.maximo,
      CUOTAS.correosPorUsuario.ventanaMs,
    );
    if (!limite.permitido) {
      throw new ConvexError("Alcanzaste el limite de correos por hora. Intenta mas tarde.");
    }

    const contenido = normalizarContenido(args.texto, args.segmentos);
    if (!contenido.texto) throw new ConvexError("Escribe el contenido del correo.");
    const asuntoSolicitado = limpiarTexto(args.asunto, 180);
    let hilo: Doc<"mailThreads"> | null = null;
    if (args.threadId) {
      hilo = await ctx.db.get(args.threadId);
      if (!hilo) throw new ConvexError("La conversacion ya no existe.");
    }
    const para = hilo ? hilo.contactoCorreo : normalizarCorreo(args.para ?? "");
    if (!CORREO_VALIDO.test(para)) throw new ConvexError("Escribe un destinatario valido.");
    const asunto = asuntoSolicitado || hilo?.asunto || "Mensaje de Alpha";

    const borradores = await Promise.all(args.adjuntos.map((id) => ctx.db.get(id)));
    if (
      borradores.some(
        (borrador) =>
          !borrador ||
          borrador.actorId !== actor._id ||
          !borrador.storageId ||
          !borrador.nombre ||
          !borrador.tipoContenido ||
          borrador.tamano === undefined,
      )
    ) {
      throw new ConvexError("Uno de los archivos ya no esta disponible.");
    }
    const listos = borradores.filter(
      (borrador): borrador is NonNullable<typeof borrador> & {
        storageId: Id<"_storage">;
        nombre: string;
        tipoContenido: string;
        tamano: number;
      } => Boolean(borrador?.storageId && borrador.nombre && borrador.tipoContenido),
    );
    const total = listos.reduce((suma, borrador) => suma + borrador.tamano, 0);
    if (total > MAX_TOTAL_ADJUNTOS_BYTES) {
      throw new ConvexError("Los archivos adjuntos no pueden superar 18 MB en total.");
    }

    const ahora = Date.now();
    const threadId = hilo
      ? hilo._id
      : await ctx.db.insert("mailThreads", {
          asunto,
          asuntoClave: claveAsunto(asunto),
          contactoCorreo: para,
          estado: "abierto",
          noLeidos: 0,
          ultimoMensajeEn: ahora,
          ultimoResumen: resumenTexto(contenido.texto),
          asignadoA: actor._id,
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
    const ultimo = hilo
      ? await ctx.db
          .query("mailMessages")
          .withIndex("by_thread_time", (q) => q.eq("threadId", hilo!._id))
          .order("desc")
          .first()
      : null;
    const referencias = ultimo
      ? [...ultimo.referencias, ...(ultimo.internetMessageId ? [ultimo.internetMessageId] : [])].slice(-20)
      : [];
    const headers = ultimo?.internetMessageId
      ? [
          { name: "In-Reply-To", value: ultimo.internetMessageId },
          ...(referencias.length ? [{ name: "References", value: referencias.join(" ") }] : []),
        ]
      : undefined;
    const asuntoEnvio = ultimo && !/^re\s*:/i.test(asunto) ? `Re: ${asunto}` : asunto;

    const messageId = await ctx.db.insert("mailMessages", {
      threadId,
      direccion: "saliente",
      de: remitente,
      para: [para],
      cc: [],
      asunto,
      texto: contenido.texto,
      ...(contenido.segmentos ? { segmentos: contenido.segmentos } : {}),
      estado: "en_cola",
      clientRequestId,
      inReplyTo: ultimo?.internetMessageId,
      referencias,
      autorId: actor._id,
      autorCorreo: actor.email ?? "",
      creadoEn: ahora,
    });
    await Promise.all(
      listos.map(async (borrador, indice) => {
        await ctx.db.insert("mailAttachments", {
          messageId,
          storageId: borrador.storageId,
          providerAttachmentId: `saliente:${clientRequestId}:${indice}`,
          nombre: borrador.nombre,
          tipoContenido: borrador.tipoContenido,
          tamano: borrador.tamano,
          disposicion: "attachment",
          creadoEn: ahora,
        });
        await ctx.db.delete(borrador._id);
      }),
    );
    await ctx.db.patch(threadId, {
      asunto,
      asuntoClave: claveAsunto(asunto),
      estado: "abierto",
      ultimoMensajeEn: ahora,
      ultimoResumen: resumenTexto(contenido.texto),
      asignadoA: hilo?.asignadoA ?? actor._id,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "correo.enviado",
      entidad: "mailThreads",
      entidadId: threadId,
      detalle: `${para}; ${listos.length} adjuntos`,
    });

    return {
      threadId,
      messageId,
      yaEnviado: false,
      clientRequestId,
      para,
      remitente,
      asunto,
      asuntoEnvio,
      texto: contenido.texto,
      segmentos: contenido.segmentos,
      headers,
      adjuntos: listos.map((borrador) => ({
        storageId: borrador.storageId,
        nombre: borrador.nombre,
        tipoContenido: borrador.tipoContenido,
        tamano: borrador.tamano,
      })),
    };
  },
});

export const confirmarEnvioConAdjuntos = internalMutation({
  args: { messageId: v.id("mailMessages"), resendEmailId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mensaje = await ctx.db.get(args.messageId);
    if (!mensaje || mensaje.direccion !== "saliente") return null;
    await ctx.db.patch(mensaje._id, {
      resendEmailId: limpiarTexto(args.resendEmailId, 120),
      estado: "enviado",
      error: undefined,
    });
    return null;
  },
});

export const fallarEnvioConAdjuntos = internalMutation({
  args: { messageId: v.id("mailMessages"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mensaje = await ctx.db.get(args.messageId);
    if (!mensaje || mensaje.resendEmailId) return null;
    await ctx.db.patch(mensaje._id, {
      estado: "fallido",
      error: limpiarTexto(args.error, 500),
    });
    return null;
  },
});

export const marcarLeido = mutation({
  args: { id: v.id("mailThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "editor");
    const hilo = await ctx.db.get(args.id);
    if (hilo && hilo.noLeidos > 0) {
      await ctx.db.patch(args.id, { noLeidos: 0, actualizadoEn: Date.now() });
    }
    return null;
  },
});

export const cambiarEstado = mutation({
  args: { id: v.id("mailThreads"), estado: estadoHiloCorreoValidador },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const hilo = await ctx.db.get(args.id);
    if (!hilo || hilo.estado === args.estado) return null;
    await ctx.db.patch(args.id, { estado: args.estado, actualizadoEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "correo.estado",
      entidad: "mailThreads",
      entidadId: args.id,
      detalle: `${hilo.estado} -> ${args.estado}`,
    });
    return null;
  },
});

export const tomar = mutation({
  args: { id: v.id("mailThreads"), tomar: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    await ctx.db.patch(args.id, {
      asignadoA: args.tomar ? actor._id : undefined,
      actualizadoEn: Date.now(),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: args.tomar ? "correo.asignado" : "correo.liberado",
      entidad: "mailThreads",
      entidadId: args.id,
    });
    return null;
  },
});

export const eliminarHilo = mutation({
  args: { id: v.id("mailThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const hilo = await ctx.db.get(args.id);
    if (hilo === null) return null;

    const mensajes = await ctx.db
      .query("mailMessages")
      .withIndex("by_thread_time", (q) => q.eq("threadId", args.id))
      .collect();
    const adjuntos = (
      await Promise.all(
        mensajes.map((mensaje) =>
          ctx.db
            .query("mailAttachments")
            .withIndex("by_message", (q) => q.eq("messageId", mensaje._id))
            .collect(),
        ),
      )
    ).flat();

    for (const adjunto of adjuntos) {
      await ctx.storage.delete(adjunto.storageId);
      await ctx.db.delete(adjunto._id);
    }
    for (const mensaje of mensajes) {
      await ctx.db.delete(mensaje._id);
    }
    await ctx.db.delete(hilo._id);

    await registrarEnBitacora(ctx, {
      actor,
      accion: "correo.eliminado",
      entidad: "mailThreads",
      entidadId: args.id,
      detalle: `${mensajes.length} mensajes`,
    });
    return null;
  },
});

export const registrarEntrada = internalMutation({
  args: {
    eventId: v.string(),
    providerEmailId: v.string(),
    de: v.string(),
    para: v.array(v.string()),
    cc: v.array(v.string()),
    asunto: v.string(),
    internetMessageId: v.string(),
    recibidoEn: v.number(),
  },
  returns: v.union(v.id("mailInboundJobs"), v.null()),
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query("mailInboundJobs")
      .withIndex("by_provider_email", (q) => q.eq("providerEmailId", args.providerEmailId))
      .unique();
    if (existente) return null;

    const ahora = Date.now();
    const id = await ctx.db.insert("mailInboundJobs", {
      eventId: limpiarTexto(args.eventId, 100),
      providerEmailId: limpiarTexto(args.providerEmailId, 100),
      de: limpiarTexto(args.de, 320),
      para: args.para.map((correo) => limpiarTexto(correo, 320)).slice(0, 25),
      cc: args.cc.map((correo) => limpiarTexto(correo, 320)).slice(0, 25),
      asunto: limpiarTexto(args.asunto || "Sin asunto", 180),
      internetMessageId: limpiarTexto(args.internetMessageId, 500),
      recibidoEn: args.recibidoEn,
      estado: "pendiente",
      intentos: 0,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await ctx.scheduler.runAfter(0, internal.correoActions.procesarEntrada, { jobId: id });
    return id;
  },
});

export const obtenerTrabajo = internalQuery({
  args: { jobId: v.id("mailInboundJobs") },
  returns: v.union(v.null(), trabajoValidador),
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const marcarTrabajoProcesando = internalMutation({
  args: { jobId: v.id("mailInboundJobs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const trabajo = await ctx.db.get(args.jobId);
    if (!trabajo || trabajo.estado !== "pendiente") return false;
    await ctx.db.patch(args.jobId, {
      estado: "procesando",
      intentos: trabajo.intentos + 1,
      ultimoError: undefined,
      actualizadoEn: Date.now(),
    });
    return true;
  },
});

export const guardarEntrada = internalMutation({
  args: {
    jobId: v.id("mailInboundJobs"),
    texto: v.string(),
    html: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    referencias: v.array(v.string()),
    adjuntos: v.array(
      v.object({
        storageId: v.id("_storage"),
        providerAttachmentId: v.string(),
        nombre: v.string(),
        tipoContenido: v.string(),
        tamano: v.number(),
        contentId: v.optional(v.string()),
        disposicion: v.optional(v.union(v.literal("inline"), v.literal("attachment"))),
      }),
    ),
  },
  returns: v.id("mailMessages"),
  handler: async (ctx, args) => {
    const trabajo = await ctx.db.get(args.jobId);
    if (!trabajo) throw new Error("El trabajo de correo ya no existe.");
    const existente = await ctx.db
      .query("mailMessages")
      .withIndex("by_provider_inbound", (q) => q.eq("providerInboundId", trabajo.providerEmailId))
      .unique();
    if (existente) {
      await ctx.db.patch(args.jobId, { estado: "completado", actualizadoEn: Date.now() });
      return existente._id;
    }

    const remitente = extraerDireccion(trabajo.de);
    const referencias = args.referencias.map((valor) => limpiarTexto(valor, 500)).slice(-20);
    const candidatos = [args.inReplyTo, ...[...referencias].reverse()].filter(
      (valor): valor is string => Boolean(valor),
    );
    let threadId: Id<"mailThreads"> | null = null;

    for (const candidato of candidatos) {
      const mensaje = await ctx.db
        .query("mailMessages")
        .withIndex("by_internet_message", (q) => q.eq("internetMessageId", candidato))
        .unique();
      if (mensaje) {
        threadId = mensaje.threadId;
        break;
      }
    }

    const asunto = limpiarTexto(trabajo.asunto || "Sin asunto", 180);
    const asuntoClave = claveAsunto(asunto);
    if (!threadId) {
      const recientes = await ctx.db
        .query("mailThreads")
        .withIndex("by_contacto_ultimo", (q) => q.eq("contactoCorreo", remitente.correo))
        .order("desc")
        .take(20);
      const compatible = recientes.find(
        (hilo) =>
          hilo.asuntoClave === asuntoClave &&
          hilo.ultimoMensajeEn >= Date.now() - VENTANA_HILO_MS,
      );
      threadId = compatible?._id ?? null;
    }

    const texto = limpiarMultilinea(args.texto || "Mensaje sin contenido de texto.", 60_000);
    const ahora = Date.now();
    if (!threadId) {
      threadId = await ctx.db.insert("mailThreads", {
        asunto,
        asuntoClave,
        contactoCorreo: remitente.correo,
        ...(remitente.nombre ? { contactoNombre: remitente.nombre } : {}),
        estado: "abierto",
        noLeidos: 1,
        ultimoMensajeEn: trabajo.recibidoEn,
        ultimoResumen: resumenTexto(texto),
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
    } else {
      const hilo = await ctx.db.get(threadId);
      if (!hilo) throw new Error("La conversacion vinculada ya no existe.");
      await ctx.db.patch(threadId, {
        asunto,
        asuntoClave,
        contactoCorreo: remitente.correo,
        ...(remitente.nombre ? { contactoNombre: remitente.nombre } : {}),
        estado: "abierto",
        noLeidos: hilo.noLeidos + 1,
        ultimoMensajeEn: trabajo.recibidoEn,
        ultimoResumen: resumenTexto(texto),
        actualizadoEn: ahora,
      });
    }

    const messageId = await ctx.db.insert("mailMessages", {
      threadId,
      direccion: "entrante",
      de: trabajo.de,
      para: trabajo.para,
      cc: trabajo.cc,
      asunto,
      texto,
      ...(args.html ? { html: args.html } : {}),
      estado: "recibido",
      providerInboundId: trabajo.providerEmailId,
      internetMessageId: trabajo.internetMessageId,
      ...(args.inReplyTo ? { inReplyTo: limpiarTexto(args.inReplyTo, 500) } : {}),
      referencias,
      creadoEn: trabajo.recibidoEn,
    });

    await Promise.all(
      args.adjuntos.map((adjunto) =>
        ctx.db.insert("mailAttachments", {
          messageId,
          storageId: adjunto.storageId,
          providerAttachmentId: limpiarTexto(adjunto.providerAttachmentId, 100),
          nombre: limpiarTexto(adjunto.nombre, 180) || "adjunto",
          tipoContenido: limpiarTexto(adjunto.tipoContenido, 120),
          tamano: Math.max(0, Math.floor(adjunto.tamano)),
          ...(adjunto.contentId
            ? { contentId: limpiarTexto(adjunto.contentId.replace(/^<|>$/g, ""), 300) }
            : {}),
          ...(adjunto.disposicion ? { disposicion: adjunto.disposicion } : {}),
          creadoEn: ahora,
        }),
      ),
    );
    await ctx.db.patch(args.jobId, {
      estado: "completado",
      ultimoError: undefined,
      actualizadoEn: ahora,
    });
    await registrarEnBitacora(ctx, {
      actor: null,
      accion: "correo.recibido",
      entidad: "mailThreads",
      entidadId: threadId,
      detalle: remitente.correo,
    });
    return messageId;
  },
});

export const registrarFalloEntrada = internalMutation({
  args: { jobId: v.id("mailInboundJobs"), error: v.string(), terminal: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trabajo = await ctx.db.get(args.jobId);
    if (!trabajo || trabajo.estado === "completado") return null;
    await ctx.db.patch(args.jobId, {
      estado: args.terminal ? "fallido" : "pendiente",
      ultimoError: limpiarTexto(args.error, 500),
      actualizadoEn: Date.now(),
    });
    return null;
  },
});

export const actualizarEstadoEnvioDirecto = internalMutation({
  args: {
    resendEmailId: v.string(),
    tipo: v.string(),
    internetMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const mensaje = await ctx.db
      .query("mailMessages")
      .withIndex("by_resend_email", (q) => q.eq("resendEmailId", args.resendEmailId))
      .unique();
    if (!mensaje || mensaje.resendComponentId) return false;

    let estado = mensaje.estado;
    switch (args.tipo) {
      case "email.sent":
        estado = "enviado";
        break;
      case "email.delivered":
        estado = "entregado";
        break;
      case "email.delivery_delayed":
        if (estado !== "entregado") estado = "retrasado";
        break;
      case "email.bounced":
        estado = "rebotado";
        break;
      case "email.failed":
        estado = "fallido";
        break;
      default:
        break;
    }
    await ctx.db.patch(mensaje._id, {
      estado,
      ...(args.internetMessageId
        ? { internetMessageId: limpiarTexto(args.internetMessageId, 500) }
        : {}),
      ...(args.error ? { error: limpiarTexto(args.error, 500) } : {}),
    });
    return true;
  },
});

export const actualizarEstadoEnvio = internalMutation({
  args: vOnEmailEventArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const mensaje = await ctx.db
      .query("mailMessages")
      .withIndex("by_resend_component", (q) => q.eq("resendComponentId", args.id))
      .unique();
    if (!mensaje) return null;

    const estado = estadoDesdeEvento(args.event, mensaje.estado);
    const error =
      args.event.type === "email.bounced"
        ? args.event.data.bounce.message
        : args.event.type === "email.failed"
          ? args.event.data.failed.reason
          : undefined;
    await ctx.db.patch(mensaje._id, {
      estado,
      resendEmailId: args.event.data.email_id,
      ...(args.event.data.message_id ? { internetMessageId: args.event.data.message_id } : {}),
      ...(error ? { error: limpiarTexto(error, 500) } : {}),
    });
    return null;
  },
});

function estadoDesdeEvento(
  evento: EmailEvent,
  actual: Doc<"mailMessages">["estado"],
): Doc<"mailMessages">["estado"] {
  switch (evento.type) {
    case "email.sent":
      return "enviado";
    case "email.delivered":
      return "entregado";
    case "email.delivery_delayed":
      return actual === "entregado" ? actual : "retrasado";
    case "email.bounced":
      return "rebotado";
    case "email.failed":
      return "fallido";
    case "email.complained":
      return "fallido";
    case "email.opened":
    case "email.clicked":
      return actual;
  }
}

export async function enviarInvitacionPorCorreo(
  ctx: MutationCtx,
  args: {
    actor: Doc<"users">;
    correo: string;
    nombre: string;
    token: string;
    expiraEn: number;
  },
): Promise<boolean> {
  const sitio = process.env.SITE_URL?.replace(/\/$/, "");
  if (!sitio || !process.env.RESEND_API_KEY || process.env.RESEND_TEST_MODE !== "false") {
    return false;
  }

  const enlace = `${sitio}/dashboard/invitacion/${args.token}`;
  const vence = new Date(args.expiraEn).toISOString().slice(0, 10);
  const texto = `Hola ${args.nombre},\n\nTe invitaron al panel interno de Alpha. El enlace es personal, funciona una sola vez y vence el ${vence}.\n\n${enlace}\n\nSi no esperabas esta invitacion, puedes ignorar este mensaje.`;
  const ahora = Date.now();
  const asunto = "Tu acceso al panel de Alpha";
  const threadId = await ctx.db.insert("mailThreads", {
    asunto,
    asuntoClave: claveAsunto(asunto),
    contactoCorreo: args.correo,
    contactoNombre: args.nombre,
    estado: "resuelto",
    noLeidos: 0,
    ultimoMensajeEn: ahora,
    ultimoResumen: resumenTexto(texto),
    asignadoA: args.actor._id,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });
  const auto = normalizarCorreo(process.env.ALPHA_AUTO_EMAIL ?? "auto@alphaccm.org");
  const resendComponentId = await resend.sendEmail(ctx, {
    from: nombreDireccion(auto, "Alpha CCM"),
    to: args.correo,
    subject: asunto,
    text: textoConFirma(texto, auto),
    html: renderizarCorreoDashboard({ asunto, texto, remitente: auto }),
    replyTo: [correoContacto()],
  });
  await ctx.db.insert("mailMessages", {
    threadId,
    direccion: "saliente",
    de: auto,
    para: [args.correo],
    cc: [],
    asunto,
    texto,
    estado: "en_cola",
    resendComponentId,
    referencias: [],
    autorId: args.actor._id,
    autorCorreo: args.actor.email ?? "",
    creadoEn: ahora,
  });
  return true;
}
