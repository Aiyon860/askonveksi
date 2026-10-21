"use client";

import { Laptop, Loader2, RotateCw, Smartphone, Tablet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CmsPreviewTarget } from "@/lib/cms/editors";
import type { CmsSiteContent } from "@/lib/cms/types";

const WIDTHS: Record<"desktop" | "tablet" | "mobile", number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

export function PreviewPane({
  page,
  content,
  productId,
}: {
  page: CmsPreviewTarget;
  content: CmsSiteContent;
  productId?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [scale, setScale] = useState(0.45);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const available = element.clientWidth - 2;
      setScale(Math.min(1, available / WIDTHS[device]));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [device]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("cms-preview-data", JSON.stringify({ page, content, productId }));
    } catch {}
  }, [content, page, productId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "cms-preview-ready") setReady(true);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "cms-preview-ping" },
          window.location.origin,
        );
      } catch {}
    }, 250);
    return () => window.clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms-preview", page, content, productId },
      window.location.origin,
    );
  }, [content, page, productId, ready]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant={device === "desktop" ? "secondary" : "ghost"} onClick={() => setDevice("desktop")}>
            <Laptop aria-hidden="true" />
            Desktop
          </Button>
          <Button type="button" size="sm" variant={device === "tablet" ? "secondary" : "ghost"} onClick={() => setDevice("tablet")}>
            <Tablet aria-hidden="true" />
            Tablet
          </Button>
          <Button type="button" size="sm" variant={device === "mobile" ? "secondary" : "ghost"} onClick={() => setDevice("mobile")}>
            <Smartphone aria-hidden="true" />
            HP
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!ready ? <Loader2 aria-hidden="true" className="size-3 animate-spin" /> : null}
          Pratinjau langsung
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Muat ulang pratinjau"
            onClick={() => {
              setReady(false);
              setReloadKey((current) => current + 1);
            }}
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative overflow-auto rounded-lg border border-border bg-white">
        {ready ? null : (
          <div className="absolute inset-x-0 top-0 z-10 m-auto mt-4 w-fit rounded-full bg-foreground px-3 py-1 text-xs text-background">
            Menyiapkan pratinjau…
          </div>
        )}
        <div style={{ height: 900 * scale }}>
          <iframe
            ref={iframeRef}
            key={reloadKey}
            src="/cms-preview"
            title="Pratinjau website"
            className="origin-top-left border-0 bg-white"
            style={{ width: WIDTHS[device], height: 900, transform: `scale(${scale})` }}
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: "cms-preview-ping" },
                window.location.origin,
              );
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pratinjau memakai konten yang belum disimpan. Klik <strong>Simpan &amp; Tayangkan</strong> agar pengunjung melihat perubahan.
      </p>
    </div>
  );
}
