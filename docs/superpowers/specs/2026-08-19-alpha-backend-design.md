# Alpha — backend en Convex y panel interno

**Fecha:** 19 de agosto de 2026
**Estado:** diseño aprobado para implementación (aprobación del usuario en la conversación del 19 de agosto de 2026).
**Alcance:** primera versión completa del backend, el panel interno y la preparación del despliegue.

---

## 1. Propósito

La landing de Alpha (`Landing/alpha-b-reticula.html`) tiene una ventana de registro que hoy no
envía nada. Este proyecto le da un backend real en Convex, un panel interno para la mesa directiva
y la configuración necesaria para desplegar en Vercel.

Objetivos, en orden:

1. Que un estudiante pueda registrarse como **miembro** o **aliado** y que ese registro quede guardado.
2. Que la mesa directiva vea, filtre, atienda y exporte esos registros sin tocar código.
3. Que Operaciones edite el programa de eventos y que la landing lo lea desde la base.
4. Que todo esto resista los ataques habituales de una aplicación web pública.

No es objetivo de esta versión: envío de correos, integración con WhatsApp Business, registro de
asistencia a eventos, ni el sitio público en React.

---

## 2. Decisiones tomadas

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Estructura | Landing intacta + app Next.js alrededor | Conserva el prototipo ya afinado; un solo dominio y un solo despliegue |
| Acceso al panel | Correo y contraseña por invitación | Sin dependencias externas; funciona desde el primer día |
| Módulos v1 | Registros, programa, métricas, usuarios | Los cuatro se pidieron explícitamente |
| Antiabuso | Sin captcha visible | Cero fricción; el captcha se puede activar después sin rehacer nada |
| Ingesta | Landing → route handler de Next.js → Convex | Es la única topología donde el límite por IP es posible |

---

## 3. Topología y flujo de datos

Un solo proyecto de Vercel sirve tres cosas desde el mismo origen:

```
  navegador                         Vercel                          Convex
 ───────────      ┌──────────────────────────────────┐      ┌──────────────────┐
                  │                                  │      │                  │
  /  ─────────────▶ public/landing/alpha.html        │      │                  │
                  │  (HTML estático, sin cambios)    │      │                  │
                  │                                  │      │                  │
  POST /api/registro ──▶ route handler               │      │                  │
                  │   · Zod                          │      │                  │
                  │   · honeypot + tiempo mínimo     │      │                  │
                  │   · límite por IP                ├─────▶│ action ingesta   │
                  │   · secreto de servidor          │      │  └▶ internal     │
                  │                                  │      │     mutation     │
  /dashboard ─────▶ app router (React, RSC)          │      │                  │
                  │        │                          │      │  queries y      │
                  │        └── websocket autenticado ─┼─────▶│  mutations      │
                  └──────────────────────────────────┘      └──────────────────┘
```

Puntos clave:

- La landing **no** conoce la URL de Convex. Su formulario hace `fetch("/api/registro")` al mismo
  origen, así que no hay CORS ni preflight.
- El route handler es el único lugar donde existe el IP real del visitante
  (`x-forwarded-for` de Vercel), y por eso es donde vive el límite de tasa.
- La escritura entra a Convex por una `action` que exige `INGEST_SECRET`. Ese secreto sólo existe
  en el servidor. Aunque alguien descubra la URL del despliegue de Convex, no puede insertar.
- El panel no pasa por `/api`. Usa el cliente de Convex con la sesión de Convex Auth.

### Sincronía de la landing

`Landing/` sigue siendo la fuente editable. `scripts/sync-landing.mjs` copia el HTML y `assets/`
a `public/landing/` y corre en `prebuild`, así que el despliegue siempre lleva la última versión
sin que existan dos copias que se puedan desincronizar. `next.config.ts` reescribe `/` a
`/landing/alpha.html`.

---

## 4. Modelo de datos

Seis tablas. Todos los campos llevan validador de Convex; no existe ningún `v.any()`.

### `registrations`

