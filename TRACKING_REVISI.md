# TRACKING REVISI ASKONVEKSI

**Tanggal:** 11 Okt 2026 · **Cabang utama:** `dev` · **Cabang Sprint 4:** `feat/sprint-4-crm-broadcast` · **Aturan:** role DEVELOPER tetap full akses di semua fitur.

> Cara baca: `[x]` selesai & terverifikasi · `[ ]` belum dikerjakan.
> Sprint disusun seperti pola A+F: paket yang saling terkait digabung dan dikerjakan bersama.

---

## SPRINT 1 — Keuangan & Invoice (A + F) — `[x] SELESAI`

Digabung karena sama-sama menyentuh uang, HPP, dan penagihan. Terverifikasi: `tsc` bersih, 166/166 tes lolos, `build` sukses, `lint` 0 error.

### A — Keuangan / Project
- [x] A1 — Menu Pemasukan → **Project** (label, judul, export)
- [x] A2 — HPP per item (Kain–Lainnya) masing-masing nominal + tanggal bayar + metode + bukti TF, otomatis ke Pengeluaran kategori Project; bukti lama tampil & dipakai ulang bila tak upload baru
- [x] A3 — Kolom Tanggal di tabel Project + export
- [x] A4 — Filter Tipe Operasional/Project + footer total; filter Customer & Pembuat dihapus; kolom Pajak di Project
- [x] A5 — Soft-delete + halaman Riwayat Hapus (siapa + kapan + kembalikan), tersembunyi dari search
- [x] Sub-grup Project per order dalam grup tanggal + subtotal + kolom Project di export

### F — Invoice
- [x] F1 — Produk & Deskripsi editable per item (deskripsi opsional, default kosong); hapus kolom Model/Ukuran; diskon per item + default; pajak opsional; rekening bold; TTD sistem; template catatan
- [x] F2 — Status Deposit/DP/Lunas/Belum Terbayar (+ badge Menunggu Deposit)
- [x] F3 — Kwitansi per transaksi (tombol Unduh Kwitansi, ada terbilang)
- [x] F4 — Tanggal bayar mundur khusus Catat Pembayaran Detail Invoice (awal + termin + koreksi); tanggal maju dikunci di kalender & server
- [x] Jadwal tab Deal dikembalikan Lunas/DP (opsi Deposit dihapus dari form) — **baru benar-benar masuk di `3011dac`**: `deal-payment-form.tsx` tinggal `LUNAS|DP`, layanan server (`crm.ts`) masih menerima `kind: "DEPOSIT"` untuk data lama

---

## SPRINT 2 — PO & Struktur Order (C + E) — `[~] 8/9 SELESAI` — prioritas TERTINGGI

Digabung karena E3 (edit PO) dan C2/C5 (struktur PO) mengubah skema PO yang sama. Blocker produksi H-1. Terverifikasi ulang setelah merge kedua: `tsc` bersih, 192/192 tes lolos, `build` sukses (C1 `DECORATION_METHODS`, C3 `roster-import.ts`, C4 autosave PO form, C5 `instansi`/`pola`, E2 tanpa gate APPROVED, E3 `Revisi PO disepakati` semuanya masih ada di kode).

- [x] C1 — Dekorasi multi-select; Sablon dipecah DTF/Plastisol/Rubber; Tinta = Printing
- [x] C2 — Multi-matriks/produk dalam 1 PO (syarat: 1 warna; beda warna = beda PO)
- [x] C3 — Upload Excel Roster → matriks terisi otomatis
- [x] C4 — Autosave draft PO (anti hilang saat lag/keluar)
- [x] C5 — Form PO: 2 field **Instansi** + **Pola** (ganti `productName` tunggal)
- [x] E1 — PDF PO 2 varian: customer + penjahit (`?variant=customer|penjahit`)
- [x] E2 — Hapus gate APPROVED → tombol Kirim 1 set PDF + checkbox konfirmasi customer
- [x] E3 — Edit PO setelah disepakati (kasus tambah qty H-1) + aturan dampak Invoice/SO/WO
- [x] E4a — Deadline merah di PDF → `purchase-order-pdf.ts`: `overdue = jakartaDay(deadline) < hari ini`, label **dan** tanggal Deadline produksi dicetak `OVERDUE_RED` (sejak `f4ca232`)
- [x] E4b — Tabel MODEL ikut contoh Tasya — **selesai 15 Okt**: size chart digambar ulang sesuai referensi (kolom label gelap, header ukuran gelap, total per baris, baris `NOTE:` + kotak total) dan selalu mencetak **semua kolom ukuran baku** `XS…5XL` walau PO tidak memesan ukuran itu — lihat "Revisi 15 Okt (lanjutan 2)" di bawah

## SPRINT 3 — Role & Produksi (D + G) — `[x] 6/6 SELESAI` — prioritas 2

Digabung dari dua cabang lewat merge: D2 & G2 dari cabang ini, D1/D3/G1/G3 dari rekan. Terverifikasi setelah merge kedua (`3011dac` "Fixing Sprint 3 Focus Return"): `tsc` bersih, 192/192 tes lolos, `lint` 0 error, `build` sukses.

- [x] D1 — Role `ADMIN_PO` + upload desain langsung detailing → **rename** `ADMIN_PRODUCTION` → `ADMIN_PO` (migrasi `20261013000000_admin_po_role` menambah nilai enum + backfill akun lama; nilai lama tetap tersimpan untuk audit); `APP_ROLES`, `validation.ts`, `constants.ts`, halaman Pengguna memakai `ADMIN_PO`; hak = baca CRM (`CRM_VIEW_ROLES`, tanpa aksi tulis) + unggah desain (`DESIGN_UPLOADER_ROLES`) + kelola Produksi (`PRODUCTION_ROLES`)
- [x] D2 — Gambar hanya PNG/JPG/JPEG (tolak PDF/PSD) → `lib/design/image.ts` validasi ekstensi **dan** isi file; dipakai `design.ts` (unggah per produk) & `production.ts` (ganti desain, salinan awal, reset); `design-detail.ts` & `data.ts` hanya menampilkan `image/png`/`image/jpeg`; API attachment deteksi tipe isi; file picker PO & editor anotasi `accept=".png,.jpg,.jpeg"`
- [x] D3 — Detailing desain opsional → `design-annotations.ts` (maksimal 50, tanpa coretan pun sah) & `design-annotation-editor.tsx` (simpan/kirim tanpa anotasi)
- [x] G1 — Jalur Aksesori 5 stage: Produksi-QC-Packing-Pengiriman-Selesai → `workflow.ts` `AKSESORI_STAGE_SEQUENCE` (tahap JAHIT tampil sebagai "Produksi"), `productionStagesForGroup` / `boardStagesForGroup` / `stageLabelForGroup`, dipakai kanban, ringkasan, dan `service.ts` saat membuat WO
- [x] G2 — Admin Customer view-only produksi → `permissions.ts` `PRODUCTION_VIEW_ROLES` + `DETAIL_DESIGN_VIEW_ROLES` (keduanya kini `PRODUCTION_ROLES + ADMIN_CUSTOMER`); kanban, detail Work Order, ringkasan, dan kartu papan memakai `canManage: isStageRole(role)`; aksi ubah tetap `PRODUCTION_ROLES`; UI menampilkan banner "Mode lihat saja" dan menyembunyikan geser/PIC/kendala/anotasi. **Diperbarui 3011dac:** halaman **Detail Desain dikunci khusus `DEVELOPER`** — data layer `requireDeveloperActor()`, 4 aksi desain (`saveProductionDesignAction` dll.) juga developer-only, dan menu `/detail-desain` difilter `isDeveloper` di sidebar; jadi Admin Customer/Admin PO hanya memantau produksi, bukan ruang desain
- [x] G3 — Status Retur setelah Selesai + badge sticky → **rework di 3011dac (Sprint 3 Focus Return):** kartu yang masuk Retur *tinggal* di kolom Retur sampai digeser keluar (`RELEASE_RETUR`), aksi baru `TO_RETUR`/`RELEASE_RETUR` (menyingkirkan `QC_REJECT`/`REVERT`), pindah ke tahap **Selesai** juga wajib menyertakan alasan retur, badge "Retur — Perlu Perbaikan" menempel permanen pada `repairReason` (warna merahnya hilang saat kartu mencapai Selesai, `returActive` di detail WO); kanban hanya punya satu kolom Retur terlepas jalur

