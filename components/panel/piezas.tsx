"use client";

import type { ReactNode } from "react";
import { ETIQUETAS } from "@/convex/lib/validadores";
import {
  Aviso as AvisoUi,
  Cargando as CargandoUi,
  Encabezado,
  Pildora,
  TONO_ESTADO,
  Vacio as VacioUi,
  fecha,
  fechaHora,
} from "@/components/panel/ui/primitivas";

/**
 * Piezas compartidas del panel (capa de compatibilidad).
 *
 * Las pantallas que crecieron con el panel anterior siguen importando de aqui;
 * por debajo todo se pinta con las primitivas nuevas de components/panel/ui,
 * asi que hablan el mismo idioma visual sin reescribirlas.
 *
 * Todo el texto que entra aqui viene de la base y lo escribieron terceros, asi
 * que se pinta siempre como texto: no hay un solo dangerouslySetInnerHTML en
 * el proyecto y la regla de ESLint lo impide.
 */

export { fecha, fechaHora };

/** Contenedor de datos: tarjeta plana con filete. */
export function Bandeja({
  children,
  oscura = false,
  className = "",
}: {
  children: ReactNode;
  oscura?: boolean;
  className?: string;
}) {
  return (
    <div className={`bandeja ${oscura ? "bandeja-ink" : ""} ${className}`}>
      <div className="nucleo">{children}</div>
    </div>
  );
}

export function Titulo({
  cejilla,
  children,
  descripcion,
  acciones,
}: {
  cejilla?: string;
  children: ReactNode;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <Encabezado
      cejilla={cejilla}
      titulo={typeof children === "string" ? children : String(children)}
      descripcion={descripcion}
      acciones={acciones}
    />
  );
}

/** Marcador de estado del dominio. */
export function Marca({ estado }: { estado: string }) {
  return (
    <Pildora tono={TONO_ESTADO[estado] ?? "neutro"} sm>
      {ETIQUETAS[estado] ?? estado}
    </Pildora>
  );
}

export function Vacio({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return <VacioUi titulo={titulo} ayuda={ayuda} />;
}

export function Cargando({ que }: { que: string }) {
  return <CargandoUi que={que} />;
}

export function Aviso({ tono, children }: { tono: "error" | "exito"; children: ReactNode }) {
  return <AvisoUi tono={tono}>{children}</AvisoUi>;
}
