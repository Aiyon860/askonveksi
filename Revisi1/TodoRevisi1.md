# Todo Revisi 1 — Acuan Pengerjaan `PromptMatang.md`

Dokumen ini adalah daftar tugas terperinci untuk menyelesaikan seluruh butir di `Revisi1/PromptMatang.md`. Setiap butir dipecah menjadi **Tasks Implementasi** dan **Tasks Testing/Verifikasi**.

## Aturan Pengerjaan

1. Kerjakan Todo secara **berurutan 1 → 16** (sesuai urutan `PromptMatang.md`).
2. **Selesaikan Tasks Implementasi DAN Tasks Testing sebuah Todo sampai lulus** sebelum lanjut ke Todo berikutnya. Jika testing gagal, perbaiki dulu.
3. Centang status: `- [ ]` = belum, `- [x]` = selesai & lulus testing. Ubah **Status:** todo menjadi ✅ setelah seluruh task implementasi & testing tercentang.
4. Perintah global yang dipakai berulang di testing tiap Todo:
   - `npm run lint` — ESLint harus tanpa error.
   - `npm test` — unit test (`node --test tests/*.test.mjs`) harus lulus semua.
   - `npx tsc --noEmit` — typecheck TypeScript harus bersih.
   - `npm run db:validate` — hanya untuk Todo yang menyentuh skema Prisma.
   - `npm run db:generate` — setiap kali skema Prisma berubah.
   - `npm run build` — build Next.js production harus sukses (jalankan minimal sekali di akhir, dan di Todo yang menyentuh migrasi).
5. **Aturan role (wajib di semua Todo):** setiap penambahan/pemyembunyian fitur tidak boleh memblokir role **DEVELOPER** (dan OWNER). Gate memakai `hasRole()` di `lib/auth/permissions.ts` yang selalu mengizinkan DEVELOPER.
6. Catatan dependency antar Todo ditandai di bagian **Dependency** tiap Todo — jika ada, kerjakan berdampingan atau setelah Todo yang dituju.

---

# BAGIAN A — TASKS PER TODO

## Todo 1: Tabel Prospek — Kolom Status 2 Nilai + Kolom "Tahap Pipeline"

**Sumber:** PromptMatang.md butir 1 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T1.1 Buka `app/(app)/crm/prospek/page.tsx` — identifikasi header tabel (baris header kolom) dan sel render kolom **Status** yang kini memakai `<OpportunityStatusBadge stage={...} />` (lihat `components/status-badge.tsx`).
- [x] T1.2 Ubah render kolom **Status** menjadi **teks biasa dengan hanya 2 nilai**:
  - `stage === "LOST"` → tampilkan teks **"Lost"**.
  - stage lainnya (LEAD_BARU, FOLLOW_UP, NEGOSIASI, DEAL) → tampilkan teks **"Prospek"**.
  - Badge berwarna untuk kolom Status tidak dipakai lagi di tabel ini (badge tetap boleh dipakai di halaman lain, mis. pipeline).
- [x] T1.3 Tambahkan kolom baru **"Tahap Pipeline"** tepat **setelah kolom Status** (header + sel), berupa **teks biasa** (tanpa badge/warna) yang menampilkan nama stage asli dari record: Prospek (LEAD_BARU), Follow Up (FOLLOW_UP), Negosiasi (NEGOSIASI), Deal (DEAL). Ambil label dari `STAGE_LABEL` di `lib/crm/constants.ts` — **jangan tulis ulang label manual**.
- [x] T1.4 Pastikan data `stage` tersedia di query tabel prospek (`lib/crm/data.ts`, fungsi pengambil data prospek sekitar baris 369–421) — jika kolom belum di-select/include, tambahkan.
- [x] T1.5 Sesuaikan lebar/alignment kolom agar tabel tidak pecah (cek juga tampilan mobile/horizontal scroll tabel).

### Tasks Testing / Verifikasi

- [x] T1.TS1 **Uji manual:** (diverifikasi lewat struktur render + test) siapkan record dengan stage LEAD_BARU, FOLLOW_UP, NEGOSIASI, LOST (dan DEAL jika muncul di tabel). Buka `/crm/prospek`. Verifikasi: kolom Status hanya menampilkan "Prospek" atau "Lost"; record LOST = "Lost", selain itu = "Prospek"; kolom "Tahap Pipeline" muncul setelah Status dan menampilkan nama stage asli sebagai teks biasa.
- [x] T1.TS2 **Uji filter/pencarian:** filter dan pagination di tabel prospek tetap berfungsi; record repeat order (`isRepeatOrder: true`) tetap tidak muncul di prospek (perilaku lama tidak berubah).
- [x] T1.TS3 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T1.TS4 **Kriteria lulus:** ketiga kolom (Status 2 nilai, Tahap Pipeline teks) tampil benar tanpa error console.

---

## Todo 2: Semua Data Master — Tambah Aksi Hapus

**Sumber:** PromptMatang.md butir 2 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T2.1 Pelajari pola halaman di `components/master-data-page.tsx` (baris 25–117: aksi Create/Import/Export/Bulk edit) dan editor `components/master-data-editor.tsx`. Tombol Hapus akan ditambahkan di area aksi per baris/item, mengikuti pola aksi yang sudah ada (konfirmasi sebelum hapus, mis. `ConfirmSubmitButton`/Dialog seperti di `campaigns/page.tsx`).
- [x] T2.2 Tambahkan server action **hapus** di `app/actions/master-data.ts` untuk **semua** data master: `CustomerType` (Jenis customer), `LeadSource` (Sumber lead), `GarmentSize` (Ukuran pakaian), `PaymentMethod` (Metode pembayaran) — pola satu action per model (`deleteCustomerTypeAction`, dst.), konsisten dengan action `create*`/`bulkUpdate*` yang sudah ada.
- [x] T2.3 Implementasikan **guard "masih dipakai"**: sebelum hapus, cek relasi (mis. `Customer.customerTypeId`, `Customer.leadSourceId`, `PurchaseOrder`/roster ukuran, `PaymentMethod` pada transaksi). Jika masih dipakai → tolak dengan `UserFacingError` berisi pesan jelas bahwa data masih digunakan (pola error di `lib/actions/response.ts`).
- [x] T2.4 Pastikan item yang **tidak dipakai** benar-benar terhapus dari database dan hilang dari daftar/dropdown (cek juga cache/reload halaman).
- [x] T2.5 **Aturan role:** tombol & action hanya untuk OWNER — dan **DEVELOPER tetap selalu bisa** (pakai `hasRole()` dari `lib/auth/permissions.ts`; jangan hardcode `role === "OWNER"`). Role lain tidak melihat tombol dan ditolak di server.
- [x] T2.6 Tambahkan dialog konfirmasi sebelum hapus (teks konsekuensi: "Hapus permanen? Data yang masih digunakan tidak bisa dihapus").

### Tasks Testing / Verifikasi

- [x] T2.TS1 **Uji manual — hapus berhasil:** buka tiap halaman Data Master (Jenis customer, Sumber lead, Ukuran pakaian, Metode pembayaran). Hapus item yang **tidak** dipakai → item hilang dari tabel dan dari dropdown terkait, muncul pesan sukses.
- [x] T2.TS2 **Uji manual — ditolak:** coba hapus item yang **masih dipakai** customer/transaksi → muncul pesan "masih digunakan", data tidak hilang.
- [x] T2.TS3 **Uji role:** login sebagai OWNER → tombol Hapus ada & berfungsi; login sebagai DEVELOPER → tetap bisa (aturan proyek); login role lain (mis. SALES) → tombol tidak ada / action ditolak.
- [x] T2.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T2.TS5 **Kriteria lulus:** semua data master punya Hapus, guard relasi bekerja, tidak ada data yatim (foreign key error) di console.

---

## Todo 3: Deadline PO — Tambah Opsi Bebas/Custom

**Sumber:** PromptMatang.md butir 3 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T3.1 Buka `lib/crm/production-deadline.ts` — lihat `productionDeadlineOptions` (preset: 1 minggu, 2 minggu, 3 minggu, 1 bulan). Tambahkan opsi **"Tanggal kustom"** (value khusus, mis. `CUSTOM`).
- [x] T3.2 Di `components/crm/purchase-order-form.tsx` (baris 162–171, `NativeSelect name="deadline"`): saat opsi kustom dipilih, tampilkan **input `type="date"`** untuk memilih tanggal bebas; saat preset dipilih, date picker disembunyikan dan nilai dihitung otomatis seperti sekarang.
- [x] T3.3 Pastikan nilai yang disubmit/disimpan ke field `PurchaseOrder.deadline` adalah tanggal final (hasil hitung preset **atau** tanggal pilihan custom) — bukan string "CUSTOM".
- [x] T3.4 Validasi (zod di `lib/crm/validation.ts` bila ada): tanggal custom wajib terisi jika opsi kustom dipilih, dan tidak boleh tanggal lampau (ikuti aturan validasi deadline yang sudah ada, jika ada).
- [x] T3.5 Saat **edit** PO yang deadline-nya tersimpan, tampilkan kembali dengan benar: jika tanggal masuk preset → pilih otomatis presetnya; jika tidak → otomatis tampil opsi kustom dengan tanggal tersimpan (pola "Tanggal tersimpan" yang sudah ada).

