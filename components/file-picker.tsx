"use client";

import { useId, useState } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilePicker({ name = "proof", required = false, suppliedId }: { name?: string; required?: boolean; suppliedId?: string }) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const [fileName, setFileName] = useState("Belum ada file");
  return <div className="flex items-center gap-2"><Input id={id} name={name} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={required} className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name || "Belum ada file")} /><Button variant="outline" size="sm" render={<label htmlFor={id} />} nativeButton={false}><FileUp data-icon="inline-start" aria-hidden="true" />Pilih file</Button><span className="min-w-0 truncate text-sm text-muted-foreground">{fileName}</span></div>;
}
