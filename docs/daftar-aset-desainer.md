# Daftar Gambar untuk Desainer — Askonveksi

> Untuk orang awam. Tidak perlu paham coding. Cukup baca dari atas ke bawah, lalu buat fotonya.

Ini adalah **daftar belanja gambar** untuk semua halaman web Askonveksi. Desainer / fotografer tinggal buat fotonya sesuai daftar, lalu kirim ke programmer.

**Yang TIDAK perlu dibuat (sudah ada):**
1. Logo Askonveksi — sudah ada
2. Logo klien (Pertamina, BRI, Undip, dll) — sudah ada

---

## Cara baca dokumen ini

Setiap gambar dijelaskan dengan 4 hal:

1. **Nama file** — nama yang wajib dipakai saat menyimpan. Contoh: `hero.jpg`. Supaya programmer tidak bingung.
2. **Letaknya di mana** — bagian web yang memakai gambar itu, dijelaskan dengan bahasa sehari-hari.
3. **Ukuran / bentuk** — dijelaskan seperti "melebar seperti layar TV" atau "tegak seperti foto KTP".
4. **Isi foto** — gambaran fotonya harus seperti apa.

### Kamus istilah (penjelasan awam)

| Istilah | Artinya |
|---|---|
| Melebar 16:9 | Seperti layar TV / YouTube. Lebar ke samping. |
| Tegak 3:4 | Seperti foto HP yang diberdirikan. Tinggi ke atas. |
| Kotak 1:1 | Seperti foto profil Instagram. Persegi. |
| Pixel (misal 1920x1080) | Jumlah titik gambar. Makin besar makin tajam, tidak pecah. Ikuti angka minimal yang diminta. |
| JPG / WebP | File foto biasa. Untuk foto orang, baju, workshop. |
| PNG Transparan | Gambar tanpa background (tembus pandang). Wajib untuk foto katalog baju. Kalau masih ada kotak putih di belakang baju = salah. |
| Berat file (<300KB) | Ukuran file. Makin kecil makin cepat dibuka pengunjung. Jangan kirim 1 foto 5MB. |
| Tajam / tidak blur | Foto tidak pecah saat di-zoom di HP. |

### Aturan umum semua foto

1. Cahaya terang (siang hari / lampu putih). Jangan gelap / kuning.
2. HP / kamera lurus, jangan miring.
3. Background rapi (tidak ada kabel berantakan / sampah).
4. Warna baju sama dengan aslinya. Jangan pakai filter Instagram.
5. Nama file huruf kecil semua, pakai `-` bukan spasi. Benar: `seragam-pertamina.jpg`. Salah: `Seragam Pertamina FINAL (1).jpg`.
6. Kalau bisa kirim 2 versi: versi besar (master) + versi kecil (kompresan untuk web).

### Cara kirim ke programmer

Buat folder Google Drive seperti ini:

```
Askonveksi-Gambar/
  01-beranda/
  02-produk/
  03-portofolio/
  04-size-chart/
  05-katalog-kain/
  06-kontak/
```

### Urutan pengerjaan

**Minggu 1 (penting):** 5 foto beranda + 9 foto portofolio + 8 foto katalog baju utama.
**Minggu 2:** 13 cover produk yang belum ada + 9 size chart + 9 foto kain.
**Cicil santai:** foto isi detail produk (mulai dari Kaos, Kemeja, Jaket, Jersey, PDH masing-masing 3 foto).

**Total: ±60 gambar wajib + 147 foto detail tambahan (bisa dicicil).**

---

## 1. Halaman Utama — `https://askonveksi.web.id/`

Urutan halaman dari atas ke bawah: (1) foto besar pembuka bertuliskan "Konveksi di Semarang", (2) kotak produk, (3) foto proses jahit bertuliskan "Dari Desain Hingga Siap Pakai", (4) bagian gelap "Mengapa Memilih Askonveksi?", (5) logo klien (sudah ada, lewati), (6) testimoni tulisan, (7) foto penutup biru + tombol WhatsApp.

### 1.1 Foto besar pembuka — `hero.jpg` (wajib diganti)

- **Letak:** foto paling besar, paling atas, full 1 layar saat web dibuka.
- **Bentuk:** melebar seperti TV (16:9). Minimal **1920 x 1080 pixel**. Berat di bawah 300KB.
- **Isi:** dua pekerja konveksi melihat pola / desain di ruang jahit, mesin jahit terlihat di belakang, suasana kerja asli, terang, wajah jelas. Sisi kiri agak kosong karena di atasnya ada tulisan putih. Harus landscape, jangan portrait.
- **Bagus:** workshop siang hari, lampu putih, fokus kerja. **Jelek:** gelap, blur, banyak bayangan hitam.
- **Mengganti file:** `public/hero.jpg`

