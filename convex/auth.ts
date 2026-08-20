import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import { validarContrasena } from "./lib/contrasena";

/**
 * Acceso al panel: correo y contrasena, solo por invitacion.
 *
 * El alta de cuentas no es publica. `createOrUpdateUser` exige una invitacion
 * vigente, no usada y con el token correcto antes de crear el usuario, y es el
 * unico camino por el que nace una cuenta. `beforeSessionCreation` vuelve a
 * revisar en cada inicio de sesion que la cuenta siga activa, de modo que
 * revocar a alguien surte efecto de inmediato.
 */

/** Campos extra que viajan por `profile` y que no se guardan en `users`. */
type PerfilConInvitacion = {
  email: string;
  name?: string;
  invitacion?: string;
  rol: "admin" | "editor" | "lector";
  activo: boolean;
  creadoEn: number;
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      validatePasswordRequirements: (contrasena: string) => {
        const problema = validarContrasena(contrasena);
        if (problema !== null) throw new Error(problema);
      },
      profile(params) {
        const correo = normalizarCorreo(String(params.email ?? ""));
        const nombre = limpiarTexto(String(params.nombre ?? ""), 80);
        const invitacion =
          typeof params.invitacion === "string" ? params.invitacion : undefined;

        // `rol` y `activo` se fijan en createOrUpdateUser a partir de la
        // invitacion; aqui solo se cumple con la forma que espera el tipo.
        const perfil: PerfilConInvitacion = {
          email: correo,
          ...(nombre ? { name: nombre } : {}),
          ...(invitacion ? { invitacion } : {}),
          rol: "lector",
          activo: false,
          creadoEn: Date.now(),
        };
        // El campo `invitacion` no existe en la tabla `users` y nunca se
        // persiste: se lee en createOrUpdateUser y se descarta.
        return perfil as unknown as ReturnType<
          NonNullable<Parameters<typeof Password<DataModel>>[0]>["profile"] & object
        >;
      },
    }),
  ],

  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const db = (ctx as MutationCtx).db;

      // Inicio de sesion de una cuenta que ya existe: no se crea nada.
      if (existingUserId !== null) {
        await db.patch(existingUserId as Id<"users">, { ultimoAcceso: Date.now() });
        return existingUserId as Id<"users">;
      }

      const correo = normalizarCorreo(String(profile.email ?? ""));
      const token = typeof profile.invitacion === "string" ? profile.invitacion : "";
      if (correo === "" || token === "") {
        throw new Error("El alta de cuentas es solo por invitacion.");
      }

      const tokenHash = await sha256Hex(token);
      const invitacion = await db
        .query("invites")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .unique();

      const ahora = Date.now();
      if (
        invitacion === null ||
        invitacion.usadaEn !== undefined ||
        invitacion.revocadaEn !== undefined ||
        invitacion.expiraEn < ahora ||
        invitacion.correo !== correo
      ) {
        // Un solo mensaje para todos los casos: no se le dice al atacante
        // cual de las condiciones fallo.
        throw new Error("La invitacion no es valida, ya se uso o caduco.");
      }

      const userId = await db.insert("users", {
        email: correo,
        name: invitacion.nombre,
        rol: invitacion.rol,
        activo: true,
        creadoEn: ahora,
        ultimoAcceso: ahora,
      });

      await db.patch(invitacion._id, { usadaEn: ahora });
      await db.insert("auditLog", {
        actorId: userId,
        actorCorreo: correo,
        accion: "cuenta.creada",
        entidad: "users",
        entidadId: userId,
        detalle: `Alta por invitacion con rol ${invitacion.rol}`,
        creadoEn: ahora,
      });

      return userId;
    },

    async beforeSessionCreation(ctx, { userId }) {
      const usuario = await (ctx as MutationCtx).db.get(userId as Id<"users">);
      if (usuario === null || !usuario.activo) {
        throw new Error("Esta cuenta no tiene acceso al panel.");
      }
    },
  },
});
