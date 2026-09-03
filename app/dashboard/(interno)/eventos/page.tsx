"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_ASISTENTE,
  ESTADOS_EVENTO,
  ETIQUETAS,
  PILARES,
  type EstadoAsistente,
  type EstadoEvento,
  type Pilar,
} from "@/convex/lib/validadores";
import { construirCsv } from "@/lib/csv";
import { construirXlsx } from "@/lib/xlsx";
import { Icono } from "@/components/panel/ui/iconos";
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Entrada,
  Menu,
  MenuItem,
  Pildora,
  Seleccion,
  TONO_ESTADO,
  Tarjeta,
  Vacio,
  fecha,
  relativo,
} from "@/components/panel/ui/primitivas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";
import { useCascaron } from "@/components/panel/ui/cascaron";

type EventoLista = FunctionReturnType<typeof api.eventos.listar>[number];

export default function Eventos() {
  const { yo } = useCascaron();
  const eventos = useQuery(api.eventos.listar, {});
  const [seleccion, setSeleccion] = useState<Id<"events"> | null>(null);
  const [creando, setCreando] = useState(false);

  const evento = eventos?.find((e) => e._id === seleccion) ?? null;
  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";
  const esAdmin = yo?.rol === "admin";

  if (eventos === undefined) {
    return (
      <Tarjeta>
        <Cargando que="los eventos" />
      </Tarjeta>
    );
  }

  if (evento) {
    return (
      <DetalleEvento
        evento={evento}
        puedeEditar={puedeEditar}
        esAdmin={esAdmin}
        volver={() => setSeleccion(null)}
      />
    );
  }

  return (
    <>
      {eventos.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Todavía no hay eventos" ayuda="Crea el primero. Los registros públicos aparecerán aquí." />
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {eventos.map((item, i) => (
            <button
              key={item._id}
              type="button"
              className="ui-card ui-proj text-left"
              data-i={Math.min(i + 1, 8)}
              onClick={() => setSeleccion(item._id)}
            >
              <span className="ui-proj-head">
                <span className="ui-proj-mark">
                  <Icono nombre="eventos" tamano={15} />
                </span>
                <span className="ui-proj-text">
                  <strong>{item.titulo}</strong>
                  <span>alphaccm.org/eventos/{item.slug}</span>
                </span>
                <span className="ui-proj-side">
                  {item.confirmados}/{item.totalRegistros}
                </span>
              </span>
              <p className="ui-proj-note">
                <Icono nombre="commit" tamano={14} />
                <span>{item.resumen || ETIQUETAS[item.pilar]}</span>
              </p>
              <div className="ui-proj-foot">
                <span className="ui-proj-who">
                  <Icono nombre="reloj" tamano={13} />
                  {relativo(item.actualizadoEn)}
                </span>
                <Pildora tono={TONO_ESTADO[item.estado] ?? "neutro"} sm>
                  {item.registroAbierto && item.estado === "publicado"
                    ? "Registro abierto"
                    : ETIQUETAS[item.estado] ?? item.estado}
                </Pildora>
              </div>
            </button>
          ))}
          {puedeEditar ? (
            <button type="button" className="ui-card ui-card-dashed ui-proj items-center justify-center" onClick={() => setCreando(true)}>
              <span className="ui-proj-mark">
                <Icono nombre="mas" tamano={16} />
              </span>
              <strong>Nuevo evento</strong>
              <span className="ui-faint text-[12.5px]">Borrador, sin registro abierto.</span>
            </button>
          ) : null}
        </div>
      )}
      {creando ? <FormularioEvento alListo={(id) => { setCreando(false); setSeleccion(id); }} alCerrar={() => setCreando(false)} /> : null}
    </>
  );
}

