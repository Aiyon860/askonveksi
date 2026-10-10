import Link from "next/link";
import { History, RotateCcw } from "lucide-react";

import { restoreExpenseAction } from "@/app/actions/finance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { getDeletedExpenses } from "@/lib/finance/expense";
import { DATA_PAGE_SIZE, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SearchParams = Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function DeletedExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = parsePageParam(first(params.page));
  const pageSize = parsePageSizeParam(first(params.pageSize));
  const data = await getDeletedExpenses(page, pageSize);
  const persistent = { pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize) };

  return (
    <>
      <PageHeader
        title="Riwayat Hapus Pengeluaran"
        description="Data yang dihapus (status terhapus) tidak muncul di pencarian dan tabel utama. Tercatat siapa yang menghapus dan kapan."
        action={
          <Button variant="outline" render={<Link href="/keuangan/pengeluaran" />} nativeButton={false}>
            Kembali ke Pengeluaran
          </Button>
        }
      />
      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
        {data.items.length ? (
          <div className="flex min-h-112 flex-1 flex-col">
            <Table className="min-w-6xl" containerClassName="min-h-0 flex-1 overflow-auto">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow className="hover:bg-muted">
                  <TableHead>Keperluan</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tanggal pakai</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                  <TableHead>Dihapus oleh</TableHead>
                  <TableHead>Dihapus pada</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.purpose}</TableCell>
                    <TableCell>{item.customerName ?? "-"}</TableCell>
                    <TableCell>{EXPENSE_CATEGORY_LABEL[item.category]}</TableCell>
                    <TableCell>{formatDate(item.spentAt)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>{item.createdBy.name}</TableCell>
                    <TableCell>{item.deletedBy?.name ?? "-"}</TableCell>
                    <TableCell>{item.deletedAt ? formatDate(item.deletedAt, true) : "-"}</TableCell>
                    <TableCell>{item.deleteReason ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <form action={restoreExpenseAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          pendingLabel="Memulihkan..."
                          confirmTitle="Kembalikan pengeluaran?"
                          confirmDescription="Data akan muncul kembali di tabel utama dan pencarian."
                          confirmLabel="Ya, kembalikan"
                        >
                          <RotateCcw data-icon="inline-start" aria-hidden="true" />
                          Kembalikan
                        </ConfirmSubmitButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination pathname="/keuangan/pengeluaran/riwayat" page={page} pageCount={data.pageCount} total={data.total} pageSize={pageSize} params={persistent} className="border-t px-4 py-3" />
          </div>
        ) : (
          <Empty className="p-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Belum ada data terhapus</EmptyTitle>
              <EmptyDescription>Pengeluaran yang dihapus akan tercatat di sini beserta siapa yang menghapus.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </>
  );
}
