import Link from "next/link";
import { CalendarClock, MessageCircle } from "lucide-react";

import { FollowUpResultForm } from "@/components/crm/follow-up-result-form";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getFollowUpData } from "@/lib/crm/data";
import { getCurrentActor } from "@/lib/auth/session";
import { formatDate, whatsappHref } from "@/lib/crm/format";
import { leadClassification } from "@/lib/crm/constants";
import { cn } from "@/lib/utils";

const BUCKETS = ["overdue", "today", "tomorrow", "upcoming"] as const;
type Bucket = (typeof BUCKETS)[number];
const BUCKET_LABEL: Record<Bucket, string> = { overdue: "Terlambat", today: "Hari ini", tomorrow: "Besok", upcoming: "Mendatang" };
const BUCKET_THEME: Record<Bucket, { surface: string; count: string }> = {
  overdue: { surface: "border-destructive/25 bg-destructive/5 hover:bg-destructive/10", count: "text-destructive" },
  today: { surface: "border-warning/25 bg-warning/5 hover:bg-warning/10", count: "text-warning" },
  tomorrow: { surface: "border-info/25 bg-info/5 hover:bg-info/10", count: "text-info" },
  upcoming: { surface: "border-success/25 bg-success/5 hover:bg-success/10", count: "text-success" },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ bucket?: string | string[]; pic?: string | string[] }> }) {
  const params = await searchParams;
  const rawBucket = first(params.bucket);
  const bucket: Bucket = BUCKETS.includes(rawBucket as Bucket) ? rawBucket as Bucket : "today";
  const picId = first(params.pic);
  const [{ items, counts, salesUsers, selectedPicId }, actor] = await Promise.all([getFollowUpData({ bucket, picId }), getCurrentActor()]);
  const canOperate = actor?.role === "ADMIN" || actor?.role === "SALES";
  const countsByBucket: Record<Bucket, number> = { overdue: counts.overdue, today: counts.today, tomorrow: counts.tomorrow, upcoming: counts.upcoming };

  return (
    <>
      <PageHeader title="Follow-up" description="Kerjakan tindakan yang jatuh tempo, catat hasilnya, lalu tetapkan langkah berikutnya." />
      <PageMessage />

      <nav aria-label="Status waktu follow-up" className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 lg:grid-cols-4 lg:grid-flow-row lg:overflow-visible">
        {BUCKETS.map((item) => (
          <Link
            key={item}
            href={`/crm/follow-up?bucket=${item}${selectedPicId ? `&pic=${selectedPicId}` : ""}`}
            aria-current={bucket === item ? "page" : undefined}
            className={cn(
              "rounded-xl border p-4 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              BUCKET_THEME[item].surface,
              bucket === item && "ring-2 ring-ring/30",
            )}
          >
            <span className="text-sm text-muted-foreground">{BUCKET_LABEL[item]}</span>
            <strong className={cn("mt-2 block font-mono text-2xl tabular-nums", BUCKET_THEME[item].count)}>{countsByBucket[item]}</strong>
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{BUCKET_LABEL[bucket]}</CardTitle>
          <CardDescription>{items.length} tindakan ditampilkan, terurut dari jadwal paling awal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="mb-5">
            <input type="hidden" name="bucket" value={bucket} />
            <FieldGroup className="gap-3 sm:flex sm:flex-row sm:items-end">
              <Field className="sm:max-w-xs">
                <FieldLabel htmlFor="pic">PIC</FieldLabel>
                <NativeSelect id="pic" name="pic" defaultValue={selectedPicId ?? "all"}>
                  <NativeSelectOption value="all">Semua PIC</NativeSelectOption>
                  {salesUsers.map((user) => <NativeSelectOption key={user.id} value={user.id}>{user.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Button type="submit" variant="outline">Terapkan filter</Button>
            </FieldGroup>
          </form>

          {items.length ? (
            <div className="flex flex-col divide-y">
              {items.map((item) => {
                const waHref = whatsappHref(item.customer.whatsapp);
                return (
                  <article key={item.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpportunityStatusBadge stage={item.stage} />
                        <Badge variant="outline">{leadClassification(item.leadScore)} · {item.leadScore}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{item.opportunityNo}</span>
                      </div>
                      <Link href={`/crm/peluang/${item.id}`} className="mt-3 block w-fit font-semibold underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{item.title}</Link>
                      <p className="mt-1 text-sm text-muted-foreground">{item.customer.name}{item.customer.companyName ? ` · ${item.customer.companyName}` : ""}</p>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-muted-foreground">Next action</dt><dd>{item.nextAction}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Jadwal</dt><dd>{formatDate(item.nextActionAt, true)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">PIC</dt><dd>{item.salesPic?.name ?? "Belum ditugaskan"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Terakhir dihubungi</dt><dd>{formatDate(item.lastContactedAt, true)}</dd></div>
                      </dl>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      {waHref ? (
                        <Button variant="outline" size="sm" render={<a href={waHref} target="_blank" rel="noreferrer" />} nativeButton={false}>
                          <MessageCircle data-icon="inline-start" aria-hidden="true" />
                          Buka WhatsApp
                        </Button>
                      ) : null}
                      {canOperate ? <FollowUpResultForm opportunity={item} /> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty className="min-h-72 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarClock aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Tidak ada follow-up {BUCKET_LABEL[bucket].toLowerCase()}</EmptyTitle>
                <EmptyDescription>Pilih status waktu atau PIC lain untuk melihat jadwal berikutnya.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
  );
}