El registro que llega del formulario público.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `tipo` | `"miembro" \| "aliado"` | Las dos categorías de la landing |
| `nombre` | string | 2–80 caracteres, ya normalizado |
| `correo` | string | En minúsculas, sin espacios; único por índice |
| `carrera` | string | 2–80 caracteres |
| `semestre` | string opcional | Campo separado, 1–30 caracteres; opcional en datos históricos |
| `matricula` | string opcional | Formato `A########` si viene |
| `canales` | objeto | `{ correo: boolean, whatsapp: boolean }`, sólo miembro |
| `telefono` | string opcional | 10 dígitos, sólo si eligió WhatsApp |
| `areas` | array de enum opcional | Sólo aliado; seis áreas cerradas |
| `aporte` | string opcional | Máx. 300 caracteres |
| `estado` | `"nuevo" \| "contactado" \| "activo" \| "baja"` | Flujo de atención |
| `notas` | string opcional | Interno, máx. 2000; sólo lo ve el panel |
| `origen` | string | `landing` por ahora |
| `ipHash` | string | SHA-256 de IP + sal del servidor. Nunca la IP en claro |
| `userAgent` | string | Recortado a 200 caracteres |
| `creadoEn` / `actualizadoEn` | number | Epoch ms |

Índices: `by_correo`, `by_estado`, `by_tipo`, `by_creado`.

### `users`

Cuentas del panel. Convex Auth guarda credenciales en sus propias tablas; ésta guarda el perfil y
el rol.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `authId` | id de la identidad de Convex Auth | Enlace con la sesión |
| `correo` | string | Único |
| `nombre` | string | |
| `rol` | `"admin" \| "editor" \| "lector"` | Ver §5 |
| `area` | string opcional | Presidencia, Operaciones, Comunicación… |
| `activo` | boolean | Revocar acceso sin borrar historia |
| `ultimoAcceso` | number opcional | |

### `invites`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `correo` | string | A quién va dirigida |
| `rol` | rol propuesto | |
| `tokenHash` | string | SHA-256 del token. El token en claro sólo se muestra una vez |
| `expiraEn` | number | 7 días |
| `usadaEn` | number opcional | Un solo uso |
| `creadaPor` | id de `users` | |

### `programs`

Los 14 programas que hoy están escritos a mano en el HTML.

| Campo | Tipo |
| --- | --- |
| `titulo`, `periodo`, `pilar`, `estado`, `orden`, `responsable`, `notas`, `publicado` |

`estado` es `"planeacion" \| "propuesto" \| "exploratorio"`, los mismos tres de la landing.
`publicado` decide si sale en el sitio público.

### `auditLog`

Quién hizo qué. Se escribe desde el servidor, nunca desde el cliente.

`actorId`, `actorCorreo`, `accion`, `entidad`, `entidadId`, `detalle`, `creadoEn`.

### `rateLimits`

Ventanas deslizantes por clave (`ip:<hash>`, `correo:<hash>`, `login:<hash>`).
`clave`, `ventanaInicio`, `conteo`. Índice por `clave`.

---

## 5. Modelo de seguridad

Tres roles:

| Rol | Puede |
| --- | --- |
| `lector` | Ver registros, programa y métricas. Nada de escritura |
| `editor` | Lo anterior más cambiar estado y notas de registros, y editar el programa |
| `admin` | Todo, más invitar, cambiar roles, revocar accesos y exportar CSV |

Controles, uno por vector:

- **Autorización.** Cada query y mutation del panel empieza llamando a `requireRole(ctx, rol)`.
  No hay función que confíe en que el cliente sea honesto. Las funciones de escritura de datos
  públicos son `internalMutation`, no alcanzables desde el navegador.
- **Inyección.** Convex no es SQL: no hay concatenación de consultas posible. Aun así, cada campo
  pasa por Zod en el borde y por validadores de Convex en la función. Los enums son listas
  cerradas.
