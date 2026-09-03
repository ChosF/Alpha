"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarcaAlpha } from "@/components/marca-alpha";
import { useCascaron } from "./cascaron";
import { Icono } from "./iconos";
import { BASE, PRINCIPAL, SECUNDARIA, apartadoActual, visibles, type Apartado } from "./rutas";

/**
 * Barra lateral de escritorio. Solo navegacion: la cuenta vive en la barra
 * superior y el panel es de una sola gestion, asi que no hay selector de
 * espacio. En movil no se pinta; la barra inferior toma su lugar.
 */
export function BarraLateral() {
  const ruta = usePathname();
  const { yo, contadores, tema } = useCascaron();
  const actual = apartadoActual(ruta);
  const rol = yo?.rol;

  return (
    <aside className="ui-side" aria-label="Navegación principal">
      <div className="ui-side-head">
        <Link href={BASE} className="ui-logo-full" aria-label="Alpha · Inicio">
          <MarcaAlpha className="h-auto w-[84px]" tono={tema === "dark" ? "blanco" : "navy"} />
        </Link>
        <Link href={BASE} className="ui-logo-mark" aria-label="Alpha · Inicio">
          <Image
            src={tema === "dark" ? "/alpha-mark-white.png" : "/alpha-mark-navy.png"}
            alt=""
            width={30}
            height={21}
            className="h-[21px] w-auto"
            priority
          />
        </Link>
      </div>

      <nav className="ui-nav">
        <p className="ui-nav-sec">Panel</p>
        <ul className="ui-nav-list">
          {visibles(PRINCIPAL, rol).map((a) => (
            <li key={a.href}>
              <Enlace
                apartado={a}
                activo={actual?.href === a.href}
                meta={a.contador ? contadores?.[a.contador] ?? null : null}
              />
            </li>
          ))}
        </ul>
        <p className="ui-nav-sec">Recursos</p>
        <ul className="ui-nav-list">
          {visibles(SECUNDARIA, rol).map((a) => (
            <li key={a.href}>
              <Enlace apartado={a} activo={!a.externo && actual?.href === a.href} meta={null} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function Enlace({
  apartado,
  activo,
  meta,
}: {
  apartado: Apartado;
  activo: boolean;
  meta: number | null;
}) {
  const contenido = (
    <>
      <Icono nombre={apartado.icono} />
      <span className="ui-nav-label">{apartado.texto}</span>
      {apartado.externo ? (
        <Icono nombre="externo" tamano={13} className="ui-nav-meta" />
      ) : meta !== null && meta > 0 ? (
        <span className="ui-nav-meta ui-num">{meta}</span>
      ) : null}
    </>
  );

  if (apartado.externo) {
    return (
      <a
        href={apartado.href}
        target="_blank"
        rel="noreferrer noopener"
        className="ui-nav-item"
        data-tip={apartado.texto}
      >
        {contenido}
      </a>
    );
  }

  return (
    <Link
      href={apartado.href}
      className="ui-nav-item"
      data-tip={apartado.texto}
      aria-current={activo ? "page" : undefined}
    >
      {contenido}
    </Link>
  );
}