## SPRINT 4 — CRM & Broadcast (B + H) — `[x] 7/7 SELESAI`

Dikerjakan di cabang `feat/sprint-4-crm-broadcast` (kerja B & H sendiri tidak mengubah Prisma schema; 3 migrasi di bawah berasal dari rekan lewat merge). Terverifikasi setelah merge kedua: `tsc` bersih, **192/192 tes**, `lint` 0 error, `build` sukses. Blocker H3 (butuh C2 multi-item PO) sudah terbuka karena Sprint 2 sudah merge.

### B — CRM / Pipeline
- [x] B1 — Tambah prospek, PIC lock Michelle → `customer-fields.tsx` lock Sales/PIC ke Michelle saat `prospect=true`; `crm.ts` resolve `salesPicId` ke Michelle atau fallback `ADMIN_CUSTOMER`
- [x] B2 — Sumber Lead "Lainnya" bisa custom → `customer-fields.tsx` tampilkan input teks saat pilih "Lainnya"; `crm.ts` find-or-create `LeadSource` dengan teks custom
- [x] B3 — Kanban pipeline font bold (Prospek ke kanan) → `pipeline-board.tsx` header, count, nama customer, judul kartu, dan badge ditambah `font-bold`
- [x] B4 — Data Master boleh tambah/edit/hapus oleh Admin Customer → `permissions.ts` tambah `ADMIN_CUSTOMER` ke `MASTER_DATA_ROLES`; `app-nav.tsx` update `canManageMasterData` (menu **Pengguna** tetap khusus Owner/Developer agar Admin Customer tidak melihat tautan tanpa akses)

### H — Broadcast
- [x] H1 — Import tanggal Excel ke Broadcast → `broadcast-date-excel.ts` parser XLSX + template generator; `route.ts` API download template; `broadcast-workspace.tsx` modal dialog import; `broadcast.ts` action membuat rantai Opportunity → PO → Invoice → SalesOrder + DealPayment per baris
- [x] H2 — Kategori produk di Broadcast (samakan dengan Campaign) → `broadcast-workspace.tsx` re-enable filter `productCategoryId`; `broadcast.ts` pass filter ke query; `broadcast-content.tsx` kirim `productCategories`
- [x] H3 — Upload PO 2+ gambar/desain jadi 1 file + keputusan N WO → **SELESAI 14 Okt** (dua bagian):
  - **Keputusan N WO**: `service.ts` `ensureProductionWorkOrder` membuat **1 WO per item PO** (`purchaseOrderItemId`, rute ikut `garmentType` item, PO lawas pakai item implisit `""`); daftar WO muncul N di Sales Order dan kartu WO terpisah di kanban
  - **Upload 2+ gambar/desain**: satu dialog unggah untuk semua produk, tiap produk form `multiple` (maks 5 file, 5 MB/file, validasi D2 PNG/JPG), seluruh file jadi satu versi (`uploadDesignRevisionAction`)
  - **PDF PO = 1 file, tapi tiap produk satu lembar mandiri** → `purchase-order-pdf.ts`: `drawSheetHeader()` mengulang kop + identitas PO (jenis pakaian, kategori, dekorasi ikut item) di tiap halaman, lalu gambar desain produk, tabel MODEL, dan totalnya; route PDF mengirim `itemId` tiap lampiran supaya desain jatuh di lembar produknya; ditutup lembar ringkasan (total keseluruhan + sampel ukuran + catatan desain/catatan PO) lalu halaman roster. PO 3 produk = **4 halaman** (5 bila ada roster); PO 1 produk tetap **1 halaman** (tanpa regresi), aksesori tetap ringkasan "JUMLAH PRODUK". Varian customer & penjahit sama. Verifikasi nyata: generator dijalankan dengan data 3 produk, isi tiap halaman diekstrak dan cocok

## SPRINT 5 — Dashboard & Landing (I) — **DIABAIKAN** (landing page, sesuai permintaan)

*(tidak diperiksa lagi — semua item di bawah sengaja dibiarkan)*

- [x] ~~I1 — Hapus AOV dashboard~~ → **dikerjakan 17 Okt** (lihat "Revisi 17 Okt" di bawah)
- [ ] I2a — Semua berkancing + Kemeja → Seragam Kerja (Virgin skip — sesuai keputusan)
- [ ] I2b — Pecah Jersey → Jersey Kerah + Jersey Oblong
- [ ] I2c — Portofolio hanya logo customer (butuh file logo)
- [ ] I2d — Logo WA resmi + perbesar

## SPRINT 6 — Absensi QR (J) — modul baru, terakhir

- [ ] Skema + generate/scan QR + halaman karyawan/admin + anti-titip + timezone Asia/Jakarta — **belum ada apa-apa di kode**: tidak ada model Prisma karyawan/absensi, tidak ada route QR, tidak ada kata "absensi" di `app/`/`lib/` (dicek setelah merge)

## Masuk lewat merge `3011dac` (belum ada nomor item)

Pekerjaan rekan yang tidak tercantum di checklist mana pun, dicatat supaya tidak hilang:

- [x] **Add-on per baris invoice** — tabel `InvoiceItemAddon` (migrasi `20261014000000`), `gross = qty × harga + add-on` dengan relaksasi constraint `gross ≥ qty × harga` (migrasi `20261014010000`); UI add-on di `invoice-form.tsx` (maks per baris), `invoice-calculation.ts`, tersimpan saat update invoice (`invoiceItemAddon.createMany`), tampil di PDF (`+ label (qty × harga)`), +72 baris tes
- [x] **WO langsung masuk Produksi saat dibuat** — `service.ts` set `designCompletedAt: new Date()` saat WO dibuat (migrasi `20261014020000_work_order_auto_production`), tanpa tahap desain terpisah
- [x] **Papan Retur & groupby per item** — `production-board.tsx` ditulis ulang (`ProductionCardView` diekstrak), `boardWhere` memecah jalur pakai `garmentType`/`productCategory` per item PO (bukan per PO), test fokus papan
- [x] **Badge "Menunggu Pelunasan" (status `PARTIAL`)** — status pembayaran baru di `lib/crm/data.ts` (invoice sudah ada transaksi awal tapi belum lunas) + badge `warning` di `invoices/page.tsx`
- [x] **Form invoice tidak lagi kirim objek PO mentah ke client** — `peluang/[id]/page.tsx` membangun `invoicePo` potongan (Decimal `deposit.amount` tidak boleh jadi prop Client Component)
- [x] **`PRISMA_SCHEMA_VERSION` → `invoice-item-addon`** — `lib/prisma.ts` cek delegate `invoiceItemAddon` supaya klien Prisma di-restart otomatis setelah migrasi

