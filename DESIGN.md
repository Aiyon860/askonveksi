---
name: "ERM Askonveksi"
description: "Ruang kendali operasional konveksi yang tenang, presisi, cepat dipindai, dengan warna semantik sebagai sinyal kerja."
colors:
  tinta-operasional: "oklch(0.145 0 0)"
  kertas-kerja: "oklch(1 0 0)"
  kanvas-kerja: "oklch(0.985 0 0)"
  kanvas-operate: "oklch(0.962 0.007 256)"
  kontrol-utama: "oklch(0.47 0.19 258)"
  permukaan-aksen: "oklch(0.47 0.19 258)"
  sidebar-navy-elegan: "oklch(0.28 0.06 262)"
  teks-di-kontrol: "oklch(0.985 0 0)"
  permukaan-sekunder: "oklch(0.97 0 0)"
  abu-penanda: "oklch(0.556 0 0)"
  garis-kerja: "oklch(0.922 0 0)"
  cincin-fokus: "oklch(0.57 0.17 250)"
  destruktif: "oklch(0.577 0.245 27.325)"
  ruang-gelap: "oklch(0.145 0 0)"
  panel-gelap: "oklch(0.205 0 0)"
  aksen-biru: "oklch(0.47 0.19 258)"
  sukses: "oklch(0.46 0.12 151)"
  peringatan: "oklch(0.52 0.13 72)"
  informasi: "oklch(0.47 0.13 240)"
  koral-masalah: "oklch(0.55 0.19 27)"
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
    fontFamily: "Inter, Arial, sans-serif"
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
  panel-padding-compact: "1rem"
  panel-padding: "1.25rem"
  panel-padding-comfortable: "1.5rem"
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

ERM Askonveksi terasa seperti ruang kendali yang tenang: informasi operasional disusun agar status, angka, dan tindakan dapat dikenali tanpa kebisingan visual. Kanvas putih dan biru kerja tetap menjadi dasar; hijau, amber, koral, dan biru muda menandai hasil, perhatian, masalah, dan informasi operasional secara terkendali.

Sistem ini tidak mengejar kesan dekoratif. Karakternya profesional, presisi, dan terkendali, tetapi tetap membumi untuk pengguna lintas divisi. Identitas muncul melalui disiplin hierarki, konsistensi status, dan ritme kerja—bukan melalui ornamen atau warna yang belum memiliki dasar merek.

**Key Characteristics:**

- Netral dan berorientasi informasi.
- Ringkas tanpa terasa sesak.
- Lapisan tonal lebih utama daripada bayangan.
- Tindakan dan status terbaca dengan cepat.
- Kontras serta fokus interaktif memenuhi kebutuhan WCAG Level AA.

## Colors

Palet memakai karakter **Tinta Operasional**, **Kertas Kerja**, dan **Abu Penanda**. Perbedaan terang-gelap membangun hierarki, sementara biru menunjukkan tindakan atau pilihan utama dan warna status dipakai pada ringkasan, badge, progres, grafik, serta keadaan kosong.

### Primary

- **Tinta Operasional:** dipakai untuk teks utama dan informasi yang harus memiliki otoritas tertinggi.
- **Kontrol Utama:** biru operasional untuk tindakan primer, navigasi aktif, tab aktif, tautan utama, dan pilihan terpilih.
- **Teks di Kontrol:** memastikan label pada kontrol utama tetap jelas di atas permukaan gelap.

### Tertiary

- **Destruktif:** khusus untuk kesalahan, validasi gagal, dan tindakan yang berpotensi merusak data.
- **Aksen Biru:** identitas kerja yang dipakai konsisten pada navigasi dan kontrol, bukan sebagai sapuan dekoratif pada bidang besar.
- **Sukses:** hijau untuk pekerjaan selesai, hasil positif, dan omzet.
- **Peringatan:** amber untuk pekerjaan tertunda atau yang memerlukan perhatian.
- **Informasi:** biru muda untuk status baru serta informasi operasional.
- **Koral Masalah:** untuk keterlambatan, perbaikan, dan kegagalan.

### Neutral

