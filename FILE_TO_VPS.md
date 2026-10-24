# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS

> **Status per 2026-10-23: Fase 1–3 SUDAH DIIMPLEMENTASIKAN dan diverifikasi lokal.**
> `npm run lint` (0 error), `npx tsc --noEmit`, `npm test` (341 lulus), dan `npm run build` sukses.
> Backfill lokal sudah dijalankan: 85 objek / ±27,6 MB dari 4 bucket ada di VPS dan `storage:verify` bersih.
> Fase 4–6 (deploy produksi, grace period, cutover) tetap merupakan langkah operasional VPS yang belum dijalankan dari sesi ini.
> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.4**).
> Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.

---

## 0. Prinsip data: teks di Supabase, biner di VPS

### 0.1 Pembagian yang tegas

| Jenis data | Tempat penyimpanan | Contoh |
|---|---|---|
| Teks & metadata | **Supabase Postgres** (satu-satunya sumber kebenaran) | nama file asli, path relatif, MIME, ukuran byte, anotasi JSON, relasi ke PO/invoice/customer |
| Biner (gambar, PDF) | **Disk VPS** (`ERP_STORAGE_DIR`) | byte PNG desain, PDF bukti bayar, WebP logo, media WhatsApp |

Yang dipindahkan **hanya byte file**. Tidak ada kolom baru, tidak ada perubahan tipe kolom, tidak ada penulisan ulang path di baris mana pun.

### 0.2 Bentuk path yang disimpan (penting)

Database tetap menyimpan **path relatif lama, tanpa prefix bucket dan tanpa prefix `vps/`**:

```text
Kolom DB : design/6f1c.../a1b2....png
Lokasi   : /var/lib/askonveksi/storage/crm-po-designs/design/6f1c.../a1b2....png
           └──────── ERP_STORAGE_DIR ────────┘└── bucket ──┘└──── nilai kolom DB ────┘
```

Nama bucket tidak disimpan di DB karena sudah tersirat oleh tabel/kolom pemiliknya. Contoh ilustrasi `vps/public/desain/desain1.jpg` **tidak** dipakai: menambahkan prefix semacam itu berarti menulis ulang seluruh path lama dan memecahkan kompatibilitas. Yang benar adalah path relatif tetap seperti sekarang; lokasi fisik diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path DB.

### 0.3 Peta kolom → bucket → lokasi fisik

