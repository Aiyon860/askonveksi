# Detail desain

## Tujuan

Daftar Work Order untuk diberi keterangan desain produksi; filter/sort/export; drill-down per `workOrderId`.

## Prasyarat

- Layout `(app)` mengizinkan `PRODUCTION_VIEW_ROLES` (+ bypass Owner/Keuangan/Developer) lewat `page-access.ts`. [DARI-KODE-SAJA]
- **Loader data** memanggil `requireDeveloperActor()` — hanya role `DEVELOPER` (bukan Owner). [DARI-KODE-SAJA] `lib/production/design-detail.ts:98-99`, `session.ts:138-145`
- Nav item “Detail Desain” hanya untuk Developer di sidebar. [DARI-KODE-SAJA] `components/app-nav.tsx` (filter `isDeveloper`)

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/detail-desain` | `app/(app)/detail-desain/page.tsx` |
| `/detail-desain/[workOrderId]` | `app/(app)/detail-desain/[workOrderId]/page.tsx` |
| Data | `lib/production/design-detail.ts` |

## Alur utama

| No | Aksi | Elemen (teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Developer buka `/detail-desain` | Judul `Detail Desain`; deskripsi `Work Order masuk ke kanban Produksi setelah desain diberi keterangan oleh tim Produksi.`; tombol `Export semua revisi`; filter `Semua desain`; teks `392 Work Order tersedia` (saat uji) | Tabel kolom No, Work Order, PO, Sales Order, Customer, Produk, Jalur, Deadline, Status desain, Aksi | [TERVERIFIKASI-BROWSER] `evidence/28-detail-desain-developer.png`; `continue-payment-final.json` |
| 2 | Filter status | Menu `Semua desain` / `Belum dikirim` / `Masuk Produksi` | Filter query `status` | [TERVERIFIKASI-BROWSER] filter `Belum dikirim` → empty: `0 Work Order tersedia`, `Tidak ada Work Order dengan status ini` (`evidence/28-detail-desain-pending.png`) |
| 3 | `Lihat desain` / `Edit desain` | Link aksi baris | `/detail-desain/[id]` | [TERVERIFIKASI-BROWSER] tombol `Lihat desain` di list; drill-down 200 `evidence/28-detail-desain-wo-dev.png` |
| 4 | WO sudah dikirim | Badge `Sudah masuk Produksi`; empty card jika tanpa file | `Tidak ada gambar PNG/JPG desain untuk produk ini.` atau editor read-only + `Unduh hasil` | [TERVERIFIKASI-BROWSER] `evidence/28-detail-desain-wo-form.png`, `continue-gapfill.json` `ddWoForm` |
| 5 | Owner buka `/detail-desain` | Heading error `Halaman tidak dapat dimuat`; `Coba lagi`, `Kembali` | HTTP **500** | [TERVERIFIKASI-BROWSER] `evidence/28-detail-desain-retry.png` |

## Field form / editor (WO belum dikirim + ada attachment)

| Field / kontrol | Tipe | Bukti |
| --- | --- | --- |
| Pencarian `q` | text | placeholder `Cari nomor, customer, atau produk...` [DARI-KODE-SAJA] page.tsx |
| Status filter | `all` / `pending` / `sent` | [TERVERIFIKASI-BROWSER] label UI |
| `Ukuran teks` | number 12–48 | [DARI-KODE-SAJA] `design-annotation-editor.tsx` |
| `Upload Desain` | file `.png,.jpg,.jpeg` | [DARI-KODE-SAJA] tombol + `aria-label` `Pilih file desain pengganti` |
| Anotasi | kanvas + `aria-label` `Keterangan anotasi` | [DARI-KODE-SAJA] |
| `Kirim ke Produksi` | button → dialog `Kirim ke Produksi?` / `Konfirmasi kirim Produksi` | [DARI-KODE-SAJA] — **tidak ada WO `Belum dikirim` ber-attachment di DB lokal** saat audit |
| Mode lihat saja | Alert `Mode lihat saja` | [DARI-KODE-SAJA] page.tsx |

## Skenario gagal

| Skenario | Hasil / pesan | Bukti |
| --- | --- | --- |
| Non-Developer (Owner) load halaman | `AccessDeniedError` dari `requireDeveloperActor` **tidak** di-map ke `forbidden()` → UI `Halaman tidak dapat dimuat` (500) | [TERVERIFIKASI-BROWSER] + [DARI-KODE-SAJA] `design-detail.ts:98-99` vs `requirePageActor` yang memanggil `forbidden()` |
| Empty state | `Belum ada Work Order` / `Work Order tidak ditemukan` | [DARI-KODE-SAJA] page.tsx empty copy |

## Efek samping

- Export dataset `detail-desain` via tombol `Export semua revisi`.

## Temuan / keanehan

1. **Inkonsistensi akses:** `canAccessPath` + menu Developer vs loader `requireDeveloperActor` saja. Owner (yang “bisa akses semua” menurut `hasRole` di layout) tetap **crash 500**, bukan 403. [TERVERIFIKASI-BROWSER] + [DARI-KODE-SAJA]
2. Status badge list: `Masuk Produksi` / `Belum dikirim`. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- Screenshot editor anotasi live butuh seed WO `Belum dikirim` + attachment PNG/JPG. [BELUM-TERVERIFIKASI-BROWSER]
