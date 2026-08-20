"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_HILO_CORREO,
  ETIQUETAS,
  type EstadoHiloCorreo,
} from "@/convex/lib/validadores";
import { Aviso, Bandeja, Cargando, Vacio, fechaHora } from "@/components/panel/piezas";

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const FORMATO_ARCHIVO = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 1,
});

type DetalleCorreo = NonNullable<FunctionReturnType<typeof api.correo.detalle>>;

function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${FORMATO_ARCHIVO.format(bytes / 1024)} KB`;
  return `${FORMATO_ARCHIVO.format(bytes / (1024 * 1024))} MB`;
}

function limpiarError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo completar la operacion.";
  const marca = error.message.lastIndexOf("Error: ");
  return (marca === -1 ? error.message : error.message.slice(marca + 7)).split("\n")[0] ?? error.message;
}

export default function Correo() {
  const [estado, setEstado] = useState<EstadoHiloCorreo | "todos">("abierto");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Id<"mailThreads"> | null>(null);
  const [componiendo, setComponiendo] = useState(false);
  const busquedaDiferida = useDeferredValue(busqueda);

  const resumen = useQuery(api.correo.resumen, {});
  const configuracion = useQuery(api.correo.configuracion, {});
  const hilos = useQuery(api.correo.listarHilos, {
    ...(estado === "todos" ? {} : { estado }),
    ...(busquedaDiferida ? { busqueda: busquedaDiferida } : {}),
  });
  const detalle = useQuery(
    api.correo.detalle,
    seleccionado ? { id: seleccionado } : "skip",
  );
  const marcarLeido = useMutation(api.correo.marcarLeido);

  useEffect(() => {
    if (detalle?.hilo.noLeidos && detalle.hilo.noLeidos > 0) {
      void marcarLeido({ id: detalle.hilo._id });
    }
  }, [detalle?.hilo._id, detalle?.hilo.noLeidos, marcarLeido]);

  return (
    <div className="correo-entrada">
      <header className="mb-8 lg:mb-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cejilla">contacto@alphaccm.org</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <h1 className="text-[clamp(2.2rem,5vw,4.8rem)] font-bold tracking-[-.06em] leading-[.88]">
              Correo
            </h1>
            <p className="pb-1 cifra text-[12px] text-[var(--color-n600)]">
              {resumen ? `${resumen.noLeidos} sin leer · ${resumen.abiertos} abiertos` : "Sincronizando"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="boton group justify-between min-w-[180px]"
          onClick={() => setComponiendo(true)}
        >
          Nuevo correo
          <span className="grid size-7 place-items-center bg-white/12 transition-transform duration-500 ease-[var(--E)] group-hover:translate-x-0.5">
            <Flecha />
          </span>
        </button>
      </header>

      {configuracion && (!configuracion.listo || configuracion.modoPrueba) ? (
        <div className="mb-5 bg-[var(--color-ink)] px-5 py-4 text-white grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="rotulo text-white/50">Configuracion pendiente</p>
            <p className="mt-1 text-[12.5px] text-white/75">
              {!configuracion.listo
                ? "Faltan las claves de Resend en Convex. La bandeja funciona, pero no puede enviar ni recibir todavia."
                : "Resend sigue en modo de prueba y solo acepta sus direcciones de test."}
            </p>
          </div>
          <span className="cifra text-[10px] text-white/45">RESEND</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(330px,0.84fr)_minmax(520px,1.6fr)]">
        <Bandeja className={seleccionado ? "hidden xl:block" : "block"}>
          <section className="min-h-[650px]">
            <div className="p-5 sm:p-6 border-b border-[var(--hair)]">
              <div className="campo">
                <label htmlFor="buscar-correo">Buscar en correo</label>
                <input
                  id="buscar-correo"
                  className="entrada"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Persona, asunto o contenido"
                  autoComplete="off"
                />
              </div>
              <div className="mt-5 flex gap-1 overflow-x-auto" aria-label="Estado de conversaciones">
                {(["todos", ...ESTADOS_HILO_CORREO] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    className={`px-3 py-2 text-[10px] font-medium tracking-[.13em] uppercase transition-colors duration-500 ease-[var(--E)] ${
                      estado === opcion
                        ? "bg-[var(--color-ink)] text-white"
                        : "text-[var(--color-n600)] hover:bg-[var(--color-surface)]"
                    }`}
                    onClick={() => setEstado(opcion)}
                  >
                    {opcion === "todos" ? "Todos" : ETIQUETAS[opcion]}
                  </button>
                ))}
              </div>
            </div>

            {hilos === undefined ? (
              <Cargando que="las conversaciones" />
            ) : hilos.length === 0 ? (
              <Vacio
                titulo="La bandeja esta limpia"
                ayuda={
                  busqueda || estado !== "abierto"
                    ? "No hay conversaciones con estos filtros."
                    : "Los mensajes enviados a contacto@alphaccm.org apareceran aqui."
                }
              />
            ) : (
              <ol className="correo-lista">
                {hilos.map((hilo, indice) => (
                  <li key={hilo._id}>
                    <button
                      type="button"
                      className={`correo-fila w-full text-left px-5 sm:px-6 py-5 grid grid-cols-[28px_1fr_auto] gap-x-3 gap-y-2 ${
                        seleccionado === hilo._id ? "correo-fila-activa" : ""
                      }`}
                      onClick={() => setSeleccionado(hilo._id)}
                    >
                      <span className="cifra pt-0.5 text-[9px] text-[var(--color-n500)]">
                        {String(indice + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-[13px] ${hilo.noLeidos ? "font-semibold" : "font-medium"}`}>
                            {hilo.contactoNombre || hilo.contactoCorreo}
                          </span>
                          {hilo.noLeidos > 0 ? (
                            <span className="grid min-w-5 h-5 place-items-center bg-[var(--color-accent)] px-1 cifra text-[9px] text-white">
                              {hilo.noLeidos}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block truncate text-[12px] text-[var(--color-cuerpo)]">
                          {hilo.asunto}
                        </span>
                        <span className="mt-1 block truncate text-[11px] font-light text-[var(--color-n600)]">
                          {hilo.ultimoResumen}
                        </span>
                      </span>
                      <span className="cifra text-[9px] text-[var(--color-n500)] whitespace-nowrap">
                        {FORMATO_HORA.format(new Date(hilo.ultimoMensajeEn))}
                      </span>
                      {hilo.asignadoNombre ? (
                        <span className="col-start-2 text-[9px] tracking-[.12em] uppercase text-[var(--color-accent)]">
                          {hilo.asignadoNombre}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </Bandeja>

        <div className={!seleccionado ? "hidden xl:block" : "block"}>
          <Bandeja oscura={!seleccionado}>
            {!seleccionado ? (
              <div className="min-h-[650px] grid content-between p-8 lg:p-12">
                <p className="rotulo text-white/45">Correspondencia Alpha</p>
                <div className="max-w-[34rem]">
                  <p className="text-[clamp(2rem,4vw,4rem)] font-semibold tracking-[-.055em] leading-[.98]">
                    Una bandeja para el equipo, con cada respuesta en contexto.
                  </p>
                  <p className="mt-6 max-w-[46ch] text-[13px] font-light leading-[1.8] text-white/55">
                    Selecciona una conversacion. Los adjuntos, responsables y estados de entrega
                    quedan organizados en un solo lugar.
                  </p>
                </div>
              </div>
            ) : detalle === undefined ? (
              <Cargando que="la conversacion" />
            ) : detalle === null ? (
              <Vacio titulo="Conversacion no disponible" ayuda="Puede haberse eliminado o movido." />
            ) : (
              <Conversacion
                detalle={detalle}
                volver={() => setSeleccionado(null)}
              />
            )}
          </Bandeja>
        </div>
      </div>

      {componiendo ? (
        <CompositorNuevo
          cerrar={() => setComponiendo(false)}
          enviado={(threadId) => {
            setComponiendo(false);
            setEstado("abierto");
            setSeleccionado(threadId);
          }}
        />
      ) : null}
    </div>
  );
}

function Conversacion({
  detalle,
  volver,
}: {
  detalle: DetalleCorreo;
  volver: () => void;
}) {
  const cambiarEstado = useMutation(api.correo.cambiarEstado);
  const tomar = useMutation(api.correo.tomar);
  const [error, setError] = useState<string | null>(null);
  const hilo = detalle.hilo;

  const aplicar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(limpiarError(e));
    }
  };

  return (
    <section className="min-h-[650px] flex flex-col">
      <header className="px-5 py-5 sm:px-8 sm:py-7 border-b border-[var(--hair)]">
        <button
          type="button"
          className="xl:hidden mb-5 text-[10px] tracking-[.14em] uppercase text-[var(--color-accent)]"
          onClick={volver}
        >
          Volver a la bandeja
        </button>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            <p className="rotulo">{hilo.contactoNombre || hilo.contactoCorreo}</p>
            <h2 className="mt-3 text-[clamp(1.45rem,3vw,2.35rem)] font-semibold tracking-[-.045em] leading-[1.05]">
              {hilo.asunto}
            </h2>
            <p className="mt-2 cifra text-[10px] text-[var(--color-n600)] break-all">
              {hilo.contactoCorreo}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              className="boton boton-linea px-3 py-2 text-[10px]"
              onClick={() => void aplicar(() => tomar({ id: hilo._id, tomar: !hilo.asignadoA }))}
            >
              {hilo.asignadoA ? "Liberar" : "Tomar"}
            </button>
            <select
              aria-label="Estado de la conversacion"
              className="entrada w-auto min-w-[118px] py-2 text-[11px]"
              value={hilo.estado}
              onChange={(event) =>
                void aplicar(() =>
                  cambiarEstado({ id: hilo._id, estado: event.target.value as EstadoHiloCorreo }),
                )
              }
            >
              {ESTADOS_HILO_CORREO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS[opcion]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hilo.asignadoNombre ? (
          <p className="mt-4 text-[10px] tracking-[.12em] uppercase text-[var(--color-accent)]">
            Responsable: {hilo.asignadoNombre}
          </p>
        ) : null}
        {error ? <div className="mt-3"><Aviso tono="error">{error}</Aviso></div> : null}
      </header>

      <ol className="flex-1 px-5 py-4 sm:px-8 sm:py-6">
        {detalle.mensajes.map((mensaje) => (
          <li
            key={mensaje._id}
            className={`correo-mensaje py-7 ${mensaje.direccion === "saliente" ? "correo-mensaje-saliente" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12px] font-semibold">
                {mensaje.direccion === "entrante" ? mensaje.de : "Alpha CCM"}
              </p>
              <p className="cifra text-[9px] text-[var(--color-n500)]">
                {fechaHora(mensaje.creadoEn)}
              </p>
            </div>
            <p className="mt-1 cifra text-[9px] text-[var(--color-n500)] break-all">
              {mensaje.direccion === "entrante"
                ? `Para ${mensaje.para.join(", ")}`
                : `Para ${mensaje.para.join(", ")} · ${ETIQUETAS[mensaje.estado] ?? mensaje.estado}`}
            </p>
            <div className="mt-5 whitespace-pre-wrap text-[13px] font-light leading-[1.85] text-[var(--color-cuerpo)]">
              {mensaje.texto}
            </div>
            {mensaje.adjuntos.length > 0 ? (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {mensaje.adjuntos.map((adjunto) => (
                  <li key={adjunto._id}>
                    {adjunto.url ? (
                      <a
                        href={adjunto.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block bg-[var(--color-surface)] px-4 py-3 transition-transform duration-500 ease-[var(--E)] hover:-translate-y-0.5"
                      >
                        <span className="block truncate text-[11px] font-medium">{adjunto.nombre}</span>
                        <span className="mt-1 block cifra text-[9px] text-[var(--color-n600)]">
                          {tamanoArchivo(adjunto.tamano)} · {adjunto.tipoContenido}
                        </span>
                      </a>
                    ) : (
                      <span className="block bg-[var(--color-surface)] px-4 py-3 text-[11px] text-[var(--color-n600)]">
                        {adjunto.nombre} no disponible
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {mensaje.error ? (
              <div className="mt-4"><Aviso tono="error">{mensaje.error}</Aviso></div>
            ) : null}
          </li>
        ))}
      </ol>

      <Responder threadId={hilo._id} para={hilo.contactoCorreo} asunto={hilo.asunto} />
    </section>
  );
}

function Responder({
  threadId,
  para,
  asunto,
}: {
  threadId: Id<"mailThreads">;
  para: string;
  asunto: string;
}) {
  const enviar = useMutation(api.correo.enviar);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const requestId = useRef<string | null>(null);

  const responder = async () => {
    setOcupado(true);
    setAviso(null);
    requestId.current ??= crypto.randomUUID();
    try {
      await enviar({ clientRequestId: requestId.current, threadId, asunto, texto });
      setTexto("");
      requestId.current = null;
      setAviso({ tono: "exito", texto: "Respuesta en cola para envio." });
    } catch (error) {
      setAviso({ tono: "error", texto: limpiarError(error) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="m-3 mt-0 bg-[var(--color-surface)] p-[7px] sm:m-5 sm:mt-0">
      <div className="bg-[var(--color-ground)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`respuesta-${threadId}`} className="rotulo">Responder a {para}</label>
          <span className="cifra text-[9px] text-[var(--color-n500)]">contacto@alphaccm.org</span>
        </div>
        <textarea
          id={`respuesta-${threadId}`}
          className="entrada mt-3 min-h-[118px] resize-y"
          value={texto}
          maxLength={20_000}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Escribe una respuesta clara y directa."
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <span />}
          <button
            type="button"
            className="boton"
            disabled={ocupado || texto.trim() === ""}
            onClick={() => void responder()}
          >
            {ocupado ? "Enviando…" : "Enviar respuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompositorNuevo({
  cerrar,
  enviado,
}: {
  cerrar: () => void;
  enviado: (threadId: Id<"mailThreads">) => void;
}) {
  const enviar = useMutation(api.correo.enviar);
  const [para, setPara] = useState("");
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  const mandar = async () => {
    setOcupado(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const resultado = await enviar({
        clientRequestId: requestId.current,
        para,
        asunto,
        texto,
      });
      requestId.current = null;
      enviado(resultado.threadId);
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 bg-[rgba(13,33,64,.68)] backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-correo-titulo"
        className="correo-compositor w-full max-w-[760px] bg-[var(--color-surface)] p-[7px]"
      >
        <div className="bg-[var(--color-ground)] p-6 sm:p-9 max-h-[92dvh] overflow-y-auto">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="cejilla">Desde contacto@alphaccm.org</p>
              <h2 id="nuevo-correo-titulo" className="mt-3 text-[2rem] sm:text-[2.7rem] font-semibold tracking-[-.055em] leading-none">
                Nuevo correo
              </h2>
            </div>
            <button
              type="button"
              className="grid size-10 place-items-center bg-[var(--color-surface)] text-[20px]"
              aria-label="Cerrar compositor"
              onClick={cerrar}
            >
              ×
            </button>
          </div>

          <div className="mt-8 grid gap-6">
            <div className="campo">
              <label htmlFor="nuevo-para">Para</label>
              <input
                id="nuevo-para"
                className="entrada"
                type="email"
                value={para}
                maxLength={320}
                onChange={(event) => setPara(event.target.value)}
                placeholder="persona@ejemplo.com"
                autoFocus
              />
            </div>
            <div className="campo">
              <label htmlFor="nuevo-asunto">Asunto</label>
              <input
                id="nuevo-asunto"
                className="entrada"
                value={asunto}
                maxLength={180}
                onChange={(event) => setAsunto(event.target.value)}
                placeholder="Asunto del mensaje"
              />
            </div>
            <div className="campo">
              <label htmlFor="nuevo-texto">Mensaje</label>
              <textarea
                id="nuevo-texto"
                className="entrada min-h-[220px] resize-y"
                value={texto}
                maxLength={20_000}
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Escribe el mensaje."
              />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            {error ? <Aviso tono="error">{error}</Aviso> : <span />}
            <div className="flex gap-2">
              <button type="button" className="boton boton-linea" onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton"
                disabled={ocupado || !para || !asunto.trim() || !texto.trim()}
                onClick={() => void mandar()}
              >
                {ocupado ? "Enviando…" : "Enviar correo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.35]">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}
