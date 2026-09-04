const ZONA_HORARIA_EVENTOS = "America/Mexico_City";

export type DetallesRecordatorioEvento = {
  titulo: string;
  fechaEvento: string;
  horaInicio: string;
  horaFin?: string;
  sede: string;
};

function partesFecha(fecha: string): { ano: number; mes: number; dia: number } | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) return null;
  const ano = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const comprobacion = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    comprobacion.getUTCFullYear() !== ano ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia
  ) {
    return null;
  }
  return { ano, mes, dia };
}
export function esFechaEventoValida(fecha: string): boolean {
  return partesFecha(fecha) !== null;
}

export function esHoraEventoValida(hora: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export function fechaEventoEnEspanol(fecha: string): string {
  const partes = partesFecha(fecha);
  if (!partes) return fecha;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia, 12)));
}

export function horarioEvento(inicio: string, fin?: string): string {
  return fin ? `${inicio}\u2013${fin}` : inicio;
}

export function fechaEnCiudadDeMexico(timestamp: number): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA_HORARIA_EVENTOS,
  }).formatToParts(new Date(timestamp));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function asuntoRecordatorioEvento(titulo: string): string {
  return `\u00a1ES HOY! Te esperamos en ${titulo.trim()}`;
}

export function textoRecordatorioEvento(
  detalles: DetallesRecordatorioEvento,
  nombre?: string,
): string {
  const saludo = nombre?.trim() ? `Hola, ${nombre.trim()}.` : "Hola.";
  return [
    saludo,
    "",
    `\u00a1Hoy es el día! Te esperamos en ${detalles.titulo.trim()}.`,
    "",
    `Fecha: ${fechaEventoEnEspanol(detalles.fechaEvento)}`,
    `Hora: ${horarioEvento(detalles.horaInicio, detalles.horaFin)}`,
    `Lugar: ${detalles.sede.trim()}`,
    "",
    "Si tienes alguna duda o ya no podrás acompañarnos, responde a este correo.",
    "",
    "Nos vemos pronto.",
  ].join("\n");
}
