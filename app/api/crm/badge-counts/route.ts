import { NextResponse } from "next/server";

import { getFollowUpBadgeCount } from "@/lib/crm/data";
import { getUnreadCustomerReminderCount } from "@/lib/crm/reminder-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [followUpCount, reminderCount] = await Promise.all([
      getFollowUpBadgeCount(),
      getUnreadCustomerReminderCount(),
    ]);
    return NextResponse.json({ followUpCount, reminderCount });
  } catch {
    return NextResponse.json({ followUpCount: 0, reminderCount: 0 });
  }
}
