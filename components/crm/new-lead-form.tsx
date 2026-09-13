"use client";

import { Plus } from "lucide-react";

import { createProspectAction } from "@/app/actions/crm";
import { CustomerFields, type CustomerFormOption } from "@/components/crm/customer-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

export function NewLeadForm({ customerTypes, leadSources, salesUsers }: { customerTypes: CustomerFormOption[]; leadSources: CustomerFormOption[]; salesUsers: CustomerFormOption[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}><Plus data-icon="inline-start" aria-hidden="true" />Prospek</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tambah Prospek</DialogTitle>
          <DialogDescription>Simpan data awal calon customer ke CRM.</DialogDescription>
        </DialogHeader>
        <form action={createProspectAction}>
          <FieldGroup>
            <CustomerFields idPrefix="prospect-customer" customerTypes={customerTypes} leadSources={leadSources} salesUsers={salesUsers} prospect />
            <SubmitButton pendingLabel="Menyimpan prospek...">Simpan Prospek</SubmitButton>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
