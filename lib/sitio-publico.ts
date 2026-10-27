const SITIO_CANONICO = "https://www.alphaccm.org";

/**
 * Origen público para los enlaces de los boletos. SITE_URL puede venir vacía
 * o sin protocolo; en ese caso se usa el origen de la petición.
 */
export function sitioPublico(peticion: Request): string {
  for (const candidato of [process.env.SITE_URL, peticion.url]) {
    if (!candidato?.trim()) continue;
    try {
      return new URL(candidato.trim()).origin;
    } catch {
      continue;
    }
  }
  return SITIO_CANONICO;
}
