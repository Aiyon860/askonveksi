import { getTestRows } from "@/lib/data/test";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getTestRows();
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