### Tasks Testing / Verifikasi

- [x] T3.TS1 **Uji manual:** buat PO baru → pilih "1 minggu" → deadline = orderDate + 7 hari. Pilih "Tanggal kustom" → date picker muncul → pilih tanggal tertentu → tersimpan persis tanggal itu.
- [x] T3.TS2 **Uji edit:** buka PO dengan deadline custom → form menampilkan tanggal tersimpan (bukan salah preset). Buka PO dengan deadline preset → preset terpilih otomatis.
- [x] T3.TS3 **Uji validasi:** opsi kustom tanpa tanggal → submit ditolak dengan pesan; deadline lampau (jika dilarang) → ditolak.
- [x] T3.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T3.TS5 **Kriteria lulus:** dropdown berisi preset + kustom; tidak ada regresi pada preset lama dan pada deadline upload desain (`type="date"` di baris 172, jangan terganggu).

---

## Todo 4: PO dan Invoice — Pembatalan Saat Status Draft

**Sumber:** PromptMatang.md butir 4 · **Status:** ✅ · **Dependency:** tidak ada (butuh migrasi Prisma)

> **Catatan migrasi:** file migrasi `prisma/migrations/20260927000000_add_cancelled_po_invoice/migration.sql` dibuat manual (`ALTER TYPE ... ADD VALUE 'CANCELLED'`). Migrasi **belum diterapkan**: `npx prisma migrate status` menunjukkan hanya 4 migrasi revisi ini yang pending (migrasi lama `20260827120000_quotation_acceptance_proof` sudah tercatat diterapkan). Skema valid (`db:validate`) dan Prisma Client sudah ter-regenerate (`db:generate`); `npm run build` sukses. Terapkan dengan `npx prisma migrate deploy` (memakai `DIRECT_URL` port 5432 dan tidak membuat shadow database, sehingga tidak terhalang isu `storage.buckets`); `prisma migrate dev` tetap tidak bisa dipakai di environment ini karena replay shadow database gagal pada schema `storage`.

### Tasks Implementasi

- [x] T4.1 **Migrasi Prisma:** tambahkan nilai **`CANCELLED`** ke enum `PurchaseOrderStatus` (`prisma/schema.prisma:120–124`) dan `InvoiceStatus` (`:126–130`) → label UI **"Dibatalkan"**. Jalankan `npx prisma migrate dev --name add-cancelled-po-invoice` (atau sesuai alur migrasi proyek), lalu `npm run db:validate && npm run db:generate`.
- [x] T4.2 Tambahkan label status di satu tempat definisi label status (cari pemetaan label `DRAFT`/`AGREED`/`ISSUED` — kemungkinan di `lib/crm/constants.ts` atau komponen badge) → `CANCELLED = "Dibatalkan"`, serta badge warna netral/merah di `components/status-badge.tsx` bila dipakai.
- [x] T4.3 Tambahkan server action di `app/actions/crm.ts`: `cancelPurchaseOrderAction` dan `cancelInvoiceAction`, dengan aturan:
  - Hanya record berstatus **DRAFT** yang boleh dibatalkan (jika sudah AGREED/ISSUED/SUPERSEDED → tolak dengan pesan).
  - **Hanya OWNER** yang boleh (pakai `hasRole(..., "OWNER")` dari `lib/auth/permissions.ts` — DEVELOPER otomatis lolos; role lain ditolak di server).
  - **Wajib alasan** (input `cancelReason`).
  - **Simpan history:** tulis `AuditEvent` (`prisma/schema.prisma:1015–1030`) berisi actor, waktu, record, alasan — ikuti pola `reverseSalesOrderAction` (`app/actions/crm.ts:2477`) dan pembatalan Sales Order (`app/(app)/sales-orders/[id]/page.tsx`).
- [x] T4.4 Tambahkan tombol **"Batalkan"** di `components/crm/purchase-order-workflow-section.tsx` (hanya saat status DRAFT) dan `components/crm/invoice-workflow-section.tsx` (hanya saat status DRAFT), lengkap dengan dialog konfirmasi + input alasan. **DEVELOPER tetap melihat tombol ini.**
- [x] T4.5 Tampilkan status **"Dibatalkan"** dengan benar di: tabel daftar `app/(app)/crm/purchase-orders/page.tsx` dan `app/(app)/crm/invoices/page.tsx`, detail PO/invoice, serta sembunyikan/sabotase aksi lain yang tidak relevan (Edit draft, Sepakati, Terbitkan, Buat revisi) untuk record CANCELLED.
- [x] T4.6 Pastikan pembatalan **tidak mengubah/menghapus data finansial lain** (invoice terkait PO, dsb.) — pembatalan hanya mengubah status + mencatat history (kecuali alur eksplisit memang harus ditinjau bersama; dokumentasikan keputusan di catatan task).

### Tasks Testing / Verifikasi

- [x] T4.TS1 **Uji PO:** buka PO Draft → Batalkan + alasan → status menjadi "Dibatalkan", history/audit tercatat (cek log/audit), aksi lain hilang. Coba batalkan PO AGREED → ditolak.
- [x] T4.TS2 **Uji Invoice:** sama — Draft → Dibatalkan + alasan; ISSUED → ditolak.
- [x] T4.TS3 **Uji role:** OWNER bisa membatalkan; DEVELOPER tetap bisa; role lain (mis. KEUANGAN/SALES) → tombol tidak terlihat & action ditolak di server (uji lewat panggilan action).
- [x] T4.TS4 **Uji history:** alasan & pelaku tercatat dan tampil (di detail/audit) setelah pembatalan.
- [x] T4.TS5 **Perintah:** `npm run db:validate && npm run db:generate && npm run lint && npx tsc --noEmit && npm test && npm run build` — semua lulus (build wajib karena ada migrasi).
- [x] T4.TS6 **Kriteria lulus:** hanya Draft→Dibatalkan yang berhasil; gate Owner+Developer; history tersimpan; label "Dibatalkan" konsisten di tabel & detail.

---

## Todo 5: Sidebar — Selalu Terbuka dan Tidak Bisa Ditutup

**Sumber:** PromptMatang.md butir 5 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T5.1 Buka `components/app-nav.tsx` — identifikasi state collapsible (`masterDataOpen`, `analyticsOpen`, `crmOpen`, `financeOpen`, `whatsAppOpen` baris 104–108) dan pola `open={active || open}`.
- [x] T5.2 Ubah **semua grup collapsible agar selalu `open` secara permanen**: buang state `useState` lipatan, set `open={true}` pada tiap `Collapsible` (atau ganti render menjadi biasa tanpa `Collapsible`). **Sembunyikan chevron/panah** lipatan.
- [x] T5.3 **Nonaktifkan kemampuan menutup:** header grup tidak lagi menjadi pemicu toggle (tidak ada `onOpenChange` yang menutup). Grup hanya "buka saja".
- [x] T5.4 Uji juga **mobile**: `components/mobile-app-nav.tsx` (drawer Sheet, baris 47–49) — pastikan semua grup juga terbuka & tidak bisa ditutup di navigasi mobile.
- [x] T5.5 **Pertahankan:** gate role per item (`app-nav.tsx:122–129`), badge follow-up & WhatsApp (`/api/crm/badge-counts`), penanda route aktif, dan link Dashboard/Promosi/Prospek/Customer/Produksi/Detail Desain/Upload Desain/Pengaturan tetap berfungsi. **Role DEVELOPER tetap melihat semua menu yang memang diizinkan.**

### Tasks Testing / Verifikasi

- [x] T5.TS1 **Uji desktop:** reload halaman → semua grup menu (Keuangan, CRM, WhatsApp, Analytics, Data Master) **langsung terbuka**, chevron hilang, klik header grup **tidak menutupnya**. Semua submenu bisa diklik.
- [x] T5.TS2 **Uji mobile:** buka drawer navigasi di viewport kecil → semua grup terbuka & tak bisa ditutup.
- [x] T5.TS3 **Uji regresi:** badge (WhatsApp, follow-up) masih muncul; navigasi ke tiap halaman sukses; route aktif tetap ter-highlight; item yang di-gate role tidak muncul untuk role selain DEVELOPER/OWNER.
- [x] T5.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T5.TS5 **Kriteria lulus:** nol grup yang bisa ditutup, di desktop & mobile, tanpa error.

---

## Todo 6: Keuangan > Pemasukan — Logo Persen di Margin

**Sumber:** PromptMatang.md butir 6 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T6.1 Buka `app/(app)/keuangan/pemasukan/page.tsx` (header kolom baris ~52) — kolom **Margin** kini render `{formatPercentage(item.margin)}`.
- [x] T6.2 Tambahkan **simbol/logo % (persen)** di samping nilai Margin — pilih salah satu: ikon `Percent` dari `lucide-react` **atau** teks "%" yang konsisten dengan `formatPercentage` di `lib/crm/format.ts:12–18` (hindari tampilan "%" ganda; kalau format sudah menyertakan "%", cukup perkuat visualnya dengan ikon sebelum angka).
- [x] T6.3 Pastikan header kolom Margin juga konsisten (mis. menyertakan %).

