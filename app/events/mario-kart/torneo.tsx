"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { REGLA_TORNEO } from "@/lib/torneo-mario-kart";
import { renovarToken, tomarToken } from "./registro-cliente";
import estilos from "./mario-kart.module.css";

type Lista = FunctionReturnType<typeof api.equiposMarioKart.listar>;
type Solicitud = FunctionReturnType<typeof api.equiposMarioKart.solicitud>;
type Resultado = FunctionReturnType<typeof api.equiposMarioKart.participar>;

async function pedir<T>(datos: object): Promise<T> {
  const respuesta = await fetch("/api/eventos/mario-kart/equipos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos), cache: "no-store" });
  const resultado = await respuesta.json();
  if (!respuesta.ok || resultado?.error) throw new Error(resultado.error ?? "No se pudo completar. Intenta de nuevo.");
  return resultado as T;
}

export function Torneo({ invitacion, solicitud, onCerrar }: { invitacion?: string; solicitud?: string; onCerrar: () => void }) {
  const [lista, setLista] = useState<Lista>();
  const [peticion, setPeticion] = useState<Solicitud>();
  const [modo, setModo] = useState<"elegir" | "crear" | "unir">(invitacion ? "unir" : "elegir");
  const [equipoId, setEquipoId] = useState("");
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [privado, setPrivado] = useState(false);
  const [correo, setCorreo] = useState("");
  const [registro, setRegistro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState<Resultado>();
  const [reintento, setReintento] = useState(0);
  const bloqueo = useRef(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let activo = true;
    if (solicitud) {
      void pedir<Solicitud>({ accion: "solicitud", codigo: solicitud }).then(d => { if (activo) setPeticion(d); }).catch(e => { if (activo) setError(e.message); });
    } else {
      void pedir<Lista>({ accion: "listar", invitacion }).then(d => {
        if (!activo) return;
        setLista(d);
        if (d.invitado) setEquipoId(d.invitado.id);
      }).catch(e => { if (activo) setError(e.message); });
    }
    return () => { activo = false; };
  }, [invitacion, solicitud, reintento]);

  const elegido = lista?.equipos.find(e => e.id === equipoId);
  const volver = () => { setRegistro(false); setModo("elegir"); setError(""); setEquipoId(""); };
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError("");
    const datos = new FormData(event.currentTarget);
    try {
      const resultado = await pedir<Resultado>({ accion: "participar", correo: correo.trim(), token: await tomarToken(), sitio_web: datos.get("sitio_web") ?? "",
        ...(modo === "crear" ? { nombreEquipo, privado } : { equipoId, invitacion }),
        ...(registro ? { persona: { nombre: datos.get("nombre"), carrera: datos.get("carrera"), semestre: datos.get("semestre"), matricula: datos.get("matricula") } } : {}),
      });
      if (resultado.estado === "registro") { setRegistro(true); window.requestAnimationFrame(() => nombreRef.current?.focus()); }
      else if (resultado.estado === "error") setError(resultado.mensaje);
      else setExito(resultado);
    } catch (e) { setError(e instanceof Error ? e.message : "Intenta de nuevo."); void renovarToken(); }
    finally { bloqueo.current = false; setOcupado(false); }
  }

  async function responder(aceptar: boolean) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError("");
    try { setExito(await pedir<Resultado>({ accion: "responder", codigo: solicitud, aceptar })); }
    catch (e) { setError(e instanceof Error ? e.message : "Intenta de nuevo."); }
    finally { bloqueo.current = false; setOcupado(false); }
  }

  return <div className={estilos.torneo}>
    <div className={estilos.modalIntroduccion}>
      <span>Mario Kart Challenge / Torneo</span>
      <h2 id="mario-kart-registro-titulo">{exito ? exito.estado === "pendiente" ? "Solicitud enviada." : "Todo listo." : solicitud ? "Solicitud de ingreso." : registro ? "Completa tu registro." : modo === "crear" ? "Crea tu equipo." : modo === "unir" ? "Únete a tu equipo." : "La pista se juega en equipo."}</h2>
      <p>{exito ? exito.mensaje : solicitud ? "Revisa los datos y decide si aceptas a esta persona." : registro ? "Solo necesitamos estos datos porque aún no estás registrado al evento." : "4 personas. Un equipo. Elige cómo quieres competir."}</p>
    </div>
    <p className={estilos.torneoRegla}>{REGLA_TORNEO}</p>
    {exito ? <button type="button" className={estilos.enviar} onClick={onCerrar}>Volver a la pista</button> : solicitud ? <>
      {peticion === undefined && !error ? <p role="status">Cargando solicitud…</p> : peticion === null ? <p>Este enlace no es válido. Usa el enlace que recibiste por correo.</p> : peticion ? <div className={estilos.torneoResumen}>
        <span>{peticion.equipo}</span><strong>{peticion.nombre}</strong><p>{peticion.correo}</p>
        {peticion.estado !== "pendiente" ? <p>Esta solicitud ya fue {peticion.estado}.</p> : peticion.cerrado ? <p>El plazo para formar equipos terminó.</p> : <div className={estilos.torneoOpciones}>
          <button className={estilos.enviar} disabled={ocupado} onClick={() => void responder(true)}>{ocupado ? "Guardando…" : "Aceptar integrante"}</button>
          <button className={estilos.torneoSecundario} disabled={ocupado} onClick={() => void responder(false)}>Rechazar solicitud</button>
        </div>}
      </div> : null}
    </> : !lista ? <p role="status">{error ? "No pudimos cargar los equipos." : "Cargando equipos…"}</p> : lista.cerrado ? <p>El registro al torneo está cerrado.</p> : invitacion && !lista.invitado ? <p>Esta invitación no es válida. Pide al capitán que comparta de nuevo su enlace.</p> : <>
      {modo === "elegir" ? <div className={estilos.torneoOpciones}>
        <button className={estilos.torneoOpcion} onClick={() => setModo("crear")} disabled={lista.equipos.length >= lista.maxEquipos}><strong>Crear un equipo <span aria-hidden="true">↗</span></strong><span>{lista.equipos.length >= lista.maxEquipos ? "Ya se crearon todos los equipos." : `Serás el capitán. ${lista.maxEquipos - lista.equipos.length} lugares para nuevos equipos.`}</span></button>
        <button className={estilos.torneoOpcion} onClick={() => setModo("unir")} disabled={!lista.equipos.some(e => e.miembros < 4 && !e.descalificado)}><strong>Unirme a un equipo <span aria-hidden="true">↗</span></strong><span>{lista.equipos.length === 0 ? "Todavía no hay equipos. Crea el primero." : "Elige un equipo con lugares disponibles."}</span></button>
      </div> : <form className={estilos.formulario} onSubmit={e => void enviar(e)}>
        {!invitacion ? <button type="button" className={estilos.torneoVolver} onClick={volver} disabled={ocupado}>← Cambiar opción</button> : null}
        {modo === "crear" ? <>
          <div className={estilos.campo}><label htmlFor="equipo-nombre">Nombre del equipo</label><input id="equipo-nombre" value={nombreEquipo} onChange={e => setNombreEquipo(e.target.value)} minLength={2} maxLength={50} required disabled={ocupado} /></div>
          <fieldset className={estilos.torneoPrivacidad}><legend>¿Quién puede unirse?</legend>
            <label><input type="radio" name="privacidad" checked={!privado} onChange={() => setPrivado(false)} disabled={ocupado} /><span><strong>Público</strong>Cualquier participante puede unirse.</span></label>
            <label><input type="radio" name="privacidad" checked={privado} onChange={() => setPrivado(true)} disabled={ocupado} /><span><strong>Privado</strong>Recibirás las solicitudes por correo y decidirás a quién aceptar.</span></label>
          </fieldset><p className={estilos.consentimiento}>Recibirás un enlace para invitar directamente a tus compañeros, también si eliges un equipo privado.</p>
        </> : invitacion ? <div className={estilos.torneoResumen}><span>Invitación directa</span><strong>{elegido?.nombre}</strong><p>{elegido?.miembros}/4 integrantes · Entrarás sin esperar aprobación.</p></div> : <div className={estilos.campo}><label htmlFor="equipo-elegido">Equipo</label><select id="equipo-elegido" value={equipoId} onChange={e => { setEquipoId(e.target.value); setError(""); }} required disabled={ocupado}><option value="">Selecciona un equipo</option>{lista.equipos.map(e => <option key={e.id} value={e.id} disabled={e.miembros >= 4 || e.descalificado}>{e.nombre} · {e.miembros}/4 · {e.privado ? "Requiere aprobación" : "Público"}{e.miembros >= 4 ? " · Completo" : ""}</option>)}</select></div>}
        {elegido && elegido.miembros >= 4 ? <p>Este equipo ya está completo. Pide otro enlace o elige otro equipo.</p> : <>
          <div className={estilos.campo}><label htmlFor="torneo-correo">Tu correo</label><input id="torneo-correo" type="email" autoComplete="email" value={correo} onChange={e => { setCorreo(e.target.value); setRegistro(false); }} maxLength={120} required disabled={ocupado} /></div>
          {registro ? <>
            <div className={estilos.campo}><label htmlFor="torneo-nombre">Nombre completo</label><input ref={nombreRef} id="torneo-nombre" name="nombre" autoComplete="name" minLength={2} maxLength={80} required /></div>
            <div className={estilos.camposDobles}><div className={estilos.campo}><label htmlFor="torneo-carrera">Carrera</label><input id="torneo-carrera" name="carrera" minLength={2} maxLength={80} required /></div><div className={estilos.campo}><label htmlFor="torneo-semestre">Semestre</label><input id="torneo-semestre" name="semestre" inputMode="numeric" maxLength={30} placeholder="Ej. 3" required /></div></div>
            <div className={estilos.campo}><label htmlFor="torneo-matricula">Matrícula</label><input id="torneo-matricula" name="matricula" maxLength={9} pattern="[Aa][0-9]{8}" placeholder="A01234567" required /></div>
          </> : <p className={estilos.consentimiento}>Si ya te registraste al evento, usa el mismo correo. Si es tu primera vez, te pediremos tus datos en el siguiente paso.</p>}
          <div className={estilos.trampa} aria-hidden="true"><label htmlFor="torneo-sitio">Sitio web</label><input id="torneo-sitio" name="sitio_web" tabIndex={-1} autoComplete="off" /></div>
          <p className={estilos.consentimiento}>Al continuar aceptas recibir correos del torneo y compartir tu nombre y correo con el capitán. Consulta nuestros <a href="/terminos">Términos y aviso de privacidad</a>.</p>
          <button type="submit" className={estilos.enviar} disabled={ocupado || (modo === "unir" && !equipoId)}>{ocupado ? "Guardando…" : registro ? "Registrarme y continuar" : modo === "crear" ? "Crear equipo" : elegido?.privado && !invitacion ? "Solicitar unirme" : "Unirme al equipo"}</button>
        </>}
      </form>}
    </>}
    {error ? <div role="alert" className={estilos.mensajeError}><p>{error}</p>{(!lista && !solicitud) || (solicitud && peticion === undefined) ? <button className={estilos.torneoVolver} onClick={() => { setError(""); setReintento(n => n + 1); }}>Volver a cargar</button> : null}</div> : null}
  </div>;
}
