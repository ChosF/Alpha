"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  asuntoRecordatorioEvento,
  fechaEnCiudadDeMexico,
  textoRecordatorioEvento,
} from "@/lib/correo-evento";
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Entrada,
  Pildora,
  Seleccion,
} from "@/components/panel/ui/primitivas";

type TipoCorreoEvento = "recordatorio" | "encuesta" | "normal";

type EventoCorreo = {
  _id: Id<"events">;
  titulo: string;
  fechaEvento?: string;
  horaInicio?: string;
  horaFin?: string;
  sede?: string;
};

const ETIQUETA_ESTADO = {
  programado: "Programado",
  procesando: "Preparando",
  encolado: "Encolado",
  cancelado: "Cancelado",
  fallido: "Fallido",
} as const;

function limpiarError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo preparar el envío.";
  return error.message.replace(/^\[CONVEX[^\]]*\]\s*/i, "").replace(/^Uncaught\s+/i, "");
}

function partesCdmx(timestamp: number) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Mexico_City",
  }).formatToParts(new Date(timestamp));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}T${valor("hour")}:${valor("minute")}`;
}

function fechaInicial(evento: EventoCorreo): string {
  const ahora = Date.now();
  if (evento.fechaEvento) {
    const propuesta = `${evento.fechaEvento}T08:00`;
    const timestamp = Date.parse(`${propuesta}:00-06:00`);
    if (timestamp > ahora) return propuesta;
    if (fechaEnCiudadDeMexico(ahora) === evento.fechaEvento) return partesCdmx(ahora + 5 * 60_000);
  }
  return partesCdmx(ahora + 5 * 60_000);
}

function fechaLegible(timestamp: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(timestamp));
}

export function CorreoEvento({
  evento,
  tipo,
  cerrar,
}: {
  evento: EventoCorreo;
  tipo: TipoCorreoEvento;
  cerrar: () => void;
}) {
  const resumen = useQuery(api.correosEventos.resumen, { eventId: evento._id });
  const trabajos = useQuery(api.correosEventos.listar, { eventId: evento._id });
  const programar = useMutation(api.correosEventos.programar);
  const cancelar = useMutation(api.correosEventos.cancelar);
  const [momento, setMomento] = useState<"ahora" | "programado">(
    tipo === "recordatorio" ? "programado" : "ahora",
  );
  const [fechaHora, setFechaHora] = useState(() => fechaInicial(evento));
  const [fechaMinima] = useState(() => partesCdmx(Date.now()));
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const requestId = useRef<string | null>(null);

  const detalles =
    evento.fechaEvento && evento.horaInicio && evento.sede
      ? {
          titulo: evento.titulo,
          fechaEvento: evento.fechaEvento,
          horaInicio: evento.horaInicio,
          ...(evento.horaFin ? { horaFin: evento.horaFin } : {}),
          sede: evento.sede,
        }
      : null;
  const recordatorio = detalles
    ? {
        asunto: asuntoRecordatorioEvento(evento.titulo),
        texto: textoRecordatorioEvento(detalles),
      }
    : null;

  const mandar = async () => {
    setOcupado(true);
    setAviso(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const programadoPara =
        momento === "ahora" ? Date.now() : Date.parse(`${fechaHora}:00-06:00`);
      const resultado = await programar({
        eventId: evento._id,
        tipo,
        ...(tipo === "normal" ? { asunto, texto } : {}),
        programadoPara,
        clientRequestId: requestId.current,
      });
      requestId.current = null;
      setAviso({
        tono: "exito",
        texto:
          momento === "ahora"
            ? `Envío encolado para ${resultado.destinatarios} personas.`
            : `Envío programado para ${resultado.destinatarios} personas.`,
      });
    } catch (error) {
      setAviso({ tono: "error", texto: limpiarError(error) });
    } finally {
      setOcupado(false);
    }
  };

  const puedeMandar =
    resumen !== undefined &&
    resumen.correoListo &&
    !resumen.modoPrueba &&
    resumen.cantidad > 0 &&
    !resumen.limiteExcedido &&
    (tipo === "normal"
      ? Boolean(asunto.trim() && texto.trim())
      : tipo === "recordatorio"
        ? recordatorio !== null
        : true) &&
    (momento === "ahora" || Boolean(fechaHora));

  return (
    <div className="ui-modal-bg evento-correo-modal" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="correo-evento-titulo" className="ui-dialog ui-dialog-lg evento-correo-dialog">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">{evento.titulo}</p>
            <h2 id="correo-evento-titulo" className="ui-h2 mt-1">
              {tipo === "recordatorio"
                ? "Recordatorio del evento"
                : tipo === "encuesta"
                  ? "Encuesta de satisfacción"
                  : "Correo para asistentes"}
            </h2>
          </div>
          <Boton
            tamano="sm"
            variante="fantasma"
            soloIcono
            icono="cerrar"
            etiqueta="Cerrar"
            disabled={ocupado}
            onClick={cerrar}
          />
        </div>

        <div className="grid gap-4">
          <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--bg-3)] p-4">
            <p className="text-[13px] font-medium">
              {resumen === undefined
                ? "Contando destinatarios\u2026"
                : `${resumen.cantidad} asistentes recibirán un correo individual`}
            </p>
            <p className="ui-help mt-1">
              Incluye registros activos, confirmados o con asistencia que autorizaron contacto por correo. Excluye lista de espera y cancelados.
            </p>
          </div>

          {resumen && (!resumen.correoListo || resumen.modoPrueba) ? (
            <Aviso tono="error">
              {!resumen.correoListo
                ? "Falta configurar Resend en Convex."
                : "Resend sigue en modo de prueba y no puede escribir a los asistentes."}
            </Aviso>
          ) : null}

          {tipo === "recordatorio" ? (
            recordatorio ? (
              <div className="rounded-[var(--r)] border border-[var(--line)] p-4">
                <p className="ui-label">Mensaje preestablecido</p>
                <p className="mt-2 text-[14px] font-semibold">{recordatorio.asunto}</p>
                <p className="ui-faint mt-3 whitespace-pre-wrap text-[13px] leading-6">{recordatorio.texto}</p>
              </div>
            ) : (
              <Aviso tono="error">
                Completa la fecha, la hora y la sede con la opción Editar antes de preparar este recordatorio.
              </Aviso>
            )
          ) : tipo === "encuesta" ? (
            <div className="rounded-[var(--r)] border border-[var(--line)] p-4">
              <p className="ui-label">Encuesta preestablecida</p>
              <p className="mt-2 text-[14px] font-semibold">Cuéntanos qué te pareció {evento.titulo}</p>
              <p className="ui-faint mt-3 text-[13px] leading-6">
                Cada asistente recibe un enlace personal. Abrirlo o recargarlo no lo consume;
                queda cerrado después de enviar una respuesta.
              </p>
            </div>
          ) : (
            <>
              <Campo etiqueta="Asunto" htmlFor="correo-evento-asunto">
                <Entrada
                  id="correo-evento-asunto"
                  value={asunto}
                  maxLength={180}
                  onChange={(event) => setAsunto(event.target.value)}
                  placeholder="Asunto del mensaje"
                  autoFocus
                />
              </Campo>
              <Campo etiqueta="Mensaje" htmlFor="correo-evento-texto">
                <AreaTexto
                  id="correo-evento-texto"
                  value={texto}
                  maxLength={20_000}
                  rows={8}
                  onChange={(event) => setTexto(event.target.value)}
                  placeholder="Escribe el mensaje para los asistentes."
                />
              </Campo>
            </>
          )}

          <Campo etiqueta="Entrega" htmlFor="correo-evento-momento">
            <Seleccion
              id="correo-evento-momento"
              value={momento}
              onChange={(event) => setMomento(event.target.value as "ahora" | "programado")}
            >
              <option value="ahora">Enviar ahora</option>
              <option value="programado">Programar fecha y hora</option>
            </Seleccion>
          </Campo>
          {momento === "programado" ? (
            <Campo
              etiqueta="Fecha y hora de envío"
              htmlFor="correo-evento-fecha"
              ayuda={
                tipo === "recordatorio"
                  ? "Debe ser el mismo día del evento. Zona horaria: Ciudad de México."
                  : "Zona horaria: Ciudad de México."
              }
            >
              <Entrada
                id="correo-evento-fecha"
                type="datetime-local"
                value={fechaHora}
                min={fechaMinima}
                onChange={(event) => setFechaHora(event.target.value)}
              />
            </Campo>
          ) : null}

          {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Boton disabled={ocupado} onClick={cerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono={momento === "ahora" ? "enviar" : "reloj"}
            disabled={ocupado || !puedeMandar}
            onClick={() => void mandar()}
          >
            {ocupado ? "Preparando\u2026" : momento === "ahora" ? "Enviar ahora" : "Programar envío"}
          </Boton>
        </div>

        {trabajos?.length ? (
          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <h3 className="ui-label">Envíos recientes</h3>
            <div className="mt-3 grid gap-2">
              {trabajos.map((trabajo) => (
                <div
                  key={trabajo._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r)] border border-[var(--line)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{trabajo.asunto}</p>
                    <p className="ui-faint mt-0.5 text-[11px]">
                      {fechaLegible(trabajo.programadoPara)} · {trabajo.destinatariosEstimados} destinatarios
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pildora
                      tono={
                        trabajo.estado === "encolado"
                          ? "ok"
                          : trabajo.estado === "fallido"
                            ? "bad"
                            : "neutro"
                      }
                      sm
                    >
                      {ETIQUETA_ESTADO[trabajo.estado]}
                    </Pildora>
                    {trabajo.estado === "programado" ? (
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        onClick={() => void cancelar({ id: trabajo._id }).catch((error) => setAviso({ tono: "error", texto: limpiarError(error) }))}
                      >
                        Cancelar
                      </Boton>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
