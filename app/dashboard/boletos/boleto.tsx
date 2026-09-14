"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery, useConvexConnectionState } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { MarcaAlpha } from "@/components/marca-alpha";
import { fechaEventoEnEspanol } from "@/lib/correo-evento";
import styles from "./boleto.module.css";

type Ticket = FunctionReturnType<typeof api.boletos.validar>;
const mensajes = {
  valido: ["Boleto válido", "Verifica el nombre antes de confirmar el ingreso."],
  invalido: ["Boleto inválido", "Este boleto no permite el ingreso. Revisa el registro en el dashboard."],
  vencido: ["Boleto vencido", "El periodo de ingreso a este evento ha terminado."],
  utilizado: ["Boleto utilizado", "La asistencia ya está registrada. Este boleto no admite otro ingreso."],
  pendiente: ["Ingreso no disponible", "El ingreso se habilita el día del evento. Si la fecha está pendiente, revísala en el dashboard."],
  sin_acceso: ["Acceso restringido", "Necesitas una cuenta activa con rol de administrador o editor para validar boletos."],
} as const;

export function Boleto({ codigo }: { codigo: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const conexion = useConvexConnectionState();
  const ticket = useQuery(api.boletos.validar, isAuthenticated ? { codigo } : "skip");
  const confirmar = useMutation(api.boletos.confirmar);
  const [actualizado, setActualizado] = useState<{ valor: Ticket; base: Ticket | undefined }>();
  const [ahora, setAhora] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const bloqueo = useRef(false);
  // The clock only hides an expired confirmation button. The server remains
  // authoritative and rechecks time and role for every admission.
  useEffect(() => {
    const refrescar = () => setAhora(Date.now());
    const timer = window.setInterval(refrescar, 1000);
    window.addEventListener("focus", refrescar);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refrescar); };
  }, []);
  const dato = actualizado?.base === ticket ? actualizado?.valor ?? ticket : ticket;
  const estado = !isLoading && !isAuthenticated ? "sin_acceso"
    : dato?.estado === "valido" && dato.venceEn && ahora >= dato.venceEn ? "vencido" : dato?.estado;
  const [titulo, descripcion] = isAuthenticated && !conexion.isWebSocketConnected
    ? ["Esperando conexión", "El boleto debe verificarse en línea antes de confirmar el ingreso."]
    : estado ? mensajes[estado] : ["Verificando boleto", "Consultando el estado del ingreso…"];

  async function admitir() {
    if (bloqueo.current || !conexion.isWebSocketConnected) return;
    bloqueo.current = true; setOcupado(true); setError("");
    try { setActualizado({ valor: await confirmar({ codigo }), base: ticket }); }
    catch { setError("No se pudo confirmar. Vuelve a verificar el boleto antes de intentar de nuevo."); }
    finally { bloqueo.current = false; setOcupado(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><MarcaAlpha className={styles.logo} /><Link href="/dashboard">Dashboard <span aria-hidden="true">↗</span></Link></header>
    <div className={styles.shell}><section className={styles.ticket} aria-busy={ocupado}>
      <p className={styles.eyebrow}>Control de ingreso</p>
      <div className={styles.status} data-status={estado} role="status" aria-live="polite">
        <div className={styles.symbol} aria-hidden="true">{!conexion.isWebSocketConnected ? "·" : estado === "valido" || estado === "utilizado" ? "✓" : estado === "invalido" || estado === "sin_acceso" ? "×" : "·"}</div>
        <h1>{titulo}</h1><p>{descripcion}</p>
      </div>
      {isAuthenticated && estado !== "sin_acceso" && dato?.nombre && <div className={styles.details}>
        <p className={styles.label}>Titular del boleto</p><h2>{dato.nombre}</h2>
        <div className={styles.event}><p className={styles.label}>Evento</p><h3>{dato.evento}</h3>
          {dato.fecha && <p>{fechaEventoEnEspanol(dato.fecha)}</p>}{dato.sede && <p>{dato.sede}</p>}
        </div>
        {dato.utilizadoEn && <p className={styles.receipt}>Asistencia registrada · {new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" }).format(dato.utilizadoEn)}</p>}
      </div>}
      <div className={styles.actions}>
        {estado === "valido" && <button disabled={ocupado || !conexion.isWebSocketConnected} onClick={() => void admitir()}>{ocupado ? "Confirmando…" : "Confirmar asistencia"}</button>}
        {!conexion.isWebSocketConnected && isAuthenticated && <p role="status">Sin conexión. Espera a reconectar para validar el ingreso.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {estado === "sin_acceso" && !isAuthenticated && <Link className={styles.login} href={`/dashboard/acceso?next=${encodeURIComponent(`/dashboard/boletos?id=${codigo}`)}`}>Iniciar sesión</Link>}
      </div>
    </section></div>
    <footer className={styles.footer}>Alpha · Acceso a eventos</footer>
  </main>;
}
