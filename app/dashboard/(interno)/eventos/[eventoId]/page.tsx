import { EventoDetalle } from "../eventos-cliente";

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ eventoId: string }>;
}) {
  const { eventoId } = await params;
  return <EventoDetalle eventoId={eventoId} />;
}
