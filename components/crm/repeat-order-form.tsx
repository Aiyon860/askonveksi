"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";

import { createRepeatOrderAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type CustomerOption = { id: string; name: string; whatsapp: string | null };

export function RepeatOrderForm({ customers }: { customers: CustomerOption[] }) {
  const items = [...customers].sort((a, b) => a.name.localeCompare(b.name, "id")).map((customer) => ({
    value: customer.id,
    name: customer.name,
    whatsapp: customer.whatsapp,
    label: [customer.name, customer.whatsapp].filter(Boolean).join(" · "),
  }));

  return <Dialog>
    <DialogTrigger render={<Button />}><Plus data-icon="inline-start" aria-hidden="true" />Repeat Order</DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Tambah Repeat Order</DialogTitle>
        <DialogDescription>Pilih customer lama untuk membuat peluang langsung pada tahap Negosiasi.</DialogDescription>
      </DialogHeader>
      <form action={createRepeatOrderAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="repeat-order-customer" required>Customer lama</FieldLabel>
            <Combobox.Root items={items} name="customerId" required>
              <Combobox.InputGroup className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Combobox.Input id="repeat-order-customer" placeholder="Cari nama atau WhatsApp" className="h-9 w-full rounded-md border bg-card pr-9 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
                <Combobox.Trigger className="absolute top-0 right-0 flex size-9 items-center justify-center text-muted-foreground" aria-label="Buka pilihan customer"><ChevronsUpDown aria-hidden="true" className="size-4" /></Combobox.Trigger>
              </Combobox.InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner className="z-60 outline-none" sideOffset={4}>
                  <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">Customer tidak ditemukan.</Combobox.Empty>
                    <Combobox.List className="w-full max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain outline-none">
                      {(item: { value: string; label: string; name: string; whatsapp: string | null }) => <Combobox.Item key={item.value} value={item} className="flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-highlighted:bg-muted" style={{ display: "flex", width: "100%" }}><Combobox.ItemIndicator className="shrink-0"><Check aria-hidden="true" className="size-4" /></Combobox.ItemIndicator><span className="min-w-0 flex-1 whitespace-normal"><span className="block font-medium leading-5">{item.name}</span><span className="block text-xs leading-5 text-muted-foreground">{item.whatsapp ?? "Tanpa WhatsApp"}</span></span></Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field>
          <SubmitButton pendingLabel="Membuat repeat order...">Buat Repeat Order</SubmitButton>
        </FieldGroup>
      </form>
    </DialogContent>
  </Dialog>;
}
