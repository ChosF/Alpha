"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Icono } from "@/components/panel/ui/iconos";
import {
  Cargando,
  Encabezado,
  Pildora,
  Tarjeta,
  TarjetaCabecera,
  Vacio,
} from "@/components/panel/ui/primitivas";

const ETIQUETAS_CONTENIDO: Record<string, string> = {
  excelente: "Excelente",
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
};

const ETIQUETAS_ORIGEN: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  correo: "Correo",
};

const FECHA = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export default function Analytics() {
  const datos = useQuery(api.encuestas.analytics, {});
  const [seleccion, setSeleccion] = useState<string | null>(null);

  if (datos === undefined) {
    return (
      <>
        <Encabezado titulo="Analytics" descripcion="Resultados de las encuestas enviadas después de cada evento." />
        <Tarjeta><Cargando que="las encuestas" /></Tarjeta>
      </>
    );
  }

  const actual = datos.find((evento) => evento.eventId === seleccion) ?? datos[0];
  return (
    <>
      <Encabezado titulo="Analytics" descripcion="Resultados de las encuestas enviadas después de cada evento." />
      {datos.length === 0 || !actual ? (
        <Tarjeta>
          <Vacio
            titulo="Todavía no hay encuestas enviadas"
            ayuda="Abre un evento y usa Mandar correos → Encuesta de satisfacción. Los resultados aparecerán aquí."
          />
        </Tarjeta>
      ) : (
        <>
          <div className="analytics-eventos" role="list" aria-label="Eventos con encuesta">
            {datos.map((evento) => (
              <button
                key={evento.eventId}
                type="button"
                role="listitem"
                className="analytics-evento"
                data-active={evento.eventId === actual.eventId}
                onClick={() => setSeleccion(evento.eventId)}
              >
                <span>{evento.titulo}</span>
                <small>{evento.respuestas} respuestas</small>
              </button>
            ))}
          </div>

          <div className="ui-grid mt-5">
            <Tarjeta className="ui-stat lg-3" indice={1}>
              <span className="ui-stat-label">Calificación promedio</span>
              <span className="ui-stat-value">{actual.promedio?.toFixed(1) ?? "—"}</span>
              <span className="ui-stat-delta">de 5 estrellas</span>
            </Tarjeta>
            <Tarjeta className="ui-stat lg-3" indice={2}>
              <span className="ui-stat-label">Tasa de respuesta</span>
              <span className="ui-stat-value">{actual.tasaRespuesta}%</span>
              <span className="ui-stat-delta">{actual.respuestas} de {actual.enviadas} enviadas</span>
            </Tarjeta>
            <Tarjeta className="ui-stat lg-3" indice={3}>
              <span className="ui-stat-label">Respuestas</span>
              <span className="ui-stat-value">{actual.respuestas}</span>
              <span className="ui-stat-delta">formularios completos</span>
            </Tarjeta>
            <Tarjeta className="ui-stat lg-3" indice={4}>
              <span className="ui-stat-label">Campañas</span>
              <span className="ui-stat-value">{actual.campanas}</span>
              <span className="ui-stat-delta">
                {actual.ultimoEnvioEn ? `Último envío ${FECHA.format(new Date(actual.ultimoEnvioEn))}` : "Sin envío confirmado"}
              </span>
            </Tarjeta>
          </div>

          <div className="ui-grid mt-5">
            <Tarjeta className="lg-4" indice={5}>
              <TarjetaCabecera titulo="Calificación del evento" descripcion="Distribución de 1 a 5 estrellas." />
              <Desglose
                datos={[...actual.calificaciones].reverse()}
                etiqueta={(clave) => `${clave} ${clave === "1" ? "estrella" : "estrellas"}`}
                total={actual.respuestas}
              />
            </Tarjeta>
            <Tarjeta className="lg-4" indice={6}>
              <TarjetaCabecera titulo="Contenido" descripcion="Qué tan bien funcionó la sesión." />
              <Desglose
                datos={actual.contenido}
                etiqueta={(clave) => ETIQUETAS_CONTENIDO[clave] ?? clave}
                total={actual.respuestas}
              />
            </Tarjeta>
            <Tarjeta className="lg-4" indice={7}>
              <TarjetaCabecera titulo="Cómo llegaron" descripcion="Canal que dio a conocer el evento." />
              <Desglose
                datos={actual.origen}
                etiqueta={(clave) => ETIQUETAS_ORIGEN[clave] ?? clave}
                total={actual.respuestas}
              />
            </Tarjeta>
          </div>

          <Tarjeta className="mt-5" indice={8}>
            <TarjetaCabecera
              titulo="Comentarios"
              descripcion="Respuestas abiertas, sin nombres ni correos."
              acciones={<Pildora tono="neutro" sm>{actual.comentarios.length}</Pildora>}
            />
            {actual.comentarios.length === 0 ? (
              <p className="ui-faint px-5 py-8 text-[12.5px]">Todavía no hay comentarios para este evento.</p>
            ) : (
              <div className="analytics-comentarios">
                {actual.comentarios.map((comentario, indice) => (
                  <article key={`${comentario.respondidoEn}-${indice}`}>
                    <div>
                      <span aria-label={`${comentario.calificacionEvento} de 5 estrellas`}>
                        {"★".repeat(comentario.calificacionEvento)}
                        <i>{"★".repeat(5 - comentario.calificacionEvento)}</i>
                      </span>
                      <time>{FECHA.format(new Date(comentario.respondidoEn))}</time>
                    </div>
                    <p>{comentario.texto}</p>
                  </article>
                ))}
              </div>
            )}
          </Tarjeta>

          <p className="analytics-proximamente">
            <Icono nombre="tendencia" tamano={14} />
            La analítica web se integrará en esta misma sección más adelante.
          </p>
        </>
      )}
    </>
  );
}

function Desglose({
  datos,
  etiqueta,
  total,
}: {
  datos: { clave: string; cantidad: number }[];
  etiqueta: (clave: string) => string;
  total: number;
}) {
  return (
    <div className="analytics-desglose">
      {datos.map((dato) => {
        const porcentaje = total ? Math.round((dato.cantidad / total) * 100) : 0;
        return (
          <div key={dato.clave} className="analytics-fila">
            <div>
              <span>{etiqueta(dato.clave)}</span>
              <strong>{dato.cantidad}</strong>
            </div>
            <div className="ui-bar" aria-label={`${porcentaje}%`}>
              <i style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
