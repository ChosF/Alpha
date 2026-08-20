/**
 * Copia la landing artesanal de Landing/ a public/landing/ para que Next la
 * sirva. Landing/ sigue siendo la fuente editable: nunca se edita la copia.
 * Corre en predev y prebuild, asi que el despliegue siempre lleva lo ultimo.
 */
import { cp, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origenHtml = path.join(raiz, "Landing", "alpha-b-reticula.html");
const origenAssets = path.join(raiz, "Landing", "assets");
const destinoDir = path.join(raiz, "public", "landing");
const destinoHtml = path.join(destinoDir, "alpha.html");

if (!existsSync(origenHtml)) {
  console.error(`sync-landing: no existe ${origenHtml}`);
  process.exit(1);
}

await rm(destinoDir, { recursive: true, force: true });
await mkdir(destinoDir, { recursive: true });

// La landing se reescribe desde / hacia /landing/alpha.html, pero el navegador
// conserva / como URL del documento. Por eso el HTML usa /landing/assets/...
// y los archivos se copian dentro de esta carpeta publica.
const html = await readFile(origenHtml, "utf8");
await writeFile(destinoHtml, html, "utf8");

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
  `sync-landing: ${path.relative(raiz, destinoHtml)} + ${usados.length} archivos` +
    (omitidos > 0 ? ` (${omitidos} sin usar, omitidos)` : ""),
);
