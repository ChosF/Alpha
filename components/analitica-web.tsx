"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { rutaAnalitica } from "@/lib/rutas-analitica";

function filtrarRutasPrivadas(evento: BeforeSendEvent) {
  const ruta = new URL(evento.url, window.location.origin).pathname;
  const esPrivada =
    ruta === "/dashboard" ||
    ruta.startsWith("/dashboard/") ||
    ruta === "/panel" ||
    ruta.startsWith("/panel/");

  if (esPrivada) return null;
  const url = new URL(evento.url);
  url.pathname = rutaAnalitica(ruta);
  url.search = "";
  url.hash = "";
  return { ...evento, url: url.toString() };
}

export function AnaliticaWeb() {
  return <Analytics beforeSend={filtrarRutasPrivadas} />;
}