### 1.2 Foto proses jahit — `tailor.jpg` (wajib diganti)

- **Letak:** bagian tengah, foto tegak di kiri, kanannya tulisan langkah produksi (Konsultasi → Bahan → Produksi → Finishing → Pengiriman).
- **Bentuk:** tegak seperti KTP diberdirikan (4:5). Minimal **1200 x 1500 pixel**. Berat di bawah 250KB.
- **Isi:** close-up tangan memotong kain / operator menjahit. Benang, mesin, kain terlihat detail. Bagian bawah agak kosong untuk tulisan putih "Dari Desain Hingga Siap Pakai".
- **Mengganti file:** `public/tailor.jpg`

### 1.3 Foto penutup biru — `cta.jpg` (wajib diganti, dipakai juga di halaman Kontak)

- **Letak:** bawah dekat footer, background biru bertuliskan "Siap Membuat Seragam Impian Anda?".
- **Bentuk:** sangat melebar panorama (21:9). Minimal **1920 x 820 pixel**. Berat di bawah 250KB.
- **Isi:** tumpukan / gantungan baju warna-warni rapi. Jangan terlalu ramai (nanti ditimpa warna biru + tulisan). Jangan ada wajah besar di tengah.
- **Mengganti file:** `public/cta.jpg`

### 1.4 Foto background gelap — `why-bg.jpg` (baru)

- **Letak:** bagian "Mengapa Memilih Askonveksi?" (navy gelap). Saat ini masih pinjam `hero.jpg`.
- **Bentuk:** melebar 16:9, minimal **1920 x 1080 pixel**, di bawah 200KB.
- **Isi:** suasana workshop dari jauh (mesin + tim). Nanti ditimpa warna navy 90%, jadi yang penting teksturnya, bukan detail wajah. Jangan sama persis dengan hero.

### 1.5 Gambar share WA / Facebook — `og-cover.jpg` (baru, tidak terlihat di web)

- **Letak:** muncul saat link web di-share ke WhatsApp / Facebook / Google.
- **Ukuran wajib:** **1200 x 630 pixel**, di bawah 200KB.
- **Isi:** foto workshop terbaik + tulisan di tengah "Askonveksi — Konveksi Semarang, Seragam Custom". Jangan taruh tulisan mepet pinggir (beri jarak 100px, karena kepotong di HP).

**Checklist:** `hero.jpg` melebar terang, `tailor.jpg` tegak detail tangan, `cta.jpg` melebar tidak ramai, `why-bg.jpg` suasana gelap, `og-cover.jpg` 1200x630 + tulisan tengah.

---

## 2. Produk dan Detail Produk — `/#produk` dan `/produk/nama-baju`

Ada 2 jenis: (a) **foto katalog** = baju tanpa background dipajang kotak-kotak, (b) **foto isi** = baju dipakai orang / detail jahitan di halaman detail.

### 2.1 Foto katalog (kotak di halaman utama)

- **Letak:** kotak produk 2 kolom di HP, 4 kolom di laptop. Kotak persegi, background biru muda.
- **Bentuk (sama semua):** kotak 1:1, **1080 x 1080 pixel**, **PNG transparan (wajib!)**, di bawah 150KB. Baju di tengah bawah, isi 80% kotak.
- **Gaya (sama semua):** ghost-mannequin (baju terlihat berbentuk badan tanpa orang) atau flat-lay rapi dari atas. Satu arah cahaya untuk semua. Bayangan lembut. Warna netral (putih / navy / hitam).

**8 foto yang harus difoto ulang (sudah ada tapi kurang bagus):**

| Nama file | Baju apa |
|---|---|
| `product/kemeja.png` | Kemeja |
| `product/pdh.png` | PDH (baju dinas) |
| `product/jaket.png` | Jaket |
| `product/rompi.png` | Rompi |
| `product/jersey.png` | Jersey bola |
| `product/kaos.png` | Kaos |
| `product/apron.png` | Apron / celemek |
| `product/polo.png` | Polo / kaos kerah |

**13 cover yang belum ada sama sekali (saat ini pinjam foto baju lain, wajib dibuat):**

1. `product/kemeja-pdh-pdl.png` — Kemeja PDH/PDL
2. `product/workshirt.png` — Workshirt
3. `product/seragam-kerja.png` — Seragam Kerja
4. `product/wearpack.png` — Wearpack (baju proyek menyatu)
5. `product/poloshirt.png` — Poloshirt
6. `product/kaos-sablon.png` — Kaos Sablon DTF/Plastisol
7. `product/kaos-vneck.png` — Kaos Vneck (kerah V)
8. `product/kaos-raglan.png` — Kaos Raglan (lengan beda warna)
9. `product/jacket.png` — Jacket
10. `product/lanyard.png` — Lanyard (tali ID, foto 45° di meja putih, bukan baju)
11. `product/rompi-vest-apron.png` — Rompi / Vest / Apron
12. `product/totebag-topi.png` — Totebag / Topi (foto tas + topi di meja putih)
13. `product/gantungan-kunci.png` — Gantungan Kunci (foto kecil di meja putih)

