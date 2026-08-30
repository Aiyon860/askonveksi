"use client";

import { useState } from "react";
import type { OpportunityStage } from "@prisma/client";

import { moveOpportunityStageAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";

export function OpportunityStageForm({
  opportunityId,
  version,
  initialStage,
  cancelReason,
}: {
  opportunityId: string;
  version: number;
  initialStage: OpportunityStage;
  cancelReason: string | null;
}) {
  const fallbackStage = initialStage === "DEAL" ? "PENAWARAN" : initialStage;
  const [stage, setStage] = useState<OpportunityStage>(fallbackStage);

  if (initialStage === "DEAL") {
    return <p className="text-sm leading-6 text-muted-foreground">Deal dikunci oleh Sales Order. Owner/Admin dapat membaliknya dari halaman Sales Order.</p>;
  }

  return (
    <form action={moveOpportunityStageAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="version" value={version} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="detail-stage" required>Status</FieldLabel>
          <NativeSelect id="detail-stage" name="stage" required value={stage} onChange={(event) => setStage(event.target.value as OpportunityStage)} className="w-full">
            {PIPELINE_STAGES.map((option) => (
              <NativeSelectOption key={option} value={option} disabled={option === "DEAL"}>
                {STAGE_LABEL[option]}{option === "DEAL" ? " · melalui quotation" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {stage === "LOST" ? (
          <Field>
            <FieldLabel htmlFor="detail-cancelReason" required>Alasan lost</FieldLabel>
            <Textarea id="detail-cancelReason" name="cancelReason" required maxLength={1000} rows={4} defaultValue={cancelReason ?? ""} />
          </Field>
        ) : null}
        <FieldDescription>Deal hanya dapat dipilih melalui aksi “Diterima &amp; Deal”.</FieldDescription>
        <ConfirmSubmitButton
          pendingLabel="Memindahkan..."
          confirmTitle="Ubah status peluang?"
          confirmDescription={`Status akan dipindahkan ke ${STAGE_LABEL[stage]}. Perubahan ini dicatat dalam audit log.`}
          confirmLabel="Ya, ubah status"
        >
          Simpan status
        </ConfirmSubmitButton>
      </FieldGroup>
    </form>
  );
}
