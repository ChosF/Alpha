"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Cargando, Encabezado, Tarjeta, Vacio } from "@/components/panel/ui/primitivas";
import { TraficoWeb, Barras, Estadistica } from "@/components/panel/analytics/trafico-web";
import "./analytics.css";

const CONTENIDO: Record<string, string> = { excelente: "Excelente", bueno: "Bueno", regular: "Regular", malo: "Malo" };
const ORIGEN: Record<string, string> = { instagram: "Instagram", whatsapp: "WhatsApp", correo: "Correo" };
const FECHA = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

export default function Analytics() {
  const [vista, setVista] = useState("Resumen");
  return <div className="an-page">
    <Encabezado titulo="Analytics" descripcion="Tráfico web y resultados de tus eventos." />
    <nav className="an-tabs" aria-label="Secciones de Analytics">
      {["Resumen", "Tráfico web", "Encuestas"].map(tab => <button type="button" key={tab} aria-current={vista === tab ? "page" : undefined} onClick={() => setVista(tab)}>{tab}</button>)}
    </nav>
    <div hidden={vista === "Encuestas"}><TraficoWeb detalle={vista === "Tráfico web"} /></div>
    <div hidden={vista === "Tráfico web"}><Encuestas /></div>
  </div>;
}

function Encuestas() {
  const datos = useQuery(api.encuestas.analytics, {});
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const actual = datos?.find(evento => evento.eventId === seleccion) ?? datos?.[0];
  return <section className="an-surveys" aria-labelledby="encuestas-titulo">
    <div className="an-section-heading"><div><h2 id="encuestas-titulo">Encuestas de eventos</h2><p>Resultados acumulados del evento seleccionado.</p></div>
      {actual && datos ? <select aria-label="Evento de la encuesta" value={actual.eventId} onChange={e => setSeleccion(e.target.value)}>{datos.map(evento => <option key={evento.eventId} value={evento.eventId}>{evento.titulo}</option>)}</select> : null}
    </div>
    {datos === undefined ? <Tarjeta><Cargando que="las encuestas" /></Tarjeta> : !actual ? <Tarjeta><Vacio titulo="Todavía no hay encuestas enviadas" ayuda="Abre un evento y usa Mandar correos → Encuesta de satisfacción. Los resultados aparecerán aquí." /></Tarjeta> : <div className="an-card an-survey-body">
      <p className="an-note">{actual.respuestas} respuestas de {actual.enviadas} invitaciones enviadas{actual.respuestas > 0 && actual.respuestas < 30 ? " · Muestra pequeña" : ""}</p>
      <div className="an-stats an-stats-three">
        <Estadistica titulo="Calificación promedio" valor={actual.promedio === undefined ? "—" : `${actual.promedio.toFixed(1)} / 5`} />
        <Estadistica titulo="Tasa de respuesta" valor={`${actual.tasaRespuesta}%`} />
        <Estadistica titulo="Campañas" valor={String(actual.campanas)} />
      </div>
      <div className="an-survey-grid">
        <section><h3>Calificación del evento</h3><Barras filas={[...actual.calificaciones].reverse().map(fila => ({ ...fila, clave: `${fila.clave} ${fila.clave === "1" ? "estrella" : "estrellas"}` }))} total={actual.respuestas} /></section>
        <section><h3>Contenido</h3><Barras filas={actual.contenido.map(fila => ({ ...fila, clave: CONTENIDO[fila.clave] ?? fila.clave }))} total={actual.respuestas} /></section>
        <section><h3>Cómo llegaron</h3><Barras filas={actual.origen.map(fila => ({ ...fila, clave: ORIGEN[fila.clave] ?? fila.clave }))} total={actual.respuestas} /></section>
      </div>
      <section className="an-comments"><h3>Comentarios <span>{actual.comentarios.length}</span></h3><p className="an-note">Respuestas abiertas, sin nombres ni correos.</p>
        {actual.comentarios.length === 0 ? <p className="an-note">Todavía no hay comentarios para este evento.</p> : <div className="analytics-comentarios">{actual.comentarios.map((comentario, i) => <article key={`${comentario.respondidoEn}-${i}`}><div><span aria-label={`${comentario.calificacionEvento} de 5 estrellas`}>{"★".repeat(comentario.calificacionEvento)}<i>{"★".repeat(5 - comentario.calificacionEvento)}</i></span><time dateTime={new Date(comentario.respondidoEn).toISOString()}>{FECHA.format(comentario.respondidoEn)}</time></div><p>{comentario.texto}</p></article>)}</div>}
      </section>
      {actual.ultimoEnvioEn ? <p className="an-note an-last">Último envío: {FECHA.format(actual.ultimoEnvioEn)}</p> : null}
    </div>}
  </section>;
}
