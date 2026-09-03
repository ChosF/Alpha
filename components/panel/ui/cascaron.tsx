"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { BarraInferior } from "./barra-inferior";
import { BarraLateral } from "./barra-lateral";
import { BarraSuperior } from "./barra-superior";
import { Paleta } from "./paleta";

export type Tema = "dark" | "light";
export type Densidad = "comfortable" | "compact";
export type Acento = "classic" | "bright";
export type GraficaInicio = "tendencia" | "estados" | "tipos" | "areas";
type Yo = FunctionReturnType<typeof api.usuarios.yo>;
type Contadores = FunctionReturnType<typeof api.metricas.contadores>;

type EstadoCascaron = {
  yo: Yo | undefined;
  contadores: Contadores | undefined;
  tema: Tema;
  cambiarTema: (tema: Tema) => void;
  alternarTema: () => void;
  densidad: Densidad;
  cambiarDensidad: (densidad: Densidad) => void;
  acento: Acento;
  cambiarAcento: (acento: Acento) => void;
  graficasInicio: GraficaInicio[];
  cambiarGraficaInicio: (grafica: GraficaInicio, visible: boolean) => void;
  colapsada: boolean;
  alternarColapso: () => void;
  paletaAbierta: boolean;
  abrirPaleta: () => void;
  cerrarPaleta: () => void;
  cerrarSesion: () => void;
};

const Contexto = createContext<EstadoCascaron | null>(null);

export function useCascaron() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCascaron debe usarse dentro de <Cascaron>");
  return ctx;
}

const LLAVE_TEMA = "alpha-panel-tema";
const LLAVE_BARRA = "alpha-panel-barra";
const LLAVE_DENSIDAD = "alpha-panel-densidad";
const LLAVE_ACENTO = "alpha-panel-acento";
const LLAVE_GRAFICAS = "alpha-panel-graficas";
const GRAFICAS_PREDETERMINADAS: GraficaInicio[] = ["tendencia", "estados", "tipos", "areas"];

/**
 * Armazon del panel: barra lateral retractil en escritorio, barra inferior en
 * movil, barra superior, paleta de comandos y tema. El estado de interfaz
 * vive aqui y se persiste en localStorage; el de sesion viene de Convex.
 */
