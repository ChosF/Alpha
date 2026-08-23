"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ETIQUETAS, ROLES, type Rol } from "@/convex/lib/validadores";
import { Aviso, Bandeja, Cargando, Titulo, fecha } from "@/components/panel/piezas";
import { SelectorPersonalizado } from "@/components/panel/selector-personalizado";

/**
 * Usuarios del panel.
 *
 * El enlace de invitacion se muestra una sola vez. Si Resend esta configurado,
 * tambien se envia desde auto@alphaccm.org y queda registrado en Correo.
 */
export default function Usuarios() {
  const usuarios = useQuery(api.usuarios.listar, {});
  const pendientes = useQuery(api.usuarios.invitacionesPendientes, {});

  return (
    <>
      <Titulo cejilla="Mesa directiva">Usuarios</Titulo>

      <div className="grid min-w-0 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <Bandeja>
            {usuarios === undefined ? (
              <Cargando que="las cuentas" />
            ) : (
              <div className="px-5 sm:px-7 py-2">
                <p className="rotulo py-4">Cuentas</p>
                <ul>
                  {usuarios.map((u) => (
                    <Fila key={u._id} usuario={u} />
                  ))}
                </ul>
              </div>
            )}
          </Bandeja>

          <div className="mt-4">
            <Bandeja>
              <div className="px-5 sm:px-7 py-2">
                <p className="rotulo py-4">Invitaciones sin usar</p>
                {pendientes === undefined ? (
                  <p className="pb-5 text-[12px] text-[var(--color-n600)]">Cargando…</p>
                ) : pendientes.length === 0 ? (
                  <p className="pb-5 text-[12px] text-[var(--color-n600)]">
                    No hay invitaciones pendientes.
                  </p>
                ) : (
                  <ul className="pb-3">
                    {pendientes.map((i) => (
                      <Pendiente key={i._id} invitacion={i} />
                    ))}
                  </ul>
                )}
              </div>
            </Bandeja>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5">
          <Bandeja>
            <Invitar />
          </Bandeja>
        </div>
      </div>
    </>
  );
}

type UsuarioFila = {
  _id: Id<"users">;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  ultimoAcceso?: number;
};

function Fila({ usuario }: { usuario: UsuarioFila }) {
  const cambiarRol = useMutation(api.usuarios.cambiarRol);
  const cambiarAcceso = useMutation(api.usuarios.cambiarAcceso);
  const [error, setError] = useState<string | null>(null);

  const intentar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? limpiarMensaje(e.message) : "No se pudo aplicar el cambio.");
    }
  };

  return (
    <li className="fila py-4 grid gap-3 sm:grid-cols-[1fr_auto] items-center">
      <div className="min-w-0">
        <p className="text-[14px] font-medium truncate">
          {usuario.nombre || usuario.correo}
          {!usuario.activo ? (
            <span className="ml-2 text-[10px] tracking-[.14em] uppercase text-[var(--color-baja)]">
              Sin acceso
            </span>
          ) : null}
        </p>
        <p className="cifra text-[11px] text-[var(--color-n600)] truncate">{usuario.correo}</p>
        <p className="text-[11px] text-[var(--color-n500)] mt-0.5">
          Ultimo acceso: {fecha(usuario.ultimoAcceso)}
        </p>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 justify-self-start sm:w-auto sm:flex-nowrap sm:justify-self-end">
        <SelectorPersonalizado
          id={`rol-${usuario._id}`}
          aria-label={`Rol de ${usuario.correo}`}
          className="min-w-[7.5rem] flex-1 sm:w-[8.5rem] sm:flex-none"
          variante="compacto"
          valor={usuario.rol}
          opciones={ROLES.map((rol) => ({ valor: rol, etiqueta: ETIQUETAS[rol] }))}
          alCambiar={(rol) =>
            void intentar(() => cambiarRol({ id: usuario._id, rol: rol as Rol }))
          }
        />
        <button
          type="button"
          className={`boton shrink-0 ${usuario.activo ? "boton-peligro" : "boton-linea"} px-3 py-2 text-[11px]`}
          onClick={() =>
            void intentar(() => cambiarAcceso({ id: usuario._id, activo: !usuario.activo }))
          }
        >
          {usuario.activo ? "Revocar" : "Reactivar"}
        </button>
      </div>
    </li>
  );
}

