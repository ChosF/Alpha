"use client";

import type { ReactNode } from "react";
import { ETIQUETAS } from "@/convex/lib/validadores";

/**
 * Piezas compartidas del panel.
 *
 * Todo el texto que entra aqui viene de la base y lo escribieron terceros, asi
 * que se pinta siempre como texto: no hay un solo dangerouslySetInnerHTML en
 * el proyecto y la regla de ESLint lo impide.
 */

/** Contenedor firma: 7px de superficie alrededor de un nucleo claro. */
export function Bandeja({
  children,
  oscura = false,
  className = "",
}: {
  children: ReactNode;
  oscura?: boolean;
  className?: string;
}) {
  return (
    <div className={`bandeja ${oscura ? "bandeja-ink" : ""} ${className}`}>
      <div className="nucleo">{children}</div>
    </div>
  );
}

export function Titulo({ cejilla, children }: { cejilla?: string; children: ReactNode }) {
  return (
    <div className="panel-titulo mb-6 sm:mb-8">
      {cejilla ? <p className="cejilla">{cejilla}</p> : null}
      <h1 className="mt-2.5 text-[clamp(1.65rem,7vw,2.4rem)] font-bold tracking-[-.04em] leading-[1.05] sm:mt-3">
        {children}
      </h1>
    </div>
  );
}

const COLOR_ESTADO: Record<string, string> = {
  nuevo: "var(--color-nuevo)",
  contactado: "var(--color-contactado)",
  activo: "var(--color-activo)",
  baja: "var(--color-baja)",
  planeacion: "var(--color-nuevo)",
  propuesto: "var(--color-contactado)",
  exploratorio: "var(--color-n500)",
  borrador: "var(--color-n500)",
  publicado: "var(--color-activo)",
  cerrado: "var(--color-baja)",
  registrado: "var(--color-nuevo)",
  confirmado: "var(--color-activo)",
  cancelado: "var(--color-baja)",
  asistio: "var(--color-activo)",
};

/** Marcador de estado. Cuadrado, no circulo: la marca no tiene curvas. */
export function Marca({ estado }: { estado: string }) {
  return (
    <span className="marca" style={{ color: COLOR_ESTADO[estado] ?? "var(--color-n600)" }}>
      <b />
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}

export function Vacio({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-[15px] font-medium">{titulo}</p>
      <p className="mt-2 text-[13px] font-light text-[var(--color-n600)] max-w-[46ch] mx-auto leading-[1.7]">
        {ayuda}
      </p>
    </div>
  );
}

export function Cargando({ que }: { que: string }) {
  return (
    <div className="px-8 py-16">
      <p className="rotulo">Cargando {que}</p>
      <div className="mt-4 h-[2px] w-full bg-[var(--hair-2)] overflow-hidden">
        <div className="h-full w-1/3 bg-[var(--color-accent)] animate-pulse" />
      </div>
    </div>
  );
}

export function Aviso({ tono, children }: { tono: "error" | "exito"; children: ReactNode }) {
  const color = tono === "error" ? "var(--color-baja)" : "var(--color-activo)";
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-[12px] leading-[1.6] font-light"
      style={{ color }}
    >
      {children}
    </p>
  );
}

/** Fecha corta en la zona horaria de la Ciudad de Mexico. */
export function fecha(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(ms));
}

export function fechaHora(ms: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(ms));
}
