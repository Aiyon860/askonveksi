---
name: "ERM Askonveksi"
description: "Ruang kendali operasional konveksi yang tenang, presisi, dan cepat dipindai."
colors:
  tinta-operasional: "oklch(0.145 0 0)"
  kertas-kerja: "oklch(1 0 0)"
  kontrol-utama: "oklch(0.205 0 0)"
  teks-di-kontrol: "oklch(0.985 0 0)"
  permukaan-sekunder: "oklch(0.97 0 0)"
  abu-penanda: "oklch(0.556 0 0)"
  garis-kerja: "oklch(0.922 0 0)"
  cincin-fokus: "oklch(0.708 0 0)"
  destruktif: "oklch(0.577 0.245 27.325)"
  ruang-gelap: "oklch(0.145 0 0)"
  panel-gelap: "oklch(0.205 0 0)"
  aksen-sidebar-gelap: "oklch(0.488 0.243 264.376)"
typography:
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.429
    letterSpacing: "normal"
  data:
    fontFamily: "Geist Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
    letterSpacing: "normal"
rounded:
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
  xl: "calc(0.625rem * 1.4)"
  pill: "9999px"
spacing:
  control-gap: "0.375rem"
  control-x: "0.625rem"
  panel-padding: "1rem"
  section-gap: "1.5rem"
  page-gutter: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.kontrol-utama}"
    textColor: "{colors.teks-di-kontrol}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.kertas-kerja}"
    textColor: "{colors.tinta-operasional}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.permukaan-sekunder}"
    textColor: "{colors.kontrol-utama}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-operasional}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "oklch(0.577 0.245 27.325 / 10%)"
    textColor: "{colors.destruktif}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.kontrol-utama}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.control-x}"
    height: "2.25rem"
  status-panel:
    backgroundColor: "{colors.kertas-kerja}"
    textColor: "{colors.tinta-operasional}"
    typography: "{typography.data}"
    rounded: "{rounded.md}"
    padding: "{spacing.panel-padding}"
---

# Design System: ERM Askonveksi

## Overview

**Creative North Star: "Ruang Kendali Konveksi"**

ERM Askonveksi terasa seperti ruang kendali yang tenang: informasi operasional disusun agar status, angka, dan tindakan dapat dikenali tanpa kebisingan visual. Palet monokrom, tipografi sans yang lugas, serta kepadatan komponen yang ringkas menjadikan data sebagai pusat perhatian.

Sistem ini tidak mengejar kesan dekoratif. Karakternya profesional, presisi, dan terkendali, tetapi tetap membumi untuk pengguna lintas divisi. Identitas muncul melalui disiplin hierarki, konsistensi status, dan ritme kerja—bukan melalui ornamen atau warna yang belum memiliki dasar merek.

**Key Characteristics:**

- Netral dan berorientasi informasi.
- Ringkas tanpa terasa sesak.
- Lapisan tonal lebih utama daripada bayangan.
- Tindakan dan status terbaca dengan cepat.
- Kontras serta fokus interaktif memenuhi kebutuhan WCAG Level AA.

## Colors

Palet memakai karakter **Tinta Operasional**, **Kertas Kerja**, dan **Abu Penanda**: perbedaan terang-gelap membangun hierarki, sementara warna kromatik diperlakukan sebagai pengecualian semantik.

### Primary

- **Tinta Operasional:** dipakai untuk teks utama dan informasi yang harus memiliki otoritas tertinggi.
- **Kontrol Utama:** dipakai pada tindakan primer dan permukaan kontrol berkontras tinggi.
- **Teks di Kontrol:** memastikan label pada kontrol utama tetap jelas di atas permukaan gelap.

### Tertiary

- **Destruktif:** khusus untuk kesalahan, validasi gagal, dan tindakan yang berpotensi merusak data.
- **Aksen Sidebar Gelap:** token tema gelap yang sudah tersedia untuk keadaan aktif pada sidebar; bukan aksen merek umum.

