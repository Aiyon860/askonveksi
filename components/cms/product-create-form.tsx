"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductAction, type CmsProductActionState } from "@/app/actions/cms-products";
import type { CmsProduct } from "@/lib/cms/types";

const initialState: CmsProductActionState = { error: null };

export function ProductCreateForm({ products }: { products: CmsProduct[] }) {
  const [state, formAction] = useActionState(createProductAction, initialState);
  const parents = products.filter((product) => !product.parentSlug);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-product-name">Nama produk</Label>
          <Input id="new-product-name" name="name" required maxLength={240} placeholder="Contoh: Kaos Panjang" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-product-slug">Slug halaman</Label>
          <Input
            id="new-product-slug"
            name="slug"
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="kaos-panjang"
            aria-describedby="new-product-slug-help"
          />
          <p id="new-product-slug-help" className="text-xs text-muted-foreground">
            Alamat halaman: /produk/kaos-panjang. Slug tidak bisa diubah setelah dibuat.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="new-product-parent">Induk produk</Label>
        <select
          id="new-product-parent"
          name="parentSlug"
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Tanpa induk (produk mandiri)</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="self-start" pendingLabel="Menambahkan…">
        <Plus aria-hidden="true" />
        Tambah produk
      </SubmitButton>
    </form>
  );
}
