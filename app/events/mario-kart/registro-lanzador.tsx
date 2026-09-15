"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { prepararToken } from "./registro-cliente";
import estilos from "./mario-kart.module.css";

const ModalRegistro = dynamic(
  () => import("./registro-modal").then((modulo) => modulo.ModalRegistro),
  {
    ssr: false,
    loading: () => (
      <div className={estilos.modalCarga} role="status" aria-live="polite">
        Preparando el registro…
      </div>
    ),
  },
);

function prepararRegistro() {
  if (typeof window === "undefined") return;
  void import("./registro-modal");
  void prepararToken();
}
export function LanzadorRegistro() {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const torneoRef = useRef<HTMLButtonElement>(null);
  const [torneo, setTorneo] = useState(false);
  const [enlace, setEnlace] = useState<{ invitacion?: string; solicitud?: string }>({});
  useEffect(() => {
    const desdeEnlace = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const invitacion = hash.get("equipo") ?? undefined;
      const solicitud = hash.get("solicitud") ?? undefined;
      if (invitacion || solicitud || window.location.hash === "#torneo") {
        setEnlace({ invitacion, solicitud }); setTorneo(true); setAbierto(true); prepararRegistro();
      }
    };
    const frame = window.requestAnimationFrame(desdeEnlace);
    window.addEventListener("hashchange", desdeEnlace);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("hashchange", desdeEnlace); };
  }, []);

  const abrir = () => {
    setTorneo(false);
    prepararRegistro();
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    window.requestAnimationFrame(() => (torneo ? torneoRef : botonRef).current?.focus());
  };

  return (
    <div className={estilos.registroAcciones}>
      <button
        ref={botonRef}
        type="button"
        className={estilos.registroBoton}
        onClick={abrir}
        onPointerEnter={prepararRegistro}
        onPointerDown={prepararRegistro}
        onFocus={prepararRegistro}
      >
        <span>Regístrate</span>
        <i aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </i>
      </button>
      <button ref={torneoRef} type="button" className={`${estilos.registroBoton} ${estilos.registroTorneo}`} onClick={() => { prepararRegistro(); setEnlace({}); setTorneo(true); setAbierto(true); }} onPointerEnter={prepararRegistro} onFocus={prepararRegistro}>
        <span>Únete al torneo</span><i aria-hidden="true">↗</i>
      </button>
      {abierto ? <ModalRegistro onCerrar={cerrar} torneo={torneo} {...enlace} /> : null}
    </div>
  );
}
