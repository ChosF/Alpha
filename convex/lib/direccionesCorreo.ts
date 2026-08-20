import { normalizarCorreo } from "./texto";

const ALIAS_MANUALES = ["direccion@alphaccm.org", "finanzas@alphaccm.org"] as const;

export function correoContacto(): string {
  return normalizarCorreo(process.env.ALPHA_CONTACT_EMAIL ?? "contacto@alphaccm.org");
}

export function remitentesManuales(): string[] {
  return Array.from(new Set([correoContacto(), ...ALIAS_MANUALES]));
}

export function esRemitenteManual(correo: string): boolean {
  return remitentesManuales().includes(normalizarCorreo(correo));
}
