import Link from "next/link";
import Image from "next/image";
import { CheckCheck, MessageCircle, Search, Send } from "lucide-react";

import { markWhatsAppConversationReadAction, sendWhatsAppMessageAction } from "@/app/actions/whatsapp";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppAutoRefresh } from "@/components/whatsapp-auto-refresh";
import { WhatsAppCustomerActions } from "@/components/whatsapp-customer-actions";
import { WhatsAppMessageTimeline } from "@/components/whatsapp-message-timeline";
import { getCustomerOptions } from "@/lib/crm/data";
import { getCustomerFormOptions } from "@/lib/master-data";
import { getWhatsAppInbox } from "@/lib/whatsapp/data";

function jidNumber(jid: string) {
  return jid.split("@")[0];
}

function canPreviewImage(kind: string, mimeType: string | null) {
  return kind === "IMAGE" && ["image/jpeg", "image/png", "image/webp"].includes(mimeType ?? "");
}

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ conversation?: string; q?: string }> }) {
  const query = await searchParams;
  const selected = query.conversation;
  const data = await getWhatsAppInbox(selected, query.q);
  const active = data.conversations.find((item) => item.id === data.activeId);
  const [customers, customerFormOptions] = data.canSeeUnknown && active && !active.customer
    ? await Promise.all([getCustomerOptions(), getCustomerFormOptions()])
    : [[], null];

  return (
    <main className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden">
      <WhatsAppAutoRefresh />
      <PageHeader title="WhatsApp" description="Percakapan customer dan status pengiriman dari nomor bisnis ASKonveksi." action={<Button variant="outline" render={<Link href="/whatsapp/jobs" />} nativeButton={false}>Lihat antrean</Button>} />
      <div className="grid w-full min-w-0 max-w-full min-h-[620px] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card size="sm" className="min-w-0">
          <CardHeader><CardTitle>Percakapan</CardTitle></CardHeader>
          <CardContent className="gap-1 px-2">
            <form className="px-1 pb-2"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" defaultValue={query.q} placeholder="Cari nama atau nomor" aria-label="Cari percakapan WhatsApp" className="pl-9" /></div></form>
            {data.conversations.length ? data.conversations.map((conversation) => (
              <Link key={conversation.id} href={`/whatsapp?conversation=${conversation.id}`} aria-current={conversation.id === data.activeId ? "page" : undefined} className="flex min-w-0 items-start gap-3 rounded-md px-3 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted">
                <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate font-medium">{conversation.customer?.companyName ?? conversation.customer?.name ?? jidNumber(conversation.remoteJid)}</span>{conversation.unreadCount ? <Badge>{conversation.unreadCount}</Badge> : null}</span>
                  <span className="block truncate text-xs text-muted-foreground">{conversation.lastMessagePreview ?? "Belum ada pesan"}</span>
                </span>
              </Link>
            )) : <Empty><EmptyHeader><EmptyTitle>Belum ada percakapan</EmptyTitle><EmptyDescription>Pesan masuk atau pengiriman pertama akan tampil di sini.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0">
          {active ? (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle>{active.customer?.companyName ?? active.customer?.name ?? jidNumber(active.remoteJid)}</CardTitle><p className="text-sm text-muted-foreground">{jidNumber(active.remoteJid)} melalui {active.account.label}</p></div>
                  <form action={markWhatsAppConversationReadAction}><input type="hidden" name="conversationId" value={active.id} /><SubmitButton pendingLabel="Menandai..." size="sm" variant="outline" disabled={!active.unreadCount}><CheckCheck data-icon="inline-start" />Tandai dibaca</SubmitButton></form>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 gap-4 pt-4">
                {!active.customer && data.canSeeUnknown && customerFormOptions ? (
                  <WhatsAppCustomerActions
                    conversationId={active.id}
                    phoneNumber={jidNumber(active.remoteJid)}
                    customers={customers}
                    customerTypes={customerFormOptions.customerTypes}
                    leadSources={customerFormOptions.leadSources}
                    salesUsers={customerFormOptions.salesUsers}
                  />
                ) : null}
                <WhatsAppMessageTimeline conversationId={active.id} latestMessageId={data.messages.at(-1)?.id ?? null}>
                  {data.messages.length ? data.messages.map((message) => (
                    <article key={message.id} className={`flex min-w-0 ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                      <div className={`min-w-0 max-w-[82%] overflow-hidden rounded-md border px-3 py-2 ${message.direction === "OUTBOUND" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                        {message.mediaPath && canPreviewImage(message.kind, message.mediaMimeType) ? (
                          <Link href={`/api/whatsapp/media/${message.id}`} className="mb-2 block overflow-hidden rounded-sm">
                            <Image unoptimized src={`/api/whatsapp/media/${message.id}`} alt={message.mediaFileName || "Gambar WhatsApp"} width={320} height={240} className="h-auto max-h-72 w-auto max-w-full object-contain" />
                          </Link>
                        ) : null}
                        {message.mediaFileName ? <Link href={`/api/whatsapp/media/${message.id}`} className="mb-1 block break-all text-xs font-medium underline underline-offset-2">{message.mediaFileName}</Link> : null}
                        {message.text || !canPreviewImage(message.kind, message.mediaMimeType) ? <p className="whitespace-pre-wrap break-words text-sm">{message.text ?? `[${message.kind.toLowerCase()}]`}</p> : null}
                        <p className={`mt-1 text-right text-xs ${message.direction === "OUTBOUND" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{message.occurredAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} · {message.status.toLowerCase()}</p>
                      </div>
                    </article>
                  )) : <Empty><EmptyHeader><EmptyTitle>Belum ada pesan</EmptyTitle></EmptyHeader></Empty>}
                </WhatsAppMessageTimeline>
                <form action={sendWhatsAppMessageAction}>
                  <input type="hidden" name="conversationId" value={active.id} />
                  <FieldGroup className="gap-3">
                    {data.templates.length ? <Field><FieldLabel htmlFor="templateId">Template opsional</FieldLabel><NativeSelect id="templateId" name="templateId" className="w-full"><NativeSelectOption value="">Tanpa template</NativeSelectOption>{data.templates.map((template) => <NativeSelectOption key={template.id} value={template.id}>{template.name}</NativeSelectOption>)}</NativeSelect></Field> : null}
                    <Field><FieldLabel htmlFor="message-text">Pesan</FieldLabel><Textarea id="message-text" name="text" maxLength={4000} rows={3} disabled={!active.customer} /></Field>
                    <Field><FieldLabel htmlFor="attachment">Lampiran</FieldLabel><FilePicker id="attachment" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp" emptyLabel="Belum ada lampiran" disabled={!active.customer} /><FieldDescription>PDF, JPG, PNG, atau WebP. Maksimal 10 MB.</FieldDescription></Field>
                    <SubmitButton pendingLabel="Mengantrekan..." className="self-end" disabled={!active.customer}><Send data-icon="inline-start" />Kirim</SubmitButton>
                  </FieldGroup>
                </form>
              </CardContent>
            </>
          ) : <CardContent><Empty><EmptyHeader><EmptyTitle>Pilih percakapan</EmptyTitle><EmptyDescription>Pilih customer di sebelah kiri untuk membuka timeline.</EmptyDescription></EmptyHeader></Empty></CardContent>}
        </Card>
      </div>
    </main>
  );
}
