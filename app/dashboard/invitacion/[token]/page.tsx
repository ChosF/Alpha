import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { FormularioInvitacion } from "./formulario-invitacion";

export const dynamic = "force-dynamic";

/**
 * Comprueba la invitacion en el servidor. Asi el formulario no depende de que
 * la conexion reactiva de Convex termine de abrir antes de mostrar el estado.
 */
export default async function Invitacion({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const consulta = await searchParams;

  if (consulta.contrasena !== undefined || consulta.repetida !== undefined) {
    redirect(`/dashboard/invitacion/${token}`);
  }

  let invitacion = null;
  let errorConsulta = false;
  try {
    invitacion = await fetchQuery(api.usuarios.verificarInvitacion, { token });
  } catch {
    errorConsulta = true;
  }

  return (
    <FormularioInvitacion
      token={token}
      invitacion={invitacion}
      errorConsulta={errorConsulta}
    />
  );
}
