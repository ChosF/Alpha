let promesaToken: Promise<string> | null = null;

async function solicitarToken(): Promise<string> {
  try {
    const respuesta = await fetch("/api/registro/token", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const datos = (await respuesta.json()) as { token?: string };
    return respuesta.ok && datos.token ? datos.token : "";
  } catch {
    return "";
  }
}
export function prepararToken(): Promise<string> {
  promesaToken ??= solicitarToken();
  return promesaToken;
}

export async function tomarToken(): Promise<string> {
  const token = await prepararToken();
  return token;
}

export function renovarToken(): Promise<string> {
  promesaToken = solicitarToken();
  return promesaToken;
}
