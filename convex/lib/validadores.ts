import { v } from "convex/values";

/**
 * Uniones cerradas compartidas por el esquema y por los argumentos de cada
 * funcion. Al ser literales, Convex rechaza cualquier valor fuera de la lista
 * antes de que el handler corra.
 */

export const AREAS = [
  "operaciones",
  "comunicacion",
  "finanzas",
  "patrocinios",
  "responsabilidad",
  "alphanalisis",
] as const;

export const ROLES = ["admin", "editor", "lector"] as const;

export const ESTADOS_REGISTRO = ["nuevo", "contactado", "activo", "baja"] as const;

export const ESTADOS_PROGRAMA = ["planeacion", "propuesto", "exploratorio"] as const;

export const PILARES = ["desarrollo", "industria", "comunidad"] as const;

export const TIPOS_REGISTRO = ["miembro", "aliado"] as const;

export type Area = (typeof AREAS)[number];
export type Rol = (typeof ROLES)[number];
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number];
export type Pilar = (typeof PILARES)[number];
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];

export const areaValidador = v.union(...AREAS.map((a) => v.literal(a)));
export const rolValidador = v.union(...ROLES.map((r) => v.literal(r)));
export const estadoRegistroValidador = v.union(...ESTADOS_REGISTRO.map((e) => v.literal(e)));
export const estadoProgramaValidador = v.union(...ESTADOS_PROGRAMA.map((e) => v.literal(e)));
export const pilarValidador = v.union(...PILARES.map((p) => v.literal(p)));
export const tipoRegistroValidador = v.union(...TIPOS_REGISTRO.map((t) => v.literal(t)));

/** Etiquetas en espanol para el panel y las exportaciones. */
export const ETIQUETAS: Record<string, string> = {
  operaciones: "Operaciones y Logistica",
  comunicacion: "Comunicacion",
  finanzas: "Finanzas",
  patrocinios: "Patrocinios",
  responsabilidad: "Responsabilidad Social",
  alphanalisis: "Alphanalisis",
  admin: "Administrador",
  editor: "Editor",
  lector: "Lector",
  nuevo: "Nuevo",
  contactado: "Contactado",
  activo: "Activo",
  baja: "Baja",
  planeacion: "En planeacion",
  propuesto: "Propuesto",
  exploratorio: "Exploratorio",
  desarrollo: "Desarrollo profesional",
  industria: "Conexion con la industria",
  comunidad: "Inclusion y comunidad",
  miembro: "Miembro",
  aliado: "Aliado",
};
