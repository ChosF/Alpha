import type { ReactNode } from "react";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ProveedorConvex } from "../proveedores";

/**
 * Convex y la autenticacion solo se montan dentro del dashboard. Las paginas
 * publicas quedan como Server Components y no abren una conexion reactiva.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const contenido = <ProveedorConvex>{children}</ProveedorConvex>;

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return contenido;

  return <ConvexAuthNextjsServerProvider>{contenido}</ConvexAuthNextjsServerProvider>;
}
