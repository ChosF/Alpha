type OpcionesCorreoDashboard = {
  asunto: string;
  texto: string;
  segmentos?: SegmentoCorreo[];
  remitente?: string;
  accion?: {
    etiqueta: string;
    url: string;
    nota?: string;
  };
};

type OpcionesCorreoEncuesta = {
  eventoTitulo: string;
  nombre: string;
  url: string;
  remitente?: string;
};

export type SegmentoCorreo = {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
};

const LOGO_CORREO = "https://alphaccm.org/alpha-mark-white.png?email=20260820";

function firmaPara(remitente?: string): string[] {
  const correo = remitente?.trim().toLowerCase();
  const institucion = [
    "Sociedad Estudiantil Alpha",
    "Tecnológico de Monterrey, Campus Ciudad de México",
  ];

  if (correo === "finanzas@alphaccm.org") {
    return ["Coordinación de Finanzas,", ...institucion];
  }
  if (correo === "direccion@alphaccm.org") {
    return ["Presidencia y Vicepresidencia,", ...institucion];
  }
  return institucion;
}

export function textoConFirma(texto: string, remitente?: string): string {
  return `${texto.trimEnd()}\n\n${firmaPara(remitente).join("\n")}`;
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resumen(valor: string, maximo: number): string {
  const limpio = valor.replace(/\s+/g, " ").trim();
  return limpio.length <= maximo ? limpio : `${limpio.slice(0, maximo - 1).trimEnd()}…`;
}

function cuerpoConFormato(texto: string, segmentos?: SegmentoCorreo[]): string {
  const fuente = segmentos?.length
    ? segmentos
    : [{ texto, negrita: false, cursiva: false }];
  const contenido = fuente
    .map((segmento) => {
      let salida = escaparHtml(segmento.texto).replaceAll("\n", "<br>");
      if (segmento.cursiva) salida = `<em style="font-style:italic;">${salida}</em>`;
      if (segmento.negrita) salida = `<strong style="font-weight:600;">${salida}</strong>`;
      return salida;
    })
    .join("");

  return `<p class="message-copy" style="margin:0 0 20px;color:#33445D;font-size:16px;font-weight:400;line-height:1.75;">${contenido}</p>`;
}

export function renderizarCorreoDashboard({
  asunto,
  texto,
  segmentos,
  remitente,
  accion,
}: OpcionesCorreoDashboard): string {
  const asuntoSeguro = escaparHtml(asunto);
  const preencabezado = escaparHtml(resumen(texto, 120));
  const parrafos = cuerpoConFormato(texto, segmentos);
  const firma = firmaPara(remitente).map(escaparHtml).join("<br>");
  const marca = `<td valign="middle" style="width:54px;"><img src="${escaparHtml(LOGO_CORREO)}" width="48" height="33" alt="Alpha" style="width:48px;max-width:48px;height:33px;border:0;display:block;"></td>`;
  const llamada = accion
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0;">
                <tr>
                  <td style="border-radius:999px;background-color:#0066FF;">
                    <a href="${escaparHtml(accion.url)}" style="display:inline-block;padding:15px 24px;color:#FFFFFF;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;line-height:1;text-decoration:none;">${escaparHtml(accion.etiqueta)}&nbsp;&nbsp;→</a>
                  </td>
                </tr>
              </table>${accion.nota ? `<p style="margin:16px 0 0;color:#6B7482;font-size:11px;line-height:1.7;">${escaparHtml(accion.nota)}</p>` : ""}`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${asuntoSeguro}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light only; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 600px) {
      .page-pad { padding: 0 !important; }
      .shell { width: 100% !important; max-width: 100% !important; }
      .hero-pad { padding: 26px 22px 34px !important; }
      .content-pad { padding: 34px 22px 28px !important; }
      .subject { font-size: 32px !important; line-height: 1.08 !important; letter-spacing: -1px !important; }
      .message-copy { font-size: 15px !important; line-height: 1.72 !important; }
      .footer-pad { padding: 24px 22px 32px !important; }
      .footer-col { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#DDE3EA;color:#0D2140;font-family:'Montserrat',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preencabezado}&#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#DDE3EA;">
    <tr>
      <td class="page-pad" align="center" style="padding:32px 18px;">
        <table role="presentation" class="shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background-color:#F4F6F8;">
          <tr>
            <td class="hero-pad" style="padding:30px 42px 42px;background-color:#0D2140;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  ${marca}
                  <td valign="middle" style="padding-left:12px;color:#FFFFFF;font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Alpha</td>
                  <td valign="middle" align="right" style="color:#AFCFFF;font-size:10px;font-weight:600;letter-spacing:2px;white-space:nowrap;">2026 — 2027</td>
                </tr>
              </table>
              <h1 class="subject" style="margin:38px 0 0;color:#FFFFFF;font-family:'Poppins',sans-serif;font-size:40px;font-weight:700;letter-spacing:-1.5px;line-height:1.08;">${asuntoSeguro}</h1>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:44px 42px 34px;background-color:#F4F6F8;">
              <div style="width:42px;height:5px;margin:0 0 28px;background-color:#0066FF;font-size:0;line-height:0;">&nbsp;</div>
              ${parrafos}
              ${llamada}
              <p style="margin:30px 0 0;padding-top:22px;border-top:1px solid #D4DAE2;color:#6B7482;font-size:11px;line-height:1.7;">Puedes responder directamente a este correo.</p>
            </td>
          </tr>
          <tr>
            <td class="footer-pad" style="padding:25px 42px 34px;background-color:#E6EAF0;border-top:1px solid #CCD3DC;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="footer-col" style="color:#596577;font-size:11px;line-height:1.65;">${firma}</td>
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

export function prepararCorreoEncuesta({
  eventoTitulo,
  nombre,
  url,
  remitente,
}: OpcionesCorreoEncuesta) {
  const nombreLimpio = nombre.trim();
  const eventoLimpio = eventoTitulo.trim();
  const asunto = `Cuéntanos qué te pareció ${eventoLimpio}`;
  const saludo = nombreLimpio ? `Hola, ${nombreLimpio}.` : "Hola.";
  const texto = `${saludo}\n\nGracias por acompañarnos en ${eventoLimpio}. Tu opinión nos ayuda a mejorar los próximos eventos de Alpha. La encuesta toma menos de dos minutos.`;
  const nota = "Tus respuestas son anónimas.";
  return {
    asunto,
    texto: `${texto}\n\nResponder encuesta: ${url}\n\n${nota}`,
    html: renderizarCorreoDashboard({
      asunto,
      texto,
      remitente,
      accion: { etiqueta: "Responder encuesta", url, nota },
    }),
  };
}
