"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";

import { ImageField } from "@/components/cms/image-field";
import { NavItemsField } from "@/components/cms/nav-items-field";
import { SectionsField } from "@/components/cms/sections-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CmsField } from "@/lib/cms/editors";
import { cmsFieldKey } from "@/lib/cms/editors";
import { arrayAtPath, getAtPath, moveAtPath, pushAtPath, removeAtPath } from "@/lib/cms/paths";
import type { CmsImage, CmsSectionState } from "@/lib/cms/types";

const RichTextEditor = dynamic(() => import("@/components/cms/rich-text-editor").then((module) => module.RichTextEditor), {
  ssr: false,
  loading: () => <div className="min-h-36 animate-pulse rounded-md border border-input bg-muted/40" />,
});

function prefixField(field: CmsField, prefix: string): CmsField {
  if (field.kind === "divider") return field;
  if (field.kind === "group") return { ...field, fields: field.fields.map((child) => prefixField(child, prefix)) };
  return { ...field, path: `${prefix}.${field.path}` };
}

function itemTitle(item: unknown, fallback: string) {
  if (!item || typeof item !== "object") return fallback;
  const record = item as Record<string, unknown>;
  return String(record.name ?? record.label ?? record.title ?? record.question ?? fallback);
}

export function FieldRenderer({
  field,
  content,
  onChange,
}: {
  field: CmsField;
  content: unknown;
  onChange: (path: string, value: unknown) => void;
}) {
  if (field.kind === "divider") return <hr className="my-2 border-border" />;

  if (field.kind === "group") {
    return (
      <details open={!field.collapsed} className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:hidden">
          {field.label}
          {field.help ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{field.help}</span> : null}
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {field.fields.map((child, index) => (
            <FieldRenderer key={cmsFieldKey(child, index)} field={child} content={content} onChange={onChange} />
          ))}
        </div>
      </details>
    );
  }

  if (field.kind === "sections") {
    const value = (getAtPath(content, field.path) as CmsSectionState[] | undefined) ?? [];
    return (
      <FieldShell label={field.label} help={field.help}>
        <SectionsField value={value} labels={field.labels} onChange={(next) => onChange(field.path, next)} />
      </FieldShell>
    );
  }

  if (field.kind === "navItems") {
    const value = getAtPath(content, field.path) as Parameters<typeof NavItemsField>[0]["value"] | undefined;
    return (
      <FieldShell label={field.label} help={field.help}>
        <NavItemsField value={value ?? []} onChange={(next) => onChange(field.path, next)} />
      </FieldShell>
    );
  }

  if (field.kind === "link") {
    const value = (getAtPath(content, field.path) as { label?: string; href?: string; visible?: boolean } | undefined) ?? {};
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-3">
        <p className="text-sm font-semibold">{field.label}</p>
        <Input value={value.label ?? ""} onChange={(event) => onChange(`${field.path}.label`, event.target.value)} placeholder="Label tombol" aria-label={`${field.label} label`} />
        <Input value={value.href ?? ""} onChange={(event) => onChange(`${field.path}.href`, event.target.value)} placeholder="/#kontak" aria-label={`${field.label} link`} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={value.visible ?? true} onCheckedChange={(checked) => onChange(`${field.path}.visible`, checked)} size="sm" />
          Tampilkan tombol
        </label>
        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      </div>
    );
  }

  if (field.kind === "seo") {
    return (
      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">{field.label ?? "SEO halaman"}</summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <FieldRenderer field={{ kind: "text", path: `${field.path}.title`, label: "Judul di Google" }} content={content} onChange={onChange} />
          <FieldRenderer field={{ kind: "textarea", path: `${field.path}.description`, label: "Deskripsi di Google", rows: 3 }} content={content} onChange={onChange} />
          <FieldRenderer field={{ kind: "image", path: `${field.path}.ogImage`, label: "Gambar saat dibagikan" }} content={content} onChange={onChange} />
        </div>
      </details>
    );
  }

  if (field.kind === "imageList") {
    const items = arrayAtPath(content, field.path) as CmsImage[];
    return (
      <FieldShell label={field.label} help={field.help}>
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={`${item.src}-${index}`} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Gambar {index + 1}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Naikkan gambar" disabled={index === 0} onClick={() => onChange("", moveAtPath(content, field.path, index, -1))}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Turunkan gambar" disabled={index === items.length - 1} onClick={() => onChange("", moveAtPath(content, field.path, index, 1))}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus gambar" onClick={() => onChange("", removeAtPath(content, field.path, index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <ImageField value={item} onChange={(value) => onChange(`${field.path}.${index}`, value ?? { src: "", alt: "" })} label={`Gambar ${index + 1}`} />
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange("", pushAtPath(content, field.path, { src: "/hero.jpg", alt: "" }))}>
            <Plus aria-hidden="true" />
            Tambah gambar
          </Button>
        </div>
      </FieldShell>
    );
  }

  if (field.kind === "list") {
    const items = arrayAtPath(content, field.path) as unknown[];
    return (
      <FieldShell label={field.label} help={field.help}>
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={`${field.path}-${index}`} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
                  {index + 1}. {itemTitle(item, field.itemLabel)}
                </span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Naikkan item" disabled={index === 0} onClick={() => onChange("", moveAtPath(content, field.path, index, -1))}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Turunkan item" disabled={index === items.length - 1} onClick={() => onChange("", moveAtPath(content, field.path, index, 1))}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus item" onClick={() => onChange("", removeAtPath(content, field.path, index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {field.fields.map((child, childIndex) => (
                  <FieldRenderer
                    key={cmsFieldKey(child, childIndex)}
                    field={prefixField(child, `${field.path}.${index}`)}
                    content={content}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          ))}
          {items.length >= (field.max ?? 100) ? (
            <p className="text-xs text-muted-foreground">Batas maksimal {field.max ?? 100} item tercapai.</p>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => onChange("", pushAtPath(content, field.path, structuredClone(field.newItem)))}>
              <Plus aria-hidden="true" />
              Tambah {field.itemLabel.toLowerCase()}
            </Button>
          )}
        </div>
      </FieldShell>
    );
  }

  if (field.kind === "stringList") {
    const value = (getAtPath(content, field.path) as string[] | undefined) ?? [];
    return (
      <FieldShell label={field.label} help={field.help}>
        <Textarea
          rows={field.rows ?? 4}
          value={value.join("\n")}
          onChange={(event) => onChange(field.path, event.target.value.split("\n"))}
          placeholder="Satu item per baris"
        />
      </FieldShell>
    );
  }

  const value = getAtPath(content, field.path);

  if (field.kind === "text") {
    return (
      <FieldShell label={field.label} help={field.help}>
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.path, event.target.value)}
          placeholder={field.placeholder}
          readOnly={field.readOnly}
          maxLength={field.maxLength}
          className={field.readOnly ? "bg-muted/40" : undefined}
        />
      </FieldShell>
    );
  }

  if (field.kind === "textarea") {
    return (
      <FieldShell label={field.label} help={field.help}>
        <Textarea
          rows={field.rows ?? 3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.path, event.target.value)}
          maxLength={field.maxLength}
        />
      </FieldShell>
    );
  }

  if (field.kind === "rich") {
    return (
      <FieldShell label={field.label} help={field.help}>
        <RichTextEditor value={typeof value === "string" ? value : ""} onChange={(html) => onChange(field.path, html)} />
      </FieldShell>
    );
  }

  if (field.kind === "image") {
    return (
      <ImageField
        value={(value as CmsImage | null | undefined) ?? null}
        onChange={(next) => onChange(field.path, next)}
        label={field.label}
        help={field.help}
        focus={field.focus}
      />
    );
  }

  if (field.kind === "switch") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{field.label}</p>
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(field.path, checked)} />
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <FieldShell label={field.label} help={field.help}>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.path, event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.kind === "number") {
    return (
      <FieldShell label={field.label} help={field.help}>
        <Input
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(field.path, Number(event.target.value))}
        />
      </FieldShell>
    );
  }

  return null;
}

function FieldShell({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
