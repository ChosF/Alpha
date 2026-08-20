"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_REGISTRO,
  ETIQUETAS,
  TIPOS_REGISTRO,
  type EstadoRegistro,
  type TipoRegistro,
} from "@/convex/lib/validadores";
import { construirCsv } from "@/lib/csv";
import { Aviso, Bandeja, Cargando, Marca, Titulo, Vacio, fecha } from "@/components/panel/piezas";

/**
 * Registros.
 *
 * La tabla no lleva rejilla ni franjas alternas: solo filetes horizontales y
 * un indice en cifra monoespaciada, igual que el indice de programas de la
 * landing. Es la pantalla que mas se mira, y esa quietud ayuda a leerla.
 */
export default function Registros() {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro | "">("");
  const [estado, setEstado] = useState<EstadoRegistro | "">("");
  const [abierto, setAbierto] = useState<Id<"registrations"> | null>(null);

  const yo = useQuery(api.usuarios.yo, {});
  const datos = useQuery(api.registros.listar, {
    ...(busqueda ? { busqueda } : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
  });

  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Titulo cejilla="Convocatoria">Registros</Titulo>
        {yo?.rol === "admin" ? <BotonExportar tipo={tipo} estado={estado} /> : null}
      </div>

      {/* Filtros */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] mb-6">
        <div className="campo">
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            className="entrada"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, correo o carrera"
            autoComplete="off"
          />
        </div>
        <div className="campo">
          <label htmlFor="f-tipo">Tipo</label>
          <select
            id="f-tipo"
            className="entrada"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRegistro | "")}
          >
            <option value="">Todos</option>
            {TIPOS_REGISTRO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-estado">Estado</label>
          <select
            id="f-estado"
            className="entrada"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoRegistro | "")}
          >
            <option value="">Todos</option>
            {ESTADOS_REGISTRO.map((e) => (
              <option key={e} value={e}>
                {ETIQUETAS[e]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Bandeja>
        {datos === undefined ? (
          <Cargando que="los registros" />
        ) : datos.page.length === 0 ? (
          <Vacio
            titulo="Sin registros que mostrar"
            ayuda={
              busqueda || tipo || estado
                ? "Ningun registro coincide con estos filtros. Prueba a quitarlos."
                : "Cuando alguien se registre desde la landing, aparecera aqui."
            }
          />
        ) : (
          <div className="px-5 sm:px-7 py-2">
            <ul>
              {datos.page.map((r, i) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === r._id ? null : r._id)}
                    aria-expanded={abierto === r._id}
                    className="fila w-full text-left grid grid-cols-[32px_1fr_auto] sm:grid-cols-[32px_1fr_140px_130px] gap-x-4 gap-y-1 py-4 items-center"
                  >
                    <span className="cifra text-[11px] text-[var(--color-n500)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium truncate">{r.nombre}</span>
                      <span className="block cifra text-[11px] text-[var(--color-n600)] truncate">
                        {r.correo}
                      </span>
                    </span>
                    <span className="hidden sm:block text-[12px] text-[var(--color-n700)] truncate">
                      {ETIQUETAS[r.tipo]}
                    </span>
                    <span className="justify-self-end sm:justify-self-start">
                      <Marca estado={r.estado} />
                    </span>
                  </button>
                  {abierto === r._id ? (
                    <Ficha registro={r} puedeEditar={puedeEditar} />
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="py-4 text-[11px] text-[var(--color-n600)]">
              {datos.page.length} en pantalla
              {datos.isDone ? "" : " · hay mas registros; afina los filtros para verlos"}
            </p>
          </div>
        )}
      </Bandeja>
    </>
  );
}

/** Detalle desplegable. Vive bajo la fila para no tapar la lista. */
function Ficha({
  registro,
  puedeEditar,
}: {
  registro: Doc<"registrations">;
  puedeEditar: boolean;
}) {
  const cambiarEstado = useMutation(api.registros.cambiarEstado);
  const guardarNotas = useMutation(api.registros.guardarNotas);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const alGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardarNotas({ id: registro._id, notas });
      setMensaje({ tono: "exito", texto: "Notas guardadas." });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudieron guardar las notas." });
    } finally {
      setGuardando(false);
    }
  };

  const alCambiarEstado = async (nuevo: EstadoRegistro) => {
    setMensaje(null);
    try {
      await cambiarEstado({ id: registro._id, estado: nuevo });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudo cambiar el estado." });
    }
  };

  return (
    <div className="bg-[var(--color-surface)] px-5 sm:px-7 py-7 mb-1 grid gap-7 lg:grid-cols-2">
      <dl className="grid gap-4 text-[13px]">
        <Dato titulo="Carrera y semestre" valor={registro.carrera} />
        <Dato titulo="Matricula" valor={registro.matricula ?? "—"} mono />
        <Dato titulo="Registrado" valor={fecha(registro.creadoEn)} />
        {registro.tipo === "miembro" ? (
          <>
            <Dato
              titulo="Avisos por correo"
              valor={registro.canales.correo ? "Si" : "No"}
            />
            <Dato
              titulo="Grupo de WhatsApp"
              valor={
                registro.canales.whatsapp
                  ? registro.telefono
                    ? registro.telefono
                    : "Si, sin numero"
                  : "No"
              }
              mono={Boolean(registro.telefono)}
            />
          </>
        ) : (
          <>
            <Dato
              titulo="Areas"
              valor={
                registro.areas.length > 0
                  ? registro.areas.map((a) => ETIQUETAS[a] ?? a).join(", ")
                  : "Sin marcar"
              }
            />
            <Dato titulo="Que quiere aportar" valor={registro.aporte ?? "—"} />
          </>
        )}
      </dl>

      <div>
        {puedeEditar ? (
          <>
            <div className="campo">
              <label htmlFor={`estado-${registro._id}`}>Estado</label>
              <select
                id={`estado-${registro._id}`}
                className="entrada"
                value={registro.estado}
                onChange={(e) => void alCambiarEstado(e.target.value as EstadoRegistro)}
              >
                {ESTADOS_REGISTRO.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETAS[e]}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo mt-6">
              <label htmlFor={`notas-${registro._id}`}>Notas internas</label>
              <textarea
                id={`notas-${registro._id}`}
                className="entrada resize-y min-h-[90px]"
                value={notas}
                maxLength={2000}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Que se acordo, quien la contacto, que sigue."
              />
            </div>

            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <button
                type="button"
                className="boton"
                onClick={() => void alGuardar()}
                disabled={guardando || notas === (registro.notas ?? "")}
              >
                {guardando ? "Guardando…" : "Guardar notas"}
              </button>
              {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
            </div>
          </>
        ) : (
          <>
            <p className="rotulo">Notas internas</p>
            <p className="mt-3 text-[13px] font-light leading-[1.7] whitespace-pre-wrap">
              {registro.notas ? registro.notas : "Sin notas."}
            </p>
            <p className="mt-6 text-[11px] text-[var(--color-n600)]">
              Tu rol es de lectura: puedes consultar, no modificar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor, mono = false }: { titulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="rotulo">{titulo}</dt>
      <dd className={`mt-1.5 ${mono ? "cifra" : ""} leading-[1.6] whitespace-pre-wrap`}>{valor}</dd>
    </div>
  );
}

/** Exportacion a CSV. Solo admin, y queda anotada en la bitacora. */
function BotonExportar({ tipo, estado }: { tipo: TipoRegistro | ""; estado: EstadoRegistro | "" }) {
  const [pedido, setPedido] = useState(false);
  const filas = useQuery(
    api.registros.paraExportar,
    pedido ? { ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) } : "skip",
  );
  const anotar = useMutation(api.registros.registrarExportacion);
  const yaDescargado = useRef(false);

  // La descarga es un efecto, no algo que ocurra al renderizar: en modo
  // estricto React renderiza dos veces y si no se bajaria el archivo dos veces.
  useEffect(() => {
    if (!pedido || filas === undefined || yaDescargado.current) return;
    yaDescargado.current = true;

    const csv = construirCsv(
      [
        "Tipo",
        "Nombre",
        "Correo",
        "Carrera",
        "Matricula",
        "Avisos correo",
        "WhatsApp",
        "Telefono",
        "Areas",
        "Aporte",
        "Estado",
        "Notas",
        "Registrado",
      ],
      filas.map((r) => [
        ETIQUETAS[r.tipo] ?? r.tipo,
        r.nombre,
        r.correo,
        r.carrera,
        r.matricula ?? "",
        r.canales.correo ? "Si" : "No",
        r.canales.whatsapp ? "Si" : "No",
        r.telefono ?? "",
        r.areas.map((a) => ETIQUETAS[a] ?? a).join(" / "),
        r.aporte ?? "",
        ETIQUETAS[r.estado] ?? r.estado,
        r.notas ?? "",
        new Date(r.creadoEn).toISOString(),
      ]),
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alpha-registros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    void anotar({ cantidad: filas.length });
  }, [pedido, filas, anotar]);

  return (
    <button
      type="button"
      className="boton boton-linea mb-8"
      onClick={() => {
        yaDescargado.current = false;
        setPedido(true);
      }}
      disabled={pedido && filas === undefined}
    >
      {pedido && filas === undefined ? "Preparando…" : "Exportar CSV"}
    </button>
  );
}
