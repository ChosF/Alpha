/**
 * Exportacion a CSV.
 *
 * El punto delicado no es el formato sino la inyeccion de formulas: Excel y
 * Sheets ejecutan el contenido de una celda que empieza con = + - @ o con
 * tabulador/retorno. Un registro cuyo nombre sea "=HYPERLINK(...)" se
 * convierte en un ataque contra quien abre la exportacion. Por eso toda celda
 * que empiece asi se neutraliza con una comilla simple al frente.
 */

const PELIGROSOS = ["=", "+", "-", "@", "\t", "\r"];

/** Control C0/C1 salvo tabulador y salto de linea, que el CSV si admite. */
function esControlNoImprimible(cp: number): boolean {
  if (cp === 9 || cp === 10) return false;
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
}

function quitarControl(texto: string): string {
  let salida = "";
  for (const caracter of texto) {
    const cp = caracter.codePointAt(0);
    if (cp !== undefined && esControlNoImprimible(cp)) continue;
    salida += caracter;
  }
  return salida;
}

export function escaparCelda(valor: unknown): string {
  let texto =
    valor === null || valor === undefined
      ? ""
      : typeof valor === "string"
        ? valor
        : String(valor);

  texto = quitarControl(texto);

  if (PELIGROSOS.includes(texto.charAt(0))) {
    texto = `'${texto}`;
  }

  // Siempre entre comillas: evita que una coma, un salto o un punto y coma
  // partan la fila. Las comillas internas se duplican, como manda el RFC 4180.
  return `"${texto.replace(/"/g, '""')}"`;
}

export function filaCsv(celdas: readonly unknown[]): string {
  return celdas.map(escaparCelda).join(",");
}

/** Marca de orden de bytes: hace que Excel en Windows lea el archivo como UTF-8. */
const BOM = String.fromCharCode(0xfeff);

export function construirCsv(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
): string {
  return BOM + [filaCsv(encabezados), ...filas.map(filaCsv)].join("\r\n");
}
