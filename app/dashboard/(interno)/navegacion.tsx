"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { MarcaAlpha } from "@/components/marca-alpha";

/**
 * Riel de navegacion.
 *
 * Los apartados que la persona no puede usar no se muestran: es mas honesto
 * que ensenarlos deshabilitados, y de todos modos el servidor vuelve a
 * comprobar el rol en cada consulta.
 */
const APARTADOS = [
  { href: "/dashboard", texto: "Inicio", minimo: "lector", icono: "inicio" },
  { href: "/dashboard/registros", texto: "Registros", minimo: "lector", icono: "registros" },
  { href: "/dashboard/correo", texto: "Correo", minimo: "editor", icono: "correo" },
  { href: "/dashboard/programa", texto: "Programa", minimo: "lector", icono: "programa" },
  { href: "/dashboard/usuarios", texto: "Usuarios", minimo: "admin", icono: "usuarios" },
] as const;

const NIVEL = { lector: 1, editor: 2, admin: 3 } as const;

export function Navegacion() {
  const ruta = usePathname();
  const yo = useQuery(api.usuarios.yo, {});
  const { signOut } = useAuthActions();
  const [cuentaAbierta, setCuentaAbierta] = useState(false);

  const visibles = APARTADOS.filter((a) =>
    yo ? NIVEL[yo.rol] >= NIVEL[a.minimo] : a.minimo === "lector",
  );
  const apartadoActual =
    visibles.find((a) => (a.href === "/dashboard" ? ruta === "/dashboard" : ruta.startsWith(a.href))) ??
    visibles[0];

  return (
    <>
      <aside className="panel-nav hidden bg-[var(--color-ink)] text-[var(--color-ground)] lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:flex lg:h-dvh lg:w-[248px] lg:flex-col lg:overflow-hidden">
        <div className="panel-nav-marca px-6 py-7">
          <Link href="/dashboard" className="group flex items-center">
            <MarcaAlpha className="h-auto w-[112px]" tono="blanco" />
          </Link>
          <p className="mt-5 text-[9px] font-semibold tracking-[.28em] uppercase text-white/36">
            Panel interno
          </p>
        </div>

        <nav aria-label="Secciones del panel" className="flex min-h-0 flex-1 flex-col">
          <ul className="panel-nav-lista flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-4 py-5">
            {visibles.map((a, indice) => {
              const activo = a.href === "/dashboard" ? ruta === "/dashboard" : ruta.startsWith(a.href);
              return (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    aria-current={activo ? "page" : undefined}
                    className={`panel-nav-enlace group relative flex items-center gap-3 whitespace-nowrap px-3 py-3.5 text-[12px] font-medium ${
                      activo ? "panel-nav-enlace-activo text-white" : "text-white/58 hover:text-white"
                    }`}
                  >
                    <IconoApartado nombre={a.icono} />
                    <span className="flex-1">{a.texto}</span>
                    <span
                      className={`panel-nav-indice cifra text-[8px] ${activo ? "text-white/65" : "text-white/25"}`}
                    >
                      {String(indice + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="panel-nav-cuenta flex-none px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="panel-nav-avatar" aria-hidden="true">
              {(yo?.nombre || yo?.correo || "A").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-white/92">
                {yo ? yo.nombre || yo.correo : "Sin sesión"}
              </p>
              {yo ? (
                <p className="mt-0.5 text-[8.5px] font-semibold tracking-[.18em] uppercase text-white/38">
                  {ETIQUETAS[yo.rol] ?? yo.rol}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="panel-nav-salir mt-4 flex w-full items-center justify-between text-[9px] font-semibold tracking-[.16em] uppercase text-white/42 hover:text-white"
          >
            Cerrar sesión
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </aside>

      <header className="panel-mobile-header lg:hidden">
        <div className="panel-mobile-header-core">
          <Link href="/dashboard" aria-label="Ir al inicio" className="panel-mobile-logo">
            <MarcaAlpha className="h-auto w-[88px]" tono="navy" />
          </Link>
          <div className="panel-mobile-contexto" aria-live="polite">
            <span>Panel interno</span>
            <strong>{apartadoActual?.texto ?? "Alpha"}</strong>
          </div>
          <button
            type="button"
            aria-label={cuentaAbierta ? "Cerrar menú de cuenta" : "Abrir menú de cuenta"}
            aria-expanded={cuentaAbierta}
            aria-controls="panel-mobile-cuenta"
            onClick={() => setCuentaAbierta((abierta) => !abierta)}
            className={`panel-mobile-avatar ${cuentaAbierta ? "panel-mobile-avatar-activo" : ""}`}
          >
            {(yo?.nombre || yo?.correo || "A").charAt(0).toUpperCase()}
          </button>
        </div>

        {cuentaAbierta ? (
          <div id="panel-mobile-cuenta" className="panel-mobile-cuenta">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                {yo ? yo.nombre || yo.correo : "Sin sesión"}
              </p>
              {yo ? (
                <p className="mt-1 truncate text-[10px] text-[var(--color-n600)]">
                  {ETIQUETAS[yo.rol] ?? yo.rol} · {yo.correo}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="panel-mobile-salir"
            >
              Cerrar sesión
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : null}
      </header>

      <nav className="panel-mobile-tabs lg:hidden" aria-label="Secciones del panel">
        <ul
          className="panel-mobile-tabs-core"
          style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}
        >
          {visibles.map((a) => {
            const activo = a.href === "/dashboard" ? ruta === "/dashboard" : ruta.startsWith(a.href);
            return (
              <li key={a.href} className="min-w-0">
                <Link
                  href={a.href}
                  aria-current={activo ? "page" : undefined}
                  onClick={() => setCuentaAbierta(false)}
                  className={`panel-mobile-tab ${activo ? "panel-mobile-tab-activo" : ""}`}
                >
                  <IconoApartado nombre={a.icono} />
                  <span>{a.texto}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function IconoApartado({ nombre }: { nombre: (typeof APARTADOS)[number]["icono"] }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-[17px] shrink-0 fill-none stroke-current stroke-[1.35]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {nombre === "inicio" ? <path d="M3.25 8.5 10 3l6.75 5.5v7.25a1 1 0 0 1-1 1H4.25a1 1 0 0 1-1-1V8.5ZM7.5 16.75v-5h5v5" /> : null}
      {nombre === "registros" ? <path d="M5 3.25h10v13.5H5zM7.75 7h4.5M7.75 10h4.5M7.75 13h2.75" /> : null}
      {nombre === "correo" ? <path d="M3 5.25h14v9.5H3zM3.5 6l6.5 5 6.5-5" /> : null}
      {nombre === "programa" ? <path d="M4 4.25h12v11.5H4zM7 2.75v3M13 2.75v3M4 8h12M7 11h2M11 11h2" /> : null}
      {nombre === "usuarios" ? <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.25 16.5c.45-2.7 2.35-4.25 5.75-4.25s5.3 1.55 5.75 4.25" /> : null}
    </svg>
  );
}
