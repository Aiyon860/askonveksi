"use client";

import type { WhatsAppMessageDirection, WhatsAppMessageKind, WhatsAppMessageStatus } from "@prisma/client";
import { CheckCheck, MessageCircle, Search, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import useSWR, { SWRConfig, useSWRConfig } from "swr";

import { markWhatsAppConversationReadAction, sendWhatsAppMessageAction } from "@/app/actions/whatsapp";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppCustomerActions } from "@/components/whatsapp-customer-actions";
import { WhatsAppMessageTimeline } from "@/components/whatsapp-message-timeline";
import { whatsappMessagesKey, whatsappMessagesLoading } from "@/lib/whatsapp/browser";

type Conversation = {
  id: string;
  remoteJid: string;
  unreadCount: number;
  lastMessagePreview: string | null;
  account: { label: string };
  customer: { id: string; name: string; companyName: string | null } | null;
};

type Message = {
  id: string;
  direction: WhatsAppMessageDirection;
  kind: WhatsAppMessageKind;
  status: WhatsAppMessageStatus;
  text: string | null;
  hasMedia: boolean;
  mediaFileName: string | null;
  mediaMimeType: string | null;
  invoiceId: string | null;
  invoiceNo: string | null;
  errorMessage: string | null;
  occurredAt: string;
};

type CustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
  whatsapp: string | null;
};

type FormOptions = {
  customerTypes: { id: string; name: string }[];
  leadSources: { id: string; name: string }[];
  salesUsers: { id: string; name: string }[];
};

type Props = {
  conversations: Conversation[];
  templates: { id: string; name: string }[];
  query?: string;
  canSeeUnknown: boolean;
  customers: CustomerOption[];
  customerFormOptions: FormOptions | null;
};

function jidNumber(jid: string) {
  return jid.split("@")[0];
}

function canPreviewImage(message: Message) {
  return message.kind === "IMAGE" && message.hasMedia && ["image/jpeg", "image/png", "image/webp"].includes(message.mediaMimeType ?? "");
}

function documentAttachment(message: Message) {
  const label = message.mediaFileName
    ?? (message.invoiceNo ? `invoice-${message.invoiceNo}.pdf` : null)
    ?? (message.kind === "DOCUMENT" ? "[dokumen]" : null);
  if (!label) return null;
  const href = message.hasMedia
    ? `/api/whatsapp/media/${message.id}`
    : message.invoiceId
      ? `/api/crm/invoice/${message.invoiceId}/pdf`
      : null;
  return { label, href };
}

async function fetchMessages(url: string): Promise<Message[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Sesi berakhir. Masuk kembali untuk membuka percakapan." : "Pesan belum dapat dimuat.");
  return ((await response.json()) as { messages: Message[] }).messages;
}

