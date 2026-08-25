"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type Estilos = Record<string, string>;

async function obtenerToken(): Promise<string> {
  try {
    const respuesta = await fetch("/api/registro/token", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const datos = (await respuesta.json()) as { token?: string };
    return respuesta.ok && datos.token ? datos.token : "";
  } catch {
    return "";
  }
}

export function FormularioCallingLaf({ estilos }: { estilos: Estilos }) {
  const [abierto, setAbierto] = useState(false);
  const [token, setToken] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const [completo, setCompleto] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  const pedirToken = async () => setToken(await obtenerToken());

  useEffect(() => {
    let activo = true;
    void obtenerToken().then((nuevoToken) => {
      if (activo) setToken(nuevoToken);
    });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    setCompleto(false);
    setMensaje(null);
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
      token,
    };

    setOcupado(true);
    setMensaje({ texto: "Guardando tu registro...", error: false });
    try {
      const respuesta = await fetch("/api/eventos/calling-laf/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const resultado = (await respuesta.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!respuesta.ok || !resultado.ok) {
        setMensaje({
          texto: resultado.error ?? "No pudimos guardar tu registro. Intenta de nuevo.",
          error: true,
        });
        return;
      }
      formulario.reset();
      setWhatsapp(false);
      setCompleto(true);
      setMensaje(null);
      setToken("");
      void pedirToken();
    } catch {
      setMensaje({ texto: "Revisa tu conexion e intenta de nuevo.", error: true });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <button type="button" className={estilos.enlaceFormulario} onClick={() => setAbierto(true)}>
        Quiero registrarme <span aria-hidden="true">↗</span>
      </button>
      {abierto ? (
        <div
          className={estilos.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calling-laf-registro-titulo"
          onKeyDown={contenerFoco}
        >
          <button
            type="button"
            className={estilos.modalFondo}
            aria-label="Cerrar registro"
            onClick={cerrar}
          />
          <div className={estilos.modalPanel}>
            <div className={estilos.modalCabecera}>
              <p>Calling LAF / Registro</p>
              <button ref={cerrarRef} type="button" className={estilos.cerrar} onClick={cerrar}>
                <span>Cerrar</span>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className={estilos.modalContenido}>
              {completo ? (
                <div className={estilos.exito} role="status" aria-live="polite">
                  <span aria-hidden="true">✓</span>
                  <p>Tu registro quedó listo.</p>
                  <h3>Nos vemos en Calling LAF.</h3>
                  <button type="button" onClick={() => setCompleto(false)}>
                    Registrar a otra persona
                  </button>
                </div>
              ) : (
                <>
                  <div className={estilos.registroIntro}>
                    <p className={estilos.cejilla}>Registro</p>
                    <h2 id="calling-laf-registro-titulo">Reserva tu lugar</h2>
                    <p>
                      Déjanos tus datos para incluirte en la lista de Calling LAF y compartirte las
                      indicaciones del evento por el medio que elijas.
                    </p>
                  </div>
                  <Formulario
                    estilos={estilos}
                    ocupado={ocupado}
                    token={token}
                    whatsapp={whatsapp}
                    mensaje={mensaje}
                    setWhatsapp={setWhatsapp}
                    enviar={enviar}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Formulario({
  estilos,
  ocupado,
  token,
  whatsapp,
  mensaje,
  setWhatsapp,
  enviar,
}: {
  estilos: Estilos;
  ocupado: boolean;
  token: string;
  whatsapp: boolean;
  mensaje: { texto: string; error: boolean } | null;
  setWhatsapp: (valor: boolean) => void;
  enviar: (evento: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className={estilos.formulario} onSubmit={(e) => void enviar(e)} noValidate>
      <div className={estilos.campos}>
        <label>
          <span>Nombre</span>
          <input name="nombre" autoComplete="name" placeholder="Nombre y apellido" required />
        </label>
        <label>
          <span>Correo</span>
          <input name="correo" type="email" autoComplete="email" placeholder="nombre@correo.com" required />
        </label>
        <label>
          <span>Carrera</span>
          <input name="carrera" placeholder="LAF" required />
        </label>
        <label>
          <span>Semestre</span>
          <input name="semestre" placeholder="7.º semestre" required />
        </label>
        <label>
          <span>Matrícula, opcional</span>
          <input name="matricula" autoCapitalize="characters" placeholder="A01234567" />
        </label>
        {whatsapp ? (
          <label>
            <span>Teléfono, 10 dígitos</span>
            <input
              name="telefono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="55 1234 5678"
              required
            />
          </label>
        ) : null}
      </div>

      <fieldset className={estilos.contacto}>
        <legend>¿Cómo quieres recibir las indicaciones?</legend>
        <label>
          <input type="checkbox" name="avisosCorreo" defaultChecked />
          <span>Correo electrónico</span>
        </label>
        <label>
          <input
            type="checkbox"
            name="whatsapp"
            checked={whatsapp}
            onChange={(e) => setWhatsapp(e.target.checked)}
          />
          <span>WhatsApp</span>
        </label>
      </fieldset>

      <div className={estilos.trampa} aria-hidden="true">
        <label htmlFor="evento-sitio">No llenar</label>
        <input id="evento-sitio" name="sitio_web" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={estilos.envio}>
        <button type="submit" disabled={ocupado || !token}>
          {ocupado ? "Enviando..." : "Enviar registro"}
          <span aria-hidden="true">↗</span>
        </button>
        {mensaje ? (
          <p className={mensaje.error ? estilos.error : estilos.progreso} role="status" aria-live="polite">
            {mensaje.texto}
          </p>
        ) : null}
      </div>

      <p className={estilos.privacidad}>
        Usamos tus datos para gestionar Calling LAF y contactarte sobre este evento. Puedes pedir tu
        baja escribiendo a contacto@alphaccm.org.
      </p>
    </form>
  );
}
