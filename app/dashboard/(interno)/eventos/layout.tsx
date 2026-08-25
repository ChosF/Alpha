import type { ReactNode } from "react";
import { Titulo } from "@/components/panel/piezas";
import { NavegacionEventos } from "./navegacion-eventos";

export default function EventosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Titulo cejilla="Gestión de eventos">Eventos</Titulo>
      <NavegacionEventos />
      <div className="mt-5">{children}</div>
    </>
  );
}
