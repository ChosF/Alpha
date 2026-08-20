/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as ingesta from "../ingesta.js";
import type * as metricas from "../metricas.js";
import type * as programas from "../programas.js";
import type * as registros from "../registros.js";
import type * as usuarios from "../usuarios.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "admin": typeof admin,
"auth": typeof auth,
"http": typeof http,
"ingesta": typeof ingesta,
"metricas": typeof metricas,
"programas": typeof programas,
"registros": typeof registros,
"usuarios": typeof usuarios,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  