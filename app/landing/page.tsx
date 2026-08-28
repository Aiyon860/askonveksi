import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Camera,
  MessageCircle,
  Package,
  Shirt,
  Sparkles,
  Tags,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clients = ["AKPOL", "BANK BRI", "BPN", "PMI", "PNM"];

const products = [
  { name: "Kemeja PDH", description: "Untuk kebutuhan kantor, komunitas, dan organisasi.", icon: Shirt },
  { name: "Kaos & Polo", description: "Untuk acara, tim, promosi, dan pakaian harian.", icon: Tags },
  { name: "Jersey", description: "Seragam olahraga dengan desain yang dapat disesuaikan.", icon: Sparkles },
  { name: "Jaket & Rompi", description: "Outerwear untuk tim, operasional, dan kebutuhan lapangan.", icon: Package },
  { name: "Merchandise", description: "Lanyard dan totebag untuk melengkapi identitas organisasi.", icon: BadgeCheck },
] as const;

const whatsappUrl = "https://wa.me/";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <nav className="border-b bg-background" aria-label="Navigasi utama">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 rounded-md font-bold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Image
              src="/brand/askonveksi-mark.png"
              alt=""
              width={494}
              height={410}
              className="h-8 w-auto"
              priority
            />
            <span>ASKONVEKSI</span>
          </Link>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            <MessageCircle data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">WhatsApp Kami</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </nav>

      <section className="border-b bg-background" aria-labelledby="hero-title">
        <div className="mx-auto grid min-h-[560px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="max-w-2xl">
            <h1 id="hero-title" className="text-balance text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Rajanya Pembuatan Seragam
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Jasa Konveksi, Screen Printing &amp; Embroidery kualitas terbaik di Semarang.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
                Gratis Konsultasi &amp; Desain
                <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
              </a>
              <p className="max-w-56 text-sm leading-5 text-muted-foreground">Diskusikan kebutuhan seragam Anda bersama tim kami.</p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md" aria-label="Identitas dan layanan ASKONVEKSI">
            <div className="rounded-xl border bg-muted/50 px-6 py-8 sm:px-8">
              <Image
                src="/brand/askonveksi-logo.png"
                alt="Logo AS Konveksi"
                width={591}
                height={591}
                className="mx-auto h-auto w-full max-w-80"
                priority
              />
              <div className="grid grid-cols-1 gap-2 border-t pt-5 text-center text-xs font-medium text-muted-foreground sm:grid-cols-3">
                <span>Konveksi</span>
                <span>Screen Printing</span>
                <span>Embroidery</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/50" aria-labelledby="clients-title">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <p id="clients-title" className="text-center text-sm font-medium text-muted-foreground">
            Logo klien — placeholder
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-x-6 gap-y-5 sm:grid-cols-5">
            {clients.map((client) => (
              <div key={client} className="text-center text-sm font-semibold tracking-wide text-muted-foreground">{client}</div>
            ))}
          </div>
        </div>
      </section>

      <section id="katalog" className="py-16 sm:py-20" aria-labelledby="catalog-title">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 id="catalog-title" className="text-2xl font-bold leading-8">Katalog produk</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Pilihan kebutuhan konveksi untuk tim, instansi, komunitas, dan acara.
            </p>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <article key={product.name} className="group flex min-h-52 flex-col bg-card p-5 transition-colors duration-150 hover:bg-muted/50">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="mt-auto pt-10">
                    <h3 className="text-base font-semibold">{product.name}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{product.description}</p>
                  </div>
                </article>
              );
            })}
            <div className="flex min-h-52 flex-col justify-between bg-secondary p-5">
              <p className="text-sm font-medium">Kebutuhan lainnya?</p>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                Tanyakan produk
                <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-muted/50">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 border-b pb-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-xl font-bold">Siap membuat seragam Anda?</p>
              <p className="mt-1 text-sm text-muted-foreground">Konsultasikan kebutuhan produksi bersama ASKONVEKSI.</p>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={buttonVariants({ size: "lg" })}>
              <MessageCircle data-icon="inline-start" aria-hidden="true" />
              WhatsApp Kami
            </a>
          </div>
          <div className="flex flex-col gap-5 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/brand/askonveksi-logo.png"
                alt="AS Konveksi"
                width={591}
                height={591}
                className="h-20 w-auto shrink-0"
              />
              <p>&copy; {new Date().getFullYear()} ASKONVEKSI.<br />Seluruh hak cipta dilindungi.</p>
            </div>
            <a
              href="https://www.instagram.com/askonveksi_/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Camera className="size-4" aria-hidden="true" />
              @askonveksi_
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
