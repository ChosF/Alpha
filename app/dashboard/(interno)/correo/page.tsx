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
import { Aviso, Bandeja, Cargando, Vacio, fechaHora } from "@/components/panel/piezas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const FORMATO_ARCHIVO = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 1,
});

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

function agregarSegmento(
  segmentos: SegmentoCorreo[],
  texto: string,
  negrita: boolean,
  cursiva: boolean,
) {
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
    <div className="correo-editor-marco">
      <div className="correo-editor-barra" role="toolbar" aria-label="Formato del mensaje">
        <button
          type="button"
          className={activo.negrita ? "correo-formato-activo" : ""}
          aria-label="Negritas"
          aria-pressed={activo.negrita}
          title="Negritas (Ctrl+B)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => aplicar("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={activo.cursiva ? "correo-formato-activo" : ""}
          aria-label="Cursivas"
          aria-pressed={activo.cursiva}
          title="Cursivas (Ctrl+I)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => aplicar("italic")}
        >
          <em>I</em>
        </button>
        <span>Formato</span>
      </div>
      <div
        id={id}
        ref={editor}
        className="correo-editor"
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
    <div className="correo-adjuntar">
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
        <button type="button" className="correo-adjuntar-boton" onClick={() => input.current?.click()}>
          <IconoClip />
          Adjuntar archivos o fotos
        </button>
        <span className="cifra text-[8.5px] text-[var(--color-n500)]">10 MB c/u · 18 MB total</span>
      </div>
      {gestor.archivos.length ? (
        <ul className="correo-cargas">
          {gestor.archivos.map((archivo) => (
            <li key={archivo.localId} data-estado={archivo.estado}>
              <span className="correo-carga-icono">{archivo.estado === "subiendo" ? "···" : extensionArchivo(archivo.nombre)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium">{archivo.nombre}</span>
                <span className="mt-1 block text-[9px] text-[var(--color-n600)]">
                  {archivo.error ?? `${tamanoArchivo(archivo.tamano)} · ${archivo.estado === "listo" ? "Listo" : "Subiendo"}`}
                </span>
              </span>
              {archivo.estado !== "subiendo" ? (
                <button type="button" aria-label={`Quitar ${archivo.nombre}`} onClick={() => void gestor.quitar(archivo)}>×</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function extensionArchivo(nombre: string): string {
  const extension = nombre.split(".").pop()?.slice(0, 4).toUpperCase();
  return extension && extension !== nombre.toUpperCase() ? extension : "DOC";
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
  csp.content = "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; frame-src 'none'";
  documento.head.prepend(csp);
  const estilos = documento.createElement("style");
  estilos.textContent = "html,body{margin:0;padding:0;max-width:100%;background:#fff;color:#26364d;overflow-wrap:anywhere}body{padding:18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.55}img{max-width:100%;height:auto}table{max-width:100%!important}a{color:#1f5fd0;text-decoration:underline;pointer-events:none}";
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
    <div className="correo-mensaje-cuerpo text-[13px] font-light leading-[1.85] text-[var(--color-cuerpo)]">
      {mensaje.html ? (
        <div className="correo-vista-selector">
          <button type="button" aria-pressed={vista === "diseno"} onClick={() => setVista("diseno")}>Diseño original</button>
          <button type="button" aria-pressed={vista === "texto"} onClick={() => setVista("texto")}>Texto simple</button>
          <span>Imágenes remotas bloqueadas</span>
        </div>
      ) : null}
      {vista === "diseno" && mensaje.html ? (
        <CorreoHtml html={mensaje.html} adjuntos={mensaje.adjuntos} titulo={mensaje.asunto} />
      ) : (
        <div className="whitespace-pre-wrap"><TextoMensaje mensaje={mensaje} /></div>
      )}
    </div>
  );
}

function AdjuntoMensaje({ adjunto }: { adjunto: AdjuntoCorreo }) {
  const url = `/api/correo/adjuntos/${adjunto._id}`;
  const esImagen = IMAGENES_PREVISUALIZABLES.has(adjunto.tipoContenido);
  return (
    <a href={url} download={adjunto.nombre} className={`correo-adjunto ${esImagen ? "correo-adjunto-imagen" : ""}`}>
      {esImagen ? (
        // The source is an authenticated, short-lived response and cannot use Next image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        <span className="correo-adjunto-extension">{extensionArchivo(adjunto.nombre)}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium">{adjunto.nombre}</span>
        <span className="mt-1 block cifra text-[9px] text-[var(--color-n600)]">
          {tamanoArchivo(adjunto.tamano)} · {adjunto.tipoContenido}
        </span>
      </span>
      <IconoDescarga />
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
  const [estado, setEstado] = useState<EstadoHiloCorreo | "todos">("abierto");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Id<"mailThreads"> | null>(null);
  const [componiendo, setComponiendo] = useState(Boolean(destinatarioEnUrl));
  const [paraInicial, setParaInicial] = useState(destinatarioEnUrl);
  const busquedaDiferida = useDeferredValue(busqueda);

  const resumen = useQuery(api.correo.resumen, {});
  const configuracion = useQuery(api.correo.configuracion, {});
  const hilos = useQuery(api.correo.listarHilos, {
    ...(estado === "todos" ? {} : { estado }),
    ...(busquedaDiferida ? { busqueda: busquedaDiferida } : {}),
  });
  const detalle = useQuery(
    api.correo.detalle,
    seleccionado ? { id: seleccionado } : "skip",
  );
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
    <div className="correo-entrada">
      <header className="correo-cabecera mb-6 sm:mb-8 lg:mb-10 grid gap-4 sm:gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cejilla">Bandeja compartida de Alpha</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <h1 className="text-[clamp(1.75rem,10vw,4.8rem)] font-bold tracking-[-.06em] leading-[.88]">
              Correo
            </h1>
            <p className="pb-1 cifra text-[12px] text-[var(--color-n600)]">
              {resumen ? `${resumen.noLeidos} sin leer · ${resumen.abiertos} abiertos` : "Sincronizando"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="boton group w-full justify-between sm:w-auto sm:min-w-[180px]"
          onClick={() => {
            setParaInicial("");
            setComponiendo(true);
          }}
        >
          Nuevo correo
          <span className="grid size-7 place-items-center bg-white/12 transition-transform duration-500 ease-[var(--E)] group-hover:translate-x-0.5">
            <Flecha />
          </span>
        </button>
      </header>

      {configuracion && (!configuracion.listo || configuracion.modoPrueba) ? (
        <div className="mb-5 bg-[var(--color-ink)] px-5 py-4 text-white grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="rotulo text-white/50">Configuracion pendiente</p>
            <p className="mt-1 text-[12.5px] text-white/75">
              {!configuracion.listo
                ? "Faltan las claves de Resend en Convex. La bandeja funciona, pero no puede enviar ni recibir todavia."
                : "Resend sigue en modo de prueba y solo acepta sus direcciones de test."}
            </p>
          </div>
          <span className="cifra text-[10px] text-white/45">RESEND</span>
        </div>
      ) : null}

      <div className="correo-workspace grid min-h-0 gap-4 xl:grid-cols-[minmax(330px,0.84fr)_minmax(520px,1.6fr)]">
        <Bandeja className={`correo-panel ${seleccionado ? "hidden xl:block" : "block"}`}>
          <section className="flex h-full min-h-0 flex-col">
            <div className="flex-none p-5 sm:p-6 border-b border-[var(--hair)]">
              <div className="campo">
                <label htmlFor="buscar-correo">Buscar en correo</label>
                <input
                  id="buscar-correo"
                  className="entrada"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Persona, asunto o contenido"
                  autoComplete="off"
                />
              </div>
              <div className="mt-5 flex gap-1 overflow-x-auto" aria-label="Estado de conversaciones">
                {(["todos", ...ESTADOS_HILO_CORREO] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    className={`px-3 py-2 text-[10px] font-medium tracking-[.13em] uppercase transition-colors duration-500 ease-[var(--E)] ${
                      estado === opcion
                        ? "bg-[var(--color-ink)] text-white"
                        : "text-[var(--color-n600)] hover:bg-[var(--color-surface)]"
                    }`}
                    onClick={() => setEstado(opcion)}
                  >
                    {opcion === "todos" ? "Todos" : ETIQUETAS[opcion]}
                  </button>
                ))}
              </div>
            </div>

            <div className="correo-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {hilos === undefined ? (
                <Cargando que="las conversaciones" />
              ) : hilos.length === 0 ? (
                <Vacio
                  titulo="La bandeja esta limpia"
                  ayuda={
                    busqueda || estado !== "abierto"
                      ? "No hay conversaciones con estos filtros."
                      : "Los mensajes enviados a contacto@, direccion@ o finanzas@ apareceran aqui."
                  }
                />
              ) : (
                <ol className="correo-lista">
                  {hilos.map((hilo, indice) => (
                    <li key={hilo._id}>
                      <button
                        type="button"
                        aria-pressed={seleccionado === hilo._id}
                        className={`correo-fila w-full text-left px-5 sm:px-6 py-4.5 grid grid-cols-[38px_1fr_auto] gap-x-3 gap-y-1.5 ${
                          seleccionado === hilo._id ? "correo-fila-activa" : ""
                        }`}
                        onClick={() => setSeleccionado(hilo._id)}
                      >
                        <span className="correo-avatar row-span-3" aria-hidden="true">
                          {(hilo.contactoNombre || hilo.contactoCorreo).charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-[13px] ${hilo.noLeidos ? "font-semibold" : "font-medium"}`}>
                              {hilo.contactoNombre || hilo.contactoCorreo}
                            </span>
                            {hilo.noLeidos > 0 ? (
                              <span className="correo-no-leidos">
                                {hilo.noLeidos}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block truncate text-[12px] text-[var(--color-cuerpo)]">
                            {hilo.asunto}
                          </span>
                          <span className="mt-1 block truncate text-[11px] font-light text-[var(--color-n600)]">
                            {hilo.ultimoResumen}
                          </span>
                        </span>
                        <span className="cifra pt-0.5 text-[8.5px] text-[var(--color-n500)] whitespace-nowrap">
                          {FORMATO_HORA.format(new Date(hilo.ultimoMensajeEn))}
                        </span>
                        {hilo.asignadoNombre ? (
                          <span className="col-start-2 text-[8.5px] font-medium tracking-[.1em] uppercase text-[var(--color-accent)]">
                            {hilo.asignadoNombre}
                          </span>
                        ) : (
                          <span className="col-start-2 cifra text-[8px] text-[var(--color-n400)]">
                            {String(indice + 1).padStart(2, "0")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </Bandeja>

        <div className={`min-h-0 ${!seleccionado ? "hidden xl:block" : "block"}`}>
          <Bandeja className="correo-panel" oscura={!seleccionado}>
            {!seleccionado ? (
              <div className="grid h-full content-between p-8 lg:p-12">
                <p className="rotulo text-white/45">Correspondencia Alpha</p>
                <div className="max-w-[34rem]">
                  <p className="text-[clamp(2rem,4vw,4rem)] font-semibold tracking-[-.055em] leading-[.98]">
                    Una bandeja para el equipo, con cada respuesta en contexto.
                  </p>
                  <p className="mt-6 max-w-[46ch] text-[13px] font-light leading-[1.8] text-white/55">
                    Selecciona una conversacion. Los adjuntos, responsables y estados de entrega
                    quedan organizados en un solo lugar.
                  </p>
                </div>
              </div>
            ) : detalle === undefined ? (
              <Cargando que="la conversacion" />
            ) : detalle === null ? (
              <Vacio titulo="Conversacion no disponible" ayuda="Puede haberse eliminado o movido." />
            ) : (
              <Conversacion
                detalle={detalle}
                remitentes={configuracion?.remitentes ?? [REMITENTE_PREDETERMINADO]}
                volver={() => setSeleccionado(null)}
                eliminado={() => setSeleccionado(null)}
              />
            )}
          </Bandeja>
        </div>
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
            setEstado("abierto");
            setSeleccionado(threadId);
          }}
        />
      ) : null}
    </div>
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
      <section className="correo-conversacion flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex-none border-b border-[var(--hair)]">
          <div className="correo-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="correo-icono-boton xl:hidden"
              onClick={volver}
              aria-label="Volver a la bandeja"
            >
              <IconoVolver />
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="correo-accion"
                onClick={() => void aplicar(() => tomar({ id: hilo._id, tomar: !hilo.asignadoA }))}
              >
                <IconoUsuario />
                {hilo.asignadoA ? "Liberar" : "Tomar"}
              </button>
              <select
                aria-label="Estado de la conversacion"
                className="correo-estado"
                value={hilo.estado}
                onChange={(event) =>
                  void aplicar(() =>
                    cambiarEstado({ id: hilo._id, estado: event.target.value as EstadoHiloCorreo }),
                  )
                }
              >
                {ESTADOS_HILO_CORREO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETAS[opcion]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="correo-icono-boton correo-eliminar"
                onClick={() => setConfirmando(true)}
                aria-label="Eliminar conversacion"
                title="Eliminar conversacion"
              >
                <IconoPapelera />
              </button>
            </div>
          </div>
          <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-8">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <h2 className="min-w-0 flex-1 text-[clamp(1.55rem,3vw,2.45rem)] font-semibold tracking-[-.045em] leading-[1.08]">
                {hilo.asunto}
              </h2>
              <span className="correo-estado-etiqueta">{ETIQUETAS[hilo.estado]}</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="correo-avatar correo-avatar-grande" aria-hidden="true">
                {(hilo.contactoNombre || hilo.contactoCorreo).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">
                  {hilo.contactoNombre || hilo.contactoCorreo}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--color-n600)]">
                  {hilo.contactoCorreo}
                  {hilo.asignadoNombre ? ` · Responsable: ${hilo.asignadoNombre}` : ""}
                </p>
              </div>
            </div>
            {error ? <div className="mt-4"><Aviso tono="error">{error}</Aviso></div> : null}
          </div>
        </header>

        <ol className="correo-mensajes correo-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          {detalle.mensajes.map((mensaje) => (
            <li
              key={mensaje._id}
              className={`correo-mensaje ${mensaje.direccion === "saliente" ? "correo-mensaje-saliente" : ""}`}
            >
              <div className="correo-mensaje-cabecera">
                <span className="correo-avatar" aria-hidden="true">
                  {mensaje.direccion === "entrante"
                    ? (hilo.contactoNombre || mensaje.de).charAt(0).toUpperCase()
                    : "A"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold">
                    {mensaje.direccion === "entrante" ? mensaje.de : "Alpha CCM"}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-[var(--color-n500)]">
                    Para {mensaje.para.join(", ")}
                    {mensaje.direccion === "saliente" ? ` · ${ETIQUETAS[mensaje.estado] ?? mensaje.estado}` : ""}
                  </p>
                </div>
                <p className="cifra shrink-0 text-[8.5px] text-[var(--color-n500)]">
                  {fechaHora(mensaje.creadoEn)}
                </p>
              </div>
              <CuerpoMensaje mensaje={mensaje} />
              {mensaje.adjuntos.length > 0 ? (
                <ul className="correo-adjuntos grid gap-2 sm:grid-cols-2">
                  {mensaje.adjuntos.map((adjunto) => (
                    <li key={adjunto._id}><AdjuntoMensaje adjunto={adjunto} /></li>
                  ))}
                </ul>
              ) : null}
              {mensaje.error ? (
                <div className="mt-4"><Aviso tono="error">{mensaje.error}</Aviso></div>
              ) : null}
            </li>
          ))}
          <li className="correo-responder-final">
            <button
              type="button"
              className="boton boton-linea group"
              onClick={() => setRespondiendo(true)}
            >
              <IconoResponder />
              Responder
            </button>
          </li>
        </ol>
      </section>

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
      ) : null}

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
    <div className="correo-dialogo-fondo" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`respuesta-titulo-${threadId}`}
        className="correo-respuesta-modal correo-compositor"
      >
        <div className="correo-respuesta-modal-nucleo">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="cejilla">Correo compartido de Alpha</p>
              <h3
                id={`respuesta-titulo-${threadId}`}
                className="mt-3 text-[clamp(1.7rem,4vw,2.6rem)] font-semibold tracking-[-.05em] leading-none"
              >
                Responder
              </h3>
              <p className="mt-3 truncate text-[11px] text-[var(--color-n600)]">Para {para}</p>
            </div>
            <button
              type="button"
              className="correo-icono-boton bg-[var(--color-surface)] text-[20px]"
              aria-label="Cerrar respuesta"
              disabled={ocupado || adjuntos.subiendo}
              onClick={cancelar}
            >
              ×
            </button>
          </div>
          <div className="campo mt-7 max-w-[22rem]">
            <label htmlFor={`respuesta-remitente-${threadId}`}>Desde</label>
            <SelectorPersonalizado
              id={`respuesta-remitente-${threadId}`}
              valor={remitente}
              opciones={remitentes.map((correo) => ({ valor: correo, etiqueta: correo }))}
              alCambiar={setRemitente}
            />
          </div>
          <div className="mt-7">
            <EditorCorreo id={`respuesta-${threadId}`} onChange={setContenido} autoFocus />
          </div>
          <AdjuntosSalida gestor={adjuntos} />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <span />}
            <div className="ml-auto flex gap-2">
              <button type="button" className="boton boton-linea" disabled={ocupado || adjuntos.subiendo} onClick={cancelar}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton"
                disabled={ocupado || adjuntos.subiendo || contenido.texto.trim() === ""}
                onClick={() => void responder()}
              >
                {ocupado ? "Enviando…" : "Enviar respuesta"}
              </button>
            </div>
          </div>
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
    <div className="fixed inset-0 z-20 bg-[rgba(13,33,64,.68)] backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-correo-titulo"
        className="correo-compositor w-full max-w-[760px] bg-[var(--color-surface)] p-[7px]"
      >
        <div className="bg-[var(--color-ground)] p-6 sm:p-9 max-h-[92dvh] overflow-y-auto">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="cejilla">Correo compartido de Alpha</p>
              <h2 id="nuevo-correo-titulo" className="mt-3 text-[2rem] sm:text-[2.7rem] font-semibold tracking-[-.055em] leading-none">
                Nuevo correo
              </h2>
            </div>
            <button
              type="button"
              className="grid size-10 place-items-center bg-[var(--color-surface)] text-[20px]"
              aria-label="Cerrar compositor"
              disabled={ocupado || adjuntos.subiendo}
              onClick={cancelar}
            >
              ×
            </button>
          </div>

          <div className="mt-8 grid gap-6">
            <div className="campo">
              <label htmlFor="nuevo-remitente">Desde</label>
              <SelectorPersonalizado
                id="nuevo-remitente"
                valor={remitente}
                opciones={remitentes.map((correo) => ({ valor: correo, etiqueta: correo }))}
                alCambiar={setRemitente}
              />
            </div>
            <div className="campo">
              <label htmlFor="nuevo-para">Para</label>
              <input
                id="nuevo-para"
                className="entrada"
                type="email"
                value={para}
                maxLength={320}
                onChange={(event) => setPara(event.target.value)}
                placeholder="persona@ejemplo.com"
                autoFocus
              />
            </div>
            <div className="campo">
              <label htmlFor="nuevo-asunto">Asunto</label>
              <input
                id="nuevo-asunto"
                className="entrada"
                value={asunto}
                maxLength={180}
                onChange={(event) => setAsunto(event.target.value)}
                placeholder="Asunto del mensaje"
              />
            </div>
            <div className="campo">
              <label htmlFor="nuevo-texto">Mensaje</label>
              <EditorCorreo id="nuevo-texto" onChange={setContenido} />
            </div>
            <AdjuntosSalida gestor={adjuntos} />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            {error ? <Aviso tono="error">{error}</Aviso> : <span />}
            <div className="flex gap-2">
              <button type="button" className="boton boton-linea" disabled={ocupado || adjuntos.subiendo} onClick={cancelar}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton"
                disabled={ocupado || adjuntos.subiendo || !para || !asunto.trim() || !contenido.texto.trim()}
                onClick={() => void mandar()}
              >
                {ocupado ? "Enviando…" : "Enviar correo"}
              </button>
            </div>
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
    <div className="correo-dialogo-fondo" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eliminar-correo-titulo"
        aria-describedby="eliminar-correo-descripcion"
        className="correo-dialogo"
      >
        <p className="cejilla">Accion permanente</p>
        <h3 id="eliminar-correo-titulo" className="mt-3 text-[1.65rem] font-semibold tracking-[-.045em]">
          Eliminar conversacion
        </h3>
        <p id="eliminar-correo-descripcion" className="mt-4 text-[12.5px] font-light leading-[1.75] text-[var(--color-cuerpo)]">
          Se borraran el hilo &quot;{asunto}&quot;, sus mensajes y todos los archivos adjuntos guardados.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="boton boton-linea" disabled={ocupado} onClick={cancelar}>
            Cancelar
          </button>
          <button type="button" className="boton boton-peligro" disabled={ocupado} onClick={confirmar}>
            {ocupado ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.35]">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function IconoVolver() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[17px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 5-5 5 5 5M3.5 10H17" />
    </svg>
  );
}

function IconoUsuario() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[15px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 9a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 10 9ZM4.5 16.5c.4-3.1 2.15-4.75 5.5-4.75s5.1 1.65 5.5 4.75" />
    </svg>
  );
}

function IconoPapelera() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[17px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6h11M8 3.5h4M6 6l.6 10.5h6.8L14 6M8.25 9v4.5M11.75 9v4.5" />
    </svg>
  );
}

function IconoResponder() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[16px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8.25 5-5 5 5 5M3.5 10h7.25c3.25 0 5.25 1.5 5.75 4.5" />
    </svg>
  );
}

function IconoClip() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[16px] fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.2 10.8 5.2-5.2a2.55 2.55 0 0 1 3.6 3.6l-6.35 6.35a4 4 0 0 1-5.65-5.65l6.1-6.1M6.8 12.2l5.85-5.85" />
    </svg>
  );
}

function IconoDescarga() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[16px] shrink-0 fill-none stroke-current stroke-[1.35]" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v9m0 0 3.4-3.4M10 12 6.6 8.6M4 15.5h12" />
    </svg>
  );
}
