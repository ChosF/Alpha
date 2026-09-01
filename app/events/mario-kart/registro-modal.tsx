"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { MARIO_KART_CHALLENGE } from "@/lib/mario-kart";
import { renovarToken, tomarToken } from "./registro-cliente";
import estilos from "./mario-kart.module.css";

type Propiedades = {
  onCerrar: () => void;
};

type Mensaje = {
  texto: string;
  error: boolean;
};

const CIERRE_MS = 150;

export function ModalRegistro({ onCerrar }: Propiedades) {
  const [visible, setVisible] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [token, setToken] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [completo, setCompleto] = useState(false);
  const formularioRef = useRef<HTMLFormElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const temporizadorCierre = useRef<number | null>(null);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => setVisible(true));
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();

    let activo = true;
    void tomarToken().then((nuevoToken) => {
      if (activo) setToken(nuevoToken);
    });

    return () => {
      activo = false;
      window.cancelAnimationFrame(cuadro);
      document.body.style.overflow = overflowAnterior;
      if (temporizadorCierre.current !== null) {
        window.clearTimeout(temporizadorCierre.current);
      }
    };
  }, []);

  const cerrar = () => {
    if (cerrando) return;
    setCerrando(true);
    setVisible(false);
    temporizadorCierre.current = window.setTimeout(onCerrar, CIERRE_MS);
  };

  const contenerFoco = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrar();
      return;
    }
    if (evento.key !== "Tab") return;

    const elementos = Array.from(
      evento.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], textarea:not(:disabled)',
      ),
    ).filter((elemento) => elemento.offsetParent !== null);

    if (elementos.length === 0) return;
    const primero = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo?.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero?.focus();
    }
  };

  const mostrarError = (texto: string) => {
    setMensaje({ texto, error: true });
    const formulario = formularioRef.current;
    const claseError = estilos.formularioError;
    if (!formulario || !claseError) return;
    formulario.classList.remove(claseError);
    void formulario.offsetWidth;
    formulario.classList.add(claseError);
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (ocupado) return;

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const cuerpo = {
      nombre: String(datos.get("nombre") ?? ""),
      correo: String(datos.get("correo") ?? ""),
      carrera: String(datos.get("carrera") ?? ""),
      semestre: String(datos.get("semestre") ?? ""),
      matricula: String(datos.get("matricula") ?? ""),
      avisosCorreo: datos.get("avisosCorreo") !== null,
      whatsapp: datos.get("whatsapp") !== null,
      telefono: String(datos.get("telefono") ?? ""),
      sitio_web: String(datos.get("sitio_web") ?? ""),
      token: token || (await tomarToken()),
    };

    setOcupado(true);
    setMensaje({ texto: "Guardando tu registro…", error: false });

    try {
      const respuesta = await fetch("/api/eventos/mario-kart/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const resultado = (await respuesta.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!respuesta.ok || !resultado.ok) {
        mostrarError(resultado.error ?? "No pudimos guardar tu registro. Intenta de nuevo.");
        return;
      }

      formulario.reset();
      setWhatsapp(false);
      setCompleto(true);
      setMensaje(null);
      const siguienteToken = await renovarToken();
      setToken(siguienteToken);
    } catch {
      mostrarError("Revisa tu conexión e intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  const clasesModal = [
    estilos.modal,
    visible ? estilos.modalAbierto : "",
    cerrando ? estilos.modalCerrando : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className={clasesModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mario-kart-registro-titulo"
      onKeyDown={contenerFoco}
    >
      <button
        type="button"
        className={estilos.modalFondo}
        aria-label="Cerrar registro"
        onClick={cerrar}
      />
      <div className={estilos.modalPanelExterior}>
        <div className={estilos.modalPanel}>
          <div className={estilos.modalCabecera}>
            <p>Mario Kart Challenge / Registro</p>
            <button
              ref={cerrarRef}
              type="button"
              className={estilos.cerrar}
              aria-label="Cerrar ventana de registro"
              onClick={cerrar}
            >
              <span>Cerrar</span>
              <i aria-hidden="true">×</i>
            </button>
          </div>

          <div className={estilos.modalContenido}>
            {completo ? (
              <div className={estilos.exito} role="status" aria-live="polite">
                <div className={estilos.exitoIcono} aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none">
                    <path d="m13 25 7 7 15-17" />
                  </svg>
                </div>
                <h2>Ya estás en la parrilla.</h2>
                <p>
                  Recibimos tu registro. También te enviaremos una confirmación por correo. Te
                  esperamos el {MARIO_KART_CHALLENGE.fechaTexto}, de {MARIO_KART_CHALLENGE.horaTexto},
                  en {MARIO_KART_CHALLENGE.sede}.
                </p>
                <button type="button" className={estilos.exitoCerrar} onClick={cerrar}>
                  Volver a la pista
                </button>
              </div>
            ) : (
              <>
                <div className={estilos.modalIntroduccion}>
                  <span>Registro de participante</span>
                  <h2 id="mario-kart-registro-titulo">Aparta tu lugar.</h2>
                  <p>
                    Déjanos tus datos para participar el {MARIO_KART_CHALLENGE.fechaTexto}, de {MARIO_KART_CHALLENGE.horaTexto}, en {MARIO_KART_CHALLENGE.sede}.
                  </p>
                </div>

                <form ref={formularioRef} className={estilos.formulario} onSubmit={(e) => void enviar(e)}>
                  <div className={estilos.camposDobles}>
                    <div className={estilos.campo}>
                      <label htmlFor="mk-nombre">Nombre completo</label>
                      <input
                        id="mk-nombre"
                        name="nombre"
                        autoComplete="name"
                        minLength={2}
                        maxLength={80}
                        required
                      />
                    </div>
                    <div className={estilos.campo}>
                      <label htmlFor="mk-correo">Correo</label>
                      <input
                        id="mk-correo"
                        name="correo"
                        type="email"
                        autoComplete="email"
                        maxLength={120}
                        required
                      />
                    </div>
                  </div>

                  <div className={estilos.camposDobles}>
                    <div className={estilos.campo}>
                      <label htmlFor="mk-carrera">Carrera</label>
                      <input id="mk-carrera" name="carrera" minLength={2} maxLength={80} required />
                    </div>
                    <div className={estilos.campo}>
                      <label htmlFor="mk-semestre">Semestre</label>
                      <input
                        id="mk-semestre"
                        name="semestre"
                        inputMode="numeric"
                        maxLength={30}
                        placeholder="Ej. 3"
                        required
                      />
                    </div>
                  </div>

                  <div className={estilos.campo}>
                    <label htmlFor="mk-matricula">Matrícula, opcional</label>
                    <input
                      id="mk-matricula"
                      name="matricula"
                      autoComplete="off"
                      maxLength={9}
                      pattern="A[0-9]{8}"
                      placeholder="A01234567"
                    />
                  </div>

                  <fieldset className={estilos.canales}>
                    <legend>¿Por dónde podemos contactarte?</legend>
                    <div className={estilos.canalesOpciones}>
                      <label className={estilos.opcion}>
                        <input name="avisosCorreo" type="checkbox" defaultChecked />
                        Correo electrónico
                      </label>
                      <label className={estilos.opcion}>
                        <input
                          name="whatsapp"
                          type="checkbox"
                          checked={whatsapp}
                          onChange={(e) => setWhatsapp(e.currentTarget.checked)}
                        />
                        WhatsApp
                      </label>
                    </div>
                  </fieldset>

                  <div className={estilos.campo}>
                    <label htmlFor="mk-telefono">Teléfono {whatsapp ? "" : "opcional"}</label>
                    <input
                      id="mk-telefono"
                      name="telefono"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      placeholder="5512345678"
                      required={whatsapp}
                    />
                  </div>

                  <div className={estilos.trampa} aria-hidden="true">
                    <label htmlFor="mk-sitio">Sitio web</label>
                    <input id="mk-sitio" name="sitio_web" tabIndex={-1} autoComplete="off" />
                  </div>

                  <p className={estilos.consentimiento}>
                    Al enviar aceptas que Alpha use estos datos para administrar el evento y
                    contactarte por los canales seleccionados. Consulta nuestros <a href="/terminos">Términos y aviso de privacidad</a>.
                  </p>

                  <button type="submit" className={estilos.enviar} disabled={ocupado}>
                    <span>{ocupado ? "Guardando…" : "Confirmar registro"}</span>
                    <i aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h13M13 6l6 6-6 6" />
                      </svg>
                    </i>
                  </button>

                  <p
                    className={`${estilos.mensajeFormulario} ${mensaje?.error ? estilos.mensajeError : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {mensaje?.texto ?? ""}
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
