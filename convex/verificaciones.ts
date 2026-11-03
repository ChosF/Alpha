import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { registrarEnBitacora } from "./lib/auditoria";
import { requiereRol } from "./lib/rbac";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo } from "./lib/texto";
import {
  areaValidador,
  estadoRegistroValidador,
  tipoRegistroValidador,
} from "./lib/validadores";
import { NETWORKING_NIGHT } from "../lib/networking-night";

export const resolver = mutation({
  args: {
    id: v.id("eventRegistrations"),
    decision: v.union(
      v.literal("aprobar"),
      v.literal("rechazar"),
      v.literal("convertir_estudiante"),
    ),
    motivo: v.optional(v.string()),
    notificar: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const r = await ctx.db.get(args.id);
    if (!r) throw new ConvexError("Ese registro ya no existe.");
    if (!r.verificacion || r.verificacion.estado !== "pendiente") {
      throw new ConvexError("Otra persona del equipo ya resolvió esta solicitud.");
    }

    const ahora = Date.now();
    const motivo = args.motivo ? limpiarMultilinea(args.motivo, 500) : undefined;
    const revisado = {
      metodo: "manual" as const,
      revisadoPor: actor._id,
      revisadoEn: ahora,
      ...(motivo ? { motivo } : {}),
    };

    const tipoOriginal = r.tipoAsistente ?? "estudiante";

    if (args.decision === "rechazar") {
      await ctx.db.patch(r._id, {
        estado: "cancelado",
        verificacion: { estado: "rechazada", ...revisado },
        actualizadoEn: ahora,
      });
      if (args.notificar !== false) {
        await ctx.scheduler.runAfter(0, internal.correoActions.enviarRechazoNetworkingNight, {
          nombre: r.nombre,
          correo: r.correo,
          tipo: tipoOriginal,
        });
      }
    } else {
      const convertir = args.decision === "convertir_estudiante";
      const pago = convertir
        ? {
            metodo: "efectivo" as const,
            estado: "pendiente" as const,
            montoMxn: NETWORKING_NIGHT.cuotaMxn,
          }
        : undefined;
      await ctx.db.patch(r._id, {
        verificacion: { estado: "aprobada", ...revisado },
        boletoEnviadoEn: ahora,
        actualizadoEn: ahora,
        ...(convertir
          ? {
              tipoAsistente: "estudiante" as const,
              detalleTipo: undefined,
              pago,
            }
          : {}),
      });
      await ctx.scheduler.runAfter(0, internal.correoActions.enviarConfirmacionNetworkingNight, {
        nombre: r.nombre,
        correo: r.correo,
        registroId: r._id,
        tipo: convertir ? "estudiante" : tipoOriginal,
        ...(pago ? { pago } : {}),
      });
    }

    await registrarEnBitacora(ctx, {
      actor,
      accion: `evento.verificacion.${args.decision}`,
      entidad: "eventRegistrations",
      entidadId: r._id,
      detalle: `${tipoOriginal} · ${r.nombre}${motivo ? ` · ${motivo}` : ""}`,
    });

    return null;
  },
});

export const reenviarBoleto = mutation({
  args: { id: v.id("eventRegistrations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "editor");
    const r = await ctx.db.get(args.id);
    if (!r || r.estado === "cancelado") {
      throw new ConvexError("No se puede reenviar el boleto de un registro cancelado.");
    }
    if (r.verificacion && r.verificacion.estado !== "aprobada") {
      throw new ConvexError("Primero aprueba la verificación del registro.");
    }
    const ahora = Date.now();
    await ctx.db.patch(r._id, { boletoEnviadoEn: ahora, actualizadoEn: ahora });
    await ctx.scheduler.runAfter(0, internal.correoActions.enviarConfirmacionNetworkingNight, {
      nombre: r.nombre,
      correo: r.correo,
      registroId: r._id,
      tipo: r.tipoAsistente ?? "estudiante",
      ...(r.pago
        ? {
            pago: {
              metodo: r.pago.metodo,
              estado: r.pago.estado,
              montoMxn: r.pago.montoMxn,
            },
          }
        : {}),
    });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "evento.boleto.reenviado",
      entidad: "eventRegistrations",
      entidadId: r._id,
      detalle: r.correo,
    });
    return null;
  },
});

export const resumen = query({
  args: { eventId: v.id("events") },
  returns: v.object({
    pendientes: v.number(),
    aprobadas: v.number(),
    rechazadas: v.number(),
    cortesias: v.number(),
    porTipo: v.object({
      estudiante: v.number(),
      exatec: v.number(),
      ponente: v.number(),
      aliado: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    const filas = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_creado", (q) => q.eq("eventId", args.eventId))
      .take(5000);
    const porTipo = { estudiante: 0, exatec: 0, ponente: 0, aliado: 0 };
    let pendientes = 0;
    let aprobadas = 0;
    let rechazadas = 0;
    let cortesias = 0;
    for (const f of filas) {
      if (f.verificacion?.estado === "pendiente") pendientes += 1;
      else if (f.verificacion?.estado === "aprobada") aprobadas += 1;
      else if (f.verificacion?.estado === "rechazada") rechazadas += 1;
      if (f.estado === "cancelado") continue;
      const t = f.tipoAsistente ?? "estudiante";
      porTipo[t] += 1;
      if (t !== "estudiante" && (!f.verificacion || f.verificacion.estado === "aprobada")) {
        cortesias += 1;
      }
    }
    return { pendientes, aprobadas, rechazadas, cortesias, porTipo };
  },
});

const coincidenciaValidador = v.object({
  _id: v.id("registrations"),
  tipo: tipoRegistroValidador,
  nombre: v.string(),
  correo: v.string(),
  matricula: v.optional(v.string()),
  carrera: v.string(),
  semestre: v.optional(v.string()),
  areas: v.array(areaValidador),
  estado: estadoRegistroValidador,
});

/**
 * Cruza una solicitud de Aliado Alpha contra el padrón de `registrations`
 * (convocatoria de miembros y aliados). Devuelve coincidencias por correo,
 * matrícula o nombre para que el admin o editor confirme si realmente es aliado
 * (cortesía) o miembro (paga cuota de estudiante).
 */
export const buscarEnPadron = query({
  args: { id: v.id("eventRegistrations") },
  returns: v.array(coincidenciaValidador),
  handler: async (ctx, args) => {
    await requiereRol(ctx, "lector");
    const r = await ctx.db.get(args.id);
    if (!r) return [];

    const correo = normalizarCorreo(r.correo);
    const mat = limpiarTexto(r.matricula ?? "", 12).toUpperCase();
    const tokens = r.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const padron = await ctx.db.query("registrations").withIndex("by_creado").order("desc").take(2000);
    const resultados = padron.filter((p) => {
      if (normalizarCorreo(p.correo) === correo) return true;
      if (mat && p.matricula && p.matricula.toUpperCase() === mat) return true;
      if (tokens.length >= 2) {
        const nom = p.nombre
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return tokens.every((t) => nom.includes(t));
      }
      return false;
    });

    return resultados.slice(0, 5).map((p) => ({
      _id: p._id,
      tipo: p.tipo,
      nombre: p.nombre,
      correo: p.correo,
      ...(p.matricula ? { matricula: p.matricula } : {}),
      carrera: p.carrera,
      ...(p.semestre ? { semestre: p.semestre } : {}),
      areas: p.areas,
      estado: p.estado,
    }));
  },
});
