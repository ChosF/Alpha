import { describe, expect, it } from "vitest";
import { MARIO_KART_CHALLENGE } from "@/lib/mario-kart";

describe("datos de Mario Kart Challenge", () => {
  it("centraliza la fecha, la hora y la sede confirmadas", () => {
    expect(MARIO_KART_CHALLENGE).toMatchObject({
      fechaIso: "2026-09-21",
      fechaTexto: "21 de septiembre de 2026",
      horaTexto: "13:00–17:00",
      sede: "SUM 2103",
      campus: "Tec CCM",
    });
  });

  it("abre Google Calendar con los datos del evento en lugar de descargar un archivo", () => {
    const calendario = new URL(MARIO_KART_CHALLENGE.calendarioUrl);

    expect(calendario.origin).toBe("https://calendar.google.com");
    expect(calendario.pathname).toBe("/calendar/render");
    expect(calendario.searchParams.get("action")).toBe("TEMPLATE");
    expect(calendario.searchParams.get("text")).toBe("Mario Kart Challenge");
    expect(calendario.searchParams.get("dates")).toBe(
      "20260921T190000Z/20260921T230000Z",
    );
    expect(calendario.searchParams.get("location")).toContain("SUM 2103");
    expect(calendario.searchParams.get("ctz")).toBe("America/Mexico_City");
  });
});
