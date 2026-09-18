import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, MessageCircle } from "lucide-react";

import { archiveCustomerAction, createOpportunityAction, forceSendRepeatOrderReminderAction, updateCustomerAction } from "@/app/actions/crm";
import { openCustomerWhatsAppAction } from "@/app/actions/whatsapp";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
import { CustomerHistories } from "@/components/crm/customer-histories";
import { CustomerOrderReminderSetting } from "@/components/crm/customer-order-reminder-setting";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { CustomerActivityBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CRM_OPERATOR_ROLES, CUSTOMER_REMINDER_SETTING_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getCustomerCommunicationHistory, getCustomerDetail, getCustomerOpportunities, getCustomerOrderSummary, getCustomerSalesOrders, type CustomerCommunicationFilter, type CustomerOrderStatus } from "@/lib/crm/data";
import { OPEN_STAGES, PIPELINE_STAGES } from "@/lib/crm/constants";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
import { activityStatusFromSchedule } from "@/lib/crm/reminder-types";
import { getCustomerFormOptions } from "@/lib/master-data";
import { parseDocumentDateRange } from "@/lib/crm/document-list-filters";
import { normalizeCustomerHistoryPageSize } from "@/lib/crm/customer-history";

function parseCustomerHistoryPageSize(value: string | string[] | undefined) {
  return normalizeCustomerHistoryPageSize(firstParam(value));
}

