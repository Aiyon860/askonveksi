import { NextResponse } from "next/server";

import { getFollowUpBadgeCount } from "@/lib/crm/data";
import { getUnreadCustomerReminderCount } from "@/lib/crm/reminder-data";
import { getUnreadWhatsAppCount } from "@/lib/whatsapp/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [followUpCount, reminderCount, whatsAppCount] = await Promise.all([
      getFollowUpBadgeCount(),
      getUnreadCustomerReminderCount(),
      getUnreadWhatsAppCount(),
    ]);
    return NextResponse.json({ followUpCount, reminderCount, whatsAppCount });
  } catch {
    return NextResponse.json({ followUpCount: 0, reminderCount: 0, whatsAppCount: 0 });
  }
}
