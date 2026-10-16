import { WHATSAPP_ACCOUNT_MANAGER_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createBroadcastDateTemplate } from "@/lib/crm/broadcast-date-excel";
import { downloadFilename } from "@/lib/download-filename";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireActor(WHATSAPP_ACCOUNT_MANAGER_ROLES);
  } catch {
    return new Response("Anda tidak memiliki akses ke template broadcast.", { status: 403 });
  }

  const buffer = await createBroadcastDateTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("template-import-tanggal-broadcast", "xlsx")}"`,
      "Cache-Control": "private, no-cache, no-store",
    },
  });
}
