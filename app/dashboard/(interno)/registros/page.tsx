"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  AREAS,
  ESTADOS_REGISTRO,
  ETIQUETAS,
  TIPOS_REGISTRO,
  type Area,
  type EstadoRegistro,
  type TipoRegistro,
} from "@/convex/lib/validadores";
import { construirCsv } from "@/lib/csv";
import { construirXlsx } from "@/lib/xlsx";
import { Aviso, Bandeja, Cargando, Marca, Titulo, Vacio, fecha } from "@/components/panel/piezas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

/**
 * Registros.
 *
 * La tabla no lleva rejilla ni franjas alternas: solo filetes horizontales y
 * un indice en cifra monoespaciada, igual que el indice de programas de la
 * landing. Es la pantalla que mas se mira, y esa quietud ayuda a leerla.
 */
export default function Registros() {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro | "">("");
  const [estado, setEstado] = useState<EstadoRegistro | "">("");
  const [abierto, setAbierto] = useState<Id<"registrations"> | null>(null);

  const yo = useQuery(api.usuarios.yo, {});
  const datos = useQuery(api.registros.listar, {
    ...(busqueda ? { busqueda } : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
  });

  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-0 sm:gap-6">
        <Titulo cejilla="Convocatoria">Registros</Titulo>
        {yo?.rol === "admin" ? <BotonExportar tipo={tipo} estado={estado} /> : null}
      </div>

      <CuposAliados puedeEditar={puedeEditar} />

      {/* Filtros */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] mb-6">
        <div className="campo">
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            className="entrada"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, correo, carrera o semestre"
            autoComplete="off"
          />
        </div>
        <div className="campo">
          <label htmlFor="f-tipo">Tipo</label>
          <SelectorPersonalizado
            id="f-tipo"
            valor={tipo}
            opciones={[
              { valor: "", etiqueta: "Todos" },
              ...TIPOS_REGISTRO.map((opcion) => ({
                valor: opcion,
                etiqueta: ETIQUETAS[opcion] ?? opcion,
              })),
            ]}
            alCambiar={(opcion) => setTipo(opcion as TipoRegistro | "")}
          />
        </div>
        <div className="campo">
          <label htmlFor="f-estado">Estado</label>
          <SelectorPersonalizado
            id="f-estado"
            valor={estado}
            opciones={[
              { valor: "", etiqueta: "Todos" },
              ...ESTADOS_REGISTRO.map((opcion) => ({
                valor: opcion,
                etiqueta: ETIQUETAS[opcion] ?? opcion,
              })),
            ]}
            alCambiar={(opcion) => setEstado(opcion as EstadoRegistro | "")}
          />
        </div>
      </div>

      <Bandeja>
        {datos === undefined ? (
          <Cargando que="los registros" />
        ) : datos.page.length === 0 ? (
          <Vacio
            titulo="Sin registros que mostrar"
            ayuda={
              busqueda || tipo || estado
                ? "Ningun registro coincide con estos filtros. Prueba a quitarlos."
                : "Cuando alguien se registre desde la landing, aparecera aqui."
            }
          />
        ) : (
          <div className="px-5 sm:px-7 py-2">
            <ul>
              {datos.page.map((r, i) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === r._id ? null : r._id)}
                    aria-expanded={abierto === r._id}
                    className="fila w-full text-left grid grid-cols-[32px_1fr_auto] sm:grid-cols-[32px_1fr_140px_130px] gap-x-4 gap-y-1 py-4 items-center"
                  >
                    <span className="cifra text-[11px] text-[var(--color-n500)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium truncate">{r.nombre}</span>
                      <span className="mt-1 flex min-w-0 items-center gap-2">
                        <span className="registro-tipo-movil sm:hidden">{ETIQUETAS[r.tipo]}</span>
                        <span className="cifra min-w-0 truncate text-[11px] text-[var(--color-n600)]">
                          {r.correo}
                        </span>
                      </span>
                    </span>
                    <span className="hidden sm:block text-[12px] text-[var(--color-n700)] truncate">
                      {ETIQUETAS[r.tipo]}
                    </span>
                    <span className="justify-self-end sm:justify-self-start">
                      <Marca estado={r.estado} />
                    </span>
                  </button>
                  {abierto === r._id ? (
                    <Ficha registro={r} puedeEditar={puedeEditar} />
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="py-4 text-[11px] text-[var(--color-n600)]">
              {datos.page.length} en pantalla
              {datos.isDone ? "" : " · hay mas registros; afina los filtros para verlos"}
            </p>
          </div>
        )}
      </Bandeja>
    </>
  );
}

function CuposAliados({ puedeEditar }: { puedeEditar: boolean }) {
  const areasCerradas = useQuery(api.registros.areasCerradasPublicas, {});
  const cambiarCupo = useMutation(api.registros.cambiarCupoArea);
  const [cambiando, setCambiando] = useState<Area | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);

  const alternar = async (area: Area, lleno: boolean) => {
    setCambiando(area);
    setMensaje(null);
    try {
      await cambiarCupo({ area, lleno: !lleno });
      setMensaje({
        tono: "exito",
        texto: lleno
          ? `${ETIQUETAS[area]} vuelve a aceptar registros.`
          : `${ETIQUETAS[area]} ahora aparece como Cupo lleno.`,
      });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudo cambiar el cupo del área." });
    } finally {
      setCambiando(null);
    }
  };

  return (
    <section className="mb-6" aria-labelledby="cupos-aliados-titulo">
      <Bandeja>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="rotulo">Aliados</p>
              <h2 id="cupos-aliados-titulo" className="mt-2 text-[18px] font-semibold tracking-[-.02em]">
                Cupos por área
              </h2>
              <p className="mt-2 max-w-2xl text-[12px] font-light leading-6 text-[var(--color-n600)]">
                Cierra un área cuando ya no pueda recibir aliados. En la landing aparecerá como Cupo lleno.
              </p>
            </div>
            <span className="text-[11px] text-[var(--color-n600)]">
              {areasCerradas === undefined
                ? "Consultando cupos..."
                : `${areasCerradas.length} de ${AREAS.length} cerradas`}
            </span>
          </div>

          {areasCerradas === undefined ? (
            <div className="mt-5 h-[2px] overflow-hidden bg-[var(--hair-2)]">
              <div className="h-full w-1/3 animate-pulse bg-[var(--color-accent)]" />
            </div>
          ) : (
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {AREAS.map((area) => {
                const lleno = areasCerradas.includes(area);
                const guardando = cambiando === area;
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={lleno}
                    disabled={!puedeEditar || cambiando !== null}
                    onClick={() => void alternar(area, lleno)}
                    className={`flex min-h-[76px] items-center justify-between gap-4 border px-4 py-3 text-left transition-colors ${
                      lleno
                        ? "border-[rgba(180,35,42,.25)] bg-[rgba(180,35,42,.04)]"
                        : "border-[var(--hair-2)] bg-white"
                    } ${puedeEditar ? "hover:border-[var(--color-accent)]" : "cursor-default"}`}
                  >
                    <span>
                      <span className="block text-[12px] font-medium text-[var(--color-n900)]">
                        {ETIQUETAS[area] ?? area}
                      </span>
                      <span
                        className="mt-1.5 block text-[10px] uppercase tracking-[.15em]"
                        style={{ color: lleno ? "var(--color-baja)" : "var(--color-activo)" }}
                      >
                        {lleno ? "Cupo lleno" : "Disponible"}
                      </span>
                    </span>
                    {puedeEditar ? (
                      <span className="text-right text-[10px] font-medium uppercase tracking-[.12em] text-[var(--color-accent)]">
                        {guardando ? "Guardando..." : lleno ? "Reabrir" : "Cerrar cupo"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {mensaje ? (
            <div className="mt-4">
              <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
            </div>
          ) : null}
        </div>
      </Bandeja>
    </section>
  );
}

/** Detalle desplegable. Vive bajo la fila para no tapar la lista. */
function Ficha({
  registro,
  puedeEditar,
}: {
  registro: Doc<"registrations">;
  puedeEditar: boolean;
}) {
  const cambiarEstado = useMutation(api.registros.cambiarEstado);
  const cambiarTipo = useMutation(api.registros.cambiarTipo);
  const guardarNotas = useMutation(api.registros.guardarNotas);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoTipo, setCambiandoTipo] = useState(false);

  const alGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardarNotas({ id: registro._id, notas });
      setMensaje({ tono: "exito", texto: "Notas guardadas." });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudieron guardar las notas." });
    } finally {
      setGuardando(false);
    }
  };

  const alCambiarEstado = async (nuevo: EstadoRegistro) => {
    setMensaje(null);
    try {
      await cambiarEstado({ id: registro._id, estado: nuevo });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudo cambiar el estado." });
    }
  };

  const alCambiarTipo = async () => {
    const nuevo = registro.tipo === "miembro" ? "aliado" : "miembro";
    setCambiandoTipo(true);
    setMensaje(null);
    try {
      await cambiarTipo({ id: registro._id, tipo: nuevo });
    } catch {
      setMensaje({ tono: "error", texto: "No se pudo cambiar el tipo de registro." });
    } finally {
      setCambiandoTipo(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] px-5 sm:px-7 py-7 mb-1 grid gap-7 lg:grid-cols-2">
      <dl className="grid gap-4 text-[13px]">
        <Dato titulo="Carrera" valor={registro.carrera} />
        <Dato titulo="Semestre" valor={registro.semestre ?? "—"} />
        <Dato titulo="Matricula" valor={registro.matricula ?? "—"} mono />
        <Dato titulo="Registrado" valor={fecha(registro.creadoEn)} />
        {registro.tipo === "miembro" ? (
          <>
            <Dato
              titulo="Avisos por correo"
              valor={registro.canales.correo ? "Si" : "No"}
            />
            <Dato
              titulo="Grupo de WhatsApp"
              valor={
                registro.canales.whatsapp
                  ? registro.telefono
                    ? registro.telefono
                    : "Si, sin numero"
                  : "No"
              }
              mono={Boolean(registro.telefono)}
            />
          </>
        ) : (
          <>
            <Dato
              titulo="Teléfono"
              valor={registro.telefono ?? "—"}
              mono={Boolean(registro.telefono)}
            />
            <Dato
              titulo="Areas"
              valor={
                registro.areas.length > 0
                  ? registro.areas.map((a) => ETIQUETAS[a] ?? a).join(", ")
                  : "Sin marcar"
              }
            />
            <Dato titulo="Que quiere aportar" valor={registro.aporte ?? "—"} />
          </>
        )}
        {puedeEditar ? <AccionesContacto registro={registro} /> : null}
      </dl>

      <div>
        {puedeEditar ? (
          <>
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--hair)] pb-3">
              <span className="text-[12px] text-[var(--color-n700)]">
                {ETIQUETAS[registro.tipo]}
              </span>
              <button
                type="button"
                className="text-[10px] font-medium uppercase tracking-[.1em] text-[var(--color-accent)] underline decoration-[var(--hair)] underline-offset-4 transition-colors hover:decoration-[var(--color-accent)] disabled:cursor-wait disabled:opacity-50"
                onClick={() => void alCambiarTipo()}
                disabled={cambiandoTipo}
              >
                {cambiandoTipo
                  ? "Cambiando…"
                  : `Cambiar a ${registro.tipo === "miembro" ? "aliado" : "miembro"}`}
              </button>
            </div>

            <div className="campo">
              <label htmlFor={`estado-${registro._id}`}>Estado</label>
              <SelectorPersonalizado
                id={`estado-${registro._id}`}
                valor={registro.estado}
                opciones={ESTADOS_REGISTRO.map((opcion) => ({
                  valor: opcion,
                  etiqueta: ETIQUETAS[opcion] ?? opcion,
                }))}
                alCambiar={(opcion) => void alCambiarEstado(opcion as EstadoRegistro)}
              />
            </div>

            <div className="campo mt-6">
              <label htmlFor={`notas-${registro._id}`}>Notas internas</label>
              <textarea
                id={`notas-${registro._id}`}
                className="entrada resize-y min-h-[90px]"
                value={notas}
                maxLength={2000}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Que se acordo, quien la contacto, que sigue."
              />
            </div>

            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <button
                type="button"
                className="boton"
                onClick={() => void alGuardar()}
                disabled={guardando || notas === (registro.notas ?? "")}
              >
                {guardando ? "Guardando…" : "Guardar notas"}
              </button>
              {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
            </div>
          </>
        ) : (
          <>
            <p className="rotulo">Notas internas</p>
            <p className="mt-3 text-[13px] font-light leading-[1.7] whitespace-pre-wrap">
              {registro.notas ? registro.notas : "Sin notas."}
            </p>
            <p className="mt-6 text-[11px] text-[var(--color-n600)]">
              Tu rol es de lectura: puedes consultar, no modificar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function AccionesContacto({ registro }: { registro: Doc<"registrations"> }) {
  const telefono = registro.telefono?.replace(/\D/g, "") ?? "";
  const numero = telefono.length === 10 ? `52${telefono}` : telefono;
  const mensaje = `¡Hola, ${registro.nombre}! Te damos la bienvenida a Alpha. Gracias por registrarte. Al equipo de Alpha le gustaría tener una entrevista contigo para conocerte mejor.`;
  const clase =
    "inline-flex min-h-9 items-center gap-2 border-b border-[var(--hair)] px-0.5 text-[10px] font-medium uppercase tracking-[.12em] text-[var(--color-n700)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

  return (
    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--hair)] pt-4">
      {numero ? (
        <a
          className={clase}
          href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Escribir a ${registro.nombre} por WhatsApp`}
        >
          <IconoWhatsapp />
          WhatsApp
        </a>
      ) : (
        <span
          className={`${clase} cursor-not-allowed opacity-35 hover:border-[var(--hair)] hover:text-[var(--color-n700)]`}
          aria-disabled="true"
          title="Sin número registrado"
        >
          <IconoWhatsapp />
          WhatsApp
        </span>
      )}
      <a
        className={clase}
        href={`/dashboard/correo?para=${encodeURIComponent(registro.correo)}`}
        aria-label={`Escribir a ${registro.nombre} por correo`}
      >
        <IconoCorreo />
        Correo
      </a>
    </div>
  );
}

function IconoWhatsapp() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-[15px] fill-none stroke-current stroke-[1.35]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.3 9.7a6.3 6.3 0 0 1-9.4 5.5L3.5 16l.9-3.2A6.3 6.3 0 1 1 16.3 9.7Z" />
      <path d="M7.1 6.7c.4 2.9 1.8 4.3 4.7 5 .4.1 1-.7 1.3-1.1M7.1 6.7c.2-.4.5-.8.8-.8M7.1 6.7c-.3.3-.5.7-.5 1.1" />
    </svg>
  );
}

function IconoCorreo() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-[15px] fill-none stroke-current stroke-[1.35]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5.25h14v9.5H3z" />
      <path d="m3.5 6 6.5 5 6.5-5" />
    </svg>
  );
}

function Dato({ titulo, valor, mono = false }: { titulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="rotulo">{titulo}</dt>
      <dd className={`mt-1.5 ${mono ? "cifra" : ""} leading-[1.6] whitespace-pre-wrap`}>{valor}</dd>
    </div>
  );
}

type FormatoExportacion = "xlsx" | "csv";

const ENCABEZADOS_EXPORTACION = [
  "Tipo",
  "Nombre",
  "Correo",
  "Carrera",
  "Semestre",
  "Matricula",
  "Avisos correo",
  "WhatsApp",
  "Telefono",
  "Areas",
  "Aporte",
  "Estado",
  "Notas",
  "Registrado",
] as const;

/** Exportacion a Excel o CSV. Solo admin, y queda anotada en la bitacora. */
function BotonExportar({ tipo, estado }: { tipo: TipoRegistro | ""; estado: EstadoRegistro | "" }) {
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState<{ formato: FormatoExportacion; id: number } | null>(null);
  const filas = useQuery(
    api.registros.paraExportar,
    pedido ? { ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) } : "skip",
  );
  const anotar = useMutation(api.registros.registrarExportacion);
  const secuencia = useRef(0);
  const procesado = useRef(0);
  const excelRef = useRef<HTMLButtonElement>(null);

  // La descarga es un efecto, no algo que ocurra al renderizar: en modo
  // estricto React renderiza dos veces y si no se bajaria el archivo dos veces.
  useEffect(() => {
    if (!pedido || filas === undefined || procesado.current === pedido.id) return;
    procesado.current = pedido.id;

    const datos = filas.map((r) => [
      ETIQUETAS[r.tipo] ?? r.tipo,
      r.nombre,
      r.correo,
      r.carrera,
      r.semestre ?? "",
      r.matricula ?? "",
      r.canales.correo ? "Si" : "No",
      r.canales.whatsapp ? "Si" : "No",
      r.telefono ?? "",
      r.areas.map((a) => ETIQUETAS[a] ?? a).join(" / "),
      r.aporte ?? "",
      ETIQUETAS[r.estado] ?? r.estado,
      r.notas ?? "",
      new Date(r.creadoEn).toISOString(),
    ]);
    const blob =
      pedido.formato === "xlsx"
        ? construirXlsx(ENCABEZADOS_EXPORTACION, datos)
        : new Blob([construirCsv(ENCABEZADOS_EXPORTACION, datos)], {
            type: "text/csv;charset=utf-8",
          });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alpha-registros-${new Date().toISOString().slice(0, 10)}.${pedido.formato}`;
    a.click();
    URL.revokeObjectURL(url);

    void anotar({ cantidad: filas.length });
  }, [pedido, filas, anotar]);

  const exportar = (formato: FormatoExportacion) => {
    secuencia.current += 1;
    setPedido({ formato, id: secuencia.current });
  };

  const cargando = pedido !== null && filas === undefined;

  return (
    <div
      className={`relative mb-6 h-11 overflow-hidden border border-[var(--hair)] bg-transparent transition-[width,background-color] duration-300 ease-[var(--E)] motion-reduce:transition-none sm:mb-8 sm:h-10 ${
        abierto ? "w-[152px] bg-[var(--color-surface)]" : "w-[108px]"
      }`}
    >
      <button
        type="button"
        className={`absolute inset-0 grid place-items-center text-[13px] font-medium transition-[opacity,transform] duration-200 ease-[var(--E)] motion-reduce:transition-none ${
          abierto ? "pointer-events-none -translate-y-1 opacity-0" : "translate-y-0 opacity-100"
        }`}
        aria-expanded={abierto}
        onClick={() => {
          setAbierto(true);
          requestAnimationFrame(() => excelRef.current?.focus());
        }}
      >
        Exportar
      </button>
      <div
        className={`absolute inset-0 grid grid-cols-2 transition-[opacity,transform] duration-200 ease-[var(--E)] motion-reduce:transition-none ${
          abierto ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
        }`}
        role="group"
        aria-label="Formato de exportacion"
      >
        <button
          ref={excelRef}
          type="button"
          className="border-r border-[var(--hair)] text-[11px] font-medium transition-colors duration-200 hover:bg-white disabled:opacity-45"
          disabled={cargando}
          onClick={() => exportar("xlsx")}
        >
          {cargando && pedido?.formato === "xlsx" ? "···" : "Excel"}
        </button>
        <button
          type="button"
          className="text-[11px] font-medium uppercase tracking-[.04em] transition-colors duration-200 hover:bg-white disabled:opacity-45"
          disabled={cargando}
          onClick={() => exportar("csv")}
        >
          {cargando && pedido?.formato === "csv" ? "···" : "CSV"}
        </button>
      </div>
    </div>
  );
}
