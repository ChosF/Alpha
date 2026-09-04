"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { useCascaron } from "@/components/panel/ui/cascaron";
import { Icono } from "@/components/panel/ui/iconos";
import {
  Avatar,
  Cargando,
  Encabezado,
  Pildora,
  TONO_ESTADO,
  Tarjeta,
  TarjetaCabecera,
  Vacio,
  iniciales,
  relativo,
} from "@/components/panel/ui/primitivas";

/**
 * Inicio: los eventos primero, y una lista corta de lo que pide una accion.
 *
 * Tres cifras, una cuadricula de eventos y dos columnas de apoyo. Nada aqui
 * compite con el trabajo real, que sucede en Eventos.
 */
export default function Inicio() {
  const { yo, graficasInicio } = useCascaron();
  const datos = useQuery(api.metricas.inicio, {});

  if (datos === undefined) {
    return (
      <>
        <Encabezado titulo="Inicio" descripcion="Los eventos primero, y lo que pide una decisión." />
        <Tarjeta>
          <Cargando que="el resumen" />
        </Tarjeta>
      </>
    );
  }

  const { resumen } = datos;
  const pendientes = construirPendientes(datos);

  return (
    <>
      <Encabezado
        titulo={saludo(yo?.nombre || yo?.correo)}
        descripcion="Los eventos primero, y lo que pide una decisión."
      />

      <div className="ui-grid">
        <Tarjeta className="ui-stat lg-4" indice={1}>
          <span className="ui-stat-label">Eventos con registro abierto</span>
          <span className="ui-stat-value">{resumen.eventosActivos}</span>
          <span className="ui-stat-delta">
            {resumen.eventosBorrador > 0
              ? `${resumen.eventosBorrador} en borrador`
              : "Sin borradores pendientes"}
          </span>
        </Tarjeta>
        <Tarjeta className="ui-stat lg-4" indice={2}>
          <span className="ui-stat-label">Asistentes registrados</span>
          <span className="ui-stat-value">{resumen.asistentes}</span>
          <span className="ui-stat-delta">Suma de todos los eventos</span>
        </Tarjeta>
        <Tarjeta className="ui-stat lg-4" indice={3}>
          <span className="ui-stat-label">Correos sin leer</span>
          <span className="ui-stat-value">{datos.correo?.noLeidos ?? "—"}</span>
          <span className="ui-stat-delta">
            {datos.correo
              ? `${datos.correo.abiertos} ${datos.correo.abiertos === 1 ? "hilo abierto" : "hilos abiertos"}`
              : "Disponible para editores"}
          </span>
        </Tarjeta>
      </div>

      <div className="ui-grid mt-6">
        <aside className="lg-4 grid content-start">
          <Tarjeta className="min-h-[154px]" indice={4}>
            <TarjetaCabecera titulo="Pendientes" descripcion="Requieren una decisión o acción." />
            {pendientes.length === 0 ? (
              <p className="ui-faint px-5 py-6 text-[12.5px]">Nada urgente. Todo al día.</p>
            ) : (
              <div>
                {pendientes.map((p) => (
                  <Link key={p.texto} href={p.href} className="ui-todo">
                    <i className="ui-dot" data-tone={p.tono} />
                    <div className="min-w-0">
                      <strong>{p.texto}</strong>
                      <span>{p.detalle}</span>
                    </div>
                    <Icono nombre="chevronDerecha" tamano={14} />
                  </Link>
                ))}
              </div>
            )}
          </Tarjeta>
        </aside>

        <section className="lg-8">
          {datos.eventos.length === 0 ? (
            <Tarjeta indice={4}>
              <Vacio
                titulo="Todavía no hay eventos"
                ayuda="Crea el primero desde Eventos. Aquí aparecerán los que tengan registro abierto y los borradores."
              />
            </Tarjeta>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {datos.eventos.slice(0, 6).map((e, i) => (
                <Link
                  key={e._id}
                  href={{ pathname: "/dashboard/eventos", query: { evento: e._id } }}
                  className="ui-card ui-card-link ui-proj ui-in"
                  data-i={Math.min(5 + i, 8)}
                  aria-label={`Abrir ${e.titulo}`}
                >
                  <span className="ui-proj-head">
                    <Avatar texto={iniciales(e.titulo)} />
                    <span className="ui-proj-text">
                      <strong>{e.titulo}</strong>
                      <span>alphaccm.org/eventos/{e.slug}</span>
                    </span>
                    <span className="ui-proj-side">
                      {e.confirmados}/{e.totalRegistros}
                    </span>
                  </span>
                  <p className="ui-proj-note">
                    <Icono nombre="commit" tamano={14} />
                    <span>{e.resumen || ETIQUETAS[e.pilar] || "Sin resumen"}</span>
                  </p>
                  <div className="ui-proj-foot">
                    <span className="ui-proj-who">
                      <Icono nombre="reloj" tamano={13} />
                      <span>{relativo(e.actualizadoEn)}</span>
                    </span>
                    <span className="ui-proj-meta">
                      <Pildora tono={TONO_ESTADO[e.estado] ?? "neutro"} sm>
                        {e.registroAbierto && e.estado === "publicado"
                          ? "Registro abierto"
                          : ETIQUETAS[e.estado] ?? e.estado}
                      </Pildora>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Analitica analitica={datos.analitica} visibles={graficasInicio} />
    </>
  );
}

type Datos = FunctionReturnType<typeof api.metricas.inicio>;

function construirPendientes(d: Datos) {
  const lista: { texto: string; detalle: string; href: string; tono: "accent" | "warn" | "bad" | "neutro" }[] = [];
  const borradores = d.eventos.filter((e) => e.estado === "borrador");
  if (borradores.length > 0) {
    lista.push({
      texto: `${borradores.length} ${borradores.length === 1 ? "evento en borrador" : "eventos en borrador"}`,
      detalle: borradores.map((e) => e.titulo).slice(0, 2).join(", ") + (borradores.length > 2 ? "…" : ""),
      href: "/dashboard/eventos",
      tono: "neutro",
    });
  }
  if (d.correo && d.correo.noLeidos > 0) {
    lista.push({
      texto: `${d.correo.noLeidos} ${d.correo.noLeidos === 1 ? "correo sin leer" : "correos sin leer"}`,
      detalle: `${d.correo.abiertos} ${d.correo.abiertos === 1 ? "hilo abierto" : "hilos abiertos"}`,
      href: "/dashboard/correo",
      tono: "accent",
    });
  }
  if (d.invitacionesPorVencer !== null && d.invitacionesPorVencer > 0) {
    lista.push({
      texto: `${d.invitacionesPorVencer} ${d.invitacionesPorVencer === 1 ? "invitación expira" : "invitaciones expiran"} pronto`,
      detalle: "Vencen en menos de 3 días",
      href: "/dashboard/ajustes?seccion=usuarios",
      tono: "warn",
    });
  }
  if (d.registrosNuevos > 0) {
    lista.push({
      texto: `${d.registrosNuevos} ${d.registrosNuevos === 1 ? "registro nuevo" : "registros nuevos"} sin contactar`,
      detalle: "Convocatoria general",
      href: "/dashboard/registros",
      tono: "neutro",
    });
  }
  return lista;
}

function saludo(nombre: string | undefined): string {
  const h = new Date().getHours();
  const momento = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  if (!nombre) return momento;
  const corto = nombre.includes("@") ? nombre.split("@")[0] ?? nombre : nombre.split(/\s+/)[0] ?? nombre;
  return `${momento}, ${corto}`;
}

type AnaliticaInicio = Datos["analitica"];
type GraficaInicio = "tendencia" | "estados" | "tipos" | "areas";

const FORMATO_SEMANA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

function Analitica({
  analitica,
  visibles,
}: {
  analitica: AnaliticaInicio;
  visibles: GraficaInicio[];
}) {
  return (
    <section className="mt-7">
      <div className="ui-sec-h">
        <div>
          <h2>Análisis de registros</h2>
          <p className="ui-faint mt-1 text-[12px]">Tendencia, composición y preferencias de la convocatoria.</p>
        </div>
        <Link href="/dashboard/ajustes?seccion=apariencia">
          Personalizar <Icono nombre="ajustes" tamano={13} />
        </Link>
      </div>

      {visibles.length === 0 ? (
        <Tarjeta indice={6}>
          <Vacio
            titulo="Los gráficos están ocultos"
            ayuda="Puedes volver a mostrarlos desde Ajustes > Apariencia."
          />
        </Tarjeta>
      ) : (
        <div className="ui-grid">
          {visibles.includes("tendencia") ? (
            <Tarjeta className="ui-chart-card lg-7" indice={6}>
              <TarjetaCabecera
                titulo="Altas por semana"
                descripcion={`${analitica.nuevosEstaSemana} en los últimos 7 días`}
              />
              <GraficaTendencia datos={analitica.porSemana} />
            </Tarjeta>
          ) : null}

          {visibles.includes("estados") ? (
            <Tarjeta className="ui-chart-card lg-5" indice={7}>
              <TarjetaCabecera titulo="Estado de seguimiento" descripcion="Qué necesita atención ahora." />
              <GraficaEstados datos={analitica.porEstado} total={analitica.total} />
            </Tarjeta>
          ) : null}

          {visibles.includes("tipos") ? (
            <Tarjeta className="ui-chart-card lg-5" indice={8}>
              <TarjetaCabecera titulo="Comunidad" descripcion="Miembros, aliados y canales elegidos." />
              <GraficaComunidad analitica={analitica} />
            </Tarjeta>
          ) : null}

          {visibles.includes("areas") ? (
            <Tarjeta className="ui-chart-card lg-7" indice={8}>
              <TarjetaCabecera titulo="Interés por área" descripcion="Preferencias declaradas por aliados." />
              <GraficaAreas datos={analitica.porArea} />
            </Tarjeta>
          ) : null}
        </div>
      )}
    </section>
  );
}

function GraficaTendencia({ datos }: { datos: AnaliticaInicio["porSemana"] }) {
  const maximo = Math.max(1, ...datos.map((semana) => semana.total));
  return (
    <div className="ui-chart-trend">
      <svg viewBox="0 0 640 180" role="img" aria-label="Registros de las últimas ocho semanas">
        <line className="ui-chart-gridline" x1="28" y1="126" x2="620" y2="126" />
        {datos.map((semana, indice) => {
          const altura = Math.max(4, (semana.total / maximo) * 96);
          const x = 36 + indice * 73;
          const actual = indice === datos.length - 1;
          return (
            <g key={semana.inicio} className={actual ? "is-current" : undefined}>
              <title>{`${FORMATO_SEMANA.format(new Date(semana.inicio))}: ${semana.total}`}</title>
              <text className="ui-chart-value" x={x + 22} y={Math.max(15, 118 - altura)} textAnchor="middle">
                {semana.total || ""}
              </text>
              <rect className="ui-chart-bar" x={x} y={126 - altura} width="44" height={altura} rx="4" />
              <text className="ui-chart-label" x={x + 22} y="151" textAnchor="middle">
                {FORMATO_SEMANA.format(new Date(semana.inicio)).replace(".", "")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GraficaEstados({
  datos,
  total,
}: {
  datos: AnaliticaInicio["porEstado"];
  total: number;
}) {
  return (
    <div className="ui-chart-list">
      {datos.map((fila) => (
        <div key={fila.estado} className="ui-chart-list-row">
          <div>
            <span>{ETIQUETAS[fila.estado] ?? fila.estado}</span>
            <b>{fila.total}</b>
          </div>
          <progress max={Math.max(total, 1)} value={fila.total} aria-label={ETIQUETAS[fila.estado] ?? fila.estado} />
        </div>
      ))}
    </div>
  );
}

function GraficaComunidad({ analitica }: { analitica: AnaliticaInicio }) {
  const miembros = analitica.porTipo.find((fila) => fila.tipo === "miembro")?.total ?? 0;
  const aliados = analitica.porTipo.find((fila) => fila.tipo === "aliado")?.total ?? 0;
  const total = Math.max(miembros + aliados, 1);
  const circunferencia = 263.89;
  const tramoMiembros = (miembros / total) * circunferencia;

  return (
    <div className="ui-community-chart">
      <div className="ui-donut">
        <svg viewBox="0 0 110 110" role="img" aria-label={`${miembros} miembros y ${aliados} aliados`}>
          <circle className="ui-donut-track" cx="55" cy="55" r="42" />
          <circle
            className="ui-donut-value"
            cx="55"
            cy="55"
            r="42"
            strokeDasharray={`${tramoMiembros} ${circunferencia - tramoMiembros}`}
          />
        </svg>
        <span><b>{miembros + aliados}</b><small>personas</small></span>
      </div>
      <dl className="ui-community-legend">
        <div><dt><i data-tone="accent" />Miembros</dt><dd>{miembros}</dd></div>
        <div><dt><i data-tone="muted" />Aliados</dt><dd>{aliados}</dd></div>
        <div><dt>Correo</dt><dd>{analitica.porCanal.correo}</dd></div>
        <div><dt>WhatsApp</dt><dd>{analitica.porCanal.whatsapp}</dd></div>
      </dl>
    </div>
  );
}

function GraficaAreas({ datos }: { datos: AnaliticaInicio["porArea"] }) {
  const maximo = Math.max(1, ...datos.map((fila) => fila.total));
  return (
    <div className="ui-chart-areas">
      {[...datos]
        .sort((a, b) => b.total - a.total)
        .map((fila) => (
          <div key={fila.area} className="ui-chart-area-row">
            <span>{ETIQUETAS[fila.area] ?? fila.area}</span>
            <progress max={maximo} value={fila.total} aria-label={ETIQUETAS[fila.area] ?? fila.area} />
            <b>{fila.total}</b>
          </div>
        ))}
    </div>
  );
}
