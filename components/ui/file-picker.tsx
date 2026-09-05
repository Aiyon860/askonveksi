"use client";

import { useRef, useState, type ComponentProps } from "react";
import { FileUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilePickerProps = Omit<ComponentProps<typeof Input>, "type" | "value"> & {
  emptyLabel?: string;
};

export function FilePicker({
  id,
  emptyLabel = "Belum ada file",
  onChange,
  ...props
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    setFileName(null);
    triggerRef.current?.focus();
  }

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <Input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        onChange={(event) => {
          setFileName(event.currentTarget.files?.[0]?.name ?? null);
          onChange?.(event);
        }}
        {...props}
      />
      <Button ref={triggerRef} type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => inputRef.current?.click()}>
        <FileUp data-icon="inline-start" aria-hidden="true" />
        Pilih file
      </Button>
      <p className="min-w-0 truncate text-sm text-muted-foreground" title={fileName ?? emptyLabel} aria-live="polite">
        {fileName ?? emptyLabel}
      </p>
      {fileName ? (
        <Button type="button" variant="ghost" size="icon" className="size-11 justify-self-start sm:size-9" aria-label={`Hapus file ${fileName}`} onClick={clearFile}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
