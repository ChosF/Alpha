import type { ReactNode } from "react";
import { Titulo } from "@/components/panel/piezas";
import { NavegacionEventos } from "./navegacion-eventos";

export default function EventosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Titulo cejilla="Gestión de eventos" descripcion="Asistentes por evento y programa de trabajo del semestre.">
        Eventos
      </Titulo>
      <NavegacionEventos />
      <div>{children}</div>
    </>
  );
}
