"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_ASISTENTE,
  ETIQUETAS,
  type EstadoAsistente,
} from "@/convex/lib/validadores";
import { construirCsv } from "@/lib/csv";
import { construirXlsx } from "@/lib/xlsx";
import { Aviso, Bandeja, Cargando, Marca, Vacio, fecha } from "@/components/panel/piezas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

export default function Eventos() {
  const yo = useQuery(api.usuarios.yo, {});
  const eventos = useQuery(api.eventos.listar, {});
  const [seleccion, setSeleccion] = useState<Id<"events"> | null>(null);

  const evento = eventos?.find((e) => e._id === seleccion) ?? eventos?.[0];
  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";

  return (
    <>
      {eventos === undefined ? (
        <Bandeja><Cargando que="los eventos" /></Bandeja>
      ) : eventos.length === 0 ? (
        <Bandeja>
          <Vacio titulo="Todavia no hay eventos" ayuda="Los eventos con registro apareceran aqui." />
        </Bandeja>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Bandeja>
            <div className="p-5 sm:p-6">
              <p className="rotulo">Eventos con registro</p>
              <ul className="mt-5">
                {eventos.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => setSeleccion(item._id)}
                      className={`fila w-full px-3 py-4 text-left ${evento?._id === item._id ? "bg-[var(--color-surface)]" : ""}`}
                    >
                      <span className="block text-[14px] font-semibold">{item.titulo}</span>
                      <span className="mt-2 flex items-center justify-between gap-3">
                        <Marca estado={item.estado} />
                        <span className="cifra text-[12px] text-[var(--color-n600)]">{item.totalRegistros}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Bandeja>
          {evento ? <DetalleEvento evento={evento} puedeEditar={puedeEditar} esAdmin={yo?.rol === "admin"} /> : null}
        </div>
      )}
    </>
  );
}

