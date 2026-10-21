import { Eye, History } from "lucide-react";
import Link from "next/link";

import { RestoreVersionButton } from "@/components/cms/restore-version-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listContentVersions, readSiteContent } from "@/lib/cms/store";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "waktu tidak diketahui";
  return date.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

export default async function CmsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ restored?: string }>;
}) {
  const [content, versions, params] = await Promise.all([readSiteContent(), listContentVersions(), searchParams]);

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Riwayat Perubahan</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Setiap penyimpanan membuat cadangan versi sebelumnya. Pilih versi untuk melihat isinya, lalu pulihkan bila
          diperlukan. Memulihkan versi tidak menghapus riwayat.
        </p>
      </section>

      {params.restored ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Versi berhasil dipulihkan dan sudah tayang di website.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History aria-hidden="true" className="size-4" />
            Versi aktif
          </CardTitle>
          <CardDescription>
            Versi {content.version} · disimpan {formatDate(content.updatedAt)} oleh {content.updatedBy.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tersimpan {content.products.length} produk, {content.sizeChart.images.length} gambar size chart, dan{" "}
            {content.portfolio.items.length} item portofolio.
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="daftar-versi" className="flex flex-col gap-3">
        <h2 id="daftar-versi" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Cadangan versi sebelumnya
        </h2>

        {versions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada cadangan. Cadangan dibuat otomatis saat Anda menyimpan perubahan berikutnya.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((version) => (
              <article
                key={version.file}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">Versi {version.version}</h3>
                    <Badge variant="outline">{version.updatedBy}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(version.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/cms/riwayat/${version.file}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <Eye aria-hidden="true" className="size-3.5" />
                    Lihat
                  </Link>
                  <RestoreVersionButton file={version.file} version={version.version} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
