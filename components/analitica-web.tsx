"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

function filtrarRutasPrivadas(evento: BeforeSendEvent) {
  const ruta = new URL(evento.url, window.location.origin).pathname;
  const esPrivada =
    ruta === "/dashboard" ||
    ruta.startsWith("/dashboard/") ||
    ruta === "/panel" ||
    ruta.startsWith("/panel/");

  return esPrivada ? null : evento;
}

export function AnaliticaWeb() {
  return <Analytics beforeSend={filtrarRutasPrivadas} />;
}
