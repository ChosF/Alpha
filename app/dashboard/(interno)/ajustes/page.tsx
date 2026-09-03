"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { useCascaron } from "@/components/panel/ui/cascaron";
import { Icono } from "@/components/panel/ui/iconos";
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  Kbd,
  Pildora,
  Tarjeta,
  TarjetaCabecera,
  iniciales,
} from "@/components/panel/ui/primitivas";
import { Usuarios } from "./usuarios";

type Seccion = "perfil" | "apariencia" | "usuarios";

const SECCIONES: { id: Seccion; texto: string; soloAdmin?: boolean }[] = [
  { id: "perfil", texto: "Perfil" },
  { id: "apariencia", texto: "Apariencia" },
  { id: "usuarios", texto: "Usuarios", soloAdmin: true },
];

/**
 * Ajustes: la cuenta propia, el aspecto del panel y, para administracion,
 * las cuentas del equipo. Usuarios vive aqui porque se toca pocas veces al
 * semestre y no merece un lugar en la barra.
 */
export default function Ajustes() {
  return (
    <Suspense fallback={<Cargando que="los ajustes" />}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const { yo } = useCascaron();
  const parametros = useSearchParams();
  const pedida = parametros.get("seccion");
  const esAdmin = yo?.rol === "admin";

  const visibles = SECCIONES.filter((s) => !s.soloAdmin || esAdmin);
  const seccion: Seccion =
    visibles.some((s) => s.id === pedida) ? (pedida as Seccion) : "perfil";

  return (
    <>
      <Encabezado titulo="Ajustes" descripcion="Tu cuenta, el aspecto del panel y el acceso del equipo." />

      <nav className="ui-tabs" role="tablist" aria-label="Secciones de ajustes">
        {visibles.map((s) => (
          <Link
            key={s.id}
            href={s.id === "perfil" ? "/dashboard/ajustes" : `/dashboard/ajustes?seccion=${s.id}`}
            role="tab"
            aria-selected={seccion === s.id}
            className="ui-tab"
            replace
          >
            {s.texto}
          </Link>
        ))}
      </nav>

      {seccion === "perfil" ? <Perfil /> : null}
      {seccion === "apariencia" ? <Apariencia /> : null}
      {seccion === "usuarios" && esAdmin ? <Usuarios /> : null}
    </>
  );
}

function Perfil() {
  const { yo, cerrarSesion } = useCascaron();
  const actualizarNombre = useMutation(api.usuarios.actualizarNombre);
  const [nombre, setNombre] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!yo) {
    return (
      <Tarjeta>
        <Cargando que="tu perfil" />
      </Tarjeta>
    );
  }

  const valor = nombre ?? yo.nombre;
  const cambiado = valor.trim() !== yo.nombre;

  const guardar = async () => {
    setOcupado(true);
    setEstado(null);
    try {
      await actualizarNombre({ nombre: valor });
      setNombre(null);
      setEstado({ tono: "exito", texto: "Nombre actualizado." });
    } catch (e) {
      setEstado({ tono: "error", texto: e instanceof Error ? limpiarMensaje(e.message) : "No se pudo guardar." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Tarjeta className="lg:col-span-7" indice={1}>
        <TarjetaCabecera titulo="Perfil" descripcion="Así apareces en la bitácora y en los correos que envía el panel." />
        <div className="grid gap-5 p-5">
          <div className="flex items-center gap-4">
            <Avatar texto={iniciales(valor || yo.correo)} tamano="lg" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{valor || yo.correo}</p>
              <p className="ui-faint truncate text-[12.5px]">{yo.correo}</p>
            </div>
            <div className="ml-auto">
              <Pildora tono={yo.rol === "admin" ? "accent" : "neutro"} punto={false}>
                {ETIQUETAS[yo.rol] ?? yo.rol}
              </Pildora>
            </div>
          </div>

          <Campo etiqueta="Nombre" htmlFor="perfil-nombre" ayuda="Entre 2 y 80 caracteres.">
            <Entrada
              id="perfil-nombre"
              value={valor}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </Campo>

          <Campo etiqueta="Correo" htmlFor="perfil-correo" ayuda="Lo define la invitación. Para cambiarlo, pide una nueva.">
            <Entrada id="perfil-correo" value={yo.correo} readOnly disabled />
          </Campo>

          {yo.area ? (
            <Campo etiqueta="Área" htmlFor="perfil-area">
              <Entrada id="perfil-area" value={ETIQUETAS[yo.area] ?? yo.area} readOnly disabled />
            </Campo>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="primario" onClick={() => void guardar()} disabled={!cambiado || ocupado || valor.trim().length < 2}>
              {ocupado ? "Guardando…" : "Guardar cambios"}
            </Boton>
            {cambiado ? (
              <Boton variante="fantasma" onClick={() => setNombre(null)} disabled={ocupado}>
                Descartar
              </Boton>
            ) : null}
            {estado ? <Aviso tono={estado.tono}>{estado.texto}</Aviso> : null}
          </div>
        </div>
      </Tarjeta>

      <div className="grid gap-4 content-start lg:col-span-5">
        <Tarjeta indice={2}>
          <TarjetaCabecera titulo="Sesión" />
          <div className="flex items-center justify-between gap-4 p-5">
            <p className="ui-faint text-[12.5px]">Cierra la sesión en este dispositivo. Podrás volver a entrar con tu contraseña.</p>
            <Boton icono="salir" onClick={cerrarSesion}>
              Salir
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta indice={3}>
          <TarjetaCabecera titulo="Atajos" />
          <dl className="ui-dl p-5">
            <dt>Buscar o ir a</dt>
            <dd>
              <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </dd>
            <dt>Contraer barra lateral</dt>
            <dd>
              <Kbd>⌘</Kbd> <Kbd>B</Kbd>
            </dd>
          </dl>
        </Tarjeta>
      </div>
    </div>
  );
}

function Apariencia() {
  const { tema, alternarTema, colapsada, alternarColapso } = useCascaron();

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Tarjeta className="lg:col-span-7" indice={1}>
        <TarjetaCabecera titulo="Tema" descripcion="Se guarda en este navegador." />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="ui-card flex items-center gap-3 p-4 text-left"
              aria-pressed={tema === t}
              data-selected={tema === t ? "true" : undefined}
              onClick={() => {
                if (tema !== t) alternarTema();
              }}
            >
              <span className="ui-proj-mark">
                <Icono nombre={t === "light" ? "sol" : "luna"} tamano={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{t === "light" ? "Claro" : "Oscuro"}</span>
                <span className="ui-faint block text-[12px]">
                  {t === "light" ? "Fondo blanco, ideal con luz de día." : "Fondo negro, menos brillo."}
                </span>
              </span>
              {tema === t ? (
                <span className="ml-auto text-[var(--accent)]">
                  <Icono nombre="check" tamano={16} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-5" indice={2}>
        <TarjetaCabecera titulo="Barra lateral" descripcion="Solo en escritorio." />
        <div className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[13px] font-medium">Contraída por defecto</p>
            <p className="ui-faint text-[12px]">
              También con <Kbd>⌘</Kbd> <Kbd>B</Kbd>.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={colapsada}
            aria-label="Barra lateral contraída"
            className="ui-switch"
            onClick={alternarColapso}
          />
        </div>
      </Tarjeta>
    </div>
  );
}

function limpiarMensaje(mensaje: string): string {
  const marca = mensaje.lastIndexOf("Error: ");
  const limpio = marca === -1 ? mensaje : mensaje.slice(marca + 7);
  return limpio.split("\n")[0]?.trim() || "No se pudo guardar.";
}
