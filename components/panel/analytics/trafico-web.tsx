"use client";

import { useEffect, useState } from "react";
import { useAction, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { FilaWeb, InformeWeb } from "@/convex/lib/analiticaWeb";
import { Cargando } from "../ui/primitivas";
import { SelectorPersonalizado } from "../selector-personalizado";
import { ExportarAnalytics, type TablaExportacion } from "./exportar";

const NUMERO = new Intl.NumberFormat("es-MX");
const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const DISPOSITIVOS: Record<string, string> = { mobile: "Móvil", desktop: "Escritorio", tablet: "Tablet", Others: "Otros" };
const PAISES = new Intl.DisplayNames(["es"], { type: "region" });
type Estado = { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "sin_configurar" } | { tipo: "listo"; informe: InformeWeb };

export function TraficoWeb({ detalle }: { detalle: boolean }) {
  const obtener = useAction(api.analiticaWeb.obtener);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [dias, setDias] = useState<7 | 14 | 30>(30);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let vigente = true;
    obtener({ dias }).then(resultado => {
      if (vigente) setEstado(resultado.estado === "disponible" ? { tipo: "listo", informe: resultado.informe } : { tipo: "sin_configurar" });
    }).catch(error => {
      if (vigente) setEstado({ tipo: "error", mensaje: error instanceof ConvexError && typeof error.data === "string" ? error.data : "No pudimos cargar el tráfico web. Intenta de nuevo." });
    });
    return () => { vigente = false; };
  }, [dias, intento, obtener, isAuthenticated, isLoading]);
  function recargar() { setEstado({ tipo: "cargando" }); setIntento(i => i + 1); }
  const informe = estado.tipo === "listo" ? estado.informe : null;
  const tabla: TablaExportacion | null = informe ? {
    nombre: `alpha-trafico-${informe.desde}-${new Date(Date.parse(informe.hasta) - 86_400_000).toISOString().slice(0, 10)}`,
    encabezados: ["Desde UTC", "Hasta UTC (exclusivo)", "Sección", "Indicador", "Valor", "Unidad / detalle"],
    filas: [
      [informe.desde, informe.hasta, "Resumen", "Actualizado en UTC", new Date(informe.actualizadoEn).toISOString(), "Vercel Analytics · Producción"],
      [informe.desde, informe.hasta, "Resumen", "Visitantes", informe.visitantes, "Visitantes del periodo"],
      [informe.desde, informe.hasta, "Resumen", "Vistas de página", informe.vistas, "Vistas"],
      [informe.desde, informe.hasta, "Resumen", "Páginas por visitante", informe.visitantes ? informe.vistas / informe.visitantes : null, "Vistas / visitantes"],
      ...([
        ["Por día", informe.diario], ["Páginas", informe.paginas], ["Fuentes", informe.fuentes],
        ["Dispositivos", informe.dispositivos], ["Países", informe.paises], ["Navegadores", informe.navegadores],
      ] as [string, FilaWeb[]][]).flatMap(([seccion, filas]) => filas.map(f => [informe.desde, informe.hasta, seccion, f.clave, f.cantidad, "Vistas de página"])),
      [informe.desde, informe.hasta, "Metodología", "Desgloses", "Cinco grupos principales y Otros", "Mismos datos del dashboard; días completos UTC"],
    ],
  } : null;
  return <section className="an-traffic" aria-labelledby="trafico-titulo">
    <div className="an-section-heading"><div className="an-section-title"><h2 id="trafico-titulo">Tráfico web</h2><span>Vercel Analytics</span></div>
      <div className="an-controls">
        <div className="an-period"><span>Periodo de tráfico</span><SelectorPersonalizado id="analytics-periodo" ariaLabel="Periodo de tráfico" variante="compacto" valor={String(dias)} alCambiar={valor => { if (Number(valor) === dias) return; setEstado({ tipo: "cargando" }); setDias(Number(valor) as 7 | 14 | 30); }} opciones={[7, 14, 30].map(dias => ({ valor: String(dias), etiqueta: `Últimos ${dias} días` }))} /></div>
        {detalle ? <ExportarAnalytics tabla={tabla} /> : null}
      </div>
    </div>
    {estado.tipo === "cargando" ? <div className="an-card an-loading" role="status"><Cargando que="el tráfico web" /></div> : estado.tipo === "sin_configurar" || estado.tipo === "error" ? <div className="an-card an-message" role="status"><h3>{estado.tipo === "sin_configurar" ? "Conecta las estadísticas de tu sitio" : "No se pudo cargar el tráfico"}</h3><p>{estado.tipo === "sin_configurar" ? "La conexión con Vercel está pendiente de configuración. Las encuestas siguen disponibles." : estado.mensaje}</p><button type="button" onClick={recargar}>Volver a intentar</button></div> : null}
    {informe ? <>
      <div className="an-card an-stats">
        <Estadistica titulo="Visitantes" valor={NUMERO.format(informe.visitantes)} />
        <Estadistica titulo="Vistas de página" valor={NUMERO.format(informe.vistas)} />
        <Estadistica titulo="Páginas por visitante" valor={informe.visitantes ? (informe.vistas / informe.visitantes).toFixed(1) : "—"} />
        <Estadistica titulo="Principal fuente" valor={informe.fuentes[0]?.clave ?? "—"} />
      </div>
      {informe.vistas === 0 ? <div className="an-card an-message"><h3>Sin visitas en este periodo</h3><p>Prueba otro periodo. Aquí aparecerán las visitas registradas en el sitio público.</p></div> : null}
      <div className="an-main-grid">
        <section className="an-card an-chart"><h3>Vistas de página a lo largo del tiempo</h3><p className="an-note">Días completos · UTC</p><Grafica filas={informe.diario} /></section>
        <section className="an-card an-panel"><h3>Páginas más visitadas</h3><Barras filas={informe.paginas} total={informe.vistas} /></section>
      </div>
      <div className="an-secondary-grid">
        <section className="an-card an-panel"><h3>De dónde llegan</h3><p className="an-note">Porcentaje de vistas de página</p><Barras filas={informe.fuentes} total={informe.vistas} porcentaje /></section>
        <section className="an-card an-panel"><h3>Dispositivos</h3><p className="an-note">Porcentaje de vistas de página</p><div className="an-device-track" aria-hidden="true">{informe.dispositivos.map((fila, i) => <span key={fila.clave} data-color={i % 4} style={{ flexGrow: fila.cantidad }} />)}</div><Barras filas={informe.dispositivos.map(fila => ({ ...fila, clave: DISPOSITIVOS[fila.clave] ?? fila.clave }))} total={informe.vistas} porcentaje /></section>
        {detalle ? <><section className="an-card an-panel"><h3>Países</h3><Barras filas={informe.paises.map(fila => ({ ...fila, clave: /^[A-Z]{2}$/.test(fila.clave) ? PAISES.of(fila.clave) ?? fila.clave : fila.clave === "Others" ? "Otros" : fila.clave }))} total={informe.vistas} porcentaje /></section><section className="an-card an-panel"><h3>Navegadores</h3><Barras filas={informe.navegadores} total={informe.vistas} porcentaje /></section></> : null}
      </div>
      <div className="an-footer"><p>{FECHA.format(new Date(informe.desde))} – {FECHA.format(new Date(Date.parse(informe.hasta) - 86_400_000))} · Actualizado {new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(informe.actualizadoEn)} · Hora CDMX</p><button type="button" onClick={recargar}>Actualizar</button></div>
    </> : null}
  </section>;
}

