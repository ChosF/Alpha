/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as correo from "../correo.js";
import type * as correoActions from "../correoActions.js";
import type * as correoWebhook from "../correoWebhook.js";
import type * as http from "../http.js";
import type * as ingesta from "../ingesta.js";
import type * as lib_auditoria from "../lib/auditoria.js";
import type * as lib_contrasena from "../lib/contrasena.js";
import type * as lib_limites from "../lib/limites.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_texto from "../lib/texto.js";
import type * as lib_validadores from "../lib/validadores.js";
import type * as metricas from "../metricas.js";
import type * as programas from "../programas.js";
import type * as registros from "../registros.js";
import type * as usuarios from "../usuarios.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  correo: typeof correo;
  correoActions: typeof correoActions;
  correoWebhook: typeof correoWebhook;
  http: typeof http;
  ingesta: typeof ingesta;
  "lib/auditoria": typeof lib_auditoria;
  "lib/contrasena": typeof lib_contrasena;
  "lib/limites": typeof lib_limites;
  "lib/rbac": typeof lib_rbac;
  "lib/texto": typeof lib_texto;
  "lib/validadores": typeof lib_validadores;
  metricas: typeof metricas;
  programas: typeof programas;
  registros: typeof registros;
  usuarios: typeof usuarios;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