- **Kertas Kerja:** permukaan kartu pada tema terang.
- **Kanvas Operate:** kanvas halaman aplikasi; sedikit lebih gelap dan lebih dingin daripada Kertas Kerja, sehingga kartu putih mempunyai tepi tonal tanpa perlu garis.
- **Permukaan Sekunder:** pengelompokan halus, keadaan hover, dan area pendukung.
- **Abu Penanda:** metadata dan teks sekunder.
- **Garis Kerja:** batas bidang, input, dan pemisah yang tidak boleh mendominasi.
- **Cincin Fokus:** penanda fokus keyboard yang terlihat tanpa mengambil alih hierarki.
- **Ruang Gelap dan Panel Gelap:** pasangan kanvas serta permukaan pada tema gelap.

**The Blue Discipline Rule.** Bangun hierarki utama melalui terang-gelap, tipografi, jarak, dan struktur. Biru menandai tindakan, pilihan, fokus, atau data utama; jangan memenuhi banyak panel dengan biru sekaligus.

**The Accent Anchor Rule.** Setiap kelompok angka boleh mempunyai satu bidang aksen biru penuh sebagai jangkar—yaitu angka terpenting di kelompok itu, dan hanya satu. Sisanya tetap kartu putih; warna hadir sebagai penanda prioritas, bukan sebagai latar.

**The Exception Color Rule.** Warna destruktif hanya muncul ketika maknanya benar-benar destruktif atau bermasalah, bukan sebagai cara menarik perhatian umum.

**The Semantic Tint Rule.** Gunakan pasangan surface lembut dan foreground berkontras untuk status dan ringkasan. Tabel, formulir, dan kartu kerja tetap putih agar data harian mudah dipindai; tint tidak menjadi bidang warna besar atau pembeda modul.

## Typography

**Display Font:** Inter dengan fallback Arial dan sans-serif  
**Body Font:** Inter dengan fallback Arial dan sans-serif  
**Label/Data Font:** Inter untuk label, data teknis, dan keluaran sistem

**Character:** Inter menjaga teks operasional tetap netral dan cepat dipindai. Seluruh antarmuka memakai satu keluarga: yang memisahkan identifier, respons sistem, dan data teknis dari prosa adalah bobot, warna, ukuran, serta angka tabular—bukan pergantian jenis huruf.

### Hierarchy

- **Title:** bobot tebal untuk judul halaman atau panel utama; skala yang teramati adalah 1.5rem dengan line-height 1.333.
- **Body:** bobot regular untuk penjelasan singkat dan metadata; skala yang teramati adalah 0.875rem dengan line-height 1.429.
- **Label:** bobot medium untuk tombol dan kontrol; tetap ringkas pada 0.875rem.
- **Data:** Inter dengan angka tabular untuk nilai atau respons yang membutuhkan pembacaan karakter secara presisi.

**The One Sans Voice Rule.** Inter adalah satu-satunya keluarga huruf antarmuka—heading, body, kontrol, dan data. Jangan menambahkan keluarga kedua tanpa alasan fungsional.

**The Data Voice Rule.** Bedakan identifier, kode, dan keluaran teknis dari prosa melalui bobot, warna, dan angka tabular; kelas `font-mono` menandai peran itu, bukan jenis hurufnya. Jangan pakai penanda ini untuk paragraf, navigasi, atau label tindakan.

## Layout

Workspace menggunakan sidebar 15rem pada desktop, drawer pada layar kecil, gutter responsif 1rem hingga 2rem, serta jarak antarkelompok 1.5rem. Sidebar memakai navy elegan sebagai bidang gelap, teks putih kebiruan di atasnya, dan item aktifnya adalah satu bidang putih penuh dengan teks navy—bukan satu-satunya tempat warna pada halaman. Kanvas halaman aplikasi memakai Kanvas Operate. Login dan formulir fokus menggunakan satu kolom terpusat. Landing page memakai keluarga token yang sama dengan ritme yang lebih lega.

