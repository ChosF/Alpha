/**
 * Saneado de texto del lado del servidor.
 *
 * Convex no es SQL, asi que no hay inyeccion de consulta posible; lo que si
 * hay que evitar es guardar basura que despues rompa una exportacion o se
 * cuele en un cliente que no escape. React escapa por si mismo, pero el CSV
 * abierto en Excel no, y los caracteres de control ensucian cualquier salida.
 *
 * Los rangos se comparan por codigo y no con una expresion regular: asi el
 * archivo fuente queda en ASCII puro y no depende de que un editor conserve
 * caracteres invisibles literales.
 */

/** Control C0/C1, excepto tabulador (9), salto de linea (10) y retorno (13). */
function esControl(cp: number): boolean {
  if (cp === 9 || cp === 10 || cp === 13) return false;
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
}

/** Ancho cero, marcas bidi y BOM: se usan para ofuscar o para inyectar texto. */
function esInvisible(cp: number): boolean {
  return (
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    cp === 0xfeff
  );
}

function quitarPeligrosos(valor: string): string {
  let salida = "";
  for (const caracter of valor) {
    const cp = caracter.codePointAt(0);
    if (cp === undefined) continue;
    if (esControl(cp) || esInvisible(cp)) continue;
    salida += caracter;
  }
  return salida;
}

/** Quita control e invisibles, colapsa espacios y recorta. */
export function limpiarTexto(valor: string, maximo: number): string {
  return quitarPeligrosos(valor).replace(/\s+/g, " ").trim().slice(0, maximo);
}

/** Igual que limpiarTexto pero conserva los saltos de linea (notas, aporte). */
export function limpiarMultilinea(valor: string, maximo: number): string {
  return quitarPeligrosos(valor)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximo);
}

/**
 * Limpia un fragmento de texto enriquecido sin quitar los espacios de sus bordes.
 * Los bordes importan porque varios fragmentos contiguos forman una sola frase.
 */
export function limpiarFragmentoMultilinea(valor: string, maximo: number): string {
  return quitarPeligrosos(valor).replace(/\r\n?/g, "\n").slice(0, maximo);
}

/** Minusculas, sin espacios. Es la forma canonica con la que se de-duplica. */
export function normalizarCorreo(correo: string): string {
  return quitarPeligrosos(correo).trim().toLowerCase();
}

/** Deja solo digitos y se queda con los ultimos 10 (formato nacional). */
export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length > 10 ? digitos.slice(-10) : digitos;
}

/**
 * Comparacion en tiempo constante. Evita que un atacante deduzca el secreto
 * midiendo cuanto tarda en fallar la comparacion.
 */
export function comparaSegura(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // La diferencia de longitud se acumula en vez de cortar antes de tiempo.
  let diferencia = a.length ^ b.length;
  const largo = Math.max(a.length, b.length);
  for (let i = 0; i < largo; i++) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

/** SHA-256 en hexadecimal. Disponible en el runtime de Convex y en Node. */
export async function sha256Hex(valor: string): Promise<string> {
  const datos = new TextEncoder().encode(valor);
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
