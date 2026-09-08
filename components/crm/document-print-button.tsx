"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DocumentPrintButton({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} render={<a href={`${href}?preview=1`} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} />} nativeButton={false}>
      <Printer aria-hidden="true" />
    </Button>
  );
}
