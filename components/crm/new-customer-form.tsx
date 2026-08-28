import { Plus } from "lucide-react";

import { createCustomerAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NewCustomerForm() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Tambah customer
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah customer</DialogTitle>
          <DialogDescription>Simpan identitas dan kontak utama customer untuk dipakai pada peluang berikutnya.</DialogDescription>
        </DialogHeader>
        <form action={createCustomerAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-name" required>Nama customer</FieldLabel>
              <Input id="new-name" name="name" required minLength={2} maxLength={160} />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-companyName">Nama perusahaan</FieldLabel>
              <Input id="new-companyName" name="companyName" maxLength={160} />
            </Field>
            <FieldSet>
              <FieldLegend variant="label" required>Kontak customer</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="new-whatsapp">WhatsApp</FieldLabel>
                  <Input id="new-whatsapp" name="whatsapp" inputMode="tel" maxLength={32} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-email">Email</FieldLabel>
                  <Input id="new-email" name="email" type="email" maxLength={320} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-instagram">Instagram</FieldLabel>
                  <Input id="new-instagram" name="instagram" maxLength={80} placeholder="username" />
                </Field>
              </div>
              <FieldDescription>Isi minimal salah satu: WhatsApp, email, atau Instagram.</FieldDescription>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="new-address">Alamat</FieldLabel>
              <Textarea id="new-address" name="address" maxLength={2000} rows={4} />
            </Field>
            <SubmitButton pendingLabel="Menyimpan customer...">Simpan customer</SubmitButton>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
