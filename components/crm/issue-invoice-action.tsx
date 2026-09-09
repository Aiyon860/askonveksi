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
        variant="outline"
        className="w-full border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success sm:w-auto"
        confirmButtonClassName="border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success focus-visible:border-success/40 focus-visible:ring-success/20"
        pendingLabel="Menerbitkan..."
        confirmTitle="Terbitkan dan kunci invoice?"
        confirmDescription="Draft tidak dapat diedit setelah diterbitkan. Perubahan harga berikutnya dibuat sebagai revisi."
        confirmLabel="Ya, terbitkan"
      >
        <Send data-icon="inline-start" aria-hidden="true" />
        Terbitkan invoice
      </ConfirmSubmitButton>
    </form>
  );
}
