"use client";

import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CmsImage } from "@/lib/cms/types";

export function ImageField({
  value,
  onChange,
  label,
  help,
  focus = false,
}: {
  value: CmsImage | null;
  onChange: (value: CmsImage | null) => void;
  label: string;
  help?: string;
  focus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("alt", value?.alt ?? "");
      const response = await fetch("/api/cms/media", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; error?: string; image?: CmsImage };
      if (!response.ok || !result.ok || !result.image) throw new Error(result.error ?? "Gambar gagal diunggah.");
      onChange({ ...(value ?? { alt: "" }), src: result.image.src, alt: value?.alt ?? result.image.alt ?? "" });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Gambar gagal diunggah.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-start">
        <div className="relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background sm:w-44">
          {value?.src ? (
            <Image src={value.src} alt={value.alt || label} width={480} height={320} className="h-full w-full object-contain" unoptimized />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon aria-hidden="true" className="size-6" />
              Belum ada gambar
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              {uploading ? "Mengunggah…" : value ? "Ganti gambar" : "Unggah gambar"}
            </Button>
            {value?.src ? (
              <Button type="button" size="sm" variant="destructive" onClick={() => onChange(null)} disabled={uploading}>
                <Trash2 aria-hidden="true" />
                Hapus
              </Button>
            ) : null}
          </div>

          <Input
            value={value?.alt ?? ""}
            onChange={(event) => onChange({ src: value?.src ?? "", alt: event.target.value, focus: value?.focus })}
            placeholder="Teks alternatif (untuk aksesibilitas & SEO)"
            aria-label={`Teks alternatif ${label}`}
            disabled={!value?.src}
          />

          {focus ? (
            <div className="flex items-center gap-2">
              <Label htmlFor={`focus-${label}`} className="shrink-0 text-xs text-muted-foreground">
                Posisi fokus
              </Label>
              <select
                id={`focus-${label}`}
                value={value?.focus ?? "center"}
                onChange={(event) =>
                  onChange({
                    src: value?.src ?? "",
                    alt: value?.alt ?? "",
                    focus: event.target.value as CmsImage["focus"],
                  })
                }
                disabled={!value?.src}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="left">Kiri</option>
                <option value="center">Tengah</option>
                <option value="right">Kanan</option>
              </select>
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
        </div>
      </div>
    </div>
  );
}
