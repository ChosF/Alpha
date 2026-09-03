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
  const { yo } = useCascaron();
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
          <span className="ui-stat-label">Programa publicado</span>
          <span className="ui-stat-value">
            {resumen.programasPublicados}
            <span className="ui-faint text-[16px] font-medium"> / {resumen.programasTotal}</span>
          </span>
          <span className="ui-stat-delta">Visible en la landing</span>
        </Tarjeta>
      </div>

      <div className="ui-grid mt-6">
        <section className="lg-8">
          <div className="ui-sec-h">
            <h2>Eventos</h2>
            <Link href="/dashboard/eventos">
              Ver todos <Icono nombre="chevronDerecha" tamano={13} />
            </Link>
          </div>

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
                <Tarjeta key={e._id} className="ui-proj" indice={Math.min(4 + i, 8)}>
                  <Link href="/dashboard/eventos" className="ui-proj-head" aria-label={`Abrir ${e.titulo}`}>
                    <span className="ui-proj-mark">
                      <Icono nombre="eventos" tamano={15} />
                    </span>
                    <span className="ui-proj-text">
                      <strong>{e.titulo}</strong>
                      <span>alphaccm.org/eventos/{e.slug}</span>
                    </span>
                    <span className="ui-proj-side">
                      {e.confirmados}/{e.totalRegistros}
                    </span>
                  </Link>
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
                </Tarjeta>
              ))}
            </div>
          )}
        </section>

        <aside className="lg-4 grid gap-4 content-start">
          <Tarjeta indice={5}>
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

          <Tarjeta indice={6}>
            <TarjetaCabecera titulo="Actividad" descripcion="Últimos movimientos del equipo." />
            {datos.actividad.length === 0 ? (
              <p className="ui-faint px-5 py-6 text-[12.5px]">Todavía no hay movimientos registrados.</p>
            ) : (
              <div className="ui-activity">
                {datos.actividad.map((a) => (
                  <div key={a._id} className="ui-activity-row">
                    <Avatar texto={iniciales(a.actorCorreo)} tamano="sm" hue={tonoAvatar(a.actorCorreo)} />
                    <p title={a.detalle ?? undefined}>
                      <b>{nombreCorto(a.actorCorreo)}</b> · {a.accion}
                      {a.detalle ? <span className="ui-faint"> · {a.detalle}</span> : null}
                    </p>
                    <time dateTime={new Date(a.creadoEn).toISOString()}>{relativo(a.creadoEn)}</time>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        </aside>
      </div>
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

function nombreCorto(correo: string): string {
  return correo.split("@")[0] ?? correo;
}

function tonoAvatar(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return (Math.abs(h) % 4) + 1;
}
