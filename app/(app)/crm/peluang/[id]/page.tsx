import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck2, FileDown, ImageIcon, NotebookPen } from "lucide-react";

import {
  acceptQuotationAndDealAction,
  addNoteAction,
  createQuotationRevisionAction,
  issueQuotationAction,
  updateOpportunityAction,
} from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { OpportunityStageForm } from "@/components/crm/opportunity-stage-form";
import { QuotationForm } from "@/components/crm/quotation-form";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { OpportunityStatusBadge, QuotationStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getOpportunityDetail } from "@/lib/crm/data";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await getOpportunityDetail(id);
  if (!opportunity) notFound();
  const draft = opportunity.quotations.find((quotation) => quotation.status === "DRAFT");

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/crm" />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Kembali ke pipeline
      </Button>
      <PageHeader
        title={opportunity.title}
        description={`${opportunity.opportunityNo} · ${opportunity.customer.name} · Diperbarui ${formatDate(opportunity.updatedAt, true)}`}
        action={<OpportunityStatusBadge stage={opportunity.stage} />}
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Penawaran</CardTitle>
              <CardDescription>Draft dapat diedit. Setelah terbit, perubahan harga dibuat sebagai revisi baru.</CardDescription>
            </CardHeader>
            <CardContent>
              {opportunity.quotations.length ? (
                <div className="flex flex-col gap-6">
                  {opportunity.quotations.map((quotation) => (
                    <section key={quotation.id} aria-labelledby={`quotation-${quotation.id}`} className="rounded-lg border border-info/20 bg-info/5 p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 id={`quotation-${quotation.id}`} className="font-medium">{quotation.quotationNo} · Revisi {quotation.revision}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Dibuat {formatDate(quotation.createdAt, true)}</p>
                        </div>
                        <QuotationStatusBadge status={quotation.status} />
                      </div>

                      {quotation.status === "DRAFT" ? (
                        <QuotationForm
                          opportunityId={opportunity.id}
                          draft={{
                            id: quotation.id,
                            version: quotation.version,
                            discountType: quotation.discountType,
                            discountValue: quotation.discountValue.toString(),
                            items: quotation.items.map((item) => ({
                              description: item.description,
                              quantity: item.quantity,
                              unitPrice: item.unitPrice.toString(),
                            })),
                          }}
                        />
                      ) : (
                        <QuotationSnapshot quotation={quotation} />
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" render={<Link href={`/api/crm/quotation/${quotation.id}/pdf`} />} nativeButton={false}>
                          <FileDown data-icon="inline-start" aria-hidden="true" />
                          Unduh PDF
                        </Button>
                        {quotation.status === "DRAFT" ? (
                          <form action={issueQuotationAction}>
                            <input type="hidden" name="quotationId" value={quotation.id} />
                            <input type="hidden" name="version" value={quotation.version} />
                            <ConfirmSubmitButton
                              pendingLabel="Menerbitkan..."
                              confirmTitle="Terbitkan dan kunci quotation?"
                              confirmDescription="Draft tidak dapat diedit lagi setelah diterbitkan. Perubahan berikutnya harus dibuat sebagai revisi baru."
                              confirmLabel="Ya, terbitkan"
                            >
                              Terbitkan &amp; kunci
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                        {(quotation.status === "ISSUED" || quotation.status === "ACCEPTED") && opportunity.stage === "PENAWARAN" ? (
                          <form action={createQuotationRevisionAction}>
                            <input type="hidden" name="quotationId" value={quotation.id} />
                            <ConfirmSubmitButton
                              variant="outline"
                              pendingLabel="Membuat revisi..."
                              confirmTitle="Buat revisi quotation?"
                              confirmDescription="Quotation terbit ini akan digantikan dan draft revisi baru akan dibuat dari snapshot yang sama."
                              confirmLabel="Ya, buat revisi"
                            >
                              Buat revisi
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                        {quotation.salesOrder ? (
                          <Button variant="outline" render={<Link href={`/sales-orders/${quotation.salesOrder.id}`} />} nativeButton={false}>
                            Lihat {quotation.salesOrder.salesOrderNo}
                          </Button>
                        ) : null}
                      </div>

                      {quotation.status === "ISSUED" ? (
                        <form action={acceptQuotationAndDealAction} className="mt-4 rounded-lg border border-success/20 bg-success/5 p-4">
                          <input type="hidden" name="quotationId" value={quotation.id} />
                          <input type="hidden" name="version" value={quotation.version} />
                          <FieldGroup>
                            <div>
                              <p className="text-sm font-medium">Diterima &amp; Deal</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">Catat bukti persetujuan dari WhatsApp/Instagram. Aksi ini membuat Sales Order immutable.</p>
                            </div>
                            <Field>
                              <FieldLabel htmlFor={`acceptedAt-${quotation.id}`} required>Waktu diterima</FieldLabel>
                              <Input id={`acceptedAt-${quotation.id}`} name="acceptedAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(new Date())} />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`acceptanceReference-${quotation.id}`} required>Referensi / catatan persetujuan</FieldLabel>
                              <Textarea id={`acceptanceReference-${quotation.id}`} name="acceptanceReference" required minLength={3} maxLength={2000} rows={3} placeholder="Contoh: Disetujui Ibu Rina via WA, 27 Agustus 14:20" />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`acceptanceProof-${quotation.id}`}>Bukti gambar persetujuan</FieldLabel>
                              <Input id={`acceptanceProof-${quotation.id}`} name="acceptanceProof" type="file" accept="image/jpeg,image/png,image/webp" />
                              <p className="text-xs leading-5 text-muted-foreground">Opsional. Unggah screenshot chat JPG, PNG, atau WebP maksimal 5 MB.</p>
                            </Field>
                            <ConfirmSubmitButton
                              pendingLabel="Membentuk Sales Order..."
                              confirmTitle="Terima quotation dan buat Sales Order?"
                              confirmDescription="Quotation akan dikunci sebagai Diterima, peluang menjadi Deal, dan Sales Order immutable akan dibuat."
                              confirmLabel="Ya, terima dan buat Sales Order"
                            >
                              <FileCheck2 data-icon="inline-start" aria-hidden="true" />
                              Diterima &amp; Deal
                            </ConfirmSubmitButton>
                          </FieldGroup>
                        </form>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : opportunity.stage === "PENAWARAN" ? (
                <QuotationForm opportunityId={opportunity.id} />
              ) : (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><FileCheck2 aria-hidden="true" /></EmptyMedia>
                    <EmptyTitle>Belum ada quotation</EmptyTitle>
                    <EmptyDescription>Pindahkan peluang ke Penawaran untuk mulai menyusun harga.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {opportunity.stage === "PENAWARAN" && opportunity.quotations.length > 0 && !draft ? (
                <p className="mt-4 text-xs text-muted-foreground">Gunakan “Buat revisi” pada quotation terbit/diterima untuk melanjutkan negosiasi.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catatan sales</CardTitle>
              <CardDescription>Catatan bersifat append-only agar jejak komunikasi tetap dapat diaudit.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addNoteAction}>
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="content" required>Catatan baru</FieldLabel>
                    <Textarea id="content" name="content" required minLength={2} maxLength={4000} rows={4} placeholder="Ringkas hasil komunikasi dan langkah berikutnya." />
                  </Field>
                  <SubmitButton variant="secondary" pendingLabel="Menambahkan...">
                    <NotebookPen data-icon="inline-start" aria-hidden="true" />
                    Tambah catatan
                  </SubmitButton>
                </FieldGroup>
              </form>
              <div className="mt-6 flex flex-col gap-3">
                {opportunity.notes.length ? opportunity.notes.map((note) => (
                  <article key={note.id} className="rounded-lg border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6">{note.content}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{note.author.name} · {formatDate(note.createdAt, true)}</p>
                  </article>
                )) : <p className="text-sm text-muted-foreground">Belum ada catatan.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/6 p-3 sm:p-4">
          <Card>
            <CardHeader>
              <CardTitle>Status pipeline</CardTitle>
              <CardDescription>Tentukan langkah kerja berikutnya.</CardDescription>
            </CardHeader>
            <CardContent>
              <OpportunityStageForm
                opportunityId={opportunity.id}
                version={opportunity.version}
                initialStage={opportunity.stage}
                followUpAt={opportunity.followUpAt}
                cancelReason={opportunity.cancelReason}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail peluang</CardTitle>
              <CardDescription>Estimasi operasional sebelum quotation final.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateOpportunityAction}>
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <input type="hidden" name="version" value={opportunity.version} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title" required>Judul</FieldLabel>
                    <Input id="title" name="title" required minLength={3} maxLength={180} defaultValue={opportunity.title} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="estimatedQuantity">Estimasi jumlah</FieldLabel>
                    <Input id="estimatedQuantity" name="estimatedQuantity" type="number" min={1} step={1} defaultValue={opportunity.estimatedQuantity ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="estimatedValue">Estimasi nilai</FieldLabel>
                    <Input id="estimatedValue" name="estimatedValue" type="number" min={0} step={1} defaultValue={opportunity.estimatedValue?.toString() ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="deadline">Deadline</FieldLabel>
                    <Input id="deadline" name="deadline" type="date" defaultValue={opportunity.deadline?.toISOString().slice(0, 10) ?? ""} />
                  </Field>
                  <SubmitButton variant="outline" pendingLabel="Memperbarui...">Simpan detail</SubmitButton>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{opportunity.customer.customerNo}</CardDescription>
              <CardAction>
                <Button variant="link" size="sm" render={<Link href={`/crm/pelanggan/${opportunity.customer.id}`} />} nativeButton={false}>Buka profil</Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{opportunity.customer.name}</p>
              {opportunity.customer.companyName ? <p className="text-sm text-muted-foreground">{opportunity.customer.companyName}</p> : null}
              <dl className="grid gap-2 text-sm text-muted-foreground">
                <div><dt className="sr-only">WhatsApp</dt><dd>{opportunity.customer.whatsapp ?? "-"}</dd></div>
                <div><dt className="sr-only">Email</dt><dd>{opportunity.customer.email ?? "-"}</dd></div>
                <div><dt className="sr-only">Instagram</dt><dd>{opportunity.customer.instagram ? `@${opportunity.customer.instagram}` : "-"}</dd></div>
              </dl>
            </CardContent>
          </Card>

          {opportunity.salesOrders.length ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Sales Order</CardTitle>
                <CardDescription>Riwayat output Deal.</CardDescription>
              </CardHeader>
              <CardContent>
                {opportunity.salesOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <Link href={`/sales-orders/${order.id}`} className="font-mono text-sm underline-offset-4 hover:underline">{order.salesOrderNo}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(order.total)}</p>
                    </div>
                    <SalesOrderStatusBadge status={order.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function QuotationSnapshot({ quotation }: { quotation: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>["quotations"][number] }) {
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {quotation.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(item.subtotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(quotation.subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{quotation.discountType === "PERCENTAGE" ? `${quotation.discountValue.toString()}%` : formatCurrency(quotation.discountValue)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-info/20 pt-2 font-medium text-info"><dt>Total</dt><dd className="font-mono">{formatCurrency(quotation.total)}</dd></div>
      </dl>
      {quotation.acceptedAt ? (
        <div className="rounded-md bg-success/10 p-3 text-sm text-success">
          <p className="font-medium">Diterima {formatDate(quotation.acceptedAt, true)}</p>
          <p className="mt-1 whitespace-pre-wrap">{quotation.acceptanceReference}</p>
          {quotation.acceptanceProofPath ? (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              render={<Link href={`/api/crm/quotation/${quotation.id}/acceptance-proof`} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ImageIcon data-icon="inline-start" aria-hidden="true" />
              Lihat bukti gambar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