### Neutral

- **Kertas Kerja:** kanvas utama serta permukaan kartu pada tema terang.
- **Permukaan Sekunder:** pengelompokan halus, keadaan hover, dan area pendukung.
- **Abu Penanda:** metadata dan teks sekunder.
- **Garis Kerja:** batas bidang, input, dan pemisah yang tidak boleh mendominasi.
- **Cincin Fokus:** penanda fokus keyboard yang terlihat tanpa mengambil alih hierarki.
- **Ruang Gelap dan Panel Gelap:** pasangan kanvas serta permukaan pada tema gelap.

**The Monochrome Authority Rule.** Bangun hierarki utama melalui terang-gelap, tipografi, jarak, dan struktur; jangan menambahkan aksen warna dekoratif sebelum identitas merek menetapkannya.

**The Exception Color Rule.** Warna destruktif hanya muncul ketika maknanya benar-benar destruktif atau bermasalah, bukan sebagai cara menarik perhatian umum.

## Typography

**Display Font:** Inter dengan fallback Arial dan sans-serif  
**Body Font:** Inter dengan fallback Arial dan sans-serif  
**Label/Mono Font:** Inter untuk label; Geist Mono untuk data teknis dan keluaran sistem

**Character:** Inter menjaga teks operasional tetap netral dan cepat dipindai. Geist Mono memisahkan identifier, respons sistem, serta data teknis tanpa membuat keseluruhan antarmuka terasa seperti alat developer.

### Hierarchy

- **Title:** bobot tebal untuk judul halaman atau panel utama; skala yang teramati adalah 1.5rem dengan line-height 1.333.
- **Body:** bobot regular untuk penjelasan singkat dan metadata; skala yang teramati adalah 0.875rem dengan line-height 1.429.
- **Label:** bobot medium untuk tombol dan kontrol; tetap ringkas pada 0.875rem.
- **Data:** Geist Mono hanya untuk nilai atau respons yang membutuhkan pembacaan karakter secara presisi.

**The One Sans Voice Rule.** Inter menjadi suara utama untuk heading, body, dan kontrol; jangan mencampur Geist Sans hanya karena font tersebut ikut dimuat oleh scaffold.

**The Data Voice Rule.** Gunakan mono untuk identifier, kode, atau keluaran teknis—bukan untuk paragraf, navigasi, dan label tindakan sehari-hari.

## Layout

Implementasi saat ini membuktikan model satu kolom terpusat dengan lebar baca terbatas, gutter halaman 2rem, serta jarak antarkelompok 1.5rem. Ini adalah ritme yang sah untuk login, formulir fokus, dan state utilitas; belum ada bukti kode untuk grid dashboard, sidebar aplikasi, atau breakpoint produk.

Layar Operate berikutnya harus mempertahankan scanability: kelompokkan data berdasarkan pekerjaan, tempatkan tindakan dekat dengan objek yang dipengaruhinya, dan turunkan layout secara bertahap menjadi satu kolom di ruang sempit. Nilai breakpoint dan grid dashboard harus dikarbonisasi dari implementasi pertama, bukan dikarang di dokumen ini.

**The Work-Zone Rule.** Satu wilayah visual harus menjawab satu pekerjaan utama; jangan menggabungkan ringkasan, tabel, dan formulir panjang dalam kartu serbaguna tanpa hierarki.

## Elevation & Depth

Sistem menggunakan lapisan tonal dan garis halus sebagai sumber kedalaman utama. Bayangan hanya terlihat secara terbatas pada varian outline dan belum membentuk kosakata elevasi mandiri. Permukaan diam tetap tenang; fokus, hover, dan keadaan aktif memberi perubahan yang lebih terasa daripada bayangan permanen.

**The Tonal-First Rule.** Pisahkan tingkat informasi dengan warna permukaan dan batas terlebih dahulu; gunakan bayangan hanya ketika sebuah elemen benar-benar berada di atas konteksnya.

