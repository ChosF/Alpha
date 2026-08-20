import { strToU8, zipSync } from "fflate";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAXIMO_CELDA = 32_767;

function escaparXml(valor: unknown): string {
  const texto =
    valor === null || valor === undefined
      ? ""
      : typeof valor === "string"
        ? valor
        : String(valor);

  return texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, MAXIMO_CELDA)
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

function celda(valor: unknown, fila: number, col: number, estilo: number): string {
  const referencia = `${columna(col)}${fila}`;
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function hoja(encabezados: readonly string[], filas: readonly (readonly unknown[])[]): string {
  const ultimaColumna = columna(Math.max(0, encabezados.length - 1));
  const ultimaFila = Math.max(1, filas.length + 1);
  const anchos = [14, 27, 32, 18, 16, 17, 16, 13, 18, 24, 30, 16, 38, 25];
  const columnas = encabezados
    .map((_, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${anchos[indice] ?? 18}" customWidth="1"/>`)
    .join("");
  const cabecera = encabezados.map((valor, indice) => celda(valor, 1, indice, 1)).join("");
  const cuerpo = filas
    .map((valores, indiceFila) => {
      const numeroFila = indiceFila + 2;
      const celdas = encabezados
        .map((_, indiceColumna) =>
          celda(valores[indiceColumna], numeroFila, indiceColumna, indiceColumna === 12 ? 2 : 0),
        )
        .join("");
      return `<row r="${numeroFila}">${celdas}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columnas}</cols>
  <sheetData><row r="1" ht="25" customHeight="1">${cabecera}</row>${cuerpo}</sheetData>
  <autoFilter ref="A1:${ultimaColumna}${ultimaFila}"/>
</worksheet>`;
}

const TIPOS_CONTENIDO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
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

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><color rgb="FF0D2140"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF194270"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFD4DAE2"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const PROPIEDADES_APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Alpha CCM</Application>
</Properties>`;

function propiedadesBase(creadoEn: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Sociedad Estudiantil Alpha</dc:creator>
  <dc:title>Registros de Alpha</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${creadoEn}</dcterms:created>
</cp:coreProperties>`;
}

export function construirXlsx(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
): Blob {
  const archivos = {
    "[Content_Types].xml": strToU8(TIPOS_CONTENIDO),
    "_rels/.rels": strToU8(RELACIONES_RAIZ),
    "docProps/app.xml": strToU8(PROPIEDADES_APP),
    "docProps/core.xml": strToU8(propiedadesBase(new Date().toISOString())),
    "xl/workbook.xml": strToU8(LIBRO),
    "xl/_rels/workbook.xml.rels": strToU8(RELACIONES_LIBRO),
    "xl/styles.xml": strToU8(ESTILOS),
    "xl/worksheets/sheet1.xml": strToU8(hoja(encabezados, filas)),
  };
  const comprimido = zipSync(archivos, { level: 6 });
  const contenido = new Uint8Array(comprimido.byteLength);
  contenido.set(comprimido);
  return new Blob([contenido.buffer], { type: TIPO_XLSX });
}
