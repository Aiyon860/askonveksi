"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CmsNavItem } from "@/lib/cms/types";

export function NavItemsField({
  value,
  onChange,
}: {
  value: CmsNavItem[];
  onChange: (value: CmsNavItem[]) => void;
}) {
  const hasProducts = value.some((item) => item.type === "products");

  function update(index: number, next: CmsNavItem) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? next : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, index) => (
        <div key={`${item.type}-${index}`} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            {item.type === "products" ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="rounded bg-secondary px-2 py-1 text-xs font-semibold">Dropdown Produk</span>
                <Input
                  value={item.label}
                  onChange={(event) => update(index, { ...item, label: event.target.value })}
                  aria-label="Label dropdown produk"
                  className="h-8"
                />
              </div>
            ) : (
              <>
                <Input
                  value={item.label}
                  onChange={(event) => update(index, { ...item, label: event.target.value })}
                  placeholder="Label"
                  aria-label={`Label link ${index + 1}`}
                  className="h-8 sm:max-w-44"
                />
                <Input
                  value={item.href}
                  onChange={(event) => update(index, { ...item, href: event.target.value })}
                  placeholder="/#beranda"
                  aria-label={`Link ${index + 1}`}
                  className="h-8"
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Switch
              checked={item.visible}
              onCheckedChange={(checked) => update(index, { ...item, visible: checked })}
              aria-label={`Tampilkan ${item.label}`}
              size="sm"
            />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Naikkan" onClick={() => move(index, -1)} disabled={index === 0}>
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Turunkan" onClick={() => move(index, 1)} disabled={index === value.length - 1}>
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...value, { type: "link", label: "Link baru", href: "/", visible: true }])}
        >
          <Plus aria-hidden="true" />
          Tambah link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={hasProducts}
          onClick={() => onChange([...value, { type: "products", label: "Produk", visible: true }])}
        >
          <Plus aria-hidden="true" />
          Tambah dropdown Produk
        </Button>
      </div>
    </div>
  );
}
