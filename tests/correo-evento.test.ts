import { describe, expect, it } from "vitest";
import {
  asuntoRecordatorioEvento,
  esFechaEventoValida,
  esHoraEventoValida,
  fechaEnCiudadDeMexico,
  textoRecordatorioEvento,
} from "@/lib/correo-evento";

describe("recordatorio de eventos", () => {
  it("crea el asunto y el mensaje preestablecidos con los datos del evento", () => {
    const asunto = asuntoRecordatorioEvento("Calling LAF");
    const texto = textoRecordatorioEvento(
      {
        titulo: "Calling LAF",
        fechaEvento: "2026-09-04",
        horaInicio: "15:00",
        horaFin: "17:00",
        sede: "SUM 1102, Tec CCM",
      },
      "Aaron",
    );

    expect(asunto).toBe("¡ES HOY! Te esperamos en Calling LAF");
    expect(texto).toContain("Hola, Aaron.");
    expect(texto).toContain("4 de septiembre de 2026");
    expect(texto).toContain("Hora: 15:00\u201317:00");
    expect(texto).toContain("Lugar: SUM 1102, Tec CCM");
  });

  it("calcula el día de entrega en horario de Ciudad de México", () => {
    expect(fechaEnCiudadDeMexico(Date.parse("2026-09-05T05:30:00.000Z"))).toBe("2026-09-04");
    expect(fechaEnCiudadDeMexico(Date.parse("2026-09-05T06:30:00.000Z"))).toBe("2026-09-05");
  });

  it("rechaza fechas y horas imposibles", () => {
    expect(esFechaEventoValida("2026-02-29")).toBe(false);
    expect(esFechaEventoValida("2028-02-29")).toBe(true);
    expect(esHoraEventoValida("23:59")).toBe(true);
    expect(esHoraEventoValida("24:00")).toBe(false);
  });
});
