import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Cuenta quienes ya marcaron asistencia en un evento.
 *
 * El indice by_event_and_estado evita recorrer toda la tabla; el tope de 5000
 * cubre el volumen de una sociedad estudiantil.
 */
export async function contarAsistentes(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<number> {
  const filas = await ctx.db
    .query("eventRegistrations")
    .withIndex("by_event_and_estado", (q) =>
      q.eq("eventId", eventId).eq("estado", "asistio"),
    )
    .take(5000);
  return filas.length;
}

export async function conAsistentes<T extends { _id: Id<"events"> }>(
  ctx: QueryCtx,
  eventos: T[],
): Promise<Array<T & { asistentes: number }>> {
  const pares = await Promise.all(
    eventos.map(async (evento) => [evento._id, await contarAsistentes(ctx, evento._id)] as const),
  );
  const mapa = new Map(pares);
  return eventos.map((evento) => ({ ...evento, asistentes: mapa.get(evento._id) ?? 0 }));
}
