// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "@/convex/schema";
import { internal } from "@/convex/_generated/api";
import {
  prepararCorreoEncuesta,
  renderizarCorreoDashboard,
  textoConFirma,
} from "@/convex/lib/plantillaCorreo";
import {
  redactarEnlacesInvitacion,
  tokensEnEnlacesInvitacion,
} from "@/convex/correo";

const modulos = import.meta.glob("../convex/**/*.ts");

describe("plantilla de correo del dashboard", () => {
  it("aplica la identidad de Alpha y conserva una salida movil", () => {
    const html = renderizarCorreoDashboard({
      asunto: "Invitación a Networking Night",
      texto: "Hola,\n\nTe compartimos los detalles de la sesión.",
      remitente: "finanzas@alphaccm.org",
    });

    expect(html).toContain("https://alphaccm.org/alpha-mark-white.png?email=20260820");
    expect(html).toContain("Coordinación de Finanzas,");
    expect(html).toContain("Puedes responder directamente a este correo.");
    expect(html).not.toContain("MENSAJE DE ALPHA");
    expect(html).not.toContain("MÁS ALLÁ DEL MERCADO");
    expect(html).toContain("#0D2140");
    expect(html).toContain("#0066FF");
    expect(html).toContain("Poppins");
    expect(html).toContain("Montserrat");
    expect(html).toContain("@media only screen and (max-width: 600px)");
    expect(html).toContain("Invitación a Networking Night");
  });

  it("escapa contenido no confiable antes de insertarlo en el HTML", () => {
    const html = renderizarCorreoDashboard({
      asunto: "Seguimiento <interno>",
      texto: '<script>alert("x")</script>',
      remitente: "direccion@alphaccm.org",
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Seguimiento &lt;interno&gt;");
    expect(html).toContain("Presidencia y Vicepresidencia,");
  });

  it("conserva negritas y cursivas sin aceptar HTML del compositor", () => {
    const html = renderizarCorreoDashboard({
      asunto: "Seguimiento",
      texto: "Dato importante y fecha tentativa.",
      segmentos: [
        { texto: "Dato importante", negrita: true, cursiva: false },
        { texto: " y ", negrita: false, cursiva: false },
        { texto: "fecha tentativa", negrita: false, cursiva: true },
        { texto: ".", negrita: false, cursiva: false },
      ],
    });

    expect(html).toContain('<strong style="font-weight:600;">Dato importante</strong>');
    expect(html).toContain('<em style="font-style:italic;">fecha tentativa</em>');
  });

  it("agrega la firma del remitente al texto plano", () => {
    expect(textoConFirma("Gracias por escribirnos.", "finanzas@alphaccm.org")).toBe(
      "Gracias por escribirnos.\n\nCoordinación de Finanzas,\nSociedad Estudiantil Alpha\nTecnológico de Monterrey, Campus Ciudad de México",
    );
  });

  it("genera la encuesta con un llamado a la acción personal y de un solo uso", () => {
    const correo = prepararCorreoEncuesta({
      eventoTitulo: "Networking Night",
      nombre: "Ana",
      url: "https://alphaccm.org/encuesta/token-personal-1234567890",
      remitente: "auto@alphaccm.org",
    });

    expect(correo.asunto).toBe("Cuéntanos qué te pareció Networking Night");
    expect(correo.texto).toContain("Responder encuesta: https://alphaccm.org/encuesta/token-personal-1234567890");
    expect(correo.html).toContain("Responder encuesta");
    expect(correo.html).toContain("Tus respuestas son anónimas.");
    expect(correo.html).toContain("https://alphaccm.org/encuesta/token-personal-1234567890");
  });
});

describe("copias de invitacion en la bandeja", () => {
  it("oculta el token pero permite localizarlo para revocacion", () => {
    const token = "a".repeat(64);
    const texto = `Abre https://alphaccm.org/dashboard/invitacion/${token}`;
    expect(tokensEnEnlacesInvitacion(texto)).toEqual([token]);
    expect(redactarEnlacesInvitacion(texto)).not.toContain(token);
    expect(redactarEnlacesInvitacion(texto)).toContain("se omitio de esta copia");
  });
});

describe("ingesta de correo entrante", () => {
  it("convierte un evento de Resend en un hilo visible sin duplicarlo", async () => {
    const t = convexTest(schema, modulos);
    const datos = {
      eventId: "evt_entrada_1",
      providerEmailId: "email_entrada_1",
      de: "Persona Ejemplo <persona@example.com>",
      para: ["contacto@alphaccm.org"],
      cc: [],
      asunto: "Interés en colaborar",
      internetMessageId: "<mensaje-1@example.com>",
      recibidoEn: Date.now(),
    };

    const jobId = await t.mutation(internal.correo.registrarEntrada, datos);
    expect(jobId).not.toBeNull();
    expect(await t.mutation(internal.correo.registrarEntrada, datos)).toBeNull();

    await t.mutation(internal.correo.guardarEntrada, {
      jobId: jobId!,
      texto: "Hola, me interesa colaborar con Alpha.",
      html: '<div style="font-family: Georgia"><strong>Hola</strong>, me interesa colaborar.</div>',
      referencias: [],
      adjuntos: [],
    });

    const estado = await t.run(async (ctx) => ({
      hilos: await ctx.db.query("mailThreads").collect(),
      mensajes: await ctx.db.query("mailMessages").collect(),
      trabajos: await ctx.db.query("mailInboundJobs").collect(),
    }));

    expect(estado.hilos).toHaveLength(1);
    expect(estado.hilos[0]).toMatchObject({
      contactoCorreo: "persona@example.com",
      estado: "abierto",
      noLeidos: 1,
    });
    expect(estado.mensajes).toHaveLength(1);
    expect(estado.mensajes[0]).toMatchObject({
      direccion: "entrante",
      estado: "recibido",
      providerInboundId: "email_entrada_1",
      html: '<div style="font-family: Georgia"><strong>Hola</strong>, me interesa colaborar.</div>',
    });
    expect(estado.trabajos[0]?.estado).toBe("completado");
  });
});
