"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_PROGRAMA,
  ETIQUETAS,
  PILARES,
  type EstadoPrograma,
  type Pilar,
} from "@/convex/lib/validadores";
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  Pildora,
  Seleccion,
  TONO_ESTADO,
  Tarjeta,
  Vacio,
} from "@/components/panel/ui/primitivas";
import { useCascaron } from "@/components/panel/ui/cascaron";

type EventoPrograma = FunctionReturnType<typeof api.eventos.listar>[number];

export function ProgramaEventos({ integrado = false }: { integrado?: boolean }) {
  const { yo } = useCascaron();
  const eventos = useQuery(api.eventos.listar, {});
  const programas = eventos?.filter((evento) => evento.estadoPrograma !== undefined);
  const [editando, setEditando] = useState<Id<"events"> | "nuevo" | null>(null);
  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";
  const actual = eventos?.find((evento) => evento._id === editando) ?? null;

  return (
    <>
      {!integrado ? (
        <Encabezado
          titulo="Programa"
          descripcion="Los mismos eventos alimentan el dashboard y la landing."
          acciones={
            puedeEditar ? (
              <Boton variante="primario" icono="mas" onClick={() => setEditando("nuevo")}>
                Agregar
              </Boton>
            ) : null
          }
        />
      ) : puedeEditar ? (
        <div className="mb-4 flex justify-end">
          <Boton variante="primario" icono="mas" onClick={() => setEditando("nuevo")}>
            Agregar programa
          </Boton>
        </div>
      ) : null}

      <Tarjeta>
        {programas === undefined ? (
          <Cargando que="el programa" />
        ) : programas.length === 0 ? (
          <Vacio
            titulo="Todavía no hay programas"
            ayuda="Agrega el primero. También aparecerá como evento en el dashboard."
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Programa</th>
                  <th>Pilar</th>
                  <th>Estado</th>
                  <th>Landing</th>
                </tr>
              </thead>
              <tbody>
                {programas.map((p, i) => (
                  <tr
                    key={p._id}
                    data-selected={editando === p._id ? "true" : undefined}
                    onClick={() => puedeEditar && setEditando(editando === p._id ? null : p._id)}
                  >
                    <td className="ui-td-tight ui-faint">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <span className="block font-medium">{p.titulo}</span>
                      <span className="ui-faint text-[12px]">{p.periodoPrograma}</span>
                    </td>
                    <td>{ETIQUETAS[p.pilar]}</td>
                    <td>
                      <Pildora tono={TONO_ESTADO[p.estadoPrograma ?? ""] ?? "neutro"} sm>
                        {ETIQUETAS[p.estadoPrograma ?? ""]}
                      </Pildora>
                    </td>
                    <td>
                      <Pildora tono={p.publicadoEnLanding ? "ok" : "neutro"} sm punto={false}>
                        {p.publicadoEnLanding ? "Publicado" : "Oculto"}
                      </Pildora>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {programas && programas.length > 0 ? (
          <p className="ui-faint px-4 py-3 text-[12px]">
            {programas.length} programas · {programas.filter((p) => p.publicadoEnLanding).length} visibles en la landing
          </p>
        ) : null}
      </Tarjeta>

      {editando === "nuevo" || actual ? (
        <Formulario
          programa={actual ?? undefined}
          onListo={() => setEditando(null)}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}

export default function Programa() {
  return <ProgramaEventos />;
}

function Formulario({
  programa,
  onListo,
  onCerrar,
}: {
  programa?: EventoPrograma;
  onListo: () => void;
  onCerrar: () => void;
}) {
  const crear = useMutation(api.eventos.crearDesdePrograma);
  const actualizar = useMutation(api.eventos.actualizarPrograma);
  const eliminar = useMutation(api.eventos.quitarDelPrograma);
  const [titulo, setTitulo] = useState(programa?.titulo ?? "");
  const [periodo, setPeriodo] = useState(programa?.periodoPrograma ?? "");
  const [pilar, setPilar] = useState<Pilar>(programa?.pilar ?? "desarrollo");
  const [estado, setEstado] = useState<EstadoPrograma>(programa?.estadoPrograma ?? "propuesto");
  const [responsable, setResponsable] = useState(programa?.responsablePrograma ?? "");
  const [notas, setNotas] = useState(programa?.notasPrograma ?? "");
  const [publicado, setPublicado] = useState(programa?.publicadoEnLanding ?? false);
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
      setError("No se pudo guardar. Revisa tu sesión e intenta de nuevo.");
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
      setError("No se pudo retirar del programa. Hace falta rol de administrador.");
      setOcupado(false);
    }
  };

  return (
    <div className="ui-modal-bg" role="presentation">
      <div role="dialog" aria-modal="true" className="ui-dialog">
        <h2 className="ui-h2">{programa ? "Editar programa" : "Agregar programa"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Título" htmlFor="p-titulo">
            <Entrada id="p-titulo" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} className="sm:col-span-2" />
          </Campo>
          <Campo etiqueta="Periodo" htmlFor="p-periodo">
            <Entrada id="p-periodo" value={periodo} maxLength={40} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ago — Dic 2026" />
          </Campo>
          <Campo etiqueta="Responsable" htmlFor="p-responsable">
            <Entrada id="p-responsable" value={responsable} maxLength={60} onChange={(e) => setResponsable(e.target.value)} />
          </Campo>
          <Campo etiqueta="Pilar" htmlFor="p-pilar">
            <Seleccion id="p-pilar" value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)}>
              {PILARES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS[opcion]}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Estado" htmlFor="p-estado">
            <Seleccion id="p-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPrograma)}>
              {ESTADOS_PROGRAMA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS[opcion]}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <div className="sm:col-span-2">
            <Campo etiqueta="Notas internas" htmlFor="p-notas">
              <AreaTexto id="p-notas" value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
            </Campo>
          </div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            checked={publicado}
            onChange={(e) => setPublicado(e.target.checked)}
            className="mt-1"
          />
          <span>
            Publicar en la landing.
            <span className="ui-faint mt-0.5 block text-[12px]">
              Solo cuando fecha, sede y aprobación estén verificadas.
            </span>
          </span>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Boton variante="primario" onClick={() => void guardar()} disabled={ocupado}>
            {ocupado ? "Guardando…" : programa ? "Guardar" : "Agregar"}
          </Boton>
          <Boton onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          {programa ? (
            <Boton variante="peligro" className="ml-auto" onClick={() => void borrar()} disabled={ocupado}>
              Retirar del programa
            </Boton>
          ) : null}
          {error ? <Aviso tono="error">{error}</Aviso> : null}
        </div>
      </div>
    </div>
  );
}
