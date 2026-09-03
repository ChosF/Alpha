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
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { BarraInferior } from "./barra-inferior";
import { BarraLateral } from "./barra-lateral";
import { BarraSuperior } from "./barra-superior";
import { Paleta } from "./paleta";

type Tema = "dark" | "light";
type Yo = FunctionReturnType<typeof api.usuarios.yo>;
type Contadores = FunctionReturnType<typeof api.metricas.contadores>;

type EstadoCascaron = {
  yo: Yo | undefined;
  contadores: Contadores | undefined;
  tema: Tema;
  alternarTema: () => void;
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

/**
 * Armazon del panel: barra lateral retractil en escritorio, barra inferior en
 * movil, barra superior, paleta de comandos y tema. El estado de interfaz
 * vive aqui y se persiste en localStorage; el de sesion viene de Convex.
 */
export function Cascaron({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const yo = useQuery(api.usuarios.yo, {});
  const contadores = useQuery(api.metricas.contadores, {});
  const { signOut } = useAuthActions();

  const [tema, setTema] = useState<Tema>("light");
  const [colapsada, setColapsada] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [listo, setListo] = useState(false);

  // Preferencias guardadas. Se leen tras montar para no romper la hidratacion.
  useEffect(() => {
    const marco = requestAnimationFrame(() => {
      const t = window.localStorage.getItem(LLAVE_TEMA);
      const b = window.localStorage.getItem(LLAVE_BARRA);
      if (t === "dark" || t === "light") setTema(t);
      if (b === "collapsed") setColapsada(true);
      requestAnimationFrame(() => setListo(true));
    });
    return () => cancelAnimationFrame(marco);
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = tema;
  }, [tema]);

  const alternarTema = useCallback(() => {
    setTema((actual) => {
      const siguiente = actual === "dark" ? "light" : "dark";
      window.localStorage.setItem(LLAVE_TEMA, siguiente);
      return siguiente;
    });
  }, []);

  const alternarColapso = useCallback(() => {
    setColapsada((actual) => {
      window.localStorage.setItem(LLAVE_BARRA, actual ? "expanded" : "collapsed");
      return !actual;
    });
  }, []);

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
    alternarTema,
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
        data-sidebar={colapsada ? "collapsed" : "expanded"}
        data-ready={listo ? "" : undefined}
      >
        <BarraLateral />
        <div className="ui-frame">
          <BarraSuperior />
          <main className="ui-main" key={ruta}>
            {children}
          </main>
        </div>
        <BarraInferior />
        {paletaAbierta ? <Paleta /> : null}
      </div>
    </Contexto.Provider>
  );
}
