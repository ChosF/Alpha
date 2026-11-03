import { z } from "zod";
import { AREAS } from "@/convex/lib/validadores";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo, normalizarTelefono } from "@/convex/lib/texto";
import {
  AREAS_ALIADO_NETWORKING_NIGHT,
  INTERESES_NETWORKING_NIGHT,
  MAX_HABILIDADES_NETWORKING_NIGHT,
  MAX_INTERESES_NETWORKING_NIGHT,
  METODOS_PAGO_NETWORKING_NIGHT,
  OPCIONES_PONENTE_NETWORKING_NIGHT,
  SEMESTRES_NETWORKING_NIGHT,
} from "@/lib/networking-night";

/**
 * Validacion del formulario publico.
 *
 * Es el primer filtro: corre en el route handler antes de que nada toque la
 * base. Convex vuelve a validar con sus propios validadores, a proposito: si
 * un dia alguien llama a la funcion por otro camino, la segunda barrera sigue
 * de pie.
 */

/** Los aliados usan correo institucional; los miembros pueden usar cualquier correo valido. */
export const DOMINIOS_PERMITIDOS = ["tec.mx", "exatec.tec.mx"] as const;

function dominioPermitido(correo: string): boolean {
  const arroba = correo.lastIndexOf("@");
  if (arroba === -1) return false;
  const dominio = correo.slice(arroba + 1);
  return DOMINIOS_PERMITIDOS.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

const texto = (min: number, max: number, campo: string) =>
  z
    .string()
    .transform((valor) => limpiarTexto(valor, max))
    .refine((valor) => valor.length >= min, `${campo}: escribe al menos ${min} caracteres.`);

const camposPersona = {
  nombre: texto(2, 80, "Nombre"),
  correo: z
    .string()
    .max(120, "El correo es demasiado largo.")
    .transform(normalizarCorreo)
    .refine((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c), "Ese correo no parece valido."),
  carrera: texto(2, 80, "Carrera"),
  semestre: texto(1, 30, "Semestre"),
  matricula: z
    .string()
    .transform((valor) => limpiarTexto(valor, 12).toUpperCase())
    .refine((valor) => valor === "" || /^A\d{8}$/.test(valor), "La matricula va como A01234567.")
    .optional()
    .default(""),
} as const;

const camposContactoMiembro = {
  avisosCorreo: z.boolean().optional().default(false),
  whatsapp: z.boolean().optional().default(false),
  telefono: z
    .string()
    .transform(normalizarTelefono)
    .refine((valor) => valor === "" || /^\d{10}$/.test(valor), "El telefono va a 10 digitos.")
    .optional()
    .default(""),
} as const;

const defensasFormulario = {
  sitio_web: z.string().max(200).optional().default(""),
  token: z.string().min(10).max(512),
} as const;

export const esquemaRegistro = z
  .object({
    tipo: z.enum(["miembro", "aliado"], { error: "Elige si entras como miembro o como aliado." }),
    ...camposPersona,

    // Miembro
    ...camposContactoMiembro,

    // Aliado
    areas: z
      .array(z.enum(AREAS, { error: "Esa area no existe." }))
      .max(AREAS.length)
      .optional()
      .default([]),
    aporte: z
      .string()
      .transform((valor) => limpiarMultilinea(valor, 300))
      .optional()
      .default(""),

    // Antiabuso: campo trampa que un humano nunca ve ni llena. A proposito
    // NO se rechaza aqui: el route handler responde con un exito fingido para
    // no ensenarle al bot que cayo en la trampa.
    ...defensasFormulario,
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === "aliado" && !dominioPermitido(datos.correo)) {
      ctx.addIssue({
        code: "custom",
        path: ["correo"],
        message: "Como aliado, usa tu correo institucional (@tec.mx o @exatec.tec.mx).",
      });
    }
    if (datos.tipo === "miembro" && !datos.avisosCorreo && !datos.whatsapp) {
      ctx.addIssue({
        code: "custom",
        path: ["avisosCorreo"],
        message: "Elige Correo Electrónico, Whatsapp o ambos.",
      });
    }
    if (datos.tipo === "miembro" && datos.whatsapp && datos.telefono === "") {
      ctx.addIssue({
        code: "custom",
        path: ["telefono"],
        message: "Si quieres el grupo de WhatsApp, deja tu número.",
      });
    }
    if (datos.tipo === "aliado" && datos.telefono === "") {
      ctx.addIssue({
        code: "custom",
        path: ["telefono"],
        message: "Como aliado, deja tu número de teléfono.",
      });
    }
  });

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaRegistroEvento = z
  .object({
    ...camposPersona,
    ...camposContactoMiembro,
    ...defensasFormulario,
  })
  .superRefine((datos, ctx) => {
    if (!datos.avisosCorreo && !datos.whatsapp) {
      ctx.addIssue({
        code: "custom",
        path: ["avisosCorreo"],
        message: "Elige Correo Electronico, WhatsApp o ambos.",
      });
    }
    if (datos.whatsapp && datos.telefono === "") {
      ctx.addIssue({
        code: "custom",
        path: ["telefono"],
        message: "Si eliges WhatsApp, deja tu numero.",
      });
    }
  });