export function Estadistica({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="an-stat"><span>{titulo}</span><strong title={valor}>{valor}</strong></div>;
}

export function Barras({ filas, total, porcentaje = false }: { filas: FilaWeb[]; total: number; porcentaje?: boolean }) {
  if (!filas.length) return <p className="an-note an-empty">Sin datos para este periodo.</p>;
  return <ul className="an-bars">{filas.map(fila => {
    const valor = total ? Math.min(100, fila.cantidad / total * 100) : 0;
    return <li key={fila.clave}><div><span title={fila.clave}>{fila.clave === "Others" ? "Otros" : fila.clave}</span><strong>{porcentaje ? `${valor.toFixed(1)}%` : NUMERO.format(fila.cantidad)}</strong></div><div className="an-bar" aria-hidden="true"><i style={{ width: `${valor}%` }} /></div></li>;
  })}</ul>;
}

function Grafica({ filas }: { filas: FilaWeb[] }) {
  const maximo = Math.max(1, ...filas.map(fila => fila.cantidad));
  const techo = Math.ceil(maximo / 4) * 4;
  const puntos = filas.map((fila, i) => ({ ...fila, x: 45 + i / Math.max(1, filas.length - 1) * 635, y: 190 - fila.cantidad / techo * 170 }));
  const linea = puntos.map(p => `${p.x},${p.y}`).join(" ");
  return <><svg className="an-chart-svg" viewBox="0 0 700 230" role="img" aria-label="Vistas de página por día. Consulta la tabla de datos debajo de la gráfica.">
    {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="45" x2="680" y1={190 - i * 42.5} y2={190 - i * 42.5} className="an-gridline" /><text x="35" y={194 - i * 42.5} textAnchor="end">{NUMERO.format(techo * i / 4)}</text></g>)}
    <polygon points={`45,190 ${linea} 680,190`} className="an-area" /><polyline points={linea} className="an-line" />
    {puntos.map((p, i) => <g key={p.clave}><circle cx={p.x} cy={p.y} r="3" className="an-dot"><title>{FECHA.format(new Date(p.clave))}: {NUMERO.format(p.cantidad)} vistas</title></circle>{i === 0 || i === puntos.length - 1 || i === Math.floor(puntos.length / 2) ? <text x={p.x} y="218" textAnchor={i === 0 ? "start" : i === puntos.length - 1 ? "end" : "middle"}>{FECHA.format(new Date(p.clave))}</text> : null}</g>)}
  </svg><details className="an-data"><summary>Ver datos por día</summary><table><thead><tr><th>Fecha UTC</th><th>Vistas de página</th></tr></thead><tbody>{filas.map(fila => <tr key={fila.clave}><td>{FECHA.format(new Date(fila.clave))}</td><td>{NUMERO.format(fila.cantidad)}</td></tr>)}</tbody></table></details></>;
}