function Pendiente({
  invitacion,
}: {
  invitacion: { _id: Id<"invites">; correo: string; nombre: string; rol: Rol; expiraEn: number };
}) {
  const revocar = useMutation(api.usuarios.revocarInvitacion);
  return (
    <li className="fila grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] truncate">{invitacion.nombre || invitacion.correo}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-[var(--color-n600)]">
          <span className="cifra min-w-0 max-w-full truncate">{invitacion.correo}</span>
          <span>{ETIQUETAS[invitacion.rol]}</span>
          <span className="cifra">Vence {fecha(invitacion.expiraEn)}</span>
        </div>
      </div>
      <button
        type="button"
        className="min-h-11 shrink-0 px-1 text-[10px] tracking-[.1em] uppercase text-[var(--color-baja)]"
        onClick={() => void revocar({ id: invitacion._id })}
      >
        Revocar
      </button>
    </li>
  );
}

function Invitar() {
  const invitar = useMutation(api.usuarios.invitar);
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("lector");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [correoEnviado, setCorreoEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const enviar = async () => {
    setOcupado(true);
    setError(null);
    setEnlace(null);
    setCorreoEnviado(false);
    try {
      const resultado = await invitar({ correo, nombre, rol });
      const { token } = resultado;
      setEnlace(`${window.location.origin}/dashboard/invitacion/${token}`);
      setCorreoEnviado(resultado.correoEnviado);
      setCorreo("");
      setNombre("");
    } catch (e) {
      setError(e instanceof Error ? limpiarMensaje(e.message) : "No se pudo crear la invitacion.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="min-w-0 overflow-hidden p-5 sm:p-7">
      <p className="rotulo">Invitar a alguien</p>
      <p className="mt-3 break-words text-[12.5px] font-light leading-[1.7] text-[var(--color-cuerpo)]">
        El acceso dura 7 dias y funciona una sola vez. Con el correo configurado, Alpha lo envia
        desde auto@alphaccm.org. El enlace tambien aparece aqui como respaldo.
      </p>

      <div className="mt-7 grid gap-6">
        <div className="campo">
          <label htmlFor="i-nombre">Nombre</label>
          <input
            id="i-nombre"
            className="entrada"
            value={nombre}
            maxLength={80}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
          />
        </div>
        <div className="campo">
          <label htmlFor="i-correo">Correo</label>
          <input
            id="i-correo"
            className="entrada"
            type="email"
            value={correo}
            maxLength={120}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="a01234567@tec.mx"
          />
        </div>
        <div className="campo">
          <label htmlFor="i-rol">Rol</label>
          <SelectorPersonalizado
            id="i-rol"
            valor={rol}
            opciones={ROLES.map((opcion) => ({
              valor: opcion,
              etiqueta: ETIQUETAS[opcion],
            }))}
            alCambiar={(opcion) => setRol(opcion as Rol)}
          />
          <p className="mt-2 text-[11px] text-[var(--color-n600)] leading-[1.6]">
            {rol === "admin"
              ? "Todo, incluido invitar, cambiar roles y exportar la lista."
              : rol === "editor"
                ? "Cambia estados y notas de registros, y edita el programa."
                : "Solo consulta: no puede modificar nada."}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="boton mt-7 w-full sm:w-auto"
        onClick={() => void enviar()}
        disabled={ocupado || correo === "" || nombre === ""}
      >
        {ocupado ? "Creando…" : "Crear invitacion"}
      </button>

      {error ? (
        <div className="mt-4">
          <Aviso tono="error">{error}</Aviso>
        </div>
      ) : null}

      {enlace ? (
        <div className="mt-6 bg-[var(--color-surface)] p-5">
          <Aviso tono={correoEnviado ? "exito" : "error"}>
            {correoEnviado
              ? "Invitacion enviada por correo."
              : "El correo aun no esta configurado. Comparte el enlace manualmente."}
          </Aviso>
          <p className="rotulo mt-4">Enlace de invitacion</p>
          <p className="mt-3 cifra text-[11px] break-all leading-[1.6]">{enlace}</p>
          <button
            type="button"
            className="boton boton-linea mt-4 text-[11px] px-3 py-2"
            onClick={() => {
              void navigator.clipboard.writeText(enlace);
              setCopiado(true);
            }}
          >
            {copiado ? "Copiado" : "Copiar enlace"}
          </button>
          <p className="mt-3 text-[11px] text-[var(--color-n600)] leading-[1.6]">
            No se vuelve a mostrar. Si lo pierdes, revoca la invitacion y crea otra.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Convex antepone su propio contexto al mensaje; se muestra solo la frase util. */
function limpiarMensaje(mensaje: string): string {
  const marca = mensaje.lastIndexOf("Error: ");
  const limpio = marca === -1 ? mensaje : mensaje.slice(marca + 7);
  return limpio.split("\n")[0]?.trim() || "No se pudo aplicar el cambio.";
}
