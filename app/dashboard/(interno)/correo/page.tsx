"use client";

import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ESTADOS_HILO_CORREO,
  ETIQUETAS,
  type EstadoHiloCorreo,
} from "@/convex/lib/validadores";
import { Icono, type NombreIcono } from "@/components/panel/ui/iconos";
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  Pildora,
  Seleccion,
  TONO_ESTADO,
  Vacio,
  fechaHora,
  iniciales,
} from "@/components/panel/ui/primitivas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const FORMATO_ARCHIVO = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

type DetalleCorreo = NonNullable<FunctionReturnType<typeof api.correo.detalle>>;
type MensajeCorreo = DetalleCorreo["mensajes"][number];
type AdjuntoCorreo = MensajeCorreo["adjuntos"][number];
type SegmentoCorreo = NonNullable<MensajeCorreo["segmentos"]>[number];
type ContenidoEditor = { texto: string; segmentos: SegmentoCorreo[] };
type ArchivoSalida = {
  localId: string;
  borradorId?: Id<"mailAttachmentDrafts">;
  nombre: string;
  tipoContenido: string;
  tamano: number;
  estado: "subiendo" | "listo" | "error";
  error?: string;
};
type Carpeta = EstadoHiloCorreo | "todos";

const REMITENTE_PREDETERMINADO = "contacto@alphaccm.org";
const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ADJUNTOS_BYTES = 18 * 1024 * 1024;
const MAX_ADJUNTOS = 10;
const IMAGENES_PREVISUALIZABLES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CARPETAS: { id: Carpeta; texto: string; icono: NombreIcono; clave: "abiertos" | "todos" | "resueltos" | "spam" }[] = [
  { id: "abierto", texto: "Bandeja", icono: "bandeja", clave: "abiertos" },
  { id: "todos", texto: "Todos", icono: "correo", clave: "todos" },
  { id: "resuelto", texto: "Resueltos", icono: "check", clave: "resueltos" },
  { id: "spam", texto: "Spam", icono: "alerta", clave: "spam" },
];

