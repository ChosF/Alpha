# Correo de Alpha con Resend

El codigo ya esta conectado. Falta vincular la cuenta de Resend y publicar los registros DNS que
Resend genere para `alphaccm.org`. No copies claves en archivos del repositorio.

## 1. Dominio y direcciones

En Resend, agrega y verifica el dominio raiz `alphaccm.org`. El modulo usa estas identidades:

| Direccion | Uso |
| --- | --- |
| `auto@alphaccm.org` | Invitaciones y avisos automaticos |
| `contacto@alphaccm.org` | Bandeja publica y mensajes manuales generales |
| `direccion@alphaccm.org` | Mensajes manuales de Direccion |
| `finanzas@alphaccm.org` | Mensajes manuales de Finanzas |

Agrega en Vercel DNS los valores exactos que muestre Resend para SPF, DKIM y el return path. Para
recibir en las tres direcciones compartidas, la capacidad Receiving de `alphaccm.org` debe estar
activa y la raiz del dominio debe tener el MX `inbound-smtp.us-east-1.amazonaws.com` con prioridad
`10`. El MX de `send.alphaccm.org` sirve para rebotes de salida y no recibe mensajes dirigidos a la
bandeja.

Antes de agregar el MX, confirma que no exista otro proveedor de buzones en el dominio. Dos juegos
de MX con prioridades incompatibles pueden repartir o bloquear el correo entrante.

Conviene agregar DMARC en `_dmarc.alphaccm.org` con politica de observacion al inicio. Endurece la
politica cuando SPF y DKIM lleven varios dias alineados.

## 2. Variables de Convex

Configura desarrollo con los valores de tu cuenta:

```bash
npx convex env set RESEND_API_KEY "re_..."
npx convex env set RESEND_WEBHOOK_SECRET "whsec_..."
npx convex env set RESEND_TEST_MODE "false"
npx convex env set ALPHA_CONTACT_EMAIL "contacto@alphaccm.org"
npx convex env set ALPHA_AUTO_EMAIL "auto@alphaccm.org"
npx convex env set SITE_URL "https://alphaccm.org"
```

Repite en produccion con `--prod` al final de cada comando. `RESEND_API_KEY` y
`RESEND_WEBHOOK_SECRET` no necesitan existir en Vercel porque el envio y el webhook corren dentro de
Convex.

Mantén `RESEND_TEST_MODE=true` hasta que el dominio aparezca como verificado en Resend. En ese modo,
las invitaciones conservan el enlace manual y el compositor muestra un aviso de configuracion.

## Confirmaciones de registro

La landing encola una confirmacion automatica despues de guardar un registro valido:

- `Aliado`: siempre recibe correo.
- `Miembro`: recibe correo unicamente si eligio `Correo Electronico` como medio de contacto.
- Si el miembro eligio solamente `WhatsApp`, no se genera ningun correo.

La plantilla usa `SITE_URL/alpha-mark-white.png` para la marca, sale desde `ALPHA_AUTO_EMAIL` y
dirige las respuestas a `ALPHA_CONTACT_EMAIL`. Una falla del proveedor se registra en los logs,
pero no revierte un registro que ya fue guardado.

## 3. Webhook unico

Obtén la URL HTTP del despliegue de Convex y registra este endpoint en Resend:

```text
https://<despliegue>.convex.site/resend-webhook
```

Suscribe el mismo endpoint a estos eventos:

- `email.received`
- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.opened`
- `email.clicked`

El endpoint verifica la firma Svix antes de actuar. Los eventos de entrega actualizan el mensaje
saliente. `email.received` acepta `contacto@`, `direccion@` y `finanzas@`, crea un trabajo
idempotente, obtiene el cuerpo mediante la API de Resend, copia los adjuntos permitidos a Convex
Storage y coloca el mensaje en la misma bandeja.

## 4. Comprobacion final

1. Envia un mensaje externo a cada una de las tres direcciones compartidas.
2. Confirma que aparezca en `Dashboard -> Correo`.
3. Abre la conversacion y responde desde el panel.
4. Confirma que el estado pase de `En cola` a `Enviado` y despues a `Entregado`.
5. Crea una invitacion de prueba desde `Dashboard -> Usuarios` y comprueba que salga desde
   `auto@alphaccm.org` con `Reply-To: contacto@alphaccm.org`.

El plan gratuito de Resend cuenta correos enviados y recibidos dentro de la misma cuota. El panel
guarda su propia historia en Convex, por lo que no depende de la retencion de Resend para consultar
conversaciones anteriores.

## 5. Permisos y limites

- Solo `editor` y `admin` pueden leer o enviar correo.
- El servidor limita el remitente y `Reply-To` a `contacto@`, `direccion@` o `finanzas@`. El usuario
  elige una de esas direcciones en el compositor.
- Cada cuenta puede emitir hasta 40 correos por hora desde el compositor.
- El webhook acepta solamente firmas validas y solo ingresa mensajes destinados a una direccion
  compartida autorizada.
- El panel muestra texto plano. Nunca renderiza el HTML recibido.
- Cada adjunto entrante puede pesar hasta 10 MB y el total guardado por correo es de 18 MB.
- Los reintentos entrantes tienen espera creciente y terminan despues de cinco fallos.
