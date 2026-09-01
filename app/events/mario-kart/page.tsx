import type { Metadata, Viewport } from "next";
import { MarcaAlpha } from "@/components/marca-alpha";
import { MARIO_KART_CHALLENGE } from "@/lib/mario-kart";
import fondoEscritorio from "./assets/hero-track-desktop.webp";
import fondoMovil from "./assets/hero-track-mobile.webp";
import { LanzadorRegistro } from "./registro-lanzador";
import estilos from "./mario-kart.module.css";

const descripcion =
  "Compite, convive y conoce a estudiantes de todos los semestres en el Mario Kart Challenge de la comunidad LAF de Alpha CCM.";

export const metadata: Metadata = {
  metadataBase: new URL("https://alphaccm.org"),
  title: "Mario Kart Challenge | Alpha CCM",
  description: descripcion,
  alternates: { canonical: "https://alphaccm.org/events/mario-kart" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://alphaccm.org/events/mario-kart",
    siteName: "Alpha CCM",
    title: "Mario Kart Challenge | Alpha CCM",
    description: descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mario Kart Challenge | Alpha CCM",
    description: descripcion,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020612",
  colorScheme: "dark",
};

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function IconoUbicacion() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s6-5.18 6-11a6 6 0 1 0-12 0c0 5.82 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export default function MarioKartChallenge() {
  return (
    <main className={estilos.pagina}>
      <section className={estilos.hero} aria-labelledby="mario-kart-titulo">
        <picture className={estilos.fondo}>
          <source media="(max-width: 767px)" srcSet={fondoMovil.src} />
          <img
            src={fondoEscritorio.src}
            width={fondoEscritorio.width}
            height={fondoEscritorio.height}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className={estilos.veladura} aria-hidden="true" />
        <div className={estilos.resplandor} aria-hidden="true" />

        <header className={estilos.cabecera}>
          <a className={estilos.marcaEnlace} href="/" aria-label="Volver al inicio de Alpha">
            <MarcaAlpha className={estilos.marca} tono="blanco" />
          </a>
          <p>Sociedad Estudiantil de Finanzas</p>
        </header>

        <div className={estilos.contenido}>
          <div className={estilos.tituloBloque}>
            <p className={estilos.cejilla}>La comunidad LAF toma la pista</p>
            <h1 id="mario-kart-titulo" className={estilos.titulo} aria-label="Mario Kart Challenge">
              <span className={estilos.mario}>Mario</span>
              <span className={estilos.kart}>Kart</span>
              <span className={estilos.challenge}>Challenge</span>
            </h1>
          </div>

          <div className={estilos.informacion}>
            <div className={estilos.mensaje}>
              <p>La pista es de toda la comunidad LAF.</p>
              <span>Compite, convive y conoce a gente de todos los semestres.</span>
            </div>

            <dl className={estilos.datos} aria-label="Datos del evento">
              <div className={estilos.datoExterior}>
                <div className={estilos.datoInterior}>
                  <dt>
                    <IconoCalendario />
                    Fecha · hora
                  </dt>
                  <dd>{MARIO_KART_CHALLENGE.fechaCorta}</dd>
                </div>
              </div>
              <div className={estilos.datoExterior}>
                <div className={estilos.datoInterior}>
                  <dt>
                    <IconoUbicacion />
                    Lugar
                  </dt>
                  <dd>{MARIO_KART_CHALLENGE.sede}</dd>
                </div>
              </div>
            </dl>

            <LanzadorRegistro />
          </div>
        </div>

        <div className={estilos.pistaPersonajes} data-character-stage="pending" aria-hidden="true" />

        <footer className={estilos.pie}>
          <span>Alpha · Tec CCM</span>
          <span aria-hidden="true">01 / Challenge</span>
        </footer>
      </section>
    </main>
  );
}
