import type { Rol } from "@/convex/lib/validadores";
import type { NombreIcono } from "./iconos";

export const BASE = "/dashboard";

export type Apartado = {
  href: string;
  texto: string;
  icono: NombreIcono;
  /** Rol minimo para verlo. Lo que no se puede usar no se muestra. */
  minimo: Rol;
  /** Clave del contador que la barra muestra a la derecha. */
  contador?: "eventos" | "registrosNuevos" | "correoNoLeido";
  externo?: boolean;
  /** Aparece en la barra inferior del movil. */
  movil?: boolean;
};

const NIVEL: Record<Rol, number> = { lector: 1, editor: 2, admin: 3 };

/** Secciones de trabajo. Los eventos van primero: es el uso principal del panel. */
export const PRINCIPAL: Apartado[] = [
  { href: BASE, texto: "Inicio", icono: "inicio", minimo: "lector", movil: true },
  { href: `${BASE}/eventos`, texto: "Eventos", icono: "eventos", minimo: "lector", contador: "eventos", movil: true },
  { href: `${BASE}/analytics`, texto: "Analytics", icono: "grafica", minimo: "lector", movil: true },
  { href: `${BASE}/registros`, texto: "Registros", icono: "registros", minimo: "lector", contador: "registrosNuevos", movil: true },
  { href: `${BASE}/correo`, texto: "Correo", icono: "correo", minimo: "editor", contador: "correoNoLeido", movil: true },
];

export const SECUNDARIA: Apartado[] = [
  { href: `${BASE}/eventos/programa`, texto: "Programa de trabajo", icono: "programa", minimo: "lector" },
  {
    href: "https://drive.google.com/drive/folders/133n9kJqUPlVfZctiF1zo1k_28grh5nEK",
    texto: "Drive del equipo",
    icono: "carpeta",
    minimo: "lector",
    externo: true,
  },
  { href: `${BASE}/ajustes`, texto: "Ajustes", icono: "ajustes", minimo: "lector", movil: true },
];

export function visibles(apartados: Apartado[], rol: Rol | undefined): Apartado[] {
  const nivel = rol ? NIVEL[rol] : NIVEL.lector;
  return apartados.filter((a) => NIVEL[a.minimo] <= nivel);
}

export function esActivo(href: string, ruta: string): boolean {
  const limpio = href.split("?")[0] ?? href;
  if (limpio === BASE) return ruta === BASE;
  return ruta === limpio || ruta.startsWith(`${limpio}/`);
}

/** Seccion que corresponde a la ruta actual, la mas especifica primero. */
export function apartadoActual(ruta: string): Apartado | undefined {
  const candidatos = [...PRINCIPAL, ...SECUNDARIA].filter((a) => !a.externo && esActivo(a.href, ruta));
  return candidatos.sort((a, b) => b.href.length - a.href.length)[0];
}
