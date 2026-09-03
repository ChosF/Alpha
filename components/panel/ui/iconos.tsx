import type { SVGProps } from "react";

/**
 * Iconografia propia: trazo fino (1.5) sobre una reticula de 24, sin relleno.
 * Un solo componente para que todos los iconos compartan peso y terminacion.
 */
const TRAZOS: Record<string, string> = {
  inicio: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  registros: "M4 5.5h16v13H4zM4 10.5h16M4 15.5h16M9.5 5.5v13",
  eventos: "M4 6h16v14H4zM8 3v5M16 3v5M4 11h16",
  correo: "M3 6h18v12H3zM3 7l9 6 9-6",
  usuarios:
    "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  usuario: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
  ajustes: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  programa: "M4 4h16v16H4zM4 10h16M10 10v10",
  carpeta: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  externo: "M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  campana: "M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3zM10 19a2 2 0 0 0 4 0",
  sol: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  luna: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  panel: "M4 5h16v14H4zM9 5v14",
  menu: "M4 7h16M4 12h16M4 17h16",
  cerrar: "M6 6l12 12M18 6L6 18",
  chevronAbajo: "m6 9 6 6 6-6",
  chevronDerecha: "m9 6 6 6-6 6",
  chevronIzquierda: "m15 6-6 6 6 6",
  chevrones: "m8 9 4-4 4 4M8 15l4 4 4-4",
  mas: "M12 5v14M5 12h14",
  puntos: "M5 12h.01M12 12h.01M19 12h.01",
  filtro: "M3 5h18l-7 8v6l-4-2v-4z",
  descargar: "M12 4v12m0 0 4-4m-4 4-4-4M4 20h16",
  check: "m5 12 5 5L20 7",
  tendencia: "M3 17l6-6 4 4 8-8M15 7h6v6",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alerta: "M12 9v4M12 17h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  enviar: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  adjunto:
    "m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  responder: "M9 17 4 12l5-5M4 12h11a5 5 0 0 1 5 5v3",
  ubicacion: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01",
  salir: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3",
  commit: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 12h6M15 12h6",
  rama: "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 6v3a4 4 0 0 1-4 4H6",
  archivo: "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8zM14 3v5h5",
  bandeja: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z",
  estrella: "m12 3 2.8 5.9 6.2.8-4.5 4.3 1.2 6.3L12 17.3 6.3 20.3l1.2-6.3L3 9.7l6.2-.8z",
  copiar: "M9 9h11v11H9zM5 15H4V4h11v1",
  llave: "M15 9a4 4 0 1 0-3.9 5L4 21h4v-2h2v-2h2l1.1-1.1A4 4 0 0 0 15 9",
  escudo: "M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z",
  grafica: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  teclado: "M3 7h18v10H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  lapiz: "M4 20h4l11-11-4-4L4 16zM13 7l4 4",
  actualizar: "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5",
  enlace: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  ojo: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  paleta: "M4 4h16v16H4zM4 9h16M9 9v11",
  papelera: "M5 6h14M8 6V4h8v2M7 6l1 14h8l1-14M10 10v6M14 10v6",
};

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({
  nombre,
  tamano = 16,
  grosor = 1.5,
  className = "",
  ...resto
}: { nombre: NombreIcono; tamano?: number; grosor?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "children"
>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={nombre === "puntos" ? 2.4 : grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ui-icon shrink-0 ${className}`}
      {...resto}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
