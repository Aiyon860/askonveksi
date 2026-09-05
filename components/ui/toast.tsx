"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const toast = ToastPrimitive.createToastManager();

function ToastIcon({ type }: { type: string | undefined }) {
  const Icon = type === "success" ? CircleCheck : type === "warning" ? TriangleAlert : type === "error" ? OctagonX : type === "loading" ? Loader2 : Info;
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", type === "error" && "text-destructive", type === "warning" && "text-warning", type === "success" && "text-success", type === "loading" && "animate-spin")} />;
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((item) => (
    <ToastPrimitive.Root
      key={item.id}
      toast={item}
      className="pointer-events-auto relative w-full rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none transition duration-200 data-ending-style:-translate-y-2 data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ToastPrimitive.Content className="flex items-start gap-3 p-4">
        <ToastIcon type={item.type} />
        <div className="min-w-0 flex-1">
          <ToastPrimitive.Title className="text-sm font-medium" />
          <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground" />
        </div>
        <ToastPrimitive.Close aria-label="Tutup notifikasi" render={<Button variant="ghost" size="icon-sm" />} className="-mr-1 -mt-1 shrink-0 text-muted-foreground hover:text-foreground"><X aria-hidden="true" /></ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ));
}

export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider toastManager={toast} timeout={6000}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none"><ToastList /></ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

export { toast };