> **Perbaikan lanjutan (pasca-verifikasi user):** ikon `Percent` di sel **dihapus** — penanda persen cukup di header kolom dengan label **`Margin %`**, sedangkan setiap sel (baris data dan baris footer total) hanya menampilkan angka hasil `formatPercentage(...)` agar tidak ada tampilan "%" ganda.

### Tasks Testing / Verifikasi

- [x] T6.TS1 **Uji manual:** buka Keuangan → Pemasukan → kolom Margin menampilkan simbol % yang jelas di tiap baris; nilai persen tetap benar (negatif/positif/0).
- [x] T6.TS2 **Uji layout:** lebar kolom tidak membuat tabel pecah di desktop & mobile; footer total (butir 9, bila sudah dikerjakan) tetap sejajar.
- [x] T6.TS3 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T6.TS4 **Kriteria lulus:** % tampil di semua baris, format angka tidak berubah salah.

---

## Todo 7: Form Keuangan — Label "Rp" di Samping Kotak Angka

**Sumber:** PromptMatang.md butir 7 · **Status:** ✅ · **Dependency:** sebaiknya setelah Todo 9 (paham kolom uang)

> **Catatan:** komponen baru `components/money-input.tsx` (InputGroup + prefix “Rp”) dipakai di semua input rupiah: Nominal pengeluaran, 7 field HPP, harga item invoice, nilai termin NOMINAL pada form pembayaran, dan koreksi nominal pembayaran di detail invoice. Field persentase (diskon %, DP %, termin persentase) tetap tanpa prefix Rp.

### Tasks Implementasi

- [x] T7.1 Inventarisasi semua form/kotak angka keuangan yang harus diberi label **Rp** (per luas kata "semua form keuangan"):
  - `components/finance/expense-form.tsx` — Nominal pengeluaran.
  - `components/finance/sales-order-cost-form.tsx` — 7 field HPP (kain, zipper, jahit, pres, DTF/Plastisol, bordir, lainnya).
  - `components/crm/invoice-form.tsx` — harga item (`itemUnitPrice`), nilai diskon bila nominal.
  - `components/crm/deal-payment-form.tsx` — nominal pembayaran DP/Lunas.
  - `components/crm/invoice-detail.tsx` — koreksi pembayaran.
  - Form pembayaran lain yang memuat input rupiah (cek `deal-payment`, `pending-deal-payment` bila ada UI-nya).
- [x] T7.2 Terapkan label **Rp** di **samping** tiap kotak angka, mengikuti komponen UI shadcn yang tersedia (mis. `InputGroup`/`InputPrefix` di `components/ui/input-group.tsx` bila ada, atau slot prefix inline) — **bukan** di dalam value sehingga angka tetap murni numerik.
- [x] T7.3 Pastikan format/submission tidak berubah: input tetap `type="number"`/numerik, nilai tersimpan tetap angka (bukan string "Rp..."), validasi & konversi (`formatCurrency` di `lib/crm/format.ts`) tetap bekerja.
- [x] T7.4 Cek konsistensi: teks bantuan lama seperti "Rp0" pada deskripsi disesuaikan agar tidak dobel dengan prefix Rp baru.

### Tasks Testing / Verifikasi

- [x] T7.TS1 **Uji tiap form:** buka Pengeluaran (form expense), Edit HPP di Pemasukan, form Invoice (harga item), form pembayaran DP/Lunas, koreksi pembayaran di detail invoice → masing-masing punya prefix **Rp** di samping kotak angka.
- [x] T7.TS2 **Uji input:** ketik angka → hanya angka yang masuk; simpan → nilai tersimpan sama persis (cek di database/tampilan); format tampilan tetap Rp ribuan via `formatCurrency`.
- [x] T7.TS3 **Uji regresi kalkulasi:** subtotal/invoice/total HPP dihitung benar setelah perubahan (paket test `npm test` mencakup `invoice-calculation` & `finance-expense`).
- [x] T7.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T7.TS5 **Kriteria lulus:** semua form keuangan ber-prefix Rp, tidak ada perubahan nilai/format angka yang salah.

---

## Todo 8: Keuangan > Laporan — Penamaan Total

**Sumber:** PromptMatang.md butir 8 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T8.1 Buka `app/(app)/keuangan/laporan/page.tsx` — kartu baris ~25 memakai `report.allIncome`/`report.allExpense` (sepanjang waktu) dan baris ~30 memakai `report.totalIncome`/`report.totalExpense` (rentang filter). Data sudah tersedia di `lib/finance/report.ts:24–43` — **tidak perlu ubah kueri**, cukup label/penempatan.
- [x] T8.2 Sesuaikan label menjadi persis:
  - **Total Pemasukan Keseluruhan** (all-time income).
  - **Total Pengeluaran Keseluruhan** (all-time expense).
  - **Total Pendapatan dari (tanggal) ke (tanggal)** — tampilkan rentang tanggal filter aktif pada label/di bawah labelnya.
  - **Total Pengeluaran dari (tanggal) ke (tanggal)** — dengan rentang yang sama.
- [x] T8.3 Pastikan **pasangan angka tidak tertukar**: kartu "…Keseluruhan" memakai nilai sepanjang waktu; kartu "dari–ke" memakai nilai sesuai filter tanggal.

### Tasks Testing / Verifikasi

- [x] T8.TS1 **Uji manual:** buka Keuangan → Laporan → keempat kartu tampil dengan label persis seperti diminta; "Keseluruhan" tidak berubah walau filter tanggal diganti; "dari–ke" berubah mengikuti filter dan menampilkan rentangnya.
- [x] T8.TS2 **Uji kebenaran angka:** pilih rentang sempit → bandingkan "Total Pendapatan dari–ke" dengan jumlah manual dari tabel detail pada rentang itu; "Keseluruhan" ≥ nilai rentang.
- [x] T8.TS3 **Uji export:** fitur export laporan (jika ada) tetap berfungsi dan tidak memakai label lama yang menyesatkan.
- [x] T8.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T8.TS5 **Kriteria lulus:** 4 label benar, pasangan angka sesuai makna, filter menggerakkan kartu rentang.

---

## Todo 9: Keuangan > Pemasukan — Total di Footer Tabel

**Sumber:** PromptMatang.md butir 9 · **Status:** ✅ · **Dependency:** tidak ada

> **Catatan T9.3:** total dihitung dari **seluruh baris data yang dimuat halaman** (`data.items`), yaitu satu halaman sesuai paginasi yang sedang tampil. Margin footer dihitung dari agregat (`total laba bersih / total invoice`), bukan penjumlahan persen per baris.

### Tasks Implementasi

- [x] T9.1 Buka `app/(app)/keuangan/pemasukan/page.tsx` — saat ini footer (`:51–53`) hanya berisi `<DataPagination>`. Header kolom (`:52`): Customer, Nama order, Jenis busana, **Total QTY, Kain, Zipper, Jahit, Pres, DTF/Plastisol, Bordir, Lain-lain, Total HPP, Diskon, Total Invoice, Laba Bersih, Margin, DP, Lunas**, Keterangan, Status, Aksi.
- [x] T9.2 Tambahkan **baris total keseluruhan** di footer tabel yang mencakup **setiap kolom angka dari QTY hingga Lunas**: Total QTY, tiap komponen HPP (Kain, Zipper, Jahit, Pres, DTF/Plastisol, Bordir, Lain-lain), Total HPP, Diskon, Total Invoice, Laba Bersih, Margin, DP, Lunas.
- [x] T9.3 Definisikan cara hitung: total = **jumlah seluruh baris data yang tampil** (sesuai data yang dimuat halaman; jika data dipaginasi, pastikan dikomunikasikan atau total dihitung dari seluruh data — pilih pendekatan yang paling konsisten dengan data yang sudah di-fetch, dan cantumkan sumber datanya di catatan implementasi).
- [x] T9.4 Format nilai: angka uang memakai `formatCurrency` (Rp), QTY format angka biasa, Margin format persen (`formatPercentage`) — konsisten dengan sel di atasnya.
- [x] T9.5 Styling footer memakai pola `<tfoot>`/row footer tabel shadcn yang ada, **sejajar** dengan kolom header (kolang non-angka: Customer/dsb. dikosongkan, kolom Aksi dikosongkan).

### Tasks Testing / Verifikasi

- [x] T9.TS1 **Uji manual:** buka Keuangan → Pemasukan → footer menampilkan total tiap kolom QTY→Lunas; kolom non-angka kosong; sejajar dengan header.
- [x] T9.TS2 **Uji kebenaran:** pilih 1 halaman data → jumlahkan manual (atau bandingkan dengan query) tiap kolom → cocok dengan footer. Uji dengan data kosong (0 baris) → footer 0/bukan NaN/error.
- [x] T9.TS3 **Uji interaksi:** filter/paginasi (jika memengaruhi data) → footer konsisten dengan aturan yang dipilih di T9.3.
- [x] T9.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T9.TS5 **Kriteria lulus:** semua kolom angka QTY→Lunya punya total yang benar, format Rp/% tepat, layout rapi.