---

## Revisi 14 Okt — Profil perusahaan: rekening → metode pembayaran + gambar TTD

- [x] **Field bank/rekening dihapus dari Profil perusahaan** — `bankName` / `bankAccountNumber` / `bankAccountHolder` dilepas dari form, `businessProfileSchema`, action, dan kolomnya dihapus dari tabel `BusinessProfile` (migrasi `20261014030000_business_profile_signature`). Sumber rekening pindah ke **Master data → Metode pembayaran**: isi kolom *Deskripsi* dengan no. rekening, mis. `1234567890 a.n. AS Konveksi`
- [x] **PDF invoice baru menampilkan blok "Metode pembayaran"** — daftar metode `isActive` dari master data dicetak di posisi blok rekening lama. Invoice yang sudah dikunci tetap memakai snapshot rekeningnya sendiri (`Invoice.snapshotBank*` tidak dihapus), jadi dokumen lama tidak berubah
- [x] **Gambar tanda tangan** — kolom baru `BusinessProfile.signaturePath`, disimpan ke bucket `business-assets` (PNG/JPG/WebP maks 2 MB + cek magic bytes, preview & checkbox "hapus gambar" di form, route `/api/master-data/business-profile/signature`). Path di-snapshot ke `Invoice.snapshotSignaturePath` saat invoice dibuat dan saat dikunci — konsisten dengan prinsip dokumen terkunci
- [x] **Dicetak di PDF invoice dan kwitansi** — gambar di atas nama/jabatan (maks 150×46 pt invoice, 140×40 pt kwitansi), lewat `normalizePdfImage` (sharp → PNG). Kalau file gagal dimuat, PDF tetap dicetak dengan nama/jabatan teks
- [x] **Template kwitansi baru mengikuti referensi Owner** — `lib/crm/receipt-pdf.ts` ditulis ulang: A5 landscape (595,28×420 pt), kop (logo snapshot + nama/alamat/telepon/email perusahaan · "KWITANSI" + `Payment No.` / `Invoice No.`), empat baris **Terima Dari / Banyaknya Uang (terbilang) / Untuk pembayaran / Jumlah Rp** dengan blok garis-garis tipis seperti aslinya, dan blok kanan bawah tanggal (`02 Okt 2026`) + nama + jabatan + gambar TTD. Alamat menghormati jeda baris. Baris "Metode" & "Catatan" lama dibuang; "Untuk pembayaran" kini berisi `Pembayaran Invoice <nomor>`. Posisi teks & pita garis diukur dari referensi (selisih ≤2 pt / ≤3 px)
- **Catatan migrasi:** SQL migrasi ditulis manual lalu dijalankan dengan `npx prisma migrate deploy`. `prisma migrate dev` tidak bisa dipakai di repo ini karena migrasi lama (`20260827120000_quotation_acceptance_proof`) menyisip ke skema `storage` Supabase, yang tidak ada di shadow database
- **Verifikasi:** `tsc` bersih · eslint bersih (2 warning lama di `crm.ts`) · **198/198 tes** (6 baru: `tests/business-profile.test.mjs`) · `next build` sukses · render PDF diuji nyata — invoice baru = blok metode + gambar TTD, invoice lama = blok rekening lama, kwitansi = gambar TTD

---

## Revisi 14 Okt (lanjutan) — Kop kosong, modal invoice, navigasi macet

- [x] **Kop surat kosong padahal profil perusahaan sudah diisi** — akar masalahnya bukan form profil: invoice lama (`INV-2026-00032..35`) dibuat sebelum profil diisi, sehingga `snapshotBusinessPhone/Email/Address/LogoPath` bernilai `null`, dan route PDF hanya memakai snapshot (fallback profil khusus status `DRAFT`). Kini kolom kop yang **masih kosong** jatuh ke `BusinessProfile` terkini — di `app/api/crm/invoice/[id]/pdf/route.ts` (nama/telepon/email/alamat/logo/TTD) dan `app/api/crm/payment-transactions/[id]/kwitansi/route.ts`. Snapshot yang sudah terisi tidak pernah ditimpa; `notes` tetap hanya mengikuti profil untuk `DRAFT`. Diuji nyata: `INV-2026-00035` kini mencetak `08123123123 · askonveksi@gmail.com · JL perumahan BPD` + logo, kwitansi juga lengkap
- [x] **Modal detail invoice dilebarkan** — `sm:max-w-3xl` (768 px) → `sm:max-w-5xl` (1024 px) di `components/crm/invoice-detail.tsx`; di layar sempit tetap dibatasi `max-w-[calc(100%-2rem)]`
- [x] **Navigasi macet setelah unduh kwitansi — akar masalahnya ketemu: tombol unduh pakai `<Link>` Next.js.** Urutan sebelumnya: klik `<Link>` ke route PDF → Next mengambilnya sebagai RSC (`?_rsc=...`, PDF dibuat tapi **dibuang**) → `content-type` bukan flight → `doMpaNavigation()` → `AppRouter` masuk mode `mpaNavigation` dan *infinitely suspend* (komentar aslinya di `app-router.js`: *"isPending should stay true until the page unloads"*) sambil `location.assign(url)` → respons punya `Content-Disposition: attachment` sehingga browser **membatalkan navigasi dan mengunduh file** → halaman tidak pernah unload. Dampaknya dua: PDF diproses **2× tiap unduh** (sharp + pdfkit memblokir event loop Node ±2–3 dtk di dev, sehingga navigasi berikutnya tertahan lama), dan router sempat tersuspensi sampai ada update lain yang mendisponsiskannya — kalau tidak, hanya reload yang menyembuhkan. **Perbaikan:** semua tautan berkas diganti `<a download>` (pola yang sudah dipakai di `broadcast-workspace.tsx`), pratinjau gambar WhatsApp dibuka di tab baru: `invoice-delivery-actions.tsx` (kwitansi + unduh invoice), `invoice-workflow-section.tsx`, `purchase-order-form.tsx` (roster Excel), `purchase-order-detail.tsx` & `peluang/[id]/page.tsx` (lampiran PO), `whatsapp-inbox.tsx`. Sisa `<Link>` → `/api/` kini **0**. **Bukti:** instrumentation sebelum perbaikan mencatat dua request — `fetch .../kwitansi?_rsc=…` lalu `document .../kwitansi`; sesudah perbaikan tidak ada lagi request RSC, unduh tetap sukses, dan pindah halaman ±1,3 dtk. (Reproduksi awal dari dalam modal sempat tidak mempan karena tombol dialog ditutup lebih dulu — update dialog itulah yang tidak sengaja menyelamatkan router.)

---

## Keputusan terkunci (jangan ditanyakan lagi saat eksekusi)

1. PIC prospek = lock Michelle · 2. Master full akses Admin Customer (tambah/edit/hapus) · 3. 1 PO = 1 warna · 4. Hapus gate APPROVED → Kirim PDF + checkbox · 5. Form PO: Instansi + Pola · 6. Tanggal mundur khusus Invoice · 7. Virgin/kancing skip · 8. Grouping Project = sub-grup dalam tanggal per order · 9. Deposit ikut aturan DP 50% (skip perubahan) · 10. Footer Project = total halaman ini; footer Pengeluaran = total filter (inkonsistensi tercatat, belum diseragamkan).

