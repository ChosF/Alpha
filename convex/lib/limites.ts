import type { MutationCtx } from "../_generated/server";

/**
 * Limite de tasa con ventana fija, guardado en la base.
 *
 * Vive en Convex y no en memoria del proceso porque Vercel es sin estado: dos
 * peticiones seguidas pueden caer en instancias distintas y un contador en RAM
 * no serviria de nada. Las mutations de Convex son transaccionales, asi que
 * leer-y-escribir el contador aqui no tiene condicion de carrera.
 */

export type ResultadoLimite = {
  permitido: boolean;
  restantes: number;
  reintentarEnMs: number;
};

export async function consumirLimite(
  ctx: MutationCtx,
  clave: string,
  maximo: number,
  ventanaMs: number,
): Promise<ResultadoLimite> {
  const ahora = Date.now();
  const existente = await ctx.db
    .query("rateLimits")
    .withIndex("by_clave", (q) => q.eq("clave", clave))
    .unique();

  if (existente === null) {
    await ctx.db.insert("rateLimits", { clave, ventanaInicio: ahora, conteo: 1 });
    return { permitido: true, restantes: maximo - 1, reintentarEnMs: 0 };
  }

  const finVentana = existente.ventanaInicio + ventanaMs;
  if (ahora >= finVentana) {
    await ctx.db.patch(existente._id, { ventanaInicio: ahora, conteo: 1 });
    return { permitido: true, restantes: maximo - 1, reintentarEnMs: 0 };
  }

  if (existente.conteo >= maximo) {
    return { permitido: false, restantes: 0, reintentarEnMs: finVentana - ahora };
  }

  await ctx.db.patch(existente._id, { conteo: existente.conteo + 1 });
  return {
    permitido: true,
    restantes: maximo - (existente.conteo + 1),
    reintentarEnMs: 0,
  };
}

/** Cuotas del proyecto, en un solo lugar para poder ajustarlas sin buscar. */
export const CUOTAS = {
  /** Registro publico: por direccion IP. */
  registroPorIp: { maximo: 5, ventanaMs: 10 * 60 * 1000 },
  /** Registro publico: por correo, para frenar reenvios del mismo formulario. */
  registroPorCorreo: { maximo: 3, ventanaMs: 24 * 60 * 60 * 1000 },
  /** Invitaciones emitidas por un mismo administrador. */
  invitacionesPorAdmin: { maximo: 20, ventanaMs: 60 * 60 * 1000 },
  /** Correos manuales emitidos por una misma cuenta del panel. */
  correosPorUsuario: { maximo: 40, ventanaMs: 60 * 60 * 1000 },
} as const;
