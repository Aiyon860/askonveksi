import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import {
  getCustomerReminders,
  type ReminderReadFilter,
  type ReminderTypeFilter,
} from "@/lib/crm/reminder-data";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type NotificationSearchParams = Promise<{
  read?: string | string[];
  type?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotificationsPage({ searchParams }: { searchParams: NotificationSearchParams }) {
  const params = await searchParams;
  const readFilter: ReminderReadFilter = firstParam(params.read) === "unread" ? "unread" : "all";
  const rawType = firstParam(params.type);
  const typeFilter: ReminderTypeFilter = rawType === "repeat" || rawType === "reactivation" ? rawType : "all";
  const data = await getCustomerReminders({
    readFilter,
    typeFilter,
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
  });

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Tindak lanjuti repeat order pada bulan ke-3 dan reaktivasi customer pada bulan ke-6."
      />
      <PageMessage />
      <NotificationCenter data={data} readFilter={readFilter} typeFilter={typeFilter} />
    </>
  );
}
