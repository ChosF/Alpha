"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ETIQUETAS, ROLES, type Rol } from "@/convex/lib/validadores";
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  Cargando,
  Entrada,
  Seleccion,
  Tarjeta,
  TarjetaCabecera,
  fecha,
  iniciales,
} from "@/components/panel/ui/primitivas";

export function Usuarios() {
  const usuarios = useQuery(api.usuarios.listar, {});
  const pendientes = useQuery(api.usuarios.invitacionesPendientes, {});

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-12">
      <div className="grid min-w-0 gap-4 lg:col-span-7">
        <Tarjeta>
          <TarjetaCabecera titulo="Cuentas" descripcion="Roles y acceso al panel." />
          {usuarios === undefined ? (
            <Cargando que="las cuentas" />
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table ui-table-mobile ui-table-usuarios">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <Fila key={u._id} usuario={u} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera titulo="Invitaciones sin usar" />
          {pendientes === undefined ? (
            <p className="ui-faint p-5 text-[12.5px]">Cargando…</p>
          ) : pendientes.length === 0 ? (
            <p className="ui-faint p-5 text-[12.5px]">No hay invitaciones pendientes.</p>
          ) : (
            <ul>
              {pendientes.map((i) => (
                <Pendiente key={i._id} invitacion={i} />
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
      <div className="min-w-0 lg:col-span-5">
        <Tarjeta>
          <Invitar />
        </Tarjeta>
      </div>
    </div>
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
    <tr>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar texto={iniciales(usuario.nombre || usuario.correo)} tamano="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{usuario.nombre || usuario.correo}</p>
            <p className="ui-faint truncate text-[12px]">{usuario.correo}</p>
            <p className="ui-faint text-[11px]">Último acceso: {fecha(usuario.ultimoAcceso)}</p>
            {error ? <Aviso tono="error">{error}</Aviso> : null}
          </div>
        </div>
      </td>
      <td className="ui-td-tight" onClick={(e) => e.stopPropagation()}>
        <Seleccion
          aria-label={`Rol de ${usuario.correo}`}
          value={usuario.rol}
          onChange={(e) => void intentar(() => cambiarRol({ id: usuario._id, rol: e.target.value as Rol }))}
        >
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETAS[rol]}
            </option>
          ))}
        </Seleccion>
      </td>
      <td className="ui-td-tight" onClick={(e) => e.stopPropagation()}>
        <Boton
          tamano="sm"
          variante={usuario.activo ? "peligro" : "base"}
          onClick={() => void intentar(() => cambiarAcceso({ id: usuario._id, activo: !usuario.activo }))}
        >
          {usuario.activo ? "Revocar" : "Reactivar"}
        </Boton>
      </td>
    </tr>
  );
}

function Pendiente({
  invitacion,
}: {
  invitacion: { _id: Id<"invites">; correo: string; nombre: string; rol: Rol; expiraEn: number };
}) {
  const revocar = useMutation(api.usuarios.revocarInvitacion);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{invitacion.nombre || invitacion.correo}</p>
        <p className="ui-faint truncate text-[12px]">
          {invitacion.correo} · {ETIQUETAS[invitacion.rol]} · Vence {fecha(invitacion.expiraEn)}
        </p>
      </div>
      <Boton tamano="sm" variante="peligro" onClick={() => void revocar({ id: invitacion._id })}>
        Revocar
      </Boton>
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
      setEnlace(`${window.location.origin}/dashboard/invitacion/${resultado.token}`);
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
    <>
      <TarjetaCabecera titulo="Invitar a alguien" descripcion="El acceso dura 7 días y funciona una sola vez." />
      <div className="grid gap-4 p-5">
        <Campo etiqueta="Nombre" htmlFor="i-nombre">
          <Entrada id="i-nombre" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="i-correo">
          <Entrada id="i-correo" type="email" value={correo} maxLength={120} onChange={(e) => setCorreo(e.target.value)} placeholder="a01234567@tec.mx" />
        </Campo>
        <Campo etiqueta="Rol" htmlFor="i-rol" ayuda={
          rol === "admin"
            ? "Todo, incluido invitar, cambiar roles y exportar."
            : rol === "editor"
              ? "Cambia estados y notas, y edita el programa."
              : "Solo consulta: no puede modificar nada."
        }>
          <Seleccion id="i-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETAS[opcion]}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Boton variante="primario" onClick={() => void enviar()} disabled={ocupado || correo === "" || nombre === ""}>
          {ocupado ? "Creando…" : "Crear invitación"}
        </Boton>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {enlace ? (
          <div className="ui-card p-4">
            <Aviso tono={correoEnviado ? "exito" : "error"}>
              {correoEnviado
                ? "Invitación enviada por correo."
                : "El correo aún no está configurado. Comparte el enlace manualmente."}
            </Aviso>
            <p className="ui-label mt-4">Enlace de invitación</p>
            <p className="ui-mono mt-2 break-all text-[12px]">{enlace}</p>
            <Boton
              className="mt-3"
              tamano="sm"
              icono="copiar"
              onClick={() => {
                void navigator.clipboard.writeText(enlace);
                setCopiado(true);
              }}
            >
              {copiado ? "Copiado" : "Copiar enlace"}
            </Boton>
            <p className="ui-help">No se vuelve a mostrar. Si lo pierdes, revoca la invitación y crea otra.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

function limpiarMensaje(mensaje: string): string {
  const marca = mensaje.lastIndexOf("Error: ");
  const limpio = marca === -1 ? mensaje : mensaje.slice(marca + 7);
  return limpio.split("\n")[0]?.trim() || "No se pudo aplicar el cambio.";
}
