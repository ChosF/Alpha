/** Only allow the ticket route as a post-login destination. */
export function destinoDashboard(value: string | null | undefined): string {
  if (!value) return "/dashboard";
  try {
    const url = new URL(value, "https://alpha.invalid");
    if (url.origin !== "https://alpha.invalid" || url.pathname !== "/dashboard/boletos") return "/dashboard";
    const id = url.searchParams.get("id");
    return id && /^[a-zA-Z0-9]{1,64}$/.test(id)
      ? `/dashboard/boletos?id=${encodeURIComponent(id)}`
      : "/dashboard/boletos";
  } catch {
    return "/dashboard";
  }
}
