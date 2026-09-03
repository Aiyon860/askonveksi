"use client";

import { useState } from "react";

import { addCommunicationActivityAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const CHANNEL_OPTIONS = [
  ["WHATSAPP", "WhatsApp"],
  ["INSTAGRAM", "Instagram"],
  ["PHONE", "Telepon"],
  ["EMAIL", "Email"],
  ["MEETING", "Pertemuan"],
  ["OTHER", "Lainnya"],
  ["INTERNAL_NOTE", "Catatan internal"],
] as const;

export function CommunicationEntryForm({
  context,
  customerId,
  opportunityId,
  opportunities = [],
  initialOccurredAt,
}: {
  context: "customer" | "opportunity";
  customerId: string;
  opportunityId?: string;
  opportunities?: Array<{ id: string; opportunityNo: string; title: string }>;
  initialOccurredAt: string;
}) {
  const [channel, setChannel] = useState<(typeof CHANNEL_OPTIONS)[number][0]>("WHATSAPP");
  const isInternalNote = channel === "INTERNAL_NOTE";
  const idPrefix = `communication-${context}`;

  return (
    <form action={addCommunicationActivityAction}>
      <input type="hidden" name="context" value={context} />
      <input type="hidden" name="customerId" value={customerId} />
      {context === "opportunity" ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-channel`} required>Jenis / kanal</FieldLabel>
            <NativeSelect
              id={`${idPrefix}-channel`}
              name="channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as (typeof CHANNEL_OPTIONS)[number][0])}
              className="w-full"
              required
            >
              {CHANNEL_OPTIONS.map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {!isInternalNote ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-direction`} required>Arah komunikasi</FieldLabel>
              <NativeSelect id={`${idPrefix}-direction`} name="direction" defaultValue="OUTBOUND" className="w-full" required>
                <NativeSelectOption value="OUTBOUND">Keluar, sales menghubungi customer</NativeSelectOption>
                <NativeSelectOption value="INBOUND">Masuk, customer menghubungi sales</NativeSelectOption>
              </NativeSelect>
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor={`${idPrefix}-occurredAt`} required>Waktu aktivitas</FieldLabel>
            <Input
              id={`${idPrefix}-occurredAt`}
              name="occurredAt"
              type="datetime-local"
              required
              defaultValue={initialOccurredAt}
              max={initialOccurredAt}
            />
          </Field>
        </div>

        {context === "customer" ? (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-opportunityId`}>Peluang terkait</FieldLabel>
            <NativeSelect id={`${idPrefix}-opportunityId`} name="opportunityId" defaultValue="" className="w-full">
              <NativeSelectOption value="">Tidak terkait peluang tertentu</NativeSelectOption>
              {opportunities.map((opportunity) => (
                <NativeSelectOption key={opportunity.id} value={opportunity.id}>
                  {opportunity.opportunityNo} · {opportunity.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-content`} required>
            {isInternalNote ? "Isi catatan" : "Ringkasan komunikasi"}
          </FieldLabel>
          <Textarea
            id={`${idPrefix}-content`}
            name="content"
            required
            minLength={2}
            maxLength={4000}
            rows={4}
            placeholder={isInternalNote ? "Tambahkan konteks yang perlu diketahui tim." : "Catat permintaan customer, jawaban sales, dan hasil percakapan."}
          />
          <FieldDescription>Entri tersimpan permanen. Tambahkan entri baru jika perlu melakukan koreksi.</FieldDescription>
        </Field>

        <SubmitButton variant="secondary" pendingLabel="Mencatat aktivitas...">
          Catat aktivitas
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
