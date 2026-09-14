import { redirect } from "next/navigation";

/** Stable destination embedded in tickets already delivered by email. */
export default async function Registro({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const id = params[""];
  redirect(`/dashboard/boletos${typeof id === "string" && /^[a-zA-Z0-9]{1,64}$/.test(id) ? `?id=${encodeURIComponent(id)}` : ""}`);
}
