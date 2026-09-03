import Link from "next/link";
import { BellRing, CheckCheck, Inbox, RotateCcw, UserRoundX } from "lucide-react";

import {
  markAllCustomerRemindersReadAction,
  markCustomerReminderReadAction,
} from "@/app/actions/notifications";
import { DataPagination } from "@/components/data-pagination";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import type {
  getCustomerReminders,
  ReminderReadFilter,
  ReminderTypeFilter,
} from "@/lib/crm/reminder-data";
import { DATA_PAGE_SIZES } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type ReminderData = Awaited<ReturnType<typeof getCustomerReminders>>;

export function NotificationCenter({
  data,
  readFilter,
  typeFilter,
}: {
  data: ReminderData;
  readFilter: ReminderReadFilter;
  typeFilter: ReminderTypeFilter;
}) {
  const unreadCount = data.items.filter((item) => !item.readAt).length;
  const persistentParams = {
    read: readFilter !== "all" ? readFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    pageSize: data.pageSize !== 20 ? String(data.pageSize) : undefined,
  };

  return (
    <section aria-labelledby="notification-list-title" className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-col gap-4 border-b bg-muted/30 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="notification-list-title" className="text-base font-semibold">Reminder customer</h2>
            <Badge variant={unreadCount ? "default" : "outline"} aria-live="polite">
              {unreadCount} belum dibaca di halaman ini
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Hanya reminder jatuh tempo tanpa peluang terbuka yang ditampilkan.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {data.pageSize !== 20 ? <input type="hidden" name="pageSize" value={data.pageSize} /> : null}
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
              Status baca
              <NativeSelect name="read" defaultValue={readFilter} className="w-full sm:w-40" aria-label="Filter status baca">
                <NativeSelectOption value="all">Semua</NativeSelectOption>
                <NativeSelectOption value="unread">Belum dibaca</NativeSelectOption>
              </NativeSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
              Jenis reminder
              <NativeSelect name="type" defaultValue={typeFilter} className="w-full sm:w-44" aria-label="Filter jenis reminder">
                <NativeSelectOption value="all">Semua jenis</NativeSelectOption>
                <NativeSelectOption value="repeat">Potensi repeat</NativeSelectOption>
                <NativeSelectOption value="reactivation">Tidak aktif</NativeSelectOption>
              </NativeSelect>
            </label>
            <Button type="submit" variant="outline">Terapkan</Button>
          </form>
          <form action={markAllCustomerRemindersReadAction}>
            <SubmitButton
              type="submit"
              variant="outline"
              pendingLabel="Menandai..."
              disabled={data.total === 0 || (readFilter === "unread" && data.items.length === 0)}
              className="w-full sm:w-auto"
            >
              <CheckCheck data-icon="inline-start" aria-hidden="true" />
              Tandai semua dibaca
            </SubmitButton>
          </form>
        </div>
      </div>

      {data.items.length ? (
        <div className="divide-y" aria-live="polite">
          {data.items.map((item) => {
            const unread = !item.readAt;
            const isInactive = item.type === "REACTIVATION";
            const Icon = isInactive ? UserRoundX : RotateCcw;
            const quantity = item.sourceSalesOrder.items.reduce((total, orderItem) => total + orderItem.quantity, 0);
            const product = item.sourceSalesOrder.items[0]?.description ?? "Produk order terakhir";

            return (
              <article
                key={item.id}
                className={cn(
                  "grid min-w-0 gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start",
                  unread && "bg-primary/[0.035]",
                )}
              >
                <div className={cn(
                  "flex size-10 items-center justify-center rounded-lg border",
                  isInactive ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-warning/20 bg-warning/10 text-warning",
                )}>
                  <Icon aria-hidden="true" className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {isInactive ? "Customer tidak aktif" : "Potensi repeat order"} - {item.customer.companyName ?? item.customer.name}
                    </h3>
                    <Badge variant={unread ? "default" : "outline"}>{unread ? "Belum dibaca" : "Dibaca"}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Order terakhir {item.sourceSalesOrder.salesOrderNo} pada {formatDate(item.sourceSalesOrder.acceptedAt)}:
                    {" "}{product}, {quantity} pcs, {formatCurrency(item.sourceSalesOrder.total)}.
                  </p>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex gap-1.5"><dt>Jatuh tempo</dt><dd className="font-mono text-foreground">{formatDate(item.dueAt)}</dd></div>
                    <div className="flex gap-1.5"><dt>Customer</dt><dd className="font-mono text-foreground">{item.customer.customerNo}</dd></div>
                    <div className="flex gap-1.5"><dt>Sales/PIC</dt><dd className="text-foreground">{item.customer.salesPic?.name ?? "Belum ditugaskan"}</dd></div>
                  </dl>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Button
                    nativeButton={false}
                    render={<Link href={`/crm/pelanggan/${item.customer.id}?repeatFrom=${item.id}#repeat-order`} />}
                  >
                    <BellRing data-icon="inline-start" aria-hidden="true" />
                    Buat peluang
                  </Button>
                  {unread ? (
                    <form action={markCustomerReminderReadAction}>
                      <input type="hidden" name="reminderId" value={item.id} />
                      <SubmitButton type="submit" variant="ghost" size="sm" pendingLabel="Menandai..." className="w-full">
                        Tandai dibaca
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
          <DataPagination
            pathname="/notifications"
            page={data.page}
            pageCount={data.pageCount}
            total={data.total}
            pageSize={data.pageSize}
            pageSizeOptions={DATA_PAGE_SIZES}
            params={persistentParams}
            className="border-t px-4 py-3"
          />
        </div>
      ) : (
        <Empty className="min-h-80 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{readFilter === "unread" ? "Semua reminder sudah dibaca" : "Belum ada reminder jatuh tempo"}</EmptyTitle>
            <EmptyDescription>
              {readFilter === "unread"
                ? "Ubah filter ke semua untuk melihat reminder yang sudah dibaca."
                : "Reminder akan muncul 3 bulan setelah order, lalu berubah menjadi reaktivasi pada bulan ke-6."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