## Dikenal belum sempurna (ditunda atas persetujuan Owner)

- Nomor kwitansi dari ID transaksi (`KWT-XXXXXXXX`), bukan urut resmi — kini tampil sebagai *Payment No.* di template kwitansi baru
- Kwitansi tidak lagi mencetak metode pembayaran & catatan transaksi (baris itu tidak ada di template referensi); datanya tetap tersimpan di transaksi
- Template invoice = poin Keterangan/Syarat & Ketentuan dari master Pengaturan invoice + daftar metode pembayaran + TTD (layout tidak editable); kolom `Invoice.notes` tetap tersimpan tapi tidak lagi dicetak
- Pajak satu tarif per invoice (bukan per item)
- Alasan hapus pengeluaran selalu kosong (form hapus tanpa input alasan)
- Filter list invoice belum ada "Menunggu Deposit" (badge ada)
- Role `DESIGNER` kini tanpa halaman: menu "Upload Desain" & `app/(app)/desain` dihapus (upload pindah ke detail PO), `DESIGN_VIEW_ROLES` hanya berlaku untuk API gambar, dan setelah `3011dac` `/detail-desain` pun hanya untuk `DEVELOPER` — akun DESIGNER login dengan sidebar kosong. Opsi "beri akses `/detail-desain`" praktis tertutup; tersisa keputusan Owner: bikin halaman sendiri atau retire role
- D1 dijalankan sebagai **rename** `ADMIN_PRODUCTION` → `ADMIN_PO` (migrasi `20261013000000_admin_po_role` backfill akun lama), bukan role baru berdampingan — berbeda dari kalimat D1 "hak = Admin Customer". Konfirmasi ke Owner sebelum rilis

---

## Revisi 15 Okt — Master Pengaturan invoice, kop PO baru, font minimum 16 px

### 1. Master data "Pengaturan invoice" (2 kolom poin)
- [x] **Tabel baru `InvoiceSettingPoint` + enum `InvoiceSettingSection`** (`KETERANGAN` / `SYARAT_KETENTUAN`) dengan kolom `text` (300), `isBold`, `position`; migrasi manual `20261015000000_invoice_setting_points` (RLS aktif + REVOKE anon/authenticated, mengikuti pola master lain). Diterapkan dengan `npx prisma migrate deploy` (DB lokal `askonveksi_local`). `PRISMA_SCHEMA_VERSION` → `invoice-setting-point`
- [x] **Halaman `/master-data/invoice-settings`** ("Pengaturan invoice", menu grup Data Master; Admin Customer/Owner/Developer) berisi editor dua kolom berdampingan: tiap poin punya tombol **Tambah poin** (Plus), panah atas/bawah untuk menggeser urutan manual, tombol **Bold** (`aria-pressed`) untuk menebalkan poin, dan hapus. Kunci React memakai id database bila sudah ada; poin baru divalidasi minimal 2 karakter di klien sebelum kirim
- [x] **Satu action menyimpan kedua kolom** (`saveInvoiceSettingsAction`, payload JSON `{keterangan, syarat}`): transaksi Serializable, poin lama diperbarui di tempat (id tetap, ada `updatedAt`/audit `INVOICE_SETTING_POINT_CREATED|UPDATED|DELETED`), poin yang dibuang dari form dihapus. Batas 20 poin & 300 karakter per poin (`invoiceSettingsSchema`)

### 2. PDF invoice — blok Keterangan & Syarat/Ketentuan
- [x] Blok **Catatan lama tidak lagi dicetak**; digantikan dua blok dari master: "Keterangan" lalu "Syarat & Ketentuan", poin bernomor sesuai urutan, poin bertanda bold dicetak Helvetica-Bold. Poin dibaca **live** (tanpa snapshot) seperti daftar Metode pembayaran — konsisten dengan revisi 14 Okt. Kalau master kosong, kedua blok dilewati total (invoice lama tetap seperti sebelumnya)
- [x] `Invoice.notes` tetap tersimpan pada data invoice, hanya tidak dicetak lagi

### 3. PDF PO — logo baru, kop bertabel, POLA di tengah, deadline merah
- [x] **Ikon/logo baru**: `lib/crm/brand-logo.ts` memuat `public/new-logo.webp` (logo brand terbaru, sama dengan fallback logo situs) lalu dikonversi ke PNG lewat `normalizePdfImage` (sharp) — dipakai ketiga dokumen, jadi PDF tidak lagi memakai `public/brand/askonveksi-logo.png` yang lama. Route PO juga menambahkan fallback `snapshotBusinessLogoPath ?? currentBusiness.logoPath` agar PO lama tidak jatuh ke logo bawaan
- [x] **Tabel identitas PO ber-border** (`label | nilai`, lebar label 132 pt, baris minimal 24 pt, nilai panjang dibungkus maksimal 2 baris) — berlaku untuk PO customer & PO penjahit
- [x] **Judul POLA dipindah ke tengah** bar gelap (`(A4.width - lebar teks) / 2`, toleransi terukur < 3 pt dari titik tengah halaman)
- [x] **Deadline produksi selalu merah (0.78, 0.12, 0.12) + bold** dengan latar merah muda, bukan hanya saat sudah lewat tanggal — label dan nilainya sama-sama disorot

### 4. Font minimum 16 px (= 12 pt) di tiga dokumen cetak
- [x] `lib/crm/pdf-typography.ts`: `PRINT_MIN_FONT_PX = 16` → `MIN_FONT_SIZE = 12 pt` (1 pt = 1,333 px) plus helper `wrapPdfText`/`clipPdfText` yang dipakai bersama
- [x] PO, invoice, dan kwitansi kini tidak punya teks di bawah 12 pt (sebelumnya 7–9 pt); dokumen ikut ditata ulang agar tetap rapi: kolom angka invoice dilebarkan dan nama produk digabung ke kolom deskripsi, tiga baris meta invoice ditumpuk (bukan tiga kolom sebaris), tabel MODEL/roster PO dihitung ulang (lebar kolom & tinggi baris 26 pt, teks panjang dipotong dengan `...`), baris kwitansi mengalir dengan bungkus baris menggantikan blok garis tangan yang tidak lagi muat

**Verifikasi (nyata, bukan asumsi):** `tsc` bersih · eslint 0 error (2 warning lama di `crm.ts`) · **206/206 tes** (6 tes baru di `tests/invoice-settings.test.mjs`, termasuk penjaga "tidak ada `size:` di bawah 12 pt" untuk ketiga modul PDF) · `next build` sukses (rute `/master-data/invoice-settings` terdaftar) · migrasi diterapkan ke DB lokal dan diuji bolak-balik (create → query urutan `section, position` yang sama dengan route PDF → update posisi/bold → delete) · **7 PDF di-generate ulang dari modul aslinya** (PO customer & penjahit 1 produk dan 3 produk, invoice dengan & tanpa poin master, kwitansi) lalu content stream-nya di-inflate dan diperiksa otomatis: semua operasi teks ≥ 12 pt, tidak ada teks melewati tepi halaman, tidak ada teks saling menimpa, label tabel identitas lengkap, deadline merah+bold, POLA tepat di tengah, blok Keterangan/Syarat tercetak dengan bold sesuai tanda, "Catatan" tidak muncul lagi, dan ketiga dokumen menanam gambar 1920×1080 (logo baru) bukan logo lama 591×591
- **Belum diverifikasi:** tampilan halaman Data Master di browser (lingkungan ini tanpa browser) — perilaku editor dipastikan lewat tsc/eslint/build dan struktur komponen

