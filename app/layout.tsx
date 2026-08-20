import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ProveedorConvex } from "./proveedores";
import "./globals.css";

/* Las fuentes se sirven desde el propio dominio: la CSP del panel no permite
   origenes externos, y ademas evita un salto de red en cada carga. */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--fuente-poppins",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard - Alpha",
  description: "Dashboard interno de la Sociedad Estudiantil Alpha.",
  icons: { icon: "/alpha-mark.png" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const documento = (
    <html lang="es" className={`${poppins.variable} ${mono.variable}`}>
      <body>
        <ProveedorConvex>{children}</ProveedorConvex>
      </body>
    </html>
  );

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return documento;
  }

  return <ConvexAuthNextjsServerProvider>{documento}</ConvexAuthNextjsServerProvider>;
}
