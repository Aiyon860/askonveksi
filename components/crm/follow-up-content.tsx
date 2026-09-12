import Link from "next/link";
import { CalendarClock, MessageCircle } from "lucide-react";

import { FollowUpResultForm } from "@/components/crm/follow-up-result-form";
import { OpportunityStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CRM_OPERATOR_ROLES, hasRole } from "@/lib/auth/permissions";
import { getFollowUpData } from "@/lib/crm/data";
import { getCurrentActor } from "@/lib/auth/session";
import { formatDate, whatsappHref } from "@/lib/crm/format";
import { cn } from "@/lib/utils";
import { openCustomerWhatsAppAction } from "@/app/actions/whatsapp";

const BUCKETS = ["overdue", "today", "tomorrow", "upcoming"] as const;
type Bucket = (typeof BUCKETS)[number];
const BUCKET_LABEL: Record<Bucket, string> = { overdue: "Terlambat", today: "Hari ini", tomorrow: "Besok", upcoming: "Mendatang" };
const BUCKET_THEME: Record<Bucket, { surface: string; count: string }> = {
  overdue: { surface: "bg-card hover:bg-muted", count: "text-destructive" },
  today: { surface: "bg-card hover:bg-muted", count: "text-warning" },
  tomorrow: { surface: "bg-card hover:bg-muted", count: "text-primary" },
  upcoming: { surface: "bg-card hover:bg-muted", count: "text-success" },
};

export async function FollowUpContent({ bucket, picId }: { bucket: Bucket; picId: string | undefined }) {
  const [{ items, counts, salesUsers, selectedPicId }, actor] = await Promise.all([getFollowUpData({ bucket, picId }), getCurrentActor()]);
  const canOperate = Boolean(actor && hasRole(actor.role, CRM_OPERATOR_ROLES));
  const countsByBucket: Record<Bucket, number> = { overdue: counts.overdue, today: counts.today, tomorrow: counts.tomorrow, upcoming: counts.upcoming };

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-border">
        <nav aria-label="Status waktu follow-up" className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-px overflow-x-auto overflow-y-hidden lg:grid-cols-4 lg:grid-flow-row lg:overflow-visible">
          {BUCKETS.map((item) => (
            <Link
              key={item}
              href={`/crm/follow-up?bucket=${item}${selectedPicId ? `&pic=${selectedPicId}` : ""}`}
              aria-current={bucket === item ? "page" : undefined}
              className={cn(
                "p-4 outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50",
                BUCKET_THEME[item].surface,
                bucket === item && "bg-primary/[0.045]",
              )}
            >
              <span className="text-sm text-muted-foreground">{BUCKET_LABEL[item]}</span>
              <strong className={cn("mt-2 block font-mono text-2xl tabular-nums", BUCKET_THEME[item].count)}>{countsByBucket[item]}</strong>
            </Link>
          ))}
        </nav>
      </div>

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
                      <form action={openCustomerWhatsAppAction}><input type="hidden" name="customerId" value={item.customer.id} /><Button type="submit" size="sm"><MessageCircle data-icon="inline-start" aria-hidden="true" />Buka inbox</Button></form>
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
