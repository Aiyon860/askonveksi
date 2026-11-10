# Switch brand

## Tujuan

Mengganti konteks brand aktif (ASKONVEKSI ↔ SAGA) agar data, tema, dan dokumen mengikuti brand yang dipilih.

## Prasyarat

- Sesi aktif role `OWNER`, `KEUANGAN`, atau `DEVELOPER`. [DARI-KODE-SAJA] `lib/brand/config.ts:19-23`
- Sakelar hanya dirender jika `actor.canSwitchBrand`. [DARI-KODE-SAJA] `components/app-shell.tsx:52`

## Route & file kode terkait

| Lokasi | File |
| --- | --- |
| Chrome sidebar/mobile | `components/brand-switcher.tsx` |
| Server action | `app/actions/brand.ts` |
| Cookie & tema | `lib/brand/cookie.ts`, `lib/brand/config.ts` |

## Alur utama

| No | Aksi user | Elemen (label/teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/dashboard` (atau halaman app lain) | `Brand aktif`; nama `Askonveksi`; `Geser untuk pindah ke SAGA.` | Sakelar brand tampil | [TERVERIFIKASI-BROWSER] manifest `/dashboard` `bodyStart`; `evidence/crawl-owner-dashboard.png` |
| 2 | Geser Switch | `Berpindah brand...` (pending) | `switchBrandAction` set cookie + revalidate | [DARI-KODE-SAJA] `brand.ts:19-30` |
| 3 | Selesai | Label brand & petunjuk geser berubah | `html[data-brand=saga]`; teks `BRAND AKTIF SAGA` / `Geser untuk pindah ke Askonveksi.` | [TERVERIFIKASI-BROWSER] `evidence/02-brand-saga.png`, `continue-gapfill.json` `brand`; refresh [DARI-KODE-SAJA] `brand-switcher.tsx:46-47` |

## Field form

| Field | Tipe | Wajib? | Aturan validasi | Contoh | Bukti |
| --- | --- | --- | --- | --- | --- |
| Sakelar brand | Switch | — | `on` → SAGA, `off` → ASKONVEKSI | — | [DARI-KODE-SAJA] `brand-switcher.tsx:34-36` |

## Skenario gagal

| Skenario | Pesan persis | Bukti |
| --- | --- | --- |
| Sesi habis | `Sesi Anda sudah berakhir. Silakan masuk lagi.` | [DARI-KODE-SAJA] `brand.ts:21` |
| Tanpa hak switch | `Akun Anda tidak memiliki akses untuk berpindah brand.` | [DARI-KODE-SAJA] `brand.ts:22` |
| Brand tidak dikenal | `Brand tidak dikenal.` | [DARI-KODE-SAJA] `brand.ts:23` |

## Efek samping

- Cookie `askonveksi_brand` ditandatangani dan diikat `authUserId`.
- Layout penuh di-revalidate (`revalidatePath("/", "layout")`).

## Temuan / keanehan

- Crawl Owner di ASKONVEKSI; petunjuk menunjuk ke SAGA. [TERVERIFIKASI-BROWSER]
- `DEVELOPER`/`OWNER`/`KEUANGAN` juga bypass gate halaman via `hasRole` terpisah dari fitur ini.

## Pertanyaan terbuka

- —
