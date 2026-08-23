"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type OpcionSelector = {
  valor: string;
  etiqueta: string;
};

type SelectorPersonalizadoProps = {
  id: string;
  valor: string;
  opciones: readonly OpcionSelector[];
  alCambiar: (valor: string) => void;
  ariaLabel?: string;
  deshabilitado?: boolean;
};

export function SelectorPersonalizado({
  id,
  valor,
  opciones,
  alCambiar,
  ariaLabel,
  deshabilitado = false,
}: SelectorPersonalizadoProps) {
  const idReact = useId().replaceAll(":", "");
  const idLista = `${id}-opciones-${idReact}`;
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const botones = useRef<Array<HTMLButtonElement | null>>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const seleccionado = Math.max(
    0,
    opciones.findIndex((opcion) => opcion.valor === valor),
  );
  const [indiceActivo, setIndiceActivo] = useState(seleccionado);
  const opcionActual = opciones[seleccionado] ?? opciones[0];

  const cerrar = useCallback((devolverFoco = false) => {
    if (!abierto) return;
    setAbierto(false);
    setCerrando(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setCerrando(false);
      if (devolverFoco) disparador.current?.focus();
    }, duracionCss("--dropdown-close-dur", 150));
  }, [abierto]);

  const abrir = useCallback(
    (indice = seleccionado) => {
      if (deshabilitado || opciones.length === 0) return;
      if (temporizador.current) clearTimeout(temporizador.current);
      setCerrando(false);
      setIndiceActivo(indice);
      setAbierto(true);
    },
    [deshabilitado, opciones.length, seleccionado],
  );

  const elegir = (opcion: OpcionSelector) => {
    alCambiar(opcion.valor);
    cerrar(true);
  };

  useEffect(() => {
    if (!abierto) return;
    const cuadro = requestAnimationFrame(() => botones.current[indiceActivo]?.focus());
    return () => cancelAnimationFrame(cuadro);
  }, [abierto, indiceActivo]);

  useEffect(() => {
    const cerrarFuera = (event: PointerEvent) => {
      if (!contenedor.current?.contains(event.target as Node)) cerrar();
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [cerrar]);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const navegar = (event: KeyboardEvent, indice: number) => {
    let siguiente = indice;
    if (event.key === "ArrowDown") siguiente = (indice + 1) % opciones.length;
    else if (event.key === "ArrowUp") siguiente = (indice - 1 + opciones.length) % opciones.length;
    else if (event.key === "Home") siguiente = 0;
    else if (event.key === "End") siguiente = opciones.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      cerrar(true);
      return;
    } else return;

    event.preventDefault();
    setIndiceActivo(siguiente);
    botones.current[siguiente]?.focus();
  };

  return (
    <div
      ref={contenedor}
      className="selector-personalizado"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) cerrar();
      }}
    >
      <button
        ref={disparador}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        disabled={deshabilitado}
        data-open={abierto || undefined}
        className="selector-personalizado-disparador"
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            abrir(
              event.key === "ArrowDown"
                ? (seleccionado + 1) % opciones.length
                : (seleccionado - 1 + opciones.length) % opciones.length,
            );
          }
        }}
      >
        <span className="selector-personalizado-valor">{opcionActual?.etiqueta ?? "Seleccionar"}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
        </svg>
      </button>

      {abierto || cerrando ? (
        <div
          id={idLista}
          role="listbox"
          aria-labelledby={id}
          aria-hidden={cerrando || undefined}
          data-origin="top"
          className={`t-dropdown selector-personalizado-lista ${abierto ? "is-open" : ""} ${cerrando ? "is-closing" : ""}`}
        >
          {opciones.map((opcion, indice) => {
            const estaSeleccionada = opcion.valor === valor;
            return (
              <button
                key={opcion.valor}
                ref={(elemento) => {
                  botones.current[indice] = elemento;
                }}
                type="button"
                role="option"
                aria-selected={estaSeleccionada}
                data-selected={estaSeleccionada || undefined}
                className="selector-personalizado-opcion"
                onFocus={() => setIndiceActivo(indice)}
                onKeyDown={(event) => navegar(event, indice)}
                onClick={() => elegir(opcion)}
              >
                <span>{opcion.etiqueta}</span>
                <span className="selector-personalizado-marca" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function duracionCss(variable: string, respaldo: number) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return respaldo;
  return valor.endsWith("s") && !valor.endsWith("ms") ? numero * 1000 : numero;
}
