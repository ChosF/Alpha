"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Aviso } from "@/components/panel/piezas";
import { MarcaAlpha } from "@/components/marca-alpha";

/**
 * Acceso al panel.
 *
 * Pantalla partida: bloque de tinta a la izquierda con la marca, formulario a
 * la derecha. El error nunca dice si fallo el correo o la contrasena; decirlo
 * seria confirmarle a un atacante que esa cuenta existe.
 */
export default function Acceso() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const entrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await signIn("password", { email: correo, password: contrasena, flow: "signIn" });
      router.push("/dashboard");
    } catch {
      setError("Correo o contrasena incorrectos.");
      setOcupado(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="bg-[var(--color-ink)] text-white px-8 py-14 lg:px-16 lg:py-20 flex flex-col justify-between">
        <div className="flex items-center gap-4">
          <MarcaAlpha className="h-auto w-[142px]" tono="blanco" />
          <span className="text-[10px] tracking-[.24em] uppercase text-white/45">Dashboard</span>
        </div>
        <div className="mt-16 lg:mt-0">
          <p className="text-[10px] tracking-[.3em] uppercase text-white/45">Uso interno</p>
          <p className="mt-6 text-[clamp(1.5rem,3vw,2.4rem)] font-bold leading-[1.1] tracking-[-.03em] max-w-[16ch]">
            Aqui se administra la convocatoria.
          </p>
          <p className="mt-6 text-[13px] font-light leading-[1.75] text-white/60 max-w-[42ch]">
            Registros, programa y accesos de la mesa directiva. Si necesitas entrar, pide una
            invitacion a quien lleva Presidencia.
          </p>
        </div>
        <p className="mt-16 lg:mt-0 text-[11px] text-white/35">
          Sociedad Estudiantil Alpha · Tec de Monterrey CCM
        </p>
      </div>

      <div className="px-8 py-14 lg:px-16 lg:py-20 flex items-center">
        <form onSubmit={(e) => void entrar(e)} className="w-full max-w-[380px]">
          <h1 className="text-[24px] font-bold tracking-[-.03em]">Entrar</h1>

          <div className="mt-9 grid gap-7">
            <div className="campo">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                className="entrada"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="contrasena">Contrasena</label>
              <input
                id="contrasena"
                className="entrada"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" className="boton mt-9 w-full justify-center" disabled={ocupado}>
            {ocupado ? "Entrando…" : "Entrar"}
          </button>

          {error ? (
            <div className="mt-5">
              <Aviso tono="error">{error}</Aviso>
            </div>
          ) : null}

          <p className="mt-9 text-[11px] leading-[1.7] text-[var(--color-n600)]">
            Las cuentas se crean solo por invitacion. Si perdiste el acceso, pide a un
            administrador que te invite de nuevo.
          </p>
        </form>
      </div>
    </div>
  );
}
