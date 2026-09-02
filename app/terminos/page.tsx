import type { Metadata } from "next";
import Link from "next/link";
import { MarcaAlpha } from "@/components/marca-alpha";
import estilos from "./terminos.module.css";

export const metadata: Metadata = {
  title: "Términos y condiciones | Alpha CCM",
  description: "Términos de uso del sitio web y de los registros de Alpha CCM.",
  robots: { index: true, follow: true },
};

const secciones = [
  ["alcance", "Alcance"],
  ["uso", "Uso del sitio"],
  ["registros", "Registros y actividades"],
  ["conducta", "Conducta"],
  ["contenido", "Contenido y propiedad intelectual"],
  ["enlaces", "Enlaces externos"],
  ["datos", "Datos personales"],
  ["responsabilidad", "Responsabilidad"],
  ["cambios", "Cambios a estos términos"],
  ["ley", "Ley aplicable"],
  ["contacto", "Contacto"],
] as const;

export default function TerminosPage() {
  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <Link href="/" aria-label="Volver al inicio de Alpha">
          <MarcaAlpha className={estilos.marca} tono="blanco" />
        </Link>
        <p>Sociedad estudiantil de finanzas</p>
      </header>

      <section className={estilos.portada}>
        <div className={estilos.portadaInterior}>
          <p className={estilos.cejilla}>Información legal · Alpha CCM</p>
          <h1>Términos<br />y condiciones</h1>
          <div className={estilos.ficha}>
            <p>Vigentes desde el 25 de agosto de 2026</p>
            <p>Última actualización: 2 de septiembre de 2026</p>
          </div>
        </div>
      </section>

      <div className={estilos.cuerpo}>
        <aside className={estilos.indice} aria-label="Contenido de los términos">
          <p>Contenido</p>
          <ol>
            {secciones.map(([id, titulo], indice) => (
              <li key={id}>
                <a href={`#${id}`}><span>{String(indice + 1).padStart(2, "0")}</span>{titulo}</a>
              </li>
            ))}
          </ol>
        </aside>

        <article className={estilos.documento}>
          <p className={estilos.introduccion}>
            Estos términos regulan el uso del sitio web de Alpha, sociedad estudiantil de
            finanzas del Tecnológico de Monterrey, Campus Ciudad de México. Puedes consultar el
            sitio sin celebrar un contrato con Alpha. Si envías un registro, estos términos y la
            información específica de la actividad formarán las reglas aplicables a tu solicitud.
          </p>

          <section id="alcance">
            <p className={estilos.numero}>01</p>
            <h2>Alcance</h2>
            <p>
              El sitio comparte información sobre Alpha, sus actividades, contenidos y medios de
              contacto. Alpha es una organización dirigida por estudiantes. Salvo que se indique
              expresamente, el contenido del sitio no constituye una postura oficial del
              Tecnológico de Monterrey ni una recomendación financiera, legal o fiscal.
            </p>
            <p>
              Estos términos no eliminan derechos que la ley aplicable reconozca con carácter
              obligatorio. Si una actividad publica reglas particulares, esas reglas se aplicarán
              solo a dicha actividad y prevalecerán en caso de contradicción.
            </p>
          </section>

          <section id="uso">
            <p className={estilos.numero}>02</p>
            <h2>Uso del sitio</h2>
            <p>
              Puedes consultar el contenido para fines personales, académicos e informativos. No
              puedes intentar vulnerar el sitio, interferir con su operación, eludir controles de
              seguridad, recopilar datos de otras personas ni usar el sitio para una actividad
              ilícita o contraria a las normas institucionales aplicables.
            </p>
          </section>

          <section id="registros">
            <p className={estilos.numero}>03</p>
            <h2>Registros y actividades</h2>
            <p>
              Cuando te registras, declaras que la información que proporcionas es correcta y que
              puedes compartirla. Un registro no garantiza admisión, lugar, constancia, beneficio
              ni participación. Cada actividad puede tener cupo, requisitos, horarios o reglas
              adicionales. Te mostraremos esa información antes del registro o la comunicaremos por
              los canales oficiales de la actividad.
            </p>
            <p>
              Alpha puede modificar o cancelar una actividad por razones operativas,
              institucionales, de seguridad o de fuerza mayor. Si ocurre un cambio relevante,
              haremos un esfuerzo razonable por informarlo mediante los datos de contacto
              registrados o los canales oficiales. Cuando una actividad tenga costo, sus
              condiciones de pago, cancelación y reembolso deberán informarse antes del cobro.
            </p>
          </section>

          <section id="conducta">
            <p className={estilos.numero}>04</p>
            <h2>Conducta</h2>
            <p>
              Quienes participen en espacios de Alpha deben mantener un trato respetuoso y cumplir
              las indicaciones del equipo organizador, las reglas del recinto y la normativa del
              Tecnológico de Monterrey. Alpha puede negar o retirar la participación ante conductas
              que pongan en riesgo a otras personas, interrumpan una actividad o incumplan estas
              reglas. La medida será proporcional a la conducta y a las necesidades de seguridad
              de la actividad.
            </p>
          </section>

          <section id="contenido">
            <p className={estilos.numero}>05</p>
            <h2>Contenido y propiedad intelectual</h2>
            <p>
              Los nombres, logotipos, diseños, fotografías, textos, materiales y demás contenido
              conservan los derechos de sus respectivos titulares. Puedes compartir enlaces al
              sitio. Para reproducir, adaptar o usar materiales de Alpha con fines públicos o
              comerciales, solicita autorización previa por escrito.
            </p>
          </section>

          <section id="enlaces">
            <p className={estilos.numero}>06</p>
            <h2>Enlaces externos</h2>
            <p>
              El sitio puede dirigir a plataformas o páginas de terceros. Sus responsables fijan
              sus propias condiciones, prácticas de privacidad y medidas de seguridad. La presencia
              de un enlace no implica respaldo ni control de Alpha sobre ese servicio.
            </p>
          </section>

          <section id="datos">
            <p className={estilos.numero}>07</p>
            <h2>Datos personales</h2>
            <p>
              Usamos la información enviada en formularios para administrar registros, comunicar
              actividades y dar seguimiento a solicitudes relacionadas con Alpha. Comparte solo los
              datos solicitados y evita incluir información sensible en campos abiertos. La
              información de privacidad mostrada en cada formulario indicará el uso aplicable y no
              queda sustituida por estos términos.
            </p>
            <p>
              Para medir el uso de las páginas públicas, usamos Vercel Web Analytics. Esta
              herramienta puede registrar la página consultada, la fecha y hora, el sitio de
              referencia, la ubicación aproximada, el tipo de dispositivo, el sistema operativo y el
              navegador. Vercel procesa estos datos de forma anónima para entregar estadísticas
              agregadas. La medición no usa cookies, excluye las rutas privadas del panel y no se
              combina con la información enviada en formularios. Alpha no envía nombres, correos,
              matrículas ni el contenido de los formularios a Web Analytics.
            </p>
            <p>
              Puedes solicitar acceso, corrección o eliminación de tus datos, o dejar de recibir
              comunicaciones, escribiendo a <a href="mailto:contacto@alphaccm.org">contacto@alphaccm.org</a>.
              Algunas solicitudes pueden conservarse durante el tiempo necesario para atender
              obligaciones institucionales, de seguridad o de registro.
            </p>
          </section>

          <section id="responsabilidad">
            <p className={estilos.numero}>08</p>
            <h2>Responsabilidad</h2>
            <p>
              Procuramos mantener la información correcta y el sitio disponible, pero puede haber
              errores, cambios o interrupciones. Verifica fechas, sedes, cupos, ponentes y requisitos
              en la comunicación oficial de cada actividad antes de tomar una decisión o trasladarte.
              El contenido educativo es general y no sustituye asesoría profesional personalizada.
            </p>
            <p>
              En la medida permitida por la ley, Alpha no responde por decisiones tomadas únicamente
              con base en contenido general del sitio, por fallas atribuibles a servicios de terceros
              ni por hechos fuera de su control razonable. Esta limitación no se aplica a daños
              causados intencionalmente o por negligencia grave, a lesiones personales atribuibles a
              Alpha ni a responsabilidades que legalmente no puedan excluirse o limitarse.
            </p>
          </section>

          <section id="cambios">
            <p className={estilos.numero}>09</p>
            <h2>Cambios a estos términos</h2>
            <p>
              Podemos actualizar estos términos cuando cambien el sitio, las actividades o las
              reglas aplicables. Publicaremos la versión vigente en esta página e indicaremos la
              fecha de la última actualización. Los cambios no afectarán de forma retroactiva un
              registro ya aceptado. Si el cambio altera de forma importante una actividad futura en
              la que estés registrado, haremos un esfuerzo razonable por avisarte.
            </p>
          </section>

          <section id="ley">
            <p className={estilos.numero}>10</p>
            <h2>Ley aplicable</h2>
            <p>
              Estos términos se interpretan conforme a las leyes aplicables en México. Nada en esta
              sección impide que una persona ejerza derechos obligatorios o acuda a las autoridades y
              tribunales que la ley le reconozca. Si una disposición resulta inválida o inaplicable,
              las demás conservarán sus efectos.
            </p>
          </section>

          <section id="contacto">
            <p className={estilos.numero}>11</p>
            <h2>Contacto</h2>
            <p>
              Para dudas sobre estos términos o sobre el uso del sitio, escribe a
              {" "}<a href="mailto:contacto@alphaccm.org">contacto@alphaccm.org</a>.
            </p>
            <address>
              Alpha · Sociedad Estudiantil de Finanzas<br />
              Tecnológico de Monterrey, Campus Ciudad de México<br />
              Ciudad de México, México
            </address>
          </section>
        </article>
      </div>

      <footer className={estilos.pie}>
        <MarcaAlpha className={estilos.marcaPie} tono="navy" />
        <p>© 2026 Alpha CCM</p>
        <Link href="/">Volver al inicio <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
