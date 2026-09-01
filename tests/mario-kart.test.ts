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
});
