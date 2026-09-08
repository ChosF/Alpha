/** Strip invitation identifiers before sending or displaying page analytics. */
export function rutaAnalitica(ruta: string) {
  return ruta.replace(/^\/(encuesta|registro)\/[^/]+(?:\/.*)?$/, "/$1/[identificador]");
}
