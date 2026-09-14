"use client";
import Link from "next/link";
import styles from "./boleto.module.css";

export default function ErrorBoleto({ reset }: { reset: () => void }) {
  return <main className={styles.page}><div className={styles.shell}><section className={styles.ticket}>
    <div className={styles.status} role="alert"><h1>No se pudo verificar</h1><p>Revisa tu conexión o inicia sesión de nuevo. No confirmes el ingreso sin validar el boleto.</p></div>
    <div className={styles.actions}><button onClick={reset}>Volver a intentar</button></div>
    <div className={styles.actions}><Link href="/dashboard">Volver al dashboard</Link></div>
  </section></div></main>;
}
