"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icono, type NombreIcono } from "./iconos";

/**
 * Piezas del panel: contenedores, controles y datos.
 *
 * Todo lo que llega aqui es texto y se pinta como texto. Los tonos se
 * expresan con data-tone en vez de estilos en linea para convivir con la CSP
 * del panel, que no permite atributos style en el HTML del servidor.
 */

export type Tono = "neutro" | "accent" | "ok" | "warn" | "bad";

/* ------------------------------------------------------------ Estructura */

export function Encabezado({
  cejilla,
  titulo,
  descripcion,
  acciones,
}: {
  cejilla?: string;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="ui-page-h ui-in relative z-10">
      <div className="min-w-0">
        {cejilla ? <p className="ui-eyebrow">{cejilla}</p> : null}
        <h1 className="ui-title">{titulo}</h1>
        {descripcion ? <p className="ui-desc">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="ui-actions">{acciones}</div> : null}
    </header>
  );
}

export function Tarjeta({
  children,
  className = "",
  indice,
}: {
  children: ReactNode;
  className?: string;
  indice?: number;
}) {
  return (
    <section
      className={`ui-card ${indice !== undefined ? "ui-in" : ""} ${className}`}
      data-i={indice !== undefined ? Math.min(indice, 8) : undefined}
    >
      {children}
    </section>
  );
}

