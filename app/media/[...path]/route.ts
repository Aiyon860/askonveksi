import { mediaContentType, readMediaFile, resolveMediaFile } from "@/lib/cms/media";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = await resolveMediaFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  const data = await readMediaFile(file.absolute);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mediaContentType(file.extension),
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
