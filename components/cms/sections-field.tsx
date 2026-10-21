"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CmsSectionState } from "@/lib/cms/types";

export function SectionsField({
  value,
  onChange,
  labels,
}: {
  value: CmsSectionState[];
  onChange: (value: CmsSectionState[]) => void;
  labels: Record<string, string>;
}) {
  const anyVisible = value.some((section) => section.visible);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggle(index: number) {
    const next = value.map((section, itemIndex) =>
      itemIndex === index ? { ...section, visible: !section.visible } : section,
    );
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((section, index) => (
        <div
          key={section.id}
          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${section.visible ? "border-border bg-background" : "border-dashed border-border bg-muted/40 opacity-70"}`}
        >
          <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{labels[section.id] ?? section.id}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Naikkan ${labels[section.id] ?? section.id}`} onClick={() => move(index, -1)} disabled={index === 0}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Turunkan ${labels[section.id] ?? section.id}`} onClick={() => move(index, 1)} disabled={index === value.length - 1}>
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={section.visible ? "secondary" : "ghost"}
            aria-label={section.visible ? `Sembunyikan ${labels[section.id] ?? section.id}` : `Tampilkan ${labels[section.id] ?? section.id}`}
            onClick={() => toggle(index)}
          >
            {section.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          </Button>
        </div>
      ))}
      {!anyVisible ? <p className="text-xs text-destructive">Minimal satu bagian harus tampil.</p> : null}
    </div>
  );
}
