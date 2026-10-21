"use client";

import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FieldRenderer } from "@/components/cms/field-renderer";
import { PreviewPane } from "@/components/cms/preview-pane";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveContentAction } from "@/lib/cms/actions";
import { cmsFieldKey, type CmsEditorPage } from "@/lib/cms/editors";
import { setAtPath } from "@/lib/cms/paths";
import type { CmsSiteContent } from "@/lib/cms/types";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "belum pernah";
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function CmsEditor({
  page,
  initialContent,
  productId,
}: {
  page: CmsEditorPage;
  initialContent: CmsSiteContent;
  productId?: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [version, setVersion] = useState(initialContent.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [pendingDraft, setPendingDraft] = useState<CmsSiteContent | null>(null);
  const draftKey = `cms-draft-${page.id}`;

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Pengaman lokal: perubahan yang belum disimpan tidak hilang bila tab tertutup.
  // Dibaca setelah paint agar tidak membenturkan hasil render server dan klien.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as CmsSiteContent;
        if (parsed && parsed.version === initialContent.version) setPendingDraft(parsed);
        else window.localStorage.removeItem(draftKey);
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, initialContent.version]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(content));
      } catch {
        // Kuota penyimpanan penuh: abaikan, konten tetap ada selama tab terbuka.
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [content, dirty, draftKey]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // abaikan
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await saveContentAction(content, version);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = { ...content, version: result.version, updatedAt: result.updatedAt };
    setContent(next);
    setSavedContent(next);
    setVersion(result.version);
    setDirty(false);
    clearDraft();
    setPendingDraft(null);
    setMessage("Perubahan sudah tersimpan dan tayang di website.");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void handleSave();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onChange(path: string, value: unknown) {
    setContent((current) => (path ? setAtPath(current, path, value) : (value as CmsSiteContent)));
    setDirty(true);
    setMessage(null);
    setError(null);
  }

  function discard() {
    setContent(savedContent);
    setVersion(savedContent.version);
    setDirty(false);
    clearDraft();
    setPendingDraft(null);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
            {dirty ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Belum disimpan</span> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{page.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Terakhir disimpan {formatDate(content.updatedAt)} oleh {content.updatedBy.name}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" nativeButton={false} render={<Link href="/" target="_blank" />}>
            <ExternalLink aria-hidden="true" />
            Lihat Website
          </Button>
          <Button type="button" variant="ghost" onClick={discard} disabled={!dirty || saving}>
            <RotateCcw aria-hidden="true" />
            Batalkan
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan & Tayangkan"}
          </Button>
        </div>
      </div>

      {pendingDraft ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Ada perubahan yang belum disimpan dari sesi sebelumnya di perangkat ini.</span>
          <span className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setContent(pendingDraft);
                setVersion(pendingDraft.version);
                setDirty(true);
                setPendingDraft(null);
              }}
            >
              Lanjutkan perubahan
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { clearDraft(); setPendingDraft(null); }}>
              Mulai dari versi tersimpan
            </Button>
          </span>
        </div>
      ) : null}

      {message ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 xl:hidden">
        <Button type="button" size="sm" variant={tab === "edit" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("edit")}>
          Isi
        </Button>
        <Button type="button" size="sm" variant={tab === "preview" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("preview")}>
          Pratinjau
        </Button>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className={`min-w-0 ${tab === "preview" ? "hidden xl:block" : ""}`}>
          <CardContent className="gap-4">
            {page.fields.map((field, index) => (
              <FieldRenderer key={cmsFieldKey(field, index)} field={field} content={content} onChange={onChange} />
            ))}
          </CardContent>
        </Card>

        <aside className={`min-w-0 ${tab === "edit" ? "hidden xl:block" : ""}`}>
          <div className="xl:sticky xl:top-4">
            <PreviewPane page={page.preview} content={content} productId={productId} />
          </div>
        </aside>
      </div>
    </div>
  );
}
