"use client";

import { useState } from "react";
import type { OpportunityStage } from "@prisma/client";
import { NotebookPen } from "lucide-react";

import { recordFollowUpResultAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { toDateTimeLocalValue } from "@/lib/crm/format";

type FollowUpItem = {
  id: string;
  version: number;
  title: string;
  stage: OpportunityStage;
  nextAction: string | null;
  nextActionAt: Date | null;
  cancelReason: string | null;
};

export function FollowUpResultForm({ opportunity }: { opportunity: FollowUpItem }) {
  const fallbackStage = opportunity.stage === "LEAD_BARU" ? "FOLLOW_UP" : opportunity.stage;
  const [stage, setStage] = useState<OpportunityStage>(fallbackStage);
  const closesOpportunity = stage === "LOST";

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <NotebookPen data-icon="inline-start" aria-hidden="true" />
        Catat hasil
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Catat hasil follow-up</DialogTitle>
          <DialogDescription>{opportunity.title}. Simpan hasil kontak dan langkah kerja berikutnya.</DialogDescription>
        </DialogHeader>
        <form action={recordFollowUpResultAction}>
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <input type="hidden" name="version" value={opportunity.version} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={`channel-${opportunity.id}`} required>Kanal</FieldLabel>
                <NativeSelect id={`channel-${opportunity.id}`} name="channel" defaultValue="WHATSAPP" required className="w-full">
                  <NativeSelectOption value="WHATSAPP">WhatsApp</NativeSelectOption>
                  <NativeSelectOption value="INSTAGRAM">Instagram</NativeSelectOption>
                  <NativeSelectOption value="PHONE">Telepon</NativeSelectOption>
                  <NativeSelectOption value="EMAIL">Email</NativeSelectOption>
                  <NativeSelectOption value="MEETING">Pertemuan</NativeSelectOption>
                  <NativeSelectOption value="OTHER">Lainnya</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`direction-${opportunity.id}`} required>Arah</FieldLabel>
                <NativeSelect id={`direction-${opportunity.id}`} name="direction" defaultValue="OUTBOUND" required className="w-full">
                  <NativeSelectOption value="OUTBOUND">Keluar</NativeSelectOption>
                  <NativeSelectOption value="INBOUND">Masuk</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`contactedAt-${opportunity.id}`} required>Waktu kontak</FieldLabel>
                <Input
                  id={`contactedAt-${opportunity.id}`}
                  name="contactedAt"
                  type="datetime-local"
                  required
                  defaultValue={toDateTimeLocalValue(new Date())}
                  max={toDateTimeLocalValue(new Date())}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`content-${opportunity.id}`} required>Hasil follow-up</FieldLabel>
              <Textarea id={`content-${opportunity.id}`} name="content" required minLength={2} maxLength={4000} rows={4} placeholder="Ringkas respons customer dan keputusan yang diambil." />
            </Field>
            <Field>
              <FieldLabel htmlFor={`stage-${opportunity.id}`} required>Status setelah follow-up</FieldLabel>
              <NativeSelect id={`stage-${opportunity.id}`} name="stage" required value={stage} onChange={(event) => setStage(event.target.value as OpportunityStage)}>
                {PIPELINE_STAGES.filter((item) => item !== "LEAD_BARU" && item !== "DEAL").map((item) => (
                  <NativeSelectOption key={item} value={item}>{STAGE_LABEL[item]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {closesOpportunity ? (
              <Field>
                <FieldLabel htmlFor={`cancelReason-${opportunity.id}`} required>Alasan lost</FieldLabel>
                <Textarea id={`cancelReason-${opportunity.id}`} name="cancelReason" required minLength={2} maxLength={1000} rows={3} defaultValue={opportunity.cancelReason ?? ""} />
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor={`nextAction-${opportunity.id}`} required>Next action</FieldLabel>
                  <Input id={`nextAction-${opportunity.id}`} name="nextAction" required maxLength={500} defaultValue={opportunity.nextAction ?? ""} placeholder="Contoh: Kirim revisi harga" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`nextActionAt-${opportunity.id}`} required>Jadwal berikutnya</FieldLabel>
                  <Input id={`nextActionAt-${opportunity.id}`} name="nextActionAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(opportunity.nextActionAt)} />
                  <FieldDescription>Harus setelah waktu kontak yang dicatat.</FieldDescription>
                </Field>
              </>
            )}
            <SubmitButton pendingLabel="Menyimpan hasil...">Simpan hasil follow-up</SubmitButton>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
