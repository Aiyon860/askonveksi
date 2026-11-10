# Matriks cakupan alur user — Askonveksi

Sumber penemuan: route `app/**/page.tsx`, navigasi `components/app-nav.tsx` + `components/cms/cms-studio-nav.tsx`, server actions `app/actions/*.ts`, API `app/api/**`, schema `prisma/schema.prisma`, akses `lib/auth/page-access.ts` + `lib/auth/permissions.ts`.

## Konteks lingkungan

| Item | Nilai | Bukti |
| --- | --- | --- |
| URL lokal | `http://localhost:3000` | Dev server Next (`next-server`) listen `:3000` |
| Jalankan app | `npm run dev` (`package.json` scripts.dev) | [DARI-KODE-SAJA] |
| Worker WhatsApp (opsional) | `npm run whatsapp:worker` | [DARI-KODE-SAJA] |
| Auth | Supabase Auth + profil `AppUser` | `app/actions/auth.ts` |
| Brand | `ASKONVEKSI` / `SAGA` | `prisma/schema.prisma` enum `Brand` |

### Akun uji lokal

Pola password lokal: `{local-part}123` (contoh `michelle` → `michelle123`). Semua baris di bawah diverifikasi `signInWithPassword` + login UI kecuali catatan.

| Email | Password | Role AppUser | Landing setelah login | Bukti |
| --- | --- | --- | --- | --- |
| `owner@mail.com` | `owner123` | OWNER | `/dashboard` | [TERVERIFIKASI-BROWSER] |
| `tasya@mail.com` | `tasya123` | KEUANGAN | `/dashboard` | [TERVERIFIKASI-BROWSER] `evidence/01-login-keuangan.png` |
| `michelle@mail.com` | `michelle123` | ADMIN_CUSTOMER | `/dashboard` | [TERVERIFIKASI-BROWSER] `evidence/01-login-admin-customer.png` |
| `nina@mail.com` | `nina123` | ADMIN_PO | `/produksi` | [TERVERIFIKASI-BROWSER] `evidence/01-login-admin-po.png` |
| `desainer@mail.com` | `desainer123` | DESIGNER | `/absensi` | [TERVERIFIKASI-BROWSER] `evidence/01-login-designer.png` |
| `farel@mail.com` | `farel123` | ADMIN_SAGA | `/absensi` | [TERVERIFIKASI-BROWSER] `evidence/01-login-admin-saga.png` |
| `devd@example.com` | `devd123` | DEVELOPER | `/dashboard` | [TERVERIFIKASI-BROWSER] `evidence/01-login-developer.png` |
| `devf@example.com` | `devf123` | DEVELOPER | `/dashboard` | [TERVERIFIKASI-BROWSER] API `signInWithPassword` (UI setara `devd`) |

Catatan: `BOOTSTRAP_OWNER_*` di `.env` **tidak** cocok. Crawl awal sempat memakai magic-link sebelum password ditemukan.

Auth Supabase juga punya `desain@mail.com`, `adminsaga@mail.com` (belum dipetakan ke baris `AppUser` aktif di query lokal).

### Catatan akses role

- `hasRole()` selalu meloloskan `DEVELOPER`, `OWNER`, `KEUANGAN` selain daftar role spesifik (`lib/auth/permissions.ts:63-65`).
- `DESIGNER` / `ADMIN_SAGA` = attendance-only (`isAttendanceOnly`).
- Menu nav ≠ seluruh aksi; aksi modal/detail tetap tercantum di baris fitur.

## Status dokumentasi

| Kode | Arti |
| --- | --- |
| `belum` | Belum ada file alur |
| `kode` | File ada, mayoritas klaim dari kode |
| `browser` | File ada + langkah utama diverifikasi di browser |
| `gagal` | Tidak bisa diverifikasi penuh; alasan di PROGRESS / file fitur |

## Matriks

