import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Utilidades de seguridad del lado del servidor de Next.
 *
 * Aqui es el unico punto del sistema donde existe la IP del visitante. Nunca
 * se guarda en claro: sale de aqui convertida en hash con sal, que sirve para
 * contar y correlacionar sin identificar a nadie.
 */

/** Ventana en la que un token de formulario es valido. */
export const TOKEN_MIN_MS = 2_500; // menos que esto es un bot llenando al instante
export const TOKEN_MAX_MS = 30 * 60 * 1000; // media hora para llenar el formulario

function exigirSecreto(nombre: "INGEST_SECRET" | "IP_SALT"): string {
  const valor = process.env[nombre];
  if (typeof valor !== "string" || valor.length < 32) {
    throw new Error(
      `Falta la variable de entorno ${nombre} (o es demasiado corta). Revisa .env.example.`,
    );
  }
  return valor;
}

/** IP del visitante segun las cabeceras de Vercel. */
export function ipDePeticion(headers: Headers): string {
  const adelantada = headers.get("x-forwarded-for");
  if (adelantada !== null && adelantada.length > 0) {
    // El primer valor es el cliente; los siguientes son proxies.
    const primera = adelantada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return headers.get("x-real-ip") ?? "desconocida";
}

/** SHA-256 de IP + sal. Irreversible sin la sal. */
export function hashDeIp(ip: string): string {
  return createHash("sha256").update(`${exigirSecreto("IP_SALT")}:${ip}`).digest("hex");
}

/**
 * Token de formulario firmado por el servidor.
 *
 * Se emite cuando la persona abre la ventana de registro y se verifica al
 * enviar. Al ir firmado y atado al hash de IP, no se puede fabricar desde
 * fuera ni reutilizar desde otra red, y la marca de tiempo permite exigir un
 * minimo de segundos de llenado sin confiar en el reloj del cliente.
 */
export function emitirToken(ipHash: string): string {
  const emitido = Date.now();
  const nonce = randomBytes(9).toString("base64url");
  const cuerpo = `${emitido}.${nonce}`;
  return `${cuerpo}.${firmar(cuerpo, ipHash)}`;
}

export type VerificacionToken =
  | { valido: true }
  | { valido: false; motivo: "formato" | "firma" | "rapido" | "caduco" };

export function verificarToken(token: string, ipHash: string): VerificacionToken {
  const partes = token.split(".");
  if (partes.length !== 3) return { valido: false, motivo: "formato" };

  const [emitidoTexto, nonce, firma] = partes as [string, string, string];
  const emitido = Number(emitidoTexto);
  if (!Number.isInteger(emitido) || emitido <= 0) return { valido: false, motivo: "formato" };

  const esperada = firmar(`${emitidoTexto}.${nonce}`, ipHash);
  if (!igualSeguro(firma, esperada)) return { valido: false, motivo: "firma" };

  const transcurrido = Date.now() - emitido;
  if (transcurrido < TOKEN_MIN_MS) return { valido: false, motivo: "rapido" };
  if (transcurrido > TOKEN_MAX_MS) return { valido: false, motivo: "caduco" };

  return { valido: true };
}

function firmar(cuerpo: string, ipHash: string): string {
  return createHmac("sha256", exigirSecreto("INGEST_SECRET"))
    .update(`${cuerpo}.${ipHash}`)
    .digest("base64url");
}

/** Comparacion en tiempo constante sobre cadenas de longitud arbitraria. */
export function igualSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Se compara igual contra si mismo para no revelar la diferencia por tiempo.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function secretoDeIngesta(): string {
  return exigirSecreto("INGEST_SECRET");
}
