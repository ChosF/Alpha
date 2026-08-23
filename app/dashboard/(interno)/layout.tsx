import type { ReactNode } from "react";
import { Navegacion } from "./navegacion";

/**
 * Armazon del panel: riel oscuro fijo a la izquierda y area de trabajo clara.
 * El contraste ink/ground es el mismo par que usa la landing en sus bloques
 * oscuros, de modo que la herramienta se lee como parte de Alpha.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="panel-shell min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[248px_minmax(0,1fr)] lg:overflow-hidden">
      <Navegacion />
      <main className="panel-main relative z-0 min-w-0 w-full max-w-[1480px] px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 lg:col-start-2 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain lg:px-12 lg:py-14">
        {children}
      </main>
    </div>
  );
}
