"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
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

  const abrir = () => {
    prepararRegistro();
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    window.requestAnimationFrame(() => botonRef.current?.focus());
  };

  return (
    <>
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
      {abierto ? <ModalRegistro onCerrar={cerrar} /> : null}
    </>
  );
}