### 2.2 Foto isi halaman detail (bisa dicicil)

- **Letak:** halaman detail tiap baju, 3 kolom kotak tegak.
- **Bentuk:** tegak 3:4, **900 x 1200 pixel**, JPG biasa, di bawah 200KB.
- **Ideal:** 7 foto x 21 produk = 147 foto. Tidak harus langsung semua — mulai dari Kaos, Kemeja, Jaket, Jersey, PDH masing-masing 3 foto.
- **Contoh 7 foto untuk 1 produk (Kaos):** (1) dipakai orang tampak depan, (2) dipakai tampak belakang terlihat sablon, (3) close-up sablon / bordir, (4) close-up bahan dipegang tangan, (5) varian warna lain, (6) proses disablon / dijahit, (7) tumpukan siap kirim.

**Tips:** jangan hapus background hijau/biru secara kasar (pinggir jadi bergerigi). Untuk baju putih pakai background abu muda agar terlihat. Tempel kertas nama file di samping baju saat foto agar tidak tertukar.

**Checklist:** 8 katalog PNG transparan 1080px, 13 cover baru tidak pinjam lagi, minimal 3 foto isi untuk 5 produk terlaris.

---

## 3. Portofolio — `https://askonveksi.web.id/portofolio`

Seperti album contoh kerjaan agar calon pembeli yakin. Saat ini masih kotak abu-abu bertuliskan "Nama Portofolio 1-9". Perlu 9 foto asli.

- **Letak:** kotak besar 1 kolom di HP, 3 kolom di laptop. Foto melebar di atas, bawahnya nama + label kategori.
- **Bentuk (sama semua):** melebar 16:9, minimal **1280 x 720 pixel** (lebih bagus 1920x1080), JPG, di bawah 250KB.

| Nama file usulan | Label | Isi foto |
|---|---|---|
| `portofolio/portofolio-kemeja-perusahaan.jpg` | Kemeja | Karyawan memakai kemeja, setengah badan |
| `portofolio/portofolio-kaos-komunitas.jpg` | Kaos | Rombongan komunitas berkaos sama (wajah boleh blur kalau belum izin) |
| `portofolio/portofolio-jaket-almamater.jpg` | Jaket | Orang berjaket, bordir / sablon terlihat jelas |
| `portofolio/portofolio-polo-event.jpg` | Poloshirt | Panitia ber-polo, kerah + bordir dada terlihat |
| `portofolio/portofolio-wearpack-proyek.jpg` | Wearpack | Pekerja + helm di lapangan |
| `portofolio/portofolio-lanyard-id.jpg` | Lanyard | Close-up tali ID dipakai / dijejer di meja |
| `portofolio/portofolio-rompi-lapangan.jpg` | Rompi | Petugas berompi, sablon belakang terlihat |
| `portofolio/portofolio-totebag-souvenir.jpg` | Totebag | Totebag dijejer / ditenteng, sablon terlihat |
| `portofolio/portofolio-jersey-tim.jpg` | Jersey | Foto tim bola berjersey sama |

Boleh ganti nama file dengan nama klien asli kalau sudah izin (contoh `portofolio-seragam-pertamina.jpg`, lebih meyakinkan). Utamakan foto asli jahitan Askonveksi, bukan dari Google. Baju rapi (tidak kusut, kancing terpasang). Satu tone warna untuk semua.

**Checklist:** 9 foto melebar, tidak ada kotak abu-abu, bukan foto internet, izin wajah aman / di-blur.

---

## 4. Size Chart — `https://askonveksi.web.id/size-chart`

Untuk menjawab "ukuran M lingkar dadanya berapa?". Saat ini 9 kotak abu-abu kosong.

- **Letak:** kotak kecil 3 kolom sejajar, gambar tegak.
- **Bentuk (sama semua):** tegak 3:4, **900 x 1200 pixel**, PNG (agar tulisan tajam), background putih, di bawah 200KB.

**Daftar 9 gambar:**

| Nama file | Untuk apa |
|---|---|
| `size-chart/size-kaos.png` | Kaos + tabel S–XXXL |
| `size-chart/size-kemeja.png` | Kemeja + tabel S–XXL |
| `size-chart/size-pdh.png` | PDH + atribut |
| `size-chart/size-jaket.png` | Jaket + panjang lengan |
| `size-chart/size-rompi.png` | Rompi |
| `size-chart/size-jersey.png` | Jersey + keterangan nama / nomor punggung |
| `size-chart/size-polo.png` | Polo / Poloshirt |
| `size-chart/size-apron.png` | Apron + tali |
| `size-chart/size-wearpack.png` | Wearpack menyatu |