---

## Revisi 15 Okt (lanjutan) — Kop PO sesuai referensi Owner + size chart di halaman gambar desain

Owner mengirim gambar acuan kop PO; sebelumnya kop bertabel satu kolom terlalu tinggi (11 baris ≈ 264 pt) sehingga isi terdorong ke bawah.

### Kop ringkas (PO customer & penjahit)
- **Sel logo di kiri + tabel dua kolom tiga baris** — `drawSheetHeader()` kini menggambar satu sel logo (100 pt, logo di tengah sel) di samping grid 2 kolom: `Nama | Bahan`, `Tgl Order | Warna`, `Deadline | Tinta / Bordir`. Garis sel 0.8 pt warna gelap seperti referensi
- **Label sebaris dengan nilai** (`Nama : Kak Dewangga`) dan **tanggal memakai nama hari** (`Sabtu, 29 Agustus 2026`, `Kamis, 10 September 2026`) — `formatDate()` PO memakai `weekday: "long"`
- **Sel Warna bertingkat**: baris `Warna :` lalu `Warna Base: …` dan `Warna List: …` (label tebal, nilai biasa) — memetakan `baseColor`/`color` dan `variationColor`
- **Deadline tetap disorot**: label + nilai merah (0.78, 0.12, 0.12) dan bold
- **Judul dokumen jadi satu baris tipis** (judul kiri, `PO-xxxx · Revisi n` kanan); nama produk (lembar per produk) di baris kecil di bawahnya. Heading bar produk di atas tabel ukuran dihapus karena sudah terwakili di kop
- **Baris pelengkap hanya muncul bila terisi** (Perusahaan/Instansi, Jenis pakaian/Kategori) dan **tinggi tiap baris mengikuti isinya (minimal 34 pt)** — bukan tinggi seragam. Hasil terukur: baris POLA kini di **266 pt** dari atas halaman (sebelumnya ±390 pt), sedangkan pada PO tanpa data pelengkap kop cukup ±113 pt
- **Judul POLA**: bar putih bergaris dengan teks `POLA : …` **tepat di tengah** (toleransi terukur < 3 pt)

### Size chart sesuai referensi + selalu ikut halaman gambar desain
- Tabel ukuran digambar ulang: **kolom label gelap** (`SIZE`/`PENDEK`/`PANJANG`), **header kolom ukuran gelap** dengan teks putih, angka rata tengah, **total per baris** di kolom kanan, lalu **baris `NOTE:` abu-abu dengan kotak total keseluruhan** di kanan (lebar label 76 pt, kolom TOTAL 62 pt, 9 kolom ukuran per blok)
- `drawAssets()` menerima parameter `reservedBelow`: ruang tabel ukuran ditahan lebih dulu, gambar desain **otomatis dikecilkan** (maks 300 pt, min 150 pt) supaya **size chart tetap di halaman yang sama, di bawah gambar desain**; kalau memang tidak cukup, gambar berikutnya yang pindah halaman — bukan size chart-nya
- Terukur pada PO 1 produk ber-gambar desain: gambar di halaman 1, `SIZE` di 614 pt dari atas, `NOTE` + kotak total di 696 pt → semuanya masih halaman 1

**Penyesuaian tes:** `tests/production-design-detail.test.mjs` sebelumnya memastikan urutan teks `drawSheetHeader → drawAssets → drawModelTable`; karena size chart sekarang berada di dalam `drawProductSheet()` (setelah gambar desain) dan nama produk pindah dari heading tabel ke kop, asersinya diubah menjadi: kop dipanggil sebelum `drawProductSheet`, dan di dalamnya gambar desain digambar sebelum tabel ukuran — properti yang sama (tiap lembar produk punya kop → gambar → size chart) tetap terjaga.

**Verifikasi (nyata):** `tsc` bersih · eslint 0 error (2 warning lama) · **206/206 tes** · `next build` sukses · **9 PDF di-generate ulang** dari modul aslinya (PO customer & penjahit: 1 produk, 1 produk + gambar desain, 3 produk; invoice dengan & tanpa poin master; kwitansi). Harness pemeriksa ikut diperbaiki: sekarang membaca **object stream** pdf-lib dan menelusuri **page tree**, jadi nomor halaman yang diperiksa benar (sebelumnya urutan stream membuat nomor halaman bergeser). Hasil: semua teks ≥ 12 pt, tidak melewati tepi halaman, tidak saling menimpa, sel kop lengkap (`Nama :`, `Bahan :`, `Tgl Order :`, `Warna :`, `Warna Base:`, `Warna List:`, `Deadline :`, `Tinta / Bordir :`), deadline merah+bold berhari, POLA tepat di tengah, dan size chart (`SIZE`, `PENDEK`, `PANJANG`, `TOTAL`, `NOTE:`, kotak total) berada di halaman 1 di bawah label gambar desain

## Revisi 15 Okt (lanjutan 2) — Halaman PO kosong dihapus + size chart selalu lengkap

Keluhan Owner: **halaman 2 PDF PO kosong (hanya footer)** dan size chart harus persis seperti contoh — **seluruh kolom ukuran tetap ditulis lengkap** walau PO tidak memesan ukuran tersebut.

### 1. Halaman kosong dibuang, bukan disisakan
- **Akar masalah:** `drawParagraph()` menulis label di dasar halaman, lalu isinya (yang butuh ruang) lompat ke halaman baru — halaman yang tertinggal hanya berisi label + footer. Reproduksi dengan **data PO asli dari DB** memastikannya: `PO-CUA091026-3` cetak 2 halaman dengan halaman 2 hanya `"Catatan: | -"` + footer; PO ber-roster menyisakan halaman kosong sebelum tabel roster.
- **Perbaikan 1:** `drawParagraph()` menghitung tinggi blok (label + seluruh baris) dulu, baru memutuskan pindah halaman → label tidak pernah tertinggal sendirian.
- **Perbaikan 2 (jaring pengaman):** tiap halaman ditandai lewat `markUsed()` pada setiap titik gambar (kop, gambar desain, size chart, heading bar, paragraf, roster); di akhir dokumen halaman yang **tidak terpakai** dihapus dengan `document.removePage(...)` → PO tidak pernah menyisakan halaman berisi footer saja. Penomoran halaman tetap benar karena hanya halaman kosong di belakang yang dibuang.
- **Hasil pada PO asli:** `PO-CUA091026-3` kini **1 halaman** (semula 2); `PO-CUA091026-2` dan `PO-CUT101026-1` **2 halaman** (halaman 2 = tabel roster terisi); tidak ada halaman yang hanya berisi footer.

