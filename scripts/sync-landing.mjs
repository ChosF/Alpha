/**
 * Copia la landing artesanal de Landing/ a public/landing/ para que Next la
 * sirva. Landing/ sigue siendo la fuente editable: nunca se edita la copia.
 * Corre en predev y prebuild, asi que el despliegue siempre lleva lo ultimo.
 */
import { cp, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origenHtml = path.join(raiz, "Landing", "alpha-b-reticula.html");
const origenTailwind = path.join(raiz, "Landing", "tailwind.css");
const origenAssets = path.join(raiz, "Landing", "assets");
const destinoDir = path.join(raiz, "public", "landing");
const destinoHtml = path.join(destinoDir, "alpha.html");
const destinoCss = path.join(destinoDir, "alpha.css");
const destinoPublico = path.join(raiz, "public");

if (!existsSync(origenHtml) || !existsSync(origenTailwind)) {
  console.error("sync-landing: faltan la landing o su fuente local de Tailwind");
  process.exit(1);
}

await rm(destinoDir, { recursive: true, force: true });
await mkdir(destinoDir, { recursive: true });

// La landing se reescribe desde / hacia /landing/alpha.html, pero el navegador
// conserva / como URL del documento. Por eso el HTML usa /landing/assets/...
// y los archivos se copian dentro de esta carpeta publica.
const html = await readFile(origenHtml, "utf8");
await writeFile(destinoHtml, html, "utf8");

// Las utilidades se compilan durante desarrollo y build. El navegador recibe
// CSS local y no ejecuta un compilador mutable de terceros.
const fuenteTailwind = await readFile(origenTailwind, "utf8");
const css = await postcss([
  tailwindcss({ base: raiz, optimize: true }),
]).process(fuenteTailwind, {
  from: origenTailwind,
  to: destinoCss,
});
await writeFile(destinoCss, css.css, "utf8");

// El dashboard reutiliza exactamente la tipografia y las variantes aprobadas
// del lockup que vive en la landing. Se extraen desde la misma fuente para no
// mantener una copia paralela de la identidad.
const kollektiv = html.match(
  /font-family:"Kollektif"; src:url\(data:font\/ttf;base64,([A-Za-z0-9+/=]+)\)/,
);
if (!kollektiv) {
  throw new Error("sync-landing: no se encontro la fuente Kollektif embebida");
}
await writeFile(path.join(destinoPublico, "kollektif.ttf"), Buffer.from(kollektiv[1], "base64"));

for (const variante of ["white", "navy", "blue"]) {
  await cp(
    path.join(origenAssets, `alpha-mark-${variante}.png`),
    path.join(destinoPublico, `alpha-mark-${variante}.png`),
  );
}

// Solo se publican los archivos que el HTML menciona. Los originales de camara
// (varios MB) viven en Landing/assets como material de trabajo, pero el sitio
// usa las versiones optimizadas y no tiene por que servir los originales.
await mkdir(path.join(destinoDir, "assets"), { recursive: true });
const disponibles = await readdir(origenAssets);
const usados = disponibles.filter((nombre) => html.includes(`assets/${nombre}`));

for (const nombre of usados) {
  await cp(path.join(origenAssets, nombre), path.join(destinoDir, "assets", nombre), {
    recursive: true,
  });
}

const omitidos = disponibles.length - usados.length;
console.log(
  `sync-landing: ${path.relative(raiz, destinoHtml)} + CSS local + ${usados.length} archivos` +
    (omitidos > 0 ? ` (${omitidos} sin usar, omitidos)` : ""),
);
