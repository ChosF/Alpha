import { strToU8, zipSync } from "fflate";
import { ALPHA_LOGO_WHITE_PNG_BASE64 } from "./alpha-logo-png";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAXIMO_CELDA = 32_767;
const PREFIJOS_FORMULA = /^[=+\-@\t\r]/;
const FILA_ENCABEZADO_TABLA = 6;

export type DatoResumenXlsx = {
  etiqueta: string;
  valor: string | number;
};

export type OpcionesXlsx = {
  nombreHoja?: string;
  titulo?: string;
  subtitulo?: string;
  meta?: string;
  resumen?: readonly DatoResumenXlsx[];
};

function normalizarClave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sanitizarTextoCelda(valor: unknown, permitirPrefijo = false): string {
  const texto =
    valor === null || valor === undefined
      ? ""
      : typeof valor === "string"
        ? valor
        : String(valor);

  const limpio = texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, MAXIMO_CELDA);

  if (!permitirPrefijo && PREFIJOS_FORMULA.test(limpio)) {
    return `'${limpio}`.slice(0, MAXIMO_CELDA);
  }
  return limpio;
}

function escaparXml(valor: unknown, permitirPrefijo = false): string {
  return sanitizarTextoCelda(valor, permitirPrefijo)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columna(indice: number): string {
  let numero = indice + 1;
  let letras = "";
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    numero = Math.floor((numero - 1) / 26);
  }
  return letras;
}