function DetalleEvento({
  evento,
  puedeEditar,
  esAdmin,
  volver,
}: {
  evento: EventoLista;
  puedeEditar: boolean;
  esAdmin: boolean;
  volver: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoAsistente | "">("");
  const [abierto, setAbierto] = useState<Id<"eventRegistrations"> | null>(null);
  const [editando, setEditando] = useState(false);
  const cambiarRegistro = useMutation(api.eventos.cambiarRegistroAbierto);
  const registros = useQuery(api.eventos.listarRegistros, {
    eventId: evento._id,
    ...(busqueda ? { busqueda } : {}),
    ...(estado ? { estado } : {}),
  });
  const seleccionado = registros?.find((r) => r._id === abierto) ?? null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button type="button" className="ui-faint mb-2 inline-flex items-center gap-1 text-[12.5px]" onClick={volver}>
            <Icono nombre="chevronIzquierda" tamano={13} />
            Eventos
          </button>
          <h2 className="ui-title">{evento.titulo}</h2>
          <p className="ui-desc mt-1 max-w-2xl">{evento.resumen || "Sin resumen."}</p>
          <p className="ui-faint mt-2 text-[12px]">alphaccm.org/eventos/{evento.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pildora tono={TONO_ESTADO[evento.estado] ?? "neutro"}>{ETIQUETAS[evento.estado]}</Pildora>
          {puedeEditar ? (
            <>
              <Boton onClick={() => void cambiarRegistro({ eventId: evento._id, abierto: !evento.registroAbierto })}>
                {evento.registroAbierto ? "Cerrar registro" : "Abrir registro"}
              </Boton>
              <Boton icono="lapiz" onClick={() => setEditando(true)}>
                Editar
              </Boton>
            </>
          ) : null}
          {esAdmin ? <BotonExportar eventId={evento._id} slug={evento.slug} estado={estado} /> : null}
        </div>
      </div>

      <div className="ui-grid mb-5">
        <Tarjeta className="ui-stat lg-4">
          <span className="ui-stat-label">Registros</span>
          <span className="ui-stat-value">{evento.totalRegistros}</span>
        </Tarjeta>
        <Tarjeta className="ui-stat lg-4">
          <span className="ui-stat-label">Confirmados</span>
          <span className="ui-stat-value">{evento.confirmados}</span>
        </Tarjeta>
        <Tarjeta className="ui-stat lg-4">
          <span className="ui-stat-label">Registro</span>
          <span className="ui-stat-value text-[18px]">{evento.registroAbierto ? "Abierto" : "Cerrado"}</span>
        </Tarjeta>
      </div>

      <div className="ui-split">
        <Tarjeta>
          <div className="ui-filterbar p-4 pb-0">
            <Entrada
              icono="buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo, carrera o matrícula"
            />
            <Seleccion value={estado} onChange={(e) => setEstado(e.target.value as EstadoAsistente | "")} className="max-w-[180px]">
              <option value="">Todos los estados</option>
              {ESTADOS_ASISTENTE.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS[valor]}
                </option>
              ))}
            </Seleccion>
          </div>
          {registros === undefined ? (
            <Cargando que="los asistentes" />
          ) : registros.length === 0 ? (
            <Vacio
              titulo="Sin asistentes que mostrar"
              ayuda={busqueda || estado ? "Ningún registro coincide con estos filtros." : "Los nuevos registros aparecen aquí en tiempo real."}
            />
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Carrera</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr
                      key={registro._id}
                      data-selected={abierto === registro._id ? "true" : undefined}
                      onClick={() => setAbierto(abierto === registro._id ? null : registro._id)}
                    >
                      <td className="font-medium">{registro.nombre}</td>
                      <td className="ui-faint">{registro.correo}</td>
                      <td>{registro.carrera}</td>
                      <td>
                        <Pildora tono={TONO_ESTADO[registro.estado] ?? "neutro"} sm>
                          {ETIQUETAS[registro.estado]}
                        </Pildora>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
        {seleccionado ? (
          <FichaAsistente registro={seleccionado} puedeEditar={puedeEditar} alCerrar={() => setAbierto(null)} />
        ) : null}
      </div>

      {editando ? <FormularioEvento evento={evento} alListo={() => setEditando(false)} alCerrar={() => setEditando(false)} /> : null}
    </>
  );
}

