import { destinoDashboard } from "@/lib/destino-dashboard";
import { FormularioAcceso } from "./formulario-acceso";

export default async function Acceso({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return <FormularioAcceso destino={destinoDashboard(typeof next === "string" ? next : null)} />;
}
