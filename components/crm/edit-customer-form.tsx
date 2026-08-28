import { Pencil } from "lucide-react";

import { updateCustomerAction } from "@/app/actions/crm";
import {
  CustomerFields,
  type CustomerFormOption,
  type CustomerFormValues,
} from "@/components/crm/customer-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function EditCustomerForm({
  customer,
  customerTypes,
  leadSources,
  salesUsers,
}: {
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
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>
            Perbarui profil {customer.customerNo}. Perubahan berlaku untuk transaksi berikutnya.
          </DialogDescription>
        </DialogHeader>
        <form action={updateCustomerAction}>
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="version" value={customer.version} />
          <CustomerFields
            idPrefix={`edit-${customer.id}`}
            customerTypes={customerTypes}
            leadSources={leadSources}
            salesUsers={salesUsers}
            values={customer}
            currentSalesPic={customer.salesPic ?? undefined}
          />
          <SubmitButton className="mt-7" pendingLabel="Memperbarui customer...">
            Simpan perubahan
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
