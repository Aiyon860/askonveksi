import { Plus } from "lucide-react";

import { createCustomerAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

export function NewCustomerForm({
  customerTypes,
  leadSources,
  salesUsers,
}: {
  customerTypes: Option[];
  leadSources: Option[];
  salesUsers: Option[];
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
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-name" required>Nama customer</FieldLabel>
                <Input id="new-name" name="name" required minLength={2} maxLength={160} />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-companyName">Perusahaan/komunitas</FieldLabel>
                <Input id="new-companyName" name="companyName" maxLength={160} />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-customerTypeId" required>Jenis customer</FieldLabel>
                <NativeSelect id="new-customerTypeId" name="customerTypeId" required defaultValue="" className="w-full">
                  <NativeSelectOption value="" disabled>Pilih jenis customer</NativeSelectOption>
                  {customerTypes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-leadSourceId">Sumber lead</FieldLabel>
                <NativeSelect id="new-leadSourceId" name="leadSourceId" defaultValue="" className="w-full">
                  <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
                  {leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-salesPicId">Sales/PIC</FieldLabel>
                <NativeSelect id="new-salesPicId" name="salesPicId" defaultValue="" className="w-full">
                  <NativeSelectOption value="">Belum ditugaskan</NativeSelectOption>
                  {salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-city">Kota</FieldLabel>
                <Input id="new-city" name="city" maxLength={120} />
              </Field>
            </div>
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
              <Textarea id="new-address" name="address" maxLength={2000} rows={3} />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-notes">Catatan umum</FieldLabel>
              <Textarea id="new-notes" name="notes" maxLength={4000} rows={3} />
              <FieldDescription>Informasi yang berlaku untuk profil customer, bukan catatan satu peluang.</FieldDescription>
            </Field>
            <SubmitButton pendingLabel="Menyimpan customer...">Simpan customer</SubmitButton>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