function DetalleEvento({
  evento,
  puedeEditar,
  esAdmin,
}: {
  evento: Doc<"events">;
  puedeEditar: boolean;
  esAdmin: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoAsistente | "">("");
  const [abierto, setAbierto] = useState<Id<"eventRegistrations"> | null>(null);
  const cambiarRegistro = useMutation(api.eventos.cambiarRegistroAbierto);
  const registros = useQuery(api.eventos.listarRegistros, {
    eventId: evento._id,
    ...(busqueda ? { busqueda } : {}),
    ...(estado ? { estado } : {}),
  });

  return (
    <div className="min-w-0">
      <Bandeja oscura>
        <div className="grid gap-7 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <p className="rotulo text-white/45">Evento</p>
            <h2 className="mt-3 text-[clamp(1.8rem,5vw,3.2rem)] font-bold tracking-[-.05em]">{evento.titulo}</h2>
            <p className="mt-4 max-w-2xl text-[13px] font-light leading-7 text-white/62">{evento.resumen}</p>
          </div>
          <div className="flex min-w-[160px] flex-col justify-between gap-5 sm:items-end">
            <div>
              <p className="cifra text-[42px] font-semibold leading-none">{evento.totalRegistros}</p>
              <p className="mt-2 text-[10px] uppercase tracking-[.16em] text-white/45">Registros</p>
            </div>
            {puedeEditar ? (
              <button
                type="button"
                className="boton"
                onClick={() => void cambiarRegistro({ eventId: evento._id, abierto: !evento.registroAbierto })}
              >
                {evento.registroAbierto ? "Cerrar registro" : "Abrir registro"}
              </button>
            ) : (
              <span className="text-[11px] text-white/60">{evento.registroAbierto ? "Registro abierto" : "Registro cerrado"}</span>
            )}
          </div>
        </div>
      </Bandeja>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-[minmax(220px,1fr)_180px]">
          <div className="campo">
            <label htmlFor="evento-busqueda">Buscar</label>
            <input
              id="evento-busqueda"
              className="entrada"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo, carrera o matrícula"
            />
          </div>
          <div className="campo">
            <label htmlFor="evento-estado">Estado</label>
            <SelectorPersonalizado
              id="evento-estado"
              valor={estado}
              opciones={[
                { valor: "", etiqueta: "Todos" },
                ...ESTADOS_ASISTENTE.map((valor) => ({ valor, etiqueta: ETIQUETAS[valor] ?? valor })),
              ]}
              alCambiar={(valor) => setEstado(valor as EstadoAsistente | "")}
            />
          </div>
        </div>
        {esAdmin ? <BotonExportar eventId={evento._id} slug={evento.slug} estado={estado} /> : null}
      </div>

      <Bandeja className="mt-5">
        {registros === undefined ? (
          <Cargando que="los asistentes" />
        ) : registros.length === 0 ? (
          <Vacio
            titulo="Sin asistentes que mostrar"
            ayuda={busqueda || estado ? "Ningun registro coincide con estos filtros." : "Los nuevos registros apareceran aqui en tiempo real."}
          />
        ) : (
          <div className="px-5 py-2 sm:px-7">
            <ul>
              {registros.map((registro, indice) => (
                <li key={registro._id}>
                  <button
                    type="button"
                    className="fila grid w-full grid-cols-[32px_1fr_auto] items-center gap-4 py-4 text-left sm:grid-cols-[32px_1fr_130px]"
                    aria-expanded={abierto === registro._id}
                    onClick={() => setAbierto(abierto === registro._id ? null : registro._id)}
                  >
                    <span className="cifra text-[11px] text-[var(--color-n500)]">{String(indice + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{registro.nombre}</span>
                      <span className="cifra mt-1 block truncate text-[11px] text-[var(--color-n600)]">{registro.correo}</span>
                    </span>
                    <span className="justify-self-end sm:justify-self-start"><Marca estado={registro.estado} /></span>
                  </button>
                  {abierto === registro._id ? <Ficha registro={registro} puedeEditar={puedeEditar} /> : null}
                </li>
              ))}
            </ul>
            <p className="py-4 text-[11px] text-[var(--color-n600)]">{registros.length} en pantalla</p>
          </div>
        )}
      </Bandeja>
    </div>
  );
}

function Ficha({ registro, puedeEditar }: { registro: Doc<"eventRegistrations">; puedeEditar: boolean }) {
  const cambiarEstado = useMutation(api.eventos.cambiarEstadoRegistro);
  const guardarNotas = useMutation(api.eventos.guardarNotasRegistro);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const telefono = registro.telefono?.replace(/\D/g, "") ?? "";
  const numero = telefono.length === 10 ? `52${telefono}` : telefono;

  return (
    <div className="mb-1 grid gap-7 bg-[var(--color-surface)] px-5 py-7 sm:px-7 lg:grid-cols-2">
      <dl className="grid gap-4 text-[13px]">
        <Dato titulo="Carrera" valor={registro.carrera} />
        <Dato titulo="Semestre" valor={registro.semestre} />
        <Dato titulo="Matrícula" valor={registro.matricula ?? "—"} />
        <Dato titulo="Registrado" valor={fecha(registro.creadoEn)} />
        <Dato titulo="Correo" valor={registro.canales.correo ? "Sí" : "No"} />
        <Dato titulo="WhatsApp" valor={registro.canales.whatsapp ? registro.telefono ?? "Sí" : "No"} />
        {puedeEditar ? (
          <div className="mt-1 flex flex-wrap gap-5 border-t border-[var(--hair)] pt-4">
            {numero ? <a className="text-[12px] font-medium text-[var(--color-accent)]" href={`https://wa.me/${numero}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
            <a className="text-[12px] font-medium text-[var(--color-accent)]" href={`/dashboard/correo?para=${encodeURIComponent(registro.correo)}`}>Correo</a>
          </div>
        ) : null}
      </dl>
      <div>
        {puedeEditar ? (
          <>
            <div className="campo">
              <label htmlFor={`asistente-estado-${registro._id}`}>Estado</label>
              <SelectorPersonalizado
                id={`asistente-estado-${registro._id}`}
                valor={registro.estado}
                opciones={ESTADOS_ASISTENTE.map((valor) => ({ valor, etiqueta: ETIQUETAS[valor] ?? valor }))}
                alCambiar={(valor) => void cambiarEstado({ id: registro._id, estado: valor as EstadoAsistente })}
              />
            </div>
            <div className="campo mt-6">
              <label htmlFor={`asistente-notas-${registro._id}`}>Notas internas</label>
              <textarea
                id={`asistente-notas-${registro._id}`}
                className="entrada min-h-[90px] resize-y"
                value={notas}
                maxLength={2000}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="boton"
                disabled={notas === (registro.notas ?? "")}
                onClick={() => void guardarNotas({ id: registro._id, notas }).then(() => setMensaje("Notas guardadas."))}
              >
                Guardar notas
              </button>
              {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
            </div>
          </>
        ) : (
          <Dato titulo="Notas internas" valor={registro.notas ?? "Sin notas."} />
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return <div><dt className="rotulo">{titulo}</dt><dd className="mt-1.5 leading-[1.6] whitespace-pre-wrap">{valor}</dd></div>;
}

type Formato = "xlsx" | "csv";
const ENCABEZADOS = ["Nombre", "Correo", "Carrera", "Semestre", "Matricula", "Correo autorizado", "WhatsApp", "Telefono", "Estado", "Notas", "Registrado"] as const;

function BotonExportar({ eventId, slug, estado }: { eventId: Id<"events">; slug: string; estado: EstadoAsistente | "" }) {
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState<{ formato: Formato; id: number } | null>(null);
  const filas = useQuery(api.eventos.paraExportar, pedido ? { eventId, ...(estado ? { estado } : {}) } : "skip");
  const anotar = useMutation(api.eventos.registrarExportacion);
  const secuencia = useRef(0);
  const procesado = useRef(0);
  const excelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pedido || filas === undefined || procesado.current === pedido.id) return;
    procesado.current = pedido.id;
    const datos = filas.map((r) => [r.nombre, r.correo, r.carrera, r.semestre, r.matricula ?? "", r.canales.correo ? "Si" : "No", r.canales.whatsapp ? "Si" : "No", r.telefono ?? "", ETIQUETAS[r.estado] ?? r.estado, r.notas ?? "", new Date(r.creadoEn).toISOString()]);
    const blob = pedido.formato === "xlsx" ? construirXlsx(ENCABEZADOS, datos) : new Blob([construirCsv(ENCABEZADOS, datos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${slug}-registros-${new Date().toISOString().slice(0, 10)}.${pedido.formato}`;
    enlace.click();
    URL.revokeObjectURL(url);
    void anotar({ eventId, cantidad: filas.length });
  }, [pedido, filas, anotar, eventId, slug]);

  const exportar = (formato: Formato) => {
    secuencia.current += 1;
    setPedido({ formato, id: secuencia.current });
  };

  const cargando = pedido !== null && filas === undefined;

  return (
    <div
      className={`relative h-11 overflow-hidden border border-[var(--hair)] bg-transparent transition-[width,background-color] duration-300 ease-[var(--E)] motion-reduce:transition-none sm:h-10 ${
        abierto ? "w-[152px] bg-[var(--color-surface)]" : "w-[108px]"
      }`}
    >
      <button
        type="button"
        className={`absolute inset-0 grid place-items-center text-[13px] font-medium transition-[opacity,transform] duration-200 ease-[var(--E)] motion-reduce:transition-none ${
          abierto ? "pointer-events-none -translate-y-1 opacity-0" : "translate-y-0 opacity-100"
        }`}
        aria-expanded={abierto}
        onClick={() => {
          setAbierto(true);
          requestAnimationFrame(() => excelRef.current?.focus());
        }}
      >
        Exportar
      </button>
      <div
        className={`absolute inset-0 grid grid-cols-2 transition-[opacity,transform] duration-200 ease-[var(--E)] motion-reduce:transition-none ${
          abierto ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
        }`}
        role="group"
        aria-label="Formato de exportacion"
      >
        <button
          ref={excelRef}
          type="button"
          className="border-r border-[var(--hair)] text-[11px] font-medium transition-colors duration-200 hover:bg-white disabled:opacity-45"
          disabled={cargando}
          onClick={() => exportar("xlsx")}
        >
          {cargando && pedido?.formato === "xlsx" ? "···" : "Excel"}
        </button>
        <button
          type="button"
          className="text-[11px] font-medium uppercase tracking-[.04em] transition-colors duration-200 hover:bg-white disabled:opacity-45"
          disabled={cargando}
          onClick={() => exportar("csv")}
        >
          {cargando && pedido?.formato === "csv" ? "···" : "CSV"}
        </button>
      </div>
    </div>
  );
}