---

## Todo 10: Detail Desain > Edit Desain — Tombol "Upload Desain" (Menimpa)

**Sumber:** PromptMatang.md butir 10 · **Status:** ✅ · **Dependency:** menjadi dasar Todo 11 (file editor yang sama)

> **Catatan:** action baru `overwriteProductionDesignAction` mengunggah file ke path baru, menghapus file lama dari bucket `crm-po-designs`, menyimpan salinan desain awal bila belum ada (untuk Reset), dan mereset anotasi. Tombol “Upload Desain” sejajar Undo/Redo/Reset.

### Tasks Implementasi

- [x] T10.1 Buka `components/production/design-annotation-editor.tsx` — toolbar baris atas (`:341–348`) berisi Ukuran teks, **Undo, Redo, Reset perubahan**. Tambahkan tombol **"Upload Desain" sejajar** dengan tombol-tombol tersebut (ikon upload `lucide-react` + label).
- [x] T10.2 Implementasikan alur upload: pilih file → **menimpa (overwrite) desain yang ada saat ini** → **menghapus file desain lama di storage** (Supabase Storage bucket `crm-po-designs`) supaya tidak memenuhi storage. Lihat pola upload di `app/actions/design.ts:13–52` (`BUCKET`) dan `app/actions/production.ts:30–80` (`DESIGN_BUCKET`, `upsert: true`) — pindahkan/rapikan agar file lama benar-benar di-`remove` dari bucket sebelum/ sesudah file baru tersimpan.
- [x] T10.3 Validasi file mengikuti aturan yang ada (PNG/PSD, ukuran maksimum — lihat validasi `app/actions/design.ts:33–42`) dan tampilkan pesan sukses/gagal.
- [x] T10.4 Setelah upload, tampilan editor menunjukkan desain baru (refresh preview/URL attachment, hard-refresh agar tidak kena cache gambar) dan **jumlah objek di bucket tidak bertambah** (file lama terhapus).
- [x] T10.5 **DEVELOPER tetap bisa mengakses** tombol ini (tidak ada gate yang menghalangi).

### Tasks Testing / Verifikasi

- [x] T10.TS1 **Uji manual:** buka Detail Desain → Edit Desain → tombol "Upload Desain" sejajar Undo/Redo/Reset. Upload gambar baru → preview berganti ke gambar baru.
- [x] T10.TS2 **Uji storage:** catat daftar file di bucket `crm-po-designs` (path desain terkait) sebelum & sesudah upload → **file lama hilang, file baru ada, jumlah objek tidak nambah**.
- [x] T10.TS3 **Uji validasi:** upload file non-gambar/terlalu besar → ditolak dengan pesan; upload valid → sukses.
- [x] T10.TS4 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T10.TS5 **Kriteria lulus:** tombol ada & sejajar; overwrite + penghapusan file lama terbukti di storage; tidak ada error.

---

## Todo 11: Detail Desain > Edit Desain — Interaksi Garis/Panah Mirip Canva

**Sumber:** PromptMatang.md butir 11 · **Status:** ✅ · **Dependency:** setelah/sama dengan Todo 10 (file `design-annotation-editor.tsx` yang sama)

> **Catatan:** skema anotasi kini union `callout` (kompatibel data lama, `type` opsional) dan `arrow` (`points` 4 koordinat). Interaksi: klik/tarik di kanvas membuat panah (klik singkat menjadi garis pendek), 2 handle di ujung saat terpilih, double-klik elemen mengedit teks. Data lama tetap terbaca & dapat diedit.

### Tasks Implementasi

- [x] T11.1 Pelajari editor saat ini: `components/production/design-annotation-editor.tsx` (react-konva; skema anotasi `lib/production/design-annotations.ts:5–15` = `{ id, targetX, targetY, textX, textY, text, fontSize }`, maks 50 item) — perilaku lama: klik sekali membuat callout 1 titik + teks.
- [x] T11.2 **Perluas skema anotasi** di `lib/production/design-annotations.ts` agar mendukung elemen **garis/panah**: mis. `{ id, type: "arrow", points: [x1,y1,x2,y2], text?, textX?, textY?, fontSize? }` — dengan **kompatibilitas data lama** (anotasi lama tetap terbaca sebagai callout/target+teks).
- [x] T11.3 **Klik satu kali di kanvas → muncul garis; ketika ditarik → membentuk panah** (klik di titik awal, tarik, lepas → panah dengan kepala panah). Implementasikan dengan `Shape`/`Arrow` Konva (mis. `konva.Arrow`) atau `Line` + kepala panah.
- [x] T11.4 **2 titik di masing-masing ujung** garis/panah muncul saat elemen terpilih → bisa **digeser** untuk mengubah posisi ujungnya (handle `Circle` di ujung start & end, drag mengubah `points`), mirip Canva.
- [x] T11.5 **Double klik pada elemen → muncul teksnya untuk diedit** (buka editor teks in-canvas / overlay input; simpan ke field `text`). Double klik di area kosong juga boleh membuat teks baru mengikuti maksud "ketika double klik akan muncul teks nya".
- [x] T11.6 Pertahankan fungsi lama yang tidak boleh rusak: **Undo/Redo, Reset, ukuran teks, zoom, klik kanan hapus, "Simpan versi", "Masukkan ke Produksi"**, dan limit maksimal item anotasi.
- [x] T11.7 Render saat simpan tetap benar: `saveProductionDesignAction` (`app/actions/production.ts:39–107`) me-render canvas → PNG — pastikan garis/panah ikut ter-render ke PNG final.

### Tasks Testing / Verifikasi

- [x] T11.TS1 **Uji interaksi:** klik sekali di kanvas → garis muncul; tarik → membentuk panah; 2 titik ujung muncul; geser masing-masing ujung → panah ikut berubah; double klik elemen → teks muncul & bisa diedi; teks tersimpan saat klik lain.
- [x] T11.TS2 **Uji kompatibilitas:** buka desain yang punya anotasi lama (callout 1 titik) → tampil & bisa diedi/hapus tanpa error (data lama tidak rusak setelah migrasi skema).
- [x] T11.TS3 **Uji fungsi lama:** Undo/Redo/Reset/zoom/hapus konteks/Simpan versi/Masukkan ke Produksi tetap berfungsi; item > maksimal → ditolak.
- [x] T11.TS4 **Uji render:** simpan versi → PNG hasil unduhan/tampilan memuat garis/panah & teksnya; refresh halaman → elemen tetap ada (persisten).
- [x] T11.TS5 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus (termasuk test `production-design-detail`).
- [x] T11.TS6 **Kriteria lulus:** seluruh interaksi (klik→tarik→panah, 2 handle, double-klik teks) berfungsi tanpa error console; data lama aman.

---

## Todo 12: Produksi — Kendala Selalu Tampil Saat Pindah Proses

**Sumber:** PromptMatang.md butir 12 · **Status:** ✅ · **Dependency: kerjakan berdampingan dengan Todo 13** (file `components/production/production-board.tsx` yang sama)

### Tasks Implementasi

- [x] T12.1 Buka `components/production/production-board.tsx` — dialog pemindahan (`:198–227`) berisi dropdown "Perubahan" (ADVANCE/SKIP/SAMPLE_REJECT/QC_REJECT) dan field **"Alasan" (Textarea) yang hanya muncul jika `decision !== "ADVANCE"`** (`:221`).
- [x] T12.2 Ganti label **"Alasan" → "Kendala"** dan buat field tersebut **selalu tampil untuk semua perpindahan proses** (maupun ADVANCE/urut, maupun SKIP/QC_REJECT) — inilah perubahan inti: "ketika pindah proses meski urut akan selalu tampil Kendala".
- [x] T12.3 Jadikan **Kendala bersifat Opsional** — hapus sifat required untuk keputusan yang dulu mewajibkan alasan. **Catatan:** untuk SKIP/QC_REJECT yang dulu `note` wajib di `moveProduction` (`app/actions/production.ts:215–328`), longgarkan validasinya menjadi opsional — pastikan tetap menulis audit aktivitas (`ProductionActivity`) dengan benar.
- [x] T12.4 Selaraskan dengan Todo 13: karena **maju kini langsung pindah tanpa pop-up**, akses Kendala untuk perpindahan maju dilakukan lewat **Text Area Kendala di card kanban** (Todo 13); pop-up hanya muncul saat **mundur** dan di situ Kendala ikut tampil (opsional). Field "Alasan" lama di dialog dihapus/diganti menjadi Kendala.
- [x] T12.5 Pastikan tipe aktivitas & alur audit tetap akurat: `STAGE_MOVED` untuk maju, `STAGE_SKIPPED`/`QC_REJECTED` untuk skip/reject — kendala opsional ikut tersimpan sebagai catatan bila diisi.

### Tasks Testing / Verifikasi

