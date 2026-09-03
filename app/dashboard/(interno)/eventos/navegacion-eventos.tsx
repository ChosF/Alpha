"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VISTAS = [
  { href: "/dashboard/eventos", texto: "Asistentes", exacta: true },
  { href: "/dashboard/eventos/programa", texto: "Programa de trabajo", exacta: false },
] as const;

export function NavegacionEventos() {
  const ruta = usePathname();

  return (
    <nav aria-label="Vistas de eventos" className="ui-tabs" role="tablist">
      {VISTAS.map((vista) => {
        const activa = vista.exacta ? ruta === vista.href : ruta.startsWith(vista.href);
        return (
          <Link
            key={vista.href}
            href={vista.href}
            role="tab"
            aria-selected={activa}
            aria-current={activa ? "page" : undefined}
            className="ui-tab"
          >
            {vista.texto}
          </Link>
        );
      })}
    </nav>
  );
}