function FichaAsistente({
  registro,
  puedeEditar,
  alCerrar,
}: {
  registro: Doc<"eventRegistrations">;
  puedeEditar: boolean;
  alCerrar: () => void;
}) {
  const cambiarEstado = useMutation(api.eventos.cambiarEstadoRegistro);
  const guardarNotas = useMutation(api.eventos.guardarNotasRegistro);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const telefono = registro.telefono?.replace(/\D/g, "") ?? "";
  const numero = telefono.length === 10 ? `52${telefono}` : telefono;

  return (
    <aside className="ui-sheet">
      <div className="ui-card-h">
        <h3 className="ui-h2">{registro.nombre}</h3>
        <Boton tamano="sm" variante="fantasma" soloIcono icono="cerrar" etiqueta="Cerrar ficha" onClick={alCerrar} />
      </div>
      <dl className="ui-dl p-5">
        <dt>Correo</dt>
        <dd>{registro.correo}</dd>
        <dt>Carrera</dt>
        <dd>{registro.carrera}</dd>
        <dt>Semestre</dt>
        <dd>{registro.semestre}</dd>
        <dt>Matrícula</dt>
        <dd>{registro.matricula ?? "—"}</dd>
        <dt>Registrado</dt>
        <dd>{fecha(registro.creadoEn)}</dd>
        <dt>WhatsApp</dt>
        <dd>{registro.canales.whatsapp ? registro.telefono ?? "Sí" : "No"}</dd>
      </dl>
      {puedeEditar ? (
        <div className="grid gap-4 border-t border-[var(--line)] p-5">
          <div className="flex flex-wrap gap-3">
            {numero ? (
              <a className="ui-btn ui-btn-sm" href={`https://wa.me/${numero}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
            <a className="ui-btn ui-btn-sm" href={`/dashboard/correo?para=${encodeURIComponent(registro.correo)}`}>
              Correo
            </a>
          </div>
          <Campo etiqueta="Estado" htmlFor={`asistente-estado-${registro._id}`}>
            <SelectorPersonalizado
              id={`asistente-estado-${registro._id}`}
              valor={registro.estado}
              opciones={ESTADOS_ASISTENTE.map((valor) => ({ valor, etiqueta: ETIQUETAS[valor] ?? valor }))}
              alCambiar={(valor) => void cambiarEstado({ id: registro._id, estado: valor as EstadoAsistente })}
            />
          </Campo>
          <Campo etiqueta="Notas internas" htmlFor={`asistente-notas-${registro._id}`}>
            <AreaTexto
              id={`asistente-notas-${registro._id}`}
              value={notas}
              maxLength={2000}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap items-center gap-3">
            <Boton
              variante="primario"
              disabled={notas === (registro.notas ?? "")}
              onClick={() => void guardarNotas({ id: registro._id, notas }).then(() => setMensaje("Notas guardadas."))}
            >
              Guardar notas
            </Boton>
            {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function FormularioEvento({
  evento,
  alListo,
  alCerrar,
}: {
  evento?: EventoLista;
  alListo: (id: Id<"events">) => void;
  alCerrar: () => void;
}) {
  const crear = useMutation(api.eventos.crear);
  const actualizar = useMutation(api.eventos.actualizar);
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [resumen, setResumen] = useState(evento?.resumen ?? "");
  const [pilar, setPilar] = useState<Pilar>(evento?.pilar ?? "desarrollo");
  const [estado, setEstado] = useState<EstadoEvento>(evento?.estado ?? "borrador");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      if (evento) {
        await actualizar({ id: evento._id, titulo, resumen, pilar, estado });
        alListo(evento._id);
      } else {
        const id = await crear({ titulo, resumen, pilar });
        alListo(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="ui-modal-bg" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="evento-form-titulo" className="ui-dialog">
        <h2 id="evento-form-titulo" className="ui-h2">
          {evento ? "Editar evento" : "Nuevo evento"}
        </h2>
        <div className="mt-5 grid gap-4">
          <Campo etiqueta="Título" htmlFor="ev-titulo">
            <Entrada id="ev-titulo" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Resumen" htmlFor="ev-resumen">
            <AreaTexto id="ev-resumen" value={resumen} maxLength={400} onChange={(e) => setResumen(e.target.value)} />
          </Campo>
          <Campo etiqueta="Pilar" htmlFor="ev-pilar">
            <Seleccion id="ev-pilar" value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)}>
              {PILARES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS[opcion]}
                </option>
              ))}
            </Seleccion>
          </Campo>
          {evento ? (
            <Campo etiqueta="Estado" htmlFor="ev-estado">
              <Seleccion id="ev-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoEvento)}>
                {ESTADOS_EVENTO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETAS[opcion]}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          ) : (
            <p className="ui-help">Se crea como borrador, con el registro cerrado.</p>
          )}
        </div>
        {error ? (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Boton onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={() => void guardar()} disabled={ocupado || titulo.trim().length < 3}>
            {ocupado ? "Guardando…" : evento ? "Guardar" : "Crear evento"}
          </Boton>
        </div>
      </div>
    </div>
  );
}

type Formato = "xlsx" | "csv";
const ENCABEZADOS = ["Nombre", "Correo", "Carrera", "Semestre", "Matricula", "Correo autorizado", "WhatsApp", "Telefono", "Estado", "Notas", "Registrado"] as const;

function BotonExportar({ eventId, slug, estado }: { eventId: Id<"events">; slug: string; estado: EstadoAsistente | "" }) {
  const [pedido, setPedido] = useState<{ formato: Formato; id: number } | null>(null);
  const filas = useQuery(api.eventos.paraExportar, pedido ? { eventId, ...(estado ? { estado } : {}) } : "skip");
  const anotar = useMutation(api.eventos.registrarExportacion);
  const secuencia = useRef(0);
  const procesado = useRef(0);

  useEffect(() => {
    if (!pedido || filas === undefined || procesado.current === pedido.id) return;
    procesado.current = pedido.id;
    const datos = filas.map((r) => [
      r.nombre,
      r.correo,
      r.carrera,
      r.semestre,
      r.matricula ?? "",
      r.canales.correo ? "Si" : "No",
      r.canales.whatsapp ? "Si" : "No",
      r.telefono ?? "",
      ETIQUETAS[r.estado] ?? r.estado,
      r.notas ?? "",
      new Date(r.creadoEn).toISOString(),
    ]);
    const blob =
      pedido.formato === "xlsx"
        ? construirXlsx(ENCABEZADOS, datos)
        : new Blob([construirCsv(ENCABEZADOS, datos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${slug}-registros-${new Date().toISOString().slice(0, 10)}.${pedido.formato}`;
    enlace.click();
    URL.revokeObjectURL(url);
    void anotar({ eventId, cantidad: filas.length });
  }, [pedido, filas, anotar, eventId, slug]);

  return (
    <Menu
      disparador={() => (
        <Boton icono="descargar" disabled={pedido !== null && filas === undefined}>
          {pedido !== null && filas === undefined ? "Exportando…" : "Exportar"}
        </Boton>
      )}
    >
      <MenuItem icono="descargar" onClick={() => { secuencia.current += 1; setPedido({ formato: "xlsx", id: secuencia.current }); }}>
        Excel
      </MenuItem>
      <MenuItem icono="archivo" onClick={() => { secuencia.current += 1; setPedido({ formato: "csv", id: secuencia.current }); }}>
        CSV
      </MenuItem>
    </Menu>
  );
}
