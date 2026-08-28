"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { createOpportunityAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type CustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
};

export function NewLeadForm({ customers }: { customers: CustomerOption[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Lead baru
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah lead baru</DialogTitle>
          <DialogDescription>Pilih customer aktif yang sudah tersimpan, lalu catat kebutuhan awalnya.</DialogDescription>
        </DialogHeader>
        {customers.length ? (
          <form action={createOpportunityAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customerId" required>Customer</FieldLabel>
                <NativeSelect id="customerId" name="customerId" required className="w-full" defaultValue="">
                  <NativeSelectOption value="" disabled>Pilih customer</NativeSelectOption>
                  {customers.map((customer) => (
                    <NativeSelectOption key={customer.id} value={customer.id}>
                      {customer.name}{customer.companyName ? ` · ${customer.companyName}` : ""} ({customer.customerNo})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="title" required>Kebutuhan / judul peluang</FieldLabel>
                <Input id="title" name="title" required minLength={3} maxLength={180} placeholder="Contoh: Seragam panitia 150 pcs" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="estimatedQuantity">Estimasi jumlah</FieldLabel>
                  <Input id="estimatedQuantity" name="estimatedQuantity" type="number" min={1} step={1} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="estimatedValue">Estimasi nilai</FieldLabel>
                  <Input id="estimatedValue" name="estimatedValue" type="number" min={0} step={1} inputMode="numeric" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="deadline">Deadline</FieldLabel>
                  <Input id="deadline" name="deadline" type="date" />
                </Field>
              </div>
              <SubmitButton pendingLabel="Membuat lead...">Buat lead</SubmitButton>
            </FieldGroup>
          </form>
        ) : (
          <Empty className="border bg-muted/30">
            <EmptyHeader>
              <EmptyTitle>Belum ada customer aktif</EmptyTitle>
              <EmptyDescription>Tambahkan customer dari menu Manajemen Customer sebelum membuat lead.</EmptyDescription>
            </EmptyHeader>
            <Button render={<Link href="/crm/pelanggan" />} nativeButton={false}>
              Buka Manajemen Customer
            </Button>
          </Empty>
        )}
      </DialogContent>
    </Dialog>
  );
}
