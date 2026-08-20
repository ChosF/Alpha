import type { ReactNode } from "react";
import { Navegacion } from "./navegacion";

/**
 * Armazon del panel: riel oscuro fijo a la izquierda y area de trabajo clara.
 * El contraste ink/ground es el mismo par que usa la landing en sus bloques
 * oscuros, de modo que la herramienta se lee como parte de Alpha.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[228px_1fr]">
      <Navegacion />
      <main className="px-5 py-10 sm:px-8 lg:px-12 lg:py-14 max-w-[1400px] w-full">
        {children}
      </main>
    </div>
  );
}
