import { NextResponse } from "next/server";

import { getFollowUpBadgeCount } from "@/lib/crm/data";
import { getUnreadWhatsAppCount } from "@/lib/whatsapp/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [followUpCount, whatsAppCount] = await Promise.all([
      getFollowUpBadgeCount(),
      getUnreadWhatsAppCount(),
    ]);
    return NextResponse.json({ followUpCount, whatsAppCount });
  } catch {
    return NextResponse.json({ followUpCount: 0, whatsAppCount: 0 });
  }
}
