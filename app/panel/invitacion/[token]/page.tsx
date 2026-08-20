"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { validarContrasena, LARGO_MINIMO } from "@/convex/lib/contrasena";
import { Aviso } from "@/components/panel/piezas";

/**
 * Alta por invitacion.
 *
 * El token se comprueba antes de mostrar el formulario, para no pedirle datos
 * a alguien cuyo enlace ya caduco. La comprobacion de verdad ocurre igual en
 * el servidor al crear la cuenta: esta es solo cortesia.
 */
export default function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { signIn } = useAuthActions();
  const router = useRouter();

  const invitacion = useQuery(api.usuarios.verificarInvitacion, { token });
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const problema = contrasena === "" ? null : validarContrasena(contrasena);

  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (invitacion === null || invitacion === undefined) return;

    if (problema !== null) {
      setError(problema);
      return;
    }
    if (contrasena !== repetida) {
      setError("Las dos contrasenas no coinciden.");
      return;
    }

    setOcupado(true);
    setError(null);
    try {
      await signIn("password", {
        email: invitacion.correo,
        password: contrasena,
        nombre: invitacion.nombre,
        invitacion: token,
        flow: "signUp",
      });
      router.push("/panel");
    } catch {
      setError("No se pudo crear la cuenta. La invitacion pudo caducar o ya se uso.");
      setOcupado(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div>
          <span className="text-[24px] font-bold tracking-[-.04em]">Alpha</span>
          <span className="ml-2.5 text-[10px] tracking-[.24em] uppercase text-[var(--color-n500)]">
            Panel
          </span>
        </div>

        {invitacion === undefined ? (
          <p className="mt-12 text-[13px] text-[var(--color-n600)]">Comprobando la invitacion…</p>
        ) : invitacion === null ? (
          <div className="mt-12">
            <h1 className="text-[22px] font-bold tracking-[-.03em]">Esta invitacion ya no sirve</h1>
            <p className="mt-4 text-[13px] font-light leading-[1.75] text-[var(--color-cuerpo)]">
              Pudo caducar, ya se uso o fue revocada. Pide a un administrador que te envie una
              nueva.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void crear(e)} className="mt-12">
            <h1 className="text-[22px] font-bold tracking-[-.03em]">
              Hola, {invitacion.nombre || "bienvenida"}
            </h1>
            <p className="mt-4 text-[13px] font-light leading-[1.75] text-[var(--color-cuerpo)]">
              Vas a entrar como{" "}
              <span className="text-[var(--color-ink)] font-medium">
                {ETIQUETAS[invitacion.rol]}
              </span>{" "}
              con el correo{" "}
              <span className="cifra text-[12px]">{invitacion.correo}</span>. Elige una contrasena
              para terminar.
            </p>

            <div className="mt-9 grid gap-7">
              <div className="campo">
                <label htmlFor="c1">Contrasena</label>
                <input
                  id="c1"
                  className="entrada"
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="mt-2 text-[11px] leading-[1.6] text-[var(--color-n600)]">
                  {problema ?? `Minimo ${LARGO_MINIMO} caracteres, combinando mayusculas, minusculas, numeros o simbolos.`}
                </p>
              </div>
              <div className="campo">
                <label htmlFor="c2">Reptela</label>
                <input
                  id="c2"
                  className="entrada"
                  type="password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="boton mt-9 w-full justify-center"
              disabled={ocupado || problema !== null || contrasena === ""}
            >
              {ocupado ? "Creando cuenta…" : "Crear mi cuenta"}
            </button>

            {error ? (
              <div className="mt-5">
                <Aviso tono="error">{error}</Aviso>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
