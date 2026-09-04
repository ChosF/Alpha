"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Encabezado } from "@/components/panel/ui/primitivas";
import { NavegacionEventos } from "./navegacion-eventos";

export default function EventosLayout({ children }: { children: ReactNode }) {
  const segmentos = usePathname().split("/").filter(Boolean);
  const esDetalle =
    segmentos.length === 3 &&
    segmentos[0] === "dashboard" &&
    segmentos[1] === "eventos" &&
    segmentos[2] !== "programa";

  return (
    <>
      {!esDetalle ? (
        <>
          <Encabezado
            titulo="Eventos"
            descripcion="Asistentes por evento y programa de trabajo del semestre."
          />
          <NavegacionEventos />
        </>
      ) : null}
      {children}
    </>
  );
}
