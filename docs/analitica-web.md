# Tráfico web en el dashboard

La sección Analytics reúne tráfico de Vercel y encuestas de Convex. Las pestañas conservan la selección de periodo y evento. El periodo de 7, 14 o 30 días se aplica solo al tráfico; las encuestas muestran los resultados acumulados del evento.

## Configuración

Configurar en el entorno de Convex que sirve la aplicación:

- `VERCEL_ANALYTICS_TOKEN`: token persistente de Vercel con acceso al proyecto, nunca una variable `NEXT_PUBLIC_` ni el token temporal de inicio de sesión del CLI.
- `VERCEL_ANALYTICS_PROJECT_ID`: identificador del proyecto Alpha.
- `VERCEL_ANALYTICS_TEAM_ID`: equipo propietario, si corresponde.

Crear o renovar el token desde la configuración de cuenta de Vercel. Guardarlo directamente en Convex. No guardar el secreto en Git. Si se revoca o vence, sustituirlo en Convex. Un error de acceso se muestra como error, no como cero visitas.

## Definiciones

Los informes consultan `/v1/query/web-analytics/visits/aggregate` para producción. Usan días completos UTC y un límite superior al último milisegundo del día anterior. El total de visitantes se consulta agrupando por entorno, sin sumar visitantes diarios. Páginas por visitante es vistas dividido por visitantes del periodo. Fuentes y dispositivos se calculan como porcentaje de vistas, no de personas.

Se consultan hasta cien valores por dimensión y se muestran los cinco grupos con más vistas entre los devueltos; el resto se suma a Otros. Las rutas de encuesta y registro se anonimizan antes de enviarlas desde el tracker y antes de devolver datos históricos al dashboard. Los parámetros de consulta no se envían. Los informes no contienen contactos ni respuestas de encuestas.

La acción exige una cuenta activa con rol lector o superior, incluso al leer caché. El caché interno dura cinco minutos y mantiene un informe por proyecto, equipo y periodo. Cambiar de día invalida el informe. No hay consultas programadas ni eventos personalizados de pago. El botón Actualizar respeta el caché.

## Verificación

`npx vitest run tests/analitica-web.test.ts tests/encuestas-convex.test.ts`, lint de los archivos modificados y `npm run build`. Verificar visualmente las tres pestañas y los selectores en escritorio y móvil. Confirmar que las credenciales de producción permiten obtener un informe real antes de declarar la conexión activa.