function decodificarBase64(b64: string): Uint8Array {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

function celda(
  valor: unknown,
  fila: number,
  col: number,
  estilo: number,
  permitirPrefijo = false,
): string {
  const referencia = `${columna(col)}${fila}`;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return `<c r="${referencia}" s="${estilo}" t="n"><v>${valor}</v></c>`;
  }
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor, permitirPrefijo)}</t></is></c>`;
}

function filaCombinada(
  numeroFila: number,
  altura: number,
  totalColumnas: number,
  texto: string,
  estilo: number,
): string {
  const celdas: string[] = [celda(texto, numeroFila, 0, estilo, true)];
  for (let c = 1; c < totalColumnas; c += 1) {
    celdas.push(`<c r="${columna(c)}${numeroFila}" s="${estilo}"/>`);
  }
  return `<row r="${numeroFila}" ht="${altura}" customHeight="1">${celdas.join("")}</row>`;
}

type RolColumna =
  | "nombre"
  | "estado"
  | "moneda"
  | "centrado"
  | "multilinea"
  | "texto";

function clasificarColumna(encabezado: string): RolColumna {
  const clave = normalizarClave(encabezado);
  if (clave === "nombre" || clave === "asistente" || clave === "integrante") {
    return "nombre";
  }
  if (
    clave === "estado" ||
    clave === "verificacion" ||
    clave === "pago" ||
    clave === "estatus"
  ) {
    return "estado";
  }
  if (clave.includes("monto") || clave.includes("cuota") || clave.includes("precio")) {
    return "moneda";
  }
  if (
    clave === "notas" ||
    clave === "intereses" ||
    clave === "habilidades" ||
    clave === "aporte" ||
    clave === "comentarios" ||
    clave === "resumen"
  ) {
    return "multilinea";
  }
  if (
    clave === "#" ||
    clave === "no." ||
    clave === "folio" ||
    clave === "semestre" ||
    clave === "matricula" ||
    clave === "correo autorizado" ||
    clave === "avisos correo" ||
    clave === "whatsapp" ||
    clave === "cv" ||
    clave === "tipo" ||
    clave === "gafete" ||
    clave === "metodo de pago"
  ) {
    return "centrado";
  }
  return "texto";
}

function estiloPastillaEstado(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const clave = normalizarClave(valor);
  if (!clave || clave === "—") return null;

  if (
    clave === "asistio" ||
    clave === "pagado" ||
    clave === "verificado" ||
    clave === "aprobada" ||
    clave === "aprobado" ||
    clave === "cortesia" ||
    clave === "aceptado" ||
    clave === "confirmado"
  ) {
    return 17;
  }
  if (
    clave === "registrado" ||
    clave === "nuevo" ||
    clave === "contactado" ||
    clave === "en linea"
  ) {
    return 18;
  }
  if (
    clave === "pendiente" ||
    clave === "por verificar" ||
    clave === "en revision"
  ) {
    return 19;
  }
  if (
    clave === "cancelado" ||
    clave === "no asistio" ||
    clave === "rechazado" ||
    clave === "rechazada" ||
    clave === "descartado"
  ) {
    return 20;
  }
  return null;
}

function estiloCeldaDatos(
  rol: RolColumna,
  valor: unknown,
  esFilaPar: boolean,
): number {
  if (rol === "estado") {
    const pastilla = estiloPastillaEstado(valor);
    if (pastilla !== null) return pastilla;
    return esFilaPar ? 14 : 13;
  }
  if (rol === "moneda" && typeof valor === "number" && Number.isFinite(valor)) {
    return esFilaPar ? 16 : 15;
  }
  if (rol === "nombre") {
    return esFilaPar ? 12 : 11;
  }
  if (rol === "multilinea") {
    return esFilaPar ? 10 : 2;
  }
  if (rol === "centrado") {
    return esFilaPar ? 14 : 13;
  }
  return esFilaPar ? 9 : 0;
}

function calcularAnchosColumnas(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
  roles: readonly RolColumna[],
): number[] {
  return encabezados.map((encabezado, indice) => {
    const rol = roles[indice] ?? "texto";
    let maxLongitud = encabezado.trim().length;

    for (const fila of filas) {
      const valor = fila[indice];
      if (valor === null || valor === undefined) continue;
      const texto = typeof valor === "number" ? `$${valor} MXN` : String(valor);
      const lineaMasLarga = texto
        .split(/\r?\n/)
        .reduce((max, linea) => Math.max(max, linea.trim().length), 0);
      if (lineaMasLarga > maxLongitud) {
        maxLongitud = lineaMasLarga;
      }
    }

    const minimo =
      rol === "nombre"
        ? 26
        : rol === "multilinea"
          ? 30
          : rol === "estado"
            ? 16
            : rol === "centrado"
              ? 14
              : 18;
    const maximo =
      rol === "multilinea"
        ? 46
        : rol === "nombre"
          ? 36
          : rol === "centrado" || rol === "estado" || rol === "moneda"
            ? 22
            : 38;

    const estimado = Math.max(encabezado.trim().length + 5, Math.ceil(maxLongitud * 1.12) + 4);
    return Math.min(maximo, Math.max(minimo, estimado));
  });
}

function formatearMarcaTiempoExportacion(fecha: Date): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    }).format(fecha);
  } catch {
    return fecha.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function formatearFechaHoraExcel(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function construirTextoResumen(
  filas: readonly (readonly unknown[])[],
  opciones: OpcionesXlsx,
  creadoEn: Date,
): string {
  const segmentos: string[] = ["RESUMEN"];

  if (opciones.resumen && opciones.resumen.length > 0) {
    for (const item of opciones.resumen) {
      segmentos.push(`${item.etiqueta}: ${item.valor}`);
    }
  } else {
    segmentos.push(`Total de registros: ${filas.length}`);
  }

  if (opciones.meta?.trim()) {
    segmentos.push(opciones.meta.trim());
  }

  segmentos.push(`Exportado: ${formatearMarcaTiempoExportacion(creadoEn)}`);
  return segmentos.join("   ·   ");
}

function hoja(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
  opciones: OpcionesXlsx,
  creadoEn: Date,
): string {
  const totalColumnasTabla = Math.max(1, encabezados.length);
  const totalColumnasBanner = Math.max(totalColumnasTabla, 6);
  const ultimaColumnaTabla = columna(totalColumnasTabla - 1);
  const ultimaColumnaBanner = columna(totalColumnasBanner - 1);
  const ultimaFila = Math.max(FILA_ENCABEZADO_TABLA, FILA_ENCABEZADO_TABLA + filas.length);

  const roles = encabezados.map(clasificarColumna);
  const anchos = calcularAnchosColumnas(encabezados, filas, roles);
  const definicionColumnas: string[] = anchos.map(
    (ancho, indice) =>
      `<col min="${indice + 1}" max="${indice + 1}" width="${ancho}" customWidth="1"/>`,
  );
  for (let extra = totalColumnasTabla; extra < totalColumnasBanner; extra += 1) {
    definicionColumnas.push(
      `<col min="${extra + 1}" max="${extra + 1}" width="18" customWidth="1"/>`,
    );
  }

  const textoMarcaSuperior =
    "               ALPHA   ·   SOCIEDAD ESTUDIANTIL DE FINANZAS   ·   TECNOLÓGICO DE MONTERREY, CAMPUS CIUDAD DE MÉXICO";
  const tituloPrincipal = (
    opciones.titulo?.trim() ||
    opciones.nombreHoja?.trim() ||
    "Registro de asistentes"
  ).toUpperCase();
  const subtituloBanner =
    opciones.subtitulo?.trim() ||
    "Sociedad Estudiantil Alpha · Gestión y seguimiento de registros · 2026–2027";
  const textoResumen = construirTextoResumen(filas, opciones, creadoEn);

  const fila1 = filaCombinada(1, 38, totalColumnasBanner, textoMarcaSuperior, 3);
  const fila2 = filaCombinada(2, 30, totalColumnasBanner, tituloPrincipal, 4);
  const fila3 = filaCombinada(3, 22, totalColumnasBanner, subtituloBanner, 5);
  const fila4 = filaCombinada(4, 24, totalColumnasBanner, textoResumen, 6);
  const fila5 = filaCombinada(5, 10, totalColumnasBanner, "", 7);

  const celdasCabeceraTabla = encabezados
    .map((valor, indice) => {
      const rol = roles[indice];
      const estiloCabecera =
        rol === "centrado" || rol === "estado" || rol === "moneda" ? 8 : 1;
      return celda(valor, FILA_ENCABEZADO_TABLA, indice, estiloCabecera);
    })
    .join("");
  const fila6 = `<row r="${FILA_ENCABEZADO_TABLA}" ht="28" customHeight="1">${celdasCabeceraTabla}</row>`;

  const cuerpo = filas
    .map((valores, indiceFila) => {
      const numeroFila = FILA_ENCABEZADO_TABLA + 1 + indiceFila;
      const esFilaPar = indiceFila % 2 === 1;
      const celdas = encabezados
        .map((_, indiceColumna) => {
          const valor = valores[indiceColumna];
          const rol = roles[indiceColumna] ?? "texto";
          const estilo = estiloCeldaDatos(rol, valor, esFilaPar);
          return celda(valor, numeroFila, indiceColumna, estilo);
        })
        .join("");
      return `<row r="${numeroFila}" ht="24" customHeight="1">${celdas}</row>`;
    })
    .join("");

  const celdasCombinadas =
    totalColumnasBanner > 1
      ? `<mergeCells count="5">
    <mergeCell ref="A1:${ultimaColumnaBanner}1"/>
    <mergeCell ref="A2:${ultimaColumnaBanner}2"/>
    <mergeCell ref="A3:${ultimaColumnaBanner}3"/>
    <mergeCell ref="A4:${ultimaColumnaBanner}4"/>
    <mergeCell ref="A5:${ultimaColumnaBanner}5"/>
  </mergeCells>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${ultimaColumnaBanner}${ultimaFila}"/>
  <sheetViews>
    <sheetView workbookViewId="0" showGridLines="1">
      <pane ySplit="${FILA_ENCABEZADO_TABLA}" topLeftCell="A${FILA_ENCABEZADO_TABLA + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="24"/>
  <cols>${definicionColumnas.join("")}</cols>
  <sheetData>${fila1}${fila2}${fila3}${fila4}${fila5}${fila6}${cuerpo}</sheetData>
  <autoFilter ref="A${FILA_ENCABEZADO_TABLA}:${ultimaColumnaTabla}${ultimaFila}"/>
  ${celdasCombinadas}
  <pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <drawing r:id="rId1"/>
