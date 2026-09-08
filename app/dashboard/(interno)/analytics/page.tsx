"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Cargando, Encabezado, Tarjeta, Vacio } from "@/components/panel/ui/primitivas";
import { TraficoWeb, Barras, Estadistica } from "@/components/panel/analytics/trafico-web";
import "./analytics.css";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";
import { ExportarAnalytics, type TablaExportacion } from "@/components/panel/analytics/exportar";

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
    <div hidden={vista === "Tráfico web"}><Encuestas detalle={vista === "Encuestas"} /></div>
  </div>;
}

function Encuestas({ detalle }: { detalle: boolean }) {
  const datos = useQuery(api.encuestas.analytics, {});
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const actual = datos?.find(evento => evento.eventId === seleccion) ?? datos?.[0];
  const tabla: TablaExportacion | null = actual ? {
    nombre: `alpha-encuestas-${actual.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 70)}-${new Date().toISOString().slice(0, 10)}`,
    encabezados: ["Evento", "Sección", "Indicador", "Valor", "Unidad / detalle"],
    filas: [
      [actual.titulo, "Resumen", "Exportado en UTC", new Date().toISOString(), "Resultados acumulados del evento"],
      [actual.titulo, "Resumen", "Invitaciones enviadas", actual.enviadas, "Invitaciones"],
      [actual.titulo, "Resumen", "Respuestas", actual.respuestas, "Formularios completos"],
      [actual.titulo, "Resumen", "Calificación promedio", actual.promedio ?? null, "De 5 estrellas"],
      [actual.titulo, "Resumen", "Tasa de respuesta", actual.tasaRespuesta, "%"],
      [actual.titulo, "Resumen", "Campañas", actual.campanas, "Campañas"],
      [actual.titulo, "Resumen", "Último envío UTC", actual.ultimoEnvioEn ? new Date(actual.ultimoEnvioEn).toISOString() : "", ""],
      ...actual.calificaciones.map(f => [actual.titulo, "Calificación", `${f.clave} estrellas`, f.cantidad, "Respuestas"]),
      ...actual.contenido.map(f => [actual.titulo, "Contenido", CONTENIDO[f.clave] ?? f.clave, f.cantidad, "Respuestas"]),
      ...actual.origen.map(f => [actual.titulo, "Cómo llegaron", ORIGEN[f.clave] ?? f.clave, f.cantidad, "Respuestas"]),
      [actual.titulo, "Comentarios", "Alcance", "Hasta 50 comentarios más recientes", "Sin nombres ni correos"],
      ...actual.comentarios.map(c => [actual.titulo, "Comentarios", new Date(c.respondidoEn).toISOString(), c.texto, `${c.calificacionEvento} de 5 estrellas`]),
    ],
  } : null;
  return <section className="an-surveys" aria-labelledby="encuestas-titulo">
    <div className="an-section-heading"><div><h2 id="encuestas-titulo">Encuestas de eventos</h2><p>Resultados acumulados del evento seleccionado.</p></div>
      <div className="an-controls">
        {actual && datos ? <SelectorPersonalizado id="analytics-evento" ariaLabel="Evento de la encuesta" variante="compacto" valor={actual.eventId} alCambiar={setSeleccion} opciones={datos.map(evento => ({ valor: evento.eventId, etiqueta: evento.titulo }))} /> : null}
        {detalle ? <ExportarAnalytics tabla={tabla} /> : null}
      </div>
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
