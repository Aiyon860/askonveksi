import Link from "next/link";
import { ArrowRight, History } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { auditActionLabel, auditFieldLabel } from "@/lib/audit/labels";
import { DOCUMENT_HISTORY_PAGE_SIZE, type OpportunityDocumentHistoryItem, type OpportunityDocumentOption } from "@/lib/crm/data";
import { formatDate } from "@/lib/crm/format";

function ChangeList({ item }: { item: OpportunityDocumentHistoryItem }) {
  if (!item.diff.length) {
    // Entri lama belum menyimpan nilai sebelum→sesudah; tampilkan nama field saja.
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Field berubah: {item.changedFields.length ? item.changedFields.map(auditFieldLabel).join(", ") : "-"}
      </p>
    );
  }

  return (
    <dl className="mt-2 grid gap-1.5">
      {item.diff.map((change) => (
        <div
          key={change.field}
          className="grid gap-1 rounded-sm bg-muted px-2 py-1.5 text-xs sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-baseline"
        >
          <dt className="font-medium">{change.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5 wrap-break-word">
            <span className="text-muted-foreground">{change.from ?? "—"}</span>
            <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
            <span>{change.to ?? "—"}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Riwayat revisi PO & Invoice pada tab peluang. Menggantikan riwayat komunikasi:
 * setiap entri audit dokumen menampilkan field yang berubah beserta nilai
 * sebelum→sesudah (entri lama hanya nama field).
 */
export function DocumentRevisionHistory({
  items,
  total,
  page,
  pageCount,
  documents,
  documentId,
  pathname,
}: {
  items: OpportunityDocumentHistoryItem[];
  total: number;
  page: number;
  pageCount: number;
  documents: OpportunityDocumentOption[];
  documentId: string | null;
  pathname: string;
}) {
  const filterHref = (id?: string) => {
    const params = new URLSearchParams({ tab: "aktivitas" });
    if (id) params.set("document", id);
    return `${pathname}?${params.toString()}#document-history`;
  };

  return (
    <Card id="document-history">
      <CardHeader>
        <CardTitle>Riwayat PO &amp; Invoice</CardTitle>
        <CardDescription>
          Perubahan dokumen terbaru tampil lebih dahulu, lengkap dengan nilai sebelum dan sesudah.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {documents.length > 1 ? (
          <div className="flex flex-wrap gap-2" aria-label="Saring riwayat menurut dokumen">
            <Button
              size="sm"
              variant={documentId ? "outline" : "secondary"}
              render={<Link href={filterHref()} />}
              nativeButton={false}
            >
              Semua dokumen
            </Button>
            {documents.map((document) => (
              <Button
                key={document.id}
                size="sm"
                variant={documentId === document.id ? "secondary" : "outline"}
                render={<Link href={filterHref(document.id)} />}
                nativeButton={false}
              >
                {document.label}
              </Button>
            ))}
          </div>
        ) : null}

        {items.length ? (
          <ol className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="min-w-0 rounded-md border bg-card p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant={item.documentKind === "PO" ? "secondary" : "outline"}>
                      {item.documentKind === "PO" ? "PO" : "Invoice"}
                    </Badge>
                    <span className="text-sm font-medium">{auditActionLabel(item.action)}</span>
                  </div>
                  <time dateTime={item.occurredAt.toISOString()} className="text-xs text-muted-foreground">
                    {formatDate(item.occurredAt, true)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.documentLabel} · oleh {item.actor.name}
                </p>
                <ChangeList item={item} />
              </li>
            ))}
          </ol>
        ) : (
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><History aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{documents.length ? "Belum ada perubahan tercatat" : "Belum ada dokumen PO atau invoice"}</EmptyTitle>
              <EmptyDescription>
                {documents.length
                  ? "Riwayat akan terisi otomatis setiap kali draft, revisi, atau status dokumen berubah."
                  : "Riwayat revisi muncul setelah draft PO atau invoice pertama dibuat pada peluang ini."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <DataPagination
          pathname={pathname}
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={DOCUMENT_HISTORY_PAGE_SIZE}
          params={{ tab: "aktivitas", document: documentId ?? undefined }}
          pageParam="historyPage"
          anchor="document-history"
        />
      </CardContent>
    </Card>
  );
}
