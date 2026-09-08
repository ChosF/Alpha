"use client";

import { useState } from "react";
import { Boton, Menu, MenuItem } from "../ui/primitivas";
import { construirCsv } from "@/lib/csv";

export type TablaExportacion = {
  nombre: string;
  encabezados: string[];
  filas: (string | number | null)[][];
};

export function ExportarAnalytics({ tabla }: { tabla: TablaExportacion | null }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function descargar(formato: "csv" | "xlsx") {
    if (!tabla || ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const archivo = formato === "csv"
        ? new Blob([construirCsv(tabla.encabezados, tabla.filas)], { type: "text/csv;charset=utf-8" })
        : (await import("@/lib/xlsx")).construirXlsx(tabla.encabezados, tabla.filas, "Analytics");
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `${tabla.nombre}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("No se pudo exportar. Intenta de nuevo.");
    } finally { setOcupado(false); }
  }
  return <div className="an-export">
    <Menu disparador={abierto => <Boton disabled={!tabla || ocupado} aria-haspopup="menu" aria-expanded={abierto}>{ocupado ? "Exportando…" : "Exportar"}</Boton>}>
      <MenuItem disabled={!tabla || ocupado} onClick={() => void descargar("csv")}>Descargar CSV</MenuItem>
      <MenuItem disabled={!tabla || ocupado} onClick={() => void descargar("xlsx")}>Descargar Excel (.xlsx)</MenuItem>
    </Menu>
    {error ? <span role="alert" className="an-note">{error}</span> : null}
  </div>;
}
