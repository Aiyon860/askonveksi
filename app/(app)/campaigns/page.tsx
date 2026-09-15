import Link from "next/link";
import { redirect } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import type { Prisma, WhatsAppCampaignStatus } from "@prisma/client";

import { createCampaignAction, deleteCampaignAction, sendCampaignTestAction, updateCampaignAction } from "@/app/actions/campaigns";
import { CampaignEnabledSwitch } from "@/components/campaigns/campaign-enabled-switch";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { getPrismaClient } from "@/lib/prisma";
import { CAMPAIGN_VARIABLES, jakartaDateTimeInput, parseJakartaDateTime } from "@/lib/whatsapp/campaigns";

const campaignStatuses = {
  SCHEDULED: { label: "Terjadwal", variant: "info" },
  PROCESSING: { label: "Mengirim", variant: "info" },
  PAUSED: { label: "Dijeda", variant: "secondary" },
  SKIPPED: { label: "Dilewati", variant: "warning" },
  COMPLETED: { label: "Selesai", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "destructive" },
} as const;
const filterStatuses = Object.keys(campaignStatuses) as Array<keyof typeof campaignStatuses>;
const ACTIVE_STATUSES: WhatsAppCampaignStatus[] = ["SCHEDULED", "PROCESSING"];

type CampaignSearchParams = Promise<{ active?: string | string[]; edit?: string | string[]; from?: string | string[]; page?: string | string[]; pageSize?: string | string[]; q?: string | string[]; status?: string | string[]; to?: string | string[] }>;
type CampaignTableState = { active: "all" | "active" | "inactive"; from: string; page: number; pageSize: number; query: string; status: keyof typeof campaignStatuses | "all"; to: string };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function campaignHref({ active, from, page, pageSize, query, status, to }: CampaignTableState, edit?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (active !== "all") params.set("active", active);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (pageSize !== DATA_PAGE_SIZE) params.set("pageSize", String(pageSize));
  if (page > 1) params.set("page", String(page));
  if (edit) params.set("edit", edit);
  const search = params.toString();
  return search ? `/campaigns?${search}` : "/campaigns";
}

function parseCampaignDateRange(fromValue: string | string[] | undefined, toValue: string | string[] | undefined) {
  const from = firstParam(fromValue) ?? "";
  const to = firstParam(toValue) ?? "";
  const start = from ? parseJakartaDateTime(`${from}T00:00`) : null;
  const endStart = to ? parseJakartaDateTime(`${to}T00:00`) : null;
  if ((from && !start) || (to && !endStart) || (start && endStart && start > endStart)) return { from: "", to: "", start: null, end: null };
  return { from, to, start, end: endStart ? new Date(endStart.getTime() + 24 * 60 * 60 * 1000) : null };
}

