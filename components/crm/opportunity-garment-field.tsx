"use client";

import { useState } from "react";

import type { ProductCategoryOption } from "@/components/crm/purchase-order-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { GARMENT_TYPE_LABEL } from "@/lib/crm/constants";

export type OpportunityCategoryOption = ProductCategoryOption;

/**
 * Jenis pakaian pada peluang memakai nama kategori dari Master Data > Kategori Produk
 * (PDH/PDL, Kaos, Polo, dll), bukan jenis kategori Jersey/Non-jersey.
 * Jenis (Jerseey/Non-jersey/Aksesori) tetap ditampilkan sebagai info di bawah select
 * dan diambil dari server berdasarkan kategori yang dipilih.
 * Bila Master Data kategori kosong, form kembali ke pilihan Jersey/Non-jersey.
 */
export function OpportunityGarmentField({
  idPrefix,
  categoryOptions,
  defaultCategoryId,
  defaultGarmentType,
}: {
  idPrefix: string;
  categoryOptions?: OpportunityCategoryOption[];
  defaultCategoryId: string | null;
  defaultGarmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
}) {
  const options = categoryOptions ?? [];
  const [categoryId, setCategoryId] = useState(() =>
    defaultCategoryId && options.some((item) => item.id === defaultCategoryId) ? defaultCategoryId : "",
  );
  const selected = options.find((item) => item.id === categoryId);
  const missingCategory = Boolean(defaultCategoryId) && !selected;

  if (!options.length) {
    return (
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-garmentType`}>Jenis pakaian</FieldLabel>
        <NativeSelect id={`${idPrefix}-garmentType`} name="garmentType" defaultValue={defaultGarmentType ?? ""}>
          <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
          <NativeSelectOption value="JERSEY">Jersey</NativeSelectOption>
          <NativeSelectOption value="NON_JERSEY">Non-jersey</NativeSelectOption>
        </NativeSelect>
        <FieldDescription>Belum ada nama kategori di Master Data. Tambahkan kategori agar pilihan lebih lengkap.</FieldDescription>
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-productCategoryId`}>Jenis pakaian</FieldLabel>
      <NativeSelect
        id={`${idPrefix}-productCategoryId`}
        name="productCategoryId"
        value={categoryId}
        onChange={(event) => setCategoryId(event.currentTarget.value)}
      >
        <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
        {options.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>
        ))}
      </NativeSelect>
      {selected ? <FieldDescription>Jenis: {GARMENT_TYPE_LABEL[selected.garmentType]}</FieldDescription> : null}
      {!selected && defaultGarmentType ? <FieldDescription>Jenis sebelumnya: {GARMENT_TYPE_LABEL[defaultGarmentType]}</FieldDescription> : null}
      {missingCategory ? <FieldDescription>Kategori sebelumnya tidak tersedia. Pilih ulang nama kategori.</FieldDescription> : null}
    </Field>
  );
}
