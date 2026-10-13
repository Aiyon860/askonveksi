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
- [x] Jadwal tab Deal dikembalikan Lunas/DP (opsi Deposit dihapus dari form)

---

## SPRINT 2 — PO & Struktur Order (C + E) — prioritas TERTINGGI berikutnya

Digabung karena E3 (edit PO) dan C2/C5 (struktur PO) mengubah skema PO yang sama. Blocker produksi H-1.

- [x] C1 — Dekorasi multi-select; Sablon dipecah DTF/Plastisol/Rubber; Tinta = Printing
- [x] C2 — Multi-matriks/produk dalam 1 PO (syarat: 1 warna; beda warna = beda PO)
- [x] C3 — Upload Excel Roster → matriks terisi otomatis
- [x] C4 — Autosave draft PO (anti hilang saat lag/keluar)
- [x] C5 — Form PO: 2 field **Instansi** + **Pola** (ganti `productName` tunggal)
- [x] E1 — PDF PO 2 varian: customer + penjahit (`?variant=customer|penjahit`)
- [x] E2 — Hapus gate APPROVED → tombol Kirim 1 set PDF + checkbox konfirmasi customer
- [x] E3 — Edit PO setelah disepakati (kasus tambah qty H-1) + aturan dampak Invoice/SO/WO
- [ ] E4 — Deadline merah di PDF + tabel MODEL ikut contoh Tasya (butuh file contoh) — DITUNDA sesuai permintaan

## SPRINT 3 — Role & Produksi (D + G) — `[x] 6/6 SELESAI` — prioritas 2

Digabung dari dua cabang lewat merge: D2 & G2 dari cabang ini, D1/D3/G1/G3 dari rekan. Terverifikasi setelah merge: `tsc` bersih, 183/183 tes lolos, `lint` 0 error.

- [x] D1 — Role `ADMIN_PO` + upload desain langsung detailing → **rename** `ADMIN_PRODUCTION` → `ADMIN_PO` (migrasi `20261013000000_admin_po_role` menambah nilai enum + backfill akun lama; nilai lama tetap tersimpan untuk audit); `APP_ROLES`, `validation.ts`, `constants.ts`, halaman Pengguna memakai `ADMIN_PO`; hak = baca CRM (`CRM_VIEW_ROLES`, tanpa aksi tulis) + unggah desain (`DESIGN_UPLOADER_ROLES`) + kelola Produksi (`PRODUCTION_ROLES`)
- [x] D2 — Gambar hanya PNG/JPG/JPEG (tolak PDF/PSD) → `lib/design/image.ts` validasi ekstensi **dan** isi file; dipakai `design.ts` (unggah per produk) & `production.ts` (ganti desain, salinan awal, reset); `design-detail.ts` & `data.ts` hanya menampilkan `image/png`/`image/jpeg`; API attachment deteksi tipe isi; file picker PO & editor anotasi `accept=".png,.jpg,.jpeg"`
- [x] D3 — Detailing desain opsional → `design-annotations.ts` (maksimal 50, tanpa coretan pun sah) & `design-annotation-editor.tsx` (simpan/kirim tanpa anotasi)
- [x] G1 — Jalur Aksesori 5 stage: Produksi-QC-Packing-Pengiriman-Selesai → `workflow.ts` `AKSESORI_STAGE_SEQUENCE` (tahap JAHIT tampil sebagai "Produksi"), `productionStagesForGroup` / `boardStagesForGroup` / `stageLabelForGroup`, dipakai kanban, ringkasan, dan `service.ts` saat membuat WO
- [x] G2 — Admin Customer view-only produksi → `permissions.ts` `PRODUCTION_VIEW_ROLES` + `DETAIL_DESIGN_VIEW_ROLES` (keduanya kini `PRODUCTION_ROLES + ADMIN_CUSTOMER`); kanban, detail Work Order, dan detail desain memakai `canManage: isStageRole(role)`; aksi ubah tetap `PRODUCTION_ROLES`; UI menampilkan banner "Mode lihat saja" dan menyembunyikan geser/PIC/kendala/anotasi
- [x] G3 — Status Retur setelah Selesai + badge sticky → buka kembali dari Selesai menandai `needsRepair` (`reopenProductionAction`), kembali Selesai me-resetnya (`moveProduction`); kolom virtual **Retur** di kanban semua jalur; badge "Retur — Perlu Perbaikan" sticky di detail WO

## SPRINT 4 — CRM & Broadcast (B + H) — `[~] 6/7 SELESAI`

