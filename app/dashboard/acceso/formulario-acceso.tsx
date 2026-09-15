"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { MarcaAlpha } from "@/components/marca-alpha";
import styles from "./acceso.module.css";

function Icono({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function FormularioAcceso({ destino }: { destino: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const boleto = destino.startsWith("/dashboard/boletos");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const datos = new FormData(evento.currentTarget);
    setOcupado(true);
    setError(null);
    try {
      await signIn("password", {
        email: String(datos.get("correo") ?? "").trim(),
        password: String(datos.get("contrasena") ?? ""),
        flow: "signIn",
      });
      router.replace(destino);
    } catch {
      // Never disclose whether an account exists.
      setError("No pudimos iniciar sesión. Revisa tu correo y contraseña e inténtalo de nuevo.");
      setOcupado(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="titulo-acceso">
        <header className={styles.brand}>
          <div className={styles.grid} aria-hidden="true" />
          <div className={styles.lockup}>
            <MarcaAlpha className={styles.logo} tono="blanco" />
            <p className={styles.eyebrow}>{boleto ? "CONTROL DE ACCESO" : "GESTIÓN ALPHA"}</p>
          </div>
        </header>
        <div className={styles.content}>
          <h1 id="titulo-acceso">{boleto ? "ACCESO DEL STAFF" : "INICIAR SESIÓN"}</h1>
          <p className={styles.subtitle}>{boleto ? "Valida el boleto desde tu cuenta de Alpha." : "Accede al dashboard de Alpha."}</p>
          {boleto ? (
            <div className={styles.notice} id="aviso-staff">
              <p><strong>Inicia sesión solo si eres administrador o parte del staff de Alpha.</strong></p>
              <p>Si vienes al evento, no necesitas iniciar sesión. Muestra tu QR al equipo de acceso para que valide tu boleto.</p>
            </div>
          ) : null}
          <form method="post" onSubmit={(e) => void entrar(e)} className={styles.form} aria-busy={ocupado} aria-describedby={boleto ? "aviso-staff" : undefined}>
            <div className={styles.field}>
              <label htmlFor="correo">Correo electrónico</label>
              <div className={styles.inputWrap}>
                <Icono><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></Icono>
                <input id="correo" name="correo" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" required disabled={ocupado} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="contrasena">Contraseña</label>
              <div className={styles.inputWrap}>
                <Icono><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></Icono>
                <input id="contrasena" name="contrasena" type={mostrarContrasena ? "text" : "password"} autoComplete="current-password" required disabled={ocupado} />
                <button className={styles.visibility} type="button" aria-label={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={mostrarContrasena} onClick={() => setMostrarContrasena(!mostrarContrasena)}>
                  <Icono><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{mostrarContrasena ? <path d="m3 3 18 18" /> : null}</Icono>
                </button>
              </div>
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button type="submit" className={styles.submit} disabled={ocupado}>{ocupado ? "Entrando…" : boleto ? "Entrar como staff" : "Entrar"}</button>
            <p className={styles.help}>Acceso por invitación. Si necesitas ayuda, contacta a un administrador.</p>
          </form>
        </div>
        <footer className={styles.footer}>Sociedad Estudiantil Alpha · Tec de Monterrey CCM</footer>
      </section>
    </main>
  );
}
