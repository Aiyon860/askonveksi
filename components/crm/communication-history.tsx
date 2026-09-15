import type { ReactNode } from "react";
import Link from "next/link";

import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  COMMUNICATION_CHANNEL_LABEL,
  COMMUNICATION_DIRECTION_LABEL,
  COMMUNICATION_SYSTEM_EVENT_LABEL,
} from "@/lib/crm/constants";
import { COMMUNICATION_PAGE_SIZE, type CommunicationTimelineItem } from "@/lib/crm/data";
import { formatDate } from "@/lib/crm/format";

function metadataString(metadata: CommunicationTimelineItem["metadata"], key: string) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function activityLabel(activity: CommunicationTimelineItem) {
  if (activity.kind === "INTERNAL_NOTE") return "Catatan internal";
  if (activity.kind === "SYSTEM" && activity.systemEvent) {
    return COMMUNICATION_SYSTEM_EVENT_LABEL[activity.systemEvent];
  }
  return activity.channel ? COMMUNICATION_CHANNEL_LABEL[activity.channel] : "Komunikasi";
}

export function CommunicationHistory({
  items,
  total,
  page,
  pageCount,
  pathname,
  paginationParams,
  pageSize = COMMUNICATION_PAGE_SIZE,
  pageSizeParam = "pageSize",
  controls,
  form,
}: {
  items: CommunicationTimelineItem[];
  total: number;
  page: number;
  pageCount: number;
  pathname: string;
  paginationParams?: Record<string, string | undefined>;
  pageSize?: number;
  pageSizeParam?: string;
  controls?: ReactNode;
  form?: ReactNode;
}) {
  return (
    <Card id="communication-history">
      <CardHeader>
        <CardTitle>Riwayat komunikasi</CardTitle>
        <CardDescription>
          Aktivitas terbaru ditampilkan lebih dahulu. Semua entri bersifat permanen agar perpindahan PIC tetap dapat ditelusuri.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {form ? (
          <>
            {form}
          </>
        ) : null}
        {controls}

        {items.length ? (
          <Table className="min-w-4xl">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead>Penulis</TableHead>
                <TableHead>Peluang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {items.map((activity) => {
              const nextAction = metadataString(activity.metadata, "nextAction");
              const nextActionAt = metadataString(activity.metadata, "nextActionAt");
              const recordedLater = activity.createdAt.getTime() - activity.occurredAt.getTime() > 60_000;

              return (
                  <TableRow key={activity.id}>
                    <TableCell className="whitespace-normal">
                    <div className="flex min-w-36 flex-col gap-1 text-xs text-muted-foreground">
                      <time dateTime={activity.occurredAt.toISOString()}>{formatDate(activity.occurredAt, true)}</time>
                      {recordedLater ? <span>Dicatat {formatDate(activity.createdAt, true)}</span> : null}
                    </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={activity.kind === "SYSTEM" ? "outline" : "secondary"}>
                          {activityLabel(activity)}
                        </Badge>
                        {activity.direction ? (
                          <span className="text-xs text-muted-foreground">
                            {COMMUNICATION_DIRECTION_LABEL[activity.direction]}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6">{activity.content}</p>
                      {nextAction ? (
                        <dl className="mt-3 grid gap-1 rounded-md bg-muted px-3 py-2 text-xs">
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="font-medium">Langkah berikutnya</dt>
                            <dd>{nextAction}</dd>
                          </div>
                          {nextActionAt ? (
                            <div className="flex flex-wrap gap-x-2 text-muted-foreground">
                              <dt>Jadwal</dt>
                              <dd>{formatDate(nextActionAt, true)}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </TableCell>
                    <TableCell>{activity.author.name}</TableCell>
                    <TableCell className="whitespace-normal">
                      {activity.opportunity ? (
                        <Link href={`/crm/peluang/${activity.opportunity.id}`} className="text-xs font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {activity.opportunity.opportunityNo} · {activity.opportunity.title}
                        </Link>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
              );
            })}
            </TableBody>
          </Table>
        ) : (
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyTitle>Belum ada aktivitas komunikasi</EmptyTitle>
              <EmptyDescription>Catat percakapan pertama agar konteks customer tersedia untuk seluruh tim.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <DataPagination
          pathname={pathname}
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          pageSizeOptions={pageSizeParam === "pageSize" ? undefined : [5, 10, 20]}
          params={paginationParams}
          pageParam="historyPage"
          pageSizeParam={pageSizeParam}
          anchor="communication-history"
        />
      </CardContent>
    </Card>
  );
}
