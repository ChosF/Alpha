"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AREAS, ETIQUETAS, ESTADOS_REGISTRO } from "@/convex/lib/validadores";
import { Bandeja, Cargando, Titulo, fechaHora } from "@/components/panel/piezas";

/**
 * Inicio: el estado de la convocatoria de un vistazo.
 *
 * La cifra grande no es decorativa; es la que se pregunta primero cada semana.
 * El resto se ordena por lo que exige accion: cuantos siguen sin contactar.
 */
export default function Inicio() {
  const [actividadVisible, setActividadVisible] = useState(true);
  const datos = useQuery(api.metricas.resumen, {});
  const actividad = useQuery(api.metricas.actividad, { limite: 50 });

  if (datos === undefined) {
    return (
      <>
        <Titulo cejilla="Convocatoria 2026 — 2027">Inicio</Titulo>
        <Bandeja>
          <Cargando que="el resumen" />
        </Bandeja>
      </>
    );
  }

  const pico = Math.max(1, ...datos.porSemana.map((s) => s.total));
  const areasOrdenadas = [...AREAS].sort(
    (a, b) => (datos.porArea[b] ?? 0) - (datos.porArea[a] ?? 0),
  );

  return (
    <>
      <Titulo cejilla="Convocatoria 2026 — 2027">Inicio</Titulo>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Cifra principal */}
        <Bandeja oscura className="lg:col-span-5">
          <div className="p-8 lg:p-10 min-h-[220px] flex flex-col justify-between">
            <p className="rotulo text-white/50">Registros totales</p>
            <div>
              <p className="cifra text-[clamp(3rem,7vw,5rem)] font-bold leading-none">
                {datos.total}
              </p>
              <p className="mt-4 text-[13px] font-light text-white/65">
                {datos.nuevosEstaSemana} esta semana · {datos.miembros} miembros ·{" "}
                {datos.aliados} aliados
              </p>
            </div>
          </div>
        </Bandeja>

        {/* Altas por semana */}
        <Bandeja className="lg:col-span-7">
          <div className="p-8 lg:p-10 min-h-[220px] flex flex-col justify-between">
            <p className="rotulo">Altas por semana</p>
            <div className="mt-6 flex items-end gap-2 h-[110px]">
              {datos.porSemana.map((semana, i) => (
                <div key={semana.inicio} className="flex-1 flex flex-col justify-end h-full">
                  <span className="cifra text-[10px] text-[var(--color-n600)] mb-1 text-center">
                    {semana.total > 0 ? semana.total : ""}
                  </span>
                  <div
                    className="w-full transition-all duration-700"
                    style={{
                      height: `${Math.max(2, (semana.total / pico) * 100)}%`,
                      background:
                        i === datos.porSemana.length - 1
                          ? "var(--color-accent)"
                          : "var(--color-n300)",
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[var(--color-n600)]">
              Ocho semanas. La barra azul es la semana en curso.
            </p>
          </div>
        </Bandeja>

        {/* Estados */}
        <Bandeja className="lg:col-span-4">
          <div className="p-8">
            <p className="rotulo">Atencion</p>
            <ul className="mt-5">
              {ESTADOS_REGISTRO.map((estado) => (
                <li key={estado} className="fila flex items-center justify-between py-3">
                  <span className="text-[13px]">{ETIQUETAS[estado]}</span>
                  <span className="cifra text-[15px] font-medium">
                    {datos.porEstado[estado] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Bandeja>

        {/* Canales */}
        <Bandeja className="lg:col-span-3">
          <div className="p-8">
            <p className="rotulo">Canales elegidos</p>
            <div className="mt-6 grid gap-5">
              <div>
                <p className="cifra text-[28px] font-semibold leading-none">{datos.conCorreo}</p>
                <p className="mt-1.5 text-[12px] text-[var(--color-n600)]">Avisos por correo</p>
              </div>
              <div>
                <p className="cifra text-[28px] font-semibold leading-none">{datos.conWhatsapp}</p>
                <p className="mt-1.5 text-[12px] text-[var(--color-n600)]">Grupo de WhatsApp</p>
              </div>
            </div>
          </div>
        </Bandeja>

        {/* Areas pedidas por aliados */}
        <Bandeja className="lg:col-span-5">
          <div className="p-8">
            <p className="rotulo">Areas que piden los aliados</p>
            <ul className="mt-5 grid gap-2.5">
              {areasOrdenadas.map((area) => {
                const total = datos.porArea[area] ?? 0;
                const maximo = Math.max(1, ...AREAS.map((a) => datos.porArea[a] ?? 0));
                return (
                  <li key={area} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <p className="text-[12px]">{ETIQUETAS[area]}</p>
                      <div className="mt-1.5 h-[3px] bg-[var(--hair-2)]">
                        <div
                          className="h-full bg-[var(--color-accent)] transition-all duration-700"
                          style={{ width: `${(total / maximo) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="cifra text-[13px] text-[var(--color-n700)]">{total}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Bandeja>

        {/* Bitacora */}
        <Bandeja className="lg:col-span-12">
          <div className="p-8">
            <div className="flex items-center justify-between gap-4">
              <p className="rotulo">Actividad del equipo</p>
              <button
                type="button"
                aria-expanded={actividadVisible}
                aria-controls="actividad-lista"
                onClick={() => setActividadVisible((visible) => !visible)}
                className="group flex min-h-9 items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-n600)] transition-colors hover:text-[var(--color-accent)]"
              >
                {actividadVisible ? "Ocultar" : "Mostrar"}
                <span
                  aria-hidden="true"
                  className={`block size-2.5 border-b border-r border-current transition-transform duration-300 ${
                    actividadVisible ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"
                  }`}
                />
              </button>
            </div>

            {actividadVisible ? (
              <div id="actividad-lista">
                {actividad === undefined ? (
                  <p className="mt-5 text-[12px] text-[var(--color-n600)]">Cargando…</p>
                ) : actividad.length === 0 ? (
                  <p className="mt-5 text-[12px] text-[var(--color-n600)]">
                    Todavia no hay movimientos registrados.
                  </p>
                ) : (
                  <ul className="correo-scroll mt-5 max-h-[445px] overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]">
                    {actividad.map((linea) => (
                      <li
                        key={linea._id}
                        className="fila grid grid-cols-[auto_1fr] sm:grid-cols-[130px_1fr_auto] gap-x-5 gap-y-1 py-3 items-baseline"
                      >
                        <span className="cifra text-[11px] text-[var(--color-n500)]">
                          {fechaHora(linea.creadoEn)}
                        </span>
                        <span className="text-[12.5px]">
                          <span className="text-[var(--color-n700)]">{linea.actorCorreo}</span>{" "}
                          {linea.accion}
                          {linea.detalle ? (
                            <span className="text-[var(--color-n600)]"> · {linea.detalle}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </Bandeja>
      </div>
    </>
  );
}
