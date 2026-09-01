export const dynamic = "force-static";

const calendario = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Sociedad Estudiantil Alpha//Mario Kart Challenge//ES",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "UID:mario-kart-challenge-20260921@alphaccm.org",
  "DTSTAMP:20260901T210000Z",
  "DTSTART:20260921T190000Z",
  "DTEND:20260921T230000Z",
  "SUMMARY:Mario Kart Challenge",
  "DESCRIPTION:La pista es de toda la comunidad LAF. Compite\\, convive y conoce",
  " a estudiantes de todos los semestres.",
  "LOCATION:SUM 2103\\, Tecnológico de Monterrey Campus Ciudad de México",
  "URL:https://alphaccm.org/events/mario-kart",
  "STATUS:CONFIRMED",
  "TRANSP:OPAQUE",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

export function GET() {
  return new Response(calendario, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Disposition": 'inline; filename="mario-kart-challenge.ics"',
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
