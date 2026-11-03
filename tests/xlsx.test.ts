import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { construirXlsx, formatearFechaHoraExcel } from "@/lib/xlsx";

async function descomprimirXlsx(blob: Blob): Promise<Record<string, Uint8Array>> {
  const buffer = await blob.arrayBuffer();
  return unzipSync(new Uint8Array(buffer));
}

describe("construccion de archivo Excel (.xlsx) con identidad Alpha", () => {
  it("incrusta el logo oficial de Alpha en PNG, el encabezado de marca y la tipografia Poppins/Montserrat", async () => {
    const encabezados = [
      "Nombre",
      "Correo",
      "Carrera",
      "Semestre",
      "Matrícula",
      "Estado",
      "Pago",
      "Monto MXN",
      "Notas",
    ];
    const filas = [
      [
        "Mariela López",
        "mariela@tec.mx",
        "LAF",
        "6",
        "A01650001",
        "Asistió",
        "Pagado",
        70,
        "confirmó en recepción",
      ],
      [
        "Juan Pablo",
        "juanpa@tec.mx",
        "LFE",
        "5",
        "A01650002",
        "Pendiente",
        "Pendiente",
        70,
        "pago en efectivo al llegar",
      ],
    ];

    const blob = construirXlsx(encabezados, filas, {
      nombreHoja: "Networking Night",
      titulo: "Networking Night — Registro de asistentes",
      subtitulo: "22 de octubre de 2026   ·   18:30–21:30   ·   SUM 1102, Tec CCM",
      meta: "Filtro: Todos los estados",
      resumen: [
        { etiqueta: "Total exportados", valor: 2 },
        { etiqueta: "Asistieron", valor: 1 },
        { etiqueta: "Recaudado", valor: "$70 MXN" },
      ],
    });

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const archivos = await descomprimirXlsx(blob);

    // 1. Verifica que el logo PNG oficial esté incrustado con dimensiones exactas 360x248
    const logoBytes = archivos["xl/media/alpha-logo.png"];
    expect(logoBytes).toBeDefined();
    expect(Array.from(logoBytes!.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const vistaLogo = new DataView(
      logoBytes!.buffer,
      logoBytes!.byteOffset,
      logoBytes!.byteLength,
    );
    expect(vistaLogo.getUint32(16, false)).toBe(360);
    expect(vistaLogo.getUint32(20, false)).toBe(248);

    // 2. Verifica relaciones de DrawingML e imagen
    const drawingXml = strFromU8(archivos["xl/drawings/drawing1.xml"]!);
    expect(drawingXml).toContain('name="Logo Alpha"');
    expect(drawingXml).toContain('noChangeAspect="1"');
    const drawingRels = strFromU8(archivos["xl/drawings/_rels/drawing1.xml.rels"]!);
    expect(drawingRels).toContain('Target="../media/alpha-logo.png"');

    // 3. Verifica tipografías y paleta de marca en styles.xml
    const estilosXml = strFromU8(archivos["xl/styles.xml"]!);
    expect(estilosXml).toContain('<name val="Poppins"/>');
    expect(estilosXml).toContain('<name val="Montserrat"/>');
    expect(estilosXml).toContain('rgb="FF0D2140"');
    expect(estilosXml).toContain('rgb="FF194270"');
    expect(estilosXml).toContain('rgb="FF0066FF"');
    expect(estilosXml).toContain('rgb="FFAFCFFF"');

    // 4. Verifica el contenido de la hoja: nombre de Alpha arriba, título del evento, resumen y tabla en fila 6
    const hojaXml = strFromU8(archivos["xl/worksheets/sheet1.xml"]!);
    expect(hojaXml).toContain(
      "ALPHA   ·   SOCIEDAD ESTUDIANTIL DE FINANZAS   ·   TECNOLÓGICO DE MONTERREY, CAMPUS CIUDAD DE MÉXICO",
    );
    expect(hojaXml).toContain("NETWORKING NIGHT — REGISTRO DE ASISTENTES");
    expect(hojaXml).toContain("22 de octubre de 2026");
    expect(hojaXml).toContain("Total exportados: 2");
    expect(hojaXml).toContain('<pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/>');
    expect(hojaXml).toContain('<autoFilter ref="A6:I8"/>');
    expect(hojaXml).toContain('<drawing r:id="rId1"/>');

    // 5. Verifica celdas numéricas de moneda y pastillas de estado semánticas
    expect(hojaXml).toContain('<c r="H7" s="15" t="n"><v>70</v></c>');
    expect(hojaXml).toContain('<c r="F7" s="17" t="inlineStr">');
    expect(hojaXml).toContain('<c r="F8" s="19" t="inlineStr">');
  });

  it("neutraliza prefijos de fórmulas en datos provenientes del usuario", async () => {
    const blob = construirXlsx(
      ["Nombre", "Notas"],
      [["=CMD|' /C calc'!A0", "@SUM(A1:A10)"]],
      "Seguridad",
    );
    const archivos = await descomprimirXlsx(blob);
    const hojaXml = strFromU8(archivos["xl/worksheets/sheet1.xml"]!);

    expect(hojaXml).toContain("&apos;=CMD|&apos; /C calc&apos;!A0");
    expect(hojaXml).toContain("&apos;@SUM(A1:A10)");
  });

  it("formatea marcas de tiempo legibles en español de México", () => {
    const fechaFormateada = formatearFechaHoraExcel(Date.UTC(2026, 9, 22, 18, 30, 0));
    expect(fechaFormateada).toContain("2026");
    expect(fechaFormateada).toContain("12:30");
  });
});