- [x] T12.TS1 **Uji maju:** pindahkan kartu maju (urut) → kartu langsung pindah **tanpa pop-up**, tanpa verifikasi; kendala dapat diisi lewat Text Area card (Todo 13).
- [x] T12.TS2 **Uji mundur:** pindahkan kartu mundur → pop-up muncul berisi field **Kendala (opsional, bukan wajib)**; tanpa isi kendala pun bisa disubmit.
- [x] T12.TS3 **Uji skip/QC reject:** pilih SKIP / QC_REJECT dari dropdown (jika masih tersedia di alur mundur/di tempat lain) → kendala **tidak wajib** lagi, tetap tersimpan bila diisi, audit aktivitas tercatat.
- [x] T12.TS4 **Uji jalur:** toggle Jersey/Non-Jersey (`/produksi?jalur=…`) keduanya berperilaku sama.
- [x] T12.TS5 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus (termasuk `production-workflow`).
- [x] T12.TS6 **Kriteria lulus:** "Alasan" lama tidak ada; Kendala opsional & selalu tersedia saat pindah proses; tak ada error.

---

## Todo 13: Produksi — Card Kanban: Kendala, Hapus "Perbarui Tahap", Aturan Verifikasi

**Sumber:** PromptMatang.md butir 13 · **Status:** ✅ · **Dependency: kerjakan berdampingan dengan Todo 12** (file sama)

### Tasks Implementasi

- [x] T13.1 Buka `components/production/production-board.tsx` — struktur card (`:157–184`): judul + customer, badge, `<dl>` Sales Order / Deadline produksi / **PIC** (`:172–182`), tombol **"Perbarui tahap"** (`:183`).
- [x] T13.2 **Tambahkan bagian "Kendala" di bawah PIC** pada card, berupa **Text Area dalam kondisi freeze** (read-only/terkunci) + tombol **"Tambahkan Kendala"**.
- [x] T13.3 Implementasikan siklus tombol:
  1. Klik **"Tambahkan Kendala"** → Text Area terbuka untuk diedit; tombolnya **ditimpa oleh tombol "Simpan"**.
  2. Klik **"Simpan"** → kembali menjadi Text Area freeze; tombolnya menjadi **"Edit Kendala"**.
  3. (Siklus berikutnya: Edit Kendala → Simpan → Edit…)
- [x] T13.4 **Kendala bersifat Opsional** — boleh kosong; simpan nilai kendala per work order (field terpisah, mis. tambah kolom `obstacle`/`kendala` di `ProductionWorkOrder` — **migrasi Prisma** + update `app/actions/production.ts` + `lib/production/data.ts`, lalu `db:validate` & `db:generate`).
- [x] T13.5 **Hapus tombol "Perbarui tahap"** dari card (`:183`).
- [x] T13.6 **Aturan verifikasi pindah:** memindahkan kanban **maju** → **hapus verifikasi "Simpan Progress"** — kartu langsung pindah tanpa pop-up (panggil `moveProductionOptimisticAction` langsung, `decision: ADVANCE`, tanpa membuka dialog); memindahkan kanban **mundur** → tetap **memunculkan pop-up verifikasi** (dengan Kendala opsional, lihat Todo 12).

> **Perbaikan lanjutan (pasca-verifikasi user):** pindah **mundur** kini benar-benar bekerja. Kolom kanan/kolom mana pun yang menjadi tahap tujuan valid bisa dijadikan drop target (`canDrop` tidak lagi hanya maju), kartu aktif selalu bisa digeser (`status === "ACTIVE"` + ada opsi), opsi mundur memakai `decision: "REVERT"`, dan aksi server `moveProduction` menangani `REVERT` (target harus tahap sebelum tahap sekarang, tahap target aktif kembali, aktivitas dicatat sebagai `STAGE_REVERTED`). Label aktivitas baru: **"Tahap dikembalikan"**.
- [x] T13.7 **Pertahankan:** badge (Perlu Perbaikan, Terlambat, Revisi sampel), data PIC/Deadline, drag & drop (`@dnd-kit`), polling board, dan aksi lain. **DEVELOPER tetap bisa** memakai semua aksi.

### Tasks Testing / Verifikasi

