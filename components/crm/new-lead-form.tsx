"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { createLeadAction } from "@/app/actions/crm";
import { CustomerFields, type CustomerFormOption } from "@/components/crm/customer-fields";
import { OpportunityFields } from "@/components/crm/opportunity-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type CustomerOption = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
};

export function NewLeadForm({ customers, customerTypes, leadSources, salesUsers }: { customers: CustomerOption[]; customerTypes: CustomerFormOption[]; leadSources: CustomerFormOption[]; salesUsers: CustomerFormOption[] }) {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}><Plus data-icon="inline-start" aria-hidden="true" />Lead baru</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tambah lead baru</DialogTitle>
          <DialogDescription>Simpan customer dan kebutuhan awal dalam satu alur kerja.</DialogDescription>
        </DialogHeader>
        <form action={createLeadAction}>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Customer</FieldLegend>
              <Field>
                <FieldLabel htmlFor="customerMode" required>Gunakan data customer</FieldLabel>
                <NativeSelect id="customerMode" name="customerMode" required value={customerMode} onChange={(event) => setCustomerMode(event.target.value as "existing" | "new")}>
                  {customers.length ? <NativeSelectOption value="existing">Customer tersimpan</NativeSelectOption> : null}
                  <NativeSelectOption value="new">Customer baru</NativeSelectOption>
                </NativeSelect>
              </Field>
              {customerMode === "existing" ? (
                <Field>
                  <FieldLabel htmlFor="customerId" required>Customer</FieldLabel>
                  <NativeSelect id="customerId" name="customerId" required defaultValue="">
                    <NativeSelectOption value="" disabled>Pilih customer</NativeSelectOption>
                    {customers.map((customer) => <NativeSelectOption key={customer.id} value={customer.id}>{customer.name}{customer.companyName ? ` · ${customer.companyName}` : ""} ({customer.customerNo})</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              ) : <CustomerFields idPrefix="lead-customer" customerTypes={customerTypes} leadSources={leadSources} salesUsers={salesUsers} />}
            </FieldSet>
            <OpportunityFields idPrefix="new-lead" leadSources={leadSources} salesUsers={salesUsers} />
            <SubmitButton pendingLabel="Membuat lead...">Simpan lead</SubmitButton>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
