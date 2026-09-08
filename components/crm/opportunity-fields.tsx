import type { OpportunityStage } from "@prisma/client";

import { OPEN_STAGES } from "@/lib/crm/constants";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerFormOption } from "@/components/crm/customer-fields";
import { toDateTimeLocalValue } from "@/lib/crm/format";

type Values = {
  title: string;
  leadSourceId: string | null;
  salesPicId: string | null;
  productName: string | null;
  garmentType: "JERSEY" | "NON_JERSEY" | null;
  needPurpose: string | null;
  specification: string | null;
  nextAction: string | null;
  nextActionAt: Date | null;
  stage?: OpportunityStage;
};

export function OpportunityFields({
  idPrefix,
  leadSources,
  salesUsers,
  values,
}: {
  idPrefix: string;
  leadSources: CustomerFormOption[];
  salesUsers: CustomerFormOption[];
  values?: Values;
}) {
  const scheduleRequired = !values?.stage || OPEN_STAGES.includes(values.stage);

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Data kebutuhan</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idPrefix}-title`} required>Judul peluang</FieldLabel><Input id={`${idPrefix}-title`} name="title" required minLength={3} maxLength={180} defaultValue={values?.title ?? ""} placeholder="Contoh: Seragam panitia 150 pcs" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-garmentType`}>Jenis pakaian</FieldLabel><NativeSelect id={`${idPrefix}-garmentType`} name="garmentType" defaultValue={values?.garmentType ?? ""}><NativeSelectOption value="">Belum ditentukan</NativeSelectOption><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption></NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-productName`}>Nama produk atau pola</FieldLabel><Input id={`${idPrefix}-productName`} name="productName" maxLength={120} defaultValue={values?.productName ?? ""} placeholder="Contoh: Jersey solid atau jaket" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-needPurpose`}>Untuk kebutuhan</FieldLabel><Input id={`${idPrefix}-needPurpose`} name="needPurpose" maxLength={500} defaultValue={values?.needPurpose ?? ""} placeholder="Event, perusahaan, komunitas, sekolah" /></Field>
          <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idPrefix}-specification`}>Spesifikasi</FieldLabel><Textarea id={`${idPrefix}-specification`} name="specification" maxLength={2000} rows={3} defaultValue={values?.specification ?? ""} placeholder="Bahan, warna, ukuran, sablon, bordir, atau detail lain." /></Field>
        </div>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Penugasan</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`${idPrefix}-opportunityLeadSourceId`}>Sumber lead</FieldLabel><NativeSelect id={`${idPrefix}-opportunityLeadSourceId`} name="opportunityLeadSourceId" defaultValue={values?.leadSourceId ?? ""}><NativeSelectOption value="">{values ? "Belum ditentukan" : "Ikuti profil customer"}</NativeSelectOption>{leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-opportunitySalesPicId`}>Sales/PIC</FieldLabel><NativeSelect id={`${idPrefix}-opportunitySalesPicId`} name="opportunitySalesPicId" defaultValue={values?.salesPicId ?? ""}><NativeSelectOption value="">{values ? "Belum ditugaskan" : "Ikuti profil customer"}</NativeSelectOption>{salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
        </div>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Next action</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor={`${idPrefix}-nextAction`} required={scheduleRequired}>Tindakan berikutnya</FieldLabel><Input id={`${idPrefix}-nextAction`} name="nextAction" required={scheduleRequired} minLength={2} maxLength={500} defaultValue={values?.nextAction ?? ""} placeholder="Contoh: Hubungi untuk menggali kebutuhan" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-nextActionAt`} required={scheduleRequired}>Jadwal follow-up</FieldLabel><Input id={`${idPrefix}-nextActionAt`} name="nextActionAt" type="datetime-local" required={scheduleRequired} defaultValue={toDateTimeLocalValue(values?.nextActionAt)} /></Field>
        </div>
        <FieldDescription>{scheduleRequired ? "Next action dan jadwal follow-up wajib diisi agar peluang masuk Follow-up." : "Peluang yang sudah selesai tidak membutuhkan jadwal follow-up aktif."}</FieldDescription>
      </FieldSet>
    </FieldGroup>
  );
}