function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${FORMATO_ARCHIVO.format(bytes / 1024)} KB`;
  return `${FORMATO_ARCHIVO.format(bytes / (1024 * 1024))} MB`;
}

function limpiarError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo completar la operacion.";
  const marca = error.message.lastIndexOf("Error: ");
  return (marca === -1 ? error.message : error.message.slice(marca + 7)).split("\n")[0] ?? error.message;
}

function agregarSegmento(segmentos: SegmentoCorreo[], texto: string, negrita: boolean, cursiva: boolean) {
  if (!texto) return;
  const anterior = segmentos.at(-1);
  if (anterior && anterior.negrita === negrita && anterior.cursiva === cursiva) {
    anterior.texto += texto;
  } else {
    segmentos.push({ texto, negrita, cursiva });
  }
}

function contenidoDesdeEditor(editor: HTMLElement): ContenidoEditor {
  const segmentos: SegmentoCorreo[] = [];
  const bloques = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "BLOCKQUOTE"]);

  const recorrer = (nodo: Node, negrita: boolean, cursiva: boolean) => {
    if (nodo.nodeType === Node.TEXT_NODE) {
      agregarSegmento(segmentos, nodo.textContent ?? "", negrita, cursiva);
      return;
    }
    if (!(nodo instanceof HTMLElement)) return;
    const etiqueta = nodo.tagName;
    if (etiqueta === "BR") {
      agregarSegmento(segmentos, "\n", negrita, cursiva);
      return;
    }
    const esBloque = bloques.has(etiqueta);
    if (esBloque && segmentos.length && !segmentos.at(-1)!.texto.endsWith("\n")) {
      agregarSegmento(segmentos, "\n", negrita, cursiva);
    }
    const peso = negrita || etiqueta === "B" || etiqueta === "STRONG";
    const inclinacion = cursiva || etiqueta === "I" || etiqueta === "EM";
    nodo.childNodes.forEach((hijo) => recorrer(hijo, peso, inclinacion));
    if (esBloque && !segmentos.at(-1)?.texto.endsWith("\n")) {
      agregarSegmento(segmentos, "\n", peso, inclinacion);
    }
  };

  editor.childNodes.forEach((nodo) => recorrer(nodo, false, false));
  if (segmentos[0]) segmentos[0].texto = segmentos[0].texto.replace(/^\s+/, "");
  if (segmentos.at(-1)) segmentos.at(-1)!.texto = segmentos.at(-1)!.texto.replace(/\s+$/, "");
  const limpios = segmentos.filter((segmento) => segmento.texto.length > 0);
  return { texto: limpios.map((segmento) => segmento.texto).join(""), segmentos: limpios };
}

function EditorCorreo({
  id,
  onChange,
  autoFocus = false,
}: {
  id: string;
  onChange: (contenido: ContenidoEditor) => void;
  autoFocus?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState({ negrita: false, cursiva: false });

  const sincronizar = () => {
    if (!editor.current) return;
    let contenido = contenidoDesdeEditor(editor.current);
    if (contenido.texto.length > 20_000) {
      editor.current.textContent = contenido.texto.slice(0, 20_000);
      contenido = contenidoDesdeEditor(editor.current);
    }
    onChange(contenido);
    setActivo({
      negrita: document.queryCommandState("bold"),
      cursiva: document.queryCommandState("italic"),
    });
  };

  const aplicar = (comando: "bold" | "italic") => {
    editor.current?.focus();
    document.execCommand(comando);
    sincronizar();
  };

  return (
    <div className="ui-editor">
      <div className="ui-editor-bar" role="toolbar" aria-label="Formato del mensaje">
        <button
          type="button"
          aria-label="Negritas"
          aria-pressed={activo.negrita}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => aplicar("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Cursivas"
          aria-pressed={activo.cursiva}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => aplicar("italic")}
        >
          <em>I</em>
        </button>
        <span className="ml-auto">Formato</span>
      </div>
      <div
        id={id}
        ref={editor}
        className="ui-editor-area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Mensaje"
        data-placeholder="Escribe el mensaje."
        suppressContentEditableWarning
        onInput={sincronizar}
        onKeyUp={sincronizar}
        onMouseUp={sincronizar}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
        autoFocus={autoFocus}
      />
    </div>
  );
}

function useArchivosSalida() {
  const crearCarga = useMutation(api.correo.crearCargaAdjunto);
  const completarCarga = useMutation(api.correo.completarCargaAdjunto);
  const descartarCarga = useMutation(api.correo.descartarCargaAdjunto);
  const [archivos, setArchivos] = useState<ArchivoSalida[]>([]);

  const actualizar = (localId: string, cambio: Partial<ArchivoSalida>) => {
    setArchivos((actuales) =>
      actuales.map((archivo) => (archivo.localId === localId ? { ...archivo, ...cambio } : archivo)),
    );
  };

  const agregar = async (seleccionados: FileList | null) => {
    if (!seleccionados?.length) return;
    let cantidad = archivos.filter((archivo) => archivo.estado !== "error").length;
    let total = archivos.reduce(
      (suma, archivo) => suma + (archivo.estado === "error" ? 0 : archivo.tamano),
      0,
    );

    for (const file of Array.from(seleccionados)) {
      const localId = crypto.randomUUID();
      if (cantidad >= MAX_ADJUNTOS) {
        setArchivos((actuales) => [
          ...actuales,
          {
            localId,
            nombre: file.name,
            tipoContenido: file.type || "application/octet-stream",
            tamano: file.size,
            estado: "error",
            error: "Maximo 10 archivos por correo.",
          },
        ]);
        continue;
      }
      if (file.size <= 0 || file.size > MAX_ADJUNTO_BYTES || total + file.size > MAX_TOTAL_ADJUNTOS_BYTES) {
        setArchivos((actuales) => [
          ...actuales,
          {
            localId,
            nombre: file.name,
            tipoContenido: file.type || "application/octet-stream",
            tamano: file.size,
            estado: "error",
            error: file.size > MAX_ADJUNTO_BYTES ? "El archivo supera 10 MB." : "El total supera 18 MB.",
          },
        ]);
        continue;
      }

      cantidad += 1;
      total += file.size;
      setArchivos((actuales) => [
        ...actuales,
        {
          localId,
          nombre: file.name,
          tipoContenido: file.type || "application/octet-stream",
          tamano: file.size,
          estado: "subiendo",
        },
      ]);

      let borradorId: Id<"mailAttachmentDrafts"> | undefined;
      try {
        const carga = await crearCarga({});
        borradorId = carga.id;
        actualizar(localId, { borradorId });
        const respuesta = await fetch(carga.url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!respuesta.ok) throw new Error("No se pudo subir el archivo.");
        const datos = (await respuesta.json()) as { storageId?: string };
        if (!datos.storageId) throw new Error("Convex no devolvio el archivo.");
        const completo = await completarCarga({
          id: carga.id,
          storageId: datos.storageId as Id<"_storage">,
          nombre: file.name,
        });
        if (!completo.ok) throw new Error(completo.error);
        actualizar(localId, {
          borradorId: carga.id,
          nombre: completo.nombre,
          tipoContenido: completo.tipoContenido,
          tamano: completo.tamano,
          estado: "listo",
          error: undefined,
        });
      } catch (error) {
        if (borradorId) void descartarCarga({ id: borradorId });
        actualizar(localId, { estado: "error", error: limpiarError(error) });
      }
    }
  };

  const quitar = async (archivo: ArchivoSalida) => {
    setArchivos((actuales) => actuales.filter((actual) => actual.localId !== archivo.localId));
    if (archivo.borradorId) await descartarCarga({ id: archivo.borradorId });
  };

  const descartarTodos = () => {
    for (const archivo of archivos) {
      if (archivo.borradorId) void descartarCarga({ id: archivo.borradorId });
    }
    setArchivos([]);
  };

  return {
    archivos,
    agregar,
    quitar,
    descartarTodos,
    idsListos: archivos.flatMap((archivo) =>
      archivo.estado === "listo" && archivo.borradorId ? [archivo.borradorId] : [],
    ),
    subiendo: archivos.some((archivo) => archivo.estado === "subiendo"),
  };
}

function AdjuntosSalida({ gestor }: { gestor: ReturnType<typeof useArchivosSalida> }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="ui-attach">
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple
        onChange={(event) => {
          void gestor.agregar(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Boton tamano="sm" icono="adjunto" onClick={() => input.current?.click()}>
          Adjuntar
        </Boton>
        <span className="ui-faint text-[11px]">10 MB c/u · 18 MB total</span>
      </div>
      {gestor.archivos.length ? (
        <ul className="ui-attach-list">
          {gestor.archivos.map((archivo) => (
            <li key={archivo.localId} data-estado={archivo.estado}>
              <Icono nombre="archivo" tamano={14} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{archivo.nombre}</span>
                <span className="ui-faint block text-[11px]">
                  {archivo.error ?? `${tamanoArchivo(archivo.tamano)} · ${archivo.estado === "listo" ? "Listo" : "Subiendo"}`}
                </span>
              </span>
              {archivo.estado !== "subiendo" ? (
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  soloIcono
                  icono="cerrar"
                  etiqueta={`Quitar ${archivo.nombre}`}
                  onClick={() => void gestor.quitar(archivo)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TextoMensaje({ mensaje }: { mensaje: MensajeCorreo }) {
  if (!mensaje.segmentos?.length) return <>{mensaje.texto}</>;
  return (
    <>
      {mensaje.segmentos.map((segmento, indice) => {
        let contenido: ReactNode = segmento.texto;
        if (segmento.cursiva) contenido = <em>{contenido}</em>;
        if (segmento.negrita) contenido = <strong>{contenido}</strong>;
        return <span key={`${indice}-${segmento.texto.length}`}>{contenido}</span>;
      })}
    </>
  );
}

function sanitizarHtmlCorreo(html: string, cidUrls: Map<string, string>): string {
  const documento = new DOMParser().parseFromString(html, "text/html");
  documento
    .querySelectorAll("script,iframe,object,embed,form,input,button,textarea,select,option,meta,base,link,video,audio,source,track")
    .forEach((elemento) => elemento.remove());

  documento.querySelectorAll("*").forEach((elemento) => {
    for (const atributo of Array.from(elemento.attributes)) {
      const nombre = atributo.name.toLowerCase();
      if (
        nombre.startsWith("on") ||
        nombre.endsWith(":href") ||
        ["href", "srcset", "action", "formaction", "ping"].includes(nombre)
      ) {
        elemento.removeAttribute(atributo.name);
        continue;
      }
      if (nombre === "src") {
        const valor = atributo.value.trim();
        if (valor.toLowerCase().startsWith("cid:")) {
          const clave = valor.slice(4).replace(/^<|>$/g, "").toLowerCase();
          const url = cidUrls.get(clave);
          if (url) elemento.setAttribute("src", url);
          else elemento.removeAttribute("src");
        } else if (!/^data:image\/(?:avif|gif|jpeg|png|webp);/i.test(valor)) {
          elemento.removeAttribute("src");
        }
      }
      if (nombre === "style") {
        elemento.setAttribute(
          "style",
          atributo.value
            .replace(/url\([^)]*\)/gi, "none")
            .replace(/expression\([^)]*\)/gi, "")
            .replace(/behavior\s*:/gi, "blocked:"),
        );
      }
    }
  });
  documento.querySelectorAll("style").forEach((estilo) => {
    estilo.textContent = (estilo.textContent ?? "")
      .replace(/@import[^;]+;/gi, "")
      .replace(/url\([^)]*\)/gi, "none");
  });

  const csp = documento.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content =
    "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; frame-src 'none'";
  documento.head.prepend(csp);
  const estilos = documento.createElement("style");
  estilos.textContent =
    "html,body{margin:0;padding:0;max-width:100%;background:#fff;color:#26364d;overflow-wrap:anywhere}body{padding:18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.55}img{max-width:100%;height:auto}table{max-width:100%!important}a{color:#1f5fd0;text-decoration:underline;pointer-events:none}";
  documento.head.append(estilos);
  return `<!doctype html>${documento.documentElement.outerHTML}`;
}

function CorreoHtml({ html, adjuntos, titulo }: { html: string; adjuntos: AdjuntoCorreo[]; titulo: string }) {
  const [documento, setDocumento] = useState<string | null>(null);
  const inline = useMemo(
    () => adjuntos.filter((adjunto) => adjunto.contentId && IMAGENES_PREVISUALIZABLES.has(adjunto.tipoContenido)),
    [adjuntos],
  );
  const clave = inline.map((adjunto) => `${adjunto._id}:${adjunto.contentId}`).join("|");

  useEffect(() => {
    let activo = true;
    const urls: string[] = [];
    void (async () => {
      const pares = await Promise.all(
        inline.map(async (adjunto) => {
          const respuesta = await fetch(`/api/correo/adjuntos/${adjunto._id}`, { cache: "no-store" });
          if (!respuesta.ok) return null;
          const url = URL.createObjectURL(await respuesta.blob());
          urls.push(url);
          return [adjunto.contentId!.replace(/^<|>$/g, "").toLowerCase(), url] as const;
        }),
      );
      if (activo) setDocumento(sanitizarHtmlCorreo(html, new Map(pares.filter((par) => par !== null))));
    })();
    return () => {
      activo = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [html, clave, inline]);

  if (!documento) return <div className="correo-html-cargando">Preparando el diseño del correo…</div>;
  return (
    <iframe
      className="correo-html-frame"
      title={`Contenido de ${titulo}`}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={documento}
    />
  );
}

function CuerpoMensaje({ mensaje }: { mensaje: MensajeCorreo }) {
  const [vista, setVista] = useState<"diseno" | "texto">(mensaje.html ? "diseno" : "texto");
  return (
    <div className="ui-mail-body ui-mail-body-fit">
      {mensaje.html ? (
        <div className="correo-vista-selector">
          <button type="button" aria-pressed={vista === "diseno"} onClick={() => setVista("diseno")}>
            Diseño original
          </button>
          <button type="button" aria-pressed={vista === "texto"} onClick={() => setVista("texto")}>
            Texto simple
          </button>
          <span>Imágenes remotas bloqueadas</span>
        </div>
      ) : null}
      {vista === "diseno" && mensaje.html ? (
        <CorreoHtml html={mensaje.html} adjuntos={mensaje.adjuntos} titulo={mensaje.asunto} />
      ) : (
        <div className="whitespace-pre-wrap text-[13.5px] leading-[1.7]">
          <TextoMensaje mensaje={mensaje} />
        </div>
      )}
    </div>
  );
}

function AdjuntoMensaje({ adjunto }: { adjunto: AdjuntoCorreo }) {
  const url = `/api/correo/adjuntos/${adjunto._id}`;
  const esImagen = IMAGENES_PREVISUALIZABLES.has(adjunto.tipoContenido);
  return (
    <a href={url} download={adjunto.nombre} className="ui-mail-file">
      {esImagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        <Icono nombre="archivo" tamano={16} />
      )}
      <span className="min-w-0 flex-1">
        <strong>{adjunto.nombre}</strong>
        <span className="ui-faint block text-[11px]">{tamanoArchivo(adjunto.tamano)}</span>
      </span>
      <Icono nombre="descargar" tamano={14} />
    </a>
  );
}

export default function Correo() {
  return (
    <Suspense fallback={<Cargando que="el correo" />}>
      <CorreoContenido />
    </Suspense>
  );
}

function CorreoContenido() {
  const searchParams = useSearchParams();
  const destinatarioEnUrl = searchParams.get("para")?.trim() ?? "";
  const [carpeta, setCarpeta] = useState<Carpeta>("abierto");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Id<"mailThreads"> | null>(null);
  const [componiendo, setComponiendo] = useState(Boolean(destinatarioEnUrl));
  const [paraInicial, setParaInicial] = useState(destinatarioEnUrl);
  const busquedaDiferida = useDeferredValue(busqueda);

  const resumen = useQuery(api.correo.resumen, {});
  const configuracion = useQuery(api.correo.configuracion, {});
  const hilos = useQuery(api.correo.listarHilos, {
    ...(carpeta === "todos" ? {} : { estado: carpeta }),
    ...(busquedaDiferida ? { busqueda: busquedaDiferida } : {}),
  });
  const detalle = useQuery(api.correo.detalle, seleccionado ? { id: seleccionado } : "skip");
  const marcarLeido = useMutation(api.correo.marcarLeido);

  useEffect(() => {
    if (detalle?.hilo.noLeidos && detalle.hilo.noLeidos > 0) {
      void marcarLeido({ id: detalle.hilo._id });
    }
  }, [detalle?.hilo._id, detalle?.hilo.noLeidos, marcarLeido]);

  useEffect(() => {
    if (!destinatarioEnUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("para");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [destinatarioEnUrl]);

  return (
    <>
      <Encabezado
        titulo="Correo"
        descripcion={
          resumen
            ? `${resumen.noLeidos} sin leer · ${resumen.abiertos} abiertos`
            : "Bandeja compartida del equipo."
        }
        acciones={
          <Boton
            variante="primario"
            icono="mas"
            onClick={() => {
              setParaInicial("");
              setComponiendo(true);
            }}
          >
            Nuevo
          </Boton>
        }
      />

      {configuracion && (!configuracion.listo || configuracion.modoPrueba) ? (
        <p className="ui-aviso mx-5 mb-3" data-tone="warn">
          {!configuracion.listo
            ? "Faltan las claves de Resend en Convex. La bandeja funciona, pero no puede enviar ni recibir todavía."
            : "Resend sigue en modo de prueba y solo acepta sus direcciones de test."}
        </p>
      ) : null}

      <div className="ui-mail" data-pane={seleccionado ? "read" : "list"}>
        <nav className="ui-mail-folders" aria-label="Carpetas">
          {CARPETAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ui-mail-folder"
              data-active={carpeta === c.id ? "true" : undefined}
              onClick={() => {
                setCarpeta(c.id);
                setSeleccionado(null);
              }}
            >
              <Icono nombre={c.icono} tamano={15} />
              {c.texto}
              <b>{resumen?.[c.clave] ?? "—"}</b>
            </button>
          ))}
        </nav>

        <section className="ui-mail-list" aria-label="Conversaciones">
          <div className="ui-mail-search">
            <Entrada
              icono="buscar"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Persona, asunto o contenido"
              autoComplete="off"
            />
          </div>
          {hilos === undefined ? (
            <Cargando que="las conversaciones" />
          ) : hilos.length === 0 ? (
            <Vacio
              titulo="La bandeja está limpia"
              ayuda={
                busqueda || carpeta !== "abierto"
                  ? "No hay conversaciones con estos filtros."
                  : "Los mensajes a contacto@, direccion@ o finanzas@ aparecen aquí."
              }
            />
          ) : (
            hilos.map((hilo) => (
              <button
                key={hilo._id}
                type="button"
                className="ui-mail-row"
                data-active={seleccionado === hilo._id ? "true" : undefined}
                data-unread={hilo.noLeidos > 0 ? "true" : undefined}
                onClick={() => setSeleccionado(hilo._id)}
              >
                <header>
                  <strong>{hilo.contactoNombre || hilo.contactoCorreo}</strong>
                  <time dateTime={new Date(hilo.ultimoMensajeEn).toISOString()}>
                    {FORMATO_HORA.format(new Date(hilo.ultimoMensajeEn))}
                  </time>
                </header>
                <p>{hilo.asunto}</p>
                <p>{hilo.ultimoResumen}</p>
              </button>
            ))
          )}
        </section>

        <section className="ui-mail-read" aria-live="polite">
          {!seleccionado ? (
            <div className="ui-empty">
              <strong>Selecciona una conversación</strong>
              <p>Los adjuntos, responsables y el estado de entrega quedan en un solo lugar.</p>
            </div>
          ) : detalle === undefined ? (
            <Cargando que="la conversación" />
          ) : detalle === null ? (
            <Vacio titulo="Conversación no disponible" ayuda="Puede haberse eliminado o movido." />
          ) : (
            <Conversacion
              detalle={detalle}
              remitentes={configuracion?.remitentes ?? [REMITENTE_PREDETERMINADO]}
              volver={() => setSeleccionado(null)}
              eliminado={() => setSeleccionado(null)}
            />
          )}
        </section>
      </div>

      {componiendo ? (
        <CompositorNuevo
          paraInicial={paraInicial}
          remitentes={configuracion?.remitentes ?? [REMITENTE_PREDETERMINADO]}
          cerrar={() => {
            setComponiendo(false);
            setParaInicial("");
          }}
          enviado={(threadId) => {
            setComponiendo(false);
            setCarpeta("abierto");
            setSeleccionado(threadId);
          }}
        />
      ) : null}
    </>
  );
}

function Conversacion({
  detalle,
  remitentes,
  volver,
  eliminado,
}: {
  detalle: DetalleCorreo;
  remitentes: string[];
  volver: () => void;
  eliminado: () => void;
}) {
  const cambiarEstado = useMutation(api.correo.cambiarEstado);
  const tomar = useMutation(api.correo.tomar);
  const eliminarHilo = useMutation(api.correo.eliminarHilo);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const hilo = detalle.hilo;

  const aplicar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(limpiarError(e));
    }
  };

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    try {
      await eliminarHilo({ id: hilo._id });
      eliminado();
    } catch (e) {
      setError(limpiarError(e));
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      <header className="ui-mail-read-h">
        <div className="flex min-w-0 items-start gap-2">
          <Boton
            className="xl:hidden"
            tamano="sm"
            variante="fantasma"
            soloIcono
            icono="chevronIzquierda"
            etiqueta="Volver a la bandeja"
            onClick={volver}
          />
          <div className="min-w-0">
            <h2>{hilo.asunto}</h2>
            <p className="ui-faint mt-1 text-[12px]">
              {hilo.asignadoNombre ? `Responsable: ${hilo.asignadoNombre}` : "Sin responsable"}
            </p>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <Pildora tono={TONO_ESTADO[hilo.estado] ?? "neutro"} sm>
            {ETIQUETAS[hilo.estado]}
          </Pildora>
          <Boton tamano="sm" icono="usuario" onClick={() => void aplicar(() => tomar({ id: hilo._id, tomar: !hilo.asignadoA }))}>
            {hilo.asignadoA ? "Liberar" : "Tomar"}
          </Boton>
          <SelectorPersonalizado
            id={`estado-hilo-${hilo._id}`}
            ariaLabel="Estado de la conversacion"
            variante="compacto"
            valor={hilo.estado}
            opciones={ESTADOS_HILO_CORREO.map((opcion) => ({
              valor: opcion,
              etiqueta: ETIQUETAS[opcion] ?? opcion,
            }))}
            alCambiar={(opcion) =>
              void aplicar(() => cambiarEstado({ id: hilo._id, estado: opcion as EstadoHiloCorreo }))
            }
          />
          <Boton
            tamano="sm"
            variante="peligro"
            soloIcono
            icono="papelera"
            etiqueta="Eliminar conversación"
            onClick={() => setConfirmando(true)}
          />
        </div>
      </header>

      <div className="ui-mail-meta">
        <Avatar texto={iniciales(hilo.contactoNombre || hilo.contactoCorreo)} />
        <p>
          <strong>{hilo.contactoNombre || hilo.contactoCorreo}</strong>
          <span className="ui-faint block truncate text-[12px]">{hilo.contactoCorreo}</span>
        </p>
      </div>
      {error ? (
        <div className="px-5 pt-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      ) : null}

      <ol className="ui-mail-thread">
        {detalle.mensajes.map((mensaje) => (
          <li key={mensaje._id} className="ui-mail-msg" data-out={mensaje.direccion === "saliente" ? "true" : undefined}>
            <header>
              <Avatar
                texto={iniciales(
                  mensaje.direccion === "entrante" ? hilo.contactoNombre || mensaje.de : "Alpha",
                )}
                tamano="sm"
              />
              <div className="min-w-0">
                <strong>{mensaje.direccion === "entrante" ? mensaje.de : "Alpha CCM"}</strong>
                <span className="ml-2">
                  Para {mensaje.para.join(", ")}
                  {mensaje.direccion === "saliente" ? ` · ${ETIQUETAS[mensaje.estado] ?? mensaje.estado}` : ""}
                </span>
              </div>
              <time dateTime={new Date(mensaje.creadoEn).toISOString()}>{fechaHora(mensaje.creadoEn)}</time>
            </header>
            <CuerpoMensaje mensaje={mensaje} />
            {mensaje.adjuntos.length > 0 ? (
              <div className="ui-mail-files">
                {mensaje.adjuntos.map((adjunto) => (
                  <AdjuntoMensaje key={adjunto._id} adjunto={adjunto} />
                ))}
              </div>
            ) : null}
            {mensaje.error ? (
              <div className="mt-3">
                <Aviso tono="error">{mensaje.error}</Aviso>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="ui-mail-compose">
        {respondiendo ? (
          <Responder
            threadId={hilo._id}
            para={hilo.contactoCorreo}
            asunto={hilo.asunto}
            remitentes={remitentes}
            remitenteInicial={
              [...detalle.mensajes].reverse().find((mensaje) => mensaje.direccion === "saliente")?.de
            }
            cerrar={() => setRespondiendo(false)}
          />
        ) : (
          <Boton icono="responder" onClick={() => setRespondiendo(true)}>
            Responder
          </Boton>
        )}
      </div>

      {confirmando ? (
        <ConfirmarEliminacion
          asunto={hilo.asunto}
          ocupado={eliminando}
          cancelar={() => setConfirmando(false)}
          confirmar={() => void eliminar()}
        />
      ) : null}
    </>
  );
}

function Responder({
  threadId,
  para,
  asunto,
  remitentes,
  remitenteInicial,
  cerrar,
}: {
  threadId: Id<"mailThreads">;
  para: string;
  asunto: string;
  remitentes: string[];
  remitenteInicial?: string;
  cerrar: () => void;
}) {
  const enviarSimple = useMutation(api.correo.enviar);
  const enviarConAdjuntos = useAction(api.correoActions.enviarConAdjuntos);
  const [contenido, setContenido] = useState<ContenidoEditor>({ texto: "", segmentos: [] });
  const adjuntos = useArchivosSalida();
  const [remitente, setRemitente] = useState(
    remitenteInicial && remitentes.includes(remitenteInicial)
      ? remitenteInicial
      : remitentes[0] ?? REMITENTE_PREDETERMINADO,
  );
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const requestId = useRef<string | null>(null);

  const responder = async () => {
    setOcupado(true);
    setAviso(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const datos = {
        clientRequestId: requestId.current,
        threadId,
        remitente,
        asunto,
        texto: contenido.texto,
        segmentos: contenido.segmentos,
      };
      if (adjuntos.idsListos.length) {
        await enviarConAdjuntos({ ...datos, adjuntos: adjuntos.idsListos });
      } else {
        await enviarSimple(datos);
      }
      requestId.current = null;
      cerrar();
    } catch (error) {
      setAviso({ tono: "error", texto: limpiarError(error) });
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = () => {
    adjuntos.descartarTodos();
    cerrar();
  };

  return (
    <div>
      <p className="ui-faint mb-3 text-[12px]">Para {para}</p>
      <Campo etiqueta="Desde" htmlFor={`respuesta-remitente-${threadId}`}>
        <Seleccion
          id={`respuesta-remitente-${threadId}`}
          value={remitente}
          onChange={(event) => setRemitente(event.target.value)}
        >
          {remitentes.map((correo) => (
            <option key={correo} value={correo}>
              {correo}
            </option>
          ))}
        </Seleccion>
      </Campo>
      <div className="mt-3">
        <EditorCorreo id={`respuesta-${threadId}`} onChange={setContenido} autoFocus />
      </div>
      <AdjuntosSalida gestor={adjuntos} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <span />}
        <div className="ml-auto flex gap-2">
          <Boton disabled={ocupado || adjuntos.subiendo} onClick={cancelar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            icono="enviar"
            disabled={ocupado || adjuntos.subiendo || contenido.texto.trim() === ""}
            onClick={() => void responder()}
          >
            {ocupado ? "Enviando…" : "Enviar"}
          </Boton>
        </div>
      </div>
    </div>
  );
}

function CompositorNuevo({
  paraInicial,
  remitentes,
  cerrar,
  enviado,
}: {
  paraInicial: string;
  remitentes: string[];
  cerrar: () => void;
  enviado: (threadId: Id<"mailThreads">) => void;
}) {
  const enviarSimple = useMutation(api.correo.enviar);
  const enviarConAdjuntos = useAction(api.correoActions.enviarConAdjuntos);
  const [para, setPara] = useState(paraInicial);
  const [remitente, setRemitente] = useState(remitentes[0] ?? REMITENTE_PREDETERMINADO);
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState<ContenidoEditor>({ texto: "", segmentos: [] });
  const adjuntos = useArchivosSalida();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  const mandar = async () => {
    setOcupado(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const datos = {
        clientRequestId: requestId.current,
        para,
        remitente,
        asunto,
        texto: contenido.texto,
        segmentos: contenido.segmentos,
      };
      const resultado = adjuntos.idsListos.length
        ? await enviarConAdjuntos({ ...datos, adjuntos: adjuntos.idsListos })
        : await enviarSimple(datos);
      requestId.current = null;
      enviado(resultado.threadId);
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = () => {
    adjuntos.descartarTodos();
    cerrar();
  };

  return (
    <div className="ui-modal-bg" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="nuevo-correo-titulo" className="ui-dialog ui-dialog-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Bandeja compartida</p>
            <h2 id="nuevo-correo-titulo" className="ui-h2 mt-1">
              Nuevo correo
            </h2>
          </div>
          <Boton
            tamano="sm"
            variante="fantasma"
            soloIcono
            icono="cerrar"
            etiqueta="Cerrar compositor"
            disabled={ocupado || adjuntos.subiendo}
            onClick={cancelar}
          />
        </div>
        <div className="grid gap-4">
          <Campo etiqueta="Desde" htmlFor="nuevo-remitente">
            <Seleccion id="nuevo-remitente" value={remitente} onChange={(event) => setRemitente(event.target.value)}>
              {remitentes.map((correo) => (
                <option key={correo} value={correo}>
                  {correo}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Para" htmlFor="nuevo-para">
            <Entrada
              id="nuevo-para"
              type="email"
              value={para}
              maxLength={320}
              onChange={(event) => setPara(event.target.value)}
              placeholder="persona@ejemplo.com"
              autoFocus
            />
          </Campo>
          <Campo etiqueta="Asunto" htmlFor="nuevo-asunto">
            <Entrada
              id="nuevo-asunto"
              value={asunto}
              maxLength={180}
              onChange={(event) => setAsunto(event.target.value)}
              placeholder="Asunto del mensaje"
            />
          </Campo>
          <EditorCorreo id="nuevo-texto" onChange={setContenido} />
          <AdjuntosSalida gestor={adjuntos} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {error ? <Aviso tono="error">{error}</Aviso> : <span />}
          <div className="ml-auto flex gap-2">
            <Boton disabled={ocupado || adjuntos.subiendo} onClick={cancelar}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              icono="enviar"
              disabled={ocupado || adjuntos.subiendo || !para || !asunto.trim() || !contenido.texto.trim()}
              onClick={() => void mandar()}
            >
              {ocupado ? "Enviando…" : "Enviar"}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmarEliminacion({
  asunto,
  ocupado,
  cancelar,
  confirmar,
}: {
  asunto: string;
  ocupado: boolean;
  cancelar: () => void;
  confirmar: () => void;
}) {
  return (
    <div className="ui-modal-bg" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eliminar-correo-titulo"
        aria-describedby="eliminar-correo-descripcion"
        className="ui-dialog"
      >
        <p className="ui-eyebrow">Acción permanente</p>
        <h3 id="eliminar-correo-titulo" className="ui-h2 mt-2">
          Eliminar conversación
        </h3>
        <p id="eliminar-correo-descripcion" className="ui-desc mt-3">
          Se borrarán el hilo “{asunto}”, sus mensajes y todos los archivos adjuntos guardados.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton disabled={ocupado} onClick={cancelar}>
            Cancelar
          </Boton>
          <Boton variante="peligro" disabled={ocupado} onClick={confirmar}>
            {ocupado ? "Eliminando…" : "Eliminar"}
          </Boton>
        </div>
      </div>
    </div>
  );
}
