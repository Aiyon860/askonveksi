import Link from "next/link";
import { History } from "lucide-react";

import { AuditEventDetailDialog } from "@/components/audit-event-detail";
import { DataPagination } from "@/components/data-pagination";
import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditEventPage, getAuditLogFilterOptions } from "@/lib/audit/data";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit/labels";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { formatDate } from "@/lib/crm/format";
import { parseOpenDateRange } from "@/lib/crm/document-list-filters";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ q?: string | string[]; from?: string | string[]; to?: string | string[]; actor?: string | string[]; entity?: string | string[]; page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function changedFieldsSummary(fields: string[]) {
  if (!fields.length) return "-";
  if (fields.length <= 5) return fields.join(", ");
  return `${fields.slice(0, 5).join(", ")} +${fields.length - 5} lagi`;
}

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const range = parseOpenDateRange(first(params.from), first(params.to));
  const options = await getAuditLogFilterOptions();
  const rawActor = first(params.actor);
  const actorId = options.actors.some((actor) => actor.id === rawActor) ? rawActor as string : "all";
  const rawEntity = first(params.entity);
  const entityType = options.entityTypes.includes(rawEntity ?? "") ? rawEntity as string : "all";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);
  const data = await getAuditEventPage({ query, from: range.start, to: range.end, actorId, entityType, page, pageSize });
  const persistent = {
    q: query || undefined,
    from: range.from || undefined,
    to: range.to || undefined,
    actor: actorId === "all" ? undefined : actorId,
    entity: entityType === "all" ? undefined : entityType,
    pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize),
  };

  return (
    <>
      <PageHeader
        title="Log aktivitas"
        description="Jejak semua aksi user di alur order dan pengaturan — dari peluang, PO, invoice, produksi, keuangan, sampai perubahan data master. Catatan ini hanya bisa dilihat Owner, Keuangan, dan Developer."
      />
      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <DebouncedSearchInput key={query} initialValue={query} pathname="/log-aktivitas" params={persistent} placeholder="Cari pelaku / jenis aksi / entitas..." ariaLabel="Cari log aktivitas" className="lg:max-w-md" />
          <form action="/log-aktivitas" className="flex flex-wrap items-end gap-2 lg:justify-end">
            {query ? <input type="hidden" name="q" value={query} /> : null}
            {pageSize !== DATA_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
            <Field className="w-full sm:w-40"><FieldLabel htmlFor="audit-from">Dari tanggal</FieldLabel><Input id="audit-from" name="from" type="date" defaultValue={range.from} /></Field>
            <Field className="w-full sm:w-40"><FieldLabel htmlFor="audit-to">Sampai tanggal</FieldLabel><Input id="audit-to" name="to" type="date" defaultValue={range.to} /></Field>
            <Field className="w-full sm:w-44"><FieldLabel htmlFor="audit-actor">Pelaku</FieldLabel><NativeSelect id="audit-actor" name="actor" defaultValue={actorId} className="w-full"><NativeSelectOption value="all">Semua pelaku</NativeSelectOption>{options.actors.map((actor) => <NativeSelectOption key={actor.id} value={actor.id}>{actor.name}</NativeSelectOption>)}</NativeSelect></Field>
            <Field className="w-full sm:w-44"><FieldLabel htmlFor="audit-entity">Jenis entitas</FieldLabel><NativeSelect id="audit-entity" name="entity" defaultValue={entityType} className="w-full"><NativeSelectOption value="all">Semua entitas</NativeSelectOption>{options.entityTypes.map((value) => <NativeSelectOption key={value} value={value}>{auditEntityLabel(value)}</NativeSelectOption>)}</NativeSelect></Field>
            <Button type="submit" variant="outline">Terapkan</Button>
            <Button variant="secondary" render={<Link href="/log-aktivitas" />} nativeButton={false}>Reset</Button>
          </form>
        </div>
        {data.items.length ? (
          <div className="flex min-h-112 flex-1 flex-col">
            <Table className="min-w-6xl" containerClassName="min-h-0 flex-1 overflow-auto">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow className="hover:bg-muted">
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pelaku</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead>Field berubah</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(item.createdAt, true)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{item.actor.name}</span>
                      <span className="block text-xs text-muted-foreground">{ROLE_LABEL[item.actor.role]}</span>
                    </TableCell>
                    <TableCell>{auditActionLabel(item.action)}</TableCell>
                    <TableCell>{auditEntityLabel(item.entityType)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{changedFieldsSummary(item.changedFields)}</TableCell>
                    <TableCell className="text-right"><AuditEventDetailDialog event={item} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination pathname="/log-aktivitas" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} pageSizeOptions={DATA_PAGE_SIZES} params={persistent} className="border-t px-4 py-3" />
          </div>
        ) : (
          <Empty className="p-12">
            <EmptyHeader>
              <EmptyMedia variant="icon"><History aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>Belum ada aktivitas</EmptyTitle>
              <EmptyDescription>Setiap aksi user tercatat otomatis di sini. Coba ubah filter tanggal, pelaku, atau jenis entitas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </>
  );
}