### 2. Size chart selalu lengkap seperti contoh
- Kolom size chart kini memakai **daftar ukuran baku `SIZE_LADDER = [XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL]`** — semua kolom selalu tercetak walau PO hanya memesan mis. `S` dan `M`; kolom kosong dibiarkan kosong seperti contoh, angka dan **total per baris** tetap dihitung dari data PO.
- Ukuran di luar daftar (mis. `XXL`, `ALL SIZE`) **tetap ditambahkan sebagai kolom ekstra** di belakang supaya jumlahnya tidak hilang, lalu dibagi blok berikutnya bila melebihi 9 kolom (`SIZE_COLUMNS_PER_CHUNK`).
- Tinggi blok (`chartBlockHeight`) dipakai untuk menahan ruang di bawah gambar desain, sehingga chart yang kini selalu 9 kolom tetap muat satu blok di halaman yang sama.

**Verifikasi (nyata):**
- **4 PO asli dari DB** (`PO-CUA091026-2/3/4`, `PO-CUT101026-1`) di-generate ulang lewat `createPurchaseOrderPdf` + query yang sama persis dengan route PDF, lalu content stream tiap halaman di-inflate dan diurutkan lewat **page tree**: tidak ada halaman tanpa isi, tiap size chart memuat `XS…5XL`, `TOTAL`, `PENDEK`, `PANJANG`, `NOTE:`, total per baris = jumlah matriks PO (2/2/4), kotak `NOTE` = total qty, semua teks ≥ 12 pt dan tidak melewati tepi. PO aksesori (`PO-CUA091026-4`) tetap memakai blok `JUMLAH PRODUK` (tanpa size chart, sesuai desain).
- **9 PDF fixture** (PO customer & penjahit: 1 produk, 1 produk + gambar desain, 3 produk; invoice dengan & tanpa poin master; kwitansi) lolos pemeriksaan otomatis yang kini juga menandai **halaman tanpa isi** dan **kolom size chart yang hilang**.
- `tsc` bersih · eslint **0 error** (2 warning lama di `app/actions/crm.ts`) · **206/206 tes** (`tests/crm-validation.test.mjs` ditambah asersi penjaga: `SIZE_LADDER`, `usedPages`/`removePage`, tinggi blok paragraf) · `next build` sukses.
- **Belum diverifikasi:** tampilan PDF di browser/PDF viewer manual (lingkungan ini tanpa browser) — pemeriksaan dilakukan pada teks, posisi, dan struktur halaman hasil render yang sebenarnya.

---

## Revisi 17 Okt — 4 revisi client sebelum demo

Empat permintaan client dikerjakan sekaligus: kartu AOV, kunci kartu Follow Up, tab Peluang, dan sidebar analytics.

### 1. Kartu AOV dihapus dari dashboard (sekaligus menutup I1)
- [x] Kartu **AOV** (dan ikon `Wallet`) dilepas dari baris hasil sales `components/dashboard/dashboard-content-client.tsx`. Baris KPI kini 4 kartu: kartu jangkar setengah baris + **Repeat rate** + **Gross margin** + kartu lebar; ritme `DASH_SALES_SPANS` di `components/dashboard/dashboard-ui.tsx` dipangkas 5 → 4 entri (2 kolom + 2 kolom penuh pada xl, rapi 2×2). Skeleton memakai konstanta yang sama sehingga bentuknya tidak pernah melenceng dari isi aslinya
- [x] `averageOrderValue` **tetap dihitung** di payload `lib/crm/data.ts` (pola sama seperti `overdue`/`dueToday` dulu: dibuang dari tampilan, tidak dihapus dari data) — kalau nanti dipakai lagi tinggal pasang kembali kartunya

### 2. Kartu Follow Up tidak bisa dibuka — dari mana pun
- [x] Helper bersama `canOpenOpportunityDetail(stage)` di `lib/crm/constants.ts`: **hanya `stage !== "FOLLOW_UP"` yang bisa diklik** — Negosiasi, Deal, dan Lost tetap punya tautan judul; Follow Up tidak
- [x] Kartu kanban: judul bukan tautan, permukaan redup `border-muted-foreground/25 bg-muted/60` + judul `text-muted-foreground`, jadi sebelum diklik pun terlihat tidak seaktif kartu lain. Geser kartu & tombol "Ubah status" **tidak berubah** — kartu tetap bisa diproses, hanya pintu masuk halaman detailnya yang ditutup
- [x] **Semua jalur lain ikut dikunci** (konfirmasi Owner, 17 Okt): "Next action terdekat" di dashboard, baris tabel Prospek, riwayat komunikasi di halaman CRM **dan** halaman customer, serta "Peluang CRM" + "Peluang terbaru" di halaman customer — Follow Up tampil sebagai teks redup tanpa tautan. Payload ikut membawa `stage` (`lib/crm/data.ts`: select `urgentActions` dan `communicationActivitySelect`) supaya keputusan diambil di komponen dengan aturan yang sama
- Yang sengaja tetap bertaut karena bukan Follow Up: tombol "Tambah PO"/"Tambah invoice" (khusus Negosiasi), dialog "Buka detail peluang" (alur Deal), "Lihat PO"/"Kelola Invoice" (dokumen baru ada dari Negosiasi), "Kembali ke peluang" di Sales Order (Deal), dan tautan order→peluang di riwayat customer

### 3. Halaman detail peluang mulai dari tab PO (tab "Peluang" dihapus)
- [x] `OPPORTUNITY_DETAIL_TABS` kini `["po","invoice","deal","aktivitas"]` di `lib/crm/constants.ts`; `parseOpportunityDetailTab` tidak dikenal → jatuh ke **`"po"`**, jadi tautan lama `?tab=peluang` otomatis berakhir di tab PO (tidak error)
- [x] Panel **"Kualifikasi dan next action"** beserta form simpan dan versi read-only-nya dihapus dari `app/(app)/crm/peluang/[id]/page.tsx` (ikut terbuang: impor `OpportunityFields`, `SubmitButton`, `getCustomerFormOptions`, `OpportunityReadOnly`, serta status `peluang` di judul tab). Kartu di kanban Negosiasi → langsung PO, Invoice, Deal, Aktivitas
- [x] Semua redirect/notifikasi aksi CRM (`app/actions/crm.ts`: `opportunityRedirectPath`, `updateOpportunityAction`, flash "Peluang diperbarui.") dialihkan dari `?tab=peluang` ke **`?tab=po`** supaya tidak pernah mendarat di tab yang sudah tidak ada
- **Konsekuensi yang perlu client tahu:** kualifikasi & next action **tidak lagi bisa diedit dari halaman detail** karena form itu satu-satunya tempatnya. Aksi `updateOpportunityAction` dan komponen `opportunity-fields.tsx` sengaja tidak dihapus (kode mati yang tetap lolos lint/tsc, pola sama seperti `overdue`/`dueToday`) supaya pengembalian form tinggal satu sambungan. Kalau client masih perlu menyunting next action, opsi cepatnya: kembalikan form ke tab Aktivitas atau taruh tombol edit di header
- Alternatif yang dipertimbangkan & ditolak: tab Peluang disembunyikan khusus role tertentu — tidak dipakai karena revisi client lain yang bersifat permintaan langsung selalu dihapus penuh (preseden kartu "Follow-up mendesak"), bukan digerbangi role

### 4. Sidebar analytics: satu halaman, satu item aktif
- [x] Akar masalah: `isNavItemActive()` di `components/app-nav.tsx` memakai aturan awalan rute, sehingga `/analytics` dianggap aktif juga saat halaman `/analytics/lead-sources` dibuka — dan karena "Ringkasan" dan "Sumber & omzet" sama-sama memakai awalan `/analytics`, keduanya menyala. Ditambah cabang khusus **`if (href === "/analytics") return pathname === href;`** — sama pola dengan item Dashboard/Follow Up yang sudah ada. Kini `/analytics` menyalakan hanya Ringkasan, `/analytics/lead-sources` menyalakan hanya Sumber & omzet