- **XSS.** React escapa por defecto y el proyecto prohíbe `dangerouslySetInnerHTML` por regla de
  ESLint. Las notas y el nombre se guardan como texto plano; se elimina cualquier carácter de
  control antes de guardar. La CSP no permite `unsafe-eval`.
- **Inyección de fórmulas en CSV.** Al exportar, toda celda que empiece con `= + - @ Tab CR` se
  prefija con comilla simple y se envuelve en comillas dobles. Es el ataque que se suele olvidar
  y aquí importa porque el CSV se abre en Excel.
- **Límite de tasa.** Registro público: 5 por IP cada 10 minutos y 3 por correo cada 24 horas.
  Login: 8 intentos por IP cada 15 minutos. La ventana vive en Convex, no en memoria del proceso,
  así que sobrevive al modelo sin estado de Vercel.
- **Bots.** Campo trampa `sitio_web` que debe llegar vacío, y marca de tiempo firmada que rechaza
  envíos en menos de 2.5 segundos.
- **Contraseñas.** Mínimo 12 caracteres, con verificación contra una lista de las más comunes.
  El hash lo hace Convex Auth (scrypt). El registro sólo es posible con una invitación válida y
  no usada.
- **Cabeceras.** CSP, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY` y `Permissions-Policy` restrictiva, aplicadas desde `next.config.ts`.
- **Secretos.** `INGEST_SECRET`, `IP_SALT` y las claves de Convex Auth viven en variables de
  entorno. `.env.local` está en `.gitignore` y el README documenta cada una.
- **Datos personales.** Nunca se guarda la IP en claro. El correo y el teléfono sólo los ve quien
  tiene sesión con rol. El panel no es indexable (`noindex`) y el middleware lo protege entero.

---

## 6. El panel

Ruta `/dashboard`, en español, con el sistema visual de Alpha (azul `#1f5fd0`, tinta `#0d2140`,
Poppins, cantos vivos). Pantallas:

1. **Acceso** — correo y contraseña; y `/dashboard/invitacion/[token]` para fijar contraseña.
2. **Inicio** — altas por semana, reparto miembro/aliado, canales elegidos, áreas más pedidas por
   aliados y actividad reciente del equipo.
3. **Registros** — tabla con búsqueda, filtros por tipo y estado, ficha lateral con notas y
   cambio de estado, y exportación a CSV.
4. **Programa** — lista ordenable de programas con edición en línea y control de publicación.
5. **Usuarios** — invitar, ver invitaciones pendientes, cambiar rol, revocar.

El diseño de estas pantallas se hace con la skill `frontend-design` en la fase de implementación.

---

## 7. Pruebas

- **Unitarias (vitest):** validación de cada campo, normalización de correo, escape de CSV,
  ventana de límite de tasa, política de contraseñas, hash de IP.
- **De funciones (convex-test):** que `lector` no pueda escribir, que `editor` no pueda invitar,
  que la ingesta rechace un secreto inválido, que un correo repetido no cree un segundo registro,
  que una invitación caducada o ya usada no sirva.
- **De extremo a extremo:** `tsc --noEmit`, `eslint` y `next build` deben pasar limpios.

---

## 8. Despliegue

1. `npx convex dev` una vez, para crear el despliegue de desarrollo.
2. Variables de producción en Vercel: `CONVEX_DEPLOY_KEY`, `NEXT_PUBLIC_CONVEX_URL`,
   `INGEST_SECRET`, `IP_SALT` y `SITE_URL`. No se configura `CONVEX_DEPLOYMENT`, porque la clave
   de despliegue ya selecciona el entorno de producción.
3. Variables en Convex producción: `INGEST_SECRET`, `SITE_URL`, `JWT_PRIVATE_KEY` y `JWKS`.
4. `npx convex deploy --cmd "npm run build"` como comando de build en Vercel, que publica las
   funciones y compila el sitio en un solo paso.
5. Primer administrador: `npx convex run admin:sembrarAdmin '{"correo":"...","nombre":"..."}'`,
   que genera la invitación inicial.

El README documenta el procedimiento con los comandos exactos.
