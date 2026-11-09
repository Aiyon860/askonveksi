import { Pencil } from "lucide-react";

import { updateProspectAction } from "@/app/actions/crm";
import {
  CustomerFields,
  type CustomerFormOption,
  type CustomerFormValues,
} from "@/components/crm/customer-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function EditProspectForm({
  opportunityId,
  opportunityNo,
  returnTo,
  customer,
  customerTypes,
  leadSources,
  salesUsers,
}: {
  opportunityId: string;
  opportunityNo: string;
  returnTo: string;
  customer: CustomerFormValues & {
    id: string;
    customerNo: string;
    version: number;
    salesPic: (CustomerFormOption & { isActive: boolean }) | null;
  };
  customerTypes: CustomerFormOption[];
  leadSources: CustomerFormOption[];
  salesUsers: CustomerFormOption[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit prospek</DialogTitle>
          <DialogDescription>
            Perbarui data {opportunityNo} · {customer.customerNo}. Perubahan berlaku untuk transaksi berikutnya.
          </DialogDescription>
        </DialogHeader>
        <form action={updateProspectAction}>
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="version" value={customer.version} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <CustomerFields
            idPrefix={`edit-prospect-${customer.id}`}
            customerTypes={customerTypes}
            leadSources={leadSources}
            salesUsers={salesUsers}
            values={customer}
            currentSalesPic={customer.salesPic ?? undefined}
            prospect
          />
          <SubmitButton className="mt-7" pendingLabel="Memperbarui prospek...">
            Simpan perubahan
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