function parseCustomerHistoryPage(value: string | string[] | undefined) {
  const raw = firstParam(value);
  return raw && /^\d+$/.test(raw) ? Math.min(Number(raw), 10_000) : 1;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function customerListHref(value: string | string[] | undefined) {
  const returnTo = firstParam(value);
  if (!returnTo || !returnTo.startsWith("/customers")) return "/customers";

  try {
    const url = new URL(returnTo, "http://askonveksi.local");
    if (url.origin === "http://askonveksi.local" && url.pathname === "/customers") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/customers";
  }

  return "/customers";
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const historyQuery = (firstParam(query.historyQ) ?? "").trim().slice(0, 80);
  const historyFilter = (["COMMUNICATION", "INTERNAL_NOTE", "SYSTEM", "WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"] as const).includes(firstParam(query.historyFilter) as never) ? firstParam(query.historyFilter) as CustomerCommunicationFilter : "all";
  const historyPage = parseCustomerHistoryPage(query.historyPage);
  const historySize = parseCustomerHistoryPageSize(query.historySize);
  const orderQuery = (firstParam(query.orderQ) ?? "").trim().slice(0, 80);
  const orderStatus = (["ACTIVE", "CANCELLED"] as const).includes(firstParam(query.orderStatus) as never) ? firstParam(query.orderStatus) as CustomerOrderStatus : "all";
  const orderRange = parseDocumentDateRange(query.orderFrom, query.orderTo);
  const orderPage = parseCustomerHistoryPage(query.orderPage);
  const orderSize = parseCustomerHistoryPageSize(query.orderSize);
  const opportunityQuery = (firstParam(query.opportunityQ) ?? "").trim().slice(0, 80);
  const opportunityStage = PIPELINE_STAGES.includes(firstParam(query.opportunityStage) as never) ? firstParam(query.opportunityStage) as (typeof PIPELINE_STAGES)[number] : "all";
  const opportunityPage = parseCustomerHistoryPage(query.opportunityPage);
  const opportunitySize = parseCustomerHistoryPageSize(query.opportunitySize);
  const listHref = customerListHref(query.returnTo);
  const [customer, actor, formOptions, summary, communicationHistory, salesOrderHistory, opportunityHistory] = await Promise.all([
    getCustomerDetail(id),
    getCurrentActor(),
    getCustomerFormOptions(),
    getCustomerOrderSummary(id),
    getCustomerCommunicationHistory({ customerId: id, query: historyQuery, filter: historyFilter, page: historyPage, pageSize: historySize }),
    getCustomerSalesOrders({ customerId: id, query: orderQuery, status: orderStatus, start: orderRange.start, end: orderRange.end, page: orderPage, pageSize: orderSize }),
    getCustomerOpportunities({ customerId: id, query: opportunityQuery, stage: opportunityStage, page: opportunityPage, pageSize: opportunitySize }),
  ]);
  if (!customer || !actor) notFound();
  const canOperate = hasRole(actor.role, CRM_OPERATOR_ROLES);
  const canManageReminder = hasRole(actor.role, CUSTOMER_REMINDER_SETTING_ROLES);
  const canForceReminderTest = actor.role === "DEVELOPER";
  const customerFieldsDisabled = Boolean(customer.archivedAt) || !canOperate;
  const canArchive = canOperate && !customer.archivedAt;
  const hasOpenOpportunity = customer.opportunities.some((opportunity) => OPEN_STAGES.includes(opportunity.stage));
  const activityStatus = activityStatusFromSchedule(customer.reminders, new Date(), hasOpenOpportunity);
  const reactivationSchedule = customer.reminders.find((reminder) => reminder.type === "REACTIVATION");
  const recentConversation = customer.whatsappConversations[0];
  return (
    <>
      <Button variant="ghost" size="sm" render={<Link href={listHref} />} nativeButton={false} className="w-fit">
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
                  <dd className="font-mono text-xl font-semibold tabular-nums">{summary.totalOrderCount}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Total transaksi</dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums wrap-break-word">{formatCurrency(summary.totalTransaction)}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Order aktif</dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums">{summary.activeOrderCount}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Order terakhir</dt>
                  <dd className="text-sm font-semibold md:text-base">{summary.latestOrder ? formatDate(summary.latestOrder.acceptedAt) : "Belum ada order"}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Reminder berikutnya</dt>
                  <dd className="text-sm font-semibold md:text-base">
                    {!customer.orderReminderEnabled
                      ? "Dinonaktifkan"
                      : reactivationSchedule
                        ? formatDate(reactivationSchedule.dueAt)
                        : "Belum dijadwalkan"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <CustomerHistories
            customerId={customer.id}
            initial={{
              communication: JSON.parse(JSON.stringify(communicationHistory)),
              order: JSON.parse(JSON.stringify(salesOrderHistory)),
              opportunity: JSON.parse(JSON.stringify(opportunityHistory)),
            }}
            initialState={{
              communication: { query: historyQuery, filter: historyFilter, page: historyPage, pageSize: historySize },
              order: { query: orderQuery, status: orderStatus, from: orderRange.from, to: orderRange.to, page: orderPage, pageSize: orderSize },
              opportunity: { query: opportunityQuery, stage: opportunityStage, page: opportunityPage, pageSize: opportunitySize },
            }}
            communicationForm={canOperate && !customer.archivedAt ? <CommunicationEntryForm context="customer" customerId={customer.id} opportunities={customer.opportunities.map((opportunity) => ({ id: opportunity.id, opportunityNo: opportunity.opportunityNo, title: opportunity.title }))} initialOccurredAt={toDateTimeLocalValue(new Date())} /> : undefined}
          />

          <Card>
            <CardHeader>
              <CardTitle>Data customer</CardTitle>
              <CardDescription>Kontak ini disalin sebagai snapshot ketika invoice diterbitkan.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateCustomerAction}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="version" value={customer.version} />
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="name" required>Nama customer</FieldLabel>
                      <Input id="name" name="name" required minLength={2} maxLength={160} defaultValue={customer.name} disabled={customerFieldsDisabled} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="companyName">Perusahaan/komunitas</FieldLabel>
                      <Input id="companyName" name="companyName" maxLength={160} defaultValue={customer.companyName ?? ""} disabled={customerFieldsDisabled} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="customerTypeId" required>Jenis customer</FieldLabel>
                      <NativeSelect id="customerTypeId" name="customerTypeId" required defaultValue={customer.customerTypeId} className="w-full" disabled={customerFieldsDisabled}>
                        {formOptions.customerTypes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="leadSourceId">Sumber lead</FieldLabel>
                      <NativeSelect id="leadSourceId" name="leadSourceId" defaultValue={customer.leadSourceId ?? ""} className="w-full" disabled={customerFieldsDisabled}>
                        <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
                        {formOptions.leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="salesPicId">Sales/PIC</FieldLabel>
                      <NativeSelect id="salesPicId" name="salesPicId" defaultValue={customer.salesPicId ?? ""} className="w-full" disabled={customerFieldsDisabled}>
                        <NativeSelectOption value="">Belum ditugaskan</NativeSelectOption>
                        {customer.salesPic && !customer.salesPic.isActive && !formOptions.salesUsers.some((item) => item.id === customer.salesPicId) ? <NativeSelectOption value={customer.salesPic.id}>{customer.salesPic.name} (nonaktif)</NativeSelectOption> : null}
                        {formOptions.salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                  </div>
                  <FieldSet disabled={customerFieldsDisabled}>
                    <FieldLegend variant="label" required>Kontak customer</FieldLegend>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
                        <Input id="whatsapp" name="whatsapp" maxLength={32} defaultValue={customer.whatsapp ?? ""} disabled={customerFieldsDisabled} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input id="email" name="email" type="email" maxLength={320} defaultValue={customer.email ?? ""} disabled={customerFieldsDisabled} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="instagram">Instagram</FieldLabel>
                        <Input id="instagram" name="instagram" maxLength={80} defaultValue={customer.instagram ?? ""} disabled={customerFieldsDisabled} />
                      </Field>
                    </div>
                    <FieldDescription>Minimal satu kontak harus tetap terisi.</FieldDescription>
                  </FieldSet>
                  <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <Field>
                      <FieldLabel htmlFor="city">Kota</FieldLabel>
                      <Input id="city" name="city" maxLength={120} defaultValue={customer.city ?? ""} disabled={customerFieldsDisabled} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="address">Alamat</FieldLabel>
                      <Textarea id="address" name="address" maxLength={2000} rows={3} defaultValue={customer.address ?? ""} disabled={customerFieldsDisabled} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="notes">Catatan umum</FieldLabel>
                    <Textarea id="notes" name="notes" maxLength={4000} rows={4} defaultValue={customer.notes ?? ""} disabled={customerFieldsDisabled} />
                    <FieldDescription>Informasi yang berlaku untuk profil customer, bukan catatan satu peluang.</FieldDescription>
                  </Field>
                  {canOperate && !customer.archivedAt ? <SubmitButton pendingLabel="Memperbarui...">Simpan perubahan</SubmitButton> : null}
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
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Buka percakapan dan lihat aktivitas WhatsApp customer.</CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              {recentConversation ? <div className="rounded-md border p-3 text-sm"><div className="flex items-center justify-between gap-3"><span>{recentConversation.unreadCount ? `${recentConversation.unreadCount} belum dibaca` : "Aktif"}</span><span className="text-xs text-muted-foreground">{recentConversation.account.status}</span></div><p className="mt-1 truncate text-muted-foreground">{recentConversation.lastMessagePreview ?? "Belum ada pesan"}</p></div> : null}
              {customer.whatsapp && !customer.archivedAt ? <form action={openCustomerWhatsAppAction}><input type="hidden" name="customerId" value={customer.id} /><Button type="submit" className="w-full"><MessageCircle data-icon="inline-start" />Buka inbox</Button></form> : null}
              {canManageReminder && !customer.archivedAt ? (
                <CustomerOrderReminderSetting key={`${customer.id}-${customer.version}-${customer.orderReminderEnabled}`} customerId={customer.id} version={customer.version} enabled={customer.orderReminderEnabled} />
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Reminder repeat order</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {customer.archivedAt ? "Customer diarsipkan, pengaturan tidak tersedia." : "Hanya Owner / Admin Customer yang dapat mengubah."} Status saat ini: {customer.orderReminderEnabled ? "aktif" : "nonaktif"}.
                    </p>
                  </div>
                  <Switch checked={customer.orderReminderEnabled} disabled aria-label="Status reminder repeat order" />
                </div>
              )}
              {canForceReminderTest && !customer.archivedAt ? <form action={forceSendRepeatOrderReminderAction}><input type="hidden" name="customerId" value={customer.id} /><ConfirmSubmitButton className="w-full" variant="outline" pendingLabel="Menjadwalkan test..." confirmTitle="Kirim reminder repeat order test?" confirmDescription="Pesan akan dikirim ke nomor WhatsApp customer ini, meski syarat otomatisasi belum terpenuhi." confirmLabel="Ya, kirim test">Kirim reminder test</ConfirmSubmitButton></form> : null}
            </CardContent>
          </Card>

          {canOperate && !customer.archivedAt ? (
            <Card>
              <CardHeader>
                <CardTitle>Peluang baru</CardTitle>
                <CardDescription>Order baru dimulai dari tahap Prospek dengan memakai profil customer ini.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createOpportunityAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="title" required>Kebutuhan</FieldLabel>
                      <Input id="title" name="title" required minLength={3} maxLength={180} placeholder="Contoh: Kaos event perusahaan" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="productName">Produk</FieldLabel>
                      <Input id="productName" name="productName" maxLength={120} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="nextAction" required>Tindakan berikutnya</FieldLabel>
                      <Input id="nextAction" name="nextAction" required minLength={2} maxLength={500} placeholder="Contoh: Konfirmasi kebutuhan produksi" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="nextActionAt" required>Jadwal follow-up</FieldLabel>
                      <Input id="nextActionAt" name="nextActionAt" type="datetime-local" required />
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
