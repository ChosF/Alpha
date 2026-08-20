"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";

/**
 * Riel de navegacion.
 *
 * Los apartados que la persona no puede usar no se muestran: es mas honesto
 * que ensenarlos deshabilitados, y de todos modos el servidor vuelve a
 * comprobar el rol en cada consulta.
 */
const APARTADOS = [
  { href: "/panel", texto: "Inicio", minimo: "lector" },
  { href: "/panel/registros", texto: "Registros", minimo: "lector" },
  { href: "/panel/programa", texto: "Programa", minimo: "lector" },
  { href: "/panel/usuarios", texto: "Usuarios", minimo: "admin" },
] as const;

export function Navegacion() {
  const ruta = usePathname();
  const yo = useQuery(api.usuarios.yo, {});
  const { signOut } = useAuthActions();

  const visibles = APARTADOS.filter(
    (a) => a.minimo !== "admin" || yo?.rol === "admin",
  );

  return (
    <nav className="bg-[var(--color-ink)] text-[var(--color-ground)] lg:min-h-dvh lg:sticky lg:top-0 flex flex-col">
      <div className="px-6 py-7 border-b border-[var(--hair-clara)]">
        <Link href="/panel" className="block">
          <span className="text-[22px] font-bold tracking-[-.04em]">Alpha</span>
          <span className="ml-2 text-[10px] tracking-[.24em] uppercase text-white/45">Panel</span>
        </Link>
      </div>

      <ul className="flex-1 px-3 py-4 flex lg:flex-col gap-1 overflow-x-auto">
        {visibles.map((a) => {
          const activo = a.href === "/panel" ? ruta === "/panel" : ruta.startsWith(a.href);
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={activo ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-300 ${
                  activo ? "bg-[var(--color-accent)] text-white" : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="w-3 h-px bg-current opacity-70" />
                {a.texto}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="px-6 py-5 border-t border-[var(--hair-clara)]">
        {yo ? (
          <>
            <p className="text-[12px] font-medium truncate">{yo.nombre || yo.correo}</p>
            <p className="text-[10px] tracking-[.18em] uppercase text-white/45 mt-1">
              {ETIQUETAS[yo.rol] ?? yo.rol}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-white/45">Sin sesion</p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 text-[11px] tracking-[.14em] uppercase text-white/55 hover:text-white transition-colors duration-300"
        >
          Cerrar sesion
        </button>
      </div>
    </nav>
  );
}