export type DatosRegistroEvento = z.infer<typeof esquemaRegistroEvento>;

/** Pasa del formulario a la forma que espera Convex. */
export function aPayloadConvex(
  datos: DatosRegistro,
  extra: { ipHash: string; userAgent: string },
) {
  const esMiembro = datos.tipo === "miembro";
  return {
    tipo: datos.tipo,
    nombre: datos.nombre,
    correo: datos.correo,
    carrera: datos.carrera,
    semestre: datos.semestre,
    ...(datos.matricula ? { matricula: datos.matricula } : {}),
    canales: {
      correo: esMiembro ? datos.avisosCorreo : false,
      whatsapp: esMiembro ? datos.whatsapp : false,
    },
    ...(datos.telefono ? { telefono: datos.telefono } : {}),
    areas: esMiembro ? [] : datos.areas,
    ...(!esMiembro && datos.aporte ? { aporte: datos.aporte } : {}),
    ipHash: extra.ipHash,
    userAgent: extra.userAgent,
  };
}

export function aPayloadEventoConvex(
  datos: DatosRegistroEvento,
  extra: { ipHash: string; userAgent: string },
) {
  return {
    nombre: datos.nombre,
    correo: datos.correo,
    carrera: datos.carrera,
    semestre: datos.semestre,
    ...(datos.matricula ? { matricula: datos.matricula } : {}),
    canales: { correo: datos.avisosCorreo, whatsapp: datos.whatsapp },
    ...(datos.telefono ? { telefono: datos.telefono } : {}),
    ipHash: extra.ipHash,
    userAgent: extra.userAgent,
  };
}

const correoNetworkingNight = z
  .string()
  .max(120, "El correo es demasiado largo.")
  .transform(normalizarCorreo)
  .refine((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c), "Escribe un correo electrónico válido.");

const matriculaNetworkingNight = z
  .string()
  .transform((valor) => limpiarTexto(valor, 12).toUpperCase())
  .refine((valor) => /^[AL]\d{8}$/.test(valor), "La matrícula va como A01234567.");

const matriculaOpcionalNetworkingNight = z
  .string()
  .transform((valor) => limpiarTexto(valor, 12).toUpperCase())
  .refine(
    (valor) => valor === "" || /^[AL]\d{8}$/.test(valor),
    "La matrícula va como A01234567.",
  )
  .optional();

const interesesNetworkingNight = z
  .array(z.enum(INTERESES_NETWORKING_NIGHT, { error: "Ese interés no está en la lista." }))
  .max(MAX_INTERESES_NETWORKING_NIGHT, `Elige hasta ${MAX_INTERESES_NETWORKING_NIGHT} intereses.`)
  .optional()
  .default([]);

