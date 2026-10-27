import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requiereRol, usuarioActual, puede } from "./lib/rbac";
import { registrarEnBitacora } from "./lib/auditoria";
import { estadoPagoValidador, metodoPagoValidador } from "./lib/validadores";
import { esFechaEventoValida, esHoraEventoValida } from "../lib/correo-evento";

const estado = v.union(v.literal("valido"), v.literal("invalido"), v.literal("vencido"),
  v.literal("utilizado"), v.literal("pendiente"), v.literal("sin_acceso"));
const resultado = v.object({
  estado, nombre: v.optional(v.string()), evento: v.optional(v.string()),
  equipo: v.optional(v.string()),
  fecha: v.optional(v.string()), sede: v.optional(v.string()),
  utilizadoEn: v.optional(v.number()), venceEn: v.optional(v.number()),
  pago: v.optional(v.object({ metodo: metodoPagoValidador, estado: estadoPagoValidador, montoMxn: v.number() })),
});

async function leerBoleto(ctx: QueryCtx, codigo: string): Promise<Infer<typeof resultado>> {
  const id = codigo.length <= 64 ? ctx.db.normalizeId("eventRegistrations", codigo) : null;
  const registro = id ? await ctx.db.get(id) : null;
  const evento = registro ? await ctx.db.get(registro.eventId) : null;
  if (!registro || !evento || registro.estado === "cancelado" || evento.estado === "borrador") {
    return { estado: "invalido" as const };
  }
  const pago = registro.pago
    ? { metodo: registro.pago.metodo, estado: registro.pago.estado, montoMxn: registro.pago.montoMxn }
    : undefined;
  const datos = { nombre: registro.nombre, evento: evento.titulo, fecha: evento.fechaEvento, sede: evento.sede, equipo: registro.equipoNombre, pago };
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

/**
 * Validation, redemption and audit commit together; scanning never consumes a ticket.
 * Any fee still pending at the door (cash, or an online payment that never
 * settled) is collected in cash before confirming, so confirming records it as paid.
 */
export const confirmar = mutation({
  args: { codigo: v.string() }, returns: resultado,
  handler: async (ctx, { codigo }) => {
    const actor = await requiereRol(ctx, "editor");
    const boleto = await leerBoleto(ctx, codigo);
    if (boleto.estado !== "valido") return boleto;
    const id = ctx.db.normalizeId("eventRegistrations", codigo)!;
    const registro = (await ctx.db.get(id))!;
    const ahora = Date.now();
    const cobro = registro.pago?.estado === "pendiente"
      ? { metodo: "efectivo" as const, estado: "pagado" as const, montoMxn: registro.pago.montoMxn, pagadoEn: ahora }
      : undefined;
    await ctx.db.patch(id, { estado: "asistio", boletoUtilizadoEn: ahora,
      boletoUtilizadoPor: actor._id, actualizadoEn: ahora, ...(cobro ? { pago: cobro } : {}) });
    await registrarEnBitacora(ctx, { actor, accion: "evento.boleto.confirmado",
      entidad: "eventRegistrations", entidadId: id,
      detalle: cobro
        ? `Asistencia confirmada con boleto QR; cobro en efectivo de $${cobro.montoMxn} MXN`
        : "Asistencia confirmada con boleto QR" });
    return { ...boleto, estado: "utilizado" as const, utilizadoEn: ahora,
      ...(cobro ? { pago: { metodo: cobro.metodo, estado: cobro.estado, montoMxn: cobro.montoMxn } } : {}) };
  },
});
