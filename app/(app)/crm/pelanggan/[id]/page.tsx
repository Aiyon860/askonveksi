import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive, ExternalLink } from "lucide-react";

import { archiveCustomerAction, createOpportunityAction, updateCustomerAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
import { CommunicationHistory } from "@/components/crm/communication-history";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { CustomerActivityBadge, OpportunityStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentActor } from "@/lib/auth/session";
import { getCommunicationTimeline, getCustomerDetail } from "@/lib/crm/data";
import { OPEN_STAGES } from "@/lib/crm/constants";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { getRepeatOrderDraft } from "@/lib/crm/reminder-data";
import { activityStatusFromSchedule } from "@/lib/crm/reminder-types";
import { getCustomerFormOptions } from "@/lib/master-data";
import { parsePageParam } from "@/lib/pagination";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historyPage?: string | string[]; repeatFrom?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const historyPage = parsePageParam(query.historyPage);
  const repeatFrom = Array.isArray(query.repeatFrom) ? query.repeatFrom[0] : query.repeatFrom;
  const [customer, actor, formOptions, communicationHistory, repeatDraft] = await Promise.all([
    getCustomerDetail(id),
    getCurrentActor(),
    getCustomerFormOptions(),
    getCommunicationTimeline({ customerId: id, page: historyPage }),
    repeatFrom ? getRepeatOrderDraft(id, repeatFrom) : Promise.resolve(null),
  ]);
  if (!customer || !actor) notFound();
  if (historyPage > communicationHistory.pageCount) redirect(`/crm/pelanggan/${id}?historyPage=${communicationHistory.pageCount}#communication-history`);
  const canArchive = (actor.role === "OWNER" || actor.role === "ADMIN") && !customer.archivedAt;
  const salesOrders = customer.opportunities
    .flatMap((opportunity) =>
      opportunity.salesOrders.map((order) => ({
        ...order,
        opportunity: {
          id: opportunity.id,
          opportunityNo: opportunity.opportunityNo,
          title: opportunity.title,
        },
      })),
    )
    .sort((first, second) => second.acceptedAt.getTime() - first.acceptedAt.getTime());
  const validOrders = salesOrders.filter((order) => order.status !== "CANCELLED");
  const totalTransaction = validOrders.reduce((total, order) => total + Number(order.total), 0);
  const activeOrderCount = validOrders.filter((order) => order.status === "ACTIVE").length;
  const latestOrder = validOrders[0];
  const hasOpenOpportunity = customer.opportunities.some((opportunity) => OPEN_STAGES.includes(opportunity.stage));
  const activityStatus = activityStatusFromSchedule(customer.reminders, new Date(), hasOpenOpportunity);
  const repeatSchedule = customer.reminders.find((reminder) => reminder.type === "REPEAT_ORDER");
  const reactivationSchedule = customer.reminders.find((reminder) => reminder.type === "REACTIVATION");

  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/crm/pelanggan" />} nativeButton={false} className="w-fit">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Semua customer
      </Button>
      <PageHeader
        title={customer.name}
        description={`${customer.customerNo}${customer.companyName ? ` · ${customer.companyName}` : ""}${customer.archivedAt ? " · Diarsipkan" : ""}`}
        action={<CustomerActivityBadge status={activityStatus} archived={Boolean(customer.archivedAt)} />}
      />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan order</CardTitle>
              <CardDescription>Perhitungan hanya mencakup Sales Order yang tidak dibatalkan.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-5">
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Total order</dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums">{validOrders.length}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Total transaksi</dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums wrap-break-word">{formatCurrency(totalTransaction)}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Order aktif</dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums">{activeOrderCount}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Order terakhir</dt>
                  <dd className="text-sm font-semibold md:text-base">{latestOrder ? formatDate(latestOrder.acceptedAt) : "Belum ada order"}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Reminder berikutnya</dt>
                  <dd className="text-sm font-semibold md:text-base">
                    {activityStatus === "TIDAK_AKTIF"
                      ? reactivationSchedule ? `Sejak ${formatDate(reactivationSchedule.dueAt)}` : "Tidak aktif"
                      : activityStatus === "POTENSI_REPEAT"
                        ? repeatSchedule ? `Sejak ${formatDate(repeatSchedule.dueAt)}` : "Follow-up repeat"
                        : repeatSchedule
                          ? formatDate(repeatSchedule.dueAt)
                          : "Belum dijadwalkan"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <CommunicationHistory
            items={communicationHistory.items}
            total={communicationHistory.total}
            page={communicationHistory.page}
            pageCount={communicationHistory.pageCount}
            pathname={`/crm/pelanggan/${customer.id}`}
            form={!customer.archivedAt ? (
              <CommunicationEntryForm
                context="customer"
                customerId={customer.id}
                opportunities={customer.opportunities.map((opportunity) => ({
                  id: opportunity.id,
                  opportunityNo: opportunity.opportunityNo,
                  title: opportunity.title,
                }))}
                initialOccurredAt={toDateTimeLocalValue(new Date())}
              />
            ) : undefined}
          />

          <Card>
            <CardHeader>
              <CardTitle>Riwayat order</CardTitle>
              <CardDescription>Order terbaru ditampilkan lebih dahulu. Order yang dibatalkan tetap tercatat.</CardDescription>
            </CardHeader>
            <CardContent>
              {salesOrders.length ? (
                <div className="flex flex-col">
                  {salesOrders.map((order) => (
                    <article key={order.id} className="grid gap-4 border-b py-5 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/sales-orders/${order.id}`} className="inline-flex items-center gap-1 font-mono text-sm font-medium underline-offset-4 hover:underline">
                            {order.salesOrderNo}<ExternalLink aria-hidden="true" className="size-3.5" />
                          </Link>
                          <SalesOrderStatusBadge status={order.status} />
                        </div>
                        <div>
                          <Link href={`/crm/peluang/${order.opportunity.id}`} className="font-medium underline-offset-4 hover:underline">{order.opportunity.title}</Link>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{order.opportunity.opportunityNo}</p>
                        </div>
                        {order.items.length ? (
                          <ul className="flex flex-col gap-2" aria-label={`Item ${order.salesOrderNo}`}>
                            {order.items.map((item) => (
                              <li key={item.id} className="flex items-start justify-between gap-4 text-sm">
                                <span className="min-w-0 wrap-break-word">{item.description}</span>
                                <span className="shrink-0 font-mono tabular-nums">{item.quantity} pcs</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">Rincian item tidak tersedia.</p>
                        )}
                      </div>
                      <dl className="flex gap-6 md:flex-col md:items-end md:gap-2 md:text-right">
                        <div>
                          <dt className="sr-only">Tanggal order</dt>
                          <dd className="text-sm text-muted-foreground">{formatDate(order.acceptedAt)}</dd>
                        </div>
                        <div>
                          <dt className="sr-only">Total order</dt>
                          <dd className="font-mono font-medium tabular-nums">{formatCurrency(order.total)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada order</EmptyTitle>
                    <EmptyDescription>Riwayat akan muncul setelah quotation customer diterima dan Sales Order terbentuk.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peluang CRM</CardTitle>
              <CardDescription>Semua repeat order tetap memakai profil customer ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {customer.opportunities.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peluang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Estimasi nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.opportunities.map((opportunity) => (
                      <TableRow key={opportunity.id}>
                        <TableCell>
                          <Link href={`/crm/peluang/${opportunity.id}`} className="font-medium underline-offset-4 hover:underline">{opportunity.title}</Link>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</p>
                        </TableCell>
                        <TableCell><OpportunityStatusBadge stage={opportunity.stage} /></TableCell>
                        <TableCell>{opportunity.deadline ? formatDate(opportunity.deadline) : "Belum ditentukan"}</TableCell>
                        <TableCell className="text-right font-mono">{opportunity.estimatedValue ? formatCurrency(opportunity.estimatedValue) : "Belum diisi"}</TableCell>
                      </TableRow>
                    ))}
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
                      <FieldLabel htmlFor="companyName">Perusahaan/komunitas</FieldLabel>
                      <Input id="companyName" name="companyName" maxLength={160} defaultValue={customer.companyName ?? ""} disabled={Boolean(customer.archivedAt)} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="customerTypeId" required>Jenis customer</FieldLabel>
                      <NativeSelect id="customerTypeId" name="customerTypeId" required defaultValue={customer.customerTypeId} className="w-full" disabled={Boolean(customer.archivedAt)}>
                        {formOptions.customerTypes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="leadSourceId">Sumber lead</FieldLabel>
                      <NativeSelect id="leadSourceId" name="leadSourceId" defaultValue={customer.leadSourceId ?? ""} className="w-full" disabled={Boolean(customer.archivedAt)}>
                        <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
                        {formOptions.leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="salesPicId">Sales/PIC</FieldLabel>
                      <NativeSelect id="salesPicId" name="salesPicId" defaultValue={customer.salesPicId ?? ""} className="w-full" disabled={Boolean(customer.archivedAt)}>
                        <NativeSelectOption value="">Belum ditugaskan</NativeSelectOption>
                        {customer.salesPic && !customer.salesPic.isActive && !formOptions.salesUsers.some((item) => item.id === customer.salesPicId) ? <NativeSelectOption value={customer.salesPic.id}>{customer.salesPic.name} (nonaktif)</NativeSelectOption> : null}
                        {formOptions.salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
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
                  <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <Field>
                      <FieldLabel htmlFor="city">Kota</FieldLabel>
                      <Input id="city" name="city" maxLength={120} defaultValue={customer.city ?? ""} disabled={Boolean(customer.archivedAt)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="address">Alamat</FieldLabel>
                      <Textarea id="address" name="address" maxLength={2000} rows={3} defaultValue={customer.address ?? ""} disabled={Boolean(customer.archivedAt)} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="notes">Catatan umum</FieldLabel>
                    <Textarea id="notes" name="notes" maxLength={4000} rows={4} defaultValue={customer.notes ?? ""} disabled={Boolean(customer.archivedAt)} />
                    <FieldDescription>Informasi yang berlaku untuk profil customer, bukan catatan satu peluang.</FieldDescription>
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
            <Card id="repeat-order">
              <CardHeader>
                <CardTitle>Repeat order / peluang baru</CardTitle>
                <CardDescription>
                  {repeatDraft
                    ? `Terisi dari ${repeatDraft.salesOrderNo}. Periksa kembali sebelum membuat peluang.`
                    : "Lead baru akan langsung terhubung ke customer ini."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createOpportunityAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="title" required>Kebutuhan</FieldLabel>
                      <Input id="title" name="title" required minLength={3} maxLength={180} placeholder="Contoh: Repeat kaos event" defaultValue={repeatDraft?.title ?? ""} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="productName">Produk</FieldLabel>
                      <Input id="productName" name="productName" maxLength={120} defaultValue={repeatDraft?.productName ?? ""} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="estimatedQuantity">Estimasi jumlah</FieldLabel>
                      <Input id="estimatedQuantity" name="estimatedQuantity" type="number" min={1} step={1} defaultValue={repeatDraft?.estimatedQuantity ?? ""} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="estimatedValue">Estimasi nilai</FieldLabel>
                      <Input id="estimatedValue" name="estimatedValue" type="number" min={0} step={1} defaultValue={repeatDraft?.estimatedValue ?? ""} />
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

        </aside>
      </div>
    </>
  );
}
