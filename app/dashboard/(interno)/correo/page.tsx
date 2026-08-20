"use client";

import { Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
const REMITENTE_PREDETERMINADO = "contacto@alphaccm.org";

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
  return (
    <Suspense fallback={<Cargando que="el correo" />}>
      <CorreoContenido />
    </Suspense>
  );
}

function CorreoContenido() {
  const searchParams = useSearchParams();
  const destinatarioEnUrl = searchParams.get("para")?.trim() ?? "";
  const [estado, setEstado] = useState<EstadoHiloCorreo | "todos">("abierto");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Id<"mailThreads"> | null>(null);
  const [componiendo, setComponiendo] = useState(Boolean(destinatarioEnUrl));
  const [paraInicial, setParaInicial] = useState(destinatarioEnUrl);
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

  useEffect(() => {
    if (!destinatarioEnUrl) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("para");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [destinatarioEnUrl]);

  return (
    <div className="correo-entrada">
      <header className="mb-8 lg:mb-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cejilla">Bandeja compartida de Alpha</p>
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
          onClick={() => {
            setParaInicial("");
            setComponiendo(true);
          }}
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

      <div className="correo-workspace grid min-h-0 gap-4 xl:grid-cols-[minmax(330px,0.84fr)_minmax(520px,1.6fr)]">
        <Bandeja className={`correo-panel ${seleccionado ? "hidden xl:block" : "block"}`}>
          <section className="flex h-full min-h-0 flex-col">
            <div className="flex-none p-5 sm:p-6 border-b border-[var(--hair)]">
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

            <div className="correo-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {hilos === undefined ? (
                <Cargando que="las conversaciones" />
              ) : hilos.length === 0 ? (
                <Vacio
                  titulo="La bandeja esta limpia"
                  ayuda={
                    busqueda || estado !== "abierto"
                      ? "No hay conversaciones con estos filtros."
                      : "Los mensajes enviados a contacto@, direccion@ o finanzas@ apareceran aqui."
                  }
                />
              ) : (
                <ol className="correo-lista">
                  {hilos.map((hilo, indice) => (
                    <li key={hilo._id}>
                      <button
                        type="button"
                        aria-pressed={seleccionado === hilo._id}
                        className={`correo-fila w-full text-left px-5 sm:px-6 py-4.5 grid grid-cols-[38px_1fr_auto] gap-x-3 gap-y-1.5 ${
                          seleccionado === hilo._id ? "correo-fila-activa" : ""
                        }`}
                        onClick={() => setSeleccionado(hilo._id)}
                      >
                        <span className="correo-avatar row-span-3" aria-hidden="true">
                          {(hilo.contactoNombre || hilo.contactoCorreo).charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-[13px] ${hilo.noLeidos ? "font-semibold" : "font-medium"}`}>
                              {hilo.contactoNombre || hilo.contactoCorreo}
                            </span>
                            {hilo.noLeidos > 0 ? (
                              <span className="correo-no-leidos">
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
                        <span className="cifra pt-0.5 text-[8.5px] text-[var(--color-n500)] whitespace-nowrap">
                          {FORMATO_HORA.format(new Date(hilo.ultimoMensajeEn))}
                        </span>
                        {hilo.asignadoNombre ? (
                          <span className="col-start-2 text-[8.5px] font-medium tracking-[.1em] uppercase text-[var(--color-accent)]">
                            {hilo.asignadoNombre}
                          </span>
                        ) : (
                          <span className="col-start-2 cifra text-[8px] text-[var(--color-n400)]">
                            {String(indice + 1).padStart(2, "0")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </Bandeja>

        <div className={`min-h-0 ${!seleccionado ? "hidden xl:block" : "block"}`}>
          <Bandeja className="correo-panel" oscura={!seleccionado}>
            {!seleccionado ? (
              <div className="grid h-full content-between p-8 lg:p-12">
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
                remitentes={configuracion?.remitentes ?? [REMITENTE_PREDETERMINADO]}
                volver={() => setSeleccionado(null)}
                eliminado={() => setSeleccionado(null)}
              />
            )}
          </Bandeja>
        </div>
      </div>

      {componiendo ? (
        <CompositorNuevo
          paraInicial={paraInicial}
          remitentes={configuracion?.remitentes ?? [REMITENTE_PREDETERMINADO]}
          cerrar={() => {
            setComponiendo(false);
            setParaInicial("");
          }}
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
  remitentes,
  volver,
  eliminado,
}: {
  detalle: DetalleCorreo;
  remitentes: string[];
  volver: () => void;
  eliminado: () => void;
}) {
  const cambiarEstado = useMutation(api.correo.cambiarEstado);
  const tomar = useMutation(api.correo.tomar);
  const eliminarHilo = useMutation(api.correo.eliminarHilo);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const hilo = detalle.hilo;

  const aplicar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(limpiarError(e));
    }
  };

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    try {
      await eliminarHilo({ id: hilo._id });
      eliminado();
    } catch (e) {
      setError(limpiarError(e));
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      <section className="correo-conversacion flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex-none border-b border-[var(--hair)]">
          <div className="correo-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="correo-icono-boton xl:hidden"
              onClick={volver}
              aria-label="Volver a la bandeja"
            >
              <IconoVolver />
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="correo-accion"
                onClick={() => void aplicar(() => tomar({ id: hilo._id, tomar: !hilo.asignadoA }))}
              >
                <IconoUsuario />
                {hilo.asignadoA ? "Liberar" : "Tomar"}
              </button>
              <select
                aria-label="Estado de la conversacion"
                className="correo-estado"
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
              <button
                type="button"
                className="correo-icono-boton correo-eliminar"
                onClick={() => setConfirmando(true)}
                aria-label="Eliminar conversacion"
                title="Eliminar conversacion"
              >
                <IconoPapelera />
              </button>
            </div>
          </div>
          <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-8">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <h2 className="min-w-0 flex-1 text-[clamp(1.55rem,3vw,2.45rem)] font-semibold tracking-[-.045em] leading-[1.08]">
                {hilo.asunto}
              </h2>
              <span className="correo-estado-etiqueta">{ETIQUETAS[hilo.estado]}</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="correo-avatar correo-avatar-grande" aria-hidden="true">
                {(hilo.contactoNombre || hilo.contactoCorreo).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">
                  {hilo.contactoNombre || hilo.contactoCorreo}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--color-n600)]">
                  {hilo.contactoCorreo}
                  {hilo.asignadoNombre ? ` · Responsable: ${hilo.asignadoNombre}` : ""}
                </p>
              </div>
            </div>
            {error ? <div className="mt-4"><Aviso tono="error">{error}</Aviso></div> : null}
          </div>
        </header>

        <ol className="correo-mensajes correo-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          {detalle.mensajes.map((mensaje) => (
            <li
              key={mensaje._id}
              className={`correo-mensaje ${mensaje.direccion === "saliente" ? "correo-mensaje-saliente" : ""}`}
            >
              <div className="correo-mensaje-cabecera">
                <span className="correo-avatar" aria-hidden="true">
                  {mensaje.direccion === "entrante"
                    ? (hilo.contactoNombre || mensaje.de).charAt(0).toUpperCase()
                    : "A"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold">
                    {mensaje.direccion === "entrante" ? mensaje.de : "Alpha CCM"}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-[var(--color-n500)]">
                    Para {mensaje.para.join(", ")}
                    {mensaje.direccion === "saliente" ? ` · ${ETIQUETAS[mensaje.estado] ?? mensaje.estado}` : ""}
                  </p>
                </div>
                <p className="cifra shrink-0 text-[8.5px] text-[var(--color-n500)]">
                  {fechaHora(mensaje.creadoEn)}
                </p>
              </div>
              <div className="correo-mensaje-cuerpo whitespace-pre-wrap text-[13px] font-light leading-[1.85] text-[var(--color-cuerpo)]">
                {mensaje.texto}
              </div>
              {mensaje.adjuntos.length > 0 ? (
                <ul className="correo-adjuntos grid gap-2 sm:grid-cols-2">
                  {mensaje.adjuntos.map((adjunto) => (
                    <li key={adjunto._id}>
                      {adjunto.url ? (
                        <a
                          href={adjunto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="correo-adjunto"
                        >
                          <span className="block truncate text-[11px] font-medium">{adjunto.nombre}</span>
                          <span className="mt-1 block cifra text-[9px] text-[var(--color-n600)]">
                            {tamanoArchivo(adjunto.tamano)} · {adjunto.tipoContenido}
                          </span>
                        </a>
                      ) : (
                        <span className="correo-adjunto block text-[11px] text-[var(--color-n600)]">
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
          <li className="correo-responder-final">
            <button
              type="button"
              className="boton boton-linea group"
              onClick={() => setRespondiendo(true)}
            >
              <IconoResponder />
              Responder
            </button>
          </li>
        </ol>
      </section>

      {respondiendo ? (
        <Responder
          threadId={hilo._id}
          para={hilo.contactoCorreo}
          asunto={hilo.asunto}
          remitentes={remitentes}
          remitenteInicial={
            [...detalle.mensajes].reverse().find((mensaje) => mensaje.direccion === "saliente")?.de
          }
          cerrar={() => setRespondiendo(false)}
        />
      ) : null}

      {confirmando ? (
        <ConfirmarEliminacion
          asunto={hilo.asunto}
          ocupado={eliminando}
          cancelar={() => setConfirmando(false)}
          confirmar={() => void eliminar()}
        />
      ) : null}
    </>
  );
}

function Responder({
  threadId,
  para,
  asunto,
  remitentes,
  remitenteInicial,
  cerrar,
}: {
  threadId: Id<"mailThreads">;
  para: string;
  asunto: string;
  remitentes: string[];
  remitenteInicial?: string;
  cerrar: () => void;
}) {
  const enviar = useMutation(api.correo.enviar);
  const [texto, setTexto] = useState("");
  const [remitente, setRemitente] = useState(
    remitenteInicial && remitentes.includes(remitenteInicial)
      ? remitenteInicial
      : remitentes[0] ?? REMITENTE_PREDETERMINADO,
  );
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const requestId = useRef<string | null>(null);

  const responder = async () => {
    setOcupado(true);
    setAviso(null);
    requestId.current ??= crypto.randomUUID();
    try {
      await enviar({ clientRequestId: requestId.current, threadId, remitente, asunto, texto });
      setTexto("");
      requestId.current = null;
      cerrar();
    } catch (error) {
      setAviso({ tono: "error", texto: limpiarError(error) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="correo-dialogo-fondo" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`respuesta-titulo-${threadId}`}
        className="correo-respuesta-modal correo-compositor"
      >
        <div className="correo-respuesta-modal-nucleo">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="cejilla">Correo compartido de Alpha</p>
              <h3
                id={`respuesta-titulo-${threadId}`}
                className="mt-3 text-[clamp(1.7rem,4vw,2.6rem)] font-semibold tracking-[-.05em] leading-none"
              >
                Responder
              </h3>
              <p className="mt-3 truncate text-[11px] text-[var(--color-n600)]">Para {para}</p>
            </div>
            <button
              type="button"
              className="correo-icono-boton bg-[var(--color-surface)] text-[20px]"
              aria-label="Cerrar respuesta"
              onClick={cerrar}
            >
              ×
            </button>
          </div>
          <div className="campo mt-7 max-w-[22rem]">
            <label htmlFor={`respuesta-remitente-${threadId}`}>Desde</label>
            <select
              id={`respuesta-remitente-${threadId}`}
              className="entrada"
              value={remitente}
              onChange={(event) => setRemitente(event.target.value)}
            >
              {remitentes.map((correo) => (
                <option key={correo} value={correo}>
                  {correo}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor={`respuesta-${threadId}`} className="sr-only">Respuesta</label>
          <textarea
            id={`respuesta-${threadId}`}
            className="entrada correo-respuesta-texto mt-7 resize-y"
            value={texto}
            maxLength={20_000}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Escribe una respuesta clara y directa."
            autoFocus
          />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <span />}
            <div className="ml-auto flex gap-2">
              <button type="button" className="boton boton-linea" disabled={ocupado} onClick={cerrar}>
                Cancelar
              </button>
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
      </div>
    </div>
  );
}

function CompositorNuevo({
  paraInicial,
  remitentes,
  cerrar,
  enviado,
}: {
  paraInicial: string;
  remitentes: string[];
  cerrar: () => void;
  enviado: (threadId: Id<"mailThreads">) => void;
}) {
  const enviar = useMutation(api.correo.enviar);
  const [para, setPara] = useState(paraInicial);
  const [remitente, setRemitente] = useState(remitentes[0] ?? REMITENTE_PREDETERMINADO);
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
        remitente,
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
              <p className="cejilla">Correo compartido de Alpha</p>
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
              <label htmlFor="nuevo-remitente">Desde</label>
              <select
                id="nuevo-remitente"
                className="entrada"
                value={remitente}
                onChange={(event) => setRemitente(event.target.value)}
              >
                {remitentes.map((correo) => (
                  <option key={correo} value={correo}>
                    {correo}
                  </option>
                ))}
              </select>
            </div>
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

function ConfirmarEliminacion({
  asunto,
  ocupado,
  cancelar,
  confirmar,
}: {
  asunto: string;
  ocupado: boolean;
  cancelar: () => void;
  confirmar: () => void;
}) {
  return (
    <div className="correo-dialogo-fondo" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eliminar-correo-titulo"
        aria-describedby="eliminar-correo-descripcion"
        className="correo-dialogo"
      >
        <p className="cejilla">Accion permanente</p>
        <h3 id="eliminar-correo-titulo" className="mt-3 text-[1.65rem] font-semibold tracking-[-.045em]">
          Eliminar conversacion
        </h3>
        <p id="eliminar-correo-descripcion" className="mt-4 text-[12.5px] font-light leading-[1.75] text-[var(--color-cuerpo)]">
          Se borraran el hilo &quot;{asunto}&quot;, sus mensajes y todos los archivos adjuntos guardados.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="boton boton-linea" disabled={ocupado} onClick={cancelar}>
            Cancelar
          </button>
          <button type="button" className="boton boton-peligro" disabled={ocupado} onClick={confirmar}>
            {ocupado ? "Eliminando…" : "Eliminar"}
          </button>
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

function IconoVolver() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[17px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 5-5 5 5 5M3.5 10H17" />
    </svg>
  );
}

function IconoUsuario() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[15px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 9a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 10 9ZM4.5 16.5c.4-3.1 2.15-4.75 5.5-4.75s5.1 1.65 5.5 4.75" />
    </svg>
  );
}

function IconoPapelera() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[17px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6h11M8 3.5h4M6 6l.6 10.5h6.8L14 6M8.25 9v4.5M11.75 9v4.5" />
    </svg>
  );
}

function IconoResponder() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[16px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8.25 5-5 5 5 5M3.5 10h7.25c3.25 0 5.25 1.5 5.75 4.5" />
    </svg>
  );
}
