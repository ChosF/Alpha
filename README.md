# Alpha — sitio y panel

Sitio publico y panel interno de la **Sociedad Estudiantil Alpha**, Tec de Monterrey Campus
Ciudad de Mexico. Next.js + Convex + TypeScript, para desplegar en Vercel.

| | |
| --- | --- |
| Landing | `Landing/alpha-b-reticula.html`, HTML artesanal, se sirve en `/` |
| Dashboard | `/dashboard`, React, acceso por invitacion |
| Backend | Convex (`convex/`) |

---

## 1. Como esta armado

```
/                      -> public/landing/alpha.html  (copia de Landing/, se sincroniza sola)
POST /api/registro     -> valida, limita y llama a Convex con un secreto de servidor
GET  /api/registro/token -> token firmado que la ventana de registro adjunta al enviar
/dashboard/*           -> dashboard interno, exige sesion
/dashboard/correo      -> bandeja compartida y compositor de contacto@alphaccm.org
POST *.convex.site/resend-webhook -> correo entrante y estados de entrega de Resend
```

La landing **no** habla con Convex directamente. Su formulario hace `fetch` al mismo origen y el
route handler de Next es quien escribe, porque es el unico punto donde existe la IP real del
visitante y por lo tanto el unico donde se puede limitar por origen.

`Landing/` sigue siendo el archivo que se edita. `scripts/sync-landing.mjs` lo copia a
`public/landing/` en cada `npm run dev` y `npm run build`; no edites la copia.

---

## 2. Poner a andar el proyecto

```bash
npm install
```

```bash
npx convex dev
```

El segundo comando pide iniciar sesion, crea el proyecto de Convex y escribe `CONVEX_DEPLOYMENT` y
`NEXT_PUBLIC_CONVEX_URL` en `.env.local`. Dejalo corriendo en su propia terminal mientras
desarrollas: es lo que sube las funciones y regenera `convex/_generated/`.

Genera los dos secretos y agregalos a `.env.local` (usa `.env.example` como plantilla):

```bash
node -e "console.log('INGEST_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

```bash
node -e "console.log('IP_SALT=' + require('crypto').randomBytes(32).toString('hex'))"
```

`INGEST_SECRET` tiene que existir **tambien** en Convex, porque las dos mitades lo comparan:

```bash
npx convex env set INGEST_SECRET el-mismo-valor-de-env-local
```

Claves de sesion de Convex Auth (una sola vez):

```bash
npx @convex-dev/auth
```

Y a trabajar:

```bash
npm run dev
```

---

## 3. Primer administrador

No hay registro publico de cuentas: la primera se crea desde la linea de comandos.

```bash
npx convex run admin:sembrarAdmin '{"correo":"tucorreo@tec.mx","nombre":"Tu Nombre"}'
```

Devuelve un enlace de un solo uso. Abrelo, elige contrasena y ya tienes acceso de administrador.
Desde ahi puedes invitar al resto del equipo en **Dashboard -> Usuarios**.

Si Resend esta configurado, la invitacion se manda desde `auto@alphaccm.org`. El panel conserva el
enlace de un solo uso como respaldo durante la creacion.

Para cargar el plan de trabajo 2026 — 2027 en la base:

```bash
npx convex run admin:sembrarProgramas
```

---

## 4. Desplegar en Vercel

1. Sube el repositorio a GitHub e importalo en Vercel.
2. **Build Command**, para que publique las funciones de Convex y compile el sitio de una vez:

   ```
   npx convex deploy --cmd "npm run build"
   ```

3. Variables de entorno del proyecto en Vercel:

   | Variable | De donde sale |
   | --- | --- |
   | `CONVEX_DEPLOY_KEY` | Panel de Convex, despliegue de produccion |
   | `INGEST_SECRET` | El que generaste; el mismo que en `npx convex env set` de produccion |
   | `IP_SALT` | El que generaste |
   | `NEXT_PUBLIC_CONVEX_URL` | `https://basic-gopher-658.convex.cloud` |
   | `SITE_URL` | URL publica canonica, por ejemplo `https://alpha-iota-nine.vercel.app` |

   `NEXT_PUBLIC_CONVEX_URL` la inyecta `convex deploy` durante el build.

