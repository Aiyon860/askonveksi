"use client";

import { Trash2 } from "lucide-react";

import { deleteProductAction } from "@/app/actions/cms-products";
import { Button } from "@/components/ui/button";

export function ProductDeleteButton({ slug, name, disabled }: { slug: string; name: string; disabled?: boolean }) {
  return (
    <form
      action={deleteProductAction}
      onSubmit={(event) => {
        if (!window.confirm(`Hapus produk “${name}”? Halaman produk ini akan hilang dari website.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={disabled}
        title={disabled ? "Pindahkan sub-produk terlebih dahulu" : `Hapus ${name}`}
      >
        <Trash2 aria-hidden="true" />
        Hapus
      </Button>
    </form>
  );
}
