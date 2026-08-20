/**
 * Politica de contrasenas.
 *
 * Se usa tanto en el servidor (Convex Auth la invoca antes de hashear) como en
 * el formulario del panel, para que la persona vea el problema mientras
 * escribe y no despues de enviar. El hash lo hace Convex Auth con scrypt.
 */

export const LARGO_MINIMO = 12;
export const LARGO_MAXIMO = 128;

/**
 * Contrasenas que aparecen en cualquier lista de filtradas y que ademas son
 * plausibles en este contexto. No pretende sustituir a una lista completa:
 * el largo minimo de 12 es la defensa principal.
 */
const PROHIBIDAS = new Set([
  "contrasena123",
  "contrasenia123",
  "password1234",
  "passwordpassword",
  "123456789012",
  "qwertyuiop12",
  "alphaalpha12",
  "tecdemonterrey",
  "sociedadalpha",
  "administrador",
  "alpha20262027",
]);

/** Devuelve null si la contrasena sirve, o el motivo en espanol si no. */
export function validarContrasena(contrasena: string): string | null {
  if (typeof contrasena !== "string" || contrasena.length < LARGO_MINIMO) {
    return `La contrasena debe tener al menos ${LARGO_MINIMO} caracteres.`;
  }
  if (contrasena.length > LARGO_MAXIMO) {
    return `La contrasena no puede pasar de ${LARGO_MAXIMO} caracteres.`;
  }

  const normalizada = contrasena.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (PROHIBIDAS.has(normalizada)) {
    return "Esa contrasena es demasiado comun. Elige otra.";
  }

  const clases = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(contrasena),
  ).length;
  if (clases < 3) {
    return "Combina al menos tres de: minusculas, mayusculas, numeros y simbolos.";
  }

  if (/^(.)\1+$/.test(contrasena)) {
    return "La contrasena no puede ser un solo caracter repetido.";
  }

  return null;
}
