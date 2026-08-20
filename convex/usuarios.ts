import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Rol } from "./lib/validadores";
import { requiereRol, usuarioActual } from "./lib/rbac";
import { registrarEnBitacora } from "./lib/auditoria";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import { rolValidador } from "./lib/validadores";
import { CUOTAS, consumirLimite } from "./lib/limites";

/** Vigencia de una invitacion. */
const DIAS_INVITACION = 7;

/**
 * Cuentas del panel e invitaciones.
 *
 * El token de invitacion se genera aqui, se devuelve UNA sola vez y de el solo
 * queda el SHA-256 en la base. Si alguien consigue leer la tabla, no puede
 * reconstruir el enlace.
 */

export const yo = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return null;
    return {
      _id: usuario._id,
      nombre: usuario.name ?? "",
      correo: usuario.email ?? "",
      rol: usuario.rol,
      area: usuario.area,
    };
  },
});

export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requiereRol(ctx, "admin");
    const filas = await ctx.db.query("users").collect();
    return filas.map((u) => ({
      _id: u._id,
      nombre: u.name ?? "",
      correo: u.email ?? "",
      rol: u.rol,
      area: u.area,
      activo: u.activo,
      ultimoAcceso: u.ultimoAcceso,
      creadoEn: u.creadoEn,
    }));
  },
});

export const invitacionesPendientes = query({
  args: {},
  handler: async (ctx) => {
    await requiereRol(ctx, "admin");
    const ahora = Date.now();
    const filas = await ctx.db.query("invites").collect();
    return filas
      .filter((i) => i.usadaEn === undefined && i.revocadaEn === undefined && i.expiraEn > ahora)
      .map((i) => ({
        _id: i._id,
        correo: i.correo,
        nombre: i.nombre,
        rol: i.rol,
        expiraEn: i.expiraEn,
        creadaEn: i.creadaEn,
      }));
  },
});

/**
 * Crea una invitacion y devuelve el token en claro. Es la unica vez que ese
 * valor existe fuera del navegador de quien invita.
 */
export const invitar = mutation({
  args: { correo: v.string(), nombre: v.string(), rol: rolValidador },
  returns: v.object({ token: v.string(), expiraEn: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");

    const limite = await consumirLimite(
      ctx,
      `invitaciones:${actor._id}`,
      CUOTAS.invitacionesPorAdmin.maximo,
      CUOTAS.invitacionesPorAdmin.ventanaMs,
    );
    if (!limite.permitido) {
      throw new Error("Demasiadas invitaciones seguidas. Intenta mas tarde.");
    }

    const correo = normalizarCorreo(args.correo);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      throw new Error("Ese correo no es valido.");
    }

    const yaExiste = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", correo))
      .unique();
    if (yaExiste !== null) {
      throw new Error("Esa persona ya tiene cuenta en el panel.");
    }

    // 32 bytes de aleatoriedad criptografica, en hexadecimal.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ahora = Date.now();
    const expiraEn = ahora + DIAS_INVITACION * 24 * 60 * 60 * 1000;

    await ctx.db.insert("invites", {
      correo,
      nombre: limpiarTexto(args.nombre, 80),
      rol: args.rol,
      tokenHash: await sha256Hex(token),
      expiraEn,
      creadaPor: actor._id,
      creadaEn: ahora,
    });

    await registrarEnBitacora(ctx, {
      actor,
      accion: "usuario.invitado",
      entidad: "invites",
      detalle: `${correo} como ${args.rol}`,
    });

    return { token, expiraEn };
  },
});

export const revocarInvitacion = mutation({
  args: { id: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    const invitacion = await ctx.db.get(args.id);
    if (invitacion === null) return null;

    await ctx.db.patch(args.id, { revocadaEn: Date.now() });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "invitacion.revocada",
      entidad: "invites",
      entidadId: args.id,
      detalle: invitacion.correo,
    });
    return null;
  },
});

/** Comprueba un token de invitacion sin consumirlo (para la pantalla de alta). */
export const verificarInvitacion = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ correo: v.string(), nombre: v.string(), rol: rolValidador }),
  ),
  handler: async (ctx, args) => {
    // El token es de 32 bytes en hexadecimal; cualquier otra cosa no puede
    // existir en la base y se rechaza sin tocarla.
    if (!/^[0-9a-f]{64}$/.test(args.token)) return null;

    // La tabla guarda el hash, nunca el token: se calcula antes de consultar
    // porque el callback del indice no puede ser asincrono.
    const tokenHash = await sha256Hex(args.token);
    const porHash = await ctx.db
      .query("invites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (porHash === null) return null;
    if (porHash.usadaEn !== undefined || porHash.revocadaEn !== undefined) return null;
    if (porHash.expiraEn < Date.now()) return null;

    return { correo: porHash.correo, nombre: porHash.nombre, rol: porHash.rol };
  },
});

export const cambiarRol = mutation({
  args: { id: v.id("users"), rol: rolValidador },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    const objetivo = await ctx.db.get(args.id);
    if (objetivo === null) throw new Error("Esa cuenta ya no existe.");

    // Nadie puede quitarse a si mismo el rol de admin: evita quedarse fuera.
    if (objetivo._id === actor._id && args.rol !== "admin") {
      throw new Error("No puedes quitarte a ti mismo el rol de administrador.");
    }
    await protegerUltimoAdmin(ctx, objetivo._id, args.rol, objetivo.activo);

    await ctx.db.patch(args.id, { rol: args.rol });
    await registrarEnBitacora(ctx, {
      actor,
      accion: "usuario.rol",
      entidad: "users",
      entidadId: args.id,
      detalle: `${objetivo.rol} -> ${args.rol}`,
    });
    return null;
  },
});

export const cambiarAcceso = mutation({
  args: { id: v.id("users"), activo: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requiereRol(ctx, "admin");
    const objetivo = await ctx.db.get(args.id);
    if (objetivo === null) throw new Error("Esa cuenta ya no existe.");

    if (objetivo._id === actor._id && !args.activo) {
      throw new Error("No puedes revocarte el acceso a ti mismo.");
    }
    await protegerUltimoAdmin(ctx, objetivo._id, objetivo.rol, args.activo);

    await ctx.db.patch(args.id, { activo: args.activo });
    await registrarEnBitacora(ctx, {
      actor,
      accion: args.activo ? "usuario.reactivado" : "usuario.revocado",
      entidad: "users",
      entidadId: args.id,
      detalle: objetivo.email ?? "",
    });
    return null;
  },
});

/**
 * Impide que el sistema se quede sin ningun administrador activo, que es la
 * unica forma de bloquearse del panel sin remedio desde la interfaz.
 */
async function protegerUltimoAdmin(
  ctx: MutationCtx,
  idQueCambia: Id<"users">,
  rolNuevo: Rol,
  activoNuevo: boolean,
): Promise<void> {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_rol", (q) => q.eq("rol", "admin"))
    .collect();

  const quedaran = admins.filter((a) =>
    a._id === idQueCambia ? rolNuevo === "admin" && activoNuevo : a.activo,
  );
  if (quedaran.length === 0) {
    throw new Error("Debe quedar al menos un administrador activo.");
  }
}