</worksheet>`;
}

const TIPOS_CONTENIDO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const RELACIONES_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const LIBRO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Registros" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const RELACIONES_LIBRO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const RELACIONES_HOJA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

const RELACIONES_DIBUJO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/alpha-logo.png"/>
</Relationships>`;

/**
 * Logo oficial Alpha (360x248, proporcion 45:31) anclado en la esquina superior
 * izquierda del encabezado azul marino (#0D2140) en la fila 1.
 */
const DIBUJO_LOGO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>0</xdr:col>
      <xdr:colOff>133350</xdr:colOff>
      <xdr:row>0</xdr:row>
      <xdr:rowOff>66675</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="495300" cy="341207"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="Logo Alpha" descr="Sociedad Estudiantil Alpha"/>
        <xdr:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="495300" cy="341207"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0&quot; MXN&quot;"/>
  </numFmts>
  <fonts count="11">
    <font><sz val="9.5"/><color rgb="FF0D2140"/><name val="Montserrat"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Poppins"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Poppins"/><family val="2"/></font>
    <font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Poppins"/><family val="2"/></font>
    <font><sz val="9.5"/><color rgb="FFAFCFFF"/><name val="Montserrat"/><family val="2"/></font>
    <font><b/><sz val="9.5"/><color rgb="FF194270"/><name val="Montserrat"/><family val="2"/></font>
    <font><b/><sz val="9.5"/><color rgb="FF0D2140"/><name val="Montserrat"/><family val="2"/></font>
    <font><b/><sz val="9"/><color rgb="FF146C43"/><name val="Poppins"/><family val="2"/></font>
    <font><b/><sz val="9"/><color rgb="FF16459C"/><name val="Poppins"/><family val="2"/></font>
    <font><b/><sz val="9"/><color rgb="FF9A5B00"/><name val="Poppins"/><family val="2"/></font>
    <font><b/><sz val="9"/><color rgb="FFB42318"/><name val="Poppins"/><family val="2"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0D2140"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF194270"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF1FA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F5EE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF4FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF6E5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCECEC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="6">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFEDF1F7"/></left>
      <right style="thin"><color rgb="FFEDF1F7"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF24528A"/></left>
      <right style="thin"><color rgb="FF24528A"/></right>
      <top style="thin"><color rgb="FF0D2140"/></top>
      <bottom style="medium"><color rgb="FF0066FF"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left/><right/><top/>
      <bottom style="medium"><color rgb="FF0066FF"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left/><right/>
      <top style="medium"><color rgb="FF0066FF"/></top>
      <bottom style="thin"><color rgb="FFB6D0FF"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFD5D9E0"/></left>
      <right style="thin"><color rgb="FFD5D9E0"/></right>
      <top style="thin"><color rgb="FFD5D9E0"/></top>
      <bottom style="thin"><color rgb="FFD5D9E0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="21">
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" indent="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" indent="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" indent="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="164" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="right"/></xf>
    <xf numFmtId="164" fontId="6" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="right"/></xf>
    <xf numFmtId="0" fontId="7" fillId="7" borderId="5" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="8" borderId="5" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="9" borderId="5" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="10" borderId="5" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const PROPIEDADES_APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Sociedad Estudiantil Alpha · Tec de Monterrey CCM</Application>
  <Company>Sociedad Estudiantil Alpha</Company>
