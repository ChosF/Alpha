import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcaAlpha } from "@/components/marca-alpha";
import { FormularioCallingLaf } from "./formulario-calling-laf";
import estilos from "./calling-laf.module.css";

export const metadata: Metadata = {
  title: "Calling LAF | Alpha CCM",
  description:
    "Conoce concentraciones, certificaciones y rutas profesionales para definir el siguiente paso de tu carrera en Finanzas.",
  robots: { index: true, follow: true },
};

const RUTAS = [
  "Banca de inversión",
  "Mercados",
  "Finanzas corporativas",
  "Consultoria",
  "Gestión de riesgos",
  "Capital privado",
  "Fintech",
] as const;

export default async function CallingLaf({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== "calling-laf") notFound();

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <Link href="/" aria-label="Volver al inicio de Alpha">
          <MarcaAlpha className={estilos.marca} tono="blanco" />
        </Link>
        <p>Sociedad Estudiantil de Finanzas</p>
      </header>

      <section className={estilos.hero}>
        <div className={estilos.indice} aria-hidden="true">
          01 / 26
        </div>
        <div className={estilos.presentacion}>
          <p className={estilos.cejilla}>Orientación profesional para estudiantes LAF</p>
          <h1>
            Calling
            <br />
            <span>LAF</span>
          </h1>
          <p className={estilos.introduccion}>
            Conoce las concentraciones disponibles, las certificaciones que pesan en cada área y
            las oportunidades profesionales que puedes construir desde la etapa final de tu
            carrera.
          </p>
          <FormularioCallingLaf estilos={estilos} />
        </div>

        <div className={estilos.rutas}>
          <p>Rutas que pondremos sobre la mesa</p>
          <ol>
            {RUTAS.map((ruta, indice) => (
              <li key={ruta}>
                <span>{String(indice + 1).padStart(2, "0")}</span>
                {ruta}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={estilos.declaracion} aria-label="Objetivo del evento">
        <p>Conoce tus opciones.</p>
        <p>Define tu especialización.</p>
        <p>Construye tu siguiente paso.</p>
      </section>

      <footer className={estilos.pie}>
        <MarcaAlpha className={estilos.marcaPie} tono="navy" />
        <p>Tecnológico de Monterrey, Campus Ciudad de México</p>
      </footer>
    </main>
  );
}
