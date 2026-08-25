export const CALLING_LAF = {
  slug: "calling-laf",
  fechaIso: "2026-09-04",
  fechaTexto: "4 de septiembre de 2026",
  fechaCorta: "04 SEP 2026",
  horaTexto: "Por confirmar",
  sede: "SUM 1102",
  campus: "Tec CCM",
  cierreRegistroIso: "2026-09-06T06:00:00.000Z",
} as const;

/**
 * El registro permanece disponible hasta que termina el 5 de septiembre en
 * Ciudad de México. La fecha UTC evita depender de la zona horaria del equipo
 * o del navegador que evalúe el cierre.
 */
export function registroCallingLafDisponible(ahora = Date.now()): boolean {
  return ahora < Date.parse(CALLING_LAF.cierreRegistroIso);
}
