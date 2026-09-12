import { z } from "zod";

import { getCurrentActor } from "@/lib/auth/session";
import { canAccessWhatsAppInbox } from "@/lib/whatsapp/access";
import { getWhatsAppConversationMessages } from "@/lib/whatsapp/data";

export const dynamic = "force-dynamic";

const conversationIdSchema = z.string().trim().min(12).max(64);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!canAccessWhatsAppInbox(actor.role)) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  const parsed = conversationIdSchema.safeParse((await params).id);
  if (!parsed.success) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const messages = await getWhatsAppConversationMessages(actor, parsed.data);
  if (!messages) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({
    messages: messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      kind: message.kind,
      status: message.status,
      text: message.text,
      hasMedia: Boolean(message.mediaPath),
      mediaFileName: message.mediaFileName,
      mediaMimeType: message.mediaMimeType,
      invoiceId: message.automationJob?.invoiceId ?? null,
      invoiceNo: message.automationJob?.invoice?.invoiceNo ?? null,
      errorMessage: message.errorMessage,
      occurredAt: message.occurredAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
