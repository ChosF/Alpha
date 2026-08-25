"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_PROGRAMA,
  ETIQUETAS,
  PILARES,
  type EstadoPrograma,
  type Pilar,
} from "@/convex/lib/validadores";
import { Aviso, Bandeja, Cargando, Marca, Titulo, Vacio } from "@/components/panel/piezas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

/**
 * Programa de trabajo.
 *
 * Lo que se marca como publicado sale en la landing, asi que la fila lo dice
 * sin rodeos. El estado usa las mismas tres palabras que ve el estudiante
 * (en planeacion, propuesto, exploratorio) para que nadie tenga que traducir.
 */
export function ProgramaEventos({ integrado = false }: { integrado?: boolean }) {
  const yo = useQuery(api.usuarios.yo, {});
  const programas = useQuery(api.programas.listar, {});
  const [editando, setEditando] = useState<Id<"programs"> | "nuevo" | null>(null);

  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-0 sm:gap-6">
        {integrado ? (
          <div className="mb-6 sm:mb-8">
            <p className="cejilla">Plan general</p>
            <h2 className="mt-2.5 text-[clamp(1.45rem,6vw,2.1rem)] font-bold leading-[1.05] tracking-[-.04em] sm:mt-3">
              Programa de eventos
            </h2>
          </div>
        ) : (
          <Titulo cejilla="Plan de trabajo">Programa</Titulo>
        )}
        {puedeEditar ? (
          <button
            type="button"
            className="boton mb-6 w-full sm:mb-8 sm:w-auto"
            onClick={() => setEditando(editando === "nuevo" ? null : "nuevo")}
          >
            {editando === "nuevo" ? "Cancelar" : "Agregar programa"}
          </button>
        ) : null}
      </div>

      {editando === "nuevo" ? (
        <div className="mb-4">
          <Bandeja>
            <Formulario onListo={() => setEditando(null)} />
          </Bandeja>
        </div>
      ) : null}

      <Bandeja>
        {programas === undefined ? (
          <Cargando que="el programa" />
        ) : programas.length === 0 ? (
          <Vacio
            titulo="Todavia no hay programas"
            ayuda="Carga el plan 2026 — 2027 con el comando de siembra, o agrega el primero a mano."
          />
        ) : (
          <div className="px-5 sm:px-7 py-2">
            <ul>
              {programas.map((p, i) => (
                <li key={p._id}>
                  <div className="fila grid grid-cols-[32px_1fr_auto] sm:grid-cols-[32px_1fr_150px_120px_90px] gap-x-4 gap-y-1 py-4 items-center">
                    <span className="cifra text-[11px] text-[var(--color-n500)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium truncate">{p.titulo}</p>
                      <p className="cifra text-[11px] text-[var(--color-n600)]">{p.periodo}</p>
                    </div>
                    <span className="hidden sm:block text-[12px] text-[var(--color-n700)] truncate">
                      {ETIQUETAS[p.pilar]}
                    </span>
                    <Marca estado={p.estado} />
                    <span className="justify-self-end flex items-center gap-3">
                      <span
                        className="text-[10px] tracking-[.14em] uppercase"
                        style={{
                          color: p.publicado ? "var(--color-activo)" : "var(--color-n500)",
                        }}
                      >
                        {p.publicado ? "Publicado" : "Oculto"}
                      </span>
                      {puedeEditar ? (
                        <button
                          type="button"
                          className="text-[11px] tracking-[.12em] uppercase text-[var(--color-accent)]"
                          onClick={() => setEditando(editando === p._id ? null : p._id)}
                        >
                          {editando === p._id ? "Cerrar" : "Editar"}
                        </button>
                      ) : null}
                    </span>
                  </div>
                  {editando === p._id ? (
                    <div className="bg-[var(--color-surface)] px-5 sm:px-7 py-7 mb-1">
                      <Formulario programa={p} onListo={() => setEditando(null)} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="py-4 text-[11px] text-[var(--color-n600)]">
              {programas.length} programas · {programas.filter((p) => p.publicado).length} visibles
              en la landing
            </p>
          </div>
        )}
      </Bandeja>
    </>
  );
}

export default function Programa() {
  return <ProgramaEventos />;
}

function Formulario({
  programa,
  onListo,
}: {
  programa?: Doc<"programs">;
  onListo: () => void;
}) {
  const crear = useMutation(api.programas.crear);
  const actualizar = useMutation(api.programas.actualizar);
  const eliminar = useMutation(api.programas.eliminar);

  const [titulo, setTitulo] = useState(programa?.titulo ?? "");
  const [periodo, setPeriodo] = useState(programa?.periodo ?? "");
  const [pilar, setPilar] = useState<Pilar>(programa?.pilar ?? "desarrollo");
  const [estado, setEstado] = useState<EstadoPrograma>(programa?.estado ?? "propuesto");
  const [responsable, setResponsable] = useState(programa?.responsable ?? "");
  const [notas, setNotas] = useState(programa?.notas ?? "");
  const [publicado, setPublicado] = useState(programa?.publicado ?? false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const guardar = async () => {
    if (titulo.trim().length < 3) {
      setError("El titulo necesita al menos 3 caracteres.");
      return;
    }
    setOcupado(true);
    setError(null);
    const campos = {
      titulo,
      periodo,
      pilar,
      estado,
      ...(responsable ? { responsable } : {}),
      ...(notas ? { notas } : {}),
      publicado,
    };
    try {
      if (programa) await actualizar({ id: programa._id, ...campos });
      else await crear(campos);
      onListo();
    } catch {
      setError("No se pudo guardar. Revisa tu sesion e intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    if (!programa) return;
    setOcupado(true);
    try {
      await eliminar({ id: programa._id });
      onListo();
    } catch {
      setError("No se pudo eliminar. Hace falta rol de administrador.");
      setOcupado(false);
    }
  };

  return (
    <div className={programa ? "" : "p-7"}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="campo sm:col-span-2">
          <label htmlFor="p-titulo">Titulo</label>
          <input
            id="p-titulo"
            className="entrada"
            value={titulo}
            maxLength={120}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Networking Night"
          />
        </div>
        <div className="campo">
          <label htmlFor="p-periodo">Periodo</label>
          <input
            id="p-periodo"
            className="entrada"
            value={periodo}
            maxLength={40}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Ago — Dic 2026"
          />
        </div>
        <div className="campo">
          <label htmlFor="p-responsable">Responsable</label>
          <input
            id="p-responsable"
            className="entrada"
            value={responsable}
            maxLength={60}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder="Operaciones"
          />
        </div>
        <div className="campo">
          <label htmlFor="p-pilar">Pilar</label>
          <SelectorPersonalizado
            id="p-pilar"
            valor={pilar}
            opciones={PILARES.map((opcion) => ({
              valor: opcion,
              etiqueta: ETIQUETAS[opcion] ?? opcion,
            }))}
            alCambiar={(opcion) => setPilar(opcion as Pilar)}
          />
        </div>
        <div className="campo">
          <label htmlFor="p-estado">Estado</label>
          <SelectorPersonalizado
            id="p-estado"
            valor={estado}
            opciones={ESTADOS_PROGRAMA.map((opcion) => ({
              valor: opcion,
              etiqueta: ETIQUETAS[opcion] ?? opcion,
            }))}
            alCambiar={(opcion) => setEstado(opcion as EstadoPrograma)}
          />
        </div>
        <div className="campo sm:col-span-2">
          <label htmlFor="p-notas">Notas internas</label>
          <textarea
            id="p-notas"
            className="entrada resize-y min-h-[70px]"
            value={notas}
            maxLength={1000}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Pendientes, dependencias, aprobaciones."
          />
        </div>
      </div>

      <label className="mt-6 flex items-start gap-3 text-[13px] font-light cursor-pointer">
        <input
          type="checkbox"
          checked={publicado}
          onChange={(e) => setPublicado(e.target.checked)}
          className="mt-1 w-[18px] h-[18px] accent-[var(--color-accent)]"
        />
        <span>
          Publicar en la landing.
          <span className="block text-[11px] text-[var(--color-n600)] mt-0.5">
            Solo marca esto cuando el area responsable haya verificado fecha, sede y aprobacion.
          </span>
        </span>
      </label>

      <div className="mt-7 flex items-center gap-4 flex-wrap">
        <button type="button" className="boton" onClick={() => void guardar()} disabled={ocupado}>
          {ocupado ? "Guardando…" : programa ? "Guardar cambios" : "Agregar programa"}
        </button>
        <button type="button" className="boton boton-linea" onClick={onListo} disabled={ocupado}>
          Cancelar
        </button>
        {programa ? (
          <button
            type="button"
            className="boton boton-peligro ml-auto"
            onClick={() => void borrar()}
            disabled={ocupado}
          >
            Eliminar
          </button>
        ) : null}
        {error ? <Aviso tono="error">{error}</Aviso> : null}
      </div>
    </div>
  );
}
