import { Boleto } from "./boleto";

export default async function PaginaBoleto({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await searchParams;
  return <Boleto key={typeof id === "string" ? id : ""} codigo={typeof id === "string" ? id : ""} />;
}