Layar Operate berikutnya harus mempertahankan scanability: kelompokkan data berdasarkan pekerjaan, tempatkan tindakan dekat dengan objek yang dipengaruhinya, dan turunkan layout secara bertahap menjadi satu kolom di ruang sempit. Nilai breakpoint dan grid dashboard harus dikarbonisasi dari implementasi pertama, bukan dikarang di dokumen ini.

**The Work-Zone Rule.** Satu wilayah visual harus menjawab satu pekerjaan utama; jangan menggabungkan ringkasan, tabel, dan formulir panjang dalam kartu serbaguna tanpa hierarki.

## Elevation & Depth

Permukaan Operate memakai tiga lapisan, masing-masing dengan satu cara menyatakan kedalaman:

1. **Kanvas Operate**—bidang dasar halaman.
2. **Kartu panel**—permukaan putih dengan satu bayangan lembut: offset kecil, blur lebar, warna diturunkan dari tinta operasional. Tanpa garis.
3. **Bidang tonal di dalam kartu**—tint semantik atau tint tahap, tanpa bayangan, karena lapisannya berada di bawah permukaan, bukan di atasnya.

Tidak ada lapisan yang memakai garis dan bayangan sekaligus. Permukaan diam tetap tenang; fokus, hover, dan keadaan aktif tetap memberi perubahan yang lebih terasa daripada bayangan.

**The One Elevation Rule.** Satu bayangan panel berlaku untuk seluruh kartu Operate; kedalaman berikutnya datang dari langkah tonal, bukan dari menambahkan bayangan kedua.

**The Tonal-First Rule.** Pisahkan tingkat informasi dengan warna permukaan terlebih dahulu; bayangan hanya menandai bahwa sebuah bidang berada di atas kanvas.

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

- **Corner Style:** radius panel 0.625rem; radius yang lebih kecil dipakai untuk kontrol dan badge.
- **Background:** Kertas Kerja pada tema terang dan Panel Gelap pada tema gelap.
- **Shadow Strategy:** tanpa bayangan permanen; gunakan garis atau lapisan tonal.
- **Border:** Garis Kerja pada tema terang dan garis putih transparan pada tema gelap.
- **Internal Padding:** compact 1rem, default 1.25rem, comfortable 1.5rem.
- **Equal Height:** hanya card sejajar yang membandingkan jenis informasi sama memakai tinggi seragam; card konten mengikuti isinya.

### Status Panel

Panel status adalah pola aktual untuk menampilkan hasil proses atau respons koneksi. Ia memakai font data, dapat mematahkan string panjang, dan mempertahankan kontras yang jelas pada tema terang maupun gelap. Untuk status produk berikutnya, ikon atau warna tidak boleh menjadi satu-satunya pembeda; selalu sertakan label teks.

## Do's and Don'ts

### Do:

- **Do** susun halaman sebagai ruang kerja yang jelas, dengan status dan tindakan utama mudah ditemukan.
- **Do** gunakan token semantik; satu nilai visual harus tetap bermakna sama pada tema terang dan gelap.
- **Do** pertahankan cincin fokus keyboard, state disabled, dan penanda error yang sudah tersedia pada komponen.
- **Do** gunakan Bahasa Indonesia yang singkat dan operasional pada label serta status.
- **Do** tampilkan label teks bersama warna atau ikon status untuk memenuhi kebutuhan aksesibilitas.
- **Do** beri satu bidang aksen pada kelompok angka terpenting, lalu biarkan sisanya putih.
- **Do** beri setiap status yang tampil berulang sebagai baris kartu sejajar satu ikon tetap: beberapa kartu dengan bentuk identik yang hanya berbeda tint akan terbaca sebagai satu blok seragam.

### Don't:

- **Don't** memakai biru atau warna status sebagai background besar pada banyak kartu sekaligus; satu bidang aksen per kelompok angka sudah cukup.
- **Don't** membuat seluruh kartu melayang dengan bayangan; kedalaman default berasal dari lapisan tonal dan batas.
- **Don't** menggunakan bentuk pil untuk semua tombol dan bidang.
- **Don't** mencampur Inter, Geist Sans, dan Geist Mono tanpa fungsi yang jelas.
- **Don't** meniru template admin generik melalui grid kartu identik tanpa prioritas informasi atau konteks pekerjaan.
