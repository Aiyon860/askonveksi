import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Search, UsersRound } from "lucide-react";

import { NewCustomerForm } from "@/components/crm/new-customer-form";
import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomers } from "@/lib/crm/data";
import { formatDate } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, parsePageParam } from "@/lib/pagination";

type CustomerSearchParams = Promise<{
  q?: string | string[];
  archived?: string | string[];
  page?: string | string[];
}>;

export default async function CustomersPage({ searchParams }: { searchParams: CustomerSearchParams }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const query = rawQuery.trim().slice(0, 80);
  const archived = (Array.isArray(params.archived) ? params.archived[0] : params.archived) === "true";
  const page = parsePageParam(params.page);
  const { items: customers, total, pageCount } = await getCustomers(query, archived, page);
  if (page > pageCount) {
    const redirectParams = new URLSearchParams();
    if (query) redirectParams.set("q", query);
    if (archived) redirectParams.set("archived", "true");
    if (pageCount > 1) redirectParams.set("page", String(pageCount));
    const redirectQuery = redirectParams.toString();
    redirect(redirectQuery ? `/crm/pelanggan?${redirectQuery}` : "/crm/pelanggan");
  }

  return (
    <>
      <PageHeader
        title="Data customer"
        description="Satu profil customer dapat dipakai untuk banyak peluang dan repeat order tanpa menggandakan identitas."
        action={<NewCustomerForm />}
      />
      <PageMessage />

      <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-end sm:justify-between" aria-label="Filter customer">
        <form className="flex w-full gap-2 sm:max-w-xl" action="/crm/pelanggan">
          {archived ? <input type="hidden" name="archived" value="true" /> : null}
          <Input name="q" type="search" maxLength={80} defaultValue={query} placeholder="Cari nama, nomor, atau kontak..." aria-label="Cari customer" />
          <Button type="submit" variant="secondary">
            <Search data-icon="inline-start" aria-hidden="true" />
            Cari
          </Button>
        </form>
        <Button
          variant="ghost"
          render={<Link href={archived ? "/crm/pelanggan" : "/crm/pelanggan?archived=true"} />}
          nativeButton={false}
        >
          <Archive data-icon="inline-start" aria-hidden="true" />
          {archived ? "Customer aktif" : "Arsip"}
        </Button>
      </section>

      <section className="overflow-hidden rounded-xl border bg-background" aria-label={archived ? "Customer terarsip" : "Customer aktif"}>
        {customers.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead className="text-right">Peluang</TableHead>
                  <TableHead>Aktivitas terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link href={`/crm/pelanggan/${customer.id}`} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {customer.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{customer.customerNo}</span>
                        {customer.companyName ? <span>{customer.companyName}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.whatsapp ?? customer.email ?? (customer.instagram ? `@${customer.instagram}` : "—")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{customer._count.opportunities}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(customer.opportunities[0]?.updatedAt ?? customer.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination
              pathname="/crm/pelanggan"
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={DATA_PAGE_SIZE}
              params={{ q: query || undefined, archived: archived ? "true" : undefined }}
              className="border-t px-4 py-3"
            />
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><UsersRound aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{query ? "Customer tidak ditemukan" : archived ? "Arsip masih kosong" : "Belum ada customer"}</EmptyTitle>
              <EmptyDescription>{query ? "Coba kata kunci lain atau hapus filter pencarian." : "Tambahkan customer atau buat lead baru dari pipeline."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </>
  );
}
