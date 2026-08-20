import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Rol } from "./validadores";

/**
 * Control de acceso.
 *
 * Toda funcion del panel empieza por aqui. La regla es que ninguna funcion
 * confia en lo que dice el cliente: el rol se lee de la base a partir de la
 * identidad de la sesion, en cada llamada.
 */

const JERARQUIA: Record<Rol, number> = { lector: 1, editor: 2, admin: 3 };

export class ErrorAutorizacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorAutorizacion";
  }
}

/** Usuario de la sesion, o null si no hay sesion valida. */
export async function usuarioActual(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const usuario = await ctx.db.get(userId as Id<"users">);
  if (usuario === null || !usuario.activo) return null;
  return usuario;
}

/**
 * Exige sesion y rol minimo. Lanza si no se cumple, de modo que el handler
 * que sigue puede asumir que el usuario existe y esta autorizado.
 */
export async function requiereRol(
  ctx: QueryCtx | MutationCtx,
  minimo: Rol,
): Promise<Doc<"users">> {
  const usuario = await usuarioActual(ctx);
  if (usuario === null) {
    throw new ErrorAutorizacion("Sesion no valida o cuenta desactivada.");
  }
  if (JERARQUIA[usuario.rol] < JERARQUIA[minimo]) {
    throw new ErrorAutorizacion("Tu rol no permite esta operacion.");
  }
  return usuario;
}

/** Version booleana, para decidir que mostrar sin lanzar. */
export function puede(usuario: Doc<"users"> | null, minimo: Rol): boolean {
  if (usuario === null || !usuario.activo) return false;
  return JERARQUIA[usuario.rol] >= JERARQUIA[minimo];
}