**1 gambar wajib berisi 3 hal:** (1) sketsa baju sederhana tampak depan, (2) garis ukur + keterangan LD = Lingkar Dada, PB = Panjang Badan, PL = Panjang Lengan, (3) tabel S–XXL dalam cm. Warna garis navy, font tebal besar (terbaca di HP kecil), bahasa Indonesia. Minta file master yang bisa diedit (Figma / Illustrator / Canva) + export PNG. Jangan foto tabel Excel pakai HP (miring, blur).

**Checklist:** 9 gambar tegak putih, tulisan terbaca tanpa zoom di HP, file master diserahkan.

---

## 5. Katalog Kain — `https://askonveksi.web.id/katalog-kain`

Seperti katalog toko kain. Saat ini 9 kotak abu-abu kosong. Perlu 9 foto close-up kain asli.

- **Letak:** sama seperti size chart, 3 kolom, gambar tegak.
- **Bentuk:** tegak 3:4, **900 x 1200 pixel**, JPG, di bawah 200KB.

| Nama file usulan | Bahan | Cara foto |
|---|---|---|
| `kain/kain-combed-30s.jpg` | Cotton Combed 30s | Lipatan kaos putih + close-up serat |
| `kain/kain-lacoste.jpg` | Lacoste / Pique | Close-up pori kotak-kotak khas polo |
| `kain/kain-drill.jpg` | Drill (PDH) | Garis diagonal khas drill dari dekat |
| `kain/kain-twill.jpg` | Twill | Garis lebih halus dari drill |
| `kain/kain-fleece.jpg` | Fleece | Bagian dalam berbulu halus |
| `kain/kain-waterproof.jpg` | Waterproof / parasut | Tetesan air di atas kain (efek anti air) |
| `kain/kain-microfiber.jpg` | Microfiber / dryfit | Jersey + pori cepat kering |
| `kain/kain-canvas.jpg` | Canvas | Tas / apron + tekstur tebal |
| `kain/kain-katun-tc.jpg` | Katun TC | Lipatan kemeja + serat |

Nama boleh disesuaikan stok asli. Yang penting 9 foto beda, jangan 1 foto dipakai 2 kali. **Cara foto:** cahaya dari samping (agar serat terlihat), komposisi 70% close-up + 30% lipatan / baju jadi, sertakan label nama + GSM (contoh "Combed 30s — 150 GSM — adem untuk kaos"), satu meja + satu cahaya untuk semua, jangan pakai flash langsung.

**Checklist:** 9 foto beda, tegak 900x1200, serat tajam, ada label bahan + GSM.

---

## 6. Kontak dan Pelengkap — `https://askonveksi.web.id/contact`

### 6.1 Foto workshop — `contact/workshop.jpg`

- **Letak:** halaman Kontak bagian alamat / peta, agar pembeli tidak nyasar.
- **Ukuran:** melebar 16:9, minimal **1600 x 900 pixel**, JPG di bawah 250KB.
- **Isi:** depan ruko / workshop siang hari, plang terbaca jelas, jalan / patokan sekitar terlihat. Jangan malam hari.

### 6.2 Foto profil testimoni — `testimoni/avatar-01.jpg` s/d `avatar-03.jpg` (opsional)

- **Letak:** bagian "Testimoni Klien" di halaman utama (saat ini hanya icon abu-abu).
- **Ukuran:** kotak 1:1, **256 x 256 pixel**, JPG di bawah 50KB. Nanti tampil bulat, jadi wajah di tengah.
- **Isi:** wajah klien (minta izin). Kalau tidak ada izin, minta desainer buatkan lingkaran inisial (misal huruf "M" di lingkaran biru).

### 6.3 Icon kecil browser — `favicon-32.png`, `apple-touch-180.png`, `icon-512.png`

- **Letak:** tab browser, bookmark HP, share link. Saat ini memakai logo besar jadi pecah / kepotong.
- **Ukuran:** 32x32 (tab laptop), 180x180 (bookmark iPhone), 512x512 (Android).
- **Isi:** pakai simbol / mark Askonveksi saja, bukan logo panjang bertulisan. Beri jarak putih di sekeliling. Background putih atau navy.

**Checklist:** workshop siang plang jelas, 3 avatar / inisial, 3 icon dari mark logo.

---

## Checklist Serah Terima Akhir

- [ ] Semua nama file huruf kecil, tanpa spasi
- [ ] Semua foto tajam, tidak blur
- [ ] Foto katalog baju PNG transparan
- [ ] Ukuran sesuai yang diminta di atas
- [ ] Berat file di bawah batas
- [ ] Sudah masuk folder Google Drive yang benar
