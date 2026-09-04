"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { ETIQUETAS } from "@/convex/lib/validadores";
import { validarContrasena } from "@/convex/lib/contrasena";
import {
  useCascaron,
  type Acento,
  type Densidad,
  type GraficaInicio,
  type Tema,
} from "@/components/panel/ui/cascaron";
import { Icono } from "@/components/panel/ui/iconos";
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  Kbd,
  Pildora,
  Tarjeta,
  TarjetaCabecera,
  iniciales,
} from "@/components/panel/ui/primitivas";
import { Usuarios } from "./usuarios";

type Seccion = "perfil" | "seguridad" | "apariencia" | "usuarios";

const SECCIONES: { id: Seccion; texto: string; soloAdmin?: boolean }[] = [
  { id: "perfil", texto: "Perfil" },
  { id: "seguridad", texto: "Seguridad" },
  { id: "apariencia", texto: "Apariencia" },
  { id: "usuarios", texto: "Usuarios", soloAdmin: true },
];

/**
 * Ajustes: la cuenta propia, el aspecto del panel y, para administracion,
 * las cuentas del equipo. Usuarios vive aqui porque se toca pocas veces al
 * semestre y no merece un lugar en la barra.
 */
export default function Ajustes() {
  return (
    <Suspense fallback={<Cargando que="los ajustes" />}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const { yo } = useCascaron();
  const parametros = useSearchParams();
  const pedida = parametros.get("seccion");
  const esAdmin = yo?.rol === "admin";

  const visibles = SECCIONES.filter((s) => !s.soloAdmin || esAdmin);
  const seccion: Seccion =
    visibles.some((s) => s.id === pedida) ? (pedida as Seccion) : "perfil";

  return (
    <>
      <Encabezado titulo="Ajustes" descripcion="Tu cuenta, el aspecto del panel y el acceso del equipo." />

      <nav className="ui-tabs" role="tablist" aria-label="Secciones de ajustes">
        {visibles.map((s) => (
          <Link
            key={s.id}
            href={s.id === "perfil" ? "/dashboard/ajustes" : `/dashboard/ajustes?seccion=${s.id}`}
            role="tab"
            aria-selected={seccion === s.id}
            className="ui-tab"
            replace
          >
            {s.texto}
          </Link>
        ))}
      </nav>

      {seccion === "perfil" ? <Perfil /> : null}
      {seccion === "seguridad" ? <Seguridad /> : null}
      {seccion === "apariencia" ? <Apariencia /> : null}
      {seccion === "usuarios" && esAdmin ? <Usuarios /> : null}
    </>
  );
}

function Perfil() {
  const { yo, cerrarSesion } = useCascaron();
  const actualizarNombre = useMutation(api.usuarios.actualizarNombre);
  const [nombre, setNombre] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!yo) {
    return (
      <Tarjeta>
        <Cargando que="tu perfil" />
      </Tarjeta>
    );
  }

  const valor = nombre ?? yo.nombre;
  const cambiado = valor.trim() !== yo.nombre;

  const guardar = async () => {
    setOcupado(true);
    setEstado(null);
    try {
      await actualizarNombre({ nombre: valor });
      setNombre(null);
      setEstado({ tono: "exito", texto: "Nombre actualizado." });
    } catch (e) {
      setEstado({ tono: "error", texto: e instanceof Error ? limpiarMensaje(e.message) : "No se pudo guardar." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Tarjeta className="lg:col-span-7" indice={1}>
        <TarjetaCabecera titulo="Perfil" descripcion="Así apareces en la bitácora y en los correos que envía el panel." />
        <div className="grid gap-5 p-5">
          <div className="flex items-center gap-4">
            <Avatar texto={iniciales(valor || yo.correo)} tamano="lg" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{valor || yo.correo}</p>
              <p className="ui-faint truncate text-[12.5px]">{yo.correo}</p>
            </div>
            <div className="ml-auto">
              <Pildora tono={yo.rol === "admin" ? "accent" : "neutro"} punto={false}>
                {ETIQUETAS[yo.rol] ?? yo.rol}
              </Pildora>
            </div>
          </div>

          <Campo etiqueta="Nombre" htmlFor="perfil-nombre" ayuda="Entre 2 y 80 caracteres.">
            <Entrada
              id="perfil-nombre"
              value={valor}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </Campo>

          <Campo etiqueta="Correo" htmlFor="perfil-correo" ayuda="Lo define la invitación. Para cambiarlo, pide una nueva.">
            <Entrada id="perfil-correo" value={yo.correo} readOnly disabled />
          </Campo>

          {yo.area ? (
            <Campo etiqueta="Área" htmlFor="perfil-area">
              <Entrada id="perfil-area" value={ETIQUETAS[yo.area] ?? yo.area} readOnly disabled />
            </Campo>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="primario" onClick={() => void guardar()} disabled={!cambiado || ocupado || valor.trim().length < 2}>
              {ocupado ? "Guardando…" : "Guardar cambios"}
            </Boton>
            {cambiado ? (
              <Boton variante="fantasma" onClick={() => setNombre(null)} disabled={ocupado}>
                Descartar
              </Boton>
            ) : null}
            {estado ? <Aviso tono={estado.tono}>{estado.texto}</Aviso> : null}
          </div>
        </div>
      </Tarjeta>

      <div className="grid gap-4 content-start lg:col-span-5">
        <Tarjeta indice={2}>
          <TarjetaCabecera titulo="Sesión" />
          <div className="flex items-center justify-between gap-4 p-5">
            <p className="ui-faint text-[12.5px]">Cierra la sesión en este dispositivo. Podrás volver a entrar con tu contraseña.</p>
            <Boton icono="salir" onClick={cerrarSesion}>
              Salir
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta indice={3}>
          <TarjetaCabecera titulo="Atajos" />
          <dl className="ui-dl p-5">
            <dt>Buscar o ir a</dt>
            <dd>
              <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </dd>
            <dt>Contraer barra lateral</dt>
            <dd>
              <Kbd>⌘</Kbd> <Kbd>B</Kbd>
            </dd>
          </dl>
        </Tarjeta>
      </div>
    </div>
  );
}

function Apariencia() {
  const {
    tema,
    cambiarTema,
    densidad,
    cambiarDensidad,
    acento,
    cambiarAcento,
    graficasInicio,
    cambiarGraficaInicio,
    colapsada,
    alternarColapso,
  } = useCascaron();

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Tarjeta className="lg:col-span-7" indice={1}>
        <TarjetaCabecera titulo="Tema" descripcion="Se sincroniza entre tus dispositivos." />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {(["light", "dark"] as Tema[]).map((t) => (
            <button
              key={t}
              type="button"
              className="ui-card flex items-center gap-3 p-4 text-left"
              aria-pressed={tema === t}
              data-selected={tema === t ? "true" : undefined}
              onClick={() => {
                if (tema !== t) cambiarTema(t);
              }}
            >
              <span className="ui-proj-mark">
                <Icono nombre={t === "light" ? "sol" : "luna"} tamano={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{t === "light" ? "Claro" : "Oscuro"}</span>
                <span className="ui-faint block text-[12px]">
                  {t === "light" ? "Fondo blanco, ideal con luz de día." : "Fondo negro, menos brillo."}
                </span>
              </span>
              {tema === t ? (
                <span className="ml-auto text-[var(--accent)]">
                  <Icono nombre="check" tamano={16} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-5" indice={2}>
        <TarjetaCabecera titulo="Color de acento" descripcion="Siempre dentro de la paleta Alpha." />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-1">
          {(["bright", "classic"] as Acento[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              className="ui-card ui-accent-choice flex items-center gap-3 p-4 text-left"
              data-selected={acento === opcion ? "true" : undefined}
              data-accent-option={opcion}
              aria-pressed={acento === opcion}
              onClick={() => cambiarAcento(opcion)}
            >
              <i />
              <span>
                <span className="block text-[13px] font-semibold">
                  {opcion === "bright" ? "Azul brillante" : "Azul clásico"}
                </span>
                <span className="ui-faint block text-[12px]">
                  {opcion === "bright" ? "#0066FF" : "#194270"}
                </span>
              </span>
              {acento === opcion ? <Icono nombre="check" tamano={16} /> : null}
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-7" indice={3}>
        <TarjetaCabecera titulo="Densidad" descripcion="Ajusta cuánta información cabe sin cambiar funciones." />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {(["comfortable", "compact"] as Densidad[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              className="ui-card p-4 text-left"
              data-selected={densidad === opcion ? "true" : undefined}
              aria-pressed={densidad === opcion}
              onClick={() => cambiarDensidad(opcion)}
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-semibold">
                    {opcion === "comfortable" ? "Cómoda" : "Compacta"}
                  </span>
                  <span className="ui-faint mt-1 block text-[12px]">
                    {opcion === "comfortable" ? "Más aire entre controles." : "Más filas y datos en pantalla."}
                  </span>
                </span>
                {densidad === opcion ? <Icono nombre="check" tamano={16} /> : null}
              </span>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-5" indice={4}>
        <TarjetaCabecera titulo="Barra lateral" descripcion="Se sincroniza entre tus dispositivos." />
        <div className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[13px] font-medium">Contraída por defecto</p>
            <p className="ui-faint text-[12px]">También con <Kbd>⌘</Kbd> <Kbd>B</Kbd>.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={colapsada}
            aria-label="Barra lateral contraída"
            className="ui-switch"
            onClick={alternarColapso}
          />
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-12" indice={5}>
        <TarjetaCabecera
          titulo="Gráficos de Inicio"
          descripcion="Elige qué análisis aparecen debajo de los eventos y pendientes."
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {GRAFICAS_CONFIG.map((grafica) => {
            const visible = graficasInicio.includes(grafica.id);
            return (
              <button
                key={grafica.id}
                type="button"
                className="ui-setting-toggle"
                aria-pressed={visible}
                onClick={() => cambiarGraficaInicio(grafica.id, !visible)}
              >
                <span><strong>{grafica.titulo}</strong><small>{grafica.descripcion}</small></span>
                <span aria-hidden="true" data-checked={visible ? "true" : undefined} className="ui-switch" />
              </button>
            );
          })}
        </div>
      </Tarjeta>
    </div>
  );
}

const GRAFICAS_CONFIG: Array<{ id: GraficaInicio; titulo: string; descripcion: string }> = [
  { id: "tendencia", titulo: "Altas por semana", descripcion: "Ocho semanas" },
  { id: "estados", titulo: "Seguimiento", descripcion: "Nuevo, contactado, activo y baja" },
  { id: "tipos", titulo: "Comunidad", descripcion: "Miembros, aliados y canales" },
  { id: "areas", titulo: "Interés por área", descripcion: "Preferencias de aliados" },
];

function Seguridad() {
  const { yo, cerrarSesion } = useCascaron();
  const { signIn } = useAuthActions();
  const iniciarRestablecimiento = useAction(api.auth.signIn);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "error" | "exito"; texto: string } | null>(null);

  if (!yo) {
    return <Tarjeta><Cargando que="la seguridad de tu cuenta" /></Tarjeta>;
  }

  const solicitarCodigo = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      // La primera etapa no debe pasar por useAuthActions: el flujo de correo
      // no devuelve tokens y el cliente lo interpretaría como cierre de sesión.
      await iniciarRestablecimiento({
        provider: "password",
        params: { email: yo.correo, flow: "reset" },
      });
      setCodigoEnviado(true);
      setAviso({ tono: "exito", texto: `Enviamos un código de 6 dígitos a ${yo.correo}.` });
    } catch {
      setAviso({ tono: "error", texto: "No pudimos enviar el código. Intenta de nuevo en un momento." });
    } finally {
      setOcupado(false);
    }
  };

  const cambiarContrasena = async () => {
    const problema = validarContrasena(contrasena);
    if (problema) {
      setAviso({ tono: "error", texto: problema });
      return;
    }
    if (contrasena !== repetida) {
      setAviso({ tono: "error", texto: "Las contraseñas no coinciden." });
      return;
    }
    setOcupado(true);
    setAviso(null);
    try {
      await signIn("password", {
        email: yo.correo,
        code: codigo.replace(/\s/g, ""),
        newPassword: contrasena,
        flow: "reset-verification",
      });
      setCodigo("");
      setContrasena("");
      setRepetida("");
      setCodigoEnviado(false);
      setAviso({ tono: "exito", texto: "Contraseña actualizada. Las demás sesiones quedaron cerradas." });
    } catch {
      setAviso({ tono: "error", texto: "El código no es válido o ya caducó." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Tarjeta className="lg:col-span-7" indice={1}>
        <TarjetaCabecera
          titulo="Cambiar contraseña"
          descripcion="Confirmamos el cambio con un código enviado a tu correo. Caduca en 15 minutos."
        />
        <div className="grid gap-4 p-5">
          {!codigoEnviado ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium">{yo.correo}</p>
                <p className="ui-faint mt-1 text-[12px]">Nunca pediremos tu contraseña actual por correo.</p>
              </div>
              <Boton variante="primario" icono="correo" disabled={ocupado} onClick={() => void solicitarCodigo()}>
                {ocupado ? "Enviando…" : "Enviar código"}
              </Boton>
            </div>
          ) : (
            <>
              <Campo etiqueta="Código" htmlFor="seguridad-codigo" ayuda="6 dígitos.">
                <Entrada
                  id="seguridad-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                />
              </Campo>
              <Campo etiqueta="Nueva contraseña" htmlFor="seguridad-contrasena" ayuda="12 caracteres y al menos tres tipos de caracteres.">
                <Entrada
                  id="seguridad-contrasena"
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                />
              </Campo>
              <Campo etiqueta="Repetir contraseña" htmlFor="seguridad-repetida">
                <Entrada
                  id="seguridad-repetida"
                  type="password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                />
              </Campo>
              <div className="flex flex-wrap items-center gap-2">
                <Boton
                  variante="primario"
                  disabled={ocupado || codigo.length !== 6 || !contrasena || !repetida}
                  onClick={() => void cambiarContrasena()}
                >
                  {ocupado ? "Actualizando…" : "Actualizar contraseña"}
                </Boton>
                <Boton disabled={ocupado} onClick={() => void solicitarCodigo()}>Reenviar código</Boton>
                <Boton variante="fantasma" disabled={ocupado} onClick={() => setCodigoEnviado(false)}>Cancelar</Boton>
              </div>
            </>
          )}
          {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
        </div>
      </Tarjeta>

      <Tarjeta className="content-start lg:col-span-5" indice={2}>
        <TarjetaCabecera titulo="Sesiones" descripcion="El cambio de contraseña cierra todos los demás dispositivos." />
        <div className="flex items-center justify-between gap-4 p-5">
          <p className="ui-faint text-[12.5px]">Cierra esta sesión si el dispositivo ya no es de confianza.</p>
          <Boton icono="salir" onClick={cerrarSesion}>Salir</Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

function limpiarMensaje(mensaje: string): string {
  const marca = mensaje.lastIndexOf("Error: ");
  const limpio = marca === -1 ? mensaje : mensaje.slice(marca + 7);
  return limpio.split("\n")[0]?.trim() || "No se pudo guardar.";
}