</Properties>`;

function propiedadesBase(creadoEn: string, titulo: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Sociedad Estudiantil Alpha · Tec de Monterrey CCM</dc:creator>
  <dc:title>${escaparXml(titulo, true)}</dc:title>
  <dc:subject>Registros de Sociedad Estudiantil Alpha</dc:subject>
  <dcterms:created xsi:type="dcterms:W3CDTF">${creadoEn}</dcterms:created>
</cp:coreProperties>`;
}

export function construirXlsx(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
  opcionesONombreHoja: string | OpcionesXlsx = "Registros",
): Blob {
  const opciones: OpcionesXlsx =
    typeof opcionesONombreHoja === "string"
      ? { nombreHoja: opcionesONombreHoja }
      : opcionesONombreHoja;

  const nombreHojaLimpio =
    (opciones.nombreHoja ?? opciones.titulo ?? "Registros")
      .replace(/[\\/?*\[\]:]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Registros";

  const ahora = new Date();
  const tituloDocumento = opciones.titulo?.trim()
    ? `Alpha · ${opciones.titulo.trim()}`
    : `Alpha · ${nombreHojaLimpio}`;

  const archivos: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    "[Content_Types].xml": strToU8(TIPOS_CONTENIDO),
    "_rels/.rels": strToU8(RELACIONES_RAIZ),
    "docProps/app.xml": strToU8(PROPIEDADES_APP),
    "docProps/core.xml": strToU8(propiedadesBase(ahora.toISOString(), tituloDocumento)),
    "xl/workbook.xml": strToU8(
      LIBRO.replace('name="Registros"', `name="${escaparXml(nombreHojaLimpio, true)}"`),
    ),
    "xl/_rels/workbook.xml.rels": strToU8(RELACIONES_LIBRO),
    "xl/styles.xml": strToU8(ESTILOS),
    "xl/worksheets/sheet1.xml": strToU8(hoja(encabezados, filas, opciones, ahora)),
    "xl/worksheets/_rels/sheet1.xml.rels": strToU8(RELACIONES_HOJA),
    "xl/drawings/drawing1.xml": strToU8(DIBUJO_LOGO),
    "xl/drawings/_rels/drawing1.xml.rels": strToU8(RELACIONES_DIBUJO),
    "xl/media/alpha-logo.png": [decodificarBase64(ALPHA_LOGO_WHITE_PNG_BASE64), { level: 0 }],
  };

  const comprimido = zipSync(archivos, { level: 6 });
  const contenido = new Uint8Array(comprimido.byteLength);
  contenido.set(comprimido);
  return new Blob([contenido.buffer], { type: TIPO_XLSX });
}
