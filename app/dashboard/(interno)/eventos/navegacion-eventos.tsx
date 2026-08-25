"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VISTAS = [
  {
    href: "/dashboard/eventos",
    texto: "Asistentes",
    descripcion: "Registros por evento",
    exacta: true,
  },
  {
    href: "/dashboard/eventos/programa",
    texto: "Programa general",
    descripcion: "Calendario y publicaciones",
    exacta: false,
  },
] as const;

export function NavegacionEventos() {
  const ruta = usePathname();

  return (
    <nav aria-label="Vistas de eventos" className="bg-[var(--color-surface)] p-1.5">
      <ul className="grid grid-cols-2 gap-1.5">
        {VISTAS.map((vista) => {
          const activa = vista.exacta ? ruta === vista.href : ruta.startsWith(vista.href);
          return (
            <li key={vista.href}>
              <Link
                href={vista.href}
                aria-current={activa ? "page" : undefined}
                className={`group grid min-h-[62px] grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-[background,color,transform] duration-500 ease-[cubic-bezier(.32,.72,0,1)] active:scale-[.99] sm:px-5 ${
                  activa
                    ? "bg-[var(--color-ink)] text-white"
                    : "text-[var(--color-n700)] hover:bg-white hover:text-[var(--color-ink)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold sm:text-[13px]">{vista.texto}</span>
                  <span
                    className={`mt-1 hidden text-[9px] tracking-[.08em] sm:block ${
                      activa ? "text-white/45" : "text-[var(--color-n500)]"
                    }`}
                  >
                    {vista.descripcion}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-8 place-items-center text-[12px] transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-0.5 ${
                    activa ? "bg-white/10" : "bg-[var(--color-ground)]"
                  }`}
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
