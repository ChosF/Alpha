"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_ASISTENTE,
  ESTADOS_EVENTO,
  ETIQUETAS,
  PILARES,
  TIPOS_ASISTENTE,
  type EstadoAsistente,
  type EstadoEvento,
  type Pilar,
  type TipoAsistente,
} from "@/convex/lib/validadores";
import { construirCsv } from "@/lib/csv";
import { fechaEventoEnEspanol, horarioEvento } from "@/lib/correo-evento";
import { construirXlsx, formatearFechaHoraExcel } from "@/lib/xlsx";
import { Icono } from "@/components/panel/ui/iconos";
import {
  AreaTexto,
  Avatar,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Entrada,
  Kbd,
  Menu,
  MenuItem,
  Pildora,
  Seleccion,
  TONO_ESTADO,
  Tarjeta,
  Vacio,
  fecha,
  iniciales,
  relativo,
} from "@/components/panel/ui/primitivas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";
import { useCascaron } from "@/components/panel/ui/cascaron";
import { CorreoEvento } from "./correo-evento";
import { MAX_EQUIPOS_INICIAL } from "@/lib/torneo-mario-kart";
import {
  ETIQUETAS_AREAS_ALIADO,
  GAFETES_NETWORKING_NIGHT,
  NETWORKING_NIGHT,
  PONENTES_NETWORKING_NIGHT,
} from "@/lib/networking-night";

type EventoLista = FunctionReturnType<typeof api.eventos.listar>[number];
type Registro = Doc<"eventRegistrations">;
type FiltroTipo = "todos" | TipoAsistente | "por_verificar";

/** Eventos con página propia fuera de /eventos/[slug] mientras no tengan ruta pública. */
const RUTAS_PROPIAS: Record<string, string> = { [NETWORKING_NIGHT.slug]: NETWORKING_NIGHT.ruta };

function rutaPublicaDe(evento: { slug: string; rutaPublica?: string }): string {
  return evento.rutaPublica ?? RUTAS_PROPIAS[evento.slug] ?? `/eventos/${evento.slug}`;
}

function cuotaDe(slug: string): number | undefined {
  return slug === NETWORKING_NIGHT.slug ? NETWORKING_NIGHT.cuotaMxn : undefined;
}

function textoPago(pago: NonNullable<Registro["pago"]>): string {
  if (pago.estado === "pendiente") return `Pendiente · $${pago.montoMxn} MXN en efectivo`;
  return pago.metodo === "stripe" ? `Pagado en línea · $${pago.montoMxn} MXN` : `Pagado en efectivo · $${pago.montoMxn} MXN`;
}

export function ListaEventos() {
  const router = useRouter();
  const { yo } = useCascaron();
  const eventos = useQuery(api.eventos.listar, {});
  const [creando, setCreando] = useState(false);
  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";

  if (eventos === undefined) {
    return (
      <Tarjeta>
        <Cargando que="los eventos" />
      </Tarjeta>
    );
  }

  return (
    <>
      {eventos.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Todavía no hay eventos" ayuda="Crea el primero. Los registros públicos aparecerán aquí." />
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {eventos.map((item, i) => (
            <Link
              key={item._id}
              href={`/dashboard/eventos/${item._id}`}
              className="ui-card ui-card-link ui-proj text-left"
              data-i={Math.min(i + 1, 8)}
              aria-label={`Abrir ${item.titulo}`}
            >
              <span className="ui-proj-head">
                <Avatar texto={iniciales(item.titulo)} />
                <span className="ui-proj-text">
                  <strong>{item.titulo}</strong>
                  <span>alphaccm.org{rutaPublicaDe(item)}</span>
                </span>
                <span className="ui-proj-side">
                  {item.asistentes}/{item.totalRegistros}
                </span>
              </span>
              <p className="ui-proj-note">
                <Icono nombre="eventos" tamano={14} />
                <span>{item.fechaEvento ? fechaEventoEnEspanol(item.fechaEvento) : "Fecha por definir"}</span>
              </p>
              <div className="ui-proj-foot">
                <span className="ui-proj-who">
                  <Icono nombre="reloj" tamano={13} />
                  {relativo(item.actualizadoEn)}
                </span>
                <Pildora tono={TONO_ESTADO[item.estado] ?? "neutro"} sm>
                  {item.registroAbierto && item.estado === "publicado"
                    ? "Registro abierto"
                    : ETIQUETAS[item.estado] ?? item.estado}
                </Pildora>
              </div>
            </Link>
          ))}
          {puedeEditar ? (
            <button type="button" className="ui-card ui-card-dashed ui-proj items-center justify-center" onClick={() => setCreando(true)}>
              <span className="ui-proj-mark">
                <Icono nombre="mas" tamano={16} />
              </span>
              <strong>Nuevo evento</strong>
              <span className="ui-faint text-[12.5px]">Borrador, sin registro abierto.</span>
            </button>
          ) : null}
        </div>
      )}
      {creando ? (
        <FormularioEvento
          alListo={(id) => {
            setCreando(false);
            router.push(`/dashboard/eventos/${id}`);
          }}
          alCerrar={() => setCreando(false)}
        />
      ) : null}
    </>
  );
}

export function EventoDetalle({ eventoId }: { eventoId: string }) {
  const { yo } = useCascaron();
  const eventos = useQuery(api.eventos.listar, {});

  if (eventos === undefined) {
    return (
      <Tarjeta>
        <Cargando que="el evento" />
      </Tarjeta>
    );
  }

  const evento = eventos.find((item) => item._id === eventoId);
  if (!evento) {
    return (
      <Tarjeta>
        <Vacio titulo="Evento no encontrado" ayuda="Vuelve a Eventos y selecciona uno de la lista." />
      </Tarjeta>
    );
  }

  return (
    <DetalleEvento
      evento={evento}
      puedeEditar={yo?.rol === "admin" || yo?.rol === "editor"}
      esAdmin={yo?.rol === "admin"}
    />
  );
}

