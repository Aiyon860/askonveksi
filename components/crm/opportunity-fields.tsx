import { DESIGN_STATUS_LABEL } from "@/lib/crm/constants";
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
  designStatus: keyof typeof DESIGN_STATUS_LABEL | null;
  specification: string | null;
  customerBudget: { toString(): string } | string | null;
  leadScore: number;
  estimatedQuantity: number | null;
  estimatedValue: { toString(): string } | string | null;
  deadline: Date | null;
  nextAction: string | null;
  nextActionAt: Date | null;
};

export function OpportunityFields({ idPrefix, leadSources, salesUsers, values }: { idPrefix: string; leadSources: CustomerFormOption[]; salesUsers: CustomerFormOption[]; values?: Values }) {
  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Data kebutuhan</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idPrefix}-title`} required>Judul peluang</FieldLabel><Input id={`${idPrefix}-title`} name="title" required minLength={3} maxLength={180} defaultValue={values?.title ?? ""} placeholder="Contoh: Seragam panitia 150 pcs" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-garmentType`}>Jenis pakaian</FieldLabel><NativeSelect id={`${idPrefix}-garmentType`} name="garmentType" defaultValue={values?.garmentType ?? ""}><NativeSelectOption value="">Belum ditentukan</NativeSelectOption><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption></NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-productName`}>Nama produk atau pola</FieldLabel><Input id={`${idPrefix}-productName`} name="productName" maxLength={120} defaultValue={values?.productName ?? ""} placeholder="Contoh: Jersey solid atau jaket" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-needPurpose`}>Untuk kebutuhan</FieldLabel><Input id={`${idPrefix}-needPurpose`} name="needPurpose" maxLength={500} defaultValue={values?.needPurpose ?? ""} placeholder="Event, perusahaan, komunitas, sekolah" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-estimatedQuantity`}>Estimasi jumlah</FieldLabel><Input id={`${idPrefix}-estimatedQuantity`} name="estimatedQuantity" type="number" min={1} step={1} defaultValue={values?.estimatedQuantity ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-deadline`}>Deadline</FieldLabel><Input id={`${idPrefix}-deadline`} name="deadline" type="date" defaultValue={values?.deadline?.toISOString().slice(0, 10) ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-customerBudget`}>Budget customer</FieldLabel><Input id={`${idPrefix}-customerBudget`} name="customerBudget" type="number" min={0} step={1} inputMode="numeric" defaultValue={values?.customerBudget?.toString() ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-estimatedValue`}>Estimasi nilai</FieldLabel><Input id={`${idPrefix}-estimatedValue`} name="estimatedValue" type="number" min={0} step={1} inputMode="numeric" defaultValue={values?.estimatedValue?.toString() ?? ""} /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-designStatus`}>Status desain</FieldLabel><NativeSelect id={`${idPrefix}-designStatus`} name="designStatus" defaultValue={values?.designStatus ?? ""}><NativeSelectOption value="">Belum ditanyakan</NativeSelectOption>{Object.entries(DESIGN_STATUS_LABEL).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-leadScore`} required>Lead score</FieldLabel><Input id={`${idPrefix}-leadScore`} name="leadScore" type="number" min={0} max={100} step={1} required defaultValue={values?.leadScore ?? 0} /><FieldDescription>Hot 80-100, Warm 50-79, Cold 0-49.</FieldDescription></Field>
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
          <Field><FieldLabel htmlFor={`${idPrefix}-nextAction`}>Tindakan berikutnya</FieldLabel><Input id={`${idPrefix}-nextAction`} name="nextAction" maxLength={500} defaultValue={values?.nextAction ?? ""} placeholder="Contoh: Hubungi untuk menggali kebutuhan" /></Field>
          <Field><FieldLabel htmlFor={`${idPrefix}-nextActionAt`}>Jadwal</FieldLabel><Input id={`${idPrefix}-nextActionAt`} name="nextActionAt" type="datetime-local" defaultValue={toDateTimeLocalValue(values?.nextActionAt)} /></Field>
        </div>
        <FieldDescription>Isi tindakan dan jadwal bersamaan agar muncul di Follow-up Center.</FieldDescription>
      </FieldSet>
    </FieldGroup>
  );
}
