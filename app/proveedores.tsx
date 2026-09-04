"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { MarcaAlpha } from "@/components/marca-alpha";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

/* La landing consulta su programa por una ruta publica. El cliente reactivo
   sigue montandose solo en el dashboard, donde tambien vive la autenticacion. */
const cliente = url ? new ConvexReactClient(url) : null;

function ConfiguracionConvexFaltante() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#f4f7fb] px-6 py-16 text-[#081d3d]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(8,29,61,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,29,61,0.07)_1px,transparent_1px)] [background-size:72px_72px]"
      />
      <section
        className="relative w-full max-w-3xl border border-[#b9c7d9] bg-white px-7 py-10 shadow-[0_24px_80px_rgba(8,29,61,0.12)] sm:px-12 sm:py-14"
        role="alert"
      >
        <div className="mb-10 flex items-center justify-between border-b border-[#d9e1ec] pb-5">
          <MarcaAlpha className="h-auto w-[112px]" tono="navy" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#5f6f86]">
            Configuración local
          </span>
        </div>

        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#1764db]">
          Dashboard
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl">
          Conecta Convex para entrar
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#53627a] sm:text-lg">
          Este entorno todavía no tiene una URL de Convex. El sitio público sigue disponible,
          pero el acceso interno necesita completar su configuración local.
        </p>

        <div className="mt-9 border-l-4 border-[#1764db] bg-[#081d3d] px-5 py-5 text-white sm:px-6">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#9fc3ff]">
            Ejecuta desde la carpeta del proyecto
          </p>
          <code className="font-mono text-sm sm:text-base">npx convex dev</code>
        </div>

        <div className="mt-6 flex flex-col gap-5 border-t border-[#d9e1ec] pt-6 text-sm text-[#53627a] sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg leading-6">
            El comando crea <code className="font-mono text-xs text-[#081d3d]">.env.local</code> con
            la variable necesaria. Después, reinicia el servidor local.
          </p>
          <a
            className="shrink-0 font-semibold text-[#1764db] transition-colors hover:text-[#081d3d]"
            href="/"
          >
            Volver al sitio →
          </a>
        </div>
      </section>
    </main>
  );
}

export function ProveedorConvex({ children }: { children: ReactNode }) {
  if (cliente === null) {
    return <ConfiguracionConvexFaltante />;
  }
  return <ConvexAuthNextjsProvider client={cliente}>{children}</ConvexAuthNextjsProvider>;
}
