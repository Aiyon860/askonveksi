"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react";

import { createWhatsAppCustomerAction, linkWhatsAppConversationAction } from "@/app/actions/whatsapp";
import { CustomerFields, type CustomerFormOption } from "@/components/crm/customer-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

type CustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
  whatsapp: string | null;
};

export function WhatsAppCustomerActions({
  conversationId,
  phoneNumber,
  customers,
  customerTypes,
  leadSources,
  salesUsers,
}: {
  conversationId: string;
  phoneNumber: string;
  customers: CustomerOption[];
  customerTypes: CustomerFormOption[];
  leadSources: CustomerFormOption[];
  salesUsers: CustomerFormOption[];
}) {
  const items = customers.map((customer) => ({
    value: customer.id,
    label: [customer.customerNo, customer.companyName || customer.name, customer.whatsapp].filter(Boolean).join(" - "),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <form action={linkWhatsAppConversationAction} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="conversationId" value={conversationId} />
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="customer-search">Tautkan ke customer</FieldLabel>
          <Combobox.Root items={items} name="customerId" required>
            <Combobox.InputGroup className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Combobox.Input id="customer-search" placeholder="Cari nama, nomor customer, atau WhatsApp" className="h-9 w-full rounded-md border bg-card pr-9 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
              <Combobox.Trigger className="absolute top-0 right-0 flex size-9 items-center justify-center text-muted-foreground" aria-label="Buka pilihan customer">
                <ChevronsUpDown aria-hidden="true" className="size-4" />
              </Combobox.Trigger>
            </Combobox.InputGroup>
            <Combobox.Portal>
              <Combobox.Positioner className="z-60 outline-none" sideOffset={4}>
                <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                  <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">Customer tidak ditemukan.</Combobox.Empty>
                  <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain outline-none">
                    {(item: { value: string; label: string }) => (
                      <Combobox.Item key={item.value} value={item} className="grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-highlighted:bg-muted">
                        <Combobox.ItemIndicator><Check aria-hidden="true" className="size-4" /></Combobox.ItemIndicator>
                        <span className="truncate">{item.label}</span>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field>
        <SubmitButton pendingLabel="Menautkan..." size="sm">Tautkan</SubmitButton>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">atau</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Dialog>
        <DialogTrigger render={<Button variant="secondary" size="sm" className="self-start" />}>
          <UserPlus data-icon="inline-start" aria-hidden="true" />
          Tambah customer baru
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah customer dari WhatsApp</DialogTitle>
            <DialogDescription>Nomor {phoneNumber} akan disimpan dan percakapan ini langsung ditautkan ke customer baru.</DialogDescription>
          </DialogHeader>
          <form action={createWhatsAppCustomerAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <CustomerFields idPrefix="whatsapp-new" customerTypes={customerTypes} leadSources={leadSources} salesUsers={salesUsers} fixedWhatsapp={phoneNumber} />
            <SubmitButton className="mt-7" pendingLabel="Menyimpan customer...">Simpan dan tautkan</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
