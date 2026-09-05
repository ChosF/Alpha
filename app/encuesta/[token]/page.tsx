import type { Metadata } from "next";
import { EncuestaCliente } from "./encuesta-cliente";

export const metadata: Metadata = {
  title: "Encuesta de satisfacción | Alpha CCM",
  description: "Comparte tu opinión sobre un evento de Alpha.",
  robots: { index: false, follow: false },
};

export default async function PaginaEncuesta({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EncuestaCliente token={token} />;
}
