import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type CustomerFormOption = { id: string; name: string };

export type CustomerFormValues = {
  name: string;
  companyName: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  customerTypeId: string;
  leadSourceId: string | null;
  salesPicId: string | null;
};

export function CustomerFields({
  idPrefix,
  customerTypes,
  leadSources,
  salesUsers,
  values,
  currentSalesPic,
}: {
  idPrefix: string;
  customerTypes: CustomerFormOption[];
  leadSources: CustomerFormOption[];
  salesUsers: CustomerFormOption[];
  values?: CustomerFormValues;
  currentSalesPic?: CustomerFormOption & { isActive: boolean };
}) {
  const currentSalesPicIsMissing = Boolean(
    values?.salesPicId
      && currentSalesPic
      && !salesUsers.some((item) => item.id === values.salesPicId),
  );

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-name`} required>Nama customer</FieldLabel>
          <Input id={`${idPrefix}-name`} name="name" required minLength={2} maxLength={160} defaultValue={values?.name ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-companyName`}>Perusahaan/komunitas</FieldLabel>
          <Input id={`${idPrefix}-companyName`} name="companyName" maxLength={160} defaultValue={values?.companyName ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-customerTypeId`} required>Jenis customer</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-customerTypeId`}
            name="customerTypeId"
            required
            defaultValue={values?.customerTypeId ?? ""}
            className="w-full"
          >
            {!values ? <NativeSelectOption value="" disabled>Pilih jenis customer</NativeSelectOption> : null}
            {customerTypes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-leadSourceId`}>Sumber lead</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-leadSourceId`}
            name="leadSourceId"
            defaultValue={values?.leadSourceId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
            {leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-salesPicId`}>Sales/PIC</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-salesPicId`}
            name="salesPicId"
            defaultValue={values?.salesPicId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Belum ditugaskan</NativeSelectOption>
            {currentSalesPicIsMissing && currentSalesPic ? (
              <NativeSelectOption value={currentSalesPic.id}>
                {currentSalesPic.name}{currentSalesPic.isActive ? "" : " (nonaktif)"}
              </NativeSelectOption>
            ) : null}
            {salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-city`}>Kota</FieldLabel>
          <Input id={`${idPrefix}-city`} name="city" maxLength={120} defaultValue={values?.city ?? ""} />
        </Field>
      </div>
      <FieldSet>
        <FieldLegend variant="label" required>Kontak customer</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-whatsapp`}>WhatsApp</FieldLabel>
            <Input id={`${idPrefix}-whatsapp`} name="whatsapp" inputMode="tel" maxLength={32} defaultValue={values?.whatsapp ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
            <Input id={`${idPrefix}-email`} name="email" type="email" maxLength={320} defaultValue={values?.email ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-instagram`}>Instagram</FieldLabel>
            <Input
              id={`${idPrefix}-instagram`}
              name="instagram"
              maxLength={80}
              placeholder="username"
              defaultValue={values?.instagram ?? ""}
            />
          </Field>
        </div>
        <FieldDescription>Isi minimal salah satu: WhatsApp, email, atau Instagram.</FieldDescription>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-address`}>Alamat</FieldLabel>
        <Textarea id={`${idPrefix}-address`} name="address" maxLength={2000} rows={3} defaultValue={values?.address ?? ""} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Catatan umum</FieldLabel>
        <Textarea id={`${idPrefix}-notes`} name="notes" maxLength={4000} rows={3} defaultValue={values?.notes ?? ""} />
        <FieldDescription>Informasi yang berlaku untuk profil customer, bukan catatan satu peluang.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}