export function TarjetaCabecera({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: ReactNode;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="ui-card-h">
      <div className="min-w-0">
        <h2 className="ui-h2">{titulo}</h2>
        {descripcion ? <p className="ui-faint mt-0.5 text-[12px]">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="ui-actions">{acciones}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ Controles */

type BotonProps = {
  children?: ReactNode;
  variante?: "base" | "primario" | "acento" | "fantasma" | "peligro";
  tamano?: "md" | "sm";
  icono?: NombreIcono;
  iconoFinal?: NombreIcono;
  soloIcono?: boolean;
  className?: string;
  etiqueta?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const VARIANTES = {
  base: "",
  primario: "ui-btn-primary",
  acento: "ui-btn-accent",
  fantasma: "ui-btn-ghost",
  peligro: "ui-btn-danger",
};

export function Boton({
  children,
  variante = "base",
  tamano = "md",
  icono,
  iconoFinal,
  soloIcono = false,
  className = "",
  etiqueta,
  type = "button",
  ...resto
}: BotonProps) {
  return (
    <button
      type={type}
      aria-label={etiqueta}
      title={soloIcono ? etiqueta : undefined}
      className={`ui-btn ${VARIANTES[variante]} ${tamano === "sm" ? "ui-btn-sm" : ""} ${
        soloIcono ? "ui-btn-icon" : ""
      } ${className}`}
      {...resto}
    >
      {icono ? <Icono nombre={icono} tamano={tamano === "sm" ? 14 : 16} /> : null}
      {children}
      {iconoFinal ? <Icono nombre={iconoFinal} tamano={14} /> : null}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function Pildora({
  children,
  tono = "neutro",
  punto = true,
  sm = false,
}: {
  children: ReactNode;
  tono?: Tono;
  punto?: boolean;
  sm?: boolean;
}) {
  return (
    <span className={`ui-pill ${sm ? "ui-pill-sm" : ""}`} data-tone={tono}>
      {punto ? <i className="ui-dot" /> : null}
      {children}
    </span>
  );
}

/** Tono de cada estado del dominio, para pintar pildoras coherentes. */
export const TONO_ESTADO: Record<string, Tono> = {
  nuevo: "accent",
  contactado: "neutro",
  activo: "ok",
  baja: "bad",
  planeacion: "accent",
  propuesto: "neutro",
  exploratorio: "neutro",
  borrador: "neutro",
  publicado: "ok",
  cerrado: "bad",
  registrado: "accent",
  confirmado: "ok",
  cancelado: "bad",
  asistio: "ok",
  abierto: "accent",
  resuelto: "ok",
  spam: "bad",
};

export function Avatar({
  texto,
  tamano = "md",
  hue = 1,
}: {
  texto: string;
  tamano?: "sm" | "md" | "lg";
  hue?: number;
}) {
  return (
    <span
      className={`ui-avatar ${tamano === "sm" ? "ui-avatar-sm" : ""} ${tamano === "lg" ? "ui-avatar-lg" : ""}`}
      data-hue={hue}
      aria-hidden="true"
    >
      {texto}
    </span>
  );
}

/** Iniciales para el avatar a partir de un nombre o correo. */
export function iniciales(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) return "A";
  if (limpio.includes("@") && !limpio.includes(" ")) return limpio.charAt(0).toUpperCase();
  const partes = limpio.split(/\s+/).filter(Boolean);
  const primera = partes[0]?.charAt(0) ?? "";
  const segunda = partes.length > 1 ? partes[partes.length - 1]?.charAt(0) ?? "" : "";
  return (primera + segunda).toUpperCase() || "A";
}

export function Entrada({
  icono,
  placeholder,
  className = "",
  ...resto
}: { icono?: NombreIcono; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`ui-input ${className}`}>
      {icono ? <Icono nombre={icono} tamano={15} /> : null}
      <input placeholder={placeholder} {...resto} />
    </label>
  );
}

export function AreaTexto({
  className = "",
  ...resto
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-textarea ${className}`} {...resto} />;
}

export function Seleccion({
  className = "",
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`ui-input ${className}`}>
      <select {...resto}>{children}</select>
    </span>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  htmlFor,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const generado = useId();
  return (
    <div>
      <label htmlFor={htmlFor ?? generado} className="ui-label">
        {etiqueta}
      </label>
      {children}
      {ayuda ? <p className="ui-help">{ayuda}</p> : null}
    </div>
  );
}

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  disabled = false,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      className="ui-switch"
      disabled={disabled}
      onClick={() => onChange(!activo)}
    />
  );
}

/** Menu flotante con cierre por clic fuera y Escape. */
export function Menu({
  disparador,
  children,
  alinear = "right",
  lado = "bottom",
  className = "",
}: {
  disparador: (abierto: boolean) => ReactNode;
  children: ReactNode;
  alinear?: "left" | "right";
  lado?: "top" | "bottom";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div onClick={() => setAbierto((v) => !v)}>{disparador(abierto)}</div>
      {abierto ? (
        <div
          role="menu"
          className="ui-menu"
          data-align={alinear}
          data-side={lado}
          onClick={() => setAbierto(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  icono,
  children,
  atajo,
  peligro = false,
  disabled = false,
  onClick,
}: {
  icono?: NombreIcono;
  children: ReactNode;
  atajo?: string;
  peligro?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="ui-menu-item"
      data-tone={peligro ? "bad" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {icono ? <Icono nombre={icono} tamano={15} /> : null}
      <span>{children}</span>
      {atajo ? <Kbd>{atajo}</Kbd> : null}
    </button>
  );
}

/* ------------------------------------------------------------ Datos */

export function Barra({ valor, tono }: { valor: number; tono?: Tono }) {
  const ref = useRef<HTMLElement>(null);
  const limitado = Math.max(0, Math.min(100, valor));
  useEffect(() => {
    // Se fija por CSSOM tras montar: la CSP no permite style en el HTML.
    const marco = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.width = `${limitado}%`;
    });
    return () => cancelAnimationFrame(marco);
  }, [limitado]);
  return (
    <div
      className="ui-bar"
      role="progressbar"
      aria-valuenow={limitado}
      aria-valuemin={0}
      aria-valuemax={100}
      data-tone={tono}
    >
      <i ref={ref} />
    </div>
  );
}

export function Vacio({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return (
    <div className="ui-empty">
      <strong>{titulo}</strong>
      <p className="text-[12.5px]">{ayuda}</p>
    </div>
  );
}

export function Cargando({ que }: { que: string }) {
  return (
    <div className="ui-empty" role="status" aria-live="polite">
      <p className="ui-faint text-[12.5px]">Cargando {que}…</p>
      <div className="ui-bar mx-auto mt-4 max-w-[220px]">
        <i className="ui-bar-pulse" />
      </div>
    </div>
  );
}

export function Aviso({ tono, children }: { tono: "error" | "exito"; children: ReactNode }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="ui-aviso"
      data-tone={tono === "error" ? "bad" : "ok"}
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

/** "hace 3 h", "ayer", "hace 5 d": suficiente para una bitacora. */
export function relativo(ms: number, ahora = Date.now()): string {
  const diff = Math.max(0, ahora - ms);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} d`;
  return fecha(ms);
}
