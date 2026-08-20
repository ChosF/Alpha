import { z } from "zod";
import { AREAS } from "@/convex/lib/validadores";
import { limpiarMultilinea, limpiarTexto, normalizarCorreo, normalizarTelefono } from "@/convex/lib/texto";

/**
 * Validacion del formulario publico.
 *
 * Es el primer filtro: corre en el route handler antes de que nada toque la
 * base. Convex vuelve a validar con sus propios validadores, a proposito: si
 * un dia alguien llama a la funcion por otro camino, la segunda barrera sigue
 * de pie.
 */

/**
 * Dominios aceptados en el correo. La ventana de registro pide "correo
 * institucional", y exigirlo es de las pocas defensas gratuitas contra altas
 * automatizadas. Para abrirlo a correos personales, basta agregar aqui.
 */
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

export const esquemaRegistro = z
  .object({
    tipo: z.enum(["miembro", "aliado"], { error: "Elige si entras como miembro o como aliado." }),
    nombre: texto(2, 80, "Nombre"),
    correo: z
      .string()
      .max(120, "El correo es demasiado largo.")
      .transform(normalizarCorreo)
      .refine((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c), "Ese correo no parece valido.")
      .refine(dominioPermitido, "Usa tu correo institucional (@tec.mx o @exatec.tec.mx)."),
    carrera: texto(2, 80, "Carrera y semestre"),
    matricula: z
      .string()
      .transform((valor) => limpiarTexto(valor, 12).toUpperCase())
      .refine((valor) => valor === "" || /^A\d{8}$/.test(valor), "La matricula va como A01234567.")
      .optional()
      .default(""),

    // Miembro
    avisosCorreo: z.boolean().optional().default(false),
    whatsapp: z.boolean().optional().default(false),
    telefono: z
      .string()
      .transform(normalizarTelefono)
      .refine((valor) => valor === "" || /^\d{10}$/.test(valor), "El telefono va a 10 digitos.")
      .optional()
      .default(""),

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
    sitio_web: z.string().max(200).optional().default(""),
    // Token firmado emitido por /api/registro/token.
    token: z.string().min(10).max(512),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === "miembro" && datos.whatsapp && datos.telefono === "") {
      ctx.addIssue({
        code: "custom",
        path: ["telefono"],
        message: "Si quieres el grupo de WhatsApp, deja tu numero.",
      });
    }
  });

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

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
    ...(datos.matricula ? { matricula: datos.matricula } : {}),
    canales: {
      correo: esMiembro ? datos.avisosCorreo : false,
      whatsapp: esMiembro ? datos.whatsapp : false,
    },
    ...(esMiembro && datos.whatsapp && datos.telefono ? { telefono: datos.telefono } : {}),
    areas: esMiembro ? [] : datos.areas,
    ...(!esMiembro && datos.aporte ? { aporte: datos.aporte } : {}),
    ipHash: extra.ipHash,
    userAgent: extra.userAgent,
  };
}

/** Primer mensaje de error legible, para devolver algo util al formulario. */
export function primerError(error: z.ZodError): string {
  const problema = error.issues[0];
  return problema?.message ?? "Revisa los datos del formulario.";
}
