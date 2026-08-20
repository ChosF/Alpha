# Landing page Alpha — tres propuestas

**Estado: borrador de diseño. Ninguna versión está aprobada ni lista para publicar.**
Fecha de elaboración: 17 de agosto de 2026.

Archivos:

| Archivo | Propuesta |
| --- | --- |
| `index.html` | Comparador de las tres opciones |
| `opcion-1-indice.html` | Opción 1 — **Índice** |
| `opcion-2-terminal.html` | Opción 2 — **Terminal** |
| `opcion-3-cartel.html` | Opción 3 — **Cartel** |
| `assets/` | Copia de los archivos de marca de origen |
| `inline-assets.py` | Incrusta fuente y logotipo en los HTML (volver a ejecutar tras editar) |

Cada HTML es autónomo: el logotipo y la fuente Kollektif van incrustados en el
archivo. Solo requieren conexión para Google Fonts (Poppins, JetBrains Mono,
Archivo) y para el compilador de Tailwind v4 en navegador.

---

## 1. Conflicto de fuentes de marca — decisión tomada

`Claude.md` y `Brand identity design documentation/design.md` **no coinciden**:

| Dato | `Claude.md` §9 | `design.md` §3–4 |
| --- | --- | --- |
| Azul principal | `#194270` clásico, `#0066FF` brillante | `#1f5fd0` acento, `#0d2140` navy |
| Azul claro | `#AFCFFF` | `#b6d0ff` (blue-300) |
| Texto de cuerpo | Montserrat | Poppins |
| Fondo | no especificado | `#f2f4f7` |

Se siguió **`design.md`**, por dos razones: es el documento al que apunta la
solicitud y es la fuente de diseño más específica y reciente. `design.md` además
advierte que sus seis valores son **provisionales dentro de la familia azul**
hasta que se aporten los hex exactos del brandbook.

> **Acción pendiente (Comunicación):** confirmar los hex definitivos y si el
> cuerpo de texto es Poppins o Montserrat. Al cambiar, basta con editar el
> bloque `@theme` al inicio de cada archivo; todo lo demás lee esas variables.

---

## 2. Logotipo — construido con la geometría medida

El lockup no es una imagen ni una aproximación. Se arma en SVG con las medidas
exactas de `design.md` §2, en unidades **C** (altura de mayúscula):

- `Alph` en **Kollektif** (el subconjunto real, `kollektif-subset.ttf`, que
  contiene exactamente A, h, l, p y declara `capHeight = 709/1000 em`).
- El **α** es la obra de arte original (`alpha-mark-*.png`), nunca un carácter griego.
- Avance del wordmark 2.89 C · α en x = 2.56 C (solape 0.33 C) · lockup 4.65 × 1.44 C.
- Cuerpo del wordmark = 1 / 0.709 = 1.41043 C.
- Espacio de respeto de 1 C mediante la clase `.clearspace`.

No se redibujó, estiró ni recoloreó. Se usan las tres variantes oficiales
(blanco, navy, azul) según el fondo.

> **Pendiente:** `design.md` §10 señala que el α disponible es un raster extraído
> a 360 × 248 px, apto para referencia pero **no para impresión**. Para producción
> hace falta el vector (SVG/AI) y la licencia de Kollektif.

---

## 3. Qué cumple cada opción y dónde extiende la guía

Todas cumplen: radio 0 en todo, alineación a la izquierda (también dentro de los
botones), reglas de 2 px entre secciones, iconos Lucide de trazo 1.75, cifras con
`tabular-nums`, imágenes en el envoltorio `.grayscale`, foco de teclado con
contorno azul de 2 px, y `prefers-reduced-motion` respetado.

| | Opción 1 · Índice | Opción 2 · Terminal | Opción 3 · Cartel |
| --- | --- | --- | --- |
| Tipografía | Poppins 300–700 | Poppins + JetBrains Mono | Poppins + Archivo (eje de ancho) |
| Campo dominante | Fondo claro | Navy invertido | Navy → claro → azul |
| Firma | Programa filtrable por estado | Diagrama de alfa | Titular resuelto a la medida |
| Extiende la guía | No | Sí (mono) | Sí (Archivo display) |

**Extensiones que requieren aprobación de Comunicación** (`design.md` §9 pide
declararlas aquí antes de publicarlas):

1. **Escala de cartel.** Las tres añaden un escalón de display por encima del h1
   de 42 px de la guía; un titular de portada no es un encabezado de documento.
   El tracking se mantiene en el mínimo de marca, −0.015 em.
2. **JetBrains Mono (opción 2).** Confinada a datos: periodos, claves, conteos y
   pies de figura. Ninguna frase de la página se compone en mono.
3. **Archivo con eje de ancho (opción 3).** Solo display. Archivo es la familia
   con la que ya se distribuye el sistema Modernist incluido en el proyecto, así
   que está dentro del material propio de Alpha y no es una fuente ajena.

La **opción 1 no extiende nada** y es la más segura si la página se publica pronto.

