"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCascaron } from "./cascaron";
import { Icono, type NombreIcono } from "./iconos";
import { Kbd } from "./primitivas";
import { BASE, PRINCIPAL, SECUNDARIA, visibles } from "./rutas";

type Comando = {
  id: string;
  grupo: "Ir a" | "Eventos" | "Acciones";
  texto: string;
  buscar?: string;
  icono: NombreIcono;
  atajo?: string;
  ejecutar: () => void;
};

function normalizarBusqueda(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Paleta de comandos (⌘K): navegacion y acciones rapidas segun el rol. */
export function Paleta() {
  const router = useRouter();
  const eventos = useQuery(api.eventos.listar, {});
  const { yo, cerrarPaleta, alternarTema, alternarColapso, cerrarSesion } = useCascaron();
  const [consulta, setConsulta] = useState("");
  const [indice, setIndice] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const rol = yo?.rol;

  const comandos = useMemo<Comando[]>(() => {
    const ir = (href: string) => () => {
      cerrarPaleta();
      router.push(href);
    };
    const abrir = (href: string) => () => {
      cerrarPaleta();
      window.open(href, "_blank", "noopener,noreferrer");
    };
    const secciones = [...visibles(PRINCIPAL, rol), ...visibles(SECUNDARIA, rol)].map<Comando>((a) => ({
      id: a.href,
      grupo: "Ir a",
      texto: a.texto,
      icono: a.icono,
      ejecutar: a.externo ? abrir(a.href) : ir(a.href),
    }));
    const eventosDisponibles = (eventos ?? []).map<Comando>((evento) => ({
      id: `evento-${evento._id}`,
      grupo: "Eventos",
      texto: evento.titulo,
      buscar: [evento.titulo, evento.slug, evento.resumen, evento.sede].filter(Boolean).join(" "),
      icono: "eventos",
      ejecutar: ir(`${BASE}/eventos/${evento._id}`),
    }));
    const acciones: Comando[] = [];
    if (rol === "editor" || rol === "admin") {
      acciones.push({
        id: "redactar",
        grupo: "Acciones",
        texto: "Redactar correo",
        icono: "enviar",
        ejecutar: ir(`${BASE}/correo`),
      });
    }
    if (rol === "admin") {
      acciones.push({
        id: "invitar",
        grupo: "Acciones",
        texto: "Invitar a alguien al panel",
        icono: "usuarios",
        ejecutar: ir(`${BASE}/ajustes?seccion=usuarios`),
      });
    }
    acciones.push(
      {
        id: "tema",
        grupo: "Acciones",
        texto: "Cambiar tema",
        icono: "sol",
        ejecutar: () => {
          alternarTema();
          cerrarPaleta();
        },
      },
      {
        id: "barra",
        grupo: "Acciones",
        texto: "Contraer o expandir la barra lateral",
        icono: "panel",
        atajo: "⌘B",
        ejecutar: () => {
          alternarColapso();
          cerrarPaleta();
        },
      },
      {
        id: "salir",
        grupo: "Acciones",
        texto: "Cerrar sesión",
        icono: "salir",
        ejecutar: () => {
          cerrarPaleta();
          cerrarSesion();
        },
      },
    );
    return [...secciones, ...eventosDisponibles, ...acciones];
  }, [eventos, rol, router, cerrarPaleta, alternarTema, alternarColapso, cerrarSesion]);

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(consulta.trim());
    if (!q) return comandos.filter((c) => c.grupo !== "Eventos");
    return comandos.filter((c) => normalizarBusqueda(c.buscar ?? c.texto).includes(q));
  }, [comandos, consulta]);

  useEffect(() => {
    entrada.current?.focus();
  }, []);

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(filtrados.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtrados[indice]?.ejecutar();
    } else if (e.key === "Escape") {
      cerrarPaleta();
    }
  };

  const grupos = ["Ir a", "Eventos", "Acciones"] as const;

  return (
    <div className="ui-modal-bg" onClick={cerrarPaleta} role="presentation">
      <div
        className="ui-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar o ejecutar un comando"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={alTeclear}
      >
        <div className="ui-palette-input">
          <Icono nombre="buscar" tamano={16} />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setIndice(0);
            }}
            placeholder="Buscar secciones, eventos, acciones…"
            aria-label="Buscar"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="ui-palette-list" role="listbox">
          {filtrados.length === 0 ? (
            <p className="ui-faint px-3 py-6 text-center text-[12.5px]">
              Sin resultados para “{consulta}”.
            </p>
          ) : (
            grupos.map((g) => {
              const items = filtrados.filter((c) => c.grupo === g);
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <p className="ui-menu-label">{g}</p>
                  {items.map((c) => {
                    const i = filtrados.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={i === indice}
                        data-active={i === indice}
                        className="ui-palette-item"
                        onMouseEnter={() => setIndice(i)}
                        onClick={c.ejecutar}
                      >
                        <Icono nombre={c.icono} tamano={15} />
                        <span>{c.texto}</span>
                        {c.atajo ? <Kbd>{c.atajo}</Kbd> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="ui-palette-foot">
          <span>
            <b>↑↓</b> navegar
          </span>
          <span>
            <b>↵</b> abrir
          </span>
          <span>
            <b>esc</b> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