## Shapes

Bahasa bentuk memakai sudut yang lembut dan terukur. Radius dasar 0.625rem menghasilkan radius kontrol medium melalui token turunan, sehingga tombol, panel, dan bidang masukan terasa konsisten tanpa menjadi terlalu bulat.

Tombol berbentuk pil pada halaman pengujian koneksi adalah gaya lokal scaffold, bukan bentuk komponen kanonis. Komponen bersama memakai sudut medium dan respons aktif berupa pergeseran vertikal satu piksel.

**The Controlled Curve Rule.** Gunakan radius medium untuk kontrol dan panel; bentuk pil hanya untuk kategori yang secara semantik memang kapsul, seperti filter singkat atau status padat.

## Components

Komponen terasa ringkas, tegas, dan terkendali. State interaksi harus terlihat melalui perubahan tonal, cincin fokus, atau gerakan kecil tanpa animasi dekoratif.

### Buttons

- **Shape:** sudut medium berbasis token radius, tinggi default 2.25rem, jarak ikon 0.375rem, dan padding horizontal 0.625rem.
- **Primary:** permukaan Kontrol Utama dengan Teks di Kontrol; hover mengurangi opasitas warna utama.
- **Outline:** permukaan Kertas Kerja dengan Garis Kerja; hover berpindah ke Permukaan Sekunder.
- **Secondary:** Permukaan Sekunder dengan teks berotoritas tinggi.
- **Ghost:** transparan saat diam dan memakai lapisan muted saat hover.
- **Destructive:** sapuan merah transparan dengan teks Destruktif; tidak meniru dominasi tombol primer.
- **Link:** teks primer dengan underline hanya saat hover.
- **Focus / Active:** fokus keyboard memakai border dan cincin tiga piksel; active memberi pergeseran vertikal satu piksel.
- **Disabled:** interaksi dimatikan dan opasitas turun menjadi 50%.

### Cards / Containers

- **Corner Style:** sudut medium yang mengikuti keluarga radius.
- **Background:** Kertas Kerja pada tema terang dan Panel Gelap pada tema gelap.
- **Shadow Strategy:** tanpa bayangan permanen; gunakan garis atau lapisan tonal.
- **Border:** Garis Kerja pada tema terang dan garis putih transparan pada tema gelap.
- **Internal Padding:** 1rem pada panel status yang teramati.

### Status Panel

Panel status adalah pola aktual untuk menampilkan hasil proses atau respons koneksi. Ia memakai font data, dapat mematahkan string panjang, dan mempertahankan kontras yang jelas pada tema terang maupun gelap. Untuk status produk berikutnya, ikon atau warna tidak boleh menjadi satu-satunya pembeda; selalu sertakan label teks.

## Do's and Don'ts

### Do:

- **Do** susun halaman sebagai ruang kerja yang jelas, dengan status dan tindakan utama mudah ditemukan.
- **Do** gunakan token semantik; satu nilai visual harus tetap bermakna sama pada tema terang dan gelap.
- **Do** pertahankan cincin fokus keyboard, state disabled, dan penanda error yang sudah tersedia pada komponen.
- **Do** gunakan Bahasa Indonesia yang singkat dan operasional pada label serta status.
- **Do** tampilkan label teks bersama warna atau ikon status untuk memenuhi kebutuhan aksesibilitas.

### Don't:

- **Don't** menambahkan warna aksen dekoratif atau gradien sebelum keputusan identitas merek dibuat.
- **Don't** membuat seluruh kartu melayang dengan bayangan; kedalaman default berasal dari lapisan tonal dan batas.
- **Don't** menggunakan bentuk pil untuk semua tombol dan bidang.
- **Don't** mencampur Inter, Geist Sans, dan Geist Mono tanpa fungsi yang jelas.
- **Don't** meniru template admin generik melalui grid kartu identik tanpa prioritas informasi atau konteks pekerjaan.
