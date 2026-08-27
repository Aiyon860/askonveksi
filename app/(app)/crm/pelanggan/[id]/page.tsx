import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, ExternalLink } from "lucide-react";

import { archiveCustomerAction, createOpportunityAction, updateCustomerAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentActor } from "@/lib/auth/session";
import { getCustomerDetail } from "@/lib/crm/data";
import { formatCurrency, formatDate } from "@/lib/crm/format";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, actor] = await Promise.all([getCustomerDetail(id), getCurrentActor()]);
  if (!customer || !actor) notFound();
  const canArchive = (actor.role === "OWNER" || actor.role === "ADMIN") && !customer.archivedAt;

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/crm/pelanggan" />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Semua customer
      </Button>
      <PageHeader
        title={customer.name}
        description={`${customer.customerNo}${customer.companyName ? ` · ${customer.companyName}` : ""}${customer.archivedAt ? " · Diarsipkan" : ""}`}
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Peluang dan riwayat order</CardTitle>
              <CardDescription>Semua repeat order tetap memakai profil customer ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {customer.opportunities.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peluang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.opportunities.map((opportunity) => {
                      const latestOrder = opportunity.salesOrders[0];
                      return (
                        <TableRow key={opportunity.id}>
                          <TableCell>
                            <Link href={`/crm/peluang/${opportunity.id}`} className="font-medium underline-offset-4 hover:underline">{opportunity.title}</Link>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</p>
                          </TableCell>
                          <TableCell><OpportunityStatusBadge stage={opportunity.stage} /></TableCell>
                          <TableCell>
                            {latestOrder ? (
                              <Link href={`/sales-orders/${latestOrder.id}`} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                                {latestOrder.salesOrderNo}<ExternalLink aria-hidden="true" className="size-3.5" />
                              </Link>
                            ) : "—"}
                            {latestOrder ? <div className="mt-1"><SalesOrderStatusBadge status={latestOrder.status} /></div> : null}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(latestOrder?.total ?? opportunity.estimatedValue)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada peluang</EmptyTitle>
                    <EmptyDescription>Buat peluang pertama dari formulir di samping.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data customer</CardTitle>
              <CardDescription>Kontak ini disalin sebagai snapshot ketika quotation diterbitkan.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateCustomerAction}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="version" value={customer.version} />
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="name" required>Nama customer</FieldLabel>
                      <Input id="name" name="name" required minLength={2} maxLength={160} defaultValue={customer.name} disabled={Boolean(customer.archivedAt)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="companyName">Perusahaan</FieldLabel>
                      <Input id="companyName" name="companyName" maxLength={160} defaultValue={customer.companyName ?? ""} disabled={Boolean(customer.archivedAt)} />
                    </Field>
                  </div>
                  <FieldSet disabled={Boolean(customer.archivedAt)}>
                    <FieldLegend variant="label" required>Kontak customer</FieldLegend>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
                        <Input id="whatsapp" name="whatsapp" maxLength={32} defaultValue={customer.whatsapp ?? ""} disabled={Boolean(customer.archivedAt)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input id="email" name="email" type="email" maxLength={320} defaultValue={customer.email ?? ""} disabled={Boolean(customer.archivedAt)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="instagram">Instagram</FieldLabel>
                        <Input id="instagram" name="instagram" maxLength={80} defaultValue={customer.instagram ?? ""} disabled={Boolean(customer.archivedAt)} />
                      </Field>
                    </div>
                    <FieldDescription>Minimal satu kontak harus tetap terisi.</FieldDescription>
                  </FieldSet>
                  <Field>
                    <FieldLabel htmlFor="address">Alamat</FieldLabel>
                    <Textarea id="address" name="address" maxLength={2000} rows={4} defaultValue={customer.address ?? ""} disabled={Boolean(customer.archivedAt)} />
                  </Field>
                  {!customer.archivedAt ? <SubmitButton pendingLabel="Memperbarui...">Simpan perubahan</SubmitButton> : null}
                </FieldGroup>
              </form>
            </CardContent>
            <CardFooter className="justify-between border-t text-xs text-muted-foreground">
              <span>Diperbarui {formatDate(customer.updatedAt, true)}</span>
              {canArchive ? (
                <form action={archiveCustomerAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="version" value={customer.version} />
                  <ConfirmSubmitButton
                    variant="destructive"
                    size="sm"
                    pendingLabel="Mengarsipkan..."
                    confirmTitle="Arsipkan customer?"
                    confirmDescription="Customer tidak lagi tersedia untuk peluang baru. Riwayat transaksi tetap tersimpan."
                    confirmLabel="Ya, arsipkan"
                  >
                    <Archive data-icon="inline-start" aria-hidden="true" />
                    Arsipkan
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </CardFooter>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {!customer.archivedAt ? (
            <Card>
              <CardHeader>
                <CardTitle>Repeat order / peluang baru</CardTitle>
                <CardDescription>Lead baru akan langsung terhubung ke customer ini.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createOpportunityAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="title" required>Kebutuhan</FieldLabel>
                      <Input id="title" name="title" required minLength={3} maxLength={180} placeholder="Contoh: Repeat kaos event" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="estimatedQuantity">Estimasi jumlah</FieldLabel>
                      <Input id="estimatedQuantity" name="estimatedQuantity" type="number" min={1} step={1} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="estimatedValue">Estimasi nilai</FieldLabel>
                      <Input id="estimatedValue" name="estimatedValue" type="number" min={0} step={1} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="deadline">Deadline</FieldLabel>
                      <Input id="deadline" name="deadline" type="date" />
                    </Field>
                    <SubmitButton pendingLabel="Membuat peluang...">Buat peluang</SubmitButton>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
              <CardDescription>Profil dibuat {formatDate(customer.createdAt)}</CardDescription>
              <CardAction><span className="font-mono text-xs">{customer.customerNo}</span></CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Peluang</dt><dd className="font-mono">{customer.opportunities.length}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sales Order</dt><dd className="font-mono">{customer.opportunities.reduce((sum, opportunity) => sum + opportunity.salesOrders.length, 0)}</dd></div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
