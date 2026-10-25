"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ImagePickerProps = {
  id: string;
  name: string;
  disabled?: boolean;
  existingSrc?: string | null;
  existingLabel?: string | null;
  emptyLabel?: string;
  onChange?: (file: File | null) => void;
};

/**
 * Pemilih satu gambar WhatsApp dengan pratinjau. Dipakai form campaign
 * (gambar permanen) dan broadcast (gambar sementara).
 */
export function ImagePicker({
  id,
  name,
  disabled,
  existingSrc,
  existingLabel,
  emptyLabel = "Belum ada gambar",
  onChange,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Formulir server action di-reset React setelah dikirim; input file ikut
  // kosong, jadi pratinjau juga harus dibersihkan (FormData sudah terbentuk
  // saat event submit, sehingga setTimeout tidak memotong unggahan).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleSubmit = () => {
      window.setTimeout(() => {
        setPreview(null);
        setFileName(null);
        onChange?.(null);
      }, 0);
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [onChange]);

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setFileName(null);
    onChange?.(null);
  }

  return (
    <div className="grid min-w-0 gap-2">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          setPreview((current) => {
            if (current) URL.revokeObjectURL(current);
            return file ? URL.createObjectURL(file) : null;
          });
          setFileName(file?.name ?? null);
          onChange?.(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <ImageUp data-icon="inline-start" aria-hidden="true" />
          {fileName || existingSrc ? "Ganti gambar" : "Pilih gambar"}
        </Button>
        {fileName ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear} aria-label={`Batalkan gambar ${fileName}`}>
            <X data-icon="inline-start" aria-hidden="true" />
            Batalkan
          </Button>
        ) : null}
        <p className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
          {fileName ?? existingLabel ?? emptyLabel}
        </p>
      </div>
      {preview || existingSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal/berkas privat, bukan aset statis.
        <img
          src={preview ?? existingSrc ?? undefined}
          alt="Pratinjau gambar yang akan dikirim"
          className="max-h-48 w-auto max-w-full rounded-md border object-contain"
        />
      ) : null}
    </div>
  );
}