| Data | Kolom DB | Bucket | Contoh path DB | Lokasi fisik |
|---|---|---|---|---|
| Desain revisi PO | `DesignAttachment.path` | `crm-po-designs` | `design/<taskId>/<uuid>.png` | `<root>/crm-po-designs/design/<taskId>/<uuid>.png` |
| Snapshot desain awal produksi | `DesignAttachment.originalPath` | `crm-po-designs` | `production-design-original/<attachmentId>.png` | `<root>/crm-po-designs/production-design-original/<attachmentId>.png` |
| Desain penjahit | `PurchaseOrderItem.penjahitDesignPath` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.png` | `<root>/crm-po-designs/penjahit/<itemId>/<uuid>.png` |
| Lampiran PO lama (legacy, read-only) | `PurchaseOrderAttachment.path` | `crm-po-designs` | path lama apa adanya | `<root>/crm-po-designs/<path lama>` |
| Logo perusahaan (dan snapshot invoice/PO) | `BusinessProfile.logoPath`, `Invoice.snapshotBusinessLogoPath`, `PurchaseOrder.snapshotBusinessLogoPath` | `business-assets` | `business/logo-<uuid>.png` | `<root>/business-assets/business/logo-<uuid>.png` |
| Tanda tangan perusahaan (dan snapshot) | `BusinessProfile.signaturePath`, `Invoice.snapshotSignaturePath` | `business-assets` | `business/signature-<uuid>.webp` | `<root>/business-assets/business/signature-<uuid>.webp` |
| Bukti pengeluaran / transaksi / deposit | `Expense.proofPath`, `PaymentTransaction.proofPath`, `PurchaseOrderDeposit.proofPath` | `payment-proofs` | `<ownerUserId>/<uuid>.pdf` | `<root>/payment-proofs/<ownerUserId>/<uuid>.pdf` |
| Media WhatsApp inbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `<accountId>/<YYYY-MM-DD>/<messageId>` (tanpa ekstensi) | `<root>/whatsapp-media/<accountId>/<YYYY-MM-DD>/<messageId>` |
| Lampiran WhatsApp outbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `<root>/whatsapp-media/outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` |

Catatan: `PurchaseOrderAttachment` sudah tidak punya penulis di kode (hanya route baca R2). Baris lama tetap harus ikut di-backfill, tetapi tidak ada alur upload baru untuk tabel ini.

### 0.4 Ringkasan perubahan revisi 2

1. **Adapter `erpStorage(bucket)`** menggantikan fungsi bebas `erpGet/erpPut/erpRemove/erpExists`. Bentuknya meniru `supabase.storage.from(bucket)`, jadi 19 call site hanya berubah satu baris dan sebagian besar test sumber lama tetap hijau.
2. **Hybrid fail-hard**, bukan best-effort: tulis dianggap sukses hanya jika VPS **dan** Supabase sama-sama berhasil; kalau salah satu gagal, operasi dibatalkan dan salinan yang terlanjur dibuat dibersihkan. Ini yang membuat janji rollback di bagian 10 benar-benar berlaku.
3. **`putFile` atomik yang konsisten**: tulis ke file temp, lalu `rename` untuk `upsert:true` atau `link` untuk `upsert:false`. Flag `wx` dipakai pada file temp, bukan pada file final.
4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset dan absolut. Deploy workflow menolak path di dalam `DEPLOY_PATH`; runtime memberi peringatan bila path berada di dalam folder aplikasi (agar `npm start` lokal tetap bisa).
5. **Worker WhatsApp driver-aware**: guard `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` di tiga titik diganti logika driver, bukan dipertahankan apa adanya.
6. **Runbook migrasi diperbaiki**: `npm ci --omit=dev` tidak dipakai (dotenv dan Prisma CLI ada di devDependencies); migrasi dijalankan sebagai user aplikasi agar file tidak menjadi milik `root`.
7. **Default `.env.example` lokal** (`./data/erp-storage`), nilai produksi hanya di dokumentasi.
8. **Detail implementasi baru**: `statFile`, throttle log fallback, `/* turbopackIgnore: true */`, `import "server-only"`, dan penegasan bahwa path tidak valid **tidak boleh** di-fallback ke Supabase.
9. **Koreksi angka dan daftar test**: 6 file penulis / 9 titik tulis, 21 file diubah, dan hanya 2 assertion test yang perlu diperbarui berkat adapter.

---

## 1. Ringkasan keputusan

**Tujuan:** semua biner ERP (desain PO, desain produksi, desain penjahit, lampiran PO lama, bukti bayar/pengeluaran/deposit, logo & tanda tangan, media WhatsApp) dipindahkan dari Supabase Storage ke disk VPS di `/var/lib/askonveksi/storage`. Supabase Postgres tetap menyimpan seluruh teks dan path relatif.

**Mengapa aman (temuan audit):**

1. Tidak ada satu pun `getPublicUrl`/`createSignedUrl` di codebase. Semua file disajikan lewat route API terautentikasi yang membaca via admin client lalu di-stream. Mengganti sumber byte tidak mengubah URL, header, atau perilaku route.
2. Semua kolom DB berisi path relatif, bukan URL. Struktur path dipertahankan 1:1 di bawah `<ERP_STORAGE_DIR>/<nama-bucket>/`.
3. Pola "file di volume VPS + DB simpan path relatif" sudah terbukti di modul ini: foto absensi (`lib/attendance/photo.ts`) dan CMS (`lib/cms/media.ts`), termasuk validasi anti path-traversal.

**Driver:**

| `ERP_STORAGE_DRIVER` | Tulis | Baca | Pemakaian |
|---|---|---|---|
| `supabase` | Supabase | Supabase | **Default kode** — perilaku lama persis |
| `hybrid` | VPS **dan** Supabase; gagal salah satu = gagal semua | VPS dulu, fallback Supabase bila belum ada di VPS | Masa transisi produksi (±1 bulan) |
| `local` | VPS saja | VPS saja | Setelah grace period |

**Domain `askonveksi.web.id` tidak diperlukan untuk penyimpanan.** Jangan serve folder statis via nginx: desain PO, bukti bayar, dan media WA harus tetap hanya lewat route yang butuh login. Route yang sama tetap dipakai; hanya sumber byte-nya yang berubah.

---

## 2. Peta lengkap saat ini (hasil audit)

### 2.1 Bucket Supabase Storage yang aktif (semua privat)

Disiapkan oleh `scripts/setup-crm-storage.mjs` dan diverifikasi ulang:

| Bucket | Limit bucket | Isi |
|---|---|---|
| `crm-po-designs` | 5 MB, MIME bebas | Desain revisi PO, salinan original produksi, desain penjahit, lampiran PO lama |
| `business-assets` | 2 MB, JPG/PNG/WebP | Logo & tanda tangan perusahaan |
| `payment-proofs` | 5 MB, PDF/JPG/PNG/WebP | Bukti pengeluaran, bukti transaksi bayar, bukti deposit PO |
| `whatsapp-media` | 10 MB, PDF/JPG/PNG/WebP | Media inbound (dari HP customer) & lampiran outbound |

`quotation-acceptance-proofs` sudah retired (dihapus `scripts/reset-crm-storage.mjs`) — tidak ikut migrasi.

### 2.2 Titik tulis — **6 file, 9 titik**

| # | File | Fungsi | Bucket | Path | Semantik |
|---|---|---|---|---|---|
| W1 | `app/actions/design.ts` | `uploadDesignRevisionAction` | `crm-po-designs` | `design/<designTaskId>/<uuid>.(png\|jpg)` | `upload` (upsert:false), batch; `remove` saat rollback DB |
| W2 | `app/actions/production.ts` | `saveProductionDesignAction` | `crm-po-designs` | overwrite `attachment.path` (upsert:true) + snapshot `production-design-original/<attachmentId>.png` | `exists`, `download`, `upload` upsert, `upload` upsert:false, `remove` |
| W3 | `app/actions/production.ts` | `overwriteProductionDesignAction` | `crm-po-designs` | `upload` path baru + snapshot upsert, `remove` path lama & cleanup saat transaksi gagal | idem |
| W4 | `app/actions/production.ts` | `resetProductionDesignAction` | `crm-po-designs` | `download` originalPath → `upload` ke attachment.path (upsert:true) | idem |
| W5 | `app/actions/production.ts` | `sendProductionDesignAction` | `crm-po-designs` | `remove` `originalPath` setelah masuk produksi | idem |
| W6 | `app/actions/crm.ts` (~L1796–1890) | `savePenjahitPlanAction` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.(png\|jpg)` | `upload` upsert:false, `remove` file baru bila transaksi gagal |
| W7 | `app/actions/master-data.ts` (~L978–1028) | `updateBusinessProfileAction` | `business-assets` | `business/logo-<uuid>.<ext>`, `business/signature-<uuid>.<ext>` | `upload`, `remove` saat rollback. **File lama sengaja TIDAK dihapus** (path tersnapshot di invoice terkunci) |
| W8 | `app/actions/whatsapp.ts` (~L186–199) | `sendWhatsAppMessageAction` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `upload`, `remove` bila enqueue gagal |
| W9 | `lib/payment-proof.ts` | `uploadPaymentProof` / `deletePaymentProof` | `payment-proofs` | `<ownerUserId>/<uuid>.(pdf\|jpg\|png\|webp)` | `upload`, `remove`. Dipanggil dari `app/actions/finance.ts` (expense & HPP) dan `app/actions/crm.ts` (transaksi bayar/deposit) |

### 2.3 Titik baca — **13 route**

| # | Route | Bucket | Catatan |
|---|---|---|---|
| R1 | `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | dukung `?original`; content-type di-sniff dari byte |
| R2 | `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | lampiran PO legacy |
| R3 | `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | `crm-po-designs` | thumbnail dialog + PDF |
| R4 | `app/api/crm/purchase-order/[id]/pdf/route.ts` | `business-assets` + `crm-po-designs` | logo + loop desain/penjahit/lampiran untuk PDF |
| R5 | `app/api/crm/invoice/[id]/pdf/route.ts` | `business-assets` | logo + signature (snapshot → fallback profil) |
| R6 | `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `business-assets` | `readImage` logo + signature |
| R7 | `app/api/master-data/business-profile/logo/route.ts` | `business-assets` | memakai `data.type` dari blob |
| R8 | `app/api/master-data/business-profile/signature/route.ts` | `business-assets` | idem |
| R9 | `app/api/public/business-logo/route.ts` | `business-assets` | **satu-satunya route publik**; allowlist regex path dipertahankan |
| R10 | `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `payment-proofs` | |
| R11 | `app/api/crm/payment-transactions/[id]/proof/route.ts` | `payment-proofs` | |
| R12 | `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | `payment-proofs` | |
| R13 | `app/api/whatsapp/media/[id]/route.ts` | `whatsapp-media` | path tanpa ekstensi; content-type dari kolom DB |