| # | Fitur | Route/URL | File kode terkait | Role (inti + bypass) | Status |
| --- | ---: | --- | --- | --- | --- |
| 01 | Login / logout / ganti password | `/login`, `/account/password` | `app/login/page.tsx`, `app/actions/auth.ts`, `app/account/password/page.tsx` | Semua role (login); ganti password: semua yang masuk | browser |
| 02 | Switch brand | chrome app (sidebar) | `app/actions/brand.ts`, `components/brand-switcher.tsx` | OWNER / KEUANGAN / DEVELOPER | browser |
| 03 | Dashboard CRM | `/dashboard` | `app/(app)/dashboard/page.tsx`, `app/api/crm/dashboard/**` | CRM_VIEW + KEUANGAN (+bypass) | browser |
| 04 | Absensi clock-in | `/absensi` | `app/(app)/absensi/page.tsx`, `app/actions/attendance.ts` | Semua kecuali OWNER/DEVELOPER | browser |
| 05 | Laporan & pengaturan absensi | `/absensi/laporan` | `app/(app)/absensi/laporan/page.tsx`, `app/actions/attendance.ts` | OWNER (+bypass) | browser |
| 06 | Master: jenis customer | `/master-data/customer-types` | `app/(app)/master-data/customer-types/page.tsx`, `app/actions/master-data.ts` | MASTER_DATA_ADMIN (+bypass); baca CRM via katalog | browser |
| 07 | Master: sumber lead | `/master-data/lead-sources` | `…/lead-sources/page.tsx`, `app/actions/master-data.ts` | sama | browser |
| 08 | Master: ukuran pakaian | `/master-data/garment-sizes` | `…/garment-sizes/page.tsx`, `app/actions/master-data.ts` | OWNER + ADMIN_PO (+bypass) | browser |
| 09 | Master: kategori produk | `/master-data/product-categories` | `…/product-categories/page.tsx`, `app/actions/master-data.ts` | MASTER_DATA_ADMIN (+bypass) | browser |
| 10 | Master: metode pembayaran | `/master-data/payment-methods` | `…/payment-methods/page.tsx`, `app/actions/master-data.ts` | sama | browser |
| 11 | Master: pengaturan invoice | `/master-data/invoice-settings` | `…/invoice-settings/page.tsx`, `saveInvoiceSettingsAction` | sama | browser |
| 12 | Master: profil perusahaan | `/master-data/business-profile` | `…/business-profile/page.tsx`, logo/signature API | sama | browser |
| 13 | Admin pengguna | `/admin/users` | `app/(app)/admin/users/page.tsx`, `app/actions/users.ts` | DEVELOPER (+ OWNER/KEUANGAN via hasRole) | browser |
| 14 | Customer (list/detail/CRUD/impor/arsip) | `/customers`, `/customers/[id]` (+ alias `/crm/pelanggan`) | `app/(app)/customers/**`, `app/actions/crm.ts` | CRM_VIEW (+bypass) | browser |
| 15 | Prospek | `/crm/prospek` | `app/(app)/crm/prospek/page.tsx`, create/updateProspect* | CRM_VIEW | browser |
| 16 | Pipeline peluang | `/crm`, `/crm/peluang/[id]` | `pipeline-board`, `moveOpportunity*`, PO/invoice dari peluang | CRM_VIEW; operator CRM | browser |
| 17 | Purchase Order | `/crm/purchase-orders` (+ modal detail) | `purchase-order-form`, create/update/agree/deposit/design/confirm/cancel PO | CRM_OPERATOR (+bypass) | browser |
| 18 | Invoice | `/crm/invoices` | create/update/issue/revise/cancel invoice, PDF API | CRM_OPERATOR (+bypass) | browser |
| 19 | Sales Order | `/crm/sales-orders`, `/sales-orders/[id]` | SO list/detail, reverse/cancel, payment terms | CRM_VIEW / operator | browser |
| 20 | Pembayaran / kwitansi | di detail invoice & SO | `pay*`, `edit*`, `void*` payment actions; kwitansi API | CRM / keuangan sesuai aksi | browser |
| 21 | Broadcast follow-up | `/crm/follow-up` | `app/actions/broadcast.ts`, settings redirect → `/settings` | CRM_OPERATOR | browser |
| 22 | WhatsApp kotak masuk | `/whatsapp` | `app/actions/whatsapp.ts`, conversations API | CRM_ROLES + SALES (+bypass) | browser |
| 23 | WhatsApp jobs | `/whatsapp/jobs` | retry/cancel job actions | CRM_ROLES | browser |
| 24 | Template pesan WA | `/master-data/whatsapp/templates` | save/delete/toggle template | CRM_ROLES | browser |
| 25 | Akun & koneksi WA | `/master-data/whatsapp/accounts` | create/pair/enable/disconnect/delete account | CRM_ROLES | browser |
| 26 | Campaign promo | `/campaigns` | `app/actions/campaigns.ts` | CRM_ROLES | browser |
| 27 | Produksi kanban | `/produksi`, `/produksi/[id]` | `app/actions/production.ts`, board API | PRODUCTION_VIEW; aksi ADMIN_PO | browser |
| 28 | Detail desain | `/detail-desain`, `/detail-desain/[workOrderId]` | production design actions; nav khusus DEVELOPER di menu | PRODUCTION_VIEW; menu item Developer | browser |
| 29 | Desain revisi (CRM) | di peluang/PO | `app/actions/design.ts` uploadDesignRevisionAction | DESIGN_UPLOADER / approver | browser |
| 30 | Keuangan pemasukan (Project) | `/keuangan/pemasukan` (`/keuangan` → redirect) | finance HPP actions | FINANCE (+bypass) | browser |
| 31 | Keuangan pengeluaran | `/keuangan/pengeluaran`, `/keuangan/pengeluaran/riwayat` | create/update/delete/restore/reimburse expense | FINANCE (+bypass) | browser |
| 32 | Laporan keuangan | `/keuangan/laporan` | export finance workbook API | FINANCE (+bypass) | browser |
| 33 | Analytics ringkasan | `/analytics` | `app/api/crm/analytics` | ANALYTICS (+bypass) | browser |
| 34 | Analytics kanal akuisisi | `/analytics/lead-sources` | lead-sources analytics API | sama | browser |
| 35 | Log aktivitas | `/log-aktivitas` | audit list page | AUDIT_VIEW (+bypass) | browser |
| 36 | Pengaturan app | `/settings` | follow-up/repeat-order settings actions | OWNER (+bypass) | browser |
| 37 | CMS studio website | `/cms`, `/cms/*` | `app/cms/**`, `cms-products`, editor schema | CMS_ROLES = OWNER (+bypass) | browser |
| 38 | Situs publik | `/`, `/produk/[slug]`, `/portofolio`, `/size-chart`, `/katalog-kain`, `/contact` | `app/page.tsx` dkk, `app/api/public/leads` | publik (tanpa login) | browser |
| 39 | CMS preview | `/cms-preview` | `app/cms-preview/page.tsx` | tergantung auth CMS | browser |
| 40 | Ekspor data | `/api/export/[dataset]`, analysis/finance workbook | `app/api/export/**` | role per endpoint (dari kode) | browser |

