import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { EmailConfig } from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import { validarContrasena } from "./lib/contrasena";
import { renderizarCorreoDashboard, textoConFirma } from "./lib/plantillaCorreo";

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

const restablecimientoContrasena: EmailConfig = {
  id: "alpha-password-reset",
  type: "email",
  name: "Código de seguridad Alpha",
  from: "Alpha CCM <contacto@alphaccm.org>",
  maxAge: 15 * 60,
  generateVerificationToken: generarCodigoSeguro,
  authorize: async (params, account) => {
    if (params.email !== account.providerAccountId) {
      throw new Error("El código no corresponde a esta cuenta.");
    }
  },
  async sendVerificationRequest({ identifier, token, provider }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY no está configurada en Convex.");

    const asunto = "Tu código para cambiar la contraseña";
    const texto = `Tu código de seguridad es ${token}. Caduca en 15 minutos. Si no pediste este cambio, ignora este correo.`;
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: identifier,
        subject: asunto,
        text: textoConFirma(texto, "contacto@alphaccm.org"),
        html: renderizarCorreoDashboard({
          asunto,
          texto,
          segmentos: [
            { texto: "Tu código de seguridad es ", negrita: false, cursiva: false },
            { texto: token, negrita: true, cursiva: false },
            { texto: ".\n\nCaduca en 15 minutos. Si no pediste este cambio, ignora este correo.", negrita: false, cursiva: false },
          ],
          remitente: "contacto@alphaccm.org",
        }),
        reply_to: "contacto@alphaccm.org",
      }),
    });
    if (!respuesta.ok) {
      throw new Error(`Resend rechazó el correo de seguridad (${respuesta.status}).`);
    }
  },
};

function generarCodigoSeguro(): string {
  const limite = 0xffff_ffff - (0xffff_ffff % 1_000_000);
  const valores = new Uint32Array(1);
  do {
    crypto.getRandomValues(valores);
  } while ((valores[0] ?? limite) >= limite);
  return String((valores[0] ?? 0) % 1_000_000).padStart(6, "0");
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      reset: restablecimientoContrasena,
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
