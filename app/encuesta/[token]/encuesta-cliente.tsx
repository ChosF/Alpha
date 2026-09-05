"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { MarcaAlpha } from "@/components/marca-alpha";
import estilos from "./encuesta.module.css";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "disponible"; eventoTitulo: string }
  | { tipo: "respondida"; eventoTitulo?: string }
  | { tipo: "invalida" }
  | { tipo: "error"; mensaje: string };

const CONTENIDO = [
  { valor: "excelente", etiqueta: "Excelente" },
  { valor: "bueno", etiqueta: "Bueno" },
  { valor: "regular", etiqueta: "Regular" },
  { valor: "malo", etiqueta: "Malo" },
] as const;

const ORIGENES = [
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "whatsapp", etiqueta: "WhatsApp" },
  { valor: "correo", etiqueta: "Correo" },
] as const;

export function EncuestaCliente({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [calificacion, setCalificacion] = useState(0);
  const [contenido, setContenido] = useState("");
  const [origen, setOrigen] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    void fetch(`/api/encuesta/${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controlador.signal,
    })
      .then(async (respuesta) => {
        const datos = (await respuesta.json()) as {
          estado?: "disponible" | "respondida" | "invalida";
          eventoTitulo?: string;
          error?: string;
        };
        if (!respuesta.ok) throw new Error(datos.error || "No pudimos abrir la encuesta.");
        if (datos.estado === "disponible" && datos.eventoTitulo) {
          setEstado({ tipo: "disponible", eventoTitulo: datos.eventoTitulo });
        } else if (datos.estado === "respondida") {
          setEstado({ tipo: "respondida", eventoTitulo: datos.eventoTitulo });
        } else {
          setEstado({ tipo: "invalida" });
        }
      })
      .catch((motivo: unknown) => {
        if (motivo instanceof DOMException && motivo.name === "AbortError") return;
        setEstado({
          tipo: "error",
          mensaje: motivo instanceof Error ? motivo.message : "No pudimos abrir la encuesta.",
        });
      });
    return () => controlador.abort();
  }, [token]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (estado.tipo !== "disponible" || !calificacion || !contenido || !origen) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/encuesta/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calificacionEvento: calificacion,
          opinionContenido: contenido,
          origen,
          comentarios,
        }),
      });
      const datos = (await respuesta.json()) as { error?: string };
      if (!respuesta.ok) throw new Error(datos.error || "No pudimos enviar tu respuesta.");
      setEstado({ tipo: "respondida", eventoTitulo: estado.eventoTitulo });
    } catch (motivo) {
      setError(motivo instanceof Error ? motivo.message : "No pudimos enviar tu respuesta.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className={estilos.pagina}>
      <div className={estilos.trama} aria-hidden="true" />
      <header className={estilos.cabecera}>
        <Link href="/" aria-label="Ir al sitio de Alpha">
          <MarcaAlpha className={estilos.marca} tono="blanco" />
        </Link>
        <span>Sociedad Estudiantil de Finanzas</span>
      </header>

      <section className={estilos.marco}>
        <div className={estilos.hero}>
          <p className={estilos.cejilla}>Encuesta de satisfacción</p>
          <h1>Tu experiencia cuenta.</h1>
          <p>Nos toma menos de dos minutos escucharte.</p>
        </div>

        <div className={estilos.nucleo}>
          {estado.tipo === "cargando" ? (
            <EstadoMensaje titulo="Preparando la encuesta" texto="Estamos verificando tu enlace personal." cargando />
          ) : estado.tipo === "invalida" ? (
            <EstadoMensaje
              titulo="Este enlace no está disponible"
              texto="Comprueba que el enlace esté completo. Si ya enviaste la encuesta, quedó cerrado para proteger una sola respuesta."
            />
          ) : estado.tipo === "error" ? (
            <EstadoMensaje titulo="No pudimos abrir la encuesta" texto={estado.mensaje} />
          ) : estado.tipo === "respondida" ? (
            <EstadoMensaje
              titulo="Gracias por compartirlo"
              texto={`Tu respuesta${estado.eventoTitulo ? ` sobre ${estado.eventoTitulo}` : ""} quedó registrada. Este enlace ya está cerrado.`}
              exito
            />
          ) : (
            <form onSubmit={enviar} className={estilos.formulario}>
              <div className={estilos.intro}>
                <span>Evento</span>
                <h2>{estado.eventoTitulo}</h2>
                <p>Las respuestas se presentan al equipo de forma agregada.</p>
              </div>

              <fieldset className={estilos.pregunta}>
                <legend>
                  <span>01</span>
                  ¿Cómo calificas el evento?
                </legend>
                <div className={estilos.estrellas} aria-label="Calificación de 1 a 5 estrellas">
                  {[1, 2, 3, 4, 5].map((valor) => (
                    <label key={valor} data-activa={valor <= calificacion}>
                      <input
                        type="radio"
                        name="calificacion"
                        value={valor}
                        checked={calificacion === valor}
                        onChange={() => setCalificacion(valor)}
                        required
                      />
                      <span aria-hidden="true">★</span>
                      <span className={estilos.srOnly}>{valor} {valor === 1 ? "estrella" : "estrellas"}</span>
                    </label>
                  ))}
                </div>
                <p className={estilos.ayuda}>{calificacion ? `${calificacion} de 5` : "Selecciona una calificación"}</p>
              </fieldset>

              <fieldset className={estilos.pregunta}>
                <legend>
                  <span>02</span>
                  ¿Qué te pareció el contenido?
                </legend>
                <div className={estilos.opciones}>
                  {CONTENIDO.map((opcion) => (
                    <label key={opcion.valor} data-activa={contenido === opcion.valor}>
                      <input
                        type="radio"
                        name="contenido"
                        value={opcion.valor}
                        checked={contenido === opcion.valor}
                        onChange={() => setContenido(opcion.valor)}
                        required
                      />
                      <span>{opcion.etiqueta}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className={estilos.pregunta}>
                <legend>
                  <span>03</span>
                  ¿Cómo te enteraste del evento?
                </legend>
                <div className={estilos.opciones}>
                  {ORIGENES.map((opcion) => (
                    <label key={opcion.valor} data-activa={origen === opcion.valor}>
                      <input
                        type="radio"
                        name="origen"
                        value={opcion.valor}
                        checked={origen === opcion.valor}
                        onChange={() => setOrigen(opcion.valor)}
                        required
                      />
                      <span>{opcion.etiqueta}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={estilos.pregunta} htmlFor="comentarios">
                <span className={estilos.etiquetaPregunta}>
                  <span>04</span>
                  Comentarios. ¿Qué mejorarías?
                </span>
                <textarea
                  id="comentarios"
                  value={comentarios}
                  maxLength={2_000}
                  rows={5}
                  onChange={(evento) => setComentarios(evento.target.value)}
                  placeholder="Cuéntanos con libertad. Este campo es opcional."
                />
                <small>{comentarios.length}/2000</small>
              </label>

              {error ? <p className={estilos.error} role="alert">{error}</p> : null}
              <button
                type="submit"
                disabled={enviando || !calificacion || !contenido || !origen}
                className={estilos.enviar}
              >
                <span>{enviando ? "Enviando respuesta" : "Enviar respuesta"}</span>
                <i aria-hidden="true">→</i>
              </button>
              <p className={estilos.nota}>El enlace se cierra después de enviar. Abrirlo o recargarlo no lo consume.</p>
            </form>
          )}
        </div>
      </section>

      <footer className={estilos.pie}>Alpha · Tecnológico de Monterrey, Campus Ciudad de México</footer>
    </main>
  );
}

function EstadoMensaje({
  titulo,
  texto,
  cargando = false,
  exito = false,
}: {
  titulo: string;
  texto: string;
  cargando?: boolean;
  exito?: boolean;
}) {
  return (
    <div className={estilos.estado}>
      <span className={estilos.estadoIcono} data-exito={exito || undefined} aria-hidden="true">
        {cargando ? <i /> : exito ? "✓" : "×"}
      </span>
      <h2>{titulo}</h2>
      <p>{texto}</p>
      {!cargando ? <Link href="/">Volver a alphaccm.org</Link> : null}
    </div>
  );
}
