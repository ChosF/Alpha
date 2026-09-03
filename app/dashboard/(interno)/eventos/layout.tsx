import type { ReactNode } from "react";
import { Encabezado } from "@/components/panel/ui/primitivas";
import { NavegacionEventos } from "./navegacion-eventos";

export default function EventosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Encabezado
        titulo="Eventos"
        descripcion="Asistentes por evento y programa de trabajo del semestre."
      />
      <NavegacionEventos />
      {children}
    </>
  );
}
