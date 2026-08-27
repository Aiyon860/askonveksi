"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  function handleDemoLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/40 px-4 py-10 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground/15"
      />

      <section
        aria-labelledby="login-title"
        className="w-full max-w-md rounded-xl border bg-background p-5 sm:p-8"
      >
        <header className="flex flex-col items-center text-center">
          <Image
            src="/brand/askonveksi-logo.png"
            alt="AS Konveksi"
            width={591}
            height={591}
            priority
            className="h-auto w-24 object-contain sm:w-28"
          />

          <div className="mt-5 flex flex-col gap-2">
            <h1
              id="login-title"
              className="text-2xl font-bold tracking-tight text-balance"
            >
              Selamat datang kembali
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground text-pretty">
              Masuk ke portal internal ASKONVEKSI untuk melanjutkan pekerjaan dan
              memantau kondisi operasional.
            </p>
          </div>
        </header>

        <form onSubmit={handleDemoLogin} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="nama@askonveksi.com"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <span
                aria-disabled="true"
                title="Pemulihan password segera tersedia"
                className="cursor-not-allowed text-xs font-medium text-muted-foreground"
              >
                Lupa password · Segera tersedia
              </span>
            </div>
            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Masukkan password"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-1 w-full">
            Masuk ke Dashboard
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </form>

        <div className="mt-5 rounded-md bg-muted px-3 py-2.5 text-center text-xs leading-5 text-muted-foreground">
          Mode demonstrasi — data login tidak dikirim atau disimpan. Akun resmi
          nantinya dibuat melalui undangan administrator.
        </div>

        <footer className="mt-8 flex flex-col items-center gap-2 border-t pt-5 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span>© 2026 ASKONVEKSI</span>
          <Link
            href="/landing"
            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Kembali ke website
          </Link>
        </footer>
      </section>
    </main>
  );
}
