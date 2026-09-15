import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requiereRol, usuarioActual, puede } from "./lib/rbac";
import { registrarEnBitacora } from "./lib/auditoria";
import { esFechaEventoValida, esHoraEventoValida } from "../lib/correo-evento";

const estado = v.union(v.literal("valido"), v.literal("invalido"), v.literal("vencido"),
  v.literal("utilizado"), v.literal("pendiente"), v.literal("sin_acceso"));
const resultado = v.object({
  estado, nombre: v.optional(v.string()), evento: v.optional(v.string()),
  equipo: v.optional(v.string()),
  fecha: v.optional(v.string()), sede: v.optional(v.string()),
  utilizadoEn: v.optional(v.number()), venceEn: v.optional(v.number()),
});

async function leerBoleto(ctx: QueryCtx, codigo: string): Promise<Infer<typeof resultado>> {
  const id = codigo.length <= 64 ? ctx.db.normalizeId("eventRegistrations", codigo) : null;
  const registro = id ? await ctx.db.get(id) : null;
  const evento = registro ? await ctx.db.get(registro.eventId) : null;
  if (!registro || !evento || registro.estado === "cancelado" || evento.estado === "borrador") {
    return { estado: "invalido" as const };
  }
  const datos = { nombre: registro.nombre, evento: evento.titulo, fecha: evento.fechaEvento, sede: evento.sede, equipo: registro.equipoNombre };
  if (registro.boletoUtilizadoEn !== undefined || registro.estado === "asistio") {
    return { ...datos, estado: "utilizado" as const, utilizadoEn: registro.boletoUtilizadoEn };
  }
  if (evento.estado === "cerrado") return { ...datos, estado: "vencido" as const };
  if (!evento.fechaEvento || !esFechaEventoValida(evento.fechaEvento) ||
    (evento.horaFin && !esHoraEventoValida(evento.horaFin))) {
    return { ...datos, estado: "pendiente" as const };
  }
  // All Alpha events use Mexico City time (UTC-06). Without an end time,
  // admission closes at midnight after the event's scheduled day.
  const abreEn = Date.parse(`${evento.fechaEvento}T00:00:00-06:00`);
  let venceEn = evento.horaFin
    ? Date.parse(`${evento.fechaEvento}T${evento.horaFin}:00-06:00`)
    : abreEn + 86_400_000;
  if (evento.horaFin && evento.horaInicio && evento.horaFin <= evento.horaInicio) venceEn += 86_400_000;
  const ahora = Date.now();
  return { ...datos, venceEn, estado: ahora >= venceEn ? "vencido" as const
    : ahora < abreEn ? "pendiente" as const : "valido" as const };
}

/** No ticket data is returned until the active dashboard role is checked. */
export const validar = query({
  args: { codigo: v.string() }, returns: resultado,
  handler: async (ctx, { codigo }) => {
    if (!puede(await usuarioActual(ctx), "editor")) return { estado: "sin_acceso" as const };
    return leerBoleto(ctx, codigo);
  },
});

/** Validation, redemption and audit commit together; scanning never consumes a ticket. */
export const confirmar = mutation({
  args: { codigo: v.string() }, returns: resultado,
  handler: async (ctx, { codigo }) => {
    const actor = await requiereRol(ctx, "editor");
    const boleto = await leerBoleto(ctx, codigo);
    if (boleto.estado !== "valido") return boleto;
    const id = ctx.db.normalizeId("eventRegistrations", codigo)!;
    const ahora = Date.now();
    await ctx.db.patch(id, { estado: "asistio", boletoUtilizadoEn: ahora,
      boletoUtilizadoPor: actor._id, actualizadoEn: ahora });
    await registrarEnBitacora(ctx, { actor, accion: "evento.boleto.confirmado",
      entidad: "eventRegistrations", entidadId: id, detalle: "Asistencia confirmada con boleto QR" });
    return { ...boleto, estado: "utilizado" as const, utilizadoEn: ahora };
  },
});
