"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

/* Si la variable falta, se avisa en consola en vez de romper el arbol: la
   landing publica no depende de Convex y debe seguir sirviendose. */
const cliente = url ? new ConvexReactClient(url) : null;

export function ProveedorConvex({ children }: { children: ReactNode }) {
  if (cliente === null) {
    return <>{children}</>;
  }
  return <ConvexAuthNextjsProvider client={cliente}>{children}</ConvexAuthNextjsProvider>;
}
