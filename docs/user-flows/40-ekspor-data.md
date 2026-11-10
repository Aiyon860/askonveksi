# Ekspor data

## Tujuan

Mengunduh dataset Excel dari banyak halaman lewat tombol `Export Excel` (API JSON paging + penyusunan XLSX di browser).

## Prasyarat

- Sesi aktif dengan hak dataset.
- Owner: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `GET /api/export/[dataset]` | `app/api/export/[dataset]/route.ts` |
| Workbook keuangan/analisis | `app/api/export/finance-workbook`, `analysis-workbook` |
| UI | `components/export/export-button.tsx` |
| Registry | `lib/export/registry.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Di `/customers` klik `Export Excel` | Tombol | Memicu client export (toast loading di kode: `Sedang mengexport Excel…`) | [TERVERIFIKASI-BROWSER] tombol; toast live headless flaky — teks dari kode [DARI-KODE-SAJA] `export-button.tsx` |
| 2 | API chunk authenticated | `GET /api/export/customer?limit=5` | HTTP 200, `application/json`, keys `dataset,title,sheetName,subject,columns,rows,total,nextOffset,meta`; contoh `title: Customer`, 5 rows | [TERVERIFIKASI-BROWSER] `continue-findings-3.json` `export-api` |
| 3 | File `.xlsx` | Worker client | Blob `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (contoh customer ~51 820 byte) | [TERVERIFIKASI-BROWSER] `evidence/continue-40-xlsx.json`, `40-export-xlsx-attempt.png` |

## Field form

Tidak ada; filter mengikuti query halaman sumber. [DARI-KODE-SAJA]

## Dataset ID (registry)

`pengeluaran`, `project`, `laporan`, `invoice`, `mutasi-pembayaran`, `pengeluaran-terhapus`, `rincian-hpp`, `absensi`, `customer`, `peluang`, `follow-up`, `komunikasi`, `purchase-order`, `sales-order`, `produksi`, `detail-desain`, `master-jenis-customer`, `master-sumber-lead`, `master-kategori-produk`, `master-ukuran-pakaian`, `master-metode-pembayaran` — [DARI-KODE-SAJA] `registry.ts`

## Skenario gagal

| Skenario | Pesan | HTTP | Bukti |
| --- | --- | --- | --- |
| Tanpa sesi | `Sesi tidak valid.` | 401 | [DARI-KODE-SAJA] |
| Dataset tidak dikenal | `Dataset export tidak dikenal.` | 404 | [DARI-KODE-SAJA] |
| Tanpa hak | `Anda tidak berhak mengekspor data ini.` | 403 | [DARI-KODE-SAJA] |
| Kosong | Toast `Tidak ada data untuk diexport` | — | [DARI-KODE-SAJA] `export-button.tsx:56-63` |
| Batal | `Export dibatalkan` | — | [DARI-KODE-SAJA] |

## Efek samping

- Beban query DB; tidak menyimpan file di server.

## Temuan / keanehan

- Response API adalah **JSON** (bukan file Excel langsung); Excel dirakit di client. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- —

## Nama file unduhan

Pola `downloadFilename(subject, "xlsx")` → `{slug-subject}-DD-MM-YYYY.xlsx` (timezone Asia/Jakarta). Dataset customer `subject: "customer"` → contoh `customer-10-11-2026.xlsx`. [DARI-KODE-SAJA] `lib/download-filename.ts`, `lib/export/registry.ts` — event `download` Playwright di sesi ini tidak selalu terpicu (blob anchor).
