"use client";

import { Send } from "lucide-react";

import { issueInvoiceAction } from "@/app/actions/crm";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type IssueInvoiceActionProps = {
  opportunityId: string;
  invoiceId: string;
  version: number;
};

export function IssueInvoiceAction({
  opportunityId,
  invoiceId,
  version,
}: IssueInvoiceActionProps) {
  return (
    <form action={issueInvoiceAction} className="contents">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="version" value={version} />
      <ConfirmSubmitButton
        className="w-full sm:w-auto"
        pendingLabel="Menerbitkan..."
        confirmTitle="Terbitkan dan kunci invoice?"
        confirmDescription="Invoice akan dikunci dan dikirim ke WhatsApp customer bersama pesan pendamping. Setelah diterbitkan, invoice tidak dapat direvisi."
        confirmLabel="Ya, terbitkan"
      >
        <Send data-icon="inline-start" aria-hidden="true" />
        Terbitkan invoice
      </ConfirmSubmitButton>
    </form>
  );
}