export function Cascaron({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const yo = useQuery(api.usuarios.yo, {});
  const contadores = useQuery(api.metricas.contadores, {});
  const preferencias = useQuery(api.preferencias.obtener, {});
  const guardarPreferencias = useMutation(api.preferencias.guardar);
  const { signOut } = useAuthActions();

  const [tema, setTema] = useState<Tema>("light");
  const [densidad, setDensidad] = useState<Densidad>("comfortable");
  const [acento, setAcento] = useState<Acento>("bright");
  const [graficasInicio, setGraficasInicio] = useState<GraficaInicio[]>(GRAFICAS_PREDETERMINADAS);
  const [colapsada, setColapsada] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [listo, setListo] = useState(false);

  // Preferencias guardadas. Se leen tras montar para no romper la hidratacion.
  useEffect(() => {
    const marco = requestAnimationFrame(() => {
      const t = window.localStorage.getItem(LLAVE_TEMA);
      const b = window.localStorage.getItem(LLAVE_BARRA);
      const d = window.localStorage.getItem(LLAVE_DENSIDAD);
      const a = window.localStorage.getItem(LLAVE_ACENTO);
      const g = window.localStorage.getItem(LLAVE_GRAFICAS);
      if (t === "dark" || t === "light") setTema(t);
      if (b === "collapsed") setColapsada(true);
      if (d === "comfortable" || d === "compact") setDensidad(d);
      if (a === "classic" || a === "bright") setAcento(a);
      if (g !== null) {
        try {
          const leidas = JSON.parse(g) as unknown;
          if (Array.isArray(leidas)) {
            setGraficasInicio(
              leidas.filter((valor): valor is GraficaInicio =>
                GRAFICAS_PREDETERMINADAS.includes(valor as GraficaInicio),
              ),
            );
          }
        } catch {
          window.localStorage.removeItem(LLAVE_GRAFICAS);
        }
      }
      requestAnimationFrame(() => setListo(true));
    });
    return () => cancelAnimationFrame(marco);
  }, []);

  useEffect(() => {
    if (!preferencias?.guardadas) return;
    const marco = requestAnimationFrame(() => {
      setTema(preferencias.tema);
      setDensidad(preferencias.densidad);
      setAcento(preferencias.acento);
      setColapsada(preferencias.barraContraida);
      setGraficasInicio(preferencias.graficasInicio);
      window.localStorage.setItem(LLAVE_TEMA, preferencias.tema);
      window.localStorage.setItem(LLAVE_DENSIDAD, preferencias.densidad);
      window.localStorage.setItem(LLAVE_ACENTO, preferencias.acento);
      window.localStorage.setItem(LLAVE_BARRA, preferencias.barraContraida ? "collapsed" : "expanded");
      window.localStorage.setItem(LLAVE_GRAFICAS, JSON.stringify(preferencias.graficasInicio));
    });
    return () => cancelAnimationFrame(marco);
  }, [preferencias]);

  useEffect(() => {
    if (!listo || !preferencias || preferencias.guardadas) return;
    void guardarPreferencias({
      tema,
      densidad,
      acento,
      barraContraida: colapsada,
      graficasInicio,
    });
  }, [
    acento,
    colapsada,
    densidad,
    graficasInicio,
    guardarPreferencias,
    listo,
    preferencias,
    tema,
  ]);

  useEffect(() => {
    document.documentElement.style.colorScheme = tema;
  }, [tema]);

  const cambiarTema = useCallback((siguiente: Tema) => {
    window.localStorage.setItem(LLAVE_TEMA, siguiente);
    setTema(siguiente);
    void guardarPreferencias({ tema: siguiente });
  }, [guardarPreferencias]);

  const alternarTema = useCallback(() => {
    cambiarTema(tema === "dark" ? "light" : "dark");
  }, [cambiarTema, tema]);

  const cambiarDensidad = useCallback((siguiente: Densidad) => {
    window.localStorage.setItem(LLAVE_DENSIDAD, siguiente);
    setDensidad(siguiente);
    void guardarPreferencias({ densidad: siguiente });
  }, [guardarPreferencias]);

  const cambiarAcento = useCallback((siguiente: Acento) => {
    window.localStorage.setItem(LLAVE_ACENTO, siguiente);
    setAcento(siguiente);
    void guardarPreferencias({ acento: siguiente });
  }, [guardarPreferencias]);

  const cambiarGraficaInicio = useCallback((grafica: GraficaInicio, visible: boolean) => {
    setGraficasInicio((actuales) => {
      const siguientes = visible
        ? GRAFICAS_PREDETERMINADAS.filter((item) => item === grafica || actuales.includes(item))
        : actuales.filter((item) => item !== grafica);
      window.localStorage.setItem(LLAVE_GRAFICAS, JSON.stringify(siguientes));
      void guardarPreferencias({ graficasInicio: siguientes });
      return siguientes;
    });
  }, [guardarPreferencias]);

  const alternarColapso = useCallback(() => {
    setColapsada((actual) => {
      window.localStorage.setItem(LLAVE_BARRA, actual ? "expanded" : "collapsed");
      void guardarPreferencias({ barraContraida: !actual });
      return !actual;
    });
  }, [guardarPreferencias]);

  const abrirPaleta = useCallback(() => setPaletaAbierta(true), []);
  const cerrarPaleta = useCallback(() => setPaletaAbierta(false), []);
  const cerrarSesion = useCallback(() => {
    void signOut();
  }, [signOut]);

  // Atajos: Ctrl/Cmd+B contrae la barra, Ctrl/Cmd+K abre la paleta.
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        alternarColapso();
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAbierta((v) => !v);
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [alternarColapso]);

  useEffect(() => {
    if (!paletaAbierta) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [paletaAbierta]);

  const valor: EstadoCascaron = {
    yo,
    contadores,
    tema,
    cambiarTema,
    alternarTema,
    densidad,
    cambiarDensidad,
    acento,
    cambiarAcento,
    graficasInicio,
    cambiarGraficaInicio,
    colapsada,
    alternarColapso,
    paletaAbierta,
    abrirPaleta,
    cerrarPaleta,
    cerrarSesion,
  };

  return (
    <Contexto.Provider value={valor}>
      <div
        data-panel=""
        data-theme={tema}
        data-density={densidad}
        data-accent={acento}
        data-sidebar={colapsada ? "collapsed" : "expanded"}
        data-ready={listo ? "" : undefined}
      >
        <BarraLateral />
        <div className="ui-frame">
          <BarraSuperior />
          <main
            className={`ui-main${ruta.startsWith("/dashboard/correo") ? " ui-main-flush" : ""}`}
            key={ruta}
          >
            {children}
          </main>
        </div>
        <BarraInferior />
        {paletaAbierta ? <Paleta /> : null}
      </div>
    </Contexto.Provider>
  );
}
