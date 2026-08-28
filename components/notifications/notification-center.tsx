"use client";

import { useState } from "react";
import { BellRing, CheckCheck, Inbox } from "lucide-react";

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
import { cn } from "@/lib/utils";

type NotificationGroup = "Hari ini" | "Sebelumnya";
type NotificationFilter = "all" | "unread";

type NotificationItem = {
  id: string;
  group: NotificationGroup;
  title: string;
  description: string;
  source: string;
  time: string;
  unread: boolean;
};

const EXAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "example-follow-up",
    group: "Hari ini",
    title: "Follow-up perlu ditinjau",
    description: "Contoh pengingat untuk pekerjaan yang belum diperbarui.",
    source: "CRM",
    time: "09.30",
    unread: true,
  },
  {
    id: "example-order-update",
    group: "Hari ini",
    title: "Pekerjaan berpindah tahap",
    description: "Contoh pembaruan status order tanpa mengunci jenis proses tertentu.",
    source: "Order",
    time: "08.10",
    unread: true,
  },
  {
    id: "example-assignment",
    group: "Sebelumnya",
    title: "Tugas baru perlu diperiksa",
    description: "Contoh pemberitahuan saat pekerjaan masuk ke antrean pengguna.",
    source: "Pekerjaan",
    time: "Kemarin",
    unread: false,
  },
  {
    id: "example-system",
    group: "Sebelumnya",
    title: "Ringkasan sistem tersedia",
    description: "Contoh pemberitahuan umum yang tidak terkait satu modul tertentu.",
    source: "Sistem",
    time: "2 hari lalu",
    unread: false,
  },
];

const GROUP_ORDER: NotificationGroup[] = ["Hari ini", "Sebelumnya"];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState(EXAMPLE_NOTIFICATIONS);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const unreadCount = notifications.filter((item) => item.unread).length;
  const visibleNotifications = filter === "unread"
    ? notifications.filter((item) => item.unread)
    : notifications;
  const visibleGroups = GROUP_ORDER.map((group) => ({
    group,
    items: visibleNotifications.filter((item) => item.group === group),
  })).filter(({ items }) => items.length > 0);

  function markAsRead(id: string) {
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, unread: false } : item
    )));
  }

  function markAllAsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  }

  return (
    <section aria-labelledby="notification-list-title" className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-4 border-b bg-muted/30 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="notification-list-title" className="text-base font-semibold">Aktivitas terbaru</h2>
            <Badge variant="secondary" aria-live="polite">{unreadCount} belum dibaca</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Pembaruan diurutkan dari yang paling baru.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
            Tampilkan
            <NativeSelect
              value={filter}
              onChange={(event) => setFilter(event.target.value as NotificationFilter)}
              className="w-full sm:w-40 [&_select]:h-11 sm:[&_select]:h-9"
              aria-label="Filter notifikasi"
            >
              <NativeSelectOption value="all">Semua</NativeSelectOption>
              <NativeSelectOption value="unread">Belum dibaca</NativeSelectOption>
            </NativeSelect>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            <CheckCheck data-icon="inline-start" aria-hidden="true" />
            Tandai semua dibaca
          </Button>
        </div>
      </div>

      {visibleGroups.length > 0 ? (
        <div aria-live="polite">
          {visibleGroups.map(({ group, items }) => (
            <section key={group} aria-labelledby={`notification-group-${group.replaceAll(" ", "-").toLowerCase()}`}>
              <div className="border-b bg-muted/50 px-4 py-2.5 sm:px-5">
                <h3 id={`notification-group-${group.replaceAll(" ", "-").toLowerCase()}`} className="text-xs font-semibold text-muted-foreground">
                  {group}
                </h3>
              </div>
              <div className="divide-y">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      "flex min-w-0 flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:px-5",
                      item.unread && "bg-primary/[0.04]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.time}</span>
                      <Badge variant={item.unread ? "default" : "outline"}>
                        {item.unread ? "Belum dibaca" : "Dibaca"}
                      </Badge>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold leading-5">{item.title}</h4>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <BellRing aria-hidden="true" className="size-3.5" />
                        <span>Sumber: {item.source}</span>
                      </div>
                    </div>

                    {item.unread ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(item.id)}
                        className="h-11 w-full sm:h-8 sm:w-auto"
                        aria-label={`Tandai ${item.title} sebagai dibaca`}
                      >
                        Tandai dibaca
                      </Button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty className="min-h-80 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>Tidak ada notifikasi belum dibaca</EmptyTitle>
            <EmptyDescription>Semua pembaruan pada data contoh sudah ditandai sebagai dibaca.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
