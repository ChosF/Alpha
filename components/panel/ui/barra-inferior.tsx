"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCascaron } from "./cascaron";
import { Icono } from "./iconos";
import { PRINCIPAL, SECUNDARIA, apartadoActual, visibles } from "./rutas";

/**
 * Barra inferior del movil. Conserva la mecanica que ya funcionaba en el
 * panel anterior: pestanas en la zona del pulgar, una pastilla que se desliza
 * hasta la activa y navegacion anticipada al tocar para que la interfaz
 * responda antes de que llegue la ruta.
 */
export function BarraInferior() {
  const ruta = usePathname();
  const { yo, contadores } = useCascaron();
  const [anticipada, setAnticipada] = useState<{ desde: string; hacia: string } | null>(null);
  const lista = useRef<HTMLUListElement>(null);
  const inicializada = useRef(false);
  const rutaAnterior = useRef(ruta);

  const rutaVisual = anticipada?.desde === ruta ? anticipada.hacia : ruta;
  const pestanas = visibles([...PRINCIPAL, ...SECUNDARIA], yo?.rol).filter((a) => a.movil);
  const actualReal = apartadoActual(ruta);
  const actualVisual = apartadoActual(rutaVisual);

  const moverPastilla = useCallback((tabActiva: HTMLElement, animar: boolean) => {
    const barra = lista.current;
    const pastilla = barra?.querySelector<HTMLElement>(".ui-tabbar-pill");
    if (!barra || !pastilla) return;
    const transicion = pastilla.style.transition;
    const cajaBarra = barra.getBoundingClientRect();
    const cajaTab = tabActiva.getBoundingClientRect();
    if (!animar) pastilla.style.transition = "none";
    pastilla.style.width = `${cajaTab.width}px`;
    pastilla.style.transform = `translateX(${cajaTab.left - cajaBarra.left}px)`;
    pastilla.style.opacity = "1";
    if (!animar) {
      void pastilla.offsetWidth;
      pastilla.style.transition = transicion;
    }
  }, []);

  useLayoutEffect(() => {
    const barra = lista.current;
    const tabActiva = barra?.querySelector<HTMLElement>(".ui-tabbar-tab[data-active='true']");
    if (!barra || !tabActiva) return;

    const cuadro = requestAnimationFrame(() => {
      const cambioRuta = inicializada.current && rutaAnterior.current !== rutaVisual;
      moverPastilla(tabActiva, cambioRuta);
      inicializada.current = true;
      rutaAnterior.current = rutaVisual;
    });
    const reajustar = () => {
      const tab = barra.querySelector<HTMLElement>(".ui-tabbar-tab[data-active='true']");
      if (tab) moverPastilla(tab, false);
    };
    window.addEventListener("resize", reajustar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("resize", reajustar);
    };
  }, [moverPastilla, rutaVisual, pestanas.length]);

  return (
    <nav className="ui-tabbar lg:hidden" aria-label="Secciones del panel">
      <ul ref={lista} className="ui-tabbar-core" data-items={pestanas.length}>
        <li className="ui-tabbar-pill" aria-hidden="true" />
        {pestanas.map((a) => {
          const activoReal = actualReal?.href === a.href;
          const activo = actualVisual?.href === a.href;
          const meta = a.contador ? contadores?.[a.contador] ?? null : null;
          const anticipar = () => setAnticipada({ desde: ruta, hacia: a.href });
          return (
            <li key={a.href} className="min-w-0">
              <Link
                href={a.href}
                prefetch
                aria-current={activoReal ? "page" : undefined}
                data-active={activo ? "true" : undefined}
                onPointerDown={anticipar}
                onClick={anticipar}
                className="ui-tabbar-tab"
              >
                <span className="ui-tabbar-icon">
                  <Icono nombre={a.icono} tamano={19} />
                  {meta !== null && meta > 0 ? <i className="ui-tabbar-dot" /> : null}
                </span>
                <span>{a.texto}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