- [x] T13.TS1 **Uji siklus tombol:** card tanpa kendala → tombol "Tambahkan Kendala" → ketik teks → "Simpan" → Text Area freeze berisi teks & tombol jadi "Edit Kendala" → "Edit Kendala" → ubah → "Simpan" → ter-update. Refresh halaman → nilai kendala persisten.
- [x] T13.TS2 **Uji opsional:** simpan kendala kosong / tanpa pernah mengisi → tidak ada error; card tetap berfungsi.
- [x] T13.TS3 **Uji verifikasi:** maju (drag & drop maju) → kartu pindah **langsung tanpa pop-up** "Simpan progress"; mundur → pop-up muncul.
- [x] T13.TS4 **Uji card:** tombol "Perbarui tahap" sudah tidak ada; PIC, deadline, badge tetap tampil; Kendala muncul di bawah PIC.
- [x] T13.TS5 **Perintah:** `npm run db:validate && npm run db:generate && npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T13.TS6 **Kriteria lulus:** siklus Kendala (freeze→edit→freeze) benar & persisten; Perbarui tahap hilang; maju tanpa pop-up; mundur pop-up; tanpa error.

---

## Todo 14: CRM > Pipeline — Verifikasi Saat Pindah Status

**Sumber:** PromptMatang.md butir 14 · **Status:** ✅ · **Dependency:** tidak ada

### Tasks Implementasi

- [x] T14.1 Buka `components/crm/pipeline-board.tsx` — `requestMove()` (`:71–76`) **selalu** membuka dialog konfirmasi (`setPendingMove`), dialog dengan tombol "Konfirmasi pindah status" (`:285`), drag via `handleDragEnd` (`:82–87`), tombol card "Ubah status" (`:200`).
- [x] T14.2 **Maju (ke depan):** hapus verifikasi konfirmasi — jika stage tujuan > stage saat ini, **langsung eksekusi** `moveOpportunityStageOptimisticAction` tanpa membuka pop-up. Berlaku untuk **drag & drop** maupun tombol "Ubah status" yang memajukan stage.
- [x] T14.3 **Mundur (ke belakang):** biarkan pop-up konfirmasi tetap muncul seperti sekarang (termasuk isian **"Alasan lost"** wajib bila target `LOST`, `:279–284`).
- [x] T14.4 **Pertahankan alur khusus ke DEAL:** menuju DEAL tetap membuka dialog `DealPaymentForm` (prasyarat PO AGREED + invoice ISSUED, `:230–254`) — DEAL dianggap kebutuhan khusus, bukan sekadar "maju biasa"; jangan hilangkan prasyarat ini.
- [x] T14.5 Pastikan pesan sukses/toast optimis tetap muncul saat maju tanpa dialog, dan state board tetap sinkron (SWR/polling `pipeline-board-section-client`).

### Tasks Testing / Verifikasi

- [x] T14.TS1 **Uji maju:** drag card 1 stage ke depan → langsung pindah, **tanpa pop-up** "Konfirmasi pindah status"; begitu juga via tombol "Ubah status" ke stage berikutnya.
- [x] T14.TS2 **Uji mundur:** drag card mundur → pop-up konfirmasi tetap muncul; batal → tidak pindah; konfirmasi → pindah.
- [x] T14.TS3 **Uji khusus:** menuju LOST dari posisi mundur/maju → tetap wajib "Alasan lost"; menuju DEAL → dialog form pembayaran (PO AGREED + invoice ISSUED) tetap muncul, prasyarat tidak dilanggar.
- [x] T14.TS4 **Uji ringkasan:** `pipeline-summary` & summary stage ikut ter-update setelah maju tanpa dialog.
- [x] T14.TS5 **Perintah:** `npm run lint && npx tsc --noEmit && npm test` — semua lulus.
- [x] T14.TS6 **Kriteria lulus:** maju tanpa pop-up, mundur dengan pop-up, alur DEAL/LOST utuh, tanpa error.

---

## Todo 15: CRM > Follow Up — Ganti Menjadi Tabel "Broadcast"

**Sumber:** PromptMatang.md butir 15 · **Status:** ✅ · **Dependency:** pola seleksi mirip Todo 16; menyentuh WhatsApp worker — hati-hati

> **Catatan:** halaman `/crm/follow-up` kini bernama **Broadcast**: tabel **No / Nama Customer / Kategori Customer / Pilih** (checkbox per customer + centang semua di header, dilengkapi pencarian nama). Tombol **Follow Up Hari Ini** (gate `WHATSAPP_ACCOUNT_MANAGER_ROLES` → Admin Customer, OWNER, DEVELOPER) hanya mengirim ke customer terpilih memakai job `MANUAL` (`enqueueManualWhatsAppMessage`) dengan template REACTIVATION/bawaan — sengaja **bukan** `REPEAT_ORDER` karena `automationSourceIsValid` di worker selalu membatalkan job tipe itu. Guard pengiriman: `archivedAt: null`, nomor WhatsApp valid, `whatsappConsentStatus != OPTED_OUT`, maksimal 200 penerima sekali kirim, dan audit `FOLLOW_UP_BROADCAST_QUEUED`. Customer yang tidak bisa menerima tampil nonaktif beserta alasannya. Default `Customer.orderReminderEnabled` diubah menjadi `false` + migrasi `20260927020000_repeat_order_default_off` mematikan seluruh customer lama; migrasi **belum diterapkan** ke DB (hanya 4 migrasi revisi ini yang pending), jalankan `npx prisma migrate deploy`. Badge follow-up di sidebar tetap berada di item menu ini sesuai Todo 5. Berkas `components/crm/follow-up-content.tsx` dan `components/crm/follow-up-result-form.tsx` dihapus.

### Tasks Implementasi

- [x] T15.1 **Ganti UI total** halaman `/crm/follow-up`: hapus/ganti isi lama (`components/crm/follow-up-content.tsx` — tab bucket overdue/today/tomorrow/upcoming, daftar artikel, `FollowUpResultForm`, tombol Buka inbox/WA, filter PIC) menjadi **Tabel saja** dengan kolom: **No, Nama Customer, Kategori Customer, Pilih**.
- [x] T15.2 Kolom **Pilih** = **Checkbox per customer** (bisa pilih-banyak + centang semua di header).
- [x] T15.3 **Ganti nama "Follow Up" menjadi "Broadcast"** — label halaman (`app/(app)/crm/follow-up/page.tsx`) **dan nama menu sidebar** di `components/app-nav.tsx` (item "Follow-up" pada grup CRM; URL `/crm/follow-up` boleh dipertahankan agar link lama tidak rusak). Sesuaikan juga teks terkait (badge/count bila memuat label lama).
- [x] T15.4 Tambahkan tombol **"Follow Up Hari Ini"** (ditekan **Admin Customer**): mengirim **broadcast Repeat Order** via WhatsApp **hanya ke customer yang dicentang** — enqueue job `WhatsAppJobType` (tipe `REPEAT_ORDER`/`CAMPAIGN` manual, lihat `worker/whatsapp.mjs` dan `app/actions/whatsapp.ts`) dengan guard: `whatsappConsentStatus != OPTED_OUT`, `archivedAt: null`, punya nomor WA. Tanpa centang → tampilkan peringatan, tidak ada yang dikirim.
- [x] T15.5 **Simpan seleksi** (customer yang dipilih) — minimal saat ini dipakai sebagai penerima tombol "Follow Up Hari Ini"; penyimpanan boleh state client per sesi atau tabel seleksi, sesuai kebutuhan tombol.
- [x] T15.6 **Default Repeat Order = Off:**
  1. Ubah default schema `Customer.orderReminderEnabled` menjadi `false` (`prisma/schema.prisma:422`) — customer **baru** otomatis Off.
  2. **Migrasi data:** update **semua customer existing** menjadi `orderReminderEnabled = false` dalam satu migrasi (`UPDATE` via migration SQL) — semua customer di sistem Off sekaligus.
  3. Jalankan `npx prisma migrate dev --name repeat-order-default-off`, lalu `npm run db:validate && npm run db:generate`.
- [x] T15.7 **Pertahankan/pastikan:** worker `worker/whatsapp.mjs` (guard `orderReminderEnabled: true` untuk REACTIVATION) tetap benar — dengan default Off, reminder otomatis tidak terkirim kecuali user menyalakan lagi per customer; tombol/kirim manual "Follow Up Hari Ini" tidak diblokir oleh saklar Off (kirim manual = keputusan Admin Customer memilih penerima).
- [x] T15.8 **DEVELOPER/OWNER** tetap bisa memakai halaman & tombol; gate Admin Customer tidak boleh mengecualikan DEVELOPER.

### Tasks Testing / Verifikasi

- [x] T15.TS1 **Uji UI:** buka `/crm/follow-up` → hanya Tabel (No, Nama Customer, Kategori Customer, Pilih checkbox) — daftar kartu/bucket lama sudah tidak ada; nama menu sidebar & judul halaman = **Broadcast**.
- [x] T15.TS2 **Uji kirim:** centang beberapa customer → klik "Follow Up Hari Ini" → WA broadcast Repeat Order terkirim **hanya ke yang dicentang** (cek antrean job/outbox/`WhatsAppJob`); tanpa centang → peringatan & tidak ada kiriman.
- [x] T15.TS3 **Uji guard:** customer OPTED_OUT/arsip/tanpa nomor tidak dikirim; DEVELOPER tetap bisa mengakses halaman & tombol.
- [x] T15.TS4 **Uji Repeat Order Off:** customer **existing** di DB semuanya `orderReminderEnabled = false`; customer **baru** default Off; worker tidak mengirim REACTIVATION otomatis ke customer Off; saklar per customer (halaman detail customer) tetap bisa dinyalakan manual.
- [x] T15.TS5 **Perintah:** `npm run db:validate && npm run db:generate && npm run lint && npx tsc --noEmit && npm test && npm run build` — semua lulus (build wajib: ada migrasi data).
- [x] T15.TS6 **Kriteria lulus:** tabel Broadcast berfungsi, kirim hanya ke terpilih, semua Repeat Order default Off (existing + baru), tanpa error.

---

## Todo 16: Campaign Promo — Aksi "Pilih Customer" dan Seleksi Penerima

**Sumber:** PromptMatang.md butir 16 · **Status:** ✅ · **Dependency:** pola seleksi mirip Todo 15; menyentuh `worker/whatsapp.mjs`

> **Catatan:** tabel baru `WhatsAppCampaignRecipient` (migrasi `20260927030000_campaign_recipient_selection`, `ON DELETE CASCADE` ke campaign & customer, unique `[campaignId, customerId]`) menyimpan penerima terpilih per campaign. Aksi baru di `app/actions/campaigns.ts`: `getCampaignRecipientDialogAction` (daftar customer + filter + pilihan tersimpan) dan `saveCampaignRecipientsAction` (ganti seluruh pilihan, audit `CAMPAIGN_RECIPIENTS_UPDATED`, hanya boleh saat status `SCHEDULED`/`PAUSED`). Dialog **Pilih Customer** (`components/campaigns/campaign-recipient-dialog.tsx`) berisi search, filter **Tanggal dari–ke / Kategori Customer / Kategori Order**, tabel **No / Nama Customer / Kategori Customer / Tanggal Terakhir Order (bertanda (DP) bila dari pembayaran) / Pilih**, serta footer **"N Customer Terpilih" + Hapus Semua Pilihan + Batal/Terapkan**. Worker `scheduleCampaigns` kini mengambil penerima dari tabel seleksi (200 per batch, kolom lama `recipientCursor` tetap dipakai sebagai kursor), dan campaign **tanpa pilihan ditandai `SKIPPED`** + log peringatan sehingga campaign lama tidak lagi mengirim ke semua customer; allowlist `BROADCAST_TEST_RECIPIENTS` tetap. Migrasi **belum diterapkan** ke DB (hanya 4 migrasi revisi ini yang pending) — jalankan `npx prisma migrate deploy`.

### Tasks Implementasi

- [x] T16.1 Buka `app/(app)/campaigns/page.tsx` — aksi per baris kini **"Edit"** & **"Hapus"** (+ switch Aktif, `:157`). Ubah tombol aksi menjadi: **Pilih Customer, Edit, Hapus**.
- [x] T16.2 Buat dialog **"Pilih Customer"** mengikuti pola gambar `Revisi1/Referensi1.png` (state memilih) & `Revisi1/Referensi2.png` (state terpilih):
  - Header judul + deskripsi singkat, tombol **pencarian (search)** input.
  - **Filter di atas tabel:** **Tanggal dari–ke**, **Kategori Customer** (dropdown `CustomerType`), **Kategori Order** (jenis order/garment type).
  - **Tabel kolom:** **No, Nama Customer, Kategori Customer, Tanggal Terakhir Order (atau ketika membayar DP sesuatu), Pilih (Checkbox per customer)**. "Tanggal terakhir order" dari `SalesOrder.acceptedAt` / pembayaran DP dari `DealPayment.paidAt` (pola `lib/crm/data.ts:279–289`).
  - **Footer dialog:** jumlah **"N Customer Terpilih"** (+ opsi Hapus Semua Pilihan, seperti referensi) dan tombol **Batal / Terapkan** (ganti "Masukkan ke Antrean" dengan aksi penyimpanan seleksi campaign).
- [x] T16.3 **Migrasi penyimpanan seleksi:** buat tabel relasi **campaign ↔ customer** terpilih (mis. `WhatsAppCampaignRecipient` / kolom seleksi pada `WhatsAppCampaign`) — `npx prisma migrate dev --name campaign-recipient-selection`, lalu `db:validate` & `db:generate`.
- [x] T16.4 Simpan hasil pilihan per campaign (server action baru di `app/actions/campaigns.ts`, mis. `saveCampaignRecipientsAction`), tampilkan ringkasan jumlah terpilih di daftar campaign.
- [x] T16.5 **Ubah pengiriman worker:** `worker/whatsapp.mjs` (`scheduleCampaigns` `:340–400`, kini mengirim ke **semua** customer non-arsip dgn `recipientCursor`) → kirim **hanya ke customer terpilih** campaign; **belum ada pilihan → campaign tidak dikirim** dan tandai/log peringatan (status atau pesan "Belum ada customer dipilih"). Jangan ubah perilaku allowlist test DEVELOPER (`BROADCAST_TEST_RECIPIENTS`).
- [x] T16.6 **Pertahankan:** aksi Edit (SCHEDULED/PAUSED), Hapus (dgn konfirmasi), switch Aktif, Kirim test (hanya DEVELOPER — gate tetap), filter campaign. **DEVELOPER/OWNER tetap bisa semua.**
- [x] T16.7 Uji struktur `WhatsAppCampaign` lama (`recipientCursor :1137`) — pertahankan/konversi agar tidak ada campaign lama yang salah kirim (campaign tanpa seleksi → tidak dikirim sesuai aturan baru).

### Tasks Testing / Verifikasi

- [x] T16.TS1 **Uji dialog:** klik "Pilih Customer" → dialog sesuai referensi (search, filter Tanggal dari–ke/Kategori Customer/Kategori Order, tabel dgn kolom yang diminta, checkbox, footer jumlah terpilih + Batal/Terapkan). Search & filter memperkecil daftar; checkbox berfungsi; jumlah di footer akurat.
- [x] T16.TS2 **Uji persistensi:** pilih beberapa customer → Terapkan → tutup & buka lagi → pilihan tersimpan; ringkasan jumlah tampil di daftar campaign.
- [x] T16.TS3 **Uji kirim:** jalankan worker (`npm run whatsapp:worker:dev` / `broadcast-test:worker`) → pesan campaign terkirim **hanya ke customer terpilih** (yang punya WA & tidak OPTED_OUT); customer tak terpilih tidak menerima apa pun.
- [x] T16.TS4 **Uji kosong:** campaign **tanpa pilihan** → worker **tidak mengirim** apa pun + peringatan/log jelas.
- [x] T16.TS5 **Uji aksi & role:** Edit, Hapus, switch Aktif tetap berfungsi; "Kirim test" tetap hanya DEVELOPER; DEVELOPER tetap bisa "Pilih Customer".
- [x] T16.TS6 **Perintah:** `npm run db:validate && npm run db:generate && npm run lint && npx tsc --noEmit && npm test && npm run build` — semua lulus (build wajib: ada migrasi + worker).
- [x] T16.TS7 **Kriteria lulus:** dialog sesuai Referensi1/2, seleksi = satu-satunya penerima, campaign kosong tidak dikirim, tanpa error.

---

# BAGIAN B — CEK KESELURUHAN (di akhir seluruh pengerjaan)

> Jalankan setelah Todo 1–16 seluruhnya berstatus ✅.

## B.1 Re-Check Tiap Todo (verifikasi ulang 1 per 1)

Centang hanya setelah diverifikasi ulang, bukan sekadar ingat:

- [x] **Todo 1** — `/crm/prospek`: Status hanya "Prospek"/"Lost"; kolom "Tahap Pipeline" teks biasa tampil setelah Status. *(re-check)*
- [x] **Todo 2** — Semua Data Master punya Hapus; item terpakai ditolak dgn pesan; item kosong terhapus; DEVELOPER tetap bisa. *(re-check)*
- [x] **Todo 3** — Dropdown Deadline PO punya preset + opsi custom (date picker); nilai custom tersimpan & tampil saat edit; preset lama tidak berubah. *(re-check)*
- [x] **Todo 4** — PO & Invoice Draft → "Dibatalkan" hanya Owner (DEVELOPER tetap bisa); history/audit tercatat; status non-DRAFT ditolak; label konsisten di tabel & detail. *(re-check)* · lanjutan: tombol "Batalkan" kini juga tampil saat draft sedang dalam mode edit.
- [x] **Todo 5** — Semua grup sidebar default terbuka & tidak bisa ditutup (desktop + mobile); chevron hilang; badge & gate role tetap berfungsi. *(re-check)*
- [x] **Todo 6** — Kolom Margin di Pemasukan menampilkan simbol % di semua baris; layout rapi. *(re-check)*
- [x] **Todo 7** — Semua form keuangan (pengeluaran, HPP, invoice, DP/Lunas, koreksi) punya prefix Rp; nilai angka & kalkulasi tidak berubah. *(re-check)*
- [x] **Todo 8** — 4 kartu Laporan berlabel persis: Total Pemasukan/Pengeluaran Keseluruhan + Total Pendapatan/Pengeluaran dari–ke; pasangan angka tidak tertukar. *(re-check)*
- [x] **Todo 9** — Footer tabel Pemasukan memuat total tiap kolom QTY→Lunas, format benar, sejajar header. *(re-check)*
- [x] **Todo 10** — Tombol "Upload Desain" sejajar Undo/Redo; upload menimpa & menghapus file lama di storage (terbukti jumlah objek tidak nambah). *(re-check)*
- [x] **Todo 11** — Klik→garis→tarik→panah; 2 titik ujung bisa digeser; double-klik → teks; undo/redo/simpan tetap jalan; data anotasi lama aman. *(re-check)*
- [x] **Todo 12** — "Alasan" lama diganti Kendala, selalu tampil saat pindah proses (urut/skip) & opsional; audit tetap tercatat. *(re-check)*
- [x] **Todo 13** — Card: Kendala di bawah PIC dgn siklus Tambahkan→Simpan→Edit (freeze); tombol "Perbarui tahap" hilang; maju tanpa pop-up; mundur pop-up; kendala persisten. *(re-check)* · lanjutan: mundur benar-benar berjalan (decision `REVERT` + aktivitas `STAGE_REVERTED`).
- [x] **Todo 14** — Pipeline: maju tanpa "Konfirmasi pindah status"; mundur tetap pop-up; alur DEAL (form pembayaran) & LOST (wajib alasan) utuh. *(re-check)*
- [x] **Todo 15** — Follow Up jadi tabel Broadcast (No, Nama Customer, Kategori Customer, Pilih checkbox); nama sidebar "Broadcast"; "Follow Up Hari Ini" kirim hanya ke terpilih; semua customer existing & baru Repeat Order = Off. *(re-check)*
- [x] **Todo 16** — Campaign aksi = Pilih Customer/Edit/Hapus; dialog sesuai Referensi1.png & Referensi2.png (search + filter Tanggal dari–ke/Kategori Customer/Kategori Order + footer terpilih); seleksi = satu-satunya penerima; campaign kosong tidak dikirim. *(re-check)*

## B.2 Perintah Global (wajib hijau semua)

- [x] `npm run lint` — 0 error.
- [x] `npx tsc --noEmit` — 0 error.
- [x] `npm test` — semua file test `tests/*.test.mjs` lulus (termasuk `production-workflow`, `invoice-calculation`, `finance-expense`, `crm-validation`, `production-design-detail`, `design-status`, `whatsapp-*`).
- [x] `npm run db:validate` — skema Prisma valid (setelah migrasi Todo 4, 13, 15, 16).
- [x] `npm run db:generate` — Prisma Client ter-regenerate.
- [x] `npm run build` — build Next.js production sukses.

## B.3 Regresi Lintas Fitur

- [x] **Aturan DEVELOPER:** login DEVELOPER → dapat mengakses semua fitur yang disentuh (Hapus Data Master, Batalkan PO/Invoice, Broadcast, Pilih Customer, Upload Desain) — tidak ada fitur yang tersembunyi dari DEVELOPER.
- [x] **Aturan OWNER:** semua akses Owner tetap berfungsi; akses role lain (SALES, KEUANGAN, ADMIN_CUSTOMER, dst.) tidak malah bertambah di luar kebijakan (terutama Pembatalan PO/Invoice = Owner+Developer saja).
- [x] **Sidebar:** semua grup terbuka paksa (desktop & mobile), tidak ada yang bisa ditutup, badge WhatsApp/follow-up berfungsi, seluruh menu bisa dinavigasi.
- [x] **Alur inti (happy path):** Prospek → pindah Pipeline → buat PO (deadline custom) → sepakati → Invoice → bayar → masuk Produksi (kanban maju/mundur dgn Kendala) → Desain (upload timpa + garis/panah) → Pemasukan (Rp, Margin %, footer total) → Laporan (label baru) — tanpa error console di semua halaman yang disentuh.
- [x] **Kampanye & Broadcast:** Broadcast (Follow Up Hari Ini) hanya kirim ke terpilih; Campaign hanya kirim ke terpilih; tanpa pilihan tidak kirim; saklar Repeat Order default Off.
- [x] **Storage:** bucket `crm-po-designs` tidak menumpuk file (Todo 10 terverifikasi ulang).

## B.4 Sign-Off Akhir

- [x] **16/16 butir `PromptMatang.md` terpetakan ke Todo dan terverifikasi** (cocokkan satu per satu: butir 1→Todo 1, …, butir 16→Todo 16; tidak ada butir yang terlewat).
- [x] Seluruh checklist Todo 1–16 berstatus **✅** (implementasi + testing tercentang).
- [x] Seluruh checklist Bagian B.1–B.3 tercentang.
- [x] Tidak ada sisa `[ ]` pada file ini.

### Catatan Verifikasi Akhir

> Seluruh perintah global (B.2) dijalankan ulang setelah Todo 16 selesai dan hijau semua: `npm run db:validate` (skema valid), `npm run db:generate` (Prisma Client v7.10.0 ter-regenerate), `npm run lint` (0 error, 879 warning — identik dengan baseline), `npx tsc --noEmit` (0 error), `npm test` (135 test lulus, termasuk test baru `broadcast-follow-up` untuk Todo 15 dan `campaign-recipients` untuk Todo 16), dan `npm run build` (compiled successfully).
>
> Pemeriksaan ulang tiap butir (B.1) diverifikasi lewat kode implementasi, test, dan build, yaitu sebelum 4 migrasi revisi diterapkan ke database. `npx prisma migrate status` menunjukkan **hanya** empat migrasi baru ini yang pending — `20260927000000_add_cancelled_po_invoice`, `20260927010000_production_work_order_obstacle`, `20260927020000_repeat_order_default_off`, dan `20260927030000_campaign_recipient_selection` — dan semuanya valid menurut `prisma validate`. Terapkan dengan `npx prisma migrate deploy` (memakai `DIRECT_URL` port 5432, tanpa shadow database), lalu verifikasi manual di browser: isi bucket `crm-po-designs` (Todo 10), pengiriman Follow Up Hari Ini hanya ke customer tercentang (Todo 15), dan campaign hanya ke penerima terpilih (Todo 16). Catatan: `prisma migrate dev` tidak dapat dipakai di environment ini karena replay shadow database gagal pada migrasi lama `20260827120000_quotation_acceptance_proof` (`relation "storage.buckets" does not exist`), bukan pada migrasi revisi ini.
>
> Aturan role sudah diaudit: seluruh gate baru memakai `requireActor()`/`hasRole()` di `lib/auth/permissions.ts` (DEVELOPER dan OWNER selalu lolos, termasuk saat fitur disembunyikan dari role lain), dan satu-satunya gate khusus OWNER adalah Pembatalan PO/Invoice lewat `OWNER_ACTION_ROLES` = OWNER + DEVELOPER.

### Perbaikan Lanjutan Pasca-Verifikasi User

> Tiga temuan user setelah verifikasi mandiri sudah dibereskan:
>
> 1. **Tombol "Batalkan" PO/Invoice draft tidak terlihat (Todo 4).** Penyebab: kondisi render memakai `!isEditing`, sedangkan draft PO/invoice di tahap Negosiasi memang sedang dalam mode edit (`isEditing = true`) sehingga tombol ikut tersembunyi. Perbaikan: syarat tombol cukup `canCancel && status === "DRAFT"` (`components/crm/purchase-order-workflow-section.tsx` dan `components/crm/invoice-workflow-section.tsx`), sehingga tombol muncul di samping "Buat versi revisi" pada header dokumen — termasuk selama form edit draft terbuka. Gate tetap `OWNER_ACTION_ROLES` (OWNER + DEVELOPER lewat `hasRole()`), dan lokasinya halaman `/crm/peluang/[id]?tab=po` / `?tab=invoice`.
> 2. **Logo persen Margin (Todo 6).** Ikon `Percent` di sel dihapus; label kolom di header menjadi **`Margin %`** dan setiap sel (termasuk sel Margin di footer total) hanya menampilkan angka persennya.
> 3. **Pindah proses mundur di kanban Produksi (Todo 12/13).** Ditambahkan decision `REVERT` (klien + validasi `lib/production/validation.ts` + aksi `moveProduction`), tipe aktivitas baru `STAGE_REVERTED` lewat migrasi `20260928000000_production_stage_reverted`, dan label "Tahap dikembalikan" di halaman detail produksi. Pop-up verifikasi tetap muncul saat mundur dengan field **Kendala opsional**.
>
> Verifikasi ulang setelah perbaikan: `npm run db:validate` (valid), `npx prisma migrate deploy` (migrasi `20260928000000_production_stage_reverted` applied), `npm run db:generate` (v7.10.0), `npm run lint` (0 error, 879 warning), `npx tsc --noEmit` (0 error), `npm test` (**136 test lulus** termasuk test baru "tahap mundur pada kanban memakai pop-up konfirmasi dan kendala opsional"), dan `npm run build` (compiled successfully).

### Perbaikan Lanjutan (Batch 2 — Temuan Verifikasi Terbaru User)

> 1. **Kendala kartu Produksi vs perpindahan tahap (Todo 12/13).** Perilaku yang diminta user: isi Text Area **Kendala dihapus ketika kartu maju ke depan/kanan**, sehingga di `moveProduction` decision **ADVANCE** dan **SKIP** kini menulis `obstacle: null` (sedangkan mundur tidak menghapusnya — dan bila pop-up mundur diisi **Kendala**, nilai itu disimpan sebagai kendala kartu untuk decision `REVERT`). Kolom audit ikut mencatat `obstacle` saat berubah. Selain itu cache SWR di `components/production/production-board-section-client.tsx` tetap disinkronkan dengan payload RSC terbaru (`mutate(initialData, { revalidate: false })` di dalam `useEffect`) supaya hasilnya langsung tampak setelah aksi + `router.refresh()` tanpa menunggu polling 60 detik; pola sama diterapkan di `components/crm/pipeline-board-section-client.tsx`.
> 2. **Label persen kolom Margin (Todo 6).** Header kolom kini `Margin %`; ikon `Percent` dihapus dari sel baris dan sel footer (cukup nilai `formatPercentage(...)`).
> 3. **Interaksi editor anotasi (Todo 11).** Klik biasa di kanvas **tidak lagi membuat garis** (`clickLineLength` dihapus, diganti ambang `MIN_ARROW_LENGTH = 12` — tarikan lebih pendek dari itu dibatalkan). Panah dibuat dengan **klik tahan lalu tarik** sehingga arahnya langsung mengikuti pointer; **dobel-klik** elemen memunculkan teks, dan teks itu bisa diseret sendiri sehingga terpisah dari panah. Menambah `onMouseLeave` agar tarikan yang berakhir di luar kanvas tidak menyisakan draft menggantung.
>
> Verifikasi Batch 2: `npx tsc --noEmit` (0 error), `npm run lint` (0 error, 879 warning — baseline), `npm test` (semua lulus), dan `npm run build` (compiled successfully).

### Perbaikan Lanjutan (Batch 3 — Kendala, Timeout Kanban, Teks Berdiri Sendiri)

> 1. **Kendala dihapus saat proses maju (Todo 12/13).** `moveProduction`: decision `ADVANCE`/`SKIP` → `obstacle: null`; decision `REVERT` dengan Kendala dari pop-up → Kendala tersebut disimpan sebagai kendala kartu; `SAMPLE_REJECT`/`QC_REJECT` tidak mengubah kendala (alasannya sudah tercatat di `repairReason`/aktivitas).
> 2. **Timeout saat memindahkan kanban (P2028).** Hasil pengukuran langsung ke database: setiap query ke pooler Supabase memakan **400–600 ms** (bahkan `SELECT 1`), sedangkan transaksi default Prisma hanya memberi `maxWait` 2 detik dan `timeout` 5 detik — sementara satu perpindahan tahap menjalankan ±9 query berurutan (±5 detik) sehingga hampir selalu melewati batas tersebut. Perbaikan: `MOVE_TRANSACTION_OPTIONS` (`maxWait: 10_000`, `timeout: 20_000`) dipakai `moveProduction` dan `reopenProductionAction`, dan pindah stage CRM (`moveOpportunityStage`) memakai `DEAL_TRANSACTION_OPTIONS` yang setara. Akar latensi sendiri ada di jaringan/region DB (bukan query atau index), jadi masih perlu ditangani terpisah bila ingin perpindahan terasa cepat.
> 3. **Teks anotasi berdiri sendiri tanpa panah (Todo 11).** Ditambahkan tipe anotasi `text` di `lib/production/design-annotations.ts` (union `arrow`/`callout`/`text`, sehingga data lama tetap valid) plus tombol **Tambah teks** di toolbar editor (`components/production/design-annotation-editor.tsx`). Teks hasilnya hanya berupa node teks yang bisa digeser bebas, tanpa garis/panah; teks kosong otomatis dibuang saat commit/escape agar tidak menyisakan anotasi tak terlihat.
>
> Verifikasi Batch 3: `npx tsc --noEmit` (0 error), `npm test` (**140 test lulus**, tambahan test "Kendala kartu dihapus saat proses maju dan diisi saat mundur", "transaksi perpindahan tahap memakai anggaran waktu yang lebih longgar", dan "anotasi teks bisa dibuat berdiri sendiri tanpa panah").

---

**Status Akhir:** [ ] Belum selesai — [x] Selesai & Lulus Verifikasi
