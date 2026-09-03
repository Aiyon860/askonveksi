"use client";

import { useState } from "react";
import type { OpportunityStage } from "@prisma/client";

import { moveOpportunityStageAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_LABEL } from "@/lib/crm/constants";

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
  const allowedStages: Record<Exclude<OpportunityStage, "DEAL">, OpportunityStage[]> = {
    LEAD_BARU: ["FOLLOW_UP", "LOST"],
    FOLLOW_UP: ["LEAD_BARU", "NEGOSIASI", "LOST"],
    NEGOSIASI: ["FOLLOW_UP", "LOST"],
    LOST: ["FOLLOW_UP"],
  };
  const options = initialStage === "DEAL" ? [] : allowedStages[initialStage];
  const [stage, setStage] = useState<OpportunityStage>(options[0] ?? "FOLLOW_UP");

  if (initialStage === "DEAL") {
    return <p className="text-sm leading-6 text-muted-foreground">Deal dikunci oleh Sales Order. Admin dapat membatalkannya dari halaman Sales Order.</p>;
  }

  return (
    <form action={moveOpportunityStageAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="version" value={version} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="detail-stage" required>Status</FieldLabel>
          <NativeSelect id="detail-stage" name="stage" required value={stage} onChange={(event) => setStage(event.target.value as OpportunityStage)} className="w-full">
            {options.map((option) => (
              <NativeSelectOption key={option} value={option}>{STAGE_LABEL[option]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {stage === "LOST" ? (
          <Field>
            <FieldLabel htmlFor="detail-cancelReason" required>Alasan lost</FieldLabel>
            <Textarea id="detail-cancelReason" name="cancelReason" required maxLength={1000} rows={4} defaultValue={cancelReason ?? ""} />
          </Field>
        ) : null}
        <FieldDescription>{initialStage === "NEGOSIASI" ? "Deal dilakukan melalui blok pembayaran, bukan form status ini." : "Hanya perpindahan status yang sesuai alur ditampilkan."}</FieldDescription>
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
