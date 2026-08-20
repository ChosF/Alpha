type OpcionesCorreoDashboard = {
  asunto: string;
  texto: string;
  sitio?: string;
};

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

export function renderizarCorreoDashboard({
  asunto,
  texto,
  sitio,
}: OpcionesCorreoDashboard): string {
  const asuntoSeguro = escaparHtml(asunto);
  const preencabezado = escaparHtml(resumen(texto, 120));
  const parrafos = escaparHtml(texto)
    .split(/\n{2,}/)
    .map(
      (parrafo) =>
        `<p class="message-copy" style="margin:0 0 20px;color:#33445D;font-size:16px;font-weight:400;line-height:1.75;">${parrafo.replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
  const raiz = sitio?.replace(/\/$/, "");
  const marca = raiz
    ? `<td valign="middle" style="width:54px;"><img src="${escaparHtml(`${raiz}/alpha-mark-white.png`)}" width="48" alt="Alpha" style="width:48px;max-width:48px;height:auto;border:0;display:block;"></td>`
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
      .footer-mark { padding-top: 18px !important; text-align: left !important; white-space: normal !important; }
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
                  <td valign="middle" style="${raiz ? "padding-left:12px;" : ""}color:#FFFFFF;font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Alpha</td>
                  <td valign="middle" align="right" style="color:#AFCFFF;font-size:10px;font-weight:600;letter-spacing:2px;white-space:nowrap;">2026 — 2027</td>
                </tr>
              </table>
              <div style="margin-top:38px;color:#79AFFF;font-size:10px;font-weight:600;letter-spacing:2.2px;line-height:1.4;">MENSAJE DE ALPHA</div>
              <h1 class="subject" style="margin:13px 0 0;color:#FFFFFF;font-family:'Poppins',sans-serif;font-size:40px;font-weight:700;letter-spacing:-1.5px;line-height:1.08;">${asuntoSeguro}</h1>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:44px 42px 34px;background-color:#F4F6F8;">
              <div style="width:42px;height:5px;margin:0 0 28px;background-color:#0066FF;font-size:0;line-height:0;">&nbsp;</div>
              ${parrafos}
              <p style="margin:30px 0 0;padding-top:22px;border-top:1px solid #D4DAE2;color:#6B7482;font-size:11px;line-height:1.7;">Puedes responder directamente a este correo. También puedes escribirnos a <a href="mailto:contacto@alphaccm.org" style="color:#194270;font-weight:600;text-decoration:underline;">contacto@alphaccm.org</a>.</p>
            </td>
          </tr>
          <tr>
            <td class="footer-pad" style="padding:25px 42px 34px;background-color:#E6EAF0;border-top:1px solid #CCD3DC;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="footer-col" style="color:#596577;font-size:11px;line-height:1.65;">Sociedad Estudiantil Alpha<br>Tecnológico de Monterrey, Campus Ciudad de México</td>
                  <td class="footer-col footer-mark" align="right" valign="bottom" style="color:#194270;font-size:10px;font-weight:600;letter-spacing:1.7px;white-space:nowrap;">MÁS ALLÁ DEL MERCADO</td>
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
