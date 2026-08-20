import { describe, expect, it } from "vitest";
import { construirCsv, escaparCelda, filaCsv } from "@/lib/csv";

/**
 * Inyeccion de formulas en CSV.
 *
 * Es el riesgo real de la exportacion: el archivo lo abre alguien del equipo
 * en Excel, y una celda que empiece con = se ejecuta. El nombre lo escribe un
 * desconocido desde la landing, asi que hay que tratarlo como hostil.
 */
describe("escape de celdas", () => {
  it("neutraliza los prefijos que Excel interpreta como formula", () => {
    expect(escaparCelda("=HYPERLINK(\"http://malo\",\"clic\")")).toBe(
      "\"'=HYPERLINK(\"\"http://malo\"\",\"\"clic\"\")\"",
    );
    expect(escaparCelda("+1234")).toBe("\"'+1234\"");
    expect(escaparCelda("-1+1")).toBe("\"'-1+1\"");
    expect(escaparCelda("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(escaparCelda("\tcmd")).toBe("\"'\tcmd\"");
  });

  it("deja intacto el texto normal, solo entrecomillado", () => {
    expect(escaparCelda("Mariela")).toBe('"Mariela"');
    expect(escaparCelda("LAF, 3.er semestre")).toBe('"LAF, 3.er semestre"');
  });

  it("duplica las comillas internas segun el RFC 4180", () => {
    expect(escaparCelda('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it("convierte vacios y numeros sin romperse", () => {
    expect(escaparCelda(null)).toBe('""');
    expect(escaparCelda(undefined)).toBe('""');
    expect(escaparCelda(42)).toBe('"42"');
    expect(escaparCelda(false)).toBe('"false"');
  });

  it("elimina caracteres de control que romperian el archivo", () => {
    expect(escaparCelda(`a${String.fromCharCode(0)}b`)).toBe('"ab"');
  });
});

describe("construccion del archivo", () => {
  it("separa con comas y termina las filas con CRLF", () => {
    expect(filaCsv(["a", "b"])).toBe('"a","b"');
    const csv = construirCsv(["Nombre", "Correo"], [["Ana", "a@tec.mx"]]);
    expect(csv).toContain('"Nombre","Correo"\r\n"Ana","a@tec.mx"');
  });

  it("empieza con la marca de orden de bytes para que Excel lea UTF-8", () => {
    const csv = construirCsv(["Carrera"], [["Ingenieria en Administracion"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("una coma o un salto de linea no parten la fila", () => {
    const csv = construirCsv(["Notas"], [["Habló con Ivan,\nqueda pendiente"]]);
    const lineas = csv.split("\r\n");
    // Encabezado + una fila que internamente contiene el salto entre comillas.
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toContain("queda pendiente");
  });
});