Dikerjakan di cabang `feat/sprint-4-crm-broadcast` tanpa mengubah Prisma schema (0 drift). Terverifikasi: `tsc` bersih, 170/170 tes lolos, `build` sukses. H3 ditunda karena terkait Sprint 2 (C2 multi-item PO) yang dikerjakan rekan.

### B — CRM / Pipeline
- [x] B1 — Tambah prospek, PIC lock Michelle → `customer-fields.tsx` lock Sales/PIC ke Michelle saat `prospect=true`; `crm.ts` resolve `salesPicId` ke Michelle atau fallback `ADMIN_CUSTOMER`
- [x] B2 — Sumber Lead "Lainnya" bisa custom → `customer-fields.tsx` tampilkan input teks saat pilih "Lainnya"; `crm.ts` find-or-create `LeadSource` dengan teks custom
- [x] B3 — Kanban pipeline font bold (Prospek ke kanan) → `pipeline-board.tsx` header, count, nama customer, judul kartu, dan badge ditambah `font-bold`
- [x] B4 — Data Master boleh tambah/edit/hapus oleh Admin Customer → `permissions.ts` tambah `ADMIN_CUSTOMER` ke `MASTER_DATA_ROLES`; `app-nav.tsx` update `canManageMasterData` (menu **Pengguna** tetap khusus Owner/Developer agar Admin Customer tidak melihat tautan tanpa akses)

### H — Broadcast
- [x] H1 — Import tanggal Excel ke Broadcast → `broadcast-date-excel.ts` parser XLSX + template generator; `route.ts` API download template; `broadcast-workspace.tsx` modal dialog import; `broadcast.ts` action membuat rantai Opportunity → PO → Invoice → SalesOrder + DealPayment per baris
- [x] H2 — Kategori produk di Broadcast (samakan dengan Campaign) → `broadcast-workspace.tsx` re-enable filter `productCategoryId`; `broadcast.ts` pass filter ke query; `broadcast-content.tsx` kirim `productCategories`
- [ ] H3 — Upload PO 2+ gambar/desain jadi 1 file + keputusan N WO *(ditunda — terkait C2 Sprint 2 oleh rekan)*

## SPRINT 5 — Dashboard & Landing (I) — prioritas 4 (polish, bisa diselingi)

- [ ] I1 — Hapus AOV dashboard
- [ ] I2a — Semua berkancing + Kemeja → Seragam Kerja (Virgin skip — sesuai keputusan)
- [ ] I2b — Pecah Jersey → Jersey Kerah + Jersey Oblong
- [ ] I2c — Portofolio hanya logo customer (butuh file logo)
- [ ] I2d — Logo WA resmi + perbesar

## SPRINT 6 — Absensi QR (J) — modul baru, terakhir

- [ ] Skema + generate/scan QR + halaman karyawan/admin + anti-titip + timezone Asia/Jakarta

---

## Keputusan terkunci (jangan ditanyakan lagi saat eksekusi)

1. PIC prospek = lock Michelle · 2. Master full akses Admin Customer (tambah/edit/hapus) · 3. 1 PO = 1 warna · 4. Hapus gate APPROVED → Kirim PDF + checkbox · 5. Form PO: Instansi + Pola · 6. Tanggal mundur khusus Invoice · 7. Virgin/kancing skip · 8. Grouping Project = sub-grup dalam tanggal per order · 9. Deposit ikut aturan DP 50% (skip perubahan) · 10. Footer Project = total halaman ini; footer Pengeluaran = total filter (inkonsistensi tercatat, belum diseragamkan).

## Dikenal belum sempurna (ditunda atas persetujuan Owner)

- Nomor kwitansi dari ID transaksi (`KWT-XXXXXXXX`), bukan urut resmi
- Template invoice = catatan default + rekening + TTD (layout tidak editable)
- Pajak satu tarif per invoice (bukan per item)
- Alasan hapus pengeluaran selalu kosong (form hapus tanpa input alasan)
- Filter list invoice belum ada "Menunggu Deposit" (badge ada)
- Role `DESIGNER` kini tanpa halaman: menu "Upload Desain" & `app/(app)/desain` dihapus (upload pindah ke detail PO), `DESIGN_VIEW_ROLES` hanya berlaku untuk API gambar — akun DESIGNER login dengan sidebar kosong. Menunggu keputusan Owner: beri akses `/detail-desain` atau retire role
- D1 dijalankan sebagai **rename** `ADMIN_PRODUCTION` → `ADMIN_PO` (migrasi `20261013000000_admin_po_role` backfill akun lama), bukan role baru berdampingan — berbeda dari kalimat D1 "hak = Admin Customer". Konfirmasi ke Owner sebelum rilis
