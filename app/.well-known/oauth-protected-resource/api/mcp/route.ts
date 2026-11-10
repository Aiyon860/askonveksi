import { protectedResourceMetadata } from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 9728 path-based metadata untuk resource `/api/mcp`. */
export async function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