4. En el despliegue de **produccion** de Convex configura:

   ```bash
   npx convex env set INGEST_SECRET valor --prod
   npx convex env set SITE_URL https://tu-dominio --prod
   npx @convex-dev/auth --prod --web-server-url https://tu-dominio
   ```

5. Tras el primer despliegue, crea el administrador de produccion:

   ```bash
   npx convex run admin:sembrarAdmin '{"correo":"...","nombre":"...","sitio":"https://tu-dominio"}' --prod
   ```

### Correo de dominio

El modulo `Dashboard -> Correo` usa el componente oficial de Resend para Convex. Guarda los hilos,
mensajes, responsables, adjuntos y estados en Convex. Resend transporta los mensajes y entrega los
eventos mediante un webhook firmado.

La configuracion de DNS, variables y webhook esta en
[`docs/correo-resend.md`](docs/correo-resend.md). Los secretos de Resend viven en Convex, no en
variables publicas ni en el navegador.

---

## 5. Comandos

| Comando | Que hace |
| --- | --- |
| `npm run dev` | Sincroniza la landing y levanta Next |
| `npm run dev:convex` | Observa y sube las funciones de Convex |
| `npm run build` | Compila para produccion |
| `npm test` | Pruebas (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run check` | Los tres anteriores, en orden |

---

## 6. Seguridad

Lo que ya esta puesto, y donde vive:

| Riesgo | Defensa | Archivo |
| --- | --- | --- |
| Escrituras desde fuera | La ingesta exige un secreto de servidor y escribe por `internalMutation` | `convex/ingesta.ts` |
| Envios masivos | 5 por IP cada 10 min, 3 por correo cada 24 h, contados en la base | `convex/lib/limites.ts` |
| Bots | Campo trampa y token firmado con tiempo minimo de llenado | `lib/seguridad.ts` |
| Datos manipulados | Zod en el borde y validadores de Convex en la funcion | `lib/validacion.ts` |
| XSS | React escapa; `react/no-danger` prohibido por lint; CSP sin `unsafe-eval` | `eslint.config.mjs`, `next.config.ts` |
| Formulas en CSV | Toda celda que empiece con `= + - @` se neutraliza | `lib/csv.ts` |
| Escalada de permisos | `requiereRol` en cada query y mutation del panel | `convex/lib/rbac.ts` |
| Cuentas no autorizadas | Alta solo con invitacion vigente, de un uso, guardada como hash | `convex/auth.ts` |
| Rastreo de la IP | Nunca se guarda en claro, solo SHA-256 con sal | `lib/seguridad.ts` |
| Webhook falso | Firma Svix verificada antes de registrar o actualizar correo | `convex/correoWebhook.ts` |
| HTML malicioso por correo | Solo se muestra el cuerpo de texto; el HTML recibido no se renderiza | `convex/correoActions.ts` |

Roles: `lector` consulta; `editor` cambia estados, notas y programa; `admin` ademas invita, cambia
roles y exporta.

Dos cosas que conviene saber:

- **La landing corre con una CSP mas permisiva que el panel** (`'unsafe-inline'` y el CDN de
  Tailwind), porque es HTML artesanal con scripts y estilos en linea. No maneja datos personales,
  asi que el riesgo es bajo; si algun dia se quiere endurecer, hay que compilar Tailwind y sacar
  los scripts a archivos.
- **Los miembros pueden registrarse con cualquier correo valido.** Los aliados siguen usando
  `@tec.mx` o `@exatec.tec.mx`; la regla vive en `lib/validacion.ts`.

---

## 7. Lo que todavia no hace

- No hay recuperacion de contrasena: si alguien la pierde, un administrador revoca su acceso y lo
  vuelve a invitar.
- El compositor no envia adjuntos salientes. Los adjuntos recibidos si se copian a Convex Storage.
- La landing no lee todavia el programa desde Convex: la consulta publica (`programas:publicos`)
  ya existe y devuelve solo campos publicables, pero el HTML sigue con la lista escrita a mano.

El diseno completo esta en `docs/superpowers/specs/2026-08-19-alpha-backend-design.md`.