const habilidadesNetworkingNight = z
  .array(z.string().transform((valor) => limpiarTexto(valor, 32)))
  .max(MAX_HABILIDADES_NETWORKING_NIGHT, `Agrega hasta ${MAX_HABILIDADES_NETWORKING_NIGHT} habilidades.`)
  .optional()
  .default([]);

const cvStorageIdValidador = z
  .string({ error: "Sube tu CV en PDF para confirmar tu perfil." })
  .regex(/^[a-z0-9]{16,64}$/, "No pudimos leer tu CV. Vuelve a subirlo.");

const baseNetworkingNight = {
  nombre: texto(3, 80, "Nombre"),
  correo: correoNetworkingNight,
  consentimiento: z.literal(true, { error: "Acepta el aviso de privacidad para continuar." }),
  ...defensasFormulario,
} as const;

const camposEstudianteNetworkingNight = {
  matricula: matriculaNetworkingNight,
  carrera: texto(2, 60, "Carrera"),
  semestre: z.enum(SEMESTRES_NETWORKING_NIGHT, { error: "Elige tu semestre." }),
  intereses: interesesNetworkingNight,
  habilidades: habilidadesNetworkingNight,
  cvStorageId: cvStorageIdValidador.optional(),
} as const;

const linkedinOpcional = z
  .string()
  .transform((v) => limpiarTexto(v, 200))
  .refine((v) => {
    if (!v) return true;
    const conProtocolo = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(conProtocolo);
      return /(^|\.)linkedin\.com$/i.test(url.hostname);
    } catch {
      return false;
    }
  }, "Pega tu perfil de LinkedIn (linkedin.com/in/...).")
  .optional();

export const esquemaRegistroNetworkingNight = z.preprocess(
  (cuerpo) =>
    cuerpo && typeof cuerpo === "object" && !("tipo" in cuerpo)
      ? { ...(cuerpo as Record<string, unknown>), tipo: "estudiante" }
      : cuerpo,
  z.discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("estudiante"),
      ...baseNetworkingNight,
      ...camposEstudianteNetworkingNight,
      metodoPago: z.enum(METODOS_PAGO_NETWORKING_NIGHT, {
        error: "Por ahora solo puedes pagar en efectivo el día del evento.",
      }),
    }),
    z.object({
      tipo: z.literal("aliado"),
      ...baseNetworkingNight,
      ...camposEstudianteNetworkingNight,
      area: z.enum(AREAS_ALIADO_NETWORKING_NIGHT, { error: "Elige tu área en Alpha." }),
    }),
    z.object({
      tipo: z.literal("exatec"),
      ...baseNetworkingNight,
      carrera: texto(2, 60, "Carrera"),
      generacion: z.coerce
        .number({ error: "Escribe tu año de egreso." })
        .int("Escribe tu año de egreso con 4 dígitos.")
        .min(1950, "Revisa tu año de egreso.")
        .max(new Date().getFullYear(), "Revisa tu año de egreso.")
        .transform(String),
      matricula: matriculaOpcionalNetworkingNight,
      empresa: z
        .string()
        .transform((v) => limpiarTexto(v, 80))
        .optional(),
      puesto: z
        .string()
        .transform((v) => limpiarTexto(v, 80))
        .optional(),
      linkedin: linkedinOpcional,
      intereses: interesesNetworkingNight,
      habilidades: habilidadesNetworkingNight,
      cvStorageId: cvStorageIdValidador,
    }),
    z.object({
      tipo: z.literal("ponente"),
      ...baseNetworkingNight,
      ponenteId: z.enum(OPCIONES_PONENTE_NETWORKING_NIGHT, {
        error: "Elige tu nombre en la lista de ponentes.",
      }),
    }),
  ]),
);

export type DatosRegistroNetworkingNight = z.infer<typeof esquemaRegistroNetworkingNight>;

/** Primer mensaje de error legible, para devolver algo util al formulario. */
export function primerError(error: z.ZodError): string {
  const problema = error.issues[0];
  return problema?.message ?? "Revisa los datos del formulario.";
}