### 2.4 Worker WhatsApp — 3 titik di satu file

| # | Lokasi (~baris) | Fungsi | Bucket | Catatan |
|---|---|---|---|---|
| K1 | ~L214 (`storeInbound`) | upload media inbound (maks 5 MB) | `whatsapp-media` | guard saat ini: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` |
| K2 | ~L261 (`processAccountDeletion`) | batch `remove` saat akun WA dihapus (chunk 100) | `whatsapp-media` | guard Supabase yang sama |
| K3 | ~L610 (`performSendJob`) | `download` lampiran outbound sebelum dikirim | `whatsapp-media` | melempar error bila env Supabase tidak ada |

**Batasan deployment:** `deploy.yml` hanya menyalin satu file worker (`cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs`). Jika worker memakai modul bersama, file modul itu **wajib** ikut di Package step + verifikasi tarball, kalau tidak worker crash di produksi (`ERR_MODULE_NOT_FOUND`).

### 2.5 Test yang menyentuh pola storage

Dengan keputusan **adapter** (bagian 3.3B), hanya dua assertion yang perlu diperbarui:

| File | Assertion | Perubahan |
|---|---|---|
| `tests/crm-validation.test.mjs` ~L1071 | `assert.match(designActionSource, /storage\.from\(BUCKET\)/)` | ubah ke `/erpStorage\(BUCKET\)/` |
| `tests/business-profile.test.mjs` ~L67 | `assert.match(signatureRouteSource, /business-assets/)` | ubah ke `/BUSINESS_ASSETS_BUCKET/` (atau assert impor konstanta + `erpStorage`) |

Assertion yang **tetap hijau** dan sudah diverifikasi:

- `tests/crm-validation.test.mjs` ~L1066 (`storageScript` = `scripts/reset-crm-storage.mjs`) — script itu tidak berubah, jadi tidak patah.
- `tests/crm-validation.test.mjs` ~L1072 (`storage.upload(attachment.path`) — variabel lokal tetap diberi nama `storage`.
- `tests/crm-validation.test.mjs` ~L1627 (`PAYMENT_PROOF_BUCKET`) — ekspor di `lib/payment-proof.ts` dipertahankan.
- `tests/production-design-detail.test.mjs` L40–42, L52, L147 — `.exists(originalPath)`, `snapshot.error.status`, `upsert: false`, `.remove([...])`, dan `storage.upload(originalPath, ...)` semuanya dipertahankan oleh adapter.
- `tests/production-view-design-images.test.mjs` L77 — sama.
- `tests/business-profile.test.mjs` assertions block `updateBusinessProfileAction` — path `business/signature-...` dan `removeSignature` tidak berubah.
- `tests/attendance-storage.test.mjs`, `tests/cms-media.test.mjs` — modul lain, di luar cakupan.

---

## 3. Arsitektur target

### 3.1 Layout direktori VPS

```text
/var/lib/askonveksi/storage/            # ERP_STORAGE_DIR (volume persisten, di luar releases/)
├── crm-po-designs/
│   ├── design/<designTaskId>/<uuid>.(png|jpg)
│   ├── production-design-original/<attachmentId>.png
│   ├── penjahit/<itemId>/<uuid>.(png|jpg)
│   └── <path lampiran PO lama bila ada>
├── business-assets/
│   └── business/(logo|signature)-<uuid>.(png|jpg|webp)
├── payment-proofs/
│   └── <ownerUserId>/<uuid>.(pdf|jpg|png|webp)
└── whatsapp-media/
    ├── <accountId>/<YYYY-MM-DD>/<messageId>          # inbound, tanpa ekstensi
    └── outbound/<YYYY-MM-DD>/<uuid>-<namaAman>
```

- Ownership: user yang sama dengan proses PM2 (default `askonveksi`), direktori `0750`, file `0640` (pola `lib/attendance/photo.ts`).
- Lokal/dev: default `./data/erp-storage` (sudah ter-cover `.gitignore` `/data/`).
- Jangan pernah menaruh `ERP_STORAGE_DIR` di dalam folder release (`$DEPLOY_PATH/releases/...`), karena release lama dipangkas otomatis.

### 3.2 Environment

```bash
# .env.example (nilai lokal; produksi diisi di $DEPLOY_PATH/shared/.env)
ERP_STORAGE_DIR=./data/erp-storage
ERP_STORAGE_DRIVER=supabase
```

Produksi:

```bash
ERP_STORAGE_DIR=/var/lib/askonveksi/storage
ERP_STORAGE_DRIVER=hybrid        # lalu local setelah grace period
```

Aturan validasi (dijalankan `lib/storage/local-store.mjs` saat pertama dibutuhkan):

- Nilai driver selain `supabase|hybrid|local` → **throw**, bukan diam-diam jatuh ke default.
- Di lokal/dev, `ERP_STORAGE_DIR` boleh relatif atau kosong; nilainya di-resolve terhadap `process.cwd()` dengan default `./data/erp-storage`.
- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset dan absolut**. Kosong atau relatif → throw. Path di dalam `process.cwd()` → peringatan (bukan throw) agar `npm start` lokal tetap bisa; di VPS tetap gunakan volume di luar release. Deploy workflow menolak path di dalam `DEPLOY_PATH`.
- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada dan tidak divalidasi.

### 3.3 Modul baru

#### A. `lib/storage/local-store.mjs` — inti fs, tanpa dependensi build

Modul mjs polos (tanpa alias `@/`, tanpa TypeScript) agar dipakai app **dan** worker tanpa duplikasi primitif.

```js
// Konfigurasi & validasi
export function storageDriver()                  // "supabase" | "hybrid" | "local" (throw bila invalid)
export function assertStorageReady()             // guard produksi; throw dengan pesan jelas
export function storeRoot()                      // resolve(ERP_STORAGE_DIR || ./data/erp-storage)

// Path
export function resolveSafe(bucket, relativePath) // { absolute, relativePath } | null

// Operasi file
export async function putFile(bucket, relativePath, bytes, { upsert })
export async function getFile(bucket, relativePath)      // Buffer | null
export async function statFile(bucket, relativePath)     // { size: number } | null
export async function removeFiles(bucket, paths)         // { failed: Array<{ path, message }> }
export async function fileExists(bucket, relativePath)   // boolean
export function contentTypeFromPath(relativePath)        // MIME atau application/octet-stream
```

Aturan implementasi wajib:

1. **Validasi bucket**: hanya `^[a-z0-9][a-z0-9-]*$`; tolak bucket yang mengandung `/`, `\`, `..`, atau `\0`.
2. **Validasi path**: tolak `\0`, `\`, path absolut, segmen kosong, `.`, `..`, dan segmen berawalan titik. Setelah `resolve`, pastikan `absolute.startsWith(root + sep)` dan `absolute !== root`. Pola ini mengikuti `resolveAttendancePhotoPath`.
3. **Tulis atomik**:
   - buat folder tujuan `mkdir(..., { recursive: true, mode: 0o750 })`;
   - tulis byte ke `<folder>/.tmp-<uuid>` dengan `{ flag: "wx", mode: 0o640 }`;
   - `upsert:true` → `rename(tmp, final)` (pembaca tidak pernah melihat file setengah jadi);
   - `upsert:false` → `link(tmp, final)` lalu `unlink(tmp)`. `link` gagal `EEXIST` secara atomik bila file final sudah ada — inilah cara yang benar meniru semantik Supabase, bukan `wx` pada file temp;
   - pada error apa pun, hapus `tmp` (abaikan `ENOENT`) lalu lempar error asli.
4. **Baca**: `getFile`/`statFile` mengembalikan `null` untuk path tidak valid atau file tidak ada (tanpa throw). `removeFiles` mengabaikan `ENOENT` dan mengumpulkan kegagalan lain ke `failed`.
5. **`contentTypeFromPath`**: `png` → `image/png`, `jpg/jpeg` → `image/jpeg`, `webp` → `image/webp`, `pdf` → `application/pdf`, selain itu `application/octet-stream`.
6. **Turbopack**: akses fs dinamis dibungkus komentar `/* turbopackIgnore: true */` seperti `lib/attendance/photo.ts`, agar build Next tidak menambah peringatan baru.
7. **Error terstruktur**: sertakan `status` (mis. `409` untuk konflik, `400` untuk path invalid) agar adapter bisa meneruskannya ke call site.

#### B. `lib/storage/erp-storage.ts` — adapter ber-bentuk supabase-js

```ts
import "server-only";

export const PO_DESIGNS_BUCKET = "crm-po-designs";
export const BUSINESS_ASSETS_BUCKET = "business-assets";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";

type StorageError = { message: string; status?: number; statusCode?: string };
type StorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };

export function erpStorage(bucket: string): {
  upload(path: string, bytes: Uint8Array, opts?: { contentType?: string; upsert?: boolean }): Promise<{ data: { path: string } | null; error: StorageError | null }>;
  download(path: string): Promise<{ data: StorageFile | null; error: StorageError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }>;
  exists(path: string): Promise<{ data: boolean; error: StorageError | null }>;
};
```

**Mengapa adapter, bukan fungsi bebas:** call site saat ini memakai `const storage = createAdminClient().storage.from(BUCKET)` lalu `storage.upload(...)`, `storage.download(...)`, `storage.remove(...)`, `storage.exists(...)`. Dengan adapter, satu-satunya perubahan adalah baris konstruksi menjadi `const storage = erpStorage(BUCKET)`. Nama method, argumen, dan bentuk `{ data, error }` tetap, sehingga:

- 19 call site berubah minim (1 baris + hapus import yang tidak terpakai);
- `data` dibuat mirip `Blob` (`arrayBuffer()`, `type`), jadi `await data.arrayBuffer()` di route tetap jalan;
- `snapshot.error.status` di W2 tetap tersedia;
- test sumber yang menyebut `.exists(...)`, `.remove(...)`, `storage.upload(...)` tetap hijau.

**Perilaku per driver:**

- `supabase`: delegasi langsung ke `createAdminClient().storage.from(bucket)`. Perilaku identik dengan kode sekarang (termasuk `data.type`).
- `local`: seluruh operasi lewat `local-store.mjs`. `download` mengembalikan objek mirip Blob dengan `type` dari `contentTypeFromPath(path)`. File tidak ada → `{ data: null, error: { message, status: 404 } }`.
- `hybrid`:
  - **upload**: `putFile` ke VPS dulu. Jika VPS gagal → kembalikan error, **jangan** menulis ke Supabase (mencegah state Supabase-only yang tidak tercermin di disk). Jika VPS sukses, tulis ke Supabase. Jika Supabase gagal → hapus salinan VPS, catat `[erp-storage] hybrid-put-rollback`, lalu kembalikan error. Dengan begitu operasi sukses berarti **keduanya** ada.
  - **download**: coba VPS; jika tidak ada, fallback Supabase dan catat `[erp-storage] fallback-supabase` (di-throttle per bucket+path, mis. sekali per 10 menit, agar log tidak banjir selama backfill).
  - **exists**: cek VPS **atau** Supabase. Ini penting untuk W2: snapshot lama yang baru ada di Supabase tidak boleh dianggap tidak ada.
  - **remove**: hapus di VPS dan Supabase, kumpulkan kegagalan. Bersifat best-effort seperti kode sekarang, tetapi kegagalan dicatat. Risiko "file hidup lagi lewat fallback" hanya mungkin bila sebuah path yang sudah dihapus masih dirujuk DB; alur rollback di kode selalu menghapus file yang belum dirujuk DB, sehingga risiko ini diterima dan dicatat.
  - **path tidak valid**: `resolveSafe` mengembalikan `null` → adapter langsung mengembalikan error `400` **tanpa** meneruskannya ke Supabase. Ini wajib agar validasi traversal tidak bisa dilewati lewat jalur fallback.

**Catatan tipe data:** `download` di mode `supabase` mengembalikan `Blob` asli; di mode `local`/`hybrid` mengembalikan objek mirip Blob. Keduanya mendukung `arrayBuffer()` dan `type`, jadi R7/R8 tidak perlu perubahan isi.

#### C. Worker WhatsApp

`worker/whatsapp.mjs` mengimpor `../lib/storage/local-store.mjs` (relatif terhadap file worker; worker dijalankan dengan `--cwd $CURRENT_LINK`, jadi modul berada di `<release>/lib/storage/local-store.mjs`).

Perubahan tiga titik:

- **K1** `storeInbound`: simpan ke VPS untuk driver `local`/`hybrid`, ke Supabase untuk `supabase`/`hybrid`. Guard lama (`NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY`) diganti logika driver:
  - `supabase` → wajib env Supabase;
  - `hybrid` → wajib env Supabase **dan** `ERP_STORAGE_DIR`;
  - `local` → cukup `ERP_STORAGE_DIR`.
  Cap 5 MB inbound dan penolakan file kosong tetap.
- **K2** `processAccountDeletion`: untuk `local`/`hybrid` hapus lewat `removeFiles`; untuk `supabase`/`hybrid` tetap `remove` chunk 100. Chunking berlaku untuk jalur Supabase.
- **K3** `performSendJob`: baca lampiran lewat VPS dulu (local/hybrid), fallback Supabase (hybrid), atau langsung Supabase (supabase). Error yang dilempar tetap jelas (`Lampiran ... tidak dapat dibaca`).

Logika driver di worker (±40 baris) sengaja ditulis inline di `whatsapp.mjs`; **primitif** fs, validasi path, dan konfigurasi tetap diimpor dari `local-store.mjs`. Ini menghindari dua implementasi validasi path yang bisa berbeda.

**Deploy:** `lib/storage/local-store.mjs` harus ikut disalin ke `deploy_package/lib/storage/`. `scripts/collect-worker-deps.mjs` hanya menyalin isi `node_modules`, jadi file repo ini tidak otomatis ikut.

### 3.4 Deploy workflow (`.github/workflows/deploy.yml`)

Tambahan di Package step:

```bash
mkdir -p deploy_package/lib/storage
cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
```

Tambahan di verifikasi tarball:

```bash
tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs' \
  || { echo 'local-store.mjs missing'; exit 1; }