**Verifikasi (nyata):** `npx tsc --noEmit` bersih · **210/210 tes** (`node --test`; 4 tes baru: kartu Follow Up terkunci, jalur lain (dashboard/Prospek/riwayat komunikasi/customer) ikut terkunci, tab Peluang dihapus, dan menu analytics satu item aktif — plus asersi tab fallback & redirect diperbarui ke `po`, serta tes baru "card AOV dihapus dari baris hasil sales" di `tests/dashboard-documents.test.mjs`) · eslint **0 error** (2 warning lama di `app/actions/crm.ts`) · `next build` **sukses, exit 0** ("Compiled successfully"; hanya warning custom cache-control bawaan Next.js).
- **Belum diverifikasi:** tampilan langsung di browser (lingkungan ini tanpa browser dan tanpa kredensial login Supabase) — perilaku dikunci lewat tsc/eslint/build/tes sumber. Kartu Follow Up juga belum bisa dilihat langsung karena 8 kartu di DB lokal berisi 3 Negosiasi, 4 Deal, 1 Lost, **0 Follow Up**; aturan klik & warna dipastikan dari kode dan tes

---

## 17 Okt (lanjutan) — Halaman Log Aktivitas (versi kilat)

Permintaan client: semua aktivitas user tercatat lengkap dan bisa dilihat Owner/Keuangan/Developer di website. Temuan penting: **data auditnya sudah tertulis sejak 27 Agu** — tabel `AuditEvent` (515 baris di DB lokal ≈ 472 kB, ditulis in-transaction oleh 11+ file action), termasuk pindah tahap peluang, hapus dokumen, dan unggah bukti bayar. Yang belum ada hanya **penampilnya**, jadi versi kilat ini membangun penampil tanpa migrasi apa pun. Penyimpanan tetap di Postgres (transaksional, ikut backup, gampang difilter); file `.jsonl.gz` di VPS tetap disiapkan nanti hanya untuk arsip 24 bulan + log teknis, bukan untuk log aktif.

### Yang dibuat
- [x] `lib/audit/labels.ts` — registry label Indonesia: **98 kode aksi** (`OPPORTUNITY_STAGE_CHANGED` → "Pindah tahap peluang", `PAYMENT_RECORDED` → "Catat pembayaran", dst) + **22 jenis entitas**; kode baru yang belum dipetakan tetap tampil lewat fallback yang merapikan kodenya (tidak pernah kosong atau mentah ber-underscore)
- [x] `lib/audit/data.ts` — `getAuditEventPage` (filter rentang tanggal opsional, pelaku, jenis entitas; pencarian nama/email pelaku + kode aksi/entitas mode insensitive; urut terbaru dulu; pagination pola `DATA_PAGE_SIZE`) dan `getAuditLogFilterOptions` (pelaku dari AppUser termasuk nonaktif; jenis entitas dari `groupBy` yang benar-benar tercatat — dropdown tidak pernah menawarkan entitas kosong). Keduanya digerbangi `requireActor(AUDIT_VIEW_ROLES)`
- [x] `AUDIT_VIEW_ROLES` di `lib/auth/permissions.ts` — Owner & Developer lolos otomatis lewat `hasRole`, ditambah KEUANGAN; ADMIN_CUSTOMER/ADMIN_PO/DESIGNER **tidak** (halaman ditolak, sama pola dengan /analytics)
- [x] Halaman `app/(app)/log-aktivitas/page.tsx` — tabel: Waktu · Pelaku (+role) · Aksi bahasa Indonesia · Entitas · Field berubah + tombol "Lihat"; filter Dari/Sampai tanggal, Pelaku, Jenis entitas, pencarian debounce, Reset, pagination + pilih baris per halaman. Tanpa filter = semua data terbaru dulu (data masih kecil; rentang tanggal tersedia kalau mulai padat)
- [x] `components/audit-event-detail.tsx` — dialog detail: nama/role/email pelaku, daftar `changedFields` sebagai badge, metadata JSON, kode aksi, tipe entitas, ID entitas & ID log (untuk telusur Developer)
- [x] Item menu "Log aktivitas" (ikon History) di `components/app-nav.tsx`, tampil hanya untuk 3 role itu — **Developer selalu bisa mengakses** (sesuai aturan proyek), terpasang sebelum Pengaturan

### Verifikasi (nyata)
- `npx tsc --noEmit` bersih · **219/219 tes** (`node --test`; 9 tes baru di `tests/audit-log.test.mjs` — fixture **97 kode aksi & 22 entitas diverifikasi punya label eksplisit**, gerbang role, gating menu, query, dialog) · eslint 0 error pada semua file baru/berubah · `npm run build` **exit 0** ("Compiled successfully", route `ƒ /log-aktivitas` terdaftar)
- Query data layer dijalankan terhadap DB lokal: 515 baris; filter entitas memilih 66 peluang; pencarian contains-insensitive memilih 33 invoice; rentang 30 hari memilih 299; pencarian nama pelaku & groupBy entitas benar
- **Uji render end-to-end nyata** (instance aplikasi terpisah di port 3002 + Supabase lokal — server dev utama di port 3000 tidak disentuh; 2 user sementara KEUANGAN & ADMIN_CUSTOMER dibuat lewat admin API lokal lalu **dihapus kembali**, tidak ada sisa): **26/26 pemeriksaan lolos** — halaman 200 dengan judul/kolom/filter/pagination/label Indonesia, filter entitas & pencarian pelaku bekerja, menu tampil untuk KEUANGAN, menu **tersembunyi** untuk ADMIN_CUSTOMER, ADMIN_CUSTOMER ditolak saat membuka paksa URL, tamu dialihkan ke /login
- **Belum diverifikasi:** interaksi klik "Lihat" membuka dialog di browser (lingkungan ini tanpa browser; tombolnya ter-render dan komponennya lolos build)

### Catatan untuk versi lengkap (menyusul, tanpa membongkar ini)
- Pencarian nomor dokumen (PO-/INV-) butuh kolom label entitas pada `AuditEvent` (migrasi kecil) — sementara pencarian mencakup pelaku, jenis aksi, dan jenis entitas
- Nilai before→after untuk field nominal/tanggal, event login/logout (butuh `actorId` nullable untuk login gagal), timeline per order, dan arsip otomatis 24 bulan ke VPS — arsip harus **mengecualikan** event yang direferensikan `CommunicationActivity` (FK `onDelete: Restrict`), kalau tidak prune akan gagal

---

## 17 Okt (lanjutan) — Import data asli Agustus 2026 (PROJECT AS + CRM)

Permintaan: isi sistem dengan **data asli** Agustus 2026 dari `PROJECT AS BULAN AGUSTUS 2026.xlsx` (sheet PROJECT/DP/PNGELUARAN MURNI/SALDO AKHIR/CATATAN) + tanggal order & customer dari `Data CRM AS Konveksi.xlsx` — bukan dummy. DB lokal dibersihkan dulu, lalu import dijalankan satu transaksi lewat `scripts/import-agustus-2026.mjs` (dry-run default + `--apply`; penjaga angka kunci berhenti sebelum menulis bila ada yang gagal).

