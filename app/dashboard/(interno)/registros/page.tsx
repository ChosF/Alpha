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
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  Menu,
  MenuItem,
  Pildora,
  Seleccion,
  TONO_ESTADO,
  Tarjeta,
  TarjetaCabecera,
  Vacio,
  fecha,
} from "@/components/panel/ui/primitivas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";
import { useCascaron } from "@/components/panel/ui/cascaron";

export default function Registros() {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro | "">("");
  const [estado, setEstado] = useState<EstadoRegistro | "">("");
  const [abierto, setAbierto] = useState<Id<"registrations"> | null>(null);
  const { yo } = useCascaron();
  const datos = useQuery(api.registros.listar, {
    ...(busqueda ? { busqueda } : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
  });
  const resumen = useQuery(api.metricas.resumen, {});
  const puedeEditar = yo?.rol === "admin" || yo?.rol === "editor";
  const seleccionado = datos?.page.find((r) => r._id === abierto) ?? null;

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

  return (
    <>
      <Encabezado
        titulo="Registros"
        descripcion="Convocatoria de miembros y aliados. El trabajo del día a día está en Eventos."
        acciones={yo?.rol === "admin" ? <BotonExportar tipo={tipo} estado={estado} /> : null}
      />

      <div className="ui-grid mb-5">
        <Tarjeta className="ui-stat sm-6 lg-3" indice={1}>
          <span className="ui-stat-label">Registros totales</span>
          <span className="ui-stat-value">{resumen?.total ?? "—"}</span>
          <span className="ui-stat-delta">Convocatoria general</span>
        </Tarjeta>
        <Tarjeta className="ui-stat sm-6 lg-3" indice={2}>
          <span className="ui-stat-label">Miembros</span>
          <span className="ui-stat-value">{resumen?.miembros ?? "—"}</span>
          <span className="ui-stat-delta">Comunidad LAF</span>
        </Tarjeta>
        <Tarjeta className="ui-stat sm-6 lg-3" indice={3}>
          <span className="ui-stat-label">Aliados</span>
          <span className="ui-stat-value">{resumen?.aliados ?? "—"}</span>
          <span className="ui-stat-delta">Apoyo por áreas</span>
        </Tarjeta>
        <Tarjeta className="ui-stat sm-6 lg-3" indice={4}>
          <span className="ui-stat-label">Sin contactar</span>
          <span className="ui-stat-value">{resumen?.porEstado.nuevo ?? "—"}</span>
          <span className="ui-stat-delta">Requieren seguimiento</span>
        </Tarjeta>
      </div>

      <div className="ui-filterbar">
        <Entrada
          icono="buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre, correo, carrera o semestre"
          autoComplete="off"
        />
        <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistro | "")} className="max-w-[160px]">
          <option value="">Todos los tipos</option>
          {TIPOS_REGISTRO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS[opcion]}
            </option>
          ))}
        </Seleccion>
        <Seleccion value={estado} onChange={(e) => setEstado(e.target.value as EstadoRegistro | "")} className="max-w-[180px]">
          <option value="">Todos los estados</option>
          {ESTADOS_REGISTRO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS[opcion]}
            </option>
          ))}
        </Seleccion>
      </div>

      <div className="ui-split" data-detail={seleccionado ? "open" : "closed"}>
        <Tarjeta>
          {datos === undefined ? (
            <Cargando que="los registros" />
          ) : datos.page.length === 0 ? (
            <Vacio
              titulo="Sin registros que mostrar"
              ayuda={
                busqueda || tipo || estado
                  ? "Ningún registro coincide con estos filtros."
                  : "Cuando alguien se registre desde la landing, aparecerá aquí."
              }
            />
          ) : (
            <>
              <div className="ui-table-wrap">
                <table className="ui-table ui-table-mobile ui-table-registros">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.page.map((r) => (
                      <tr
                        key={r._id}
                        data-selected={abierto === r._id ? "true" : undefined}
                        onClick={() => setAbierto(abierto === r._id ? null : r._id)}
                      >
                        <td className="font-medium">{r.nombre}</td>
                        <td className="ui-faint">{r.correo}</td>
                        <td>{ETIQUETAS[r.tipo]}</td>
                        <td>
                          <Pildora tono={TONO_ESTADO[r.estado] ?? "neutro"} sm>
                            {ETIQUETAS[r.estado]}
                          </Pildora>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ui-faint px-4 py-3 text-[12px]">
                {datos.page.length} en pantalla
                {datos.isDone ? "" : " · hay más; afina los filtros para verlos"}
              </p>
            </>
          )}
        </Tarjeta>
        {seleccionado ? (
          <Ficha registro={seleccionado} puedeEditar={puedeEditar} alCerrar={() => setAbierto(null)} />
        ) : null}
      </div>

      <CuposAliados puedeEditar={puedeEditar} />
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
    <Tarjeta className="mt-5">
      <TarjetaCabecera
        titulo="Cupos de aliados"
        descripcion="Cierra un área cuando ya no pueda recibir aliados. En la landing aparecerá como Cupo lleno."
      />
      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {AREAS.map((area) => {
          const lleno = areasCerradas?.includes(area) ?? false;
          return (
            <button
              key={area}
              type="button"
              aria-pressed={lleno}
              disabled={!puedeEditar || cambiando !== null || areasCerradas === undefined}
              onClick={() => void alternar(area, lleno)}
              className="ui-card flex items-center justify-between gap-3 p-3 text-left"
            >
              <span>
                <span className="block text-[13px] font-medium">{ETIQUETAS[area]}</span>
                <span className="ui-faint mt-1 block text-[12px]">{lleno ? "Cupo lleno" : "Disponible"}</span>
              </span>
              {puedeEditar ? (
                <span className="text-[11px] text-[var(--accent)]">
                  {cambiando === area ? "…" : lleno ? "Reabrir" : "Cerrar"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {mensaje ? (
        <div className="px-4 pb-4">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      ) : null}
    </Tarjeta>
  );
}

function Ficha({
  registro,
  puedeEditar,
  alCerrar,
}: {
  registro: Doc<"registrations">;
  puedeEditar: boolean;
  alCerrar: () => void;
}) {
  const cambiarEstado = useMutation(api.registros.cambiarEstado);
  const cambiarTipo = useMutation(api.registros.cambiarTipo);
  const guardarNotas = useMutation(api.registros.guardarNotas);
  const [notas, setNotas] = useState(registro.notas ?? "");
  const [mensaje, setMensaje] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const telefono = registro.telefono?.replace(/\D/g, "") ?? "";
  const numero = telefono.length === 10 ? `52${telefono}` : telefono;
  const whatsapp = `¡Hola, ${registro.nombre}! Te damos la bienvenida a Alpha. Gracias por registrarte. Al equipo de Alpha le gustaría tener una entrevista contigo para conocerte mejor.`;

  return (
    <>
      <button
        type="button"
        className="ui-registration-backdrop"
        aria-label={`Cerrar ficha de ${registro.nombre}`}
        onClick={alCerrar}
      />
      <aside className="ui-sheet ui-registration-sheet" aria-labelledby={`registro-${registro._id}-titulo`}>
        <span className="ui-registration-sheet-handle" aria-hidden="true" />
        <div className="ui-card-h ui-registration-sheet-head">
          <div className="min-w-0">
            <h3 id={`registro-${registro._id}-titulo`} className="ui-h2 truncate">
              {registro.nombre}
            </h3>
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
        <dl className="ui-dl p-5">
          <dt>Carrera</dt>
          <dd>{registro.carrera}</dd>
          <dt>Semestre</dt>
          <dd>{registro.semestre ?? "—"}</dd>
          <dt>Matrícula</dt>
          <dd>{registro.matricula ?? "—"}</dd>
          <dt>Registrado</dt>
          <dd>{fecha(registro.creadoEn)}</dd>
          {registro.tipo === "miembro" ? (
            <>
              <dt>Correo</dt>
              <dd>{registro.canales.correo ? "Sí" : "No"}</dd>
              <dt>WhatsApp</dt>
              <dd>{registro.canales.whatsapp ? registro.telefono ?? "Sí" : "No"}</dd>
            </>
          ) : (
            <>
              <dt>Teléfono</dt>
              <dd>{registro.telefono ?? "—"}</dd>
              <dt>Áreas</dt>
              <dd>{registro.areas.length ? registro.areas.map((a) => ETIQUETAS[a]).join(", ") : "Sin marcar"}</dd>
              <dt>Aporte</dt>
              <dd>{registro.aporte ?? "—"}</dd>
            </>
          )}
        </dl>
        {puedeEditar ? (
          <div className="ui-registration-actions grid gap-4 border-t border-[var(--line)] p-5">
            <div className="ui-registration-quick-actions">
              {numero ? (
                <a
                  className="ui-btn ui-btn-sm"
                  href={`https://wa.me/${numero}?text=${encodeURIComponent(whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              ) : null}
              <a className="ui-btn ui-btn-sm" href={`/dashboard/correo?para=${encodeURIComponent(registro.correo)}`}>
                Correo
              </a>
              <Boton
                tamano="sm"
                onClick={() =>
                  void cambiarTipo({ id: registro._id, tipo: registro.tipo === "miembro" ? "aliado" : "miembro" })
                }
              >
                Cambiar a {registro.tipo === "miembro" ? "aliado" : "miembro"}
              </Boton>
            </div>
            <Campo etiqueta="Estado" htmlFor={`estado-${registro._id}`}>
              <SelectorPersonalizado
                id={`estado-${registro._id}`}
                valor={registro.estado}
                opciones={ESTADOS_REGISTRO.map((opcion) => ({ valor: opcion, etiqueta: ETIQUETAS[opcion] ?? opcion }))}
                alCambiar={(opcion) => void cambiarEstado({ id: registro._id, estado: opcion as EstadoRegistro })}
              />
            </Campo>
            <Campo etiqueta="Notas internas" htmlFor={`notas-${registro._id}`}>
              <AreaTexto
                id={`notas-${registro._id}`}
                value={notas}
                maxLength={2000}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Qué se acordó, quién contactó, qué sigue."
              />
            </Campo>
            <div className="flex flex-wrap items-center gap-3">
              <Boton
                variante="primario"
                disabled={guardando || notas === (registro.notas ?? "")}
                onClick={() => {
                  setGuardando(true);
                  void guardarNotas({ id: registro._id, notas })
                    .then(() => setMensaje({ tono: "exito", texto: "Notas guardadas." }))
                    .catch(() => setMensaje({ tono: "error", texto: "No se pudieron guardar las notas." }))
                    .finally(() => setGuardando(false));
                }}
              >
                {guardando ? "Guardando…" : "Guardar notas"}
              </Boton>
              {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
            </div>
          </div>
        ) : (
          <p className="ui-faint p-5 text-[12.5px]">{registro.notas || "Sin notas. Tu rol es de lectura."}</p>
        )}
      </aside>
    </>
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

function BotonExportar({ tipo, estado }: { tipo: TipoRegistro | ""; estado: EstadoRegistro | "" }) {
  const [pedido, setPedido] = useState<{ formato: FormatoExportacion; id: number } | null>(null);
  const filas = useQuery(
    api.registros.paraExportar,
    pedido ? { ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) } : "skip",
  );
  const anotar = useMutation(api.registros.registrarExportacion);
  const secuencia = useRef(0);
  const procesado = useRef(0);

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
        : new Blob([construirCsv(ENCABEZADOS_EXPORTACION, datos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alpha-registros-${new Date().toISOString().slice(0, 10)}.${pedido.formato}`;
    a.click();
    URL.revokeObjectURL(url);
    void anotar({ cantidad: filas.length });
  }, [pedido, filas, anotar]);

  return (
    <Menu
      disparador={() => (
        <Boton icono="descargar" disabled={pedido !== null && filas === undefined}>
          {pedido !== null && filas === undefined ? "Exportando…" : "Exportar"}
        </Boton>
      )}
    >
      <MenuItem
        icono="descargar"
        onClick={() => {
          secuencia.current += 1;
          setPedido({ formato: "xlsx", id: secuencia.current });
        }}
      >
        Excel
      </MenuItem>
      <MenuItem
        icono="archivo"
        onClick={() => {
          secuencia.current += 1;
          setPedido({ formato: "csv", id: secuencia.current });
        }}
      >
        CSV
      </MenuItem>
    </Menu>
  );
}