```

Tidak ada perubahan urutan job (build → migrate → deploy); langkah Prisma tidak disentuh.

---

## 4. Invarian keamanan (checklist review)

- [ ] Semua route tetap memakai `requireActor(...)`; tidak ada route publik baru selain R9 (allowlist regex dipertahankan).
- [ ] `resolveSafe` menolak `..`, path absolut, `\0`, `\`, segmen tersembunyi, dan bucket tidak valid; diuji dengan test khusus.
- [ ] Path tidak valid pada driver `hybrid` **tidak** di-fallback ke Supabase.
- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset dan absolut; path di dalam folder aplikasi diberi peringatan; driver invalid → throw.
- [ ] Header respons tidak berubah: `Cache-Control` (`private, no-store` atau `public, immutable` khusus R9), `X-Content-Type-Options: nosniff`, `Content-Disposition` inline/attachment.
- [ ] Validasi upload di call site tidak berubah (magic bytes `lib/design/image.ts` & `lib/payment-proof.ts`, limit 5/10/2 MB, nama file disanitasi, path dari UUID).
- [ ] Semantik "file lama logo/signature tidak dihapus" (W7) tetap.
- [ ] Cleanup saat transaksi DB gagal tetap berfungsi di hybrid: hapus di **kedua** lokasi.
- [ ] `erp-storage.ts` memakai `import "server-only"`; tidak ada byte yang melewati client bundle.
- [ ] Role & gerbang akses tidak tersentuh; DEVELOPER tetap bisa mengakses semua fitur.

---

## 5. Daftar file

### 5.1 File baru (7)

| File | Isi |
|---|---|
| `lib/storage/local-store.mjs` | fs + validasi path + konfigurasi driver (3.3A) |
| `lib/storage/erp-storage.ts` | adapter `erpStorage(bucket)` + konstanta bucket (3.3B) |
| `scripts/migrate-storage-to-vps.mjs` | backfill Supabase → VPS (bagian 7) |
| `scripts/backup-erp-storage.sh` | cron backup harian + rotasi (bagian 8) |
| `tests/erp-storage.test.mjs` | unit test modul (bagian 6, Fase 1) |
| `docs/PANDUAN_STORAGE_ERP.md` | runbook operasional: env, driver, migrasi, backup/restore, decommission |
| `FILE_TO_VPS.md` | dokumen ini |

### 5.2 File yang diubah (21)

| File | Perubahan ringkas |
|---|---|
| `app/actions/design.ts` | `createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)` (W1) |
| `app/actions/production.ts` | 4 aksi → `erpStorage(DESIGN_BUCKET)` (W2–W5) |
| `app/actions/crm.ts` | penjahit → `erpStorage(PO_DESIGNS_BUCKET)` (W6) |
| `app/actions/master-data.ts` | logo/signature → `erpStorage(BUSINESS_ASSETS_BUCKET)` (W7) |
| `app/actions/whatsapp.ts` | lampiran outbound → `erpStorage(WHATSAPP_MEDIA_BUCKET)` (W8) |
| `lib/payment-proof.ts` | inti upload/delete → `erpStorage(PAYMENT_PROOF_BUCKET)`; **ekspor `PAYMENT_PROOF_BUCKET` dipertahankan** |
| `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | `erpStorage` (R1) |
| `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | idem (R2) |
| `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | idem (R3) |
| `app/api/crm/purchase-order/[id]/pdf/route.ts` | `erpStorage` untuk logo + aset desain (R4) |
| `app/api/crm/invoice/[id]/pdf/route.ts` | logo + signature (R5) |
| `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `readImage` → `erpStorage` (R6) |
| `app/api/master-data/business-profile/logo/route.ts` | `erpStorage`; `data.type` tetap tersedia dari adapter (R7) |
| `app/api/master-data/business-profile/signature/route.ts` | idem (R8) |
| `app/api/public/business-logo/route.ts` | `erpStorage`; allowlist regex dipertahankan (R9) |
| `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `erpStorage` (R10) |
| `app/api/crm/payment-transactions/[id]/proof/route.ts` | idem (R11) |
| `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | idem (R12) |
| `app/api/whatsapp/media/[id]/route.ts` | idem (R13) |
| `worker/whatsapp.mjs` | K1–K3 driver-aware + impor `local-store.mjs` |
| `.github/workflows/deploy.yml` | Package step + verifikasi tarball (3.4) |

### 5.3 File yang disentuh ringan

| File | Perubahan |
|---|---|
| `.env.example` | `ERP_STORAGE_DIR=./data/erp-storage`, `ERP_STORAGE_DRIVER=supabase` + komentar produksi |
| `README.md` | satu paragraf: biner ERP di VPS, teks & path di Supabase; rujuk `docs/PANDUAN_STORAGE_ERP.md` |
| `tests/crm-validation.test.mjs` | 1 assertion (`erpStorage(BUCKET)`) |
| `tests/business-profile.test.mjs` | 1 assertion (`BUSINESS_ASSETS_BUCKET`) |
| `package.json` | script `storage:migrate`, `storage:verify`, `storage:backup` |
| `docs/PANDUAN_ABSENSI.md` | tidak berubah; hanya menjadi rujukan pola |

### 5.4 Sengaja TIDAK diubah

- `prisma/schema.prisma` + semua migrasi — path DB identik.
- `scripts/setup-crm-storage.mjs`, `scripts/reset-crm-storage.mjs` — tetap ada selama transisi; dinonaktifkan di Fase 6.
- Modul CMS (`lib/cms/*`) dan absensi (`lib/attendance/*`).
- Kode Supabase Postgres (`lib/prisma.ts`, `lib/supabase/*`).
- API publik/signed URL — tidak pernah ada dan tidak akan ditambahkan.

---

## 6. Fase implementasi

### Fase 0 — Persiapan ops (VPS, sebelum kode)

- [ ] T0.1 `df -h /var/lib`: sisa ≥ 2× total bucket saat ini + 5 GB headroom.
- [ ] T0.2 Catat jumlah objek & byte per bucket (dashboard Supabase atau `--dry-run` setelah Fase 1).
- [ ] T0.3 `sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage` (konfirmasi user PM2).
- [ ] T0.4 Tambahkan ke `$DEPLOY_PATH/shared/.env`:
  - `ERP_STORAGE_DIR=/var/lib/askonveksi/storage`
  - `ERP_STORAGE_DRIVER=hybrid`
- [ ] T0.5 Siapkan `/var/backups/askonveksi`; pastikan nama file backup absensi tidak bentrok.

**Gate:** user aplikasi bisa `touch` di folder; env terpasang; kapasitas cukup.

### Fase 1 — Modul storage + unit test (belum menyentuh call site)

- [ ] T1.1 `lib/storage/local-store.mjs` sesuai 3.3A (atomik, `link`, validasi bucket+path, guard driver, `statFile`, `contentTypeFromPath`).
- [ ] T1.2 `lib/storage/erp-storage.ts` sesuai 3.3B (`import "server-only"`, adapter, 3 driver, fail-hard hybrid, throttle log, path invalid tidak fallback).
- [ ] T1.3 `tests/erp-storage.test.mjs` (pola `tests/attendance-storage.test.mjs`, set env sebelum dynamic import):
  - roundtrip put → get untuk png/jpg/pdf/webp dan path tanpa ekstensi;
  - `upsert:false` menolak file yang sudah ada; `upsert:true` menimpa dan pembaca hanya melihat isi baru;
  - traversal: `../x`, `..`, `/abs`, `a\0b`, `a\b`, `.hidden/x`, bucket `../evil`;
  - `removeFiles` tidak melempar untuk path hilang; `statFile`/`fileExists` akurat;
  - `contentTypeFromPath` benar + fallback octet-stream;
  - guard: driver invalid throw; driver non-supabase dengan `ERP_STORAGE_DIR` relatif throw;
  - adapter driver `local`: upload/download/remove/exists (tanpa jaringan).
- [ ] T1.4 Perbarui hanya dua assertion di 2.5, lalu jalankan `npm run lint && npx tsc --noEmit && npm test`.
- [ ] T1.5 `npm run build` sukses (modul belum dipakai produksi).

**Gate:** semua command hijau; diff hanya menambah file + dua assertion test.

### Fase 2 — Port 19 call site app, driver masih `supabase`

Urutan (mudah → sulit):

1. [ ] T2.1 `lib/payment-proof.ts` (W9) + test bukti bayar.
2. [ ] T2.2 R10, R11, R12.
3. [ ] T2.3 `app/actions/master-data.ts` (W7) + R7, R8, R9.
4. [ ] T2.4 R5, R6, R4 (tiga PDF ini dipakai worker via HTTP — uji khusus).
5. [ ] T2.5 `app/actions/design.ts` (W1) + R1.
6. [ ] T2.6 `app/actions/production.ts` (W2–W5) — pertahankan urutan `exists → download → upload upsert → remove`.
7. [ ] T2.7 `app/actions/crm.ts` penjahit (W6) + R3; R2.
8. [ ] T2.8 `app/actions/whatsapp.ts` (W8) + R13.
9. [ ] T2.9 Hapus import `createAdminClient` yang tidak terpakai, satu per satu (beberapa file masih memakainya untuk hal lain).

Per porting: pesan `UserFacingError`, `console.error`, dan header respons harus identik.

- [ ] T2.10 `npm run lint && npx tsc --noEmit && npm test && npm run build`.

**Gate:** tanpa env driver (default `supabase`), perilaku aplikasi sama persis; UAT spot-check lulus.

### Fase 3 — Worker + deploy workflow

- [ ] T3.1 Port K1–K3 (driver-aware; cap 5 MB; chunk 100 untuk Supabase; `removeFiles` untuk VPS).
- [ ] T3.2 `deploy.yml`: salin `local-store.mjs` + verifikasi tarball.
- [ ] T3.3 `node --check worker/whatsapp.mjs`; `node scripts/collect-worker-deps.mjs /tmp/deploy-check` exit 0.
- [ ] T3.4 Uji lokal: `npm run whatsapp:worker:dev`, kirim/terima pesan berlampiran, hapus akun uji → file VPS terhapus.
- [ ] T3.5 `npm run lint && npx tsc --noEmit && npm test && npm run build`.

**Gate:** simulasi layout release (`/tmp/rel/{worker,lib/storage}`) + env temp → tidak ada `ERR_MODULE_NOT_FOUND`; mode `local` tidak membutuhkan env Supabase.

### Fase 4 — Deploy transisi (`hybrid`)

- [ ] T4.1 Merge Fase 1–3 ke `production`.
- [ ] T4.2 Pastikan `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` sudah ada **sebelum** restart.
- [ ] T4.3 Smoke test produksi (OWNER/DEVELOPER): PDF invoice & PO, desain PO & penjahit, bukti pengeluaran, kirim WA berfoto.
- [ ] T4.4 Amati log PM2 24 jam: `[erp-storage] fallback-supabase` wajar untuk file lama; `hybrid-put-rollback`/error tulis VPS harus nol.

**Gate:** upload baru ada di VPS (`find $ERP_STORAGE_DIR -newer /tmp/marker -type f`) **dan** di Supabase.

### Fase 5 — Backfill + verifikasi

- [ ] T5.1 Jalankan `node scripts/migrate-storage-to-vps.mjs` (idempoten).
- [ ] T5.2 `--verify`: jumlah objek per bucket, ukuran per file, daftar hilang kosong.
- [ ] T5.3 Checksum sampel ≥ 20 file (termasuk 5 terlama & 5 terbaru): SHA-256 lokal == blob Supabase.
- [ ] T5.4 UAT penuh bagian 12 dengan `hybrid`.
- [ ] T5.5 Pasang cron backup + uji restore sekali.

**Gate:** `--verify` bersih, UAT bersih, backup & restore teruji.

### Fase 6 — Final cutover + pemangkasan (setelah grace period)

Kriteria masuk: tidak ada `fallback-supabase` selama 14 hari, backup rutin sukses, tidak ada insiden.

- [ ] T6.1 `ERP_STORAGE_DRIVER=local`, restart PM2 app + worker.
- [ ] T6.2 Spot-check bagian 12 dengan `local`.
- [ ] T6.3 Simpan bucket Supabase **kosong** sebagai cold copy selama 1 bulan pertama `local`; hapus setelah stabil (atau via dashboard).
- [ ] T6.4 Rapikan `erp-storage.ts` (jalur Supabase boleh dibiarkan sebagai kode mati; hapus hanya bila yakin), perbarui `docs/PANDUAN_STORAGE_ERP.md` + `README.md`.
- [ ] T6.5 Catat penghematan & tanggal di `TRACKING_REVISI.md`.

---

## 7. Runbook migrasi data (Fase 5)

`scripts/migrate-storage-to-vps.mjs` (Node mjs; memakai `@supabase/supabase-js` + `dotenv` yang sudah ada, serta `local-store.mjs` untuk validasi/tulis):

1. Baca env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ERP_STORAGE_DIR`.
2. Untuk tiap bucket `["crm-po-designs","business-assets","payment-proofs","whatsapp-media"]`:
   - walk rekursif `storage.list(prefix, { limit: 100, offset })`; elemen tanpa `id` = folder → antri;
   - tiap objek: `storage.download(name)` → `putFile(bucket, name, bytes, { upsert: true })` setelah validasi path;
   - **skip** bila `statFile` menunjukkan ukuran sama dengan `metadata.size` (idempoten/resume);
   - verifikasi ukuran tertulis == `metadata.size`; catat kegagalan.
3. `--dry-run`: listing + estimasi jumlah/bytes.
4. `--verify`: tanpa menulis; bandingkan jumlah objek & ukuran; exit non-zero bila ada selisih.
5. Ringkasan akhir per bucket: `objects, bytes, skipped, written, failed`.

**Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses aplikasi (mode `0640`):

```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  rm -rf /tmp/askonveksi-migrate
  git clone <repo> /tmp/askonveksi-migrate
  cd /tmp/askonveksi-migrate
  npm ci                                  # penuh: dotenv + Prisma CLI ada di devDependencies
  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```

Catatan:

- `npm ci --omit=dev` **jangan** dipakai: `dotenv` (diimpor script) dan `prisma` (dipanggil `postinstall`) ada di devDependencies.
- Bila terpaksa menjalankan sebagai root, wajib `chown -R askonveksi:askonveksi /var/lib/askonveksi/storage` dan `chmod 0640` untuk file sebelum aplikasi di-restart.
- Backfill boleh kapan pun setelah Fase 4; fallback hybrid menutup celah file yang lahir sebelum backfill selesai.

---

## 8. Backup & restore

### 8.1 Backup harian

`scripts/backup-erp-storage.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}"
DEST="${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"
tar -C "$(dirname "$SRC")" -czf "$DEST/erp-storage-$STAMP.tar.gz" "$(basename "$SRC")"
ls -1t "$DEST"/erp-storage-*.tar.gz | tail -n +15 | xargs -r rm -f
```

Cron user aplikasi: `15 2 * * * /path/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1`

### 8.2 Offsite (diaktifkan)

Rekomendasi revisi 2: aktifkan sejak Fase 5, karena setelah `local` file hanya ada di satu disk.

```bash
0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
```

Butuh konfigurasi rclone di VPS (B2/S3/Drive). Bila belum tersedia, minimal simpan salinan tar di mesin lain secara manual setiap minggu.

### 8.3 Restore (uji sekali di Fase 5)

```bash
pm2 stop <pm2-app> <pm2-wa>
tar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz
sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage
pm2 start <pm2-app> <pm2-wa>
node scripts/migrate-storage-to-vps.mjs --verify   # selama grace period
```

Proyek memakai PM2, bukan systemd; jangan memakai `systemctl` untuk proses aplikasi.

### 8.4 Pasangan backup DB ↔ file

Restore DB (Supabase) dan restore file (tar VPS) harus dari waktu yang berdekatan. Path di DB menunjuk ke file: file hilang = route 404 (bukan crash). Catat prosedur ini di `docs/PANDUAN_STORAGE_ERP.md`.

---

## 9. Monitoring & kapasitas

- [ ] `[erp-storage] fallback-supabase` (di-throttle) = indikator backfill belum tuntas; hilang setelah `local`.
- [ ] `[erp-storage] hybrid-put-rollback` atau error tulis VPS = **alert**, bukan info.
- [ ] Cron mingguan: `df -P "$ERP_STORAGE_DIR" | tail -1`; alert bila Use% ≥ 80%.
- [ ] Ukur ulang bulanan: total byte folder vs baseline T0.2.
- [ ] Pastikan perubahan `deploy.yml` tidak mengubah urutan job Prisma.

---

## 10. Rollback plan

| Situasi | Tindakan |
|---|---|
| Bug saat Fase 2 (driver `supabase`) | Revert merge / redeploy release sebelumnya. Nol dampak data. |
| Bug saat Fase 4–5 (hybrid) | Set `ERP_STORAGE_DRIVER=supabase` + `pm2 restart` kedua proses. Aman karena hybrid fail-hard menjamin setiap upload sukses ada di Supabase. |
| Redeploy release lama saat hybrid | Aman — release lama membaca Supabase yang selalu ikut ditulis. |
| Masalah setelah Fase 6 (`local`) | Kembalikan ke `hybrid` (bukan `supabase`) lalu investigasi; sinkronkan local→Supabase dulu bila terpaksa kembali ke `supabase`. |

---

## 11. Risiko & mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| 1 | Disk VPS gagal / folder salah di dalam `releases/` | Gambar hilang | Path absolut di luar release + guard produksi + backup harian/offsite + `--verify` periodik |
| 2 | Worker crash karena modul tidak ikut tar | Media WA berhenti tersimpan | Salin `local-store.mjs` + verifikasi tar + simulasi layout release |
| 3 | Path traversal lewat kolom DB compromised | Kebocoran file | Validasi bucket+path + test traversal + path invalid tidak fallback |
| 4 | Torn read saat overwrite desain | PDF/gambar rusak | Tulis atomik temp → `rename` |
| 5 | Lupa satu dari 19 call site | Fitur 404/error | Checklist 5.2 + UAT per fitur |
| 6 | Test lama patah dan dilewatkan | Regresi | Adapter menjaga bentuk method; hanya 2 assertion diubah; `npm test` wajib hijau |
| 7 | Hybrid lupa dimatikan | Supabase dobel | Gate Fase 6 + log fallback |
| 8 | Backup tak pernah diuji | Panic saat insiden | T5.5 wajib restore |
| 9 | Kapasitas disk kurang | Upload gagal | Gate T0.1 + alert 80% |
| 10 | Snapshot logo/signature lama menunjuk file yang terhapus | Kop invoice lama rusak | Kebijakan "file lama tidak dihapus" + backfill semua objek |
| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif → throw; path di dalam cwd → warning; deploy menolak path di dalam DEPLOY_PATH |
| 12 | Migrasi dijalankan sebagai root | File `root:root 0640`, aplikasi 404 | Runbook `sudo -u askonveksi` + verifikasi ownership |
| 13 | Tulis Supabase gagal di hybrid | Rollback ke `supabase` kehilangan file baru | Fail-hard + cleanup VPS + log alert |
| 14 | Log fallback membanjir selama backfill | Log PM2 penuh | Throttle per bucket+path |
| 15 | Worker masih memakai guard Supabase | Media tidak tersimpan di `local` | Guard driver-aware + uji T3.4 |
| 16 | `npm ci --omit=dev` di runbook lama | Migrasi gagal start | Runbook diperbaiki (bagian 7) |

---

## 12. UAT checklist (Fase 4/5/6, login OWNER/DEVELOPER)

| Fitur | Langkah uji | Bukti sukses |
|---|---|---|
| Upload desain revisi PO | PO DRAFT + deposit lunas → upload 2 PNG → simpan | baris `DesignAttachment` baru; file di `.../crm-po-designs/design/...`; tampil inline |
| Rollback upload desain | Paksa gagal transaksi (mis. versi > 4) | file hasil upload terhapus di VPS & Supabase |
| Anotasi & versi produksi | Simpan Versi → Reset → Ganti Desain → Masukkan ke Produksi | snapshot `production-design-original` ada saat anotasi; hilang setelah produksi; PDF benar |
| Desain penjahit | Dialog Edit PDF Penjahit: upload, ganti, hapus | path `penjahit/<itemId>/...`; thumbnail & PDF benar |
| Bukti pengeluaran & HPP | Tambah pengeluaran QRIS + PDF; ubah; buka | inline/download benar |
| Bukti transaksi & deposit | Bayar DP dengan JPG; buka "Lihat Deposit" | tampil |
| Logo & tanda tangan | Ganti logo/signature, centang hapus signature | preview, PDF invoice/PO, kwitansi, `/api/public/business-logo?v=` baru |
| Lampiran WA outbound | Kirim gambar & PDF | terkirim; tampil di inbox; file di `whatsapp-media/outbound/...` |
| Media WA inbound | Kirim foto & PDF dari HP | tersimpan (cap 5 MB), tampil |
| Kirim invoice via WA | Aksi "Kirim Invoice" | worker ambil PDF via HTTP; tidak ada error |
| Hapus akun WA | Hapus akun percobaan | media VPS terhapus |
| Route publik | Buka landing tanpa login | logo tampil (R9) |

---

## 13. Di luar cakupan (sengaja)

- CMS (`CMS_UPLOAD_DIR`) dan absensi (`ATTENDANCE_UPLOAD_DIR`) — sudah di VPS.
- Supabase Postgres & Auth — tidak disentuh.
- Serve file statis via nginx/domain — **tidak dilakukan**.
- Skema path baru / kompresi / thumbnail — tidak diminta; path lama 1:1.

---

## 14. Keputusan

### 14.1 Sudah dipilih (revisi 2)

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Bentuk API | **Adapter `erpStorage(bucket)`** meniru supabase-js |
| 2 | Kebijakan hybrid saat tulis gagal | **Fail-hard** (VPS + Supabase harus sama-sama sukses) |
| 3 | Worker | **Impor `local-store.mjs`** yang ikut disalin ke release; logika driver 3 cabang inline di worker |
| 4 | Grace period | **1 bulan** `hybrid` (minimal 14 hari tanpa fallback + backup/restore teruji) |
| 5 | Backup offsite | **Diaktifkan** sejak Fase 5 |
| 6 | Bucket Supabase di Fase 6 | **Disimpan kosong** 1 bulan sebagai cold copy, lalu hapus |
| 7 | Default `.env.example` | `./data/erp-storage` + `supabase`; nilai produksi di dokumentasi |
| 8 | Migrasi | Dijalankan sebagai user aplikasi; `npm ci` penuh; script memakai `putFile` |

### 14.2 Konfirmasi ops yang masih diperlukan

1. Nama user/group PM2 di VPS (default `askonveksi` — konfirmasi saat Fase 0).
2. Ketersediaan `rclone` + remote tujuan untuk backup offsite.
3. Lokasi clone sementara yang diizinkan di VPS (`/tmp` dipakai di runbook).

---

*Dokumen ini rancangan. Implementasi dimulai dari Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 tanpa melompati gate. Tidak ada kode yang diubah sampai revisi ini disetujui.*
