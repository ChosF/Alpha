"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { MarcaAlpha } from "@/components/marca-alpha";
import { useCascaron } from "./cascaron";
import { Icono } from "./iconos";
import { Avatar, Boton, Kbd, Menu, MenuItem, iniciales } from "./primitivas";
import { BASE, apartadoActual } from "./rutas";

export function BarraSuperior() {
  const ruta = usePathname();
  const router = useRouter();
  const { yo, tema, alternarTema, colapsada, alternarColapso, abrirPaleta, cerrarSesion } =
    useCascaron();
  const actual = apartadoActual(ruta);
  const nombre = yo ? yo.nombre || yo.correo : "";
  const segmentos = ruta.split("/").filter(Boolean);
  const eventoId =
    segmentos.length === 3 &&
    segmentos[0] === "dashboard" &&
    segmentos[1] === "eventos" &&
    segmentos[2] !== "programa"
      ? segmentos[2]
      : null;
  const eventos = useQuery(api.eventos.listar, eventoId ? {} : "skip");
  const eventoActual = eventoId ? eventos?.find((evento) => evento._id === eventoId) : undefined;

  return (
    <header className="ui-top">
      {/* Movil: la marca ocupa el lugar de la barra lateral. */}
      <Link href={BASE} className="ui-top-logo lg:hidden" aria-label="Alpha · Inicio">
        <MarcaAlpha className="h-auto w-[76px]" tono={tema === "dark" ? "blanco" : "navy"} />
      </Link>

      <Boton
        variante="fantasma"
        soloIcono
        icono="panel"
        etiqueta={colapsada ? "Expandir barra lateral" : "Contraer barra lateral"}
        className="hidden lg:inline-flex"
        onClick={alternarColapso}
      />

      <nav className="ui-crumbs" aria-label="Ruta">
        <Link href={BASE} className="hidden lg:inline">
          Alpha
        </Link>
        <span className="ui-slash hidden lg:block" aria-hidden="true" />
        {eventoId ? (
          <>
            <Link href={`${BASE}/eventos`}>Eventos</Link>
            <span className="ui-slash" aria-hidden="true" />
            <span className="ui-crumb-actual">{eventoActual?.titulo ?? "Evento"}</span>
          </>
        ) : (
          <span className="ui-crumb-actual">{actual?.texto ?? "Inicio"}</span>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button type="button" className="ui-search" onClick={abrirPaleta}>
          <Icono nombre="buscar" tamano={15} />
          <span>Buscar o ir a…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Boton
          variante="fantasma"
          soloIcono
          icono="buscar"
          etiqueta="Buscar"
          className="ui-search-icon-only"
          onClick={abrirPaleta}
        />

        <Menu
          disparador={(abierto) => (
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-icon"
              aria-label="Cuenta"
              aria-expanded={abierto}
            >
              <Avatar texto={iniciales(nombre || "A")} hue={2} />
            </button>
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-semibold">{nombre || "Sin sesión"}</p>
            <p className="ui-faint truncate text-[11.5px]">
              {yo ? `${ETIQUETAS[yo.rol] ?? yo.rol} · ${yo.correo}` : ""}
            </p>
          </div>
          <div className="ui-menu-sep" />
          <MenuItem icono="ajustes" onClick={() => router.push(`${BASE}/ajustes`)}>
            Ajustes
          </MenuItem>
          <MenuItem icono={tema === "dark" ? "sol" : "luna"} onClick={alternarTema}>
            {tema === "dark" ? "Tema claro" : "Tema oscuro"}
          </MenuItem>
          <MenuItem icono="programa" onClick={() => router.push(`${BASE}/eventos/programa`)}>
            Programa de trabajo
          </MenuItem>
          <MenuItem
            icono="carpeta"
            onClick={() =>
              window.open(
                "https://drive.google.com/drive/folders/133n9kJqUPlVfZctiF1zo1k_28grh5nEK",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Drive del equipo
          </MenuItem>
          <div className="ui-menu-sep" />
          <MenuItem icono="salir" peligro onClick={cerrarSesion}>
            Cerrar sesión
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
