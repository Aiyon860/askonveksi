import {
  ArrowRight,
  ExternalLink,
  History,
  Home,
  Images,
  Layers,
  Mail,
  MousePointerClick,
  Ruler,
  Save,
  Settings2,
  Shirt,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readSiteContent } from "@/lib/cms/store";

const pages = [
  {
    href: "/cms/beranda",
    title: "Beranda",
    description: "Hero, keunggulan, katalog produk, proses, testimoni, dan ajakan kontak.",
    icon: Home,
    publicHref: "/",
  },
  {
    href: "/cms/produk",
    title: "Produk",
    description: "Tambah produk, atur induk–anak, galeri, fitur, dan gambar kartu.",
    icon: Shirt,
    publicHref: "/#produk",
  },
  {
    href: "/cms/portofolio",
    title: "Portofolio",
    description: "Judul halaman, logo klien, urutan, dan ajakan kontak.",
    icon: Images,
    publicHref: "/portofolio",
  },
  {
    href: "/cms/size-chart",
    title: "Size Chart",
    description: "Judul, deskripsi, dan seluruh gambar panduan ukuran.",
    icon: Ruler,
    publicHref: "/size-chart",
  },
  {
    href: "/cms/katalog-kain",
    title: "Katalog Kain",
    description: "Daftar kain dan pengaturan mode “Segera Hadir”.",
    icon: Layers,
    publicHref: "/katalog-kain",
  },
  {
    href: "/cms/kontak",
    title: "Halaman Kontak",
    description: "Alamat, telepon, email, FAQ, teks formulir, peta, dan CTA.",
    icon: Mail,
    publicHref: "/contact",
  },
  {
    href: "/cms/pengaturan",
    title: "Pengaturan Website",
    description: "Logo, WhatsApp, navigasi, footer, SEO global, dan teks sistem.",
    icon: Settings2,
    publicHref: "/",
  },
] as const;

const guide = [
  { icon: Upload, title: "Ganti foto", description: "Buka bagian yang ingin diubah, lalu tekan Ganti gambar." },
  { icon: MousePointerClick, title: "Ganti teks", description: "Tulis langsung di kolom yang tersedia dan lihat pratinjau di samping." },
  { icon: Layers, title: "Atur urutan", description: "Pakai tombol naik/turun atau ikon mata untuk menyembunyikan bagian." },
  { icon: Save, title: "Simpan", description: "Tekan Simpan & Tayangkan. Perubahan langsung tampil di website." },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "belum pernah";
  return date.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

export default async function CmsDashboardPage() {
  const content = await readSiteContent();
  const published = content.products.filter((product) => product.published).length;

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Kelola Website</h1>
            <Badge variant="outline">Versi {content.version}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Semua isi website Askonveksi bisa diubah dari sini. Perubahan langsung tayang setelah disimpan, dan versi
            sebelumnya selalu bisa dipulihkan.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Terakhir diubah {formatDate(content.updatedAt)} oleh {content.updatedBy.name}.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Lihat Website
        </Link>
      </section>

      <section aria-labelledby="halaman-website" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="halaman-website" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Halaman website
          </h2>
          <span className="text-xs text-muted-foreground">{published} produk tayang</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <Card key={page.href} className="group/card relative gap-3 transition-colors hover:border-foreground/25">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <Link
                      href={page.publicHref}
                      target="_blank"
                      aria-label={`Lihat halaman ${page.title}`}
                      className="relative z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                  <CardTitle>
                    <Link href={page.href} className="after:absolute after:inset-0 after:content-['']">
                      {page.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>{page.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Edit halaman
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover/card:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Mulai dalam 4 langkah</CardTitle>
            <CardDescription>Panduan singkat untuk mengubah isi website tanpa bantuan teknis.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {guide.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4" />
              Pengaman perubahan
            </CardTitle>
            <CardDescription>
              Setiap kali disimpan, versi sebelumnya dibuatkan cadangan otomatis. Salah edit bisa dikembalikan kapan saja.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/cms/riwayat"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <History aria-hidden="true" className="size-4" />
              Buka riwayat perubahan
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
