import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { limpiarTexto } from "./texto";

/**
 * Bitacora. Se escribe desde las mutations, nunca desde el cliente, para que
 * el rastro no dependa de la buena fe de quien llama.
 */
export async function registrarEnBitacora(
  ctx: MutationCtx,
  args: {
    actor: Doc<"users"> | null;
    accion: string;
    entidad: string;
    entidadId?: string;
    detalle?: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLog", {
    ...(args.actor ? { actorId: args.actor._id } : {}),
    actorCorreo: args.actor?.email ?? "sistema",
    accion: limpiarTexto(args.accion, 60),
    entidad: limpiarTexto(args.entidad, 40),
    ...(args.entidadId ? { entidadId: limpiarTexto(args.entidadId, 64) } : {}),
    ...(args.detalle ? { detalle: limpiarTexto(args.detalle, 300) } : {}),
    creadoEn: Date.now(),
  });
}
