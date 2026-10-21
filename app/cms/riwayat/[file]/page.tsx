import { ArrowLeft, CheckCircle2, EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RestoreVersionButton } from "@/components/cms/restore-version-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readContentVersion, readSiteContent } from "@/lib/cms/store";

const HOME_LABELS: Record<string, string> = {
  hero: "Hero + keunggulan",
  products: "Katalog produk",
  process: "Proses produksi",
  why: "Mengapa memilih kami",
  clients: "Logo klien",
  testimonials: "Testimoni",
  cta: "Ajakan kontak",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "waktu tidak diketahui";
  return date.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

export default async function CmsVersionPage({ params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const [version, current] = await Promise.all([readContentVersion(file), readSiteContent()]);
  if (!version) notFound();

  const hidden = version.home.sections.filter((section) => !section.visible);

  return (
    <main className="flex flex-col gap-4">
      <Link href="/cms/riwayat" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Kembali ke riwayat
      </Link>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Versi {version.version}</h1>
            <Badge variant="outline">{version.updatedBy.name}</Badge>
            {version.version === current.version ? <Badge>Tayang sekarang</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Disimpan {formatDate(version.updatedAt)}.</p>
        </div>
        {version.version === current.version ? null : <RestoreVersionButton file={file} version={version.version} size="default" />}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Isi ringkas</CardTitle>
            <CardDescription>Gambaran konten pada versi ini.</CardDescription>
          </CardHeader>
          <CardContent className="gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Judul hero:</span> {version.home.hero.titleLine1} {version.home.hero.titleLine2}
            </p>
            <p>
              <span className="text-muted-foreground">Produk:</span> {version.products.length} total,{" "}
              {version.products.filter((product) => product.published).length} tayang
            </p>
            <p>
              <span className="text-muted-foreground">Gambar size chart:</span> {version.sizeChart.images.length}
            </p>
            <p>
              <span className="text-muted-foreground">Portofolio:</span> {version.portfolio.items.length} item
            </p>
            <p>
              <span className="text-muted-foreground">Testimoni:</span> {version.home.testimonials.items.length} item
            </p>
            <p>
              <span className="text-muted-foreground">Nomor WhatsApp:</span> {version.site.whatsapp}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bagian beranda</CardTitle>
            <CardDescription>Urutan dan bagian yang tampil pada versi ini.</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            <ol className="flex flex-col gap-1.5 text-sm">
              {version.home.sections.map((section, index) => (
                <li key={section.id} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[11px] font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span className={section.visible ? "" : "text-muted-foreground line-through"}>
                    {HOME_LABELS[section.id] ?? section.id}
                  </span>
                  {section.visible ? (
                    <CheckCircle2 aria-label="Tampil" className="size-3.5 text-emerald-600" />
                  ) : (
                    <EyeOff aria-label="Disembunyikan" className="size-3.5 text-muted-foreground" />
                  )}
                </li>
              ))}
            </ol>
            {hidden.length ? (
              <p className="text-xs text-muted-foreground">{hidden.length} bagian disembunyikan pada versi ini.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
