export const QR_ASISTENCIA_CONTENT_ID = "mario-kart-asistencia-qr";

/**
 * Mantiene el identificador opaco de Convex dentro de una URL estable. La
 * ruta conserva compatibilidad con los boletos enviados y abre el panel protegido.
 */
/** Imagen pública del QR, servida por /api/boletos/qr para los correos. */
export function imagenQrRegistro(sitio: string, registroId: string): string {
  return new URL(`/api/boletos/qr/${encodeURIComponent(registroId)}.png`, sitio).toString();
}

export function enlaceAsistenciaRegistro(sitio: string, registroId: string): string {
  const enlace = new URL("/registro/id", sitio);
  enlace.searchParams.set("", registroId);
  return enlace.toString();
}
