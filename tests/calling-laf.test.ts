import { describe, expect, it } from "vitest";
import { CALLING_LAF, registroCallingLafDisponible } from "@/lib/calling-laf";

describe("vigencia de Calling LAF", () => {
  it("mantiene el registro abierto durante el 5 de septiembre en Ciudad de México", () => {
    expect(registroCallingLafDisponible(Date.parse("2026-09-06T05:59:59.999Z"))).toBe(true);
  });

  it("cierra el registro al comenzar el 6 de septiembre en Ciudad de México", () => {
    expect(registroCallingLafDisponible(Date.parse(CALLING_LAF.cierreRegistroIso))).toBe(false);
    expect(registroCallingLafDisponible(Date.parse("2026-09-06T06:00:00.001Z"))).toBe(false);
  });
});
