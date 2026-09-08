import { v } from "convex/values";
import { z } from "zod";

export const periodoValidador = v.union(v.literal(7), v.literal(14), v.literal(30));
const fila = v.object({ clave: v.string(), cantidad: v.number() });
export const informeValidador = v.object({
  desde: v.string(), hasta: v.string(), actualizadoEn: v.number(),
  visitantes: v.number(), vistas: v.number(),
  diario: v.array(fila), paginas: v.array(fila), fuentes: v.array(fila),
  dispositivos: v.array(fila), paises: v.array(fila), navegadores: v.array(fila),
});
export type InformeWeb = {
  desde: string; hasta: string; actualizadoEn: number; visitantes: number; vistas: number;
  diario: FilaWeb[]; paginas: FilaWeb[]; fuentes: FilaWeb[];
  dispositivos: FilaWeb[]; paises: FilaWeb[]; navegadores: FilaWeb[];
};
export type FilaWeb = { clave: string; cantidad: number };
export const respuestaVercel = z.object({ data: z.array(z.object({
  pageviews: z.number().nonnegative(), visitors: z.number().nonnegative(),
  timestamp: z.string().optional(), requestPath: z.string().nullable().optional(),
  referrerHostname: z.string().nullable().optional(), deviceType: z.string().nullable().optional(),
  country: z.string().nullable().optional(), browserName: z.string().nullable().optional(),
})) });

export function rangoWeb(dias: number, ahora: number) {
  // Complete UTC days keep all panels aligned and avoid a partial day looking like a drop.
  const hasta = new Date(ahora).toISOString().slice(0, 10);
  const desde = new Date(Date.parse(hasta) - dias * 86_400_000).toISOString().slice(0, 10);
  return { desde, hasta };
}

export function completarDias(filas: FilaWeb[], desde: string, hasta: string): FilaWeb[] {
  const cantidades = new Map(filas.map((fila) => [fila.clave.slice(0, 10), fila.cantidad]));
  const dias: FilaWeb[] = [];
  for (let fecha = Date.parse(desde); fecha < Date.parse(hasta); fecha += 86_400_000) {
    const clave = new Date(fecha).toISOString().slice(0, 10);
    dias.push({ clave, cantidad: cantidades.get(clave) ?? 0 });
  }
  return dias;
}
