import type { ReactNode } from "react";
import { Cascaron } from "@/components/panel/ui/cascaron";
import "./panel.css";

/**
 * Armazon del panel interno: barra lateral retractil en escritorio, barra
 * inferior en movil, barra superior con busqueda y paleta de comandos.
 * El sistema visual vive en panel.css acotado a [data-panel].
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return <Cascaron>{children}</Cascaron>;
}