function DetalleEvento({
  evento,
  puedeEditar,
  esAdmin,
}: {
  evento: EventoLista;
  puedeEditar: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoAsistente | "">("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [abierto, setAbierto] = useState<Id<"eventRegistrations"> | null>(null);
  const [editando, setEditando] = useState(false);
  const [correoTipo, setCorreoTipo] = useState<"recordatorio" | "encuesta" | "normal" | null>(null);
  const [modoAsistencia, setModoAsistencia] = useState(false);
  const [confirmandoAsistencia, setConfirmandoAsistencia] = useState<Id<"eventRegistrations"> | null>(null);
  const [procesandoAsistencia, setProcesandoAsistencia] = useState<Id<"eventRegistrations"> | null>(null);
  const [registrandoEnPuerta, setRegistrandoEnPuerta] = useState(false);
  const [avisoAsistencia, setAvisoAsistencia] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const cambiarRegistro = useMutation(api.eventos.cambiarRegistroAbierto);
  const cambiarEstadoRegistro = useMutation(api.eventos.cambiarEstadoRegistro);
  const cuota = cuotaDe(evento.slug);
  const pagos = useQuery(api.eventos.resumenPagos, cuota !== undefined ? { eventId: evento._id } : "skip");
  const resumenVerif = useQuery(api.verificaciones.resumen, cuota !== undefined ? { eventId: evento._id } : "skip");
  const registros = useQuery(api.eventos.listarRegistros, {
    eventId: evento._id,
    ...(busqueda ? { busqueda } : {}),
    ...(estado ? { estado } : {}),
  });
  const registrosFiltrados = useMemo(() => {
    if (registros === undefined) return undefined;
    const base =
      filtroTipo === "todos"
        ? registros
        : filtroTipo === "por_verificar"
          ? registros.filter((r) => r.verificacion?.estado === "pendiente")
          : registros.filter((r) => (r.tipoAsistente ?? "estudiante") === filtroTipo);
    if (!modoAsistencia) return base;
    return [...base].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-MX", { sensitivity: "base" }),
    );
  }, [filtroTipo, modoAsistencia, registros]);
  const seleccionado = modoAsistencia ? null : registros?.find((r) => r._id === abierto) ?? null;

  useEffect(() => {
    if (!seleccionado || !window.matchMedia("(max-width: 1023px)").matches) return;
    const overflowAnterior = document.body.style.overflow;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [seleccionado]);

  const alternarModoAsistencia = () => {
    setModoAsistencia((activo) => {
      const siguiente = !activo;
      if (siguiente) setEstado("");
      return siguiente;
    });
    setAbierto(null);
    setConfirmandoAsistencia(null);
    setAvisoAsistencia(null);
  };

  const prepararORegistrarAsistencia = async (registro: Registro) => {
    if (!modoAsistencia || procesandoAsistencia !== null) return;
    setAvisoAsistencia(null);
    if (registro.verificacion && registro.verificacion.estado !== "aprobada") {
      setConfirmandoAsistencia(null);
      setAvisoAsistencia({
        tono: "error",
        texto:
          registro.verificacion.estado === "pendiente"
            ? `${registro.nombre || "Esta persona"} tiene verificación pendiente. Desactiva el modo Asistencia para revisar y aprobar su solicitud.`
            : `${registro.nombre || "Esta persona"} tiene una solicitud rechazada.`,
      });
      return;
    }
    if (registro.estado === "asistio") {
      setConfirmandoAsistencia(null);
      setAvisoAsistencia({ tono: "exito", texto: `${registro.nombre || "Esta persona"} ya tiene asistencia.` });
      return;
    }
    if (confirmandoAsistencia !== registro._id) {
      setConfirmandoAsistencia(registro._id);
      return;
    }

    setProcesandoAsistencia(registro._id);
    try {
      await cambiarEstadoRegistro({ id: registro._id, estado: "asistio" });
      const cobro = registro.pago?.estado === "pendiente" ? ` Cobro de $${registro.pago.montoMxn} MXN en efectivo registrado.` : "";
      setAvisoAsistencia({
        tono: "exito",
        texto: `Asistencia registrada${registro.nombre ? `: ${registro.nombre}.` : "."}${cobro}`,
      });
    } catch (error) {
      setAvisoAsistencia({
        tono: "error",
        texto: error instanceof Error ? error.message : "No se pudo registrar la asistencia.",
      });
    } finally {
      setConfirmandoAsistencia(null);
      setProcesandoAsistencia(null);
    }
  };

  return (
    <>
      <div className="evento-detalle-cabecera mb-5">
        <div className="min-w-0">
          <Link href="/dashboard/eventos" className="ui-faint mb-2 inline-flex items-center gap-1 text-[12.5px]">
            <Icono nombre="chevronIzquierda" tamano={13} />
            Eventos
          </Link>
          <h2 className="ui-title">{evento.titulo}</h2>
          <p className="ui-desc mt-1 max-w-2xl">{evento.resumen || "Sin resumen."}</p>
          <a
            href={rutaPublicaDe(evento)}
            target="_blank"
            rel="noreferrer"
            className="ui-faint mt-2 inline-block text-[12px] hover:underline"
          >
            alphaccm.org{rutaPublicaDe(evento)}
          </a>
        </div>
        <InformacionFechaEvento evento={evento} />
        <div className="evento-detalle-acciones">
          <Pildora tono={TONO_ESTADO[evento.estado] ?? "neutro"}>{ETIQUETAS[evento.estado]}</Pildora>
          {puedeEditar ? (
            <>
              <Menu
                disparador={(abiertoMenu) => (
                  <Boton icono="correo" iconoFinal="chevronAbajo" aria-expanded={abiertoMenu}>
                    Mandar correos
                  </Boton>
                )}
              >
                <MenuItem icono="campana" onClick={() => setCorreoTipo("recordatorio")}>
                  Recordatorio para hoy
                </MenuItem>
                <MenuItem icono="estrella" onClick={() => setCorreoTipo("encuesta")}>
                  Encuesta de satisfacción
                </MenuItem>
                <MenuItem icono="correo" onClick={() => setCorreoTipo("normal")}>
                  Correo normal
                </MenuItem>
              </Menu>
              <Boton onClick={() => void cambiarRegistro({ eventId: evento._id, abierto: !evento.registroAbierto })}>
                {evento.registroAbierto ? "Cerrar registro" : "Abrir registro"}
              </Boton>
              <Boton icono="lapiz" onClick={() => setEditando(true)}>
                Editar
              </Boton>
            </>
          ) : null}
          {esAdmin ? (
            <BotonExportar evento={evento} estado={estado} conPerfil={cuota !== undefined} />
          ) : null}
          {puedeEditar && modoAsistencia ? (
            <Boton variante="acento" icono="mas" onClick={() => setRegistrandoEnPuerta(true)}>
              Registrar
            </Boton>
          ) : null}
          {puedeEditar ? (
            <Boton
              icono="check"
              className="evento-asistencia-toggle"
              aria-pressed={modoAsistencia}
              onClick={alternarModoAsistencia}
            >
              Asistencia
            </Boton>
          ) : null}
        </div>
      </div>

      <div className="ui-grid mb-5">
        <Tarjeta className={`ui-stat ${cuota !== undefined ? "lg-3" : "lg-4"}`}>
          <span className="ui-stat-label">Registros</span>
          <span className="ui-stat-value">{evento.totalRegistros}</span>
          {resumenVerif && resumenVerif.pendientes > 0 ? (
            <span className="ui-stat-delta">
              {resumenVerif.pendientes} solicitud{resumenVerif.pendientes === 1 ? "" : "es"} por verificar
            </span>
          ) : null}
        </Tarjeta>
        <Tarjeta className={`ui-stat ${cuota !== undefined ? "lg-3" : "lg-4"}`}>
          <span className="ui-stat-label">Asistentes</span>
          <span className="ui-stat-value">{evento.asistentes}</span>
        </Tarjeta>
        {cuota !== undefined ? (
          <Tarjeta className="ui-stat lg-3">
            <span className="ui-stat-label">Cuotas cobradas</span>
            <span className="ui-stat-value">${pagos?.cobradoMxn ?? 0}</span>
            <span className="ui-stat-delta">
              {pagos
                ? `${pagos.pagados} pagadas${pagos.enLinea ? ` (${pagos.enLinea} en línea)` : ""} · ${pagos.pendientes} por cobrar de $${cuota}`
                : "Cargando…"}
            </span>
          </Tarjeta>
        ) : null}
        <Tarjeta className={`ui-stat ${cuota !== undefined ? "lg-3" : "lg-4"}`}>
          <span className="ui-stat-label">Registro</span>
          <span className="ui-stat-value text-[18px]">{evento.registroAbierto ? "Abierto" : "Cerrado"}</span>
          {!evento.registroAbierto && evento.estado === "publicado" ? (
            <span className="ui-stat-delta">La página pública no acepta registros.</span>
          ) : null}
        </Tarjeta>
      </div>

      <div className="ui-split evento-asistentes-split" data-detail={seleccionado ? "open" : "closed"}>
        <Tarjeta>
          {modoAsistencia ? (
            <div className="evento-asistencia-guia" role="status">
              <span>
                Busca a una persona y selecciónala dos veces. Con un solo resultado también puedes presionar <Kbd>Enter</Kbd> dos veces.
              </span>
              <strong>Orden A–Z</strong>
            </div>
          ) : null}
          {cuota !== undefined && resumenVerif ? (
            <div className="ui-tipo-tabs" role="tablist" aria-label="Filtrar por tipo de asistente">
              {(
                [
                  { id: "todos", etiqueta: "Todos", conteo: evento.totalRegistros },
                  { id: "estudiante", etiqueta: "Estudiantes", conteo: resumenVerif.porTipo.estudiante },
                  { id: "exatec", etiqueta: "Exatecs", conteo: resumenVerif.porTipo.exatec },
                  { id: "ponente", etiqueta: "Ponentes", conteo: resumenVerif.porTipo.ponente },
                  { id: "aliado", etiqueta: "Aliados", conteo: resumenVerif.porTipo.aliado },
                  { id: "por_verificar", etiqueta: "Por verificar", conteo: resumenVerif.pendientes, alerta: resumenVerif.pendientes > 0 },
                ] as { id: FiltroTipo; etiqueta: string; conteo: number; alerta?: boolean }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filtroTipo === tab.id}
                  className="ui-tipo-tab"
                  data-active={filtroTipo === tab.id ? "true" : undefined}
                  data-alert={tab.alerta ? "true" : undefined}
                  onClick={() => {
                    setFiltroTipo(tab.id);
                    setConfirmandoAsistencia(null);
                    setAvisoAsistencia(null);
                  }}
                >
                  <span>{tab.etiqueta}</span>
                  <span className="ui-tipo-tab-count">{tab.conteo}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="ui-filterbar p-4 pb-0">
            <Entrada
              icono="buscar"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setConfirmandoAsistencia(null);
                setAvisoAsistencia(null);
              }}
              onKeyDown={(e) => {
                if (
                  e.key !== "Enter" ||
                  !modoAsistencia ||
                  !busqueda.trim() ||
                  registrosFiltrados?.length !== 1
                ) {
                  return;
                }
                const unico = registrosFiltrados[0];
                if (!unico) return;
                e.preventDefault();
                void prepararORegistrarAsistencia(unico);
              }}
              placeholder="Nombre, correo, carrera o matrícula"
            />
            <Seleccion
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as EstadoAsistente | "");
                setConfirmandoAsistencia(null);
                setAvisoAsistencia(null);
              }}
              className="max-w-[180px]"
            >
              <option value="">Todos los estados</option>
              {ESTADOS_ASISTENTE.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS[valor]}
                </option>
              ))}
            </Seleccion>
          </div>
          {avisoAsistencia ? (
            <div className="px-4 pb-3">
              <Aviso tono={avisoAsistencia.tono}>{avisoAsistencia.texto}</Aviso>
            </div>
          ) : null}
          {registrosFiltrados === undefined ? (
            <Cargando que="los asistentes" />
          ) : registrosFiltrados.length === 0 ? (
            <Vacio
              titulo="Sin asistentes que mostrar"
              ayuda={
                busqueda || estado || filtroTipo !== "todos"
                  ? "Ningún registro coincide con estos filtros."
                  : "Los nuevos registros aparecen aquí en tiempo real."
              }
            />
          ) : (
            <div className="ui-table-wrap">
              <table className={`ui-table ui-table-mobile ui-table-asistentes ${modoAsistencia ? "evento-asistencia-tabla" : ""}`}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Carrera</th>
                    {cuota !== undefined ? <th>Gafete</th> : null}
                    {cuota !== undefined ? <th>Pago / acceso</th> : null}
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((registro) => {
                    const tipo = registro.tipoAsistente ?? "estudiante";
                    const gafete = GAFETES_NETWORKING_NIGHT[tipo];
                    return (
                      <tr
                        key={registro._id}
                        data-selected={abierto === registro._id ? "true" : undefined}
                        data-confirming={confirmandoAsistencia === registro._id ? "true" : undefined}
                        data-attended={registro.estado === "asistio" ? "true" : undefined}
                        aria-busy={procesandoAsistencia === registro._id || undefined}
                        onClick={() => {
                          if (modoAsistencia) {
                            void prepararORegistrarAsistencia(registro);
                          } else {
                            setAbierto(abierto === registro._id ? null : registro._id);
                          }
                        }}
                      >
                        <td className="font-medium">
                          {registro.nombre || "Sin nombre"}
                          {registro.equipoNombre ? <span className="block text-xs ui-faint">{registro.equipoNombre}</span> : null}
                          {modoAsistencia && confirmandoAsistencia === registro._id ? (
                            <span className="evento-asistencia-confirmacion">
                              {registro.pago?.estado === "pendiente"
                                ? `Cobra $${registro.pago.montoMxn} MXN y haz clic de nuevo para confirmar`
                                : `Entrega ${`gafete ${gafete.nombre.toLowerCase()}`} y haz clic de nuevo para confirmar`}
                            </span>
                          ) : null}
                        </td>
                        <td className="ui-faint">{registro.correo || "—"}</td>
                        <td>{registro.carrera || "—"}</td>
                        {cuota !== undefined ? (
                          <td>
                            <span className="ui-gafete-pill" data-tipo={tipo}>
                              {gafete.etiqueta}
                            </span>
                          </td>
                        ) : null}
                        {cuota !== undefined ? (
                          <td>
                            {registro.verificacion?.estado === "pendiente" ? (
                              <Pildora tono="warn" sm>
                                Por verificar
                              </Pildora>
                            ) : registro.verificacion?.estado === "rechazada" ? (
                              <Pildora tono="bad" sm>
                                Rechazado
                              </Pildora>
                            ) : tipo !== "estudiante" ? (
                              <Pildora tono="ok" sm>
                                Cortesía
                              </Pildora>
                            ) : registro.pago ? (
                              <Pildora tono={registro.pago.estado === "pagado" ? "ok" : "warn"} sm>
                                {registro.pago.estado === "pagado"
                                  ? registro.pago.metodo === "stripe"
                                    ? "En línea"
                                    : "Pagado"
                                  : `$${registro.pago.montoMxn} pendiente`}
                              </Pildora>
                            ) : (
                              <span className="ui-faint">—</span>
                            )}
                          </td>
                        ) : null}
                        <td>
                          <Pildora tono={TONO_ESTADO[registro.estado] ?? "neutro"} sm>
                            {ETIQUETAS[registro.estado]}
                          </Pildora>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
        {seleccionado ? (
          <FichaAsistente
            registro={seleccionado}
            puedeEditar={puedeEditar}
            conTipos={cuota !== undefined}
            alCerrar={() => setAbierto(null)}
          />
        ) : null}
      </div>

      {editando ? (
        <FormularioEvento
          evento={evento}
          alListo={() => setEditando(false)}
          alCerrar={() => setEditando(false)}
          alEliminar={() => {
            setEditando(false);
            router.push("/dashboard/eventos");
          }}
        />
      ) : null}
      {correoTipo ? <CorreoEvento evento={evento} tipo={correoTipo} cerrar={() => setCorreoTipo(null)} /> : null}
      {registrandoEnPuerta ? (
        <FormularioAsistenteEnPuerta
          eventId={evento._id}
          conTipos={cuota !== undefined}
          alCerrar={() => setRegistrandoEnPuerta(false)}
          alListo={(texto) => {
            setRegistrandoEnPuerta(false);
            setAvisoAsistencia({ tono: "exito", texto });
          }}
        />
      ) : null}
    </>
  );
}

function FichaAsistente({
  registro,
  puedeEditar,
  conTipos,
  alCerrar,
}: {
  registro: Registro;
  puedeEditar: boolean;
  conTipos: boolean;
  alCerrar: () => void;
}) {
  const cambiarEstado = useMutation(api.eventos.cambiarEstadoRegistro);
  const cambiarPago = useMutation(api.eventos.cambiarPagoRegistro);
  const guardarNotas = useMutation(api.eventos.guardarNotasRegistro);
  const reenviarBoleto = useMutation(api.verificaciones.reenviarBoleto);
  const urlCv = useQuery(
    api.eventos.urlCvRegistro,
    puedeEditar && registro.perfil?.cvStorageId ? { id: registro._id } : "skip",
  );
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const telefono = registro.telefono?.replace(/\D/g, "") ?? "";
  const numero = telefono.length === 10 ? `52${telefono}` : telefono;
  const tipo = registro.tipoAsistente ?? "estudiante";
  const gafete = GAFETES_NETWORKING_NIGHT[tipo];
  const mostrarPanelVerif = Boolean(
    conTipos && (registro.verificacion || (registro.tipoAsistente && registro.tipoAsistente !== "estudiante")),
  );
  const puedeReenviarBoleto =
    conTipos && (!registro.verificacion || registro.verificacion.estado === "aprobada");

  return (
    <>
      <button
        type="button"
        className="ui-registration-backdrop"
        aria-label={`Cerrar ficha de ${registro.nombre}`}
        onClick={alCerrar}
      />
      <aside
        className="ui-sheet ui-registration-sheet evento-asistente-sheet"
        aria-labelledby={`asistente-${registro._id}-titulo`}
      >
        <span className="ui-registration-sheet-handle" aria-hidden="true" />
        <div className="ui-card-h ui-registration-sheet-head">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`asistente-${registro._id}-titulo`} className="ui-h2 truncate">
                {registro.nombre}
              </h3>
              {conTipos ? (
                <span className="ui-gafete-pill shrink-0" data-tipo={tipo}>
                  Gafete {gafete.nombre}
                </span>
              ) : null}
            </div>
            <p className="ui-faint truncate text-[12px]">{registro.correo}</p>
          </div>
          <Boton
            tamano="sm"
            variante="fantasma"
            soloIcono
            icono="cerrar"
            etiqueta="Cerrar ficha"
            onClick={alCerrar}
          />
        </div>

        {mostrarPanelVerif ? (
          <PanelVerificacion
            registro={registro}
            puedeEditar={puedeEditar}
            urlCv={urlCv}
          />
        ) : null}

        <dl className="ui-dl p-5">
          {conTipos ? (
            <>
              <dt>Tipo</dt>
              <dd>{gafete.etiqueta} (Gafete {gafete.nombre})</dd>
            </>
          ) : null}
          <dt>Carrera</dt>
          <dd>{registro.carrera}</dd>
          <dt>Semestre / Gen.</dt>
          <dd>{registro.semestre}</dd>
          <dt>Matrícula</dt>
          <dd>{registro.matricula ?? "—"}</dd>
          {registro.detalleTipo?.tipo === "aliado" ? (
            <>
              <dt>Área en Alpha</dt>
              <dd>{ETIQUETAS_AREAS_ALIADO[registro.detalleTipo.area] ?? registro.detalleTipo.area}</dd>
            </>
          ) : null}
          {registro.detalleTipo?.tipo === "exatec" && registro.detalleTipo.empresa ? (
            <>
              <dt>Empresa</dt>
              <dd>{registro.detalleTipo.empresa}</dd>
            </>
          ) : null}
          {registro.detalleTipo?.tipo === "exatec" && registro.detalleTipo.puesto ? (
            <>
              <dt>Puesto</dt>
              <dd>{registro.detalleTipo.puesto}</dd>
            </>
          ) : null}
          {registro.detalleTipo?.tipo === "exatec" && registro.detalleTipo.linkedin ? (
            <>
              <dt>LinkedIn</dt>
              <dd>
                <a href={registro.detalleTipo.linkedin} target="_blank" rel="noreferrer" className="underline">
                  Abrir perfil
                </a>
              </dd>
            </>
          ) : null}
          <dt>Registrado</dt>
          <dd>{fecha(registro.creadoEn)}</dd>
          <dt>WhatsApp</dt>
          <dd>{registro.canales.whatsapp ? registro.telefono ?? "Sí" : "No"}</dd>
          {registro.equipoNombre ? <><dt>Equipo</dt><dd>{registro.equipoNombre}</dd></> : null}
          {registro.perfil ? (
            <>
              <dt>Intereses</dt>
              <dd>{registro.perfil.intereses.join(", ") || "—"}</dd>
              <dt>Habilidades</dt>
              <dd>{registro.perfil.habilidades.join(", ") || "—"}</dd>
              <dt>CV</dt>
              <dd>
                {!registro.perfil.cvStorageId ? (
                  "No subió CV"
                ) : !puedeEditar ? (
                  "Subió CV"
                ) : urlCv ? (
                  <a href={urlCv} target="_blank" rel="noreferrer" className="underline">
                    Abrir PDF
                  </a>
                ) : urlCv === null ? (
                  "El archivo ya no está disponible"
                ) : (
                  "Cargando…"
                )}
              </dd>
            </>
          ) : null}
          {registro.pago ? (
            <>
              <dt>Pago</dt>
              <dd>
                {textoPago(registro.pago)}
                {registro.pago.pagadoEn ? <span className="block ui-faint">{fecha(registro.pago.pagadoEn)}</span> : null}
              </dd>
            </>
          ) : conTipos && tipo !== "estudiante" ? (
            <>
              <dt>Acceso</dt>
              <dd>Cortesía ({gafete.etiqueta})</dd>
            </>
          ) : null}
        </dl>
        {puedeEditar ? (
          <div className="ui-registration-actions grid gap-4 border-t border-[var(--line)] p-5">
            <div className="ui-registration-quick-actions">
              {numero ? (
                <a className="ui-btn ui-btn-sm" href={`https://wa.me/${numero}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
              <a className="ui-btn ui-btn-sm" href={`/dashboard/correo?para=${encodeURIComponent(registro.correo)}`}>
                Correo
              </a>
              {puedeReenviarBoleto ? (
                <Boton
                  tamano="sm"
                  icono="enviar"
                  disabled={reenviando}
                  onClick={() => {
                    setErrorPago(null);
                    setMensaje(null);
                    setReenviando(true);
                    void reenviarBoleto({ id: registro._id })
                      .then(() => setMensaje("Boleto enviado por correo."))
                      .catch((e: unknown) =>
                        setErrorPago(e instanceof Error ? e.message : "No se pudo reenviar el boleto."),
                      )
                      .finally(() => setReenviando(false));
                  }}
                >
                  {reenviando ? "Enviando…" : "Reenviar boleto"}
                </Boton>
              ) : null}
              {registro.pago && registro.pago.metodo === "efectivo" ? (
                <Boton
                  tamano="sm"
                  icono={registro.pago.estado === "pendiente" ? "check" : undefined}
                  onClick={() => {
                    setErrorPago(null);
                    void cambiarPago({ id: registro._id, pagado: registro.pago?.estado === "pendiente" }).catch((e: unknown) =>
                      setErrorPago(e instanceof Error ? e.message : "No se pudo actualizar el pago."),
                    );
                  }}
                >
                  {registro.pago.estado === "pendiente"
                    ? `Recibí $${registro.pago.montoMxn} en efectivo`
                    : "Marcar cuota como pendiente"}
                </Boton>
              ) : null}
            </div>
            {errorPago ? <Aviso tono="error">{errorPago}</Aviso> : null}
            <Campo etiqueta="Estado" htmlFor={`asistente-estado-${registro._id}`}>
              <SelectorPersonalizado
                id={`asistente-estado-${registro._id}`}
                valor={registro.estado}
                opciones={ESTADOS_ASISTENTE.map((valor) => ({ valor, etiqueta: ETIQUETAS[valor] ?? valor }))}
                alCambiar={(valor) => {
                  setErrorPago(null);
                  void cambiarEstado({ id: registro._id, estado: valor as EstadoAsistente }).catch((e: unknown) =>
                    setErrorPago(e instanceof Error ? e.message : "No se pudo actualizar el estado."),
                  );
                }}
              />
            </Campo>
            <Campo etiqueta="Notas internas" htmlFor={`asistente-notas-${registro._id}`}>
              <AreaTexto
                id={`asistente-notas-${registro._id}`}
                value={notas}
                maxLength={2000}
                onChange={(e) => setNotas(e.target.value)}
              />
            </Campo>
            <div className="flex flex-wrap items-center gap-3">
              <Boton
                variante="primario"
                disabled={notas === (registro.notas ?? "")}
                onClick={() => void guardarNotas({ id: registro._id, notas }).then(() => setMensaje("Notas guardadas."))}
              >
                Guardar notas
              </Boton>
              {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function PanelVerificacion({
  registro,
  puedeEditar,
  urlCv,
}: {
  registro: Registro;
  puedeEditar: boolean;
  urlCv: string | null | undefined;
}) {
  const resolver = useMutation(api.verificaciones.resolver);
  const tipo = registro.tipoAsistente ?? "estudiante";
  const estadoVerif = registro.verificacion?.estado ?? "aprobada";
  const padron = useQuery(
    api.verificaciones.buscarEnPadron,
    puedeEditar && tipo === "aliado" ? { id: registro._id } : "skip",
  );
  const [ocupado, setOcupado] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [notificarRechazo, setNotificarRechazo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const ejecutarDecision = async (
    decision: "aprobar" | "rechazar" | "convertir_estudiante",
  ) => {
    setOcupado(true);
    setError(null);
    setExito(null);
    try {
      await resolver({
        id: registro._id,
        decision,
        ...(decision === "rechazar" && motivoRechazo.trim()
          ? { motivo: motivoRechazo.trim() }
          : {}),
        ...(decision === "rechazar" ? { notificar: notificarRechazo } : {}),
      });
      setRechazando(false);
      setExito(
        decision === "aprobar"
          ? "Perfil verificado. Se envió el boleto con QR por correo."
          : decision === "convertir_estudiante"
            ? "Convertido a estudiante ($70 MXN en efectivo) y boleto enviado."
            : "Solicitud rechazada.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la verificación.");
    } finally {
      setOcupado(false);
    }
  };

  const ponenteId = registro.detalleTipo?.tipo === "ponente" ? registro.detalleTipo.ponenteId : undefined;
  const ponenteSeleccionado = ponenteId
    ? PONENTES_NETWORKING_NIGHT.find((p) => p.id === ponenteId)?.nombre ??
      (ponenteId === "otro" ? "No aparece en la lista («Otro»)" : ponenteId)
    : null;
  const detalleExatec = registro.detalleTipo?.tipo === "exatec" ? registro.detalleTipo : null;
  const detalleAliado = registro.detalleTipo?.tipo === "aliado" ? registro.detalleTipo : null;

  return (
    <section className="ui-verif-card" data-estado={estadoVerif} aria-label="Verificación de perfil">
      <div className="ui-verif-head">
        <div className="min-w-0">
          <h4 className="ui-verif-title">
            {estadoVerif === "pendiente"
              ? `Solicitud de ${ETIQUETAS[tipo] ?? tipo} por verificar`
              : estadoVerif === "aprobada"
                ? `Perfil de ${ETIQUETAS[tipo] ?? tipo} verificado`
                : `Solicitud de ${ETIQUETAS[tipo] ?? tipo} rechazada`}
          </h4>
          <p className="ui-verif-sub">
            {estadoVerif === "pendiente"
              ? "El boleto con QR se emite y envía por correo en cuanto apruebes este registro."
              : registro.verificacion?.metodo === "automatica"
                ? "Validado automáticamente contra la lista oficial de ponentes."
                : registro.verificacion?.revisadoEn
                  ? `Resuelto manualmente · ${fecha(registro.verificacion.revisadoEn)}`
                  : "Acceso de cortesía activo."}
          </p>
        </div>
        <span className="shrink-0">
          <Pildora
            tono={
              estadoVerif === "aprobada"
                ? "ok"
                : estadoVerif === "rechazada"
                  ? "bad"
                  : "warn"
            }
            sm
          >
            {ETIQUETAS[estadoVerif] ?? estadoVerif}
          </Pildora>
        </span>
      </div>

      {tipo === "exatec" ? (
        <div className="ui-padron-box">
          <div className="ui-padron-head">
            <span>Comprobación de Exatec</span>
            <span>Generación {detalleExatec?.generacion ?? registro.semestre}</span>
          </div>
          <p className="text-[12px] text-[var(--fg-2)] break-words">
            Carrera: <strong>{registro.carrera}</strong>
            {detalleExatec?.empresa ? ` · ${detalleExatec.empresa}` : ""}
            {detalleExatec?.puesto ? ` (${detalleExatec.puesto})` : ""}
          </p>
          {puedeEditar ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {urlCv ? (
                <a
                  href={urlCv}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-btn ui-btn-sm ui-btn-primary"
                >
                  <Icono nombre="archivo" tamano={14} />
                  Revisar CV en PDF
                </a>
              ) : (
                <span className="text-[12px] text-[var(--fg-3)]">
                  {registro.perfil?.cvStorageId ? "Cargando CV…" : "Sin CV adjunto"}
                </span>
              )}
              {detalleExatec?.linkedin ? (
                <a
                  href={detalleExatec.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-btn ui-btn-sm"
                >
                  <Icono nombre="externo" tamano={14} />
                  LinkedIn
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tipo === "aliado" && puedeEditar ? (
        <div className="ui-padron-box">
          <div className="ui-padron-head">
            <span>Cruce con padrón de Alpha</span>
            <span>
              Área declarada:{" "}
              {detalleAliado
                ? ETIQUETAS_AREAS_ALIADO[detalleAliado.area] ?? detalleAliado.area
                : "—"}
            </span>
          </div>
          <p className="text-[11.5px] text-[var(--fg-3)]">
            Recuerda: solo quienes están registrados como <strong>Aliado</strong> tienen cortesía. Los miembros regulares pagan cuota de estudiante ($70 MXN).
          </p>
          {padron === undefined ? (
            <p className="text-[12px] text-[var(--fg-3)]">Buscando en el padrón de integrantes…</p>
          ) : padron.length === 0 ? (
            <Aviso tono="error">
              No se encontraron coincidencias por correo, matrícula ni nombre en el padrón de integrantes.
            </Aviso>
          ) : (
            <div className="grid min-w-0 gap-1.5">
              {padron.map((item) => (
                <div
                  key={item._id}
                  className="ui-padron-item"
                  data-match={item.tipo}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <strong className="truncate font-semibold" title={item.nombre}>
                        {item.nombre}
                      </strong>
                      <span className="shrink-0">
                        <Pildora tono={item.tipo === "aliado" ? "ok" : "warn"} sm>
                          {item.tipo === "aliado" ? "Aliado (Cortesía)" : "Miembro (Paga $70)"}
                        </Pildora>
                      </span>
                    </div>
                    <span
                      className="mt-0.5 block text-[11px] text-[var(--fg-3)] break-words"
                      title={`${item.correo} · ${item.carrera}${item.semestre ? ` (${item.semestre})` : ""}${item.matricula ? ` · ${item.matricula}` : ""}`}
                    >
                      {item.correo} · {item.carrera}{item.semestre ? ` (${item.semestre})` : ""}{item.matricula ? ` · ${item.matricula}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tipo === "ponente" ? (
        <div className="ui-padron-box">
          <div className="ui-padron-head">
            <span>Verificación de ponente</span>
            <span>{ponenteSeleccionado ?? "Sin perfil"}</span>
          </div>
          <p className="text-[12px] text-[var(--fg-2)] break-words">
            {registro.verificacion?.motivo === "ponente-ya-reclamado"
              ? "Este ponente ya tenía un boleto emitido previamente. Confirma si se trata de la misma persona antes de aprobar."
              : registro.verificacion?.motivo === "ponente-sin-coincidencia"
                ? "El nombre escrito no coincidió automáticamente con la tarjeta de ponente o eligió «No aparezco en la lista»."
                : "Nombre verificado con la lista de ponentes de la landing."}
          </p>
        </div>
      ) : null}

      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {exito ? <Aviso tono="exito">{exito}</Aviso> : null}

      {puedeEditar ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {estadoVerif !== "aprobada" ? (
              <Boton
                tamano="sm"
                variante="acento"
                icono="check"
                disabled={ocupado}
                onClick={() => void ejecutarDecision("aprobar")}
              >
                {ocupado ? "Procesando…" : "Aprobar y enviar boleto"}
              </Boton>
            ) : null}
            <Boton
              tamano="sm"
              disabled={ocupado}
              onClick={() => void ejecutarDecision("convertir_estudiante")}
            >
              Pasar a estudiante ($70)
            </Boton>
            {estadoVerif !== "rechazada" ? (
              <Boton
                tamano="sm"
                variante="peligro"
                disabled={ocupado}
                onClick={() => setRechazando((v) => !v)}
              >
                {rechazando ? "Cancelar rechazo" : "Rechazar…"}
              </Boton>
            ) : null}
          </div>

          {rechazando ? (
            <div className="ui-padron-box mt-1">
              <Campo
                etiqueta="Motivo (opcional, visible en el correo si notificas)"
                htmlFor={`motivo-rechazo-${registro._id}`}
              >
                <Entrada
                  id={`motivo-rechazo-${registro._id}`}
                  value={motivoRechazo}
                  maxLength={240}
                  placeholder="Ej. El pase sin costo aplica únicamente para Aliados Alpha."
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                />
              </Campo>
              <label className="flex items-center gap-2 text-[12px] text-[var(--fg-2)]">
                <input
                  type="checkbox"
                  checked={notificarRechazo}
                  onChange={(e) => setNotificarRechazo(e.target.checked)}
                />
                Enviar correo avisando que puede registrarse como estudiante
              </label>
              <div className="flex justify-end gap-2">
                <Boton
                  tamano="sm"
                  variante="peligro"
                  disabled={ocupado}
                  onClick={() => void ejecutarDecision("rechazar")}
                >
                  {ocupado ? "Rechazando…" : "Confirmar rechazo"}
                </Boton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FormularioAsistenteEnPuerta({
  eventId,
  conTipos,
  alListo,
  alCerrar,
}: {
  eventId: Id<"events">;
  conTipos: boolean;
  alListo: (mensaje: string) => void;
  alCerrar: () => void;
}) {
  const registrar = useMutation(api.eventos.registrarAsistenteEnPuerta);
  const [tipo, setTipo] = useState<TipoAsistente>("estudiante");
  const [datos, setDatos] = useState({
    nombre: "",
    matricula: "",
    correo: "",
    semestre: "",
    carrera: "",
  });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizar = (campo: keyof typeof datos, valor: string) => {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
  };

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      const resultado = await registrar({
        eventId,
        ...datos,
        ...(conTipos ? { tipo } : {}),
      });
      alListo(
        resultado.creado
          ? "Persona registrada y marcada como asistió."
          : "La persona ya estaba registrada; se marcó como asistió.",
      );
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : "No se pudo registrar a la persona.");
      setOcupado(false);
    }
  };

  return (
    <div className="ui-modal-bg evento-asistencia-modal" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="asistente-puerta-titulo"
        className="ui-dialog evento-asistencia-dialog"
        onSubmit={(e) => void guardar(e)}
      >
        <div className="ui-card-h evento-asistencia-dialog-head">
          <div>
            <h2 id="asistente-puerta-titulo" className="ui-h2">Registrar asistencia</h2>
            <p className="ui-faint mt-1 text-[12.5px]">Todos los campos son opcionales.</p>
          </div>
          <Boton
            tamano="sm"
            variante="fantasma"
            soloIcono
            icono="cerrar"
            etiqueta="Cerrar registro rápido"
            onClick={alCerrar}
            disabled={ocupado}
          />
        </div>
        <div className="grid gap-4 pt-5 sm:grid-cols-2">
          {conTipos ? (
            <div className="sm:col-span-2">
              <Campo etiqueta="Tipo de acceso / gafete" htmlFor="puerta-tipo">
                <Seleccion
                  id="puerta-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoAsistente)}
                >
                  {TIPOS_ASISTENTE.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {GAFETES_NETWORKING_NIGHT[opcion].etiqueta} — {`Gafete ${GAFETES_NETWORKING_NIGHT[opcion].nombre}`}
                    </option>
                  ))}
                </Seleccion>
              </Campo>
            </div>
          ) : null}
          <Campo etiqueta="Nombre" htmlFor="puerta-nombre">
            <Entrada
              id="puerta-nombre"
              value={datos.nombre}
              maxLength={80}
              autoComplete="name"
              autoFocus
              onChange={(e) => actualizar("nombre", e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Matrícula" htmlFor="puerta-matricula">
            <Entrada
              id="puerta-matricula"
              value={datos.matricula}
              maxLength={12}
              autoCapitalize="characters"
              onChange={(e) => actualizar("matricula", e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="puerta-correo">
            <Entrada
              id="puerta-correo"
              type="email"
              value={datos.correo}
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              onChange={(e) => actualizar("correo", e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Semestre / Generación" htmlFor="puerta-semestre">
            <Entrada
              id="puerta-semestre"
              value={datos.semestre}
              maxLength={30}
              onChange={(e) => actualizar("semestre", e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Carrera" htmlFor="puerta-carrera">
            <Entrada
              id="puerta-carrera"
              value={datos.carrera}
              maxLength={80}
              onChange={(e) => actualizar("carrera", e.target.value)}
            />
          </Campo>
        </div>
        {error ? (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Boton onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="acento" icono="check" disabled={ocupado}>
            {ocupado ? "Registrando…" : "Registrar asistencia"}
          </Boton>
        </div>
      </form>
    </div>
  );
}

function InformacionFechaEvento({ evento }: { evento: EventoLista }) {
  const fechaLegible = evento.fechaEvento
    ? fechaEventoEnEspanol(evento.fechaEvento)
    : "Fecha por definir";
  const horarioLegible = evento.horaInicio
    ? horarioEvento(evento.horaInicio, evento.horaFin)
    : "Hora por definir";

  return (
    <div className="evento-fecha-info">
      <Icono nombre="eventos" tamano={17} />
      <span className="evento-fecha-copy">
        <strong>{fechaLegible}</strong>
        <small>{horarioLegible}</small>
      </span>
    </div>
  );
}

function FormularioEvento({
  evento,
  alListo,
  alCerrar,
  alEliminar,
}: {
  evento?: EventoLista;
  alListo: (id: Id<"events">) => void;
  alCerrar: () => void;
  alEliminar?: () => void;
}) {
  const crear = useMutation(api.eventos.crear);
  const actualizar = useMutation(api.eventos.actualizar);
  const eliminar = useMutation(api.eventos.eliminar);
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [resumen, setResumen] = useState(evento?.resumen ?? "");
  const [pilar, setPilar] = useState<Pilar>(evento?.pilar ?? "desarrollo");
  const [estado, setEstado] = useState<EstadoEvento>(evento?.estado ?? "borrador");
  const [fechaEvento, setFechaEvento] = useState(evento?.fechaEvento ?? "");
  const [horaInicio, setHoraInicio] = useState(evento?.horaInicio ?? "");
  const [horaFin, setHoraFin] = useState(evento?.horaFin ?? "");
  const [sede, setSede] = useState(evento?.sede ?? "");
  const [maxEquipos, setMaxEquipos] = useState(evento?.maxEquipos ?? MAX_EQUIPOS_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const temporizadorConfirmacion = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (temporizadorConfirmacion.current) {
        clearTimeout(temporizadorConfirmacion.current);
      }
    };
  }, []);

  const manejarEliminar = async () => {
    if (!evento || ocupado || eliminando) return;
    if (!confirmandoEliminar) {
      setConfirmandoEliminar(true);
      if (temporizadorConfirmacion.current) {
        clearTimeout(temporizadorConfirmacion.current);
      }
      temporizadorConfirmacion.current = setTimeout(() => {
        setConfirmandoEliminar(false);
      }, 5000);
      return;
    }

    if (temporizadorConfirmacion.current) {
      clearTimeout(temporizadorConfirmacion.current);
    }
    setEliminando(true);
    setError(null);
    try {
      await eliminar({ id: evento._id });
      alEliminar?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el evento.");
      setEliminando(false);
      setConfirmandoEliminar(false);
    }
  };

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const detalles = {
        ...(fechaEvento ? { fechaEvento } : {}),
        ...(horaInicio ? { horaInicio } : {}),
        ...(horaFin ? { horaFin } : {}),
        ...(sede ? { sede } : {}),
      };
      if (evento) {
        await actualizar({ id: evento._id, titulo, resumen, pilar, estado, ...detalles, ...(evento.slug === "mario-kart" ? { maxEquipos } : {}) });
        alListo(evento._id);
      } else {
        const id = await crear({ titulo, resumen, pilar, ...detalles });
        alListo(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="ui-modal-bg" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="evento-form-titulo" className="ui-dialog">
        <h2 id="evento-form-titulo" className="ui-h2">
          {evento ? "Editar evento" : "Nuevo evento"}
        </h2>
        <div className="mt-5 grid gap-4">
          <Campo etiqueta="Título" htmlFor="ev-titulo">
            <Entrada id="ev-titulo" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Resumen" htmlFor="ev-resumen">
            <AreaTexto id="ev-resumen" value={resumen} maxLength={400} onChange={(e) => setResumen(e.target.value)} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Fecha" htmlFor="ev-fecha">
              <Entrada id="ev-fecha" type="date" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} />
            </Campo>
            <Campo etiqueta="Inicio" htmlFor="ev-inicio">
              <Entrada id="ev-inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </Campo>
            <Campo etiqueta="Fin" htmlFor="ev-fin">
              <Entrada id="ev-fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </Campo>
          </div>
          <Campo
            etiqueta="Sede"
            htmlFor="ev-sede"
            ayuda="La fecha, la hora y la sede alimentan el recordatorio automático."
          >
            <Entrada id="ev-sede" value={sede} maxLength={160} onChange={(e) => setSede(e.target.value)} placeholder="Ej. SUM 1102, Tec CCM" />
          </Campo>
          {evento?.slug === "mario-kart" ? <Campo etiqueta="Límite de equipos" htmlFor="ev-equipos" ayuda="Cada equipo tiene 4 integrantes. No puede ser menor al número de equipos creados."><Entrada id="ev-equipos" type="number" min={1} max={32} step={1} value={maxEquipos} onChange={e => setMaxEquipos(Number(e.target.value))} /></Campo> : null}
          <Campo etiqueta="Pilar" htmlFor="ev-pilar">
            <Seleccion id="ev-pilar" value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)}>
              {PILARES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS[opcion]}
                </option>
              ))}
            </Seleccion>
          </Campo>
          {evento ? (
            <Campo etiqueta="Estado" htmlFor="ev-estado">
              <Seleccion id="ev-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoEvento)}>
                {ESTADOS_EVENTO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETAS[opcion]}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          ) : (
            <p className="ui-help">Se crea como borrador, con el registro cerrado.</p>
          )}
        </div>
        {error ? (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {evento ? (
            <Boton
              variante="peligro"
              icono={confirmandoEliminar ? "alerta" : "papelera"}
              disabled={ocupado || eliminando}
              onClick={() => void manejarEliminar()}
            >
              {eliminando
                ? "Eliminando…"
                : confirmandoEliminar
                  ? "¿Confirmar eliminación?"
                  : "Eliminar evento"}
            </Boton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Boton onClick={alCerrar} disabled={ocupado || eliminando}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              onClick={() => void guardar()}
              disabled={ocupado || eliminando || titulo.trim().length < 3}
            >
              {ocupado ? "Guardando…" : evento ? "Guardar" : "Crear evento"}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

type Formato = "xlsx" | "csv";
const ENCABEZADOS = [
  "Nombre",
  "Correo",
  "Carrera",
  "Semestre",
  "Matrícula",
  "Correo autorizado",
  "WhatsApp",
  "Teléfono",
  "Estado",
  "Notas",
  "Registrado",
];
const ENCABEZADOS_PERFIL = [
  "Tipo",
  "Gafete",
  "Verificación",
  "Área / Generación",
  "Empresa",
  "Puesto",
  "LinkedIn",
  "Intereses",
  "Habilidades",
  "CV",
  "Pago",
  "Método de pago",
  "Monto MXN",
  "Pagado en",
];

function BotonExportar({
  evento,
  estado,
  conPerfil,
}: {
  evento: EventoLista;
  estado: EstadoAsistente | "";
  conPerfil: boolean;
}) {
  const [pedido, setPedido] = useState<{ formato: Formato; id: number } | null>(null);
  const filas = useQuery(
    api.eventos.paraExportar,
    pedido ? { eventId: evento._id, ...(estado ? { estado } : {}) } : "skip",
  );
  const anotar = useMutation(api.eventos.registrarExportacion);
  const secuencia = useRef(0);
  const procesado = useRef(0);

  useEffect(() => {
    if (!pedido || filas === undefined || procesado.current === pedido.id) return;
    procesado.current = pedido.id;
    const incluyeEquipo =
      evento.slug === "mario-kart" || filas.some((r) => Boolean(r.equipoNombre));
    const datos = filas.map((r) => {
      const tipo = r.tipoAsistente ?? "estudiante";
      const gafete = GAFETES_NETWORKING_NIGHT[tipo];
      const areaOGen =
        r.detalleTipo?.tipo === "aliado"
          ? ETIQUETAS_AREAS_ALIADO[r.detalleTipo.area] ?? r.detalleTipo.area
          : r.detalleTipo?.tipo === "exatec"
            ? r.detalleTipo.generacion
            : "";
      const exatecDet = r.detalleTipo?.tipo === "exatec" ? r.detalleTipo : null;
      return [
        r.nombre,
        ...(incluyeEquipo ? [r.equipoNombre ?? ""] : []),
        r.correo,
        r.carrera,
        r.semestre,
        r.matricula ?? "",
        r.canales.correo ? "Sí" : "No",
        r.canales.whatsapp ? "Sí" : "No",
        r.telefono ?? "",
        ETIQUETAS[r.estado] ?? r.estado,
        r.notas ?? "",
        formatearFechaHoraExcel(r.creadoEn),
        ...(conPerfil
          ? [
              gafete.etiqueta,
              `Gafete ${gafete.nombre}`,
              r.verificacion ? ETIQUETAS[r.verificacion.estado] ?? r.verificacion.estado : "Verificado",
              areaOGen,
              exatecDet?.empresa ?? "",
              exatecDet?.puesto ?? "",
              exatecDet?.linkedin ?? "",
              r.perfil?.intereses.join(", ") ?? "",
              r.perfil?.habilidades.join(", ") ?? "",
              r.perfil?.cvStorageId ? "Sí" : "No",
              r.pago
                ? r.pago.estado === "pagado"
                  ? "Pagado"
                  : "Pendiente"
                : tipo !== "estudiante"
                  ? "Cortesía"
                  : "",
              r.pago ? (r.pago.metodo === "stripe" ? "En línea" : "Efectivo") : tipo !== "estudiante" ? "Cortesía" : "",
              r.pago ? r.pago.montoMxn : tipo !== "estudiante" ? 0 : "",
              r.pago?.pagadoEn ? formatearFechaHoraExcel(r.pago.pagadoEn) : "",
            ]
          : []),
      ];
    });
    const baseEncabezados = incluyeEquipo
      ? [ENCABEZADOS[0]!, "Equipo", ...ENCABEZADOS.slice(1)]
      : ENCABEZADOS;
    const encabezados = conPerfil ? [...baseEncabezados, ...ENCABEZADOS_PERFIL] : baseEncabezados;

    const asistieron = filas.filter((r) => r.estado === "asistio").length;
    const activos = filas.filter(
      (r) =>
        r.estado === "registrado" ||
        r.estado === "confirmado" ||
        r.estado === "contactado",
    ).length;
    const bajas = filas.filter((r) => r.estado === "cancelado").length;
    const recaudadoMxn = filas.reduce(
      (acc, r) =>
        r.pago && r.pago.estado === "pagado" && r.estado !== "cancelado"
          ? acc + r.pago.montoMxn
          : acc,
      0,
    );

    const detallesSubtitulo = [
      evento.fechaEvento ? fechaEventoEnEspanol(evento.fechaEvento) : "Fecha por definir",
      evento.horaInicio ? horarioEvento(evento.horaInicio, evento.horaFin) : null,
      evento.sede?.trim() ? evento.sede.trim() : null,
      `Pilar: ${ETIQUETAS[evento.pilar] ?? evento.pilar}`,
    ]
      .filter(Boolean)
      .join("   ·   ");

    const resumen = [
      { etiqueta: "Total exportados", valor: filas.length },
      { etiqueta: "Asistieron", valor: asistieron },
      { etiqueta: "Registrados", valor: activos },
      ...(bajas > 0 ? [{ etiqueta: "Cancelados / No asistió", valor: bajas }] : []),
      ...(conPerfil ? [{ etiqueta: "Recaudado", valor: `$${recaudadoMxn} MXN` }] : []),
    ];

    const blob =
      pedido.formato === "xlsx"
        ? construirXlsx(encabezados, datos, {
            nombreHoja: evento.titulo,
            titulo: `${evento.titulo} — Registro de asistentes`,
            subtitulo: detallesSubtitulo,
            meta: estado
              ? `Filtro: ${ETIQUETAS[estado] ?? estado}`
              : "Filtro: Todos los estados",
            resumen,
          })
        : new Blob([construirCsv(encabezados, datos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${evento.slug}-registros-${new Date().toISOString().slice(0, 10)}.${pedido.formato}`;
    enlace.click();
    URL.revokeObjectURL(url);
    void anotar({ eventId: evento._id, cantidad: filas.length });
  }, [pedido, filas, anotar, evento, estado, conPerfil]);

  return (
    <Menu
      disparador={() => (
        <Boton icono="descargar" disabled={pedido !== null && filas === undefined}>
          {pedido !== null && filas === undefined ? "Exportando…" : "Exportar"}
        </Boton>
      )}
    >
      <MenuItem icono="descargar" onClick={() => { secuencia.current += 1; setPedido({ formato: "xlsx", id: secuencia.current }); }}>
        Excel (.xlsx)
      </MenuItem>
      <MenuItem icono="archivo" onClick={() => { secuencia.current += 1; setPedido({ formato: "csv", id: secuencia.current }); }}>
        CSV (.csv)
      </MenuItem>
    </Menu>
  );
}
