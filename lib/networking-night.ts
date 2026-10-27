/**
 * Networking Night reutiliza la fila `networking-night` que el programa
 * 2026-2027 ya creó en `events`. La página pública vive en `ruta`, pero la
 * fila no recibe `rutaPublica` hasta el lanzamiento: sin ella la landing no la
 * promueve en el banner.
 */
export const NETWORKING_NIGHT = {
  slug: "networking-night",
  titulo: "Networking Night",
  ruta: "/eventos/n-night",
  resumen:
    "Una noche para conocer a exatecs, ponentes y estudiantes del sector financiero en un formato de conversación.",
  fechaIso: "2026-11-05",
  fechaTexto: "jueves 5 de noviembre de 2026",
  fechaCorta: "Jue 5 nov",
  periodoPrograma: "5 de Noviembre",
  horaInicio: "17:00",
  horaFin: "21:00",
  horaTexto: "5:00 a 9:00 p.m.",
  horaRegistroTexto: "4:40 p.m.",
  sede: "Claustro CEDETEC",
  campus: "Tec CCM",
  campusTexto: "Tecnológico de Monterrey, Campus Ciudad de México",
  cuotaMxn: 70,
  calendarioUrl:
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Networking%20Night%20%C2%B7%20Alpha&dates=20261105T230000Z%2F20261106T030000Z&details=Networking%20Night%20de%20Alpha.%20Registro%20desde%20las%204%3A40%20p.m.%20Business%20casual.%20Lleva%20tu%20boleto%20con%20c%C3%B3digo%20QR%20y%20%2470%20MXN%20en%20efectivo.&location=Claustro%20CEDETEC%2C%20Tecnol%C3%B3gico%20de%20Monterrey%20Campus%20Ciudad%20de%20M%C3%A9xico&ctz=America%2FMexico_City",
} as const;

export const AVISO_REGISTRO_NETWORKING_NIGHT =
  "Si no solicitaste este registro o alguien te registró sin tu autorización, responde a este correo para que el equipo de Alpha pueda revisarlo y ayudarte.";

/** Stripe se mostrará en la página, pero no se acepta hasta activarlo aquí. */
export const METODOS_PAGO_NETWORKING_NIGHT = ["efectivo"] as const;
export type MetodoPagoNetworkingNight = (typeof METODOS_PAGO_NETWORKING_NIGHT)[number];

export type PagoBoleto = {
  metodo: "efectivo" | "stripe";
  estado: "pendiente" | "pagado";
  montoMxn: number;
};

/** Texto del boleto según la cuota: pagada en línea, por cobrar en efectivo o en línea sin confirmar. */
export function copiaPagoNetworkingNight(pago: PagoBoleto | undefined) {
  const monto = `$${pago?.montoMxn ?? NETWORKING_NIGHT.cuotaMxn} MXN`;
  if (pago?.estado === "pagado") {
    return {
      pagado: true,
      valor: "Pagado",
      nota: pago.metodo === "stripe" ? `${monto} en línea` : `${monto} en efectivo`,
      paso: "Tu cuota ya está pagada",
      detalle: "Solo muestra tu QR en la entrada. No necesitas llevar efectivo.",
      linea: `Cuota: ${monto}, pagada${pago.metodo === "stripe" ? " en línea" : ""}`,
    };
  }
  if (pago?.metodo === "stripe") {
    return {
      pagado: false,
      valor: monto,
      nota: "Pago en línea sin confirmar",
      paso: "Tu pago en línea no se ha confirmado",
      detalle: `Si no se completa antes del evento, paga ${monto} en efectivo en la entrada.`,
      linea: `Cuota: ${monto}. El pago en línea no se ha confirmado; si no se completa, se paga en efectivo en la entrada`,
    };
  }
  return {
    pagado: false,
    valor: monto,
    nota: "En efectivo, en la entrada",
    paso: `Lleva ${monto} en efectivo`,
    detalle: "Se cobran en la entrada cuando escaneamos tu QR.",
    linea: `Cuota: ${monto} en efectivo, se paga en la entrada`,
  };
}

export const INTERESES_NETWORKING_NIGHT = [
  "Banca",
  "Asset management",
  "Derivados",
  "Fintech",
  "Consultoría",
  "IA y emprendimiento",
  "Finanzas corporativas",
] as const;

export const SEMESTRES_NETWORKING_NIGHT = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export const MAX_INTERESES_NETWORKING_NIGHT = 3;
export const MAX_HABILIDADES_NETWORKING_NIGHT = 12;
export const MAX_CV_BYTES_NETWORKING_NIGHT = 5 * 1024 * 1024;