### Alias / redirect (bukan fitur terpisah)

| Dari | Ke |
| --- | --- |
| `/landing` | `/` |
| `/crm/pelanggan` | `/customers` |
| `/crm/pelanggan/[id]` | `/customers/[id]` |
| `/keuangan` | `/keuangan/pemasukan` |
| `/crm/follow-up/settings` | `/settings` |

### Aksi tersembunyi yang wajib tercakup di file fitur terkait

- Customer: impor Excel, arsip/pulihkan, reminder order, buka WA, repeat order.
- Peluang: pindah stage (drag), aktivitas komunikasi, hasil follow-up, force reminder.
- PO: draft, setuju, deposit + bukti, rencana penjahit, kirim desain, konfirmasi customer, revisi, batalkan, PDF, unggah lampiran/desain penjahit.
- Invoice: terbitkan, revisi, tenggat bayar, batalkan, PDF, kirim WA.
- SO: bayar term, void/edit transaksi, reverse/cancel SO.
- Produksi: pindah tahap optimistic, hambatan, assign, catatan, reopen, desain produksi kirim/overwrite/reset.
- Pengguna: create/update/toggle aktif, `resetTestingDataAction` (bahaya).
- Absensi: koreksi manual, hari libur, settings.
- CMS: simpan section per halaman, buat/hapus produk, restore versi riwayat.
- Publik: form lead kontak.

Urutan pengerjaan Fase 2 mengikuti nomor di atas (dependency: master → customer → peluang → PO → invoice → SO → produksi/keuangan).
