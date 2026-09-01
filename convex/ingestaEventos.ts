import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { comparaSegura, limpiarTexto, normalizarCorreo, normalizarTelefono, sha256Hex } from "./lib/texto";
import { CUOTAS, consumirLimite } from "./lib/limites";
import { CALLING_LAF, registroCallingLafDisponible } from "../lib/calling-laf";
import { MARIO_KART_CHALLENGE } from "../lib/mario-kart";
import { enviarConfirmacionCallingLaf, enviarConfirmacionMarioKart } from "./correo";

const SLUG_CALLING_LAF = CALLING_LAF.slug;
const SLUG_MARIO_KART = MARIO_KART_CHALLENGE.slug;

const datosRegistroEvento = v.object({
  nombre: v.string(),
  correo: v.string(),
  carrera: v.string(),
  semestre: v.string(),
  matricula: v.optional(v.string()),
  canales: v.object({ correo: v.boolean(), whatsapp: v.boolean() }),
  telefono: v.optional(v.string()),
  ipHash: v.string(),
  userAgent: v.string(),
});

function exigirSecreto(secreto: string) {
  const esperado = process.env.INGEST_SECRET;
  if (typeof esperado !== "string" || esperado.length < 32) {
    throw new Error("INGEST_SECRET no esta configurado en Convex.");
  }
  if (!comparaSegura(secreto, esperado)) throw new Error("No autorizado.");
}

/**
 * Crea el registro fijo de Calling LAF de forma idempotente. Solo acepta el
 * secreto del servidor y no recibe contenido editable desde el cliente.
 */
export const asegurarCallingLaf = action({
  args: { secreto: v.string() },
  returns: v.id("events"),
  handler: async (ctx, args): Promise<Id<"events">> => {
    exigirSecreto(args.secreto);
    return await ctx.runMutation(internal.ingestaEventos.asegurarEventoCallingLaf, {});
  },
});