function MessagePanel({ conversation, templates, canSeeUnknown, customers, customerFormOptions }: Omit<Props, "conversations" | "query"> & { conversation: Conversation }) {
  const key = whatsappMessagesKey(conversation.id);
  const { data, error, mutate } = useSWR<Message[]>(key, fetchMessages, {
    refreshInterval: 3_000,
    refreshWhenHidden: false,
    keepPreviousData: false,
  });
  const loading = whatsappMessagesLoading(data, error);

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{conversation.customer?.companyName ?? conversation.customer?.name ?? jidNumber(conversation.remoteJid)}</CardTitle><p className="text-sm text-muted-foreground">{jidNumber(conversation.remoteJid)} melalui {conversation.account.label}</p></div>
          <form action={markWhatsAppConversationReadAction}><input type="hidden" name="conversationId" value={conversation.id} /><SubmitButton pendingLabel="Menandai..." size="sm" variant="outline" disabled={!conversation.unreadCount}><CheckCheck data-icon="inline-start" />Tandai dibaca</SubmitButton></form>
        </div>
      </CardHeader>
      <CardContent key={conversation.id} className="min-h-0 flex-1 gap-4 pt-4">
        {!conversation.customer && canSeeUnknown && customerFormOptions ? (
          <WhatsAppCustomerActions
            conversationId={conversation.id}
            phoneNumber={jidNumber(conversation.remoteJid)}
            customers={customers}
            customerTypes={customerFormOptions.customerTypes}
            leadSources={customerFormOptions.leadSources}
            salesUsers={customerFormOptions.salesUsers}
          />
        ) : null}
        {loading ? (
          <div className="flex max-h-[640px] min-h-[480px] flex-col gap-3 rounded-md bg-muted/30 p-3" aria-busy="true" aria-label="Memuat pesan">
            <Skeleton className="h-14 w-3/5" />
            <Skeleton className="h-20 w-2/3 self-end" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : error ? (
          <Empty className="max-h-[640px] min-h-[480px] p-6">
            <EmptyHeader><EmptyTitle>Pesan belum dapat dimuat</EmptyTitle><EmptyDescription>{error.message}</EmptyDescription></EmptyHeader>
            <EmptyContent><Button type="button" variant="outline" onClick={() => void mutate()}>Coba lagi</Button></EmptyContent>
          </Empty>
        ) : (
          <WhatsAppMessageTimeline conversationId={conversation.id} latestMessageId={data?.at(-1)?.id ?? null}>
            {data?.length ? data.map((message) => (
              <article key={message.id} className={`flex min-w-0 ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className={`min-w-0 max-w-[82%] overflow-hidden rounded-md border px-3 py-2 ${message.direction === "OUTBOUND" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  {canPreviewImage(message) ? (
                    <Link href={`/api/whatsapp/media/${message.id}`} className="mb-2 block overflow-hidden rounded-sm">
                      <Image unoptimized src={`/api/whatsapp/media/${message.id}`} alt={message.mediaFileName || "Gambar WhatsApp"} width={320} height={240} className="h-auto max-h-72 w-auto max-w-full object-contain" />
                    </Link>
                  ) : null}
                  {(() => {
                    const attachment = documentAttachment(message);
                    if (!attachment) return null;
                    return attachment.href ? (
                      <Link href={attachment.href} className="mb-1 block break-all text-xs font-medium underline underline-offset-2">{attachment.label}</Link>
                    ) : (
                      <p className="mb-1 block break-all text-xs font-medium">{attachment.label}</p>
                    );
                  })()}
                  {message.text || !canPreviewImage(message) ? <p className="whitespace-pre-wrap break-words text-sm">{message.text ?? `[${message.kind.toLowerCase()}]`}</p> : null}
                  {message.status === "FAILED" ? <p className="mt-2 text-xs"><span className="font-medium">Gagal:</span> {message.errorMessage ?? "Alasan tidak tersedia."} <Link href="/whatsapp/jobs?status=FAILED" className="underline underline-offset-2">Cek status pengiriman</Link></p> : null}
                  <p className={`mt-1 text-right text-xs ${message.direction === "OUTBOUND" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{new Date(message.occurredAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} · {message.status.toLowerCase()}</p>
                </div>
              </article>
            )) : <Empty><EmptyHeader><EmptyTitle>Belum ada pesan</EmptyTitle></EmptyHeader></Empty>}
          </WhatsAppMessageTimeline>
        )}
        {templates.length ? (
          <section aria-labelledby="quick-template-title" className="rounded-md border bg-muted/20 p-3">
            <p id="quick-template-title" className="mb-2 text-sm font-medium">Template cepat</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <form key={template.id} action={sendWhatsAppMessageAction}>
                  <input type="hidden" name="conversationId" value={conversation.id} />
                  <input type="hidden" name="templateId" value={template.id} />
                  <SubmitButton size="sm" variant="outline" pendingLabel="Mengirim..." disabled={!conversation.customer}>{template.name}</SubmitButton>
                </form>
              ))}
            </div>
          </section>
        ) : null}
        <form action={sendWhatsAppMessageAction}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <FieldGroup className="gap-3">
            <Field><FieldLabel htmlFor="message-text">Pesan</FieldLabel><Textarea id="message-text" name="text" maxLength={4000} rows={3} disabled={!conversation.customer} /></Field>
            <Field><FieldLabel htmlFor="attachment">Lampiran</FieldLabel><FilePicker id="attachment" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp" emptyLabel="Belum ada lampiran" disabled={!conversation.customer} /><FieldDescription>PDF, JPG, PNG, atau WebP. Maksimal 10 MB.</FieldDescription></Field>
            <SubmitButton pendingLabel="Mengirim..." className="self-end" disabled={!conversation.customer}><Send data-icon="inline-start" />Kirim</SubmitButton>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function Inbox(props: Props) {
  const searchParams = useSearchParams();
  const { cache, mutate } = useSWRConfig();
  const prefetching = useRef(new Set<string>());
  const requestedId = searchParams.get("conversation");
  const active = props.conversations.find((item) => item.id === requestedId) ?? props.conversations[0];

  function hrefFor(conversationId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", conversationId);
    return `/whatsapp?${params.toString()}`;
  }

  function openConversation(event: MouseEvent<HTMLAnchorElement>, conversationId: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (conversationId !== active?.id) window.history.pushState(null, "", hrefFor(conversationId));
  }

  function prefetch(conversationId: string) {
    const key = whatsappMessagesKey(conversationId);
    if (!key || cache.get(key) || prefetching.current.has(key)) return;
    prefetching.current.add(key);
    void mutate(key, fetchMessages(key), { revalidate: false }).catch(() => prefetching.current.delete(key));
  }

  return (
    <div className="grid min-h-[620px] w-full min-w-0 max-w-full gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card size="sm" className="min-w-0">
        <CardHeader><CardTitle>Percakapan</CardTitle></CardHeader>
        <CardContent className="gap-1 px-2">
          <form className="px-1 pb-2"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" defaultValue={props.query} placeholder="Cari nama atau nomor" aria-label="Cari percakapan WhatsApp" className="pl-9" /></div></form>
          {props.conversations.length ? props.conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={hrefFor(conversation.id)}
              onClick={(event) => openConversation(event, conversation.id)}
              onMouseEnter={() => prefetch(conversation.id)}
              onFocus={() => prefetch(conversation.id)}
              aria-current={conversation.id === active?.id ? "page" : undefined}
              className="flex min-w-0 items-start gap-3 rounded-md px-3 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted"
            >
              <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate font-medium">{conversation.customer?.companyName ?? conversation.customer?.name ?? jidNumber(conversation.remoteJid)}</span>{conversation.unreadCount ? <Badge>{conversation.unreadCount}</Badge> : null}</span>
                <span className="block truncate text-xs text-muted-foreground">{conversation.lastMessagePreview ?? "Belum ada pesan"}</span>
              </span>
            </Link>
          )) : <Empty><EmptyHeader><EmptyTitle>Belum ada percakapan</EmptyTitle><EmptyDescription>Pesan masuk atau pengiriman pertama akan tampil di sini.</EmptyDescription></EmptyHeader></Empty>}
        </CardContent>
      </Card>

      {active ? <MessagePanel {...props} conversation={active} /> : <Card size="sm" className="min-w-0"><CardContent><Empty><EmptyHeader><EmptyTitle>Pilih percakapan</EmptyTitle><EmptyDescription>Pilih customer di sebelah kiri untuk membuka timeline.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>}
    </div>
  );
}

export function WhatsAppInbox(props: Props) {
  const [cache] = useState(() => new Map());
  return <SWRConfig value={{ provider: () => cache }}><Inbox {...props} /></SWRConfig>;
}
