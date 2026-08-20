import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { areaValidador, estadoRegistroValidador, estadoProgramaValidador, pilarValidador, rolValidador, tipoRegistroValidador } from "./lib/validadores";

/**
 * Esquema de Alpha.
 *
 * Ninguna tabla usa v.any(): cada campo tiene validador, y los campos de
 * eleccion cerrada son uniones literales. Esa es la primera barrera contra
 * datos manipulados que llegan del exterior.
 */
export default defineSchema({
  // Tablas de Convex Auth (sesiones, cuentas, tokens de refresco, etc.)
  ...authTables,

  /**
   * Cuentas del panel. Reemplaza a la tabla `users` de authTables para
   * agregarle rol y estado; los campos de arriba son los que Convex Auth
   * espera encontrar.
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Campos propios de Alpha
    rol: rolValidador,
    activo: v.boolean(),
    area: v.optional(v.string()),
    ultimoAcceso: v.optional(v.number()),
    creadoEn: v.number(),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_rol", ["rol"]),

  /** Registros que llegan del formulario publico de la landing. */
  registrations: defineTable({
    tipo: tipoRegistroValidador,
    nombre: v.string(),
    correo: v.string(),
    carrera: v.string(),
    // Opcional para conservar registros creados antes de separar este campo.
    semestre: v.optional(v.string()),
    matricula: v.optional(v.string()),

    // Solo miembro
    canales: v.object({ correo: v.boolean(), whatsapp: v.boolean() }),
    telefono: v.optional(v.string()),

    // Solo aliado
    areas: v.array(areaValidador),
    aporte: v.optional(v.string()),

    // Gestion interna
    estado: estadoRegistroValidador,
    notas: v.optional(v.string()),

    // Procedencia. La IP nunca se guarda en claro.
    origen: v.string(),
    ipHash: v.string(),
    userAgent: v.string(),

    creadoEn: v.number(),
    actualizadoEn: v.number(),
  })
    .index("by_correo", ["correo"])
    .index("by_estado", ["estado"])
    .index("by_tipo", ["tipo"])
    .index("by_creado", ["creadoEn"]),

  /** Invitaciones al panel. El token en claro jamas se guarda. */
  invites: defineTable({
    correo: v.string(),
    nombre: v.string(),
    rol: rolValidador,
    tokenHash: v.string(),
    expiraEn: v.number(),
    usadaEn: v.optional(v.number()),
    revocadaEn: v.optional(v.number()),
    creadaPor: v.id("users"),
    creadaEn: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_correo", ["correo"]),

  /** Programa de trabajo que la landing publica. */
  programs: defineTable({
    titulo: v.string(),
    periodo: v.string(),
    pilar: pilarValidador,
    estado: estadoProgramaValidador,
    responsable: v.optional(v.string()),
    notas: v.optional(v.string()),
    orden: v.number(),
    publicado: v.boolean(),
    creadoEn: v.number(),
    actualizadoEn: v.number(),
  })
    .index("by_orden", ["orden"])
    .index("by_publicado", ["publicado", "orden"]),

  /** Bitacora. Solo se escribe desde el servidor. */
  auditLog: defineTable({
    actorId: v.optional(v.id("users")),
    actorCorreo: v.string(),
    accion: v.string(),
    entidad: v.string(),
    entidadId: v.optional(v.string()),
    detalle: v.optional(v.string()),
    creadoEn: v.number(),
  })
    .index("by_creado", ["creadoEn"])
    .index("by_actor", ["actorId"]),

  /** Ventanas deslizantes para limitar tasa. Sobrevive al modelo sin estado. */
  rateLimits: defineTable({
    clave: v.string(),
    ventanaInicio: v.number(),
    conteo: v.number(),
  }).index("by_clave", ["clave"]),
});
