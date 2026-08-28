import { Plus } from "lucide-react";

import { createCustomerAction } from "@/app/actions/crm";
import { CustomerFields, type CustomerFormOption } from "@/components/crm/customer-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function NewCustomerForm({
  customerTypes,
  leadSources,
  salesUsers,
}: {
  customerTypes: CustomerFormOption[];
  leadSources: CustomerFormOption[];
  salesUsers: CustomerFormOption[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Tambah customer
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah customer</DialogTitle>
          <DialogDescription>Simpan identitas, klasifikasi, dan kontak utama customer.</DialogDescription>
        </DialogHeader>
        <form action={createCustomerAction}>
          <CustomerFields
            idPrefix="new"
            customerTypes={customerTypes}
            leadSources={leadSources}
            salesUsers={salesUsers}
          />
          <SubmitButton className="mt-7" pendingLabel="Menyimpan customer...">Simpan customer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
