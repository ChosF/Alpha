import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { FormularioInvitacion } from "./formulario-invitacion";

export const dynamic = "force-dynamic";

/**
 * Comprueba la invitacion en el servidor. Asi el formulario no depende de que
 * la conexion reactiva de Convex termine de abrir antes de mostrar el estado.
 */
export default async function Invitacion({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    const invitacion = await fetchQuery(api.usuarios.verificarInvitacion, { token });
    return <FormularioInvitacion token={token} invitacion={invitacion} />;
  } catch {
    return <FormularioInvitacion token={token} invitacion={null} errorConsulta />;
  }
}
