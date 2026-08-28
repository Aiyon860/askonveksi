import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERM ASKonveksi",
  description: "Sistem operasional terpadu untuk bisnis konveksi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`h-full antialiased ${inter.variable} ${geistMono.variable}`}>
      <body className="flex min-h-full flex-col font-sans">
        <span
          aria-hidden="true"
          className="hidden"
          dangerouslySetInnerHTML={{
            __html:
              "<!-- THESIS: Ruang kendali CRM yang menempatkan status dan tindakan di depan, bukan dashboard kartu generik. OWN-WORLD: monokrom, garis kerja tipis, bidang tonal, kontrol ringkas, data bernomor mono. STORY: pengguna melihat pipeline, membuka konteks customer, menerbitkan quotation, lalu mengunci Deal menjadi Sales Order. FIRST VIEWPORT: navigasi kerja tetap di kiri pada desktop; judul, aksi utama, pesan sistem, lalu kanban lima kolom. FORM: Operate, established-world extension, code-first. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->",
          }}
        />
        {children}
      </body>
    </html>
  );
}