function CampaignFilterSheet({ state, activeFilterCount }: { state: CampaignTableState; activeFilterCount: number }) {
  return <Sheet>
    <SheetTrigger render={<Button variant="outline" className="w-full justify-between sm:w-auto" aria-label="Buka filter campaign" />}>
      <span className="inline-flex items-center gap-1.5"><ListFilter data-icon="inline-start" aria-hidden="true" />Filter</span>
      {activeFilterCount ? <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-medium text-primary-foreground">{activeFilterCount}</span> : null}
    </SheetTrigger>
    <SheetContent side="right" className="w-[min(24rem,calc(100%-1rem))] gap-0 p-0">
      <form action="/campaigns" method="get" className="flex min-h-0 flex-1 flex-col">
        <SheetHeader><SheetTitle>Filter campaign</SheetTitle><SheetDescription>{activeFilterCount ? `${activeFilterCount} filter aktif` : "Tampilkan semua campaign"}</SheetDescription></SheetHeader>
        <Separator />
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {state.query ? <input type="hidden" name="q" value={state.query} /> : null}
          {state.pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={state.pageSize} /> : null}
          <FieldGroup className="gap-5">
            <Field className="gap-1.5"><FieldLabel htmlFor="campaign-filter-status">Status</FieldLabel><NativeSelect id="campaign-filter-status" name="status" defaultValue={state.status} className="w-full"><NativeSelectOption value="all">Semua status</NativeSelectOption>{filterStatuses.map((item) => <NativeSelectOption key={item} value={item}>{campaignStatuses[item].label}</NativeSelectOption>)}</NativeSelect></Field>
            <Field className="gap-1.5"><FieldLabel htmlFor="campaign-filter-active">Aktivasi</FieldLabel><NativeSelect id="campaign-filter-active" name="active" defaultValue={state.active} className="w-full"><NativeSelectOption value="all">Semua campaign</NativeSelectOption><NativeSelectOption value="active">Aktif</NativeSelectOption><NativeSelectOption value="inactive">Tidak aktif</NativeSelectOption></NativeSelect></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field className="gap-1.5"><FieldLabel htmlFor="campaign-filter-from">Mulai dari</FieldLabel><Input id="campaign-filter-from" name="from" type="date" defaultValue={state.from} /></Field><Field className="gap-1.5"><FieldLabel htmlFor="campaign-filter-to">Sampai</FieldLabel><Input id="campaign-filter-to" name="to" type="date" defaultValue={state.to} /></Field></div>
          </FieldGroup>
        </div>
        <Separator />
        <SheetFooter className="sm:grid sm:grid-cols-2"><Button variant="secondary" render={<Link href="/campaigns" />} nativeButton={false}>Reset</Button><Button type="submit">Terapkan</Button></SheetFooter>
      </form>
    </SheetContent>
  </Sheet>;
}

function CampaignForm({ canSendTest, edit, cancelHref }: { canSendTest: boolean; edit: { id: string; name: string; body: string; scheduledAt: Date; version: number } | undefined; cancelHref: string }) {
  return <Card className="self-start xl:sticky xl:top-6"><CardHeader><CardTitle>{edit ? "Edit campaign" : "Campaign baru"}</CardTitle></CardHeader><CardContent><form action={edit ? updateCampaignAction : createCampaignAction}>
    {edit ? <><input type="hidden" name="campaignId" value={edit.id} /><input type="hidden" name="version" value={edit.version} /></> : null}
    <FieldGroup>
      <Field><FieldLabel htmlFor="campaign-name">Nama campaign</FieldLabel><Input id="campaign-name" name="name" required minLength={2} maxLength={120} defaultValue={edit?.name ?? ""} /></Field>
      <Field><FieldLabel htmlFor="campaign-scheduled">Mulai kirim (WIB)</FieldLabel><Input id="campaign-scheduled" name="scheduledAt" type="datetime-local" required defaultValue={edit ? jakartaDateTimeInput(edit.scheduledAt) : ""} /></Field>
      <Field><FieldLabel htmlFor="campaign-body">Pesan WhatsApp</FieldLabel><Textarea id="campaign-body" name="body" required maxLength={4000} rows={7} defaultValue={edit?.body ?? ""} /><FieldDescription>Variabel: {CAMPAIGN_VARIABLES.map((name) => `{{${name}}}`).join(", ")}</FieldDescription></Field>
      {canSendTest ? <Field><FieldLabel htmlFor="campaign-test-phone">Nomor WhatsApp test</FieldLabel><Input id="campaign-test-phone" name="phoneNumber" inputMode="tel" maxLength={32} /><FieldDescription>Pesan dikirim hanya ke nomor ini memakai data contoh.</FieldDescription></Field> : null}
      <div className="flex justify-end gap-2">{edit ? <Button variant="outline" render={<Link href={cancelHref} />} nativeButton={false}>Batal edit</Button> : null}{canSendTest ? <SubmitButton formAction={sendCampaignTestAction} formNoValidate variant="outline" pendingLabel="Menjadwalkan test...">Kirim test</SubmitButton> : null}<SubmitButton>{edit ? "Simpan perubahan" : "Jadwalkan campaign"}</SubmitButton></div>
    </FieldGroup>
  </form></CardContent></Card>;
}

async function CampaignsContent({ searchParams }: { searchParams: CampaignSearchParams }) {
  const params = await searchParams;
  const query = (firstParam(params.q) ?? "").trim().slice(0, 80);
  const rawStatus = firstParam(params.status);
  const status = filterStatuses.find((item) => item === rawStatus) ?? "all";
  const rawActive = firstParam(params.active);
  const active = rawActive === "active" || rawActive === "inactive" ? rawActive : "all";
  const range = parseCampaignDateRange(params.from, params.to);
  const state = { query, status, active, from: range.from, to: range.to, page: parsePageParam(params.page), pageSize: parsePageSizeParam(params.pageSize) } satisfies CampaignTableState;
  const actor = await requireActor(CRM_OPERATOR_ROLES);
  const prisma = getPrismaClient();
  const filters: Prisma.WhatsAppCampaignWhereInput[] = [];
  if (query) filters.push({ name: { contains: query, mode: "insensitive" } });
  if (status !== "all") filters.push({ status });
  if (active === "active") filters.push({ status: { in: ACTIVE_STATUSES } });
  if (active === "inactive") filters.push({ status: { notIn: ACTIVE_STATUSES } });
  if (range.start || range.end) filters.push({ scheduledAt: { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lt: range.end } : {}) } });
  const where = { AND: filters } satisfies Prisma.WhatsAppCampaignWhereInput;
  const [campaigns, total] = await Promise.all([
    prisma.whatsAppCampaign.findMany({ where, select: { id: true, name: true, body: true, scheduledAt: true, status: true, version: true, startedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (state.page - 1) * state.pageSize, take: state.pageSize }),
    prisma.whatsAppCampaign.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > pageCount) redirect(campaignHref({ ...state, page: pageCount }));
  const counts = campaigns.length ? await prisma.whatsAppAutomationJob.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } }, _count: { _all: true } }) : [];
  const countByCampaign = new Map<string, Record<string, number>>();
  for (const item of counts) {
    if (!item.campaignId) continue;
    const current = countByCampaign.get(item.campaignId) ?? {};
    current[item.status] = item._count._all;
    countByCampaign.set(item.campaignId, current);
  }
  const edit = campaigns.find((campaign) => campaign.id === firstParam(params.edit) && (campaign.status === "SCHEDULED" || campaign.status === "PAUSED"));
  const persistentParams = { q: query || undefined, status: status === "all" ? undefined : status, active: active === "all" ? undefined : active, from: range.from || undefined, to: range.to || undefined, pageSize: state.pageSize !== DATA_PAGE_SIZE ? String(state.pageSize) : undefined };
  const activeFilterCount = Number(status !== "all") + Number(active !== "all") + Number(Boolean(range.start || range.end));

  return <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Daftar campaign">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center"><DebouncedSearchInput key={query} initialValue={query} pathname="/campaigns" params={persistentParams} placeholder="Cari nama campaign..." ariaLabel="Cari campaign" className="w-full lg:max-w-xl" /><div className="flex items-center justify-between gap-3 lg:ml-auto lg:justify-end"><p className="shrink-0 text-xs text-muted-foreground"><strong className="font-medium text-foreground">{total}</strong> campaign tercatat</p><CampaignFilterSheet state={state} activeFilterCount={activeFilterCount} /></div></div>
      {campaigns.length ? <div className="flex min-h-112 flex-1 flex-col"><Table className="min-w-5xl" containerClassName="min-h-0 flex-1 overflow-auto"><TableHeader className="sticky top-0 bg-muted"><TableRow className="hover:bg-muted"><TableHead className="w-16 text-center">No</TableHead><TableHead className="min-w-48">Campaign</TableHead><TableHead className="min-w-44">Mulai (WIB)</TableHead><TableHead>Status</TableHead><TableHead className="min-w-56">Pengiriman</TableHead><TableHead className="w-24 text-right">Aktif</TableHead><TableHead className="w-44 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>
        {campaigns.map((campaign, index) => {
          const count = countByCampaign.get(campaign.id) ?? {};
          const sent = count.COMPLETED ?? 0;
          const failed = count.FAILED ?? 0;
          const pending = (count.QUEUED ?? 0) + (count.RETRY ?? 0) + (count.PROCESSING ?? 0);
          const status = campaignStatuses[campaign.status];
          return <TableRow key={campaign.id}><TableCell className="text-center font-mono text-muted-foreground tabular-nums">{(state.page - 1) * state.pageSize + index + 1}</TableCell><TableCell className="max-w-48 font-medium whitespace-normal break-words">{campaign.name}</TableCell><TableCell>{campaign.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</TableCell><TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{sent} terkirim, {failed} gagal, {pending} tertunda{campaign.startedAt && campaign.startedAt > campaign.scheduledAt ? ", mulai terlambat" : ""}</TableCell><TableCell><CampaignEnabledSwitch campaignId={campaign.id} version={campaign.version} status={campaign.status} /></TableCell><TableCell><div className="flex justify-end gap-2">{campaign.status === "SCHEDULED" || campaign.status === "PAUSED" ? <Button size="sm" variant="outline" render={<Link href={campaignHref(state, campaign.id)} />} nativeButton={false}>Edit</Button> : null}<form action={deleteCampaignAction}><input type="hidden" name="campaignId" value={campaign.id} /><input type="hidden" name="version" value={campaign.version} /><ConfirmSubmitButton size="sm" variant="destructive" confirmTitle="Hapus campaign?" confirmDescription="Campaign akan dihapus dari daftar. Pengiriman yang belum mulai dihentikan, sedangkan pesan yang sudah dikirim tetap tersimpan." confirmLabel="Ya, hapus campaign" pendingLabel="Menghapus...">Hapus</ConfirmSubmitButton></form></div></TableCell></TableRow>;
        })}
      </TableBody></Table></div> : <Empty className="min-h-112 border-0"><EmptyHeader><EmptyMedia variant="icon"><Search aria-hidden="true" /></EmptyMedia><EmptyTitle>{query ? "Campaign tidak ditemukan" : "Belum ada campaign"}</EmptyTitle><EmptyDescription>{query ? "Coba kata kunci lain atau hapus pencarian." : "Tambahkan campaign pertama melalui formulir di samping."}</EmptyDescription></EmptyHeader></Empty>}
      <DataPagination pathname="/campaigns" page={state.page} pageCount={pageCount} total={total} pageSize={state.pageSize} params={persistentParams} pageSizeOptions={DATA_PAGE_SIZES} className="border-t px-4 py-3" />
    </section>
    <CampaignForm canSendTest={actor.role === "DEVELOPER"} edit={edit} cancelHref={campaignHref(state)} />
  </div>;
}

export default function CampaignsPage({ searchParams }: { searchParams: CampaignSearchParams }) {
  return <main className="flex min-w-0 flex-col gap-6"><PageHeader title="Campaign promo" description="Jadwalkan penawaran WhatsApp untuk seluruh customer dan prospek." /><PageMessage /><CampaignsContent searchParams={searchParams} /></main>;
}