export const asegurarEventoCallingLaf = internalMutation({
  args: {},
  returns: v.id("events"),
  handler: async (ctx) => {
    const existente = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", SLUG_CALLING_LAF))
      .unique();
    if (existente !== null) return existente._id;

    const ahora = Date.now();
    return await ctx.db.insert("events", {
      slug: SLUG_CALLING_LAF,
      titulo: "Calling LAF",
      resumen:
        "Un encuentro para entender concentraciones, certificaciones y rutas profesionales antes de elegir el siguiente paso de la carrera.",
      pilar: "desarrollo",
      estado: "publicado",
      registroAbierto: true,
      totalRegistros: 0,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  },
});

/** Crea el evento de Mario Kart sin recibir contenido editable del cliente. */
export const asegurarMarioKart = action({
  args: { secreto: v.string() },
  returns: v.id("events"),
  handler: async (ctx, args): Promise<Id<"events">> => {
    exigirSecreto(args.secreto);
    return await ctx.runMutation(internal.ingestaEventos.asegurarEventoMarioKart, {
      activar: true,
    });
  },
});

export const asegurarEventoMarioKart = internalMutation({
  args: { activar: v.boolean() },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", SLUG_MARIO_KART))
      .unique();
    if (existente !== null) {
      if (args.activar) {
        await ctx.db.patch(existente._id, {
          titulo: MARIO_KART_CHALLENGE.titulo,
          resumen: MARIO_KART_CHALLENGE.resumen,
          pilar: "comunidad",
          estado: "publicado",
          registroAbierto: true,
          actualizadoEn: Date.now(),
        });
      }
      return existente._id;
    }

    const ahora = Date.now();
    return await ctx.db.insert("events", {
      slug: SLUG_MARIO_KART,
      titulo: MARIO_KART_CHALLENGE.titulo,
      resumen: MARIO_KART_CHALLENGE.resumen,
      pilar: "comunidad",
      estado: "publicado",
      registroAbierto: true,
      totalRegistros: 0,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  },
});

export const registrar = action({
  args: { secreto: v.string(), slug: v.string(), datos: datosRegistroEvento },
  returns: v.object({ ok: v.boolean(), motivo: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; motivo?: string }> => {
    exigirSecreto(args.secreto);
    const slug = limpiarTexto(args.slug, 80).toLowerCase();
    if (slug === SLUG_MARIO_KART) {
      await ctx.runMutation(internal.ingestaEventos.asegurarEventoMarioKart, {
        activar: false,
      });
    }
    const resultado = await ctx.runMutation(internal.ingestaEventos.guardar, {
      slug,
      datos: args.datos,
    });
    const debeEnviarConfirmacion =
      slug === SLUG_MARIO_KART || args.datos.canales.correo;
    if (resultado.ok && resultado.creado && debeEnviarConfirmacion) {
      try {
        const datosCorreo = { nombre: args.datos.nombre, correo: args.datos.correo };
        const encolado =
          slug === SLUG_MARIO_KART
            ? await enviarConfirmacionMarioKart(ctx, datosCorreo)
            : slug === SLUG_CALLING_LAF
              ? await enviarConfirmacionCallingLaf(ctx, datosCorreo)
              : false;
        if (!encolado) {
          console.error(`No se encoló la confirmación de ${slug}: correo automático no configurado.`);
        }
      } catch (error) {
        console.error(
          `No se pudo encolar la confirmación de ${slug}.`,
          error instanceof Error ? error.message : "Error desconocido",
        );
      }
    }
    return resultado.ok
      ? { ok: true }
      : { ok: false, ...(resultado.motivo ? { motivo: resultado.motivo } : {}) };
  },
});

export const guardar = internalMutation({
  args: { slug: v.string(), datos: datosRegistroEvento },
  returns: v.object({ ok: v.boolean(), creado: v.boolean(), motivo: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const slug = limpiarTexto(args.slug, 80).toLowerCase();
    if (slug === SLUG_CALLING_LAF && !registroCallingLafDisponible()) {
      return { ok: false, creado: false, motivo: "cerrado" };
    }
    const evento = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (evento === null || evento.estado !== "publicado" || !evento.registroAbierto) {
      return { ok: false, creado: false, motivo: "cerrado" };
    }

    const datos = args.datos;
    const correo = normalizarCorreo(datos.correo);
    const telefono = datos.telefono ? normalizarTelefono(datos.telefono) : undefined;
    if (!datos.canales.correo && !datos.canales.whatsapp) {
      throw new Error("El registro necesita un canal de contacto.");
    }
    if (datos.canales.whatsapp && !telefono) {
      throw new Error("El registro de WhatsApp necesita telefono.");
    }
    if (telefono && !/^\d{10}$/.test(telefono)) {
      throw new Error("El telefono debe tener 10 digitos.");
    }

    const limiteIp = await consumirLimite(
      ctx,
      `evento:${evento._id}:ip:${datos.ipHash}`,
      CUOTAS.registroPorIp.maximo,
      CUOTAS.registroPorIp.ventanaMs,
    );
    if (!limiteIp.permitido) return { ok: false, creado: false, motivo: "limite" };

    const claveCorreo = `evento:${evento._id}:correo:${await sha256Hex(correo)}`;
    const limiteCorreo = await consumirLimite(
      ctx,
      claveCorreo,
      CUOTAS.registroPorCorreo.maximo,
      CUOTAS.registroPorCorreo.ventanaMs,
    );
    if (!limiteCorreo.permitido) return { ok: false, creado: false, motivo: "limite" };

    const existente = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_and_correo", (q) =>
        q.eq("eventId", evento._id).eq("correo", correo),
      )
      .unique();
    if (existente !== null) return { ok: true, creado: false };

    const ahora = Date.now();
    await ctx.db.insert("eventRegistrations", {
      eventId: evento._id,
      nombre: limpiarTexto(datos.nombre, 80),
      correo,
      carrera: limpiarTexto(datos.carrera, 80),
      semestre: limpiarTexto(datos.semestre, 30),
      ...(datos.matricula
        ? { matricula: limpiarTexto(datos.matricula, 12).toUpperCase() }
        : {}),
      canales: datos.canales,
      ...(telefono ? { telefono } : {}),
      estado: "registrado",
      origen: `evento:${slug}`,
      ipHash: limpiarTexto(datos.ipHash, 128),
      userAgent: limpiarTexto(datos.userAgent, 200),
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await ctx.db.patch(evento._id, {
      totalRegistros: evento.totalRegistros + 1,
      actualizadoEn: ahora,
    });
    return { ok: true, creado: true };
  },
});
