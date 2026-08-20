import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { limpiarTexto, normalizarCorreo, sha256Hex } from "./lib/texto";
import { ESTADOS_PROGRAMA, PILARES } from "./lib/validadores";

/**
 * Arranque del sistema.
 *
 * Son internalMutation a proposito: no se pueden llamar desde el navegador,
 * solo con `npx convex run`, que exige credenciales del despliegue. Asi el
 * primer administrador no puede crearlo un visitante.
 */

/**
 * Crea la invitacion del primer administrador y devuelve el enlace.
 *
 *   npx convex run admin:sembrarAdmin '{"correo":"a01@tec.mx","nombre":"Mariela"}'
 */
export const sembrarAdmin = internalMutation({
  args: { correo: v.string(), nombre: v.string(), sitio: v.optional(v.string()) },
  returns: v.object({ enlace: v.string(), expiraEn: v.number() }),
  handler: async (ctx, args) => {
    const correo = normalizarCorreo(args.correo);
    const existentes = await ctx.db.query("users").collect();
    if (existentes.some((u) => u.email === correo)) {
      throw new Error("Ese correo ya tiene cuenta.");
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ahora = Date.now();
    const expiraEn = ahora + 7 * 24 * 60 * 60 * 1000;

    // La primera invitacion no tiene autor: se apunta a si misma una vez que
    // exista el usuario, pero el campo pide un id, asi que se usa el de un
    // administrador existente si lo hay.
    const algunAdmin = existentes.find((u) => u.rol === "admin");
    const creadaPor = algunAdmin?._id;
    if (creadaPor === undefined && existentes.length > 0) {
      throw new Error("Ya hay cuentas pero ningun administrador: revisa la base.");
    }

    const semilla =
      creadaPor ??
      (await ctx.db.insert("users", {
        email: correo,
        name: limpiarTexto(args.nombre, 80),
        rol: "admin",
        activo: false, // se activa cuando complete el alta con su contrasena
        creadoEn: ahora,
      }));

    await ctx.db.insert("invites", {
      correo,
      nombre: limpiarTexto(args.nombre, 80),
      rol: "admin",
      tokenHash: await sha256Hex(token),
      expiraEn,
      creadaPor: semilla,
      creadaEn: ahora,
    });

    const sitio = (args.sitio ?? "http://localhost:3000").replace(/\/+$/, "");
    return { enlace: `${sitio}/panel/invitacion/${token}`, expiraEn };
  },
});

/** Carga el programa 2026-2027 que hoy esta escrito a mano en la landing. */
export const sembrarProgramas = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existentes = await ctx.db.query("programs").collect();
    if (existentes.length > 0) return 0;

    const base: Array<[string, string, (typeof PILARES)[number], (typeof ESTADOS_PROGRAMA)[number]]> = [
      ["Calling LAF's", "Ago - Dic 2026", "comunidad", "planeacion"],
      ["Alpha Integration", "Ago - Dic 2026", "comunidad", "planeacion"],
      ["Quantitative Finance Workshop", "Ago - Dic 2026", "desarrollo", "planeacion"],
      ["Networking Night", "Ago - Dic 2026", "industria", "planeacion"],
      ["Finance Bootcamp", "Ago - Dic 2026", "desarrollo", "planeacion"],
      ["Finanzas para Todos", "Ago - Dic 2026", "comunidad", "propuesto"],
      ["Viaje academico a Wall Street", "Dic 2026", "industria", "exploratorio"],
      ["Servicio social de asesoria financiera", "Ago - Dic 2026", "comunidad", "exploratorio"],
      ["Welcome LAF", "Feb - Jun 2027", "comunidad", "propuesto"],
      ["Flag Football / Super Bowl", "Feb 2027", "comunidad", "propuesto"],
      ["Quantitative Finance Bootcamp - Modulo 2", "Feb - Jun 2027", "desarrollo", "propuesto"],
      ["Finanzas para Todos - 2.a edicion", "Feb - Jun 2027", "comunidad", "propuesto"],
      ["Mastering Money", "Feb - Jun 2027", "desarrollo", "propuesto"],
      ["Cena de cierre y reconocimiento", "Jun 2027", "comunidad", "propuesto"],
    ];

    const ahora = Date.now();
    let orden = 1;
    for (const [titulo, periodo, pilar, estado] of base) {
      await ctx.db.insert("programs", {
        titulo,
        periodo,
        pilar,
        estado,
        orden,
        publicado: true,
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
      orden += 1;
    }
    return base.length;
  },
});
