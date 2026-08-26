import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (typeof url !== "string" || url === "") {
    return NextResponse.json({ error: "Disponibilidad no configurada." }, { status: 503 });
  }

  try {
    const cliente = new ConvexHttpClient(url);
    const areasCerradas = await cliente.query(api.registros.areasCerradasPublicas, {});
    return NextResponse.json(
      { areasCerradas },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("registro/disponibilidad:", error);
    return NextResponse.json({ error: "No pudimos consultar los cupos." }, { status: 503 });
  }
}