Regla del 90 / 10 (navy sobre fondo claro, azul como acento): las tres usan el
azul como campo completo **una sola vez**, en la declaración de cartel, que es
justo el uso que `design.md` §3 autoriza. La opción 3 usa además el navy a página
completa en la portada, que es la forma primaria del logotipo, no el azul acento.

---

## 4. Contenido — qué es verificable y qué no

Todo el texto sale de `Claude.md`: misión, tres pilares y el portafolio de
programas. **No se inventó ningún dato.** En particular, **no hay cifras de
asistentes, número de miembros, testimonios, patrocinadores ni logos de empresas**,
porque no existe una fuente que los respalde.

### Estados del programa

Se usa el vocabulario operativo real de Alpha en lugar de una numeración
decorativa. Ningún programa aparece como *confirmado*, porque `Claude.md` §5
advierte que el plan «no otorga autorización automática»:

- **En planeación (5)** — Calling LAF's, Alpha Integration, Quantitative Finance
  Workshop, Networking Night, Finance Bootcamp. Son los cinco que `Claude.md` §5
  describe con plan detallado en el Drive.
- **Propuesto (7)** — Finanzas para Todos y los seis del periodo febrero – junio 2027.
- **Exploratorio (2)** — viaje académico a Wall Street y el servicio social de
  asesoría financiera.

> **Acción pendiente (Operaciones):** contrastar los 14 programas y sus estados
> con la carpeta viva antes de publicar. No se pudo consultar el Drive al
> elaborar esta propuesta, así que **los estados provienen solo de `Claude.md` y
> pueden estar desactualizados.**

### Datos personales

Se listan **áreas, no nombres**. `Claude.md` §3 pide verificar en el Drive antes
de publicar nombres y §12 limita los datos personales al mínimo necesario. Si la
mesa directiva 2026 – 2027 debe aparecer, hace falta confirmarla en la fuente
vigente y contar con el consentimiento de cada persona.

### Educación financiera

El diagrama de la opción 2 lleva rótulo explícito: *«Ilustración del concepto. No
representa datos de mercado, rendimientos históricos ni resultados esperados.»*
No hay consejo de inversión personalizado ni promesa de rendimiento en ninguna
de las tres.

---

## 5. Lo que falta antes de publicar

| # | Pendiente | Responsable |
| --- | --- | --- |
| 1 | Confirmar hex definitivos del brandbook y la fuente de cuerpo | Comunicación |
| 2 | Aprobar o rechazar las tres extensiones tipográficas de §3 | Comunicación |
| 3 | Conectar el formulario a un canal de registro real | Comunicación |
| 4 | Enlaces de Alphanálisis y redes sociales | Comunicación |
| 5 | Fotografía documental real para los espacios marcados, en blanco y negro | Comunicación |
| 6 | Verificar los 14 programas y sus estados contra el Drive | Operaciones |
| 7 | Logos institucionales del Tec y formato requerido | Presidencia |
| 8 | Vector del α y licencia de Kollektif para producción | Comunicación |
| 9 | Revisión institucional que corresponda antes de publicar | Presidencia |

El formulario hoy no envía nada: al enviarlo muestra un aviso que dice que falta
conectarlo. Es deliberado, para que no parezca funcional en una demo.

---

## 6. Notas técnicas

- **Tailwind v4** vía el compilador de navegador
  (`@tailwindcss/browser@4`). Los tokens viven en `<style type="text/tailwindcss">`
  con `@theme`. Para producción conviene compilar Tailwind en build y servir CSS
  estático, en lugar de compilar en el cliente.
- **Mobile first**, verificado sin desbordamiento horizontal a 375 px y a 1425 px
  en las tres.
- La opción 3 resuelve el cuerpo del titular por JavaScript
  (`[data-fit]`) para que la línea más larga caiga exacta entre márgenes; se
  recalcula al cambiar el tamaño de la ventana y tiene un respaldo por
  `clamp()` y un temporizador de seguridad si las fuentes tardan.
- Al editar un HTML no se deben tocar las cadenas `data:` incrustadas. Si se
  necesita regenerarlas, se reponen los marcadores `__A_NAVY__`, `__A_WHITE__`,
  `__A_BLUE__`, `__FONT_KOLLEKTIF__` y se ejecuta `python inline-assets.py`.

## 7. Verificación realizada

- Renderizado y revisado en navegador a 375 px, ~673 px y ~1425 px.
- Sin desbordamiento horizontal en las tres opciones a 375 px y en escritorio.
- Kollektif, Poppins, JetBrains Mono y Archivo cargan correctamente.
- El filtro por estado de la opción 1 devuelve 5 / 7 / 2 / 14 y actualiza
  `aria-pressed` y el conteo en vivo.
- El titular a medida de la opción 3 cae exacto sobre el ancho disponible
  (335 px de 335 px a 375 px de viewport).
- Sin errores en consola.
- **No verificado:** apariencia en Safari e iOS, y la página no se probó con
  lector de pantalla.