### Yang diimpor (23 order, 22 customer — semua baris, tidak ada yang terlewat)
- [x] Rantai penuh per order: Opportunity → PurchaseOrder (AGREED) → Invoice (ISSUED) → SalesOrder (ACTIVE) + DealPayment + PaymentTerm + PaymentTransaction → SalesOrderCost (7 bucket HPP) + Expense kategori PROJECT per bucket → ProductionWorkOrder COMPLETED (+ step & activity). Nomor dokumen lanjut dari counter: INV-2026-00036..58 · OPP-000042..64 · SALES-ORDER-2026-00025..45 · WO-2026-00025..49
- [x] Uang masuk **95.191.855** (28 transaksi) mengikuti jadwal SALDO AKHIR/DP; jenis pembayaran mengikuti aturan: LUNAS 1 bayar penuh (Gibran, irgy, Hana, Ridwan, Iko), DEPOSIT (Reza & Celine 100 rb), sisanya DP; Ifana 4 pembayaran
- [x] HPP **62.205.440** dari sheet DP → 47 baris Expense PROJECT; beban operasional **10.871.167** dari PNGELUARAN MURNI → 69 baris apa adanya (17 kategori, total per kategori cocok 17/17)
- [x] **ORADO (819.000) & SAGA Kak Edwin (1.480.000) belum dibayar** → mengikuti alur resmi aplikasi (constraint DB melarang deal tanpa pembayaran awal): Invoice ISSUED + PendingDealPayment LUNAS menunggu, **tanpa SalesOrder/WorkOrder**, peluang tetap NEGOSIASI. Tampil di CRM (kartu "Menunggu LUNAS terlewat"), daftar invoice (badge Menunggu LUNAS), dan detail invoice dengan tombol **"Catat pembayaran LUNAS"** — saat uangnya masuk, SO + WO terbentuk otomatis. HPP ORADO (424.125) tetap tercatat sebagai Expense PROJECT tanpa SO
- [x] Abraham dipecah 5 item (Tshirt 72 · Kemeja chef 16 · Celana chef 12 · Polo 36 · Topi 24) → 5 WO; total 25 WO (209 step)
- [x] Metode pembayaran baru **"Transfer"** (dipakai semua transaksi import; tidak memicu wajib bukti)

### Verifikasi (nyata, dari DB setelah `--apply`)
- Semua penjaga + 13 baris verifikasi otomatis `[OK]`: 23 opportunity/PO/invoice · 21 SO + 21 dealPayment + 2 jadwal menunggu · 25 WO · invoice 122.461.000 · Expense PROJECT 62.205.440 · operasional 10.871.167 · uang masuk 95.191.855 · outstanding DealPayment 24.970.145 (21 SO) · jadwal menunggu 2.299.000 · nilai SO 120.162.000 · SalesOrderCost 61.781.315 · **net 22.115.248 = "Bersih" CATATAN**
- Spot check DB: stage 21 DEAL + 2 NEGOSIASI · Ifana (DP 5.499.000; termin 690 rb & 5.499.000 & 690 rb sudah lunas; sisa 10.000) · Respa sisa 385.000 · Sara sisa 1.674.145 · ORADO HPP kain 354.125 + pres 24.000 + DTF 46.000 = 424.125
- Data test dibersihkan lebih dulu lewat `scripts/cleanup-transactional-data.sql` (9 customer demo dihapus, 382 customer asli tetap; CommunicationActivity ikut bersih) — WhatsApp/AuditEvent/counter tidak disentuh
- **Belum diverifikasi:** tampilan di browser (lingkungan ini tanpa kredensial login) — dashboard, laporan keuangan filter Agustus, riwayat order, badge "Menunggu LUNAS" di daftar invoice, dan kanban produksi perlu dicek manual
- **Catatan lanjutan:** saat ORADO/Edwin membayar nanti, jangan isi ulang HPP ORADO di form HPP Sales Order baru (expense-nya sudah ada tanpa SO — isi ulang = dobel di laporan). Kalau ingin HPP itu menempel ke SO baru, cukup relink `salesOrderId` expense lama (ubah 3 baris data, bukan entri baru)
- **Catatan produksi:** import & pembersihan baru di DB lokal; eksekusi ke Supabase produksi menyusul atas perintah (urutan: backup → cleanup produksi → import produksi)

---

## CMS WEBSITE — `[x] SELESAI (perlu uji manual UI)`

Studio admin untuk seluruh halaman publik (landing, portofolio, size chart, katalog kain, kontak, detail produk) tanpa menyentuh kode. Rencana lengkap: `docs/RENCANA_CMS_WEBSITE.md`; panduan klien: `docs/PANDUAN_CMS.md`.

- [x] Konten disimpan sebagai satu dokumen JSON berversi di disk server (`CMS_DATA_DIR`), gambar di `CMS_UPLOAD_DIR` — **tanpa tabel/bucket/query Supabase baru**
- [x] Baca konten lewat `unstable_cache` + tag `cms-content`; simpan memakai tulis atomik (temp → fsync → rename), lock, snapshot otomatis, dan `expectedVersion` (konflik ditolak dengan pesan ramah)
- [x] Validasi Zod + sanitasi `sanitize-html` (allowlist tag/atribut; `javascript:`/`data:` ditolak; `target=_blank` dipaksa `rel="noopener noreferrer"`), diterapkan saat simpan dan saat render
- [x] Studio `/cms`: ringkasan, beranda, produk (+ tambah/hapus, induk–anak), portofolio, size chart, katalog kain, kontak, pengaturan website, riwayat (lihat + pulihkan)
- [x] Editor: urutan/penyembunyian section, daftar item dengan naik/turun, WYSIWYG TipTap (tebal/miring/garis bawah/daftar/tautan/hapus format/undo-redo), unggah gambar WebP otomatis, alt, posisi fokus
- [x] Pratinjau langsung `/cms-preview` lewat iframe + postMessage dengan perangkat Desktop/Tablet/HP, memakai komponen publik yang sama
- [x] Akses studio & preview hanya `OWNER` + `DEVELOPER` (role lain 404); menu **Website** hanya muncul untuk keduanya; `robots.txt` men-disallow `/cms` dan `/cms-preview`
- [x] Media route `/media/[...path]` dengan proteksi path traversal, cache immutable, dan `nosniff`; unggahan divalidasi lewat `sharp` (bukan ekstensi), di-reencode WebP maks 2560 px
- [x] Skrip: `cms:setup`, `cms:validate`, `cms:backup`, `cms:clean-orphans`; env `CMS_DATA_DIR`, `CMS_UPLOAD_DIR`, `CMS_BACKUP_DIR` di `.env.example`; `data/` masuk `.gitignore`
- [x] Halaman publik tetap statis/ISR (build: `/`, `/portofolio`, `/size-chart`, `/katalog-kain`, `/contact`, seluruh `/produk/[slug]`); bundle TipTap hanya ada di route `/cms`
- [x] Terverifikasi: `npx tsc --noEmit` bersih, `npm run lint` 0 error, `npm run build` sukses (13 route CMS terdaftar), `npm test` — 5 tes CMS baru lolos (schema, sanitasi, path, media, store)
- **Belum diverifikasi:** alur simpan/pulihkan lewat browser (lingkungan ini tanpa kredensial login) — perlu uji manual: edit tiap section, unggah gambar, simpan, buka publik, dan pulihkan versi


