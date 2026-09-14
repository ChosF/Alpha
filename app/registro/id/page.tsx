"use client";

import { useEffect } from "react";
import { destinoBoletoDesdeUrl } from "@/lib/destino-dashboard";

/** Preserve the exact address embedded in old QR codes. No ticket is read here. */
export default function Registro() {
  useEffect(() => {
    window.location.replace(destinoBoletoDesdeUrl(window.location.href));
  }, []);
  return <main className="min-h-dvh flex items-center justify-center p-6 bg-[#f2f4f7] text-[#194270]">
    <p role="status">Abriendo boleto…</p>
    <noscript>Activa JavaScript para abrir el boleto en el dashboard.</noscript>
  </main>;
}
