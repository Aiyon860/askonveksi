# file to vps

**Session ID:** ses_e998d2b9cffe1QaD2iYyn2TY35
**Created:** 10/23/2026, 8:49:23 AM
**Updated:** 10/23/2026, 9:45:24 PM

---

## User

baca dan pahami file @FILE_TO_VPS.md dengan detail dan rinci

---

## Assistant

_Thinking:_

The user asks me to read and understand FILE_TO_VPS.md in detail. I'm in plan mode. I should read the file and also validate claims against the codebase. Let me do a thorough review and report understanding, plus discrepancies found. Let me read the file and check the key claims.

Let me start by reading the document and exploring the codebase in parallel.

**Tool: read**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Read file /home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md, lines 1-496
1: # FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS
2: 
3: > **Status: RANCANGAN SAJA — belum diimplementasikan.**
4: > Implementasi baru dimulai setelah seluruh butir di bagian **14. Keputusan yang perlu dikonfirmasi** disepakati.
5: > Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.
6: 
7: ---
8: 
9: ## 1. Ringkasan keputusan
10: 
11: **Tujuan:** Semua file/biner ERP (desain PO, desain produksi, desain penjahit, bukti bayar, bukti pengeluaran, logo & tanda tangan perusahaan, media WhatsApp) dipindahkan dari Supabase Storage ke **disk VPS** di `/var/lib/askonveksi/storage`. Supabase Postgres tetap menjadi satu-satunya sumber data; database **tetap menyimpan path relatif yang sama** — tidak ada perubahan schema, tidak ada migrasi database, tidak ada perubahan path di baris mana pun.
12: 
13: **Mengapa ini aman (temuan dari audit kode):**
14: 
15: 1. Tidak ada satu pun `getPublicUrl`/`createSignedUrl` di codebase. Semua file disajikan lewat **route API terautentikasi** (`requireActor`) yang mendownload via admin client lalu di-stream. Menukar sumber baca dari Supabase ke disk tidak mengubah satupun URL, header, atau perilaku route.
16: 2. Semua kolom DB berisi path relatif (`design/<taskId>/<uuid>.png`, `<owner>/<uuid>.pdf`, dst.), bukan URL. Struktur path dipertahankan 1:1 di bawah `<ERP_STORAGE_DIR>/<nama-bucket>/`.
17: 3. Pola "file di volume VPS + DB simpan path relatif" sudah terbukti jalan di modul ini: foto absensi (`lib/attendance/photo.ts`) dan CMS (`lib/cms/media.ts`) — termasuk pola validasi anti path-traversal yang akan dipakai ulang.
18: 
19: **Strategi aman: 3 mode driver + masa transisi hybrid.**
20: 
21: | Mode `ERP_STORAGE_DRIVER` | Tulis | Baca | Periode pemakaian |
22: |---|---|---|---|
23: | `supabase` | Supabase | Supabase | **Default kode** = perilaku lama persis (zero-risk default; lokal/dev yang tidak set env tetap seperti sekarang) |
24: | `hybrid` | Supabase **dan** VPS (dual-write) | VPS dulu, **fallback Supabase** bila file belum ada di VPS | Fase transisi di VPS produksi (±1–2 bulan) |
25: | `local` | VPS saja | VPS saja | Setelah grace period; Supabase Storage tidak lagi disentuh |
26: 
27: Dengan mode `hybrid`, rollback kapan pun aman: salinan Supabase selalu ikut ter-update, jadi redeploy release lama (yang membaca Supabase) tidak kehilangan file apa pun.
28: 
29: **Domain `askonveksi.web.id` tidak diperlukan untuk penyimpanan file.** Jangan serve folder statis via nginx — desain PO, bukti bayar, dan media WA harus tetap hanya lewat route yang butuh login. Route yang sama (di domain yang sama) tetap dipakai; hanya sumber byte-nya berubah.
30: 
31: ---
32: 
33: ## 2. Peta lengkap saat ini (hasil audit — semua titik yang akan disentuh)
34: 
35: ### 2.1 Bucket Supabase Storage yang aktif (semua privat)
36: 
37: Disiapkan oleh `scripts/setup-crm-storage.mjs`:
38: 
39: | Bucket | Limit bucket | Isi |
40: |---|---|---|
41: | `crm-po-designs` | 5 MB, MIME bebas | Desain revisi PO, salinan original produksi, desain penjahit, lampiran PO |
42: | `business-assets` | 2 MB, JPG/PNG/WebP | Logo & tanda tangan perusahaan |
43: | `payment-proofs` | 5 MB, PDF/JPG/PNG/WebP | Bukti pengeluaran, bukti transaksi bayar, bukti deposit PO |
44: | `whatsapp-media` | 10 MB, PDF/JPG/PNG/WebP | Media inbound (dari HP customer) & lampiran outbound |
45: 
46: Bucket `quotation-acceptance-proofs` sudah **retired** (dihapus `scripts/reset-crm-storage.mjs`) — **tidak ikut migrasi**.
47: 
48: ### 2.2 Titik tulis (upload/remove) — 6 file
49: 
50: | # | File | Fungsi | Bucket | Pola path | Semantik yang harus ditiru |
51: |---|---|---|---|---|---|
52: | W1 | `app/actions/design.ts` | `uploadDesignRevisionAction` | `crm-po-designs` | `design/<designTaskId>/<uuid>.(png\|jpg)` | `upload` (upsert:false), batch; `remove` saat rollback transaksi DB gagal |
53: | W2 | `app/actions/production.ts` | `saveProductionDesignAction` | `crm-po-designs` | overwrite `attachment.path` (upsert:true) + snapshot `production-design-original/<attachmentId>.png` | `exists`, `download`, `upload` upsert, `remove` |
54: | W3 | `app/actions/production.ts` | `overwriteProductionDesignAction` | `crm-po-designs` | `upload` path baru + `upload` snapshot upsert, `remove` path lama & cleanup saat transaksi gagal | idem |
55: | W4 | `app/actions/production.ts` | `resetProductionDesignAction` | `crm-po-designs` | `download` originalPath → `upload` ke attachment.path (upsert:true) | idem |
56: | W5 | `app/actions/production.ts` | `sendProductionDesignAction` | `crm-po-designs` | `remove` `originalPath` setelah masuk produksi | idem |
57: | W6 | `app/actions/crm.ts` (~L1796–1890) | `savePenjahitPlanAction` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.(png\|jpg)` | `upload` (upsert:false), `remove` file baru bila transaksi DB gagal |
58: | W7 | `app/actions/master-data.ts` (~L978–1028) | `updateBusinessProfileAction` | `business-assets` | `business/logo-<uuid>.<ext>`, `business/signature-<uuid>.<ext>` | `upload`, `remove` saat rollback. **File lama sengaja TIDAK dihapus** (path tersnapshot di invoice terkunci) — jangan diubah |
59: | W8 | `app/actions/whatsapp.ts` (~L186–199) | `sendWhatsAppMessageAction` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `upload`, `remove` bila enqueue gagal |
60: | W9 | `lib/payment-proof.ts` | `uploadPaymentProof` / `deletePaymentProof` | `payment-proofs` | `<ownerUserId>/<uuid>.(pdf\|jpg\|png\|webp)` | `upload`, `remove`. Dipanggil dari `app/actions/finance.ts` (expense & HPP) dan `app/actions/crm.ts` (transaksi bayar/deposit) |
61: 
62: ### 2.3 Titik baca (download) — 13 route
63: 
64: | # | Route | Bucket | Catatan khusus |
65: |---|---|---|---|
66: | R1 | `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | dukung `?original` (originalPath); content-type di-sniff dari byte |
67: | R2 | `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | lampiran PO |
68: | R3 | `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | `crm-po-designs` | thumbnail dialog + PDF |
69: | R4 | `app/api/crm/purchase-order/[id]/pdf/route.ts` | `business-assets` + `crm-po-designs` | logo + loop gambar desain/penjahit/lampiran untuk PDF |
70: | R5 | `app/api/crm/invoice/[id]/pdf/route.ts` | `business-assets` | logo + signature (snapshot → fallback profil) |
71: | R6 | `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `business-assets` | `readImage` logo + signature |
72: | R7 | `app/api/master-data/business-profile/logo/route.ts` | `business-assets` | pakai `data.type` dari blob → perlu pengganti: infer dari ekstensi |
73: | R8 | `app/api/master-data/business-profile/signature/route.ts` | `business-assets` | idem |
74: | R9 | `app/api/public/business-logo/route.ts` | `business-assets` | **satu-satunya route publik tanpa auth**; sudah ada allowlist regex path — pertahankan |
75: | R10 | `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `payment-proofs` | |
76: | R11 | `app/api/crm/payment-transactions/[id]/proof/route.ts` | `payment-proofs` | |
77: | R12 | `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | `payment-proofs` | |
78: | R13 | `app/api/whatsapp/media/[id]/route.ts` | `whatsapp-media` | path **tanpa ekstensi** (`<accountId>/<date>/<messageId>`) — content-type dari kolom DB |
79: 
80: ### 2.4 Worker WhatsApp — `worker/whatsapp.mjs` (1 file, 3 titik)
81: 
82: | # | Lokasi (~baris) | Fungsi | Bucket |
83: |---|---|---|---|
84: | K1 | ~L200–220 (`storeInbound`) | upload media inbound (maks 5 MB) | `whatsapp-media` |
85: | K2 | ~L250–265 (`processAccountDeletion`) | batch `remove` saat akun WA dihapus (chunk 100) | `whatsapp-media` |
86: | K3 | ~L608–614 (`performSendJob`) | `download` lampiran outbound sebelum dikirim | `whatsapp-media` |
87: 
88: **Batasan deployment penting:** deploy.yml hanya menyalin **satu file** worker (`cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs`). Jika worker memakai modul bersama, file modul itu **harus ikut ditambahkan ke Package step + verifikasi tarball**, kalau tidak worker crash di produksi (`ERR_MODULE_NOT_FOUND`).
89: 
90: ### 2.5 Test yang menyentuh pola storage (wajib diperbarui)
91: 
92: | File | Pemeriksaan yang akan patah setelah refactor |
93: |---|---|
94: | `tests/crm-validation.test.mjs` ~L1049–1071 | `storageScript` mengandung `/crm-po-designs/`; `designActionSource` cocok `/storage\.from\(BUCKET\)/` |
95: | `tests/crm-validation.test.mjs` ~L1627 | route deposit cocok `/PAYMENT_PROOF_BUCKET/` (pertahankan nama ekspor `PAYMENT_PROOF_BUCKET` di `lib/payment-proof.ts` agar tidak patah, atau perbarui assertion) |
96: | `tests/business-profile.test.mjs` ~L57–67 | `signatureRouteSource` cocok `/business-assets/` |
97: 
98: Test yang **tidak berubah**: `tests/attendance-storage.test.mjs`, `tests/cms-media.test.mjs` (modul lain, di luar cakupan).
99: 
100: ---
101: 
102: ## 3. Arsitektur target
103: 
104: ### 3.1 Layout direktori VPS
105: 
106: ```
107: /var/lib/askonveksi/storage/            # ERP_STORAGE_DIR (volume persisten, di luar releases/)
108: ├── crm-po-designs/
109: │   ├── design/<designTaskId>/<uuid>.(png|jpg)
110: │   ├── production-design-original/<attachmentId>.png
111: │   ├── penjahit/<itemId>/<uuid>.(png|jpg)
112: │   └── (path lampiran PO lama bila ada)
113: ├── business-assets/
114: │   └── business/(logo|signature)-<uuid>.(png|jpg|webp)
115: ├── payment-proofs/
116: │   └── <ownerUserId>/<uuid>.(pdf|jpg|png|webp)
117: └── whatsapp-media/
118:     ├── <accountId>/<YYYY-MM-DD>/<messageId>          # inbound, tanpa ekstensi
119:     └── outbound/<YYYY-MM-DD>/<uuid>-<namaAman>
120: ```
121: 
122: - Ownership: user aplikasi yang sama dengan absensi (mis. `askonveksi`), mode dir `0750`, file `0640` (ikuti pola `lib/attendance/photo.ts`).
123: - Lokal/dev: default `./data/erp-storage` (sudah ter-catch `.gitignore` `/data/`).
124: 
125: ### 3.2 Env baru
126: 
127: ```bash
128: # .env.example (ditambahkan) — juga diset di $DEPLOY_PATH/shared/.env di VPS
129: ERP_STORAGE_DIR=/var/lib/askonveksi/storage   # lokal: ./data/erp-storage
130: ERP_STORAGE_DRIVER=supabase                   # supabase | hybrid | local (default: supabase)
131: ```
132: 
133: ### 3.3 Modul baru
134: 
135: **A. `lib/storage/local-store.mjs`** — inti fs polos (mjs, tanpa dependensi build, tanpa alias `@/`) supaya bisa dipakai **app (via import TS) dan worker (via import relatif)** tanpa duplikasi logika:
136: 
137: ```js
138: // API (semua path relatif divalidasi ketat sebelum menyentuh fs)
139: export function storeRoot()                              // resolve(ERP_STORAGE_DIR || ./data/erp-storage)
140: export function resolveSafe(bucket, relativePath)        // tolak: \0, \, "..", segmen ".", absolut; resolve + startsWith(root+sep) — pola lib/attendance/photo.ts
141: export async function putFile(bucket, relativePath, bytes, { upsert })
142: export async function getFile(bucket, relativePath)      // Buffer | null
143: export async function removeFiles(bucket, paths)         // best-effort; ENOENT diabaikan; kumpulkan error non-ENOENT
144: export async function fileExists(bucket, relativePath)   // boolean
145: export function contentTypeFromPath(relativePath)        // png/jpg/jpeg/webp/pdf → MIME; fallback octet-stream
146: ```
147: 
148: Aturan implementasi wajib:
149: - `putFile` **atomik**: tulis ke `<path>.tmp-<random>` di folder yang sama lalu `rename` (overwrite `upsert:true` tidak pernah terbaca setengah jalan oleh route PDF/desain yang sedang jalan).
150: - `putFile` dengan `upsert:false` memakai flag `wx` (gagal bila sudah ada) — meniru semantik Supabase.
151: - `mkdir` recursive `mode 0750` sebelum tulis; `writeFile` `mode 0640`.
152: - `getFile` mengembalikan `null` untuk path tidak valid / tidak ada (tanpa throw) — pemanggil meniru pola `if (error) return 404` yang sudah ada.
153: 
154: **B. `lib/storage/erp-storage.ts`** — wrapper TS app-side: konstanta bucket + driver mode + fallback:
155: 
156: ```ts
157: export const PO_DESIGNS_BUCKET = "crm-po-designs";
158: export const BUSINESS_ASSETS_BUCKET = "business-assets";
159: export const PAYMENT_PROOFS_BUCKET = "payment-proofs";   // alias lama PAYMENT_PROOF_BUCKET dipertahankan di lib/payment-proof.ts
160: export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
161: 
162: // Bentuk hasil sengaja meniru supabase-js { data, error } agar panggilan di call site minim diubah
163: export async function erpGet(bucket, path): Promise<{ data: Buffer | null; error: { message: string } | null }>
164: export async function erpPut(bucket, path, bytes, opts: { contentType?: string; upsert?: boolean })
165: export async function erpRemove(bucket, paths: string[])
166: export async function erpExists(bucket, path): Promise<{ data: boolean; error?: ... }>
167: ```
168: 
169: Perilaku per driver:
170: - `supabase`: lempar ke `createAdminClient().storage.from(bucket)` — persis kode sekarang.
171: - `hybrid`:
172:   - **Put**: tulis ke VPS; jika VPS sukses, tulis juga ke Supabase (best-effort logging bila Supabase gagal — VPS sudah jadi primer). Bila VPS gagal, tulis Supabase dan **log error keras** (agar terlihat di monitoring).
173:   - **Get**: coba VPS; `null` → fallback Supabase; **log info `[erp-storage] fallback-supabase`** (indikator bahwa backfill belum lengkap — dipakai untuk verifikasi fase).
174:   - **Remove**: hapus di keduanya, best-effort.
175: - `local`: VPS saja, tanpa fallback.
176: 
177: Route R7/R8/R9 yang memakai `data.type` beralih ke `contentTypeFromPath(path)` (ekstensi selalu ada di path bucket `business-assets`).
178: 
179: **C. Worker**: `worker/whatsapp.mjs` import `../lib/storage/local-store.mjs` (relatif; worker `--cwd $CURRENT_LINK`, jadi `<release>/lib/storage/local-store.mjs`). Driver worker mengikuti env yang sama (`ERP_STORAGE_DRIVER`), tapi worker **hanya** membutuhkan mode local/hybrid-put/hybrid-get sederhana untuk `whatsapp-media`. Bila ternyata dikejar cepat, alternatif yang diterima: inline logika fs mini di dalam `whatsapp.mjs` (±40 baris) tanpa import — keputusan di bagian 14.
180: 
181: ### 3.4 Deploy workflow (` .github/workflows/deploy.yml`)
182: 
183: Package step ditambah (dan verifikasi tarball diperluas):
184: 
185: ```bash
186: mkdir -p deploy_package/lib/storage
187: cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
188: # tambahkan ke loop verifikasi:
189: tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs' || { echo 'local-store.mjs missing'; exit 1; }
190: ```
191: 
192: ---
193: 
194: ## 4. Invarian keamanan yang WAJIB dipertahankan (checklist review)
195: 
196: - [ ] Semua route tetap berauth `requireActor(...)` — **tidak ada** route/file baru yang publik selain R9 (dengan allowlist regex yang sudah ada).
197: - [ ] Validasi path anti-traversal di `resolveSafe` (uji dengan test khusus: `..`, `../..`, absolut, `\0`, `\`, segmen berawal titik) — pola terbukti `resolveAttendancePhotoPath`/`resolveMediaFile`.
198: - [ ] Header respons tidak berubah: `Cache-Control: private, no-store` (atau `public, immutable` khusus R9), `X-Content-Type-Options: nosniff`, `Content-Disposition` inline/attachment seperti sekarang.
199: - [ ] Validasi upload di call site tidak berubah (magic bytes `lib/design/image.ts` & `lib/payment-proof.ts`, limit 5/10/2 MB, nama file disanitasi, path dari UUID).
200: - [ ] Semantik "file lama signature tidak dihapus" (W7) tetap — jangan sekadar "pindah lalu hapus yang lama".
201: - [ ] Cleanup ordes: bila transaksi DB gagal, file hasil upload ikut dihapus (pola rollback di W1/W3/W6/W8) tetap berfungsi di driver hybrid (hapus di **kedua** lokasi).
202: - [ ] Role & gerbang akses tidak tersentuh sama sekali (aturan DEVELOPER selalu bisa mengakses tetap berlaku; tidak ada yang ditambah/diambil).
203: 
204: ---
205: 
206: ## 5. Daftar file lengkap
207: 
208: ### 5.1 File baru (7)
209: 
210: | File | Isi |
211: |---|---|
212: | `lib/storage/local-store.mjs` | inti fs + validasi path (bagian 3.3A) |
213: | `lib/storage/erp-storage.ts` | konstanta bucket + driver mode + fallback (bagian 3.3B) |
214: | `scripts/migrate-storage-to-vps.mjs` | backfill Supabase → VPS (bagian 7) |
215: | `scripts/backup-erp-storage.sh` | cron backup harian + rotasi (bagian 8) |
216: | `tests/erp-storage.test.mjs` | unit test modul (bagian 6, Fase 1) |
217: | `docs/PANDUAN_STORAGE_ERP.md` | runbook operasional: env, driver, migrasi, backup/restore, decommission |
218: | `FILE_TO_VPS.md` | dokumen ini |
219: 
220: ### 5.2 File yang diubah (20)
221: 
222: | File | Perubahan ringkas |
223: |---|---|
224: | `app/actions/design.ts` | `storage.from(BUCKET).upload/remove` → `erpPut/erpRemove` (W1) |
225: | `app/actions/production.ts` | 4 aksi → `erpGet/erpPut/erpExists/erpRemove` (W2–W5) |
226: | `app/actions/crm.ts` | upload/hapus desain penjahit → `erpPut/erpRemove` (W6) |
227: | `app/actions/master-data.ts` | logo/signature → `erpPut/erpRemove` (W7) |
228: | `app/actions/whatsapp.ts` | lampiran outbound → `erpPut/erpRemove` (W8) |
229: | `lib/payment-proof.ts` | inti `uploadPaymentProof`/`deletePaymentProof` → `erpPut/erpRemove`; **ekspor `PAYMENT_PROOF_BUCKET` dipertahankan** |
230: | `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | download → `erpGet` (R1) |
231: | `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | idem (R2) |
232: | `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | idem (R3) |
233: | `app/api/crm/purchase-order/[id]/pdf/route.ts` | loop logo + aset desain → `erpGet` (R4) |
234: | `app/api/crm/invoice/[id]/pdf/route.ts` | logo + signature → `erpGet` (R5) |
235: | `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `readImage` → `erpGet` (R6) |
236: | `app/api/master-data/business-profile/logo/route.ts` | `erpGet` + `contentTypeFromPath` (R7) |
237: | `app/api/master-data/business-profile/signature/route.ts` | idem (R8) |
238: | `app/api/public/business-logo/route.ts` | `erpGet` + `contentTypeFromPath`; allowlist regex dipertahankan (R9) |
239: | `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `erpGet` (R10) |
240: | `app/api/crm/payment-transactions/[id]/proof/route.ts` | `erpGet` (R11) |
241: | `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | `erpGet` (R12) |
242: | `app/api/whatsapp/media/[id]/route.ts` | `erpGet` (R13) |
243: | `worker/whatsapp.mjs` | K1–K3 → `local-store.mjs` (atau inline; lihat 3.3 & 14) |
244: | `.github/workflows/deploy.yml` | Package step salin `lib/storage/local-store.mjs` + verifikasi tar (bagian 3.4) |
245: 
246: ### 5.3 File yang disentuh ringan
247: 
248: | File | Perubahan |
249: |---|---|
250: | `.env.example` | tambah `ERP_STORAGE_DIR`, `ERP_STORAGE_DRIVER` + komentar (bagian 3.2) |
251: | `README.md` | satu paragraf: file ERP disimpan di VPS, lihat `docs/PANDUAN_STORAGE_ERP.md` |
252: | `tests/crm-validation.test.mjs` | perbarui assertion ~L1049–1071 (dan L1627 bila diperlukan) ke pola modul baru |
253: | `tests/business-profile.test.mjs` | perbarui assertion ~L57–67 |
254: | `package.json` | tambah script `storage:migrate`, `storage:verify`, `storage:backup` |
255: 
256: ### 5.4 Sengaja TIDAK diubah
257: 
258: - `prisma/schema.prisma` + semua migrasi — path DB identik.
259: - `scripts/setup-crm-storage.mjs`, `scripts/reset-crm-storage.mjs` — tetap ada selama masa transisi (dipakai ulang bila rollback); baru dinonaktifkan di Fase 6.
260: - Modul CMS (`lib/cms/*`) dan absensi (`lib/attendance/*`) — sudah di VPS, di luar cakupan.
261: - Kode Supabase Postgres (`lib/prisma.ts`, `lib/supabase/*`) — tetap.
262: 
263: ---
264: 
265: ## 6. Fase implementasi (urut, tiap fase punya acceptance criteria)
266: 
267: ### Fase 0 — Persiapan ops (VPS, sebelum kode apa pun)
268: 
269: - [ ] T0.1 Cek kapasitas: `df -h /var/lib` — pastikan sisa ≥ 2× ukuran total bucket saat ini + 5 GB headroom.
270: - [ ] T0.2 Ukur saat ini (dicatat di tiket/jurnal): jumlah objek & bytes per bucket (bisa dari dashboard Supabase Storage atau `scripts/migrate-storage-to-vps.mjs --dry-run` setelah Fase 1).
271: - [ ] T0.3 Buat volume dir: `sudo install -d -o <user-aplikasi> -g <user-aplikasi> -m 0750 /var/lib/askonveksi/storage` (user = yang menjalankan PM2, sama dengan absensi; lihat `docs/PANDUAN_ABSENSI.md` §5).
272: - [ ] T0.4 Tambahkan ke `$DEPLOY_PATH/shared/.env`: `ERP_STORAGE_DIR=/var/lib/askonveksi/storage` dan `ERP_STORAGE_DRIVER=hybrid`.
273: - [ ] T0.5 Siapkan `/var/backups/askonveksi` + pastikan cron backup absensi yang ada tidak bentrok penamaan.
274: 
275: **Gate:** dir bisa ditulis user aplikasi (uji `touch`), env terpasang, kapasitas cukup.
276: 
277: ### Fase 1 — Modul storage + unit test (belum menyentuh call site)
278: 
279: - [ ] T1.1 Buat `lib/storage/local-store.mjs` (bagian 3.3A) — atomik, `wx`, validasi path ketat, `contentTypeFromPath`.
280: - [ ] T1.2 Buat `lib/storage/erp-storage.ts` (bagian 3.3B) — 4 konstanta bucket, 4 fungsi `erp*`, percabangan driver `supabase|hybrid|local`, log fallback `[erp-storage]`.
281: - [ ] T1.3 Buat `tests/erp-storage.test.mjs` (ikuti pola `tests/attendance-storage.test.mjs`: set env ke temp dir):
282:   - [ ] put → get roundtrip per ekstensi (png/jpg/pdf/webp + path tanpa ekstensi gaya WA).
283:   - [ ] `upsert:false` menolak path yang sudah ada; `upsert:true` menimpa (isi terbaru yang terbaca).
284:   - [ ] Penolakan traversal: `../x`, `..`, `/abs`, `a\0b`, `a\b`, `.hidden/x`, path keluar root setelah resolve.
285:   - [ ] `removeFiles` tidak melempar pada path hilang; `fileExists` akurat.
286:   - [ ] `contentTypeFromPath` benar; fallback `application/octet-stream`.
287:   - [ ] Driver `supabase` = perilaku lama (mock/stub admin client bila perlu).
288: - [ ] T1.4 Perbarui assertion test lama yang membaca source (`tests/crm-validation.test.mjs`, `tests/business-profile.test.mjs`) **hanya bila patah**; jalankan penuh: `npm run lint && npx tsc --noEmit && npm test`.
289: - [ ] T1.5 `npm run build` sukses (modul baru tidak mengubah bundle sampai dipakai).
290: 
291: **Gate:** semua command hijau; modul belum direferensikan dari code produksi (diff hanya menambah file).
292: 
293: ### Fase 2 — Port call site app (19 file) ke modul, driver masih `supabase`
294: 
295: Urutan pengerjaan (mudah → sulit, agar regresi cepat terlihat):
296: 
297: 1. [ ] T2.1 `lib/payment-proof.ts` (W9) + jalankan test terkait bukti bayar.
298: 2. [ ] T2.2 Route baca `payment-proofs`: R10, R11, R12.
299: 3. [ ] T2.3 `app/actions/master-data.ts` (W7) + R7, R8, R9.
300: 4. [ ] T2.4 R5 (PDF invoice), R6 (kwitansi), R4 (PDF PO) — ketiga PDF ini juga dipakai worker via HTTP, uji khusus.
301: 5. [ ] T2.5 `app/actions/design.ts` (W1) + R1.
302: 6. [ ] T2.6 `app/actions/production.ts` (W2–W5) — perhatikan urutan `exists → download → upload upsert → remove`; semua semantik dipertahankan.
303: 7. [ ] T2.7 `app/actions/crm.ts` penjahit (W6) + R3; R2 (lampiran PO).
304: 8. [ ] T2.8 `app/actions/whatsapp.ts` (W8) + R13.
305: 9. [ ] T2.9 Bersihkan import `createAdminClient` yang tidak terpakai lagi di file yang sudah dipindah (waspada: masih dipakai untuk hal lain di beberapa file — cek satu per satu).
306: 
307: - [ ] T2.10 Setiap porting: pastikan pesan error UserFacingError, log `console.error` konteks, dan header respons identik dengan sebelumnya.
308: - [ ] T2.11 Verifikasi penuh: `npm run lint && npx tsc --noEmit && npm test && npm run build`.
309: 
310: **Gate:** dengan `ERP_STORAGE_DRIVER` tidak diset (default `supabase`), perilaku aplikasi **sama persis** dengan sebelum refactor — semua UAT spot-check lulus (bagian 12, kolom "driver supabase").
311: 
312: ### Fase 3 — Worker WhatsApp + deploy workflow
313: 
314: - [ ] T3.1 Port K1–K3 di `worker/whatsapp.mjs` ke `local-store.mjs` (atau inline — keputusan di bagian 14). Pertahankan: cap 5 MB inbound, chunked remove 100 path, guard env.
315: - [ ] T3.2 Update `.github/workflows/deploy.yml`: salin `lib/storage/local-store.mjs` ke `deploy_package/lib/storage/` + tambah verifikasi tarball (bagian 3.4).
316: - [ ] T3.3 Uji lokal: `node --check worker/whatsapp.mjs`, lalu `node scripts/collect-worker-deps.mjs /tmp/deploy-check` dan pastikan exit 0 (tracer tetap resolve semua import).
317: - [ ] T3.4 Uji end-to-end worker lokal: `npm run whatsapp:worker:dev`, kirim/terima pesan berlampiran, hapus akun uji → file terhapus.
318: - [ ] T3.5 `npm run lint && npx tsc --noEmit && npm test && npm run build`.
319: 
320: **Gate:** simulasi layout release: buat `/tmp/rel/{worker,lib/storage}`, salin file seperti Package step, jalankan worker dari `/tmp/rel` dengan env temp → tidak ada `ERR_MODULE_NOT_FOUND`.
321: 
322: ### Fase 4 — Deploy transisi (driver `hybrid`) ke produksi
323: 
324: - [ ] T4.1 Merge Fase 1–3 ke `production` (deploy otomatis jalan: lint → test → build → migrate → deploy).
325: - [ ] T4.2 Pastikan `ERP_STORAGE_DRIVER=hybrid` di `shared/.env` **sebelum** restart (sudah dipasang di T0.4).
326: - [ ] T4.3 Smoke test produksi (login OWNER/DEVELOPER): buka PDF invoice & PO, lihat desain PO & penjahit, buka bukti pengeluaran, kirim pesan WA berfoto.
327: - [ ] T4.4 Amati log PM2 24 jam: cari `[erp-storage]` — fallback Supabase wajar (file lama), **error put VPS harus nol**.
328: 
329: **Gate:** aplikasi berjalan normal; semua upload baru tercatat di VPS (`find $ERP_STORAGE_DIR -newer /tmp/marker -type f`), dan tetap di Supabase (dual-write).
330: 
331: ### Fase 5 — Backfill data lama + verifikasi
332: 
333: - [ ] T5.1 Jalankan di VPS (dari clone repo, lihat bagian 7): `node scripts/migrate-storage-to-vps.mjs` (idempoten, lanjut dari yang sudah ada).
334: - [ ] T5.2 `node scripts/migrate-storage-to-vps.mjs --verify` — ringkasan: jumlah objek per bucket cocok, ukuran per file cocok, daftar yang hilang = kosong.
335: - [ ] T5.3 Checksum sampel: minimal 20 file acak (termasuk 5 terlama & 5 terbaru) — SHA-256 lokal == blob Supabase.
336: - [ ] T5.4 UAT penuh bagian 12 dengan `ERP_STORAGE_DRIVER=hybrid` — semua baris "hybrid" lulus; log fallback Supabase tinggal nol untuk alur yang sudah diuji.
337: - [ ] T5.5 Pasang backup cron (bagian 8) dan uji restore sekali (bagian 8.3).
338: 
339: **Gate:** `--verify` bersih, UAT bersih, backup cron aktif dan restore teruji.
340: 
341: ### Fase 6 — Pemotongan final & pemangkasan (setelah grace period 1–2 bulan)
342: 
343: Kriteria masuk: log `[erp-storage] fallback-supabase` tidak muncul sama sekali selama 14 hari terakhir, backup rutin sukses, tidak ada insiden storage.
344: 
345: - [ ] T6.1 Set `ERP_STORAGE_DRIVER=local` di `shared/.env`, restart PM2 app + worker.
346: - [ ] T6.2 Uji ulang spot-check bagian 12 (driver `local`).
347: - [ ] T6.3 (Opsional, setelah yakin total) Kosongkan & hapus bucket: `node scripts/reset-crm-storage.mjs` sudah menghapus `quotation-acceptance-proofs`; buat `scripts/retire-erp-buckets.mjs` atau cukup hapus 4 bucket via dashboard Supabase. **Jangan lakukan sebelum T6.2 lulus.**
348: - [ ] T6.4 Nonaktifkan jalur Supabase di `erp-storage.ts` (buang percabangan hybrid/supabase bila diinginkan; atau biarkan — kode mati tidak menambah risiko). Perbarui `docs/PANDUAN_STORAGE_ERP.md` + `README.md`.
349: - [ ] T6.5 Catat penghematan di TRACKING_REVISI / jurnal proyek.
350: 
351: ---
352: 
353: ## 7. Runbook migrasi data (Fase 5) — langkah persis
354: 
355: `scripts/migrate-storage-to-vps.mjs` (Node mjs, hanya butuh `@supabase/supabase-js` + `dotenv` yang sudah ada):
356: 
357: 1. Baca env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ERP_STORAGE_DIR`.
358: 2. Untuk tiap bucket dalam `["crm-po-designs","business-assets","payment-proofs","whatsapp-media"]`:
359:    - Walk rekursif `storage.list(prefix, { limit: 100, offset })` dari root (elemen tanpa `id` = folder → antri).
360:    - Tiap objek: `storage.download(name)` → tulis `join(ERP_STORAGE_DIR, bucket, name)` dengan `mkdir -recursive`; **skip** bila file sudah ada dengan ukuran sama (idempoten/lanjut-ulang).
361:    - Verifikasi ukuran tertulis == `metadata.size`; catat gagal.
362: 3. Mode `--dry-run`: hanya listing + estimasi jumlah/bytes.
363: 4. Mode `--verify`: tanpa menulis; bandingkan jumlah objek & ukuran per file; exit non-zero bila ada selisih (cicil untuk CI/manual gate).
364: 5. Ringkasan akhir per bucket: `objects, bytes, skipped(exists), written, failed`.
365: 
366: Jalankan di VPS:
367: 
368: ```bash
369: cd /tmp && git clone <repo> askonveksi-migrate && cd askonveksi-migrate
370: npm ci --omit=dev        # atau npm i --omit=dev bila prune mengganggu
371: set -a; . $DEPLOY_PATH/shared/.env; set +a
372: node scripts/migrate-storage-to-vps.mjs --dry-run   # cek estimasi dulu
373: node scripts/migrate-storage-to-vps.mjs             # eksekusi (bisa diulang, resume otomatis)
374: node scripts/migrate-storage-to-vps.mjs --verify
375: ```
376: 
377: Catatan urutan: backfill boleh kapan pun setelah Fase 4 — file baru masa transisi sudah dual-write, dan fallback hybrid menutup celah file yang lahir sebelum backfill selesai.
378: 
379: ---
380: 
381: ## 8. Backup & restore
382: 
383: ### 8.1 Backup harian (cron VPS)
384: 
385: `scripts/backup-erp-storage.sh`:
386: 
387: ```bash
388: #!/usr/bin/env bash
389: set -euo pipefail
390: SRC="${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}"
391: DEST="${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}"
392: STAMP=$(date +%Y%m%d-%H%M%S)
393: mkdir -p "$DEST"
394: tar -C "$(dirname "$SRC")" -czf "$DEST/erp-storage-$STAMP.tar.gz" "$(basename "$SRC")"
395: # rotasi: simpan 14 backup terakhir
396: ls -1t "$DEST"/erp-storage-*.tar.gz | tail -n +15 | xargs -r rm -f
397: ```
398: 
399: Cron (user aplikasi): `15 2 * * * /path/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1`
400: 
401: ### 8.2 Offside (opsional, rekomendasi kuat)
402: 
403: Rsync/rclone arsip terbaru ke storage lain (Backblaze B2 / Google Drive / komputer lain): `0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h`. Alasan: DB di-backup Supabase, file kini cuma di satu disk VPS — kegagalan disk = pasangan DB+file harus bisa dipulihkan bersama.
404: 
405: ### 8.3 Restore (uji sekali di Fase 5)
406: 
407: ```bash
408: sudo systemctl stop <pm2-app> <pm2-wa>   # atau pm2 stop semua
409: tar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz
410: sudo chown -R <user-aplikasi>:<user-aplikasi> /var/lib/askonveksi/storage
411: # cek: node scripts/migrate-storage-to-vps.mjs --verify  (membandingkan dengan Supabase selama grace period)
412: ```
413: 
414: ### 8.4 Pasangan backup DB ↔ file
415: 
416: Catat di `docs/PANDUAN_STORAGE_ERP.md`: restore DB (Supabase) dan restore file (tar VPS) harus dari waktu yang mendekati; path di DB menunjuk ke file — file yang hilang = desain/bukti tidak terbaca (route 404, bukan crash).
417: 
418: ---
419: 
420: ## 9. Monitoring & kapasitas
421: 
422: - [ ] T9.1 Log fallback `[erp-storage] fallback-supabase` = indikator backfill belum tuntas (Fase 5) — setelah T6.1 log ini hilang dengan sendirinya.
423: - [ ] T9.2 Cron mingguan cek disk: `df -P "$ERP_STORAGE_DIR" | tail -1` — alert bila Use% ≥ 80% (kirim notifikasi WA internal atau email).
424: - [ ] T9.3 Setelah insiden "P3009 migration" sebelumnya: pastikan pembaruan `deploy.yml` tidak mengganggu langkah Prisma (tidak ada hubungannya — hanya memastikan tidak ada perubahan urutan job).
425: - [ ] T9.4 Ukur ulang bulanan: total bytes folder vs sebelumnya — pertumbuhan wajar ≈ (file baru per hari × rata-rata ukuran).
426: 
427: ---
428: 
429: ## 10. Rollback plan
430: 
431: | Situasi | Tindakan |
432: |---|---|
433: | Bug ditemukan saat Fase 2 (driver masih `supabase`) | Revert merge / redeploy release sebelumnya. Nol dampak data. |
434: | Bug ditemukan saat Fase 4–5 (hybrid) | Set `ERP_STORAGE_DRIVER=supabase` di `shared/.env` + `pm2 restart` kedua proses — instan, tanpa deploy. Salinan Supabase selalu lengkap (dual-write). |
435: | Perlu redeploy release lama saat hybrid | Aman — release lama baca Supabase yang ikut ter-update. |
436: | Setelah Fase 6 (`local`) ada masalah serius | Kembalikan `ERP_STORAGE_DRIVER=hybrid` (bukan `supabase`!) lalu investigasi; bila terpaksa ke `supabase`, jalankan dulu sync balik local→Supabase (tulis skrip kecil satu kali dari pola migrasi terbalik) untuk file yang lahir setelah T6.1. Inilah alasan grace period wajib. |
437: 
438: ---
439: 
440: ## 11. Risiko & mitigasi
441: 
442: | # | Risiko | Dampak | Mitigasi |
443: |---|---|---|---|
444: | 1 | Disk VPS gagal / hilang saat deploy (folder salah di dalam `releases/`) | Semua gambar hilang | `ERP_STORAGE_DIR` absolut di luar release; backup harian + offsite; `--verify` periodik |
445: | 2 | Worker crash di produksi karena modul tidak ikut di-tar | Media WA berhenti tersimpan | T3.2/T3.5: Package step + loop verifikasi tar + simulasi layout release |
446: | 3 | Path traversal lewat kolom DB yang compromised | Kebocoran file | `resolveSafe` ketat + test traversal; route tetap berauth |
447: | 4 | Torn read saat overwrite desain produksi (upsert) | Gambar PDF rusak/ separuh | Tulis atomik temp+rename |
448: | 5 | Lupa memperbarui salah satu dari 19 file call site | Fitur tertentu 404/error | Checklist bagian 5.2 dipakai sebagai daftar review; UAT bagian 12 per fitur |
449: | 6 | Test lama patah dan dilewatkan | Regresi tak terdeteksi | T1.4 eksplisit menyebut file & baris assertion yang patah; `npm test` wajib lulus |
450: | 7 | Hybrid lupa dimatikan → biaya/storage Supabase dobel terus | Boros kecil | T6.1 ada gate tanggal; log fallback = pengingat |
451: | 8 | Backup dibuat tapi restore tidak pernah diuji | Panic saat insiden | T5.5 mewajibkan uji restore sekali |
452: | 9 | Kapasitas disk kurang | Upload gagal di tengah operasional | T0.1 gate kapasitas; T9.2 alert 80% |
453: | 10 | Signature/logo snapshot invoice terkunci menunjuk file lama yang terlanjur dihapus | Kop PDF invoice lama rusak | Invarian bagian 4: jangan ubah kebijakan "file lama tidak dihapus"; backfill menyalin SEMUA objek bucket termasuk yang lama |
454: 
455: ---
456: 
457: ## 12. UAT checklist (per fase 4/5/6, login sebagai OWNER/DEVELOPER)
458: 
459: | Fitur | Langkah uji | Bukti sukses |
460: |---|---|---|
461: | Upload desain revisi PO (multi produk, multi file) | PO DRAFT + deposit lunas → upload 2 file PNG → simpan | baris `DesignAttachment` baru; file muncul di `ERP_STORAGE_DIR/crm-po-designs/design/...`; tampil inline di PO |
462: | Rollback upload desain | Paksa gagal transaksi (mis. versi melewati batas 4) | file hasil upload tidak tertinggal (dihapus) |
463: | Anotasi & versi produksi | Detail Desain: Simpan Versi (PNG) → Undo via Reset → Ganti Desain → Masukkan ke Produksi | snapshot `production-design-original` ada saat anotasi; hilang setelah masuk produksi; PDF PO varian penjahit benar |
464: | Desain penjahit | Dialog Edit PDF Penjahit: upload, ganti (timpa), hapus | path `penjahit/<itemId>/...`; thumbnail tampil; PDF penjahit memuat gambar |
465: | Bukti pengeluaran & HPP | Tambah pengeluaran QRIS + upload PDF; ubah; buka dari Keuangan | inline gambar / download PDF berfungsi |
466: | Bukti transaksi & deposit PO | Bayar DP dengan bukti JPG; buka "Lihat Deposit" | tampil |
467: | Logo & tanda tangan | Ganti logo (PNG), ganti tanda tangan (WebP), centang hapus tanda tangan | preview form, PDF invoice, PDF PO, kwitansi, `/api/public/business-logo` (dengan `?v=` baru) |
468: | Lampiran WA outbound | Kirim gambar & PDF ke customer | pesan terkirim; tampil di inbox (`/api/whatsapp/media/...`); file di `whatsapp-media/outbound/...` |
469: | Media WA inbound | Dari HP customer kirim foto & PDF | tersimpan (cap 5 MB), tampil di inbox |
470: | Kirim invoice via WA | Aksi "Kirim Invoice" | worker ambil PDF via HTTP, terkirim; tidak ada error di log worker |
471: | Hapus akun WA | Hapus akun percobaan | media terhapus dari disk (K2) |
472: | Route publik | Buka landing/navbar tanpa login | logo tampil (R9) |
473: 
474: ---
475: 
476: ## 13. Di luar cakupan (sengaja)
477: 
478: - CMS (`CMS_UPLOAD_DIR`) dan absensi (`ATTENDANCE_UPLOAD_DIR`) — sudah di VPS.
479: - Supabase Postgres & Auth — tidak disentuh.
480: - Penghapusan bucket di dashboard (Fase 6.3) — opsional dan terakhir.
481: - Serve file statis langsung via nginx/domain — **tidak dilakukan** (alasan keamanan, bagian 1).
482: - Skema path baru / kompresi / thumbnail — tidak diminta; path lama dipertahankan 1:1.
483: 
484: ---
485: 
486: ## 14. Keputusan yang perlu dikonfirmasi sebelum implementasi
487: 
488: 1. **Grace period hybrid**: 1 bulan atau 2 bulan sebelum `ERP_STORAGE_DRIVER=local`? (Rekomendasi: 1 bulan bila volume file harian kecil.)
489: 2. **Worker**: import `lib/storage/local-store.mjs` yang disalin ke release (rekomendasi, tanpa duplikasi logika) atau inline fs mini di `whatsapp.mjs` (lebih mandiri, ada risiko drift)?
490: 3. **Backup offsite** (bagian 8.2): diaktifkan sekarang (rekomendasi) atau cukup backup lokal dulu?
491: 4. **Retire bucket** di Fase 6.3: langsung dihapus, atau disimpan kosong sebagai cold-copy lama?
492: 5. **User aplikasi di VPS** yang menjalankan PM2 (untuk `install -d -o`) — konfirmasi nama user/group yang benar (lihat `docs/PANDUAN_ABSENSI.md` yang memakai `askonveksi`).
493: 
494: ---
495: 
496: *Dokumen ini rancangan saja. Implementasi dimulai hanya setelah bagian 14 disepakati, dimulai dari Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 tanpa melompati gate di tiap akhir fase.*

**Tool: shell**

**Input:**
```json
{
  "command": "ls -la; cat package.json"
}
```

total 6904
drwxr-xr-x  27 haydar haydar    4096 Oct 22 22:46 .
drwxr-xr-x   4 haydar haydar    4096 Oct 22 18:19 ..
drwxr-xr-x   3 haydar haydar    4096 Sep 13 00:01 .agent
drwxr-xr-x   3 haydar haydar    4096 Sep 13 00:01 .agents
-rw-r--r--   1 haydar haydar    2153 Sep 27 21:29 AGENTS.md
drwxr-xr-x  17 haydar haydar    4096 Oct 18 01:01 app
-rw-r--r--   1 haydar haydar     914 Sep 13 00:01 ASUMSI_CRM.md
drwxr-xr-x   3 haydar haydar    4096 Sep 13 00:01 backup
-rw-r--r--   1 haydar haydar   11687 Sep 13 00:01 BLUEPRINT_ERM_ASKONVEKSI.md
drwxr-xr-x   3 haydar haydar    4096 Sep 13 00:01 .claude
-rw-r--r--   1 haydar haydar      11 Sep 13 00:01 CLAUDE.md
-rw-r--r--   1 haydar haydar    6783 Oct 17 10:20 cleaning-2026-10-16.sql
drwxr-xr-x   2 haydar haydar    4096 Sep 13 00:01 .codex
drwxr-xr-x  15 haydar haydar    4096 Oct 22 21:43 components
-rw-r--r--   1 haydar haydar     516 Sep 13 00:01 components.json
drwxr-xr-x   5 haydar haydar    4096 Oct 18 01:06 data
-rw-r--r--   1 haydar haydar   90181 Sep  7 14:55 Data CRM AS Konveksi.xlsx
-rw-r--r--   1 haydar haydar   26864 Sep 18 09:59 DESIGN-LANDING.md
-rw-r--r--   1 haydar haydar   14431 Sep 29 21:01 DESIGN.md
drwxr-xr-x   2 haydar haydar    4096 Oct 21 19:05 docs
-rw-r--r--   1 haydar haydar     832 Sep 30 19:23 .env
-rw-r--r--   1 haydar haydar    1052 Sep 18 10:00 .env.broadcast-test.example
-rw-r--r--   1 haydar haydar     949 Sep 30 19:23 .env.cloud-bak
-rw-r--r--   1 haydar haydar    1440 Oct 21 19:13 .env.example
-rw-r--r--   1 haydar haydar   22271 Sep 27 21:29 erp_askonveksi.md
-rw-r--r--   1 haydar haydar     775 Oct 22 10:29 eslint.config.mjs
-rw-r--r--   1 haydar haydar 1105353 Sep 27 21:29 feature_docs_new.md
-rw-r--r--   1 haydar haydar   35524 Oct 22 22:46 FILE_TO_VPS.md
-rw-r--r--   1 haydar haydar 1010350 Oct  1 06:29 formatangka.md
drwx------   2 haydar haydar    4096 Sep 29 10:34 .freebuff
-rw-r--r--   1 haydar haydar 1911590 Sep 29 09:29 freebuff-chat-2026-09-27T10-36-34.424Z.md
drwxr-xr-x   3 haydar haydar    4096 Sep 13 00:01 .gemini
drwxr-xr-x   7 haydar haydar    4096 Oct 22 21:49 .git
drwxr-xr-x   6 haydar haydar    4096 Sep 27 21:29 .github
-rw-r--r--   1 haydar haydar     892 Oct 22 17:43 .gitignore
drwxr-xr-x   2 haydar haydar    4096 Sep 24 19:35 .hallmark
drwxr-xr-x   3 haydar haydar    4096 Sep 27 21:29 .impeccable
-rw-r--r--   1 haydar haydar    8232 Sep 13 00:01 IMPLEMENTASI_CRM_PLAN.md
-rw-r--r--   1 haydar haydar   17336 Sep 13 00:01 IMPLEMENTASI_CRM_V1_GAP_PLAN.md
-rw-r--r--   1 haydar haydar    7049 Sep 18 10:00 IMPLEMENTASI_REMINDER_CAMPAIGN_SETTINGS_ROSTER_PLAN.md
-rw-r--r--   1 haydar haydar  887214 Sep 27 21:29 Keuangan.md
drwxr-xr-x  15 haydar haydar    4096 Oct 22 21:43 lib
-rw-r--r--   1 haydar haydar    1160 Sep 29 21:13 middleware.ts
drwxr-xr-x  11 haydar haydar    4096 Oct 22 19:42 .next
-rw-r--r--   1 haydar haydar    5333 Oct 21 18:59 next.config.ts
-rw-r--r--   1 haydar haydar     296 Oct 22 21:49 next-env.d.ts
drwxr-xr-x 697 haydar haydar   20480 Oct 19 13:28 node_modules
drwxr-xr-x   4 haydar haydar    4096 Sep 24 08:31 .opencode
-rw-r--r--   1 haydar haydar    3603 Oct 22 17:42 package.json
-rw-r--r--   1 haydar haydar  530162 Oct 18 00:36 package-lock.json
-rw-r--r--   1 haydar haydar    1993 Sep 27 21:29 PANDUAN_ROLE_OUTLINE.md
-rw-r--r--   1 haydar haydar   15172 Sep 13 00:01 PANDUAN_SETUP_DEVELOPMENT_BAILEYS.md
-rw-r--r--   1 haydar haydar    8607 Sep 13 00:01 PANDUAN_TESTING_MANUAL_BAILEYS.md
-rw-r--r--   1 haydar haydar    3841 Sep 13 00:01 PERFORMANCE_OPTIMIZATION_PLAN.md
-rw-r--r--   1 haydar haydar  252183 Sep 13 00:01 PipelineCRM_Baru.md
-rw-r--r--   1 haydar haydar      94 Sep 13 00:01 postcss.config.mjs
drwxr-xr-x   3 haydar haydar    4096 Oct 22 21:43 prisma
-rw-r--r--   1 haydar haydar     378 Sep 13 00:01 prisma.config.ts
-rw-r--r--   1 haydar haydar    6024 Sep 13 00:01 PRODUCT.md
-rw-r--r--   1 haydar haydar   55841 Sep  8 13:47 PROJECT AS BULAN AGUSTUS 2026.xlsx
drwxr-xr-x  11 haydar haydar    4096 Oct 22 10:24 public
-rw-r--r--   1 haydar haydar    3771 Oct 22 17:42 README.md
drwxr-xr-x   4 haydar haydar    4096 Oct  9 08:26 Revisi1
-rw-r--r--   1 haydar haydar   23828 Oct 21 13:40 Revisi-17-10-2026.md
drwxr-xr-x   2 haydar haydar    4096 Oct 22 10:23 scripts
-rw-r--r--   1 haydar haydar    9941 Sep 13 00:01 SKEMA_CRM_ASKONVEKSI.md
-rw-r--r--   1 haydar haydar    7520 Oct 19 15:09 skills-lock.json
-rw-r--r--   1 haydar haydar  204338 Oct 15 18:49 sprint.md
-rw-r--r--   1 haydar haydar     475 Sep 13 00:01 test-getclaims.mjs
-rw-r--r--   1 haydar haydar     496 Sep 13 00:01 test-latency.mjs
-rw-r--r--   1 haydar haydar     657 Sep 13 00:01 test-pg-direct.mjs
-rw-r--r--   1 haydar haydar     526 Sep 13 00:01 test-pg.mjs
-rw-r--r--   1 haydar haydar    1202 Sep 13 00:01 test-prisma-join.mjs
drwxr-xr-x   3 haydar haydar    4096 Oct 22 21:43 tests
-rw-r--r--   1 haydar haydar   55192 Oct 21 21:31 TRACKING_REVISI.md
-rw-r--r--   1 haydar haydar     706 Sep 13 00:01 tsconfig.json
-rw-r--r--   1 haydar haydar  431842 Oct 22 19:39 tsconfig.tsbuildinfo
-rw-r--r--   1 haydar haydar   25926 Sep 13 00:01 WHATSAPP_BAILEYS_INTEGRATION_PLAN.md
drwxr-xr-x   2 haydar haydar    4096 Oct 17 00:19 worker
{
  "name": "askonveksi",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "dev:https": "next dev --experimental-https",
    "build": "next build",
    "start": "next start",
    "whatsapp:worker": "node worker/whatsapp.mjs",
    "whatsapp:worker:dev": "node --watch worker/whatsapp.mjs",
    "broadcast-test:prepare": "node --env-file=.env.broadcast-test scripts/broadcast-test-prepare.mjs",
    "broadcast-test:migrate": "node --env-file=.env.broadcast-test scripts/broadcast-test-migrate.mjs",
    "broadcast-test:seed": "node --env-file=.env.broadcast-test scripts/seed-broadcast-test.mjs",
    "broadcast-test:dev": "node scripts/broadcast-test-dev.mjs",
    "broadcast-test:worker": "node --env-file=.env.broadcast-test worker/whatsapp.mjs",
    "postinstall": "npm run db:generate && npm run export:vendor",
    "export:vendor": "node scripts/sync-export-vendor.mjs",
    "predev": "npm run export:vendor",
    "predev:https": "npm run export:vendor",
    "prebuild": "npm run export:vendor",
    "test": "node --test tests/*.test.mjs",
    "lint": "eslint",
    "bootstrap:owner": "node scripts/bootstrap-owner.mjs",
    "crm:reset-storage": "node scripts/reset-crm-storage.mjs",
    "crm:setup-storage": "node scripts/setup-crm-storage.mjs",
    "cms:setup": "node scripts/cms-setup.mjs",
    "cms:validate": "node scripts/cms-validate.mjs",
    "cms:backup": "node scripts/cms-backup.mjs",
    "cms:clean-orphans": "node scripts/cms-clean-orphans.mjs",
    "db:seed:production-demo": "node scripts/seed-production-demo.mjs",
    "db:backfill:production": "node scripts/backfill-production-work-orders.mjs",
    "db:backfill:po-categories": "node scripts/backfill-purchase-order-categories.mjs",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate"
  },
  "dependencies": {
    "@base-ui/react": "^1.7.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "@supabase/ssr": "^0.12.5",
    "@supabase/supabase-js": "2.112.4",
    "@tiptap/extension-link": "^3.32.0",
    "@tiptap/react": "^3.32.0",
    "@tiptap/starter-kit": "^3.32.0",
    "@whiskeysockets/baileys": "7.0.0-rc14",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "exceljs": "4.4.0",
    "gsap": "^3.15.0",
    "konva": "^10.7.0",
    "lucide-react": "^1.34.0",
    "motion": "^13.2.0",
    "next": "16.3.8",
    "pdf-lib": "^1.17.1",
    "pg": "^8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-konva": "^19.2.0",
    "recharts": "^3.8.0",
    "sanitize-html": "^2.18.1",
    "sharp": "0.35.5",
    "swr": "^2.5.1",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/sanitize-html": "^2.16.2",
    "dotenv": "^17.4.2",
    "eslint": "^9",
    "eslint-config-next": "16.3.3",
    "prisma": "^7.10.0",
    "shadcn": "^4.19.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "overrides": {
    "exceljs": {
      "uuid": "11.1.1"
    },
    "@prisma/config": {
      "deepmerge-ts": "8.0.2"
    },
    "prisma": {
      "mysql2": "3.24.4"
    },
    "fast-uri": "3.1.8",
    "readdir-glob": {
      "minimatch": {
        "brace-expansion": "2.1.7"
      }
    },
    "eslint": {
      "minimatch": {
        "brace-expansion": "1.1.21"
      }
    }
  }
}


---

## Assistant

_Thinking:_

Now let me verify the technical claims in the document against the codebase. Key things to check:

1. Buckets + setup script
2. Write points W1–W9
3. Read routes R1–R13
4. Worker K1–K3
5. Tests assertions
6. deploy.yml
7. attendance photo / cms media patterns
8. getPublicUrl/createSignedUrl absence
9. .gitignore /data/
10. Next.js docs convention — note the AGENTS.md says this is not the Next.js you know; app routes may differ (e.g., route handlers API). Router patterns: Next 16? package says next 16.3.8. Hmm, but the doc claims route handlers at app/api/... with `route.ts`. Let me verify structure.

Let me grep.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"getPublicUrl\\|createSignedUrl\" --include=*.ts --include=*.tsx --include=*.mjs --include=*.js app lib worker scripts components 2>/dev/null | head -20; echo \"---STORAGE FROM---\"; grep -rn \"storage\\.from\" --include=*.ts --include=*.tsx --include=*.mjs app lib worker scripts 2>/dev/null"
}
```

---STORAGE FROM---
app/actions/master-data.ts:984:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:995:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:1026:      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
app/actions/master-data.ts:1027:      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
app/actions/whatsapp.ts:190:      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
app/actions/whatsapp.ts:199:      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
app/actions/crm.ts:1851:    const storage = createAdminClient().storage.from("crm-po-designs");
app/actions/production.ts:88:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:160:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:244:      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:296:        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
app/actions/design.ts:121:    const storage = createAdminClient().storage.from(BUCKET);
app/api/whatsapp/media/[id]/route.ts:20:  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:30:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:24:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts:31:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
app/api/crm/purchase-order/[id]/pdf/route.ts:53:    const { data } = await storage.from("business-assets").download(logoPath);
app/api/crm/purchase-order/[id]/pdf/route.ts:78:            const { data } = await storage.from("crm-po-designs").download(path);
app/api/crm/purchase-order/[id]/pdf/route.ts:94:    const { data } = await storage.from("crm-po-designs").download(item.path);
app/api/crm/invoice/[id]/pdf/route.ts:89:    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/crm/invoice/[id]/pdf/route.ts:97:    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
app/api/crm/payment-transactions/[id]/proof/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/payment-transactions/[id]/kwitansi/route.ts:42:  const bucket = createAdminClient().storage.from("business-assets");
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/public/business-logo/route.ts:34:    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/master-data/business-profile/signature/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
app/api/master-data/business-profile/logo/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts:17:  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
lib/payment-proof.ts:32:  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
lib/payment-proof.ts:38:  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
worker/whatsapp.mjs:214:      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
worker/whatsapp.mjs:261:        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));
worker/whatsapp.mjs:610:      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);


**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1,200p scripts/setup-crm-storage.mjs; echo \"=====RESET=====\"; sed -n 1,200p scripts/reset-crm-storage.mjs"
}
```

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const requiredVariables = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) throw new Error(`Environment belum lengkap: ${missingVariables.join(", ")}`);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const definitions = [
  {
    id: "crm-po-designs",
    options: { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: null },
  },
  {
    id: "business-assets",
    options: { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  },
  {
    id: "whatsapp-media",
    options: { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
  },
  {
    id: "payment-proofs",
    options: { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
  },
];
const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw new Error(`Daftar bucket tidak dapat dibaca: ${listError.message}`);

for (const definition of definitions) {
  const exists = buckets.some((bucket) => bucket.id === definition.id);
  const { error } = exists
    ? await supabase.storage.updateBucket(definition.id, definition.options)
    : await supabase.storage.createBucket(definition.id, definition.options);
  if (error) throw new Error(`Bucket ${definition.id} tidak dapat disiapkan: ${error.message}`);
  console.log(`Bucket privat siap: ${definition.id}`);
}
=====RESET=====
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const requiredVariables = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length) {
  throw new Error(`Environment belum lengkap: ${missingVariables.join(", ")}`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const retiredBuckets = ["quotation-acceptance-proofs"];
const purchaseOrderBucket = "crm-po-designs";
const purchaseOrderBucketOptions = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: null,
};
const { data: buckets, error: listError } = await supabase.storage.listBuckets();

if (listError) throw new Error(`Daftar bucket tidak dapat dibaca: ${listError.message}`);

for (const bucketId of retiredBuckets) {
  if (!buckets.some((bucket) => bucket.id === bucketId)) continue;

  const { error: emptyError } = await supabase.storage.emptyBucket(bucketId);
  if (emptyError) throw new Error(`Bucket ${bucketId} tidak dapat dikosongkan: ${emptyError.message}`);

  const { error: deleteError } = await supabase.storage.deleteBucket(bucketId);
  if (deleteError) throw new Error(`Bucket ${bucketId} tidak dapat dihapus: ${deleteError.message}`);

  console.log(`Bucket lama dihapus: ${bucketId}`);
}

const existingPurchaseOrderBucket = buckets.some((bucket) => bucket.id === purchaseOrderBucket);
const { error: configureError } = existingPurchaseOrderBucket
  ? await supabase.storage.updateBucket(purchaseOrderBucket, purchaseOrderBucketOptions)
  : await supabase.storage.createBucket(purchaseOrderBucket, purchaseOrderBucketOptions);

if (configureError) throw new Error(`Bucket ${purchaseOrderBucket} tidak dapat disiapkan: ${configureError.message}`);

console.log(`Bucket privat siap: ${purchaseOrderBucket}`);
console.log("Reset storage CRM selesai.");


---

## Assistant

_Thinking:_

Good. Note the doc says payment-proofs limit 5 MB — confirmed. Doc says bucket table order; fine.

Now check the attendance photo and cms media patterns.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1,160p lib/attendance/photo.ts; echo \"=====CMS MEDIA=====\"; sed -n 1,140p lib/cms/media.ts"
}
```

import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import sharp, { type Metadata } from "sharp";

import { ATTENDANCE_MAX_PHOTO_BYTES } from "./constants.ts";
import { isValidDateKey } from "./time.ts";

const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 1280;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export function attendanceUploadDir() {
  return resolve(
    /* turbopackIgnore: true */
    process.env.ATTENDANCE_UPLOAD_DIR || join(process.cwd(), "data/attendance"),
  );
}

export class AttendancePhotoError extends Error {}

function safeSegment(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AttendancePhotoError("Data pegawai tidak valid.");
  }
  return value;
}

export function attendancePhotoRelativePath(userId: string, dateKey: string, id = randomUUID()) {
  if (!isValidDateKey(dateKey)) throw new AttendancePhotoError("Tanggal absensi tidak valid.");
  return `${safeSegment(userId)}/${dateKey.slice(0, 4)}/${dateKey.slice(5, 7)}/${safeSegment(id)}.webp`;
}

/** Validasi path relatif dari DB sebelum menyentuh filesystem. */
export function resolveAttendancePhotoPath(relativePath: string | null | undefined) {
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) return null;
  if (!relativePath.endsWith(".webp")) return null;
  const parts = relativePath.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    return null;
  }

  const root = attendanceUploadDir();
  const absolute = resolve(root, relativePath);
  if (absolute === root || !absolute.startsWith(`${root}${sep}`)) return null;
  return { relativePath, absolute };
}

export async function resolveAttendancePhoto(relativePath: string | null | undefined) {
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) return null;

  try {
    const info = await stat(/* turbopackIgnore: true */ path.absolute);
    if (!info.isFile() || info.size === 0) return null;
    return { ...path, size: info.size };
  } catch {
    return null;
  }
}

export async function readAttendancePhoto(relativePath: string | null | undefined) {
  const file = await resolveAttendancePhoto(relativePath);
  if (!file) return null;
  return { ...file, bytes: await readFile(file.absolute) };
}

export async function saveAttendancePhoto(input: {
  userId: string;
  dateKey: string;
  bytes: Buffer;
}) {
  const relativePath = attendancePhotoRelativePath(input.userId, input.dateKey);
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) throw new AttendancePhotoError("Path foto absensi tidak valid.");

  await mkdir(dirname(path.absolute), { recursive: true, mode: 0o750 });
  await writeFile(path.absolute, input.bytes, { flag: "wx", mode: 0o640 });
  return relativePath;
}

export async function deleteAttendancePhoto(relativePath: string | null | undefined) {
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) return;
  try {
    await unlink(path.absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[attendance:delete-photo]", error);
    }
  }
}

export type OptimizedAttendancePhoto = {
  bytes: Buffer;
  mimeType: "image/webp";
  size: number;
  width: number;
  height: number;
};

/**
 * Foto kamera dire-encode ulang ke WebP agar metadata EXIF (termasuk GPS dari
 * kamera) hilang dan ukuran file terkendali.
 */
export async function optimizeAttendancePhoto(file: File): Promise<OptimizedAttendancePhoto> {
  if (!(file instanceof File) || file.size === 0) {
    throw new AttendancePhotoError("Ambil foto terlebih dahulu.");
  }
  if (file.size > ATTENDANCE_MAX_PHOTO_BYTES) {
    throw new AttendancePhotoError("Ukuran foto maksimal 5 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" }).metadata();
  } catch {
    throw new AttendancePhotoError("Foto tidak dapat dibaca. Ambil ulang foto.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new AttendancePhotoError("Format foto tidak didukung. Gunakan kamera untuk mengambil foto.");
  }

  try {
    const output = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (output.data.length === 0 || output.data.length > ATTENDANCE_MAX_PHOTO_BYTES) {
      throw new AttendancePhotoError("Foto terlalu besar setelah diproses. Ambil ulang foto.");
    }

    return {
      bytes: output.data,
      mimeType: "image/webp",
      size: output.data.length,
      width: output.info.width,
      height: output.info.height,
    };
  } catch (error) {
    if (error instanceof AttendancePhotoError) throw error;
    throw new AttendancePhotoError("Foto gagal diproses. Ambil ulang foto.");
  }
}
=====CMS MEDIA=====
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import sharp, { type Metadata, type OutputInfo } from "sharp";

import type { CmsImage } from "@/lib/cms/types";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 6000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

export function uploadDir() {
  return resolve(process.env.CMS_UPLOAD_DIR || join(process.cwd(), "data/uploads"));
}

export class MediaValidationError extends Error {}

export type UploadedImage = CmsImage & { width: number; height: number };

export async function saveUploadedImage(file: File, alt = ""): Promise<UploadedImage> {
  if (!(file instanceof File) || file.size === 0) throw new MediaValidationError("Pilih file gambar terlebih dahulu.");
  if (file.size > MAX_BYTES) throw new MediaValidationError("Ukuran gambar maksimal 8 MB.");
  if (alt.length > 300) throw new MediaValidationError("Teks alternatif maksimal 300 karakter.");

  const bytes = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "warning" }).metadata();
  } catch {
    throw new MediaValidationError("File ini bukan gambar yang valid.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new MediaValidationError("Format yang didukung hanya JPG, PNG, WebP, dan AVIF.");
  }
  if (!metadata.width || !metadata.height) throw new MediaValidationError("Dimensi gambar tidak terbaca.");
  if (metadata.width > MAX_EDGE || metadata.height > MAX_EDGE) {
    throw new MediaValidationError("Dimensi gambar maksimal 6000 × 6000 piksel.");
  }

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaValidationError("Gambar gagal diproses. Coba file lain.");
  }

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${randomUUID()}.webp`;
  const relative = `${folder}/${name}`;
  const absolute = join(uploadDir(), folder, name);
  await mkdir(join(uploadDir(), folder), { recursive: true });
  await writeFile(absolute, output.data);

  return {
    src: `/media/${relative}`,
    alt: alt.trim(),
    width: output.info.width,
    height: output.info.height,
  };
}

export async function resolveMediaFile(segments: string[]) {
  if (!segments.length) return null;
  const relative = segments.join("/");
  if (relative.includes("\0") || relative.split("/").some((part) => part === ".." || part.startsWith("."))) return null;
  const root = uploadDir();
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) return null;
  const extension = extname(absolute).toLowerCase();
  if (![".webp", ".png", ".jpg", ".jpeg", ".avif"].includes(extension)) return null;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return null;
    return { absolute, size: info.size, extension };
  } catch {
    return null;
  }
}

export function mediaContentType(extension: string) {
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".avif") return "image/avif";
  return "image/webp";
}

export async function readMediaFile(absolute: string) {
  return readFile(absolute);
}


**Tool: shell**

**Input:**
```json
{
  "command": "cat .env.example; echo \"=====GITIGNORE=====\"; cat .gitignore; echo \"=====DEPLOY=====\"; ls .github/workflows; sed -n 1,240p .github/workflows/deploy.yml"
}
```

# Connect to Postgres via the shared transaction-mode pooler (IPv4-only)
DATABASE_URL=postgresql://user:password@host:5432/
# Connect to Postgres via the shared session-mode pooler (used for migrations)
DIRECT_URL=postgresql://user:password@host:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_key
BOOTSTRAP_OWNER_NAME=Nama Owner
BOOTSTRAP_OWNER_EMAIL=owner@example.com
BOOTSTRAP_OWNER_PASSWORD=
ALLOW_DEMO_DATA=false
PUBLIC_LEAD_RATE_LIMIT_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Token dari metode verifikasi tag HTML di Google Search Console
GOOGLE_SITE_VERIFICATION=
WHATSAPP_AUTH_PATH=.data/baileys-auth
WHATSAPP_TIMEZONE=Asia/Jakarta
WHATSAPP_WORKER_ID=worker-1
WHATSAPP_WORKER_SECRET=replace-with-at-least-32-random-characters
WHATSAPP_HEALTH_PORT=3001
WHATSAPP_MEDIA_BUCKET=whatsapp-media
# CMS website: simpan di volume persisten (bukan di dalam folder build)
CMS_DATA_DIR=/var/lib/askonveksi/cms
CMS_UPLOAD_DIR=/var/lib/askonveksi/uploads
# Opsional: lokasi cadangan harian (default ./data/backups)
CMS_BACKUP_DIR=/var/lib/askonveksi/backups
# Absensi: foto kamera disimpan di filesystem VPS, bukan Supabase Storage.
# Lokal default ./data/attendance. Produksi: gunakan volume persisten di luar folder build/release.
ATTENDANCE_UPLOAD_DIR=./data/attendance
=====GITIGNORE=====
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# sertifikat HTTPS development (next dev --experimental-https)
/certificates/

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*
!.env.example
!.env.broadcast-test.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# Baileys authentication state
/.data/

# Konten & gambar CMS (disimpan di disk server, bukan di repo)
/data/

.agent/
.agents/
.claude/
.codex/
.gemini/
.impeccable/
.opencode/

# Aset vendor yang dihasilkan scripts/sync-export-vendor.mjs (Web Worker export)
public/vendor/exceljs.min.js
=====DEPLOY=====
deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [production]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: production-deploy
  cancel-in-progress: false

env:
  NODE_VERSION: '24'
  KEEP_RELEASES: 5

jobs:
  build:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit production dependencies
        run: npm audit --omit=dev --audit-level=high

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm run test --if-present -- --ci

      - name: Build standalone release
        env:
          NODE_ENV: production
          NEXT_TELEMETRY_DISABLED: '1'
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${{ secrets.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY }}
        run: npm run build

      - name: Verify standalone output
        run: |
          test -d .next/standalone
          test -d .next/static
          test -f .next/standalone/server.js

      - name: Package release
        run: |
          mkdir -p deploy_package/.next deploy_package/worker
          cp -r .next/standalone/. deploy_package/
          cp -r .next/static deploy_package/.next/static
          if [ -d public ]; then cp -aT public deploy_package/public; fi
          cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs
          # Worker deps missing from the standalone trace (dotenv, baileys,
          # supabase + transitive). Copied from this same npm-ci tree so
          # versions stay identical; skips what standalone already ships.
          node scripts/collect-worker-deps.mjs deploy_package
          tar -czf release.tar.gz -C deploy_package .
          tar -tzf release.tar.gz | grep -qx './server.js'
          tar -tzf release.tar.gz | grep -qx './worker/whatsapp.mjs'
          # File-level checks: standalone dirs may be pruned, so a present
          # directory proves nothing. Fail the build here, not on the VPS.
          for f in node_modules/dotenv/package.json node_modules/@whiskeysockets/baileys/package.json node_modules/@supabase/supabase-js/package.json node_modules/ws/wrapper.mjs node_modules/pg/esm/index.mjs node_modules/pg-pool/index.js node_modules/postgres-array/index.js node_modules/.prisma/client/default.js node_modules/@prisma/client/default.js; do
            tar -tzf release.tar.gz | grep -q "^\./$f$" || { echo "Worker file missing in tarball: $f"; exit 1; }
          done

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: release
          path: release.tar.gz
          retention-days: 3

  migrate:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Apply Prisma migrations
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: npm exec prisma migrate deploy

  deploy:
    needs: migrate
    runs-on: ubuntu-latest
    environment: production
    env:
      DEPLOY_PATH: ${{ vars.DEPLOY_PATH }}
      PM2_APP_NAME: ${{ vars.PM2_APP_NAME }}
      APP_PORT: ${{ vars.APP_PORT }}
      VPS_HOST: ${{ vars.VPS_HOST }}
      VPS_USER: ${{ vars.VPS_USER }}
      VPS_PORT: ${{ vars.VPS_PORT || '22' }}
    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: release

      - name: Configure SSH
        env:
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
          VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
        run: |
          install -d -m 700 ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_ed25519
          printf '%s\n' "$VPS_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts

      - name: Set release name
        id: release
        run: echo "name=${GITHUB_SHA::12}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" >> "$GITHUB_OUTPUT"

      - name: Upload release archive
        env:
          RELEASE: ${{ steps.release.outputs.name }}
        run: |
          scp -i ~/.ssh/id_ed25519 -P "$VPS_PORT" \
            -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
            release.tar.gz "$VPS_USER@$VPS_HOST:/tmp/askonveksi-release-$RELEASE.tar.gz"

      - name: Deploy, verify, and roll back on failure
        env:
          RELEASE: ${{ steps.release.outputs.name }}
        run: |
          DEPLOY_PATH_B64=$(printf '%s' "$DEPLOY_PATH" | base64 -w0)
          PM2_APP_NAME_B64=$(printf '%s' "$PM2_APP_NAME" | base64 -w0)
          APP_PORT_B64=$(printf '%s' "$APP_PORT" | base64 -w0)
          RELEASE_B64=$(printf '%s' "$RELEASE" | base64 -w0)
          KEEP_RELEASES_B64=$(printf '%s' "$KEEP_RELEASES" | base64 -w0)
          ssh -i ~/.ssh/id_ed25519 -p "$VPS_PORT" \
            -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "DEPLOY_PATH_B64=$DEPLOY_PATH_B64 PM2_APP_NAME_B64=$PM2_APP_NAME_B64 APP_PORT_B64=$APP_PORT_B64 RELEASE_B64=$RELEASE_B64 KEEP_RELEASES_B64=$KEEP_RELEASES_B64 bash -s" <<'ENDSSH'
          set -euo pipefail

          decode() { printf '%s' "$1" | base64 --decode; }
          DEPLOY_PATH=$(decode "$DEPLOY_PATH_B64")
          PM2_APP_NAME=$(decode "$PM2_APP_NAME_B64")
          APP_PORT=$(decode "$APP_PORT_B64")
          RELEASE=$(decode "$RELEASE_B64")
          KEEP_RELEASES=$(decode "$KEEP_RELEASES_B64")

          [[ "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_PATH" != / ]] || { echo 'DEPLOY_PATH must be an absolute non-root path.'; exit 1; }
          [[ "$PM2_APP_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'PM2_APP_NAME contains invalid characters.'; exit 1; }
          [[ "$APP_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && (( APP_PORT <= 65535 )) || { echo 'APP_PORT must be valid.'; exit 1; }
          [[ "$RELEASE" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'RELEASE contains invalid characters.'; exit 1; }
          [[ "$KEEP_RELEASES" =~ ^[1-9][0-9]*$ ]] || { echo 'KEEP_RELEASES must be a positive integer.'; exit 1; }

          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          command -v pm2 >/dev/null || { echo 'PM2 is not available for the deploy user.'; exit 1; }
          command -v curl >/dev/null || { echo 'curl is not available for the deploy user.'; exit 1; }

          RELEASE_DIR="$DEPLOY_PATH/releases/$RELEASE"
          CURRENT_LINK="$DEPLOY_PATH/current"
          ARCHIVE="/tmp/askonveksi-release-$RELEASE.tar.gz"
          PREVIOUS_RELEASE=""
          if [ -L "$CURRENT_LINK" ]; then
            PREVIOUS_RELEASE=$(readlink -f "$CURRENT_LINK")
          fi

          install -d "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared"
          test -w "$DEPLOY_PATH" || { echo 'DEPLOY_PATH is not writable by the deploy user.'; exit 1; }
          test -f "$DEPLOY_PATH/shared/.env" || { echo 'Shared runtime .env is missing.'; exit 1; }
          test -f "$ARCHIVE" || { echo 'Release archive is missing.'; exit 1; }
          test ! -e "$RELEASE_DIR" || { echo 'Release directory already exists.'; exit 1; }
          mkdir "$RELEASE_DIR"
          tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
          rm -f "$ARCHIVE"
          ln -sfn "$DEPLOY_PATH/shared/.env" "$RELEASE_DIR/.env"
          # Persist Baileys auth across releases (WA session survives rollback/deploy).
          install -d "$DEPLOY_PATH/shared/.data/baileys-auth"
          ln -sfn "$DEPLOY_PATH/shared/.data" "$RELEASE_DIR/.data"

          ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
          export NODE_ENV=production PORT="$APP_PORT" HOSTNAME=127.0.0.1
          WA_PORT="$(grep -E '^WHATSAPP_HEALTH_PORT=' "$DEPLOY_PATH/shared/.env" 2>/dev/null | cut -d= -f2 | tr -d ' "' || true)"
          WA_PORT="${WA_PORT:-3001}"
          WA_APP_NAME="${PM2_APP_NAME}-wa"

          start_pm2() {
            pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
            pm2 start "$CURRENT_LINK/server.js" --name "$PM2_APP_NAME" --cwd "$CURRENT_LINK" --time --kill-timeout 10000 \
              --max-memory-restart 600M --node-args="--max-old-space-size=600"
          }

          start_wa() {
            # Worker deps ship inside the release (see Package step); the
            # dotenv check below proves the closure is complete.
            if [ ! -f "$CURRENT_LINK/worker/whatsapp.mjs" ]; then echo 'WA worker file missing, skipping.'; return 0; fi
            if [ ! -d "$CURRENT_LINK/node_modules/dotenv" ]; then echo 'Worker deps missing in release, skipping WA worker.'; return 0; fi
            pm2 delete "$WA_APP_NAME" >/dev/null 2>&1 || true
            # Cap 300M: baseline worker ~180MB; 200M membunuh tiap menit.
            # Cron 03:00 WIB: restart terjadwal sebagai backstop bocor memori
            # (wajib di sini, bukan manual — deploy me-recreate proses PM2).
            WHATSAPP_HEALTH_PORT="$WA_PORT" pm2 start "$CURRENT_LINK/worker/whatsapp.mjs" --name "$WA_APP_NAME" --cwd "$CURRENT_LINK" --time --kill-timeout 10000 \
              --max-memory-restart 300M --node-args="--max-old-space-size=280" \
              --exp-backoff-restart-delay=5000 --cron "0 3 * * *" || echo 'WA worker failed to start, continuing without it.'
          }

          start_pm2
          start_wa

          healthy=0
          for _ in $(seq 1 15); do
            if curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT" -o /dev/null; then
              healthy=1
              break
            fi
            sleep 2
          done

          if curl -fsS --max-time 5 "http://127.0.0.1:$WA_PORT/health" -o /dev/null 2>/dev/null; then


---

## Assistant

_Thinking:_

The document is mostly accurate. Let me check the rest of deploy.yml and worker. Also check the specific write points W1-W9 and read route source code to verify semantics, and test assertions.

Also, one important thing: the doc claims `payment-proofs` bucket limit 5MB but code says payment-proofs 5MB — yes.

Let me check the test assertions cited.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 240,400p .github/workflows/deploy.yml; echo \"=====COLLECT DEPS=====\"; cat scripts/collect-worker-deps.mjs"
}
```

          if curl -fsS --max-time 5 "http://127.0.0.1:$WA_PORT/health" -o /dev/null 2>/dev/null; then
            echo 'WA worker healthy.'
          else
            echo 'WA worker not healthy (optional, deploy continues).'
          fi

          if [ "$healthy" -ne 1 ]; then
            echo 'Health check failed, rolling back.'
            if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
              ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
              start_pm2
              start_wa
              pm2 save
            else
              pm2 delete "$PM2_APP_NAME" || true
              rm -f "$CURRENT_LINK"
            fi
            exit 1
          fi

          pm2 save
          find "$DEPLOY_PATH/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
            | sort -rn \
            | tail -n +$((KEEP_RELEASES + 1)) \
            | cut -d' ' -f2- \
            | xargs -r rm -rf --
          ENDSSH
=====COLLECT DEPS=====
// CI-only: copy the node_modules closure needed by worker/whatsapp.mjs
// into the deploy package. Same source tree => identical versions.
// Standalone dirs may be FILE-pruned, so trust is per-file, never per-dir:
// - package dir absent in dest -> copy whole (keeps non-imported assets
//   like .node/.wasm next to reachable files).
// - package dir present -> merge only the traced files missing in dest.
//
// Usage: node scripts/collect-worker-deps.mjs [destDir]
// Exits non-zero when a reachable import cannot be resolved.
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();
const dest = path.resolve(process.argv[2] ?? "deploy_package");
const BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));

// Optional deps loaded inside try/catch by their importers; safe to skip.
// - @opentelemetry/api: supabase-js tracing only, works without it.
// - jimp: baileys image processing, falls back to sharp (installed).
// - audio-decode: baileys voice waveforms, feature degrades without it.
// - link-preview-js: baileys link previews, feature degrades without it.
// - bufferutil, utf-8-validate: ws native perf addons, pure-JS fallback.
// - pg-native: behind PG_NATIVE flag + try/catch.
const OPTIONAL = new Set([
  "@opentelemetry/api",
  "jimp",
  "audio-decode",
  "link-preview-js",
  "bufferutil",
  "utf-8-validate",
  "pg-native",
]);
// Platform-specific native binaries probed per-platform inside try/catch
// (only the matching platform is ever installed).
const OPTIONAL_PREFIXES = ["@img/"];

function isOptional(spec) {
  if (OPTIONAL.has(spec)) return true;
  return OPTIONAL_PREFIXES.some((prefix) => spec.startsWith(prefix));
}

const warnedOptional = new Set();
function warnOptional(spec) {
  if (warnedOptional.has(spec)) return;
  warnedOptional.add(spec);
  console.warn(`optional dep skipped: ${spec}`);
}

// ESM entry of a package per its exports map (condition priority for a
// Node ESM importer). Returns an absolute path or null. Needed because
// dual packages (pg, pg-pool: esm/index.mjs vs lib/index.js) expose a
// different file to ESM importers than CJS resolution finds.
function pickImportCondition(node) {
  while (node && typeof node === "object" && !Array.isArray(node)) {
    node = node.node ?? node.import ?? node.default;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = pickImportCondition(item);
      if (hit) return hit;
    }
    return null;
  }
  return typeof node === "string" ? node : null;
}

function esmEntryOf(pkgDir) {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(path.join(pkgDir, "package.json"), "utf8"),
    );
  } catch {
    return null;
  }
  const entry = pickImportCondition(manifest.exports?.["."]);
  if (!entry) return null;
  const abs = path.normalize(path.join(pkgDir, entry));
  return abs.startsWith(pkgDir + path.sep) ? abs : null; // stay in-package
}

// Resolvers may return logical paths without CJS extension probing
// (e.g. the ESM leg for an exports-less package: `xtend/mutable`
// instead of `mutable.js`). Probe like CJS before giving up.
function probeExisting(abs) {
  const pick = (candidate) => {
    try {
      return statSync(candidate).isFile() ? candidate : null;
    } catch {
      return null;
    }
  };
  if (pick(abs)) return abs;
  for (const suffix of [
    ".js",
    ".json",
    ".node",
    "/index.js",
    "/index.mjs",
    "/index.cjs",
  ]) {
    const probed = pick(abs + suffix);
    if (probed) return probed;
  }
  return null;
}

const IMPORT_RE =
  /(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const PARSEABLE_RE = /\.(?:mjs|cjs|js)$/;

// Spans of template literals (best-effort; `}` inside nested template text
// can skew depth). Real import statements never live inside backticks, but
// doc/error text does (e.g. Prisma's constructor error message quotes
// `import ... from './generated/prisma/client'`).
function templateSpans(text) {
  const spans = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    const start = i++;
    let depth = 0;
    while (i < n) {
      const c = text[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "$" && text[i + 1] === "{") {
        depth++;
        i += 2;
        continue;
      }
      if (c === "}" && depth > 0) {
        depth--;
        i++;
        continue;
      }
      if (c === "`" && depth === 0) break;
      i++;
    }
    spans.push([start, Math.min(i, n)]);
    if (i < n) i++;
  }
  return spans;
}

function inSpans(spans, index) {
  return spans.some(([start, end]) => index >= start && index < end);
}

function specifiersOf(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  // Strip comments so words inside them are never treated as imports.
  text = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const spans = templateSpans(text);
  const out = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    if (!inSpans(spans, m.index ?? 0)) out.push(m[1]);
  }
  return out;
}

function packageDirOf(abs) {
  // Directory of the package owning abs, via the LAST node_modules segment
  // (handles packages nested inside other packages).
  const parts = abs.split(path.sep);
  const idx = parts.lastIndexOf("node_modules");
  if (idx < 0) return null;
  const rest = parts.slice(idx + 1);
  if (rest.length === 0) return null;
  const depth = rest[0].startsWith("@") ? 2 : 1;
  if (rest.length < depth) return null;
  return parts.slice(0, idx + 1 + depth).join(path.sep);
}

const entry = path.join(root, "worker", "whatsapp.mjs");
if (!existsSync(entry)) {
  console.error(`entry not found: ${entry}`);
  process.exit(1);
}

const seen = new Set();
const tracedFiles = new Set(); // reachable files under root (phase 1)
const supplementedPkgs = new Set(); // packages with ESM entry queued
const missing = [];
const queue = [entry];

while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (!PARSEABLE_RE.test(file)) continue;

  for (const spec of specifiersOf(file)) {
    if (
      spec.startsWith("node:") ||
      BUILTINS.has(spec) ||
      spec.startsWith("data:") ||
      spec === "." ||
      spec === ".."
    )
      continue;
    // CJS resolution first: reliable parent handling, incl. dot-leading
    // packages like `.prisma/...` that ESM rejects outright.
    // ESM only as fallback for import-only export conditions.
    // (import.meta.resolve is NOT run alongside: in this resolver role it
    // ignores the parent for relative specs and returns unprobed paths.)
    const resolvedHrefs = new Set();
    try {
      resolvedHrefs.add(
        pathToFileURL(createRequire(file).resolve(spec)).href,
      );
    } catch {
      try {
        resolvedHrefs.add(
          await import.meta.resolve(spec, pathToFileURL(file).href),
        );
      } catch {
        // handled by the missing check below
      }
    }
    if (resolvedHrefs.size === 0) {
      if (isOptional(spec)) {
        warnOptional(spec);
        continue;
      }
      missing.push(`${path.relative(root, file)} -> ${spec}`);
      continue;
    }
    for (const resolved of resolvedHrefs) {
      if (!resolved.startsWith("file://")) continue;
      const abs = probeExisting(fileURLToPath(resolved));
      if (!abs) {
        if (isOptional(spec)) {
          warnOptional(spec);
          continue;
        }
        missing.push(
          `${path.relative(root, file)} -> ${spec} (resolved, not on disk)`,
        );
        continue;
      }
      queue.push(abs);
      if (abs.startsWith(root + path.sep)) tracedFiles.add(abs);
      // Supplement the package's ESM entry (see esmEntryOf): the file the
      // worker hits as an ESM importer may differ from the CJS walk.
      const pkgDir = packageDirOf(abs);
      if (pkgDir && !supplementedPkgs.has(pkgDir)) {
        supplementedPkgs.add(pkgDir);
        const esmEntry = esmEntryOf(pkgDir);
        if (esmEntry && existsSync(esmEntry)) {
          queue.push(esmEntry);
          if (esmEntry.startsWith(root + path.sep)) tracedFiles.add(esmEntry);
        }
      }
    }
  }
}

// Phase 2: group traced files by owning package, then copy hybrid.
const byPkg = new Map();
for (const file of tracedFiles) {
  const pkgDir = packageDirOf(file);
  if (!pkgDir) {
    if (process.env.WORKER_DEPS_DEBUG)
      console.warn(`outside node_modules: ${file}`);
    continue;
  }
  if (!byPkg.has(pkgDir)) byPkg.set(pkgDir, new Set());
  byPkg.get(pkgDir).add(file);
}

let copiedPkgs = 0;
let mergedFiles = 0;
for (const [pkgDir, files] of byPkg) {
  const out = path.join(dest, path.relative(root, pkgDir));
  if (!existsSync(out)) {
    mkdirSync(path.dirname(out), { recursive: true });
    cpSync(pkgDir, out, { recursive: true, dereference: true });
    copiedPkgs++;
    continue;
  }
  for (const file of files) {
    const target = path.join(dest, path.relative(root, file));
    if (existsSync(target)) continue;
    // Guard: never crash copyFileSync on a non-file (dir, socket, ghost).
    let ok = false;
    try {
      ok = statSync(file).isFile();
    } catch {
      ok = false;
    }
    if (!ok) {
      console.warn(`skipped non-file: ${path.relative(root, file)}`);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(file, target);
    mergedFiles++;
  }
  // package.json carries name/version/exports; without it subpath
  // resolution inside a merged dir fails at runtime.
  const manifestOut = path.join(out, "package.json");
  if (!existsSync(manifestOut) && existsSync(path.join(pkgDir, "package.json"))) {
    copyFileSync(path.join(pkgDir, "package.json"), manifestOut);
    mergedFiles++;
  }
  copiedPkgs++;
}

if (missing.length > 0) {
  console.error("unresolvable worker imports:");
  for (const line of missing) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `worker deps: ${byPkg.size} packages traced, ${copiedPkgs} ensured, ${mergedFiles} files merged into pruned dirs`,
);


**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1030,1085p tests/crm-validation.test.mjs; echo \"=====1620=====\"; sed -n 1600,1650p tests/crm-validation.test.mjs; echo \"=====BP TEST=====\"; sed -n 40,80p tests/business-profile.test.mjs; echo \"=====TESTS LIST=====\"; ls tests"
}
```

  assert.match(pageSource, /item\.deposit \? formatCurrency\(item\.deposit\) : "-"/);
  assert.match(pageSource, /const totalDeposit = sumMoney\(data\.items\.map\(\(item\) => item\.deposit\)\)/);
  assert.match(pageSource, /formatCurrency\(totalDeposit\)/);
  // Ekspor XLSX menyertakan kolom Deposit dengan nilai "-" bila nol; header Margin memakai "%" seperti tabel.
  assert.ok(exportSource.indexOf('header: "Margin %"') < exportSource.indexOf('header: "Deposit"') && exportSource.indexOf('header: "Deposit"') < exportSource.indexOf('header: "DP"') && exportSource.indexOf('header: "DP"') < exportSource.indexOf('header: "Lunas"'), "export: Margin %, Deposit, DP, Lunas berurutan");
  assert.match(exportSource, /item\.deposit \? Number\(item\.deposit\) : null/);
  // Mutasi pembayaran membedakan Termin / Deposit / Pembayaran awal untuk ditampilkan.
  assert.match(dataSource, /transactionKind: item\.paymentTermId \? "Termin" : item\.isDeposit \? "Deposit" : "Pembayaran awal"/);
});

test("flash message tidak membocorkan isi notifikasi ke URL", async () => {
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");
  assert.doesNotMatch(responseSource, /encodeURIComponent\(message\)/);
  assert.match(responseSource, /httpOnly:\s*true/);
  assert.match(responseSource, /sameSite:\s*"lax"/);
  assert.match(responseSource, /Proses menyimpan data melewati batas waktu/);
  assert.doesNotMatch(responseSource, /Proses menyimpan Deal melewati batas waktu/);
});

test("revisi CRM membuat PO, invoice, pembayaran, dan bucket desain privat", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260902000000_crm_purchase_order_invoice/migration.sql", import.meta.url), "utf8");
  const storageScript = await readFile(new URL("../scripts/reset-crm-storage.mjs", import.meta.url), "utf8");
  const designActionSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
  assert.match(sql, /CREATE TYPE "OpportunityStage" AS ENUM \('LEAD_BARU', 'FOLLOW_UP', 'NEGOSIASI', 'DEAL', 'LOST'\)/);
  assert.match(sql, /CREATE TABLE "PurchaseOrder"/);
  assert.match(sql, /CREATE TABLE "Invoice"/);
  assert.match(sql, /CREATE TABLE "DealPayment"/);
  assert.match(sql, /CREATE TABLE "PaymentTerm"/);
  assert.match(sql, /PurchaseOrder_one_agreed_per_opportunity/);
  assert.match(sql, /Invoice_one_issued_per_opportunity/);
  assert.match(sql, /BEGIN;[\s\S]+COMMIT;/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "Opportunity_lost_reason_required"/);
  assert.doesNotMatch(sql, /DELETE FROM storage\./);
  assert.doesNotMatch(sql, /INSERT INTO storage\./);
  assert.match(storageScript, /emptyBucket\(bucketId\)/);
  assert.match(storageScript, /deleteBucket\(bucketId\)/);
  assert.match(storageScript, /crm-po-designs/);
  assert.match(storageScript, /public: false/);
  assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
  assert.match(sql, /REVOKE ALL ON TABLE "PurchaseOrder"[\s\S]+FROM anon, authenticated/);
  // Halaman persetujuan desain dihapus: unggahan langsung menjadi acuan produksi.
  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
  assert.match(designActionSource, /storage\.upload\(attachment\.path/);
  assert.doesNotMatch(designActionSource, /reviewDesignRevisionAction|APPROVED/);
  const productionActionSource = await readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionActionSource, /status: "APPROVED"/);
  assert.doesNotMatch(productionActionSource, /disetujui tidak ditemukan/);
});

test("upload desain menolak file lebih dari 5 MB sebelum dikirim", async () => {
  const actionSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(actionSource, /MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(actionSource, /Setiap file desain maksimal 5 MB/);
  assert.match(configSource, /bodySizeLimit: "28mb"/);
});
=====1620=====
  assert.equal(purchaseOrderDepositSchema.safeParse(depositInput).success, true);
  assert.equal(purchaseOrderDepositSchema.safeParse({ ...depositInput, amount: "0" }).success, false);
});

test("R1/R2: dialog deposit pakai useActionState, error inline, dan bukti punya route sendiri", async () => {
  const depositFormSource = await readFile(new URL("../components/crm/purchase-order-deposit-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/deposit/proof/route.ts", import.meta.url), "utf8");
  const detailSource = await readFile(new URL("../components/crm/purchase-order-detail.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");

  // Gagal simpan → error tampil inline & dialog tetap terbuka; tidak ada tutup prematur saat submit.
  assert.match(depositFormSource, /useActionState\(async \(prevState/);
  assert.match(depositFormSource, /await recordPurchaseOrderDepositAction\(prevState, formData\)/);
  assert.doesNotMatch(depositFormSource, /onSubmit=\{\(\) => setOpen\(false\)\}/);
  assert.match(depositFormSource, /state\.error/);
  assert.match(depositFormSource, /Deposit belum tersimpan/);
  // Field memakai state terkendali — defaultValue yang berubah antar render memicu warning Base UI.
  assert.doesNotMatch(depositFormSource, /defaultValue=/);
  // Tombol Lihat Deposit di sebelah kiri Ubah Deposit; isi pratinjau mengikuti data terbaru.
  assert.match(depositFormSource, /Lihat Deposit/);
  assert.match(depositFormSource, /Bukti terbaru sesuai Isi \/ Ubah Deposit/);
  // Action tidak redirect: sukses/gagal dikembalikan sebagai state form.
  assert.match(actionSource, /export async function recordPurchaseOrderDepositAction\(_prevState: CrmActionState, formData: FormData\): Promise<CrmActionState>/);
  // Route bukti deposit membaca PurchaseOrderDeposit dari bucket pembayaran yang sama.
  assert.match(routeSource, /purchaseOrderDeposit\.findUnique/);
  assert.match(routeSource, /PAYMENT_PROOF_BUCKET/);
  assert.match(routeSource, /CRM_VIEW_ROLES/);
  // Detail PO menampilkan pratinjau bukti + mime type ikut ditransfer ke client.
  assert.match(detailSource, /deposit\/proof/);
  assert.match(detailSource, /PaymentProofPreview/);
  assert.match(pageSource, /proofMimeType: poDraft\.deposit\.proofMimeType/);
  assert.match(dataSource, /proofFileName: true, proofMimeType: true, paymentMethod/);
});

test("R9: termin/DP terlambat diwarnai merah utuh di detail invoice", async () => {
  const invoiceDetail = await readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8");

  // Helper telat memakai ambang hari yang sama dengan peringatan deadline yang sudah ada.
  assert.match(invoiceDetail, /function isOverdue\(dueAt: Date \| string \| null \| undefined, unpaid: boolean\)/);
  assert.match(invoiceDetail, /overdueRowClass = "border-destructive bg-destructive\/10"/);
  // Baris termin (sudah deal) dan jadwal (belum deal) memakai badge Terlambat + latar merah.
  assert.match(invoiceDetail, /overdue \? "Terlambat" : "Belum dibayar"/);
  assert.match(invoiceDetail, /termOverdue \? "Terlambat" : "Belum dibayar"/);
  assert.match(invoiceDetail, /variant=\{overdue \? "destructive" : "secondary"\}/);
  assert.match(invoiceDetail, /tone=\{overdue \? "destructive" : undefined\}/);
  // Baris awal di PaymentSummary ikut aturan serupa lewat prop overdue.
  assert.match(invoiceDetail, /overdue=\{initialOverdue\}/);
});

=====BP TEST=====
  for (const field of ["bankName", "bankAccountNumber", "bankAccountHolder"]) {
    assert.doesNotMatch(pageSource, new RegExp(`name="${field}"`), `form tidak boleh punya input ${field}`);
    assert.ok(!block(validationSource, "export const businessProfileSchema").includes(field), `businessProfileSchema tidak boleh memuat ${field}`);
    assert.ok(!block(actionSource, "export async function updateBusinessProfileAction").includes(`${field}: formData.get(`), `action tidak boleh membaca ${field}`);
  }
  assert.ok(!block(schemaSource, "model BusinessProfile").includes("bankName"), "kolom rekening dihapus dari skema");
});

test("skema dan migrasi memuat gambar tanda tangan", () => {
  const profile = block(schemaSource, "model BusinessProfile");
  assert.match(profile, /signaturePath\s+String\?\s+@db\.VarChar\(500\)/);
  assert.match(block(schemaSource, "model Invoice"), /snapshotSignaturePath\s+String\?/);
  assert.match(migrationSource, /ADD COLUMN "signaturePath" VARCHAR\(500\)/);
  assert.match(migrationSource, /ADD COLUMN "snapshotSignaturePath" VARCHAR\(500\)/);
  assert.match(migrationSource, /DROP COLUMN "bankAccountHolder"/);
});

test("unggah gambar tanda tangan divalidasi dan disimpan ke bucket privat", () => {
  const action = block(actionSource, "export async function updateBusinessProfileAction");
  assert.match(action, /readBusinessImage\(signature, "Gambar tanda tangan"\)/);
  assert.match(action, /business\/signature-\$\{randomUUID\(\)\}/);
  assert.match(action, /removeSignature/);
  const helper = block(actionSource, "async function readBusinessImage");
  assert.match(helper, /2 \* 1024 \* 1024/, "batas 2 MB ikut diterapkan ke gambar tanda tangan");
  assert.match(helper, /0x89, 0x50, 0x4e, 0x47/, "magic bytes PNG diperiksa");
  assert.match(pageSource, /name="signature" type="file"/);
  assert.match(pageSource, /api\/master-data\/business-profile\/signature/);
  assert.match(signatureRouteSource, /business-assets/);
});

test("snapshot invoice menyimpan gambar tanda tangan dan tidak lagi menulis rekening", () => {
  assert.equal(crmActionSource.match(/snapshotSignaturePath: business\?\.signaturePath/g)?.length, 2, "dipakai saat invoice dibuat dan dikunci");
  assert.ok(!crmActionSource.includes("snapshotBankName: business?.bankName"), "perekaman rekening dari profil dihentikan");
});

test("PDF invoice mengikuti template: tanpa blok rekening, dengan gambar tanda tangan", () => {
  const route = invoiceRouteSource;
  assert.match(route, /snapshotSignaturePath: true/);
  assert.match(route, /paymentMethod\.findMany\(\{\s*where: \{ isActive: true \}/s, "hanya metode pembayaran aktif");
  assert.match(route, /\{ logo: logoBytes, signature: signatureBytes, paymentMethods, settingPoints \}/);
  assert.ok(!route.includes("profile?.bankName"), "tidak ada lagi fallback rekening dari profil");
=====TESTS LIST=====
analysis-workbook.test.mjs
attendance-report.test.mjs
attendance-storage.test.mjs
attendance-time.test.mjs
attendance-validation.test.mjs
audit-log.test.mjs
broadcast-follow-up.test.mjs
broadcast-test.test.mjs
business-profile.test.mjs
campaign-recipients.test.mjs
carousel.test.mjs
cms-media.test.mjs
cms-paths.test.mjs
cms-sanitize.test.mjs
cms-schema.test.mjs
cms-store.test.mjs
contact.test.mjs
crm-validation.test.mjs
dashboard-documents.test.mjs
document-list-filters.test.mjs
export-datasets.test.mjs
finance-expense.test.mjs
finance-workbook.test.mjs
helpers
invoice-calculation.test.mjs
invoice-settings.test.mjs
money-input-format.test.mjs
product-category-order.test.mjs
production-design-detail.test.mjs
production-view-design-images.test.mjs
production-workflow.test.mjs
seo.test.mjs
whatsapp-core.test.mjs
whatsapp-health.test.mjs
whatsapp-messages.test.mjs


---

## Assistant

_Thinking:_

I found a discrepancy: the test at tests/crm-validation.test.mjs reads `../scripts/reset-crm-storage.mjs` and asserts `/crm-po-designs/` (line ~1050). The doc says test `storageScript` asserts `/crm-po-designs/` — that assertion is about the reset script, not the setup script. Doc says "storageScript mengandung `/crm-po-designs/`" — accurate. But crucially, this assertion does NOT break when design.ts changes, because it's about reset-crm-storage.mjs which is unchanged. Only `assert.match(designActionSource, /storage\.from\(BUCKET\)/)` breaks. Hmm, actually the test file also would break since it reads designActionSource. So the doc's statement is roughly right but slightly imprecise. Also line numbers: the test is at ~1049-1071 — accurate.

Second: `tests/crm-validation.test.mjs` line ~1627 asserts routeSource matches /PAYMENT_PROOF_BUCKET/ AND this is the route import from lib/payment-proof.ts. If we keep exporting PAYMENT_PROOF_BUCKET, it stays. Good.

Third: The doc says `tests/crm-validation.test.mjs` ~L1049-1071 storageScript assertion will break. Actually the storageScript assertion remains true because reset script is unchanged. Only designActionSource assertion breaks. Minor.

Also note `business-profile.test.mjs` asserts block(action, ...) matches `/business\/signature-\$\{randomUUID\(\)\}/` — if we refactor master-data to use erpPut, the path building likely stays. And signatureRouteSource matches `/business-assets/` — if we replace with BUSINESS_ASSETS_BUCKET constant, the literal "business-assets" string will move to erp-storage.ts and the route source will no longer contain it → breaks. Doc says that. Fine.

Now check the write sites and read routes in more detail. Let me read design.ts, production.ts, payment-proof.ts, whatsapp worker relevant sections, and a few routes (esp. PDF PO, invoice, kwitansi, public business-logo).

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 90,190p app/actions/design.ts; echo \"=====PRODUCTION=====\"; sed -n 60,330p app/actions/production.ts"
}
```

            status: true,
            opportunityId: true,
            productName: true,
            // PO yang checkbox Deposit-nya dicentang baru boleh diunggah setelah depositnya dibayar.
            depositRequired: true,
            deposit: { select: { id: true } },
            items: { orderBy: { position: "asc" }, select: { id: true, name: true } },
          },
        },
      },
    });
    if (!task) throw new UserFacingError("Tugas desain tidak ditemukan.");
    if (task.purchaseOrder.status !== "DRAFT") throw new UserFacingError("Desain PO yang sudah disepakati tidak dapat diubah.");
    // DEVELOPER/OWNER tetap bisa mengunggah walau deposit belum dibayar (AGENTS.md).
    assertDepositSettled(task.purchaseOrder, actor.role);
    // PO lama tanpa baris produk memakai satu produk implisit dengan itemId kosong.
    const designItems = task.purchaseOrder.items.length
      ? task.purchaseOrder.items
      : [{ id: "", name: task.purchaseOrder.productName }];
    const latest = latestRevisionByItem(task.revisions);

    const uploads: Array<{ itemId: string; itemName: string; notes: string | null; attachments: Awaited<ReturnType<typeof prepareAttachments>> }> = [];
    for (const item of designItems) {
      const files = uploadedFiles(formData, item.id);
      if (!files.length) continue;
      if (files.length > MAX_FILES) throw new UserFacingError(`Maksimal lima file setiap versi desain ${item.name}.`);
      if ((latest.get(item.id) ?? 0) + 1 > MAX_REVISIONS) throw new UserFacingError(`Batas 4 versi desain ${item.name} sudah tercapai.`);
      uploads.push({ itemId: item.id, itemName: item.name, notes: revisionNotes(formData, item.id), attachments: await prepareAttachments(files, task.id) });
    }
    if (!uploads.length) throw new UserFacingError("Pilih minimal satu file desain.");

    const storage = createAdminClient().storage.from(BUCKET);
    const uploaded: string[] = [];
    let opportunityId: string;
    try {
      await Promise.all(uploads.flatMap((upload) => upload.attachments).map(async (attachment) => {
        const { error } = await storage.upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
        if (error) {
          console.error("Gagal mengunggah file desain PO.", { path: attachment.path, sizeBytes: attachment.bytes.length, status: error.status, statusCode: error.statusCode, message: error.message });
          throw new UserFacingError("File desain belum dapat disimpan.");
        }
        uploaded.push(attachment.path);
      }));

      opportunityId = await prisma.$transaction(async (tx) => {
        const current = await tx.designTask.findUnique({
          where: { id: task.id },
          select: {
            id: true,
            revisions: { select: { itemId: true, revision: true } },
            purchaseOrder: { select: { status: true, opportunityId: true, depositRequired: true, deposit: { select: { id: true } } } },
          },
        });
        if (!current) throw new UserFacingError("Tugas desain tidak ditemukan.");
        if (current.purchaseOrder.status !== "DRAFT") throw new UserFacingError("Desain PO yang sudah disepakati tidak dapat diubah.");
        assertDepositSettled(current.purchaseOrder, actor.role);
        const currentLatest = latestRevisionByItem(current.revisions);
        for (const upload of uploads) {
          const revision = (currentLatest.get(upload.itemId) ?? 0) + 1;
          if (revision > MAX_REVISIONS) throw new UserFacingError(`Batas 4 versi desain ${upload.itemName} sudah tercapai.`);
          const created = await tx.designRevision.create({
            data: {
              designTaskId: current.id,
              itemId: upload.itemId,
              revision,
              notes: upload.notes,
              createdById: actor.id,
              attachments: { create: upload.attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ path, originalName, contentType, sizeBytes })) },
            },
          });
          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              entityType: "DesignRevision",
              entityId: created.id,
              action: "DESIGN_REVISION_UPLOADED",
              changedFields: ["revision", "notes", "attachments"],
              metadata: { designTaskId: current.id, itemId: upload.itemId, itemName: upload.itemName, revision, fileCount: upload.attachments.length },
            },
          });
        }
        return current.purchaseOrder.opportunityId;
      }, DESIGN_TRANSACTION_OPTIONS);

      revalidatePath("/crm");
      revalidatePath("/crm/purchase-orders");
      revalidateTag("purchase-orders", { expire: 0 });
      revalidatePath(`/crm/peluang/${opportunityId}`);
    } catch (error) {
      if (uploaded.length) await storage.remove(uploaded);
      throw error;
    }

    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", `Versi desain ${uploads.map((upload) => upload.itemName).join(", ")} berhasil diunggah.`);
  });
}
=====PRODUCTION=====
    if (sniffImageContentType(bytes) !== "image/png") throw new UserFacingError("Isi file desain tidak valid.");

    const target = await getPrismaClient().productionWorkOrder.findFirst({
      where: { id: parsed.data.workOrderId, status: "ACTIVE" },
      select: {
        id: true,
        designCompletedAt: true,
        salesOrder: {
          select: {
            purchaseOrder: {
              select: {
                designTask: {
                  select: {
                    revisions: {
                      orderBy: { revision: "desc" },
                      select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, path: true, originalPath: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
    if (!attachment.originalPath) {
      const snapshot = await storage.exists(originalPath);
      if (snapshot.error && ![400, 404].includes(snapshot.error.status ?? 0)) {
        console.error("Gagal memeriksa salinan desain awal.", { status: snapshot.error.status, statusCode: snapshot.error.statusCode });
        throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
      }
      if (!snapshot.data) {
        const { data: original, error: originalError } = await storage.download(attachment.path);
        if (originalError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
        const originalBytes = new Uint8Array(await original.arrayBuffer());
        // Jenis gambar disesuaikan agar pratinjau (nosniff) tidak menolak JPEG yang dilabeli PNG.
        const { error: copyError } = await storage.upload(originalPath, originalBytes, { contentType: sniffImageContentType(originalBytes) ?? "image/png", upsert: false });
        if (copyError && !(await storage.exists(originalPath)).data) {
          console.error("Gagal menyimpan salinan desain awal.", { status: copyError.status, statusCode: copyError.statusCode });
          throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
        }
      }
    }
    const { error } = await storage.upload(attachment.path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new UserFacingError("Gambar desain belum dapat disimpan.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { contentType: "image/png", sizeBytes: bytes.length, originalPath, annotations: annotations.data } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_VERSION_SAVED", ["annotations"], { attachmentId: attachment.id });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    revalidatePath("/detail-desain");
    revalidatePath(`/crm/purchase-orders`);
    return flashMessagePath(fallback, "notice", "Versi desain disimpan. Konfirmasikan untuk memasukkannya ke Produksi.");
  });
}

export async function overwriteProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh memakai aksi ini.
    const actor = await requireDeveloperActor();
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    const file = formData.get("design");
    if (!parsed.success || !(file instanceof File)) throw new UserFacingError("Desain yang diunggah tidak valid.");
    if (!file.size || file.size > MAX_DESIGN_BYTES) throw new UserFacingError("File desain maksimal 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = designImageContentType(file.name, bytes);
    if (!contentType) throw new UserFacingError(designImageRejection(file.name));

    const target = await getPrismaClient().productionWorkOrder.findFirst({
      where: { id: parsed.data.workOrderId, status: "ACTIVE" },
      select: {
        id: true,
        designCompletedAt: true,
        salesOrder: {
          select: {
            purchaseOrder: {
              select: {
                designTask: {
                  select: {
                    revisions: {
                      orderBy: { revision: "desc" },
                      select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, path: true, originalPath: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diganti.");

    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
    const folder = attachment.path.includes("/") ? attachment.path.slice(0, attachment.path.lastIndexOf("/")) : "design";
    const nextPath = `${folder}/${randomUUID()}.${designImageExtensionFor(contentType)}`;
    const { error: uploadError } = await storage.upload(nextPath, bytes, { contentType, upsert: false });
    if (uploadError) throw new UserFacingError("File desain belum dapat disimpan.");

    // Kanvas anotasi mode edit dan "Reset perubahan" sama-sama membaca originalPath,
    // sehingga byte desain pengganti harus ditulis juga ke salinan aslinya. Kalau hanya
    // path dan originalName yang diperbarui, nama file berganti tapi gambar tetap lama.
    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
    const { error: snapshotError } = await storage.upload(originalPath, bytes, { contentType, upsert: true });
    if (snapshotError) {
      await storage.remove([nextPath]);
      console.error("Gagal menyalin desain pengganti ke salinan aslinya.", { status: snapshotError.status, statusCode: snapshotError.statusCode });
      throw new UserFacingError("File desain belum dapat disimpan.");
    }

    try {
      await getPrismaClient().$transaction(async (tx) => {
        await tx.designAttachment.update({
          where: { id: attachment.id },
          data: {
            path: nextPath,
            contentType,
            sizeBytes: bytes.length,
            originalName: file.name.slice(0, 255),
            originalPath,
            annotations: Prisma.JsonNull,
          },
        });
        await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_REPLACED", ["path", "contentType", "sizeBytes", "originalName", "originalPath", "annotations"], { attachmentId: attachment.id, previousPath: attachment.path, nextPath });
      }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    } catch (error) {
      await storage.remove([nextPath]);
      throw error;
    }

    if (attachment.path !== nextPath) {
      const { error: removeError } = await storage.remove([attachment.path]);
      if (removeError) console.error("Gagal menghapus file desain lama.", { status: removeError.status, statusCode: removeError.statusCode });
    }
    revalidatePath("/detail-desain");
    revalidatePath(`/detail-desain/${target.id}`);
    revalidatePath("/crm/purchase-orders");
    return flashMessagePath(fallback, "notice", "Desain berhasil diganti dan file desain lama sudah dihapus.");
  });
}

export async function resetProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh memakai aksi ini.
    const actor = await requireDeveloperActor();
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const target = await getPrismaClient().productionWorkOrder.findFirst({
      where: { id: parsed.data.workOrderId, status: "ACTIVE" },
      select: {
        id: true,
        designCompletedAt: true,
        salesOrder: {
          select: {
            purchaseOrder: {
              select: {
                designTask: {
                  select: {
                    revisions: {
                      orderBy: { revision: "desc" },
                      select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, path: true, originalPath: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    let originalSize: number | undefined;
    let restoredContentType: "image/png" | "image/jpeg" | undefined;
    if (attachment.originalPath) {
      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
      const { data: original, error: downloadError } = await storage.download(attachment.originalPath);
      if (downloadError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
      const originalBytes = new Uint8Array(await original.arrayBuffer());
      restoredContentType = sniffImageContentType(originalBytes) ?? "image/png";
      const { error: uploadError } = await storage.upload(attachment.path, originalBytes, { contentType: restoredContentType, upsert: true });
      if (uploadError) throw new UserFacingError("Desain awal belum dapat dipulihkan.");
      originalSize = originalBytes.length;
    }
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { annotations: Prisma.JsonNull, ...(restoredContentType === undefined ? {} : { contentType: restoredContentType, sizeBytes: originalSize }) } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_RESET", ["annotations"], { attachmentId: attachment.id });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    revalidatePath("/detail-desain");
    revalidatePath("/crm/purchase-orders");
    return flashMessagePath(fallback, "notice", "Perubahan desain dikembalikan ke desain awal.");
  });
}

export async function sendProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh memakai aksi ini.
    const actor = await requireDeveloperActor();
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const order = await getPrismaClient().productionWorkOrder.findUnique({
      where: { id: parsed.data.workOrderId },
      select: {
        id: true,
        designCompletedAt: true,
        status: true,
        salesOrder: { select: {
          purchaseOrder: { select: {
            designTask: { select: {
              revisions: {
                orderBy: { revision: "desc" },
                select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, annotations: true, originalPath: true } } },
              },
            } },
          } },
        } },
      },
    });
    const attachment = order?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!order || !attachment || order.status !== "ACTIVE" || order.designCompletedAt || !designAnnotationsSchema.safeParse(attachment.annotations).success) throw new UserFacingError("Simpan versi desain terlebih dahulu sebelum memasukkannya ke Produksi.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productionWorkOrder.update({ where: { id: order.id }, data: { designCompletedAt: new Date() } });
      await productionAudit(tx, actor.id, order.id, "PRODUCTION_DESIGN_SENT", ["designCompletedAt"], { attachmentId: parsed.data.attachmentId });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    if (attachment.originalPath) {
      try {
        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
        if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
        else {
          try { await getPrismaClient().designAttachment.update({ where: { id: attachment.id }, data: { originalPath: null } }); }
          catch { console.error("Gambar asli desain sudah dihapus, tetapi status penyimpanannya belum diperbarui."); }
        }
      } catch { console.error("Gagal menghapus gambar asli desain setelah masuk Produksi."); }
    }
    revalidatePath("/detail-desain");
    revalidateProductionBoard();
    return flashMessagePath("/detail-desain", "notice", "Work Order masuk ke kanban Produksi.");
  });
}

// Perpindahan tahap berjalan di atas pooler Supabase yang bisa lambat. Default Prisma
// (maxWait 2s / timeout 5s) sering berakhir P2028 "melewati batas waktu" di kanban,
// jadi anggaran transaksi dinaikkan mengikuti pola `DEAL_TRANSACTION_OPTIONS` di crm.ts.
const MOVE_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

// Transaksi tulis kecil lain (2-3 query berurutan) juga bisa P2028 di pooler
// yang lambat; diberi anggaran yang sama tanpa mengubah isolation level.
const PRODUCTION_WRITE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

async function productionAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  workOrderId: string,
  action: string,


**Tool: shell**

**Input:**
```json
{
  "command": "cat lib/payment-proof.ts; echo \"=====WA ACTION=====\"; sed -n 150,215p app/actions/whatsapp.ts"
}
```

import "server-only";

import { randomUUID } from "node:crypto";

import { UserFacingError } from "@/lib/actions/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const types = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PaymentProof = { proofPath: string; proofFileName: string; proofMimeType: string; proofSize: number };

function detectedType(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG") return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function proofRequired(methodName: string) { return methodName === "QRIS" || methodName.startsWith("BANK"); }

export async function uploadPaymentProof(value: FormDataEntryValue | null, owner: string): Promise<PaymentProof | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > PAYMENT_PROOF_MAX_BYTES) throw new UserFacingError("Bukti pembayaran maksimal 5 MB.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  const mime = detectedType(bytes);
  if (!mime || !types.has(value.type) || value.type !== mime) throw new UserFacingError("Bukti harus PDF, JPEG, PNG, atau WebP yang valid.");
  const extension = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
  const proofPath = `${owner}/${randomUUID()}.${extension}`;
  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
  if (error) throw new UserFacingError("Bukti tidak dapat diunggah.");
  return { proofPath, proofFileName: value.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || `bukti.${extension}`, proofMimeType: mime, proofSize: value.size };
}

export async function deletePaymentProof(path: string | null | undefined) {
  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
}
=====WA ACTION=====
      const template = await tx.whatsAppTemplate.findUnique({ where: { id: parsed.data }, select: { id: true, triggerType: true } });
      if (!template) throw new UserFacingError("Template tidak ditemukan.");
      if (isActive && template.triggerType !== "MANUAL") {
        await tx.whatsAppTemplate.updateMany({
          where: { triggerType: template.triggerType, isActive: true, id: { not: template.id } },
          data: { isActive: false, updatedById: actor.id, version: { increment: 1 } },
        });
      }
      const updated = await tx.whatsAppTemplate.updateMany({
        where: { id: template.id, version },
        data: { isActive, updatedById: actor.id, version: { increment: 1 } },
      });
      if (!updated.count) throw new UserFacingError("Template sudah berubah. Muat ulang lalu coba lagi.");
    });
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/templates", "notice", "Status template diperbarui.");
  });
}

export async function sendWhatsAppMessageAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const fallback = conversationId ? `/whatsapp?conversation=${encodeURIComponent(conversationId)}` : "/whatsapp";
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor();
    const text = String(formData.get("text") ?? "").trim();
    const templateId = String(formData.get("templateId") ?? "") || undefined;
    const file = formData.get("attachment");
    if ((!text && !templateId && !(file instanceof File && file.size)) || text.length > 4000) throw new UserFacingError("Isi pesan, pilih template, atau pilih lampiran.");
    let attachment: { path: string; mimeType: string; fileName: string; sizeBytes: number; kind: "IMAGE" | "DOCUMENT" } | undefined;
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024) throw new UserFacingError("Lampiran maksimal 10 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      const isWebp = new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      const mimeType = isPdf ? "application/pdf" : isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
      if (!mimeType) throw new UserFacingError("Lampiran harus berupa PDF, JPG, PNG, atau WebP yang valid.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `lampiran-${randomUUID()}`;
      const path = `outbound/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
      if (result.error) throw new UserFacingError("Lampiran belum dapat disimpan.");
      attachment = { path, mimeType, fileName: safeName, sizeBytes: file.size, kind: mimeType.startsWith("image/") ? "IMAGE" : "DOCUMENT" };
    }
    try {
      const resultId = await enqueueManualWhatsAppMessage({ actor, conversationId, text, attachment, templateId });
      refreshWhatsApp();
      return flashMessagePath(`/whatsapp?conversation=${resultId}`, "notice", "Pesan dijadwalkan untuk dikirim.");
    } catch (error) {
      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
      throw error;
    }
  });
}

export async function openCustomerWhatsAppAction(formData: FormData) {
  return runRedirectingAction("/whatsapp", async () => {
    const actor = await requireActor();
    const conversation = await ensureCustomerWhatsAppConversation(actor, String(formData.get("customerId") ?? ""));
    return `/whatsapp?conversation=${conversation.id}`;
  });
}

export async function sendInvoiceWhatsAppAction(formData: FormData) {
  return runRedirectingAction("/crm/invoices", async () => {
    const actor = await requireActor();


---

## Assistant

_Thinking:_

Important nuance found: W2/W3 use `storage.exists()` and Supabase download returns a Blob; wrapper erpGet returns Buffer. Doc says wrapper returns Buffer, so call sites must change from `await data.arrayBuffer()` to buffer directly. That's fine but needs mention. The doc says "Bentuk hasil sengaja meniru supabase-js { data, error } agar panggilan di call site minim diubah" — but data type differs (Buffer vs Blob). Call sites that do `await data.arrayBuffer()` need changes. The doc says port anyway. Not a big deal, but worth noting.

Another important nuance: `storage.exists()` error status 400/404 handling in W2. The wrapper's erpExists must mimic that. Doc includes erpExists but doesn't detail error semantics. Also note Supabase `exists` returns error for invalid path; local returns false. Fine.

Now check crm.ts penjahit section and master-data.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1780,1900p app/actions/crm.ts; echo \"=====MASTER DATA=====\"; sed -n 940,1040p app/actions/master-data.ts"
}
```

    revalidatePath(`/crm/peluang/${opportunityId}`);
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

/**
 * Sprint 11 (R3): dialog "Edit PDF Penjahit" — deadline penjahit per produk + desain
 * penjahit (maks 1 gambar per item; file baru menimpa yang lama). Aksi terpisah dari
 * form PO supaya data customer tidak ikut tersentuh dan alur revisi PO tidak terpicu.
 * Kunci form per item: `deadline-<itemId>` ("" = kosong), `design-<itemId>` (file),
 * `removeDesign-<itemId>` = "1" (hapus desain lama tanpa file baru).
 */
type PenjahitDesignUpload = { itemId: string; bytes: Uint8Array; contentType: DesignImageMime; originalName: string; path: string };

async function preparePenjahitDesign(file: File, itemId: string): Promise<PenjahitDesignUpload> {
  if (file.size > PURCHASE_ORDER_ATTACHMENT_MAX_BYTES) throw new UserFacingError(`Gambar desain penjahit maksimal 5 MB (${file.name}).`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = designImageContentType(file.name, bytes);
  if (!contentType) throw new UserFacingError(designImageRejection(file.name));
  return {
    itemId,
    bytes,
    contentType,
    originalName: file.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || "desain-penjahit",
    path: `penjahit/${itemId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
  };
}

export async function savePenjahitPlanAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderIdSchema.safeParse({ purchaseOrderId: formValue(formData, "purchaseOrderId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parsed.data.purchaseOrderId },
      select: {
        id: true,
        purchaseOrderNo: true,
        status: true,
        opportunityId: true,
        version: true,
        items: { orderBy: { position: "asc" }, select: { id: true, name: true, penjahitDesignPath: true } },
      },
    });
    if (!purchaseOrder) throw new UserFacingError("Purchase order tidak ditemukan.");
    if (!purchaseOrder.items.length) throw new UserFacingError("PO belum memiliki produk, jadi deadline penjahit belum bisa diisi.");
    if ((purchaseOrder.status !== "DRAFT" && purchaseOrder.status !== "AGREED") && !hasRole(actor.role, GATE_OVERRIDE_ROLES)) throw new UserFacingError("Deadline & desain penjahit hanya dapat diubah selama PO berstatus Draft atau Disepakati.");
    if (purchaseOrder.version !== parsed.data.version) throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");

    const deadlines = new Map<string, Date | null>();
    const uploads: PenjahitDesignUpload[] = [];
    const removals: Array<{ itemId: string; oldPath: string }> = [];
    const supersededPaths: string[] = [];
    for (const item of purchaseOrder.items) {
      const rawDeadline = formData.get(`deadline-${item.id}`);
      // Kunci selalu ada di dialog; "" berarti mengosongkan deadline, kehilangan kunci = tidak diubah.
      if (typeof rawDeadline === "string") deadlines.set(item.id, optionalDate(rawDeadline.trim() || undefined));
      const design = formData.get(`design-${item.id}`);
      if (design instanceof File && design.size > 0) {
        uploads.push(await preparePenjahitDesign(design, item.id));
        if (item.penjahitDesignPath) supersededPaths.push(item.penjahitDesignPath);
      } else if (formData.get(`removeDesign-${item.id}`) === "1" && item.penjahitDesignPath) {
        removals.push({ itemId: item.id, oldPath: item.penjahitDesignPath });
      }
    }
    if (!deadlines.size && !uploads.length && !removals.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");

    const storage = createAdminClient().storage.from("crm-po-designs");
    try {
      for (const upload of uploads) {
        const { error } = await storage.upload(upload.path, upload.bytes, { contentType: upload.contentType, upsert: false });
        if (error) throw new UserFacingError("Gambar desain penjahit belum dapat disimpan.");
      }
      await prisma.$transaction(async (tx) => {
        const guarded = await tx.purchaseOrder.updateMany({ where: { id: purchaseOrder.id, version: parsed.data.version }, data: { version: { increment: 1 } } });
        if (guarded.count === 0) throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
        const current = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrder.id }, select: { status: true } });
        if (!current || ((current.status !== "DRAFT" && current.status !== "AGREED") && !hasRole(actor.role, GATE_OVERRIDE_ROLES))) throw new UserFacingError("PO tidak lagi berstatus Draft atau Disepakati.");
        for (const item of purchaseOrder.items) {
          const upload = uploads.find((entry) => entry.itemId === item.id);
          const removal = removals.find((entry) => entry.itemId === item.id);
          const hasDeadline = deadlines.has(item.id);
          if (!hasDeadline && !upload && !removal) continue;
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: {
              ...(hasDeadline ? { penjahitDeadline: deadlines.get(item.id) ?? null } : {}),
              ...(upload ? { penjahitDesignPath: upload.path, penjahitDesignName: upload.originalName, penjahitDesignType: upload.contentType } : {}),
              ...(removal ? { penjahitDesignPath: null, penjahitDesignName: null, penjahitDesignType: null } : {}),
            },
          });
        }
        await audit(tx, actor, "PurchaseOrder", purchaseOrder.id, "PENJAHIT_PLAN_UPDATED", ["penjahitDeadline", "penjahitDesign"], {
          purchaseOrderNo: purchaseOrder.purchaseOrderNo,
          deadlineCount: deadlines.size,
          uploadCount: uploads.length,
          removalCount: removals.length,
        });
      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
    } catch (error) {
      // Berkas baru dibatalkan; berkas lama masih dirujuk DB lama sehingga PDF lama tetap tampil.
      await Promise.all(uploads.map((upload) => storage.remove([upload.path])));
      throw error;
    }
    // File lama dilepas hanya setelah transaksi sukses (best-effort): object storage bukan sumber data.
    await Promise.all([...supersededPaths, ...removals.map((entry) => entry.oldPath)].map((path) => storage.remove([path])));

    revalidatePath("/crm");
    revalidatePurchaseOrderList();
    revalidatePath(`/crm/peluang/${purchaseOrder.opportunityId}`);
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function markPurchaseOrderDesignSentAction(formData: FormData) {
=====MASTER DATA=====
    if (!current) throw new UserFacingError("Kategori produk tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("productCategory", id);
    if (used > 0) throw new UserFacingError(`Kategori "${current.name}" masih digunakan oleh ${used} PO dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productCategory.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "ProductCategory", entityId: id, action: "PRODUCT_CATEGORY_DELETED", changedFields: ["name", "garmentType", "position"] } });
    }, MASTER_DATA_TRANSACTION_OPTIONS);
    revalidatePath("/master-data/product-categories");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/product-categories", "notice", `Kategori "${current.name}" berhasil dihapus.`);
  });
}

async function readBusinessImage(file: File, label: string) {
  if (file.size > 2 * 1024 * 1024) throw new UserFacingError(`${label} maksimal 2 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = file.type === "image/png" && bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isJpeg = file.type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = file.type === "image/webp" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new UserFacingError(`${label} harus berupa PNG, JPG, atau WebP yang valid.`);
  const extension = isPng ? "png" : isWebp ? "webp" : "jpg";
  return { bytes, type: file.type, extension };
}

export async function updateBusinessProfileAction(formData: FormData) {
  return runRedirectingAction("/master-data/business-profile", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = businessProfileSchema.safeParse({
      version: formData.get("version"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      address: formData.get("address"),
      signatureName: formData.get("signatureName"),
      signatureTitle: formData.get("signatureTitle"),
      invoiceNotes: formData.get("invoiceNotes"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const logo = formData.get("logo");
    let uploadedLogoPath: string | null = null;
    if (logo instanceof File && logo.size) {
      const image = await readBusinessImage(logo, "Logo");
      uploadedLogoPath = `business/logo-${randomUUID()}.${image.extension}`;
      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
    }

    // Gambar tanda tangan boleh diganti atau dihapus. File lama sengaja tidak
    // ikut dihapus: path-nya sudah tersimpan di snapshot invoice yang terkunci.
    const signature = formData.get("signature");
    let uploadedSignaturePath: string | null = null;
    if (signature instanceof File && signature.size) {
      const image = await readBusinessImage(signature, "Gambar tanda tangan");
      uploadedSignaturePath = `business/signature-${randomUUID()}.${image.extension}`;
      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
    }
    const removeSignature = formData.get("removeSignature") === "1" && !uploadedSignaturePath;

    try {
      await getPrismaClient().$transaction(async (tx) => {
        const current = await tx.businessProfile.findUnique({ where: { id: "default" }, select: { id: true } });
        if (!current) throw new UserFacingError("Profil perusahaan belum tersedia. Jalankan migrasi terbaru.");
        const updated = await tx.businessProfile.updateMany({
          where: { id: "default", version: parsed.data.version },
          data: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email?.toLowerCase(),
            address: parsed.data.address,
            signatureName: parsed.data.signatureName,
            signatureTitle: parsed.data.signatureTitle,
            invoiceNotes: parsed.data.invoiceNotes,
            ...(uploadedLogoPath ? { logoPath: uploadedLogoPath } : {}),
            ...(uploadedSignaturePath ? { signaturePath: uploadedSignaturePath } : {}),
            ...(removeSignature ? { signaturePath: null } : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Profil perusahaan sudah berubah. Muat ulang halaman.");
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "BUSINESS_PROFILE_UPDATED", changedFields: ["name", "phone", "email", "address", "signatureName", "signatureTitle", "invoiceNotes", ...(uploadedLogoPath ? ["logoPath"] : []), ...(uploadedSignaturePath || removeSignature ? ["signaturePath"] : [])] },
        });
      }, MASTER_DATA_TRANSACTION_OPTIONS);
    } catch (error) {
      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
      throw error;
    }
    revalidatePath("/master-data/business-profile");
    revalidateTag(SITE_LOGO_CACHE_TAG, { expire: 0 });
    return flashMessagePath("/master-data/business-profile", "notice", "Profil perusahaan berhasil diperbarui.");
  });
}


**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 180,280p worker/whatsapp.mjs; echo \"=====SEND JOB=====\"; sed -n 590,630p worker/whatsapp.mjs; echo \"=====HEAD=====\"; sed -n 1,60p worker/whatsapp.mjs"
}
```

        console.error(`[whatsapp-worker] inbound ${message.key.id}: ${cleanError(error)}`);
      }
    }
  });

  socket.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      if (!update.key.id) continue;
      const status = Number(update.update.status || 0);
      const data = status >= 4 ? { status: "READ", readAt: new Date(), deliveredAt: new Date() }
        : status >= 3 ? { status: "DELIVERED", deliveredAt: new Date() }
          : status >= 2 ? { status: "SENT", sentAt: new Date() } : null;
      if (data) await prisma.whatsAppMessage.updateMany({ where: { accountId: account.id, whatsappMessageId: update.key.id }, data });
    }
  });
}

async function storeInbound(accountId, message, remoteJid) {
  const customer = await findCustomer(remoteJid);
  const contentType = getContentType(message.message);
  const kind = contentType === "imageMessage" ? "IMAGE" : contentType === "documentMessage" ? "DOCUMENT" : "TEXT";
  let mediaPath = null;
  let mediaMimeType = null;
  let mediaFileName = null;
  let mediaSizeBytes = null;
  if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    const buffer = await downloadMediaMessage(message, "buffer", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });
    // Cap 5MB agar muat di worker 200M (sebelumnya 10MB).
    if (buffer.length <= 5 * 1024 * 1024) {
      const media = kind === "IMAGE" ? message.message.imageMessage : message.message.documentMessage;
      mediaMimeType = media?.mimetype || "application/octet-stream";
      mediaFileName = media?.fileName || `${message.key.id}.${kind === "IMAGE" ? "jpg" : "bin"}`;
      mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
      if (uploaded.error) throw uploaded.error;
      mediaSizeBytes = buffer.length;
    }
  }
  const text = messageText(message) || (kind === "TEXT" ? "Pesan tidak didukung." : null);
  const occurredAt = new Date(Number(message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000);
  await prisma.$transaction(async (tx) => {
    const conversation = await tx.whatsAppConversation.upsert({
      where: { accountId_remoteJid: { accountId, remoteJid } },
      create: { accountId, remoteJid, customerId: customer?.id, unreadCount: 1, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
      update: { customerId: customer?.id || undefined, unreadCount: { increment: 1 }, isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
    });
    const stored = await tx.whatsAppMessage.upsert({
      where: { accountId_whatsappMessageId: { accountId, whatsappMessageId: message.key.id } },
      create: { accountId, conversationId: conversation.id, whatsappMessageId: message.key.id, direction: "INBOUND", kind, status: "DELIVERED", text, mediaPath, mediaMimeType, mediaFileName, mediaSizeBytes, occurredAt },
      update: {},
    });
    if (customer) {
      const authorId = customer.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
      if (authorId) await tx.communicationActivity.upsert({
        where: { whatsappMessageId: stored.id },
        create: { customerId: customer.id, authorId, kind: "COMMUNICATION", channel: "WHATSAPP", direction: "INBOUND", content: text || `[${kind.toLowerCase()}]`, occurredAt, whatsappMessageId: stored.id },
        update: {},
      });
    }
  }, WORKER_TRANSACTION_OPTIONS);
}

async function processAccountDeletion(account) {
  const socket = sessions.get(account.id);
  if (socket) {
    await socket.logout().catch(() => undefined);
    sessions.delete(account.id);
  }
  await rm(path.join(authRoot, account.id), { recursive: true, force: true });
  const messages = await prisma.whatsAppMessage.findMany({
    where: { accountId: account.id },
    select: { id: true, mediaPath: true },
    orderBy: { id: "asc" },
    take: 500,
  });
  if (messages.length) {
    const paths = [...new Set(messages.map((message) => message.mediaPath).filter(Boolean))];
    if (paths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));
        if (error) console.error(`[whatsapp-worker] delete media ${account.id}: ${cleanError(error)}`);
      }
    }
    await prisma.whatsAppMessage.deleteMany({ where: { id: { in: messages.map((message) => message.id) } } });
    return;
  }
  const conversations = await prisma.whatsAppConversation.findMany({
    where: { accountId: account.id },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 500,
  });
  if (conversations.length) {
    await prisma.whatsAppConversation.deleteMany({ where: { id: { in: conversations.map((conversation) => conversation.id) } } });
    return;
  }
  await prisma.whatsAppAccount.delete({ where: { id: account.id } });
  console.error(`[whatsapp-worker] account ${account.id} deleted`);
}
=====SEND JOB=====
    const socket = account && sessions.get(account.id);
    if (!account || account.status !== "CONNECTED" || !account.sendEnabled || !socket) throw new Error("Nomor WhatsApp aktif sedang offline.");
    const payload = job.payload;
    const customerNumber = normalizeNumber(job.customer?.whatsapp);
    const remoteJid = (job.type === "MANUAL" || job.type === "CAMPAIGN_TEST" ? directJid(job.message?.conversation.remoteJid) || directJid(payload.remoteJid) : null)
      || (customerNumber ? `${customerNumber}@s.whatsapp.net` : null);
    if (!remoteJid) throw new Error("Nomor WhatsApp customer tidak valid.");
    const text = String(payload.text || "").trim();
    const activityContent = text || `[${String(payload.attachment?.kind || payload.attachment?.type || "pesan").toLowerCase()}]`;
    let content = { text };
    if (payload.attachment?.type === "invoice") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const secret = process.env.WHATSAPP_WORKER_SECRET;
      if (!appUrl || !secret) throw new Error("Konfigurasi URL/secret invoice worker belum tersedia.");
      const response = await fetch(`${appUrl}/api/crm/invoice/${payload.attachment.invoiceId}/pdf`, { headers: { authorization: `Bearer ${secret}` } });
      if (!response.ok) throw new Error("PDF invoice gagal diambil.");
      content = { document: Buffer.from(await response.arrayBuffer()), mimetype: "application/pdf", fileName: `invoice-${job.invoiceId}.pdf`, caption: text };
    } else if (payload.attachment?.path) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Konfigurasi Storage worker belum tersedia.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);
      if (downloaded.error) throw downloaded.error;
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      content = payload.attachment.kind === "IMAGE"
        ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }
        : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };
    }
    const preparedAt = new Date();
    const conversation = await prisma.whatsAppConversation.upsert({ where: { accountId_remoteJid: { accountId: account.id, remoteJid } }, create: { accountId: account.id, remoteJid, ...(job.customerId ? { customerId: job.customerId } : {}) }, update: job.customerId ? { customerId: job.customerId } : {} });
    const preparedMessage = job.message
      ? await prisma.whatsAppMessage.update({ where: { id: job.message.id }, data: { accountId: account.id, conversationId: conversation.id, status: "SENDING", errorMessage: null, failedAt: null } })
      : await prisma.whatsAppMessage.create({ data: { accountId: account.id, conversationId: conversation.id, direction: "OUTBOUND", status: "SENDING", kind: payload.attachment ? "DOCUMENT" : "TEXT", text, mediaFileName: payload.attachment?.type === "invoice" ? `invoice-${job.invoiceId}.pdf` : payload.attachment?.fileName ?? null, mediaMimeType: payload.attachment?.type === "invoice" ? "application/pdf" : payload.attachment?.mimeType ?? null, sentById: typeof payload.sentById === "string" ? payload.sentById : null, automationJobId: job.id, occurredAt: preparedAt } });
    await prisma.whatsAppAutomationJob.update({ where: { id: job.id }, data: { accountId: account.id } });
    sendStarted = true;
    const sent = await socket.sendMessage(remoteJid, content);
    consoleInfo(`[whatsapp-worker] job ${job.id} sent to ${remoteJid}`);
    const occurredAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({ where: { id: conversation.id }, data: { isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: activityContent.slice(0, 240) } });
      const message = await tx.whatsAppMessage.update({ where: { id: preparedMessage.id }, data: { whatsappMessageId: sent.key.id, status: "SENT", sentAt: occurredAt, occurredAt } });
      const authorId = message.sentById || job.customer?.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
=====HEAD=====
import "dotenv/config";

import makeWASocket, { DisconnectReason, downloadMediaMessage, getContentType, useMultiFileAuthState as loadMultiFileAuthState } from "@whiskeysockets/baileys";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
const lockConnectionString = process.env.DIRECT_URL || connectionString;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
// (maxWait 2s / timeout 5s) bisa P2028, jadi anggaran transaksi dinaikkan.
const WORKER_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
// Advisory locks need a session-stable connection; avoid transaction poolers for this client.
const lockClient = new Client({ connectionString: lockConnectionString });
const authRoot = path.resolve(process.env.WHATSAPP_AUTH_PATH || ".data/baileys-auth");
const workerId = process.env.WHATSAPP_WORKER_ID || `worker-${process.pid}`;
const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
const campaignRecipientAllowlist = process.env.BROADCAST_TEST_RECIPIENTS
  ? new Set(process.env.BROADCAST_TEST_RECIPIENTS.split(",").map(normalizeNumber).filter(Boolean))
  : null;
const sessions = new Map();
let stopping = false;
let lastTickAt = 0;
let lastAutomationAt = 0;
let lastInvoiceScanAt = 0;
let lastLagMs = 0;
let ticking = false;

const DEFAULT_INVOICE_ISSUED_TEMPLATE = "Halo {{customer_name}}, invoice {{invoice_no}} dari {{business_name}} sebesar {{invoice_total}} telah diterbitkan. Batas pembayaran: {{invoice_due_date}}. Dokumen invoice terlampir. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_INVOICE_DUE_TEMPLATE = "Halo {{customer_name}}, pengingat pembayaran {{payment_label}} untuk invoice {{invoice_no}} sebesar {{payment_amount}} jatuh tempo pada {{payment_due_date}}. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_ORDER_REMINDER_TEMPLATE = "Halo {{customer_name}}, sudah waktunya meninjau kebutuhan order berikutnya di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.";

const silentLogger = {
  level: "silent",
  child() { return this; },
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
};

const consoleInfo = console.info.bind(console);
const consoleWarn = console.warn.bind(console);
console.info = (...args) => {
  if (args[0] !== "Closing session:" && args[0] !== "Opening session:") consoleInfo(...args);
};
console.warn = (...args) => {
  if (args[0] !== "Session already closed") consoleWarn(...args);
};

function cleanError(error) {
  return error instanceof Error ? error.message.slice(0, 500) : "Kesalahan worker WhatsApp.";
}

function normalizeNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");


---

## Assistant

_Thinking:_

Important finding: The doc says worker K1/K2/K3 all use Supabase. K3 is the outbound download. However, pay attention: the worker's `storeInbound` guard is `if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)` — with local driver this guard should change, and skip condition should be based on ERP_STORAGE_DIR/driver. Also K3's guard requires Supabase env. So porting must adjust those guards. The doc mentions "guard env" preserved; but actually guard env must change since local mode wouldn't need Supabase creds. That's a detail worth flagging.

Also, importantly, `processAccountDeletion` only removes media when Supabase env is set. Porting to local requires changing this guard.

Now check read routes, especially PDF PO for buffer handling and content-type.

**Tool: shell**

**Input:**
```json
{
  "command": "cat \"app/api/desain/[taskId]/attachments/[attachmentId]/route.ts\"; echo \"=====R2=====\"; cat \"app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts\"; echo \"=====R3=====\"; cat \"app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts\""
}
```

import { DESIGN_VIEW_ROLES, DETAIL_DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { sniffImageContentType } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
  try { await requireActor([...DESIGN_VIEW_ROLES, ...DETAIL_DESIGN_VIEW_ROLES]); } catch { return new Response("Anda tidak berhak membuka file desain.", { status: 403 }); }
  const values = await params;
  const taskId = entityIdSchema.safeParse(values.taskId);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!taskId.success || !attachmentId.success) return new Response("File desain tidak ditemukan.", { status: 404 });
  const attachment = await getPrismaClient().designAttachment.findFirst({ where: { id: attachmentId.data, designRevision: { designTaskId: taskId.data } }, select: { path: true, originalPath: true, originalName: true, contentType: true } });
  if (!attachment) return new Response("File desain tidak ditemukan.", { status: 404 });
  const original = new URL(request.url).searchParams.has("original");
  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
  if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
  const disposition = new URL(request.url).searchParams.has("inline") ? "inline" : "attachment";
  // Salinan desain awal dan revisi lama bisa berjenis beda dari kolom contentType,
  // jadi tipe dikenali ulang dari isi file agar pratinjau dengan `nosniff` tetap tampil.
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new Response(buffer, { headers: { "Content-Type": sniffImageContentType(bytes) ?? attachment.contentType, "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
=====R2=====
import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka lampiran desain.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!purchaseOrderId.success || !attachmentId.success) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const attachment = await getPrismaClient().purchaseOrderAttachment.findFirst({
    where: { id: attachmentId.data, purchaseOrderId: purchaseOrderId.data },
    select: { path: true, originalName: true, contentType: true },
  });
  if (!attachment) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
  if (error) return new Response("Lampiran tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
=====R3=====
import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

/** Pratinjau desain penjahit per produk (Sprint 11 R3) — dipakai thumbnail dialog & PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka desain penjahit.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const itemId = entityIdSchema.safeParse(values.itemId);
  if (!purchaseOrderId.success || !itemId.success) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const item = await getPrismaClient().purchaseOrderItem.findFirst({
    where: { id: itemId.data, purchaseOrderId: purchaseOrderId.data, penjahitDesignPath: { not: null } },
    select: { penjahitDesignPath: true, penjahitDesignName: true, penjahitDesignType: true },
  });
  if (!item?.penjahitDesignPath) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
  if (error) return new Response("Desain penjahit tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": item.penjahitDesignType ?? "image/png",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.penjahitDesignName ?? "desain-penjahit")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}


**Tool: shell**

**Input:**
```json
{
  "command": "cat \"app/api/master-data/business-profile/logo/route.ts\"; echo \"=====SIG=====\"; cat \"app/api/master-data/business-profile/signature/route.ts\"; echo \"=====PUBLIC=====\"; cat \"app/api/public/business-logo/route.ts\"; echo \"=====R13=====\"; cat \"app/api/whatsapp/media/[id]/route.ts\""
}
```

import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const profile = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { logoPath: true } });
  if (!profile?.logoPath) return new Response("Logo tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
  if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
=====SIG=====
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const profile = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { signaturePath: true } });
  if (!profile?.signaturePath) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
  if (error || !data) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
=====PUBLIC=====
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
/** Jangan di-prerender saat build; logo harus selalu mengikuti profil terbaru. */
export const dynamic = "force-dynamic";

/**
 * Menyajikan logo profil perusahaan untuk publik (navbar, footer, sidebar).
 * Sengaja tanpa auth: logo adalah identitas publik situs.
 * Satu-satunya data yang keluar adalah file logo itu sendiri — logoPath dari DB
 * divalidasi allowlist ketat sehingga tidak bisa dipakai untuk path traversal.
 */
const LOGO_PATH_PATTERN = /^business\/logo-[A-Za-z0-9-]+\.(png|jpg|jpeg|webp)$/;

function contentTypeFor(path: string): string | null {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return null;
}

export async function GET() {
  try {
    const profile = await getPrismaClient().businessProfile.findUnique({
      where: { id: "default" },
      select: { logoPath: true },
    });
    const logoPath = profile?.logoPath;
    const contentType = logoPath ? contentTypeFor(logoPath) : null;
    if (!logoPath || !contentType || !LOGO_PATH_PATTERN.test(logoPath)) {
      return new Response("Logo tidak ditemukan.", { status: 404 });
    }
    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
    if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
    // URL memuat `?v=` versi profil, jadi cache immutable aman: ganti logo = URL baru.
    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Logo tidak ditemukan.", { status: 404 });
  }
}
=====R13=====
import { CRM_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireActor(CRM_ROLES);
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const message = await getPrismaClient().whatsAppMessage.findFirst({
    where: { id: (await params).id, ...(actor.role === "SALES" ? { conversation: { customer: { salesPicId: actor.id } } } : {}) },
    select: { mediaPath: true, mediaMimeType: true, mediaFileName: true },
  });
  if (!message?.mediaPath) return new Response("Lampiran tidak ditemukan.", { status: 404 });
  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
  if (result.error) return new Response("Lampiran tidak ditemukan.", { status: 404 });
  const inlineImage = ["image/jpeg", "image/png", "image/webp"].includes(message.mediaMimeType ?? "");
  return new Response(await result.data.arrayBuffer(), {
    headers: {
      "Content-Type": inlineImage ? message.mediaMimeType! : "application/octet-stream",
      "Content-Disposition": `${inlineImage ? "inline" : "attachment"}; filename="${(message.mediaFileName || "lampiran").replace(/["\\\r\n]/g, "-")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}


---

## Assistant

_Thinking:_

Now let me check R4/R5/R6 for content types and blob handling. Also check whether any code uses `.type` property (doc mentions R7/R8 use data.type; confirmed). Also verify R5/R6.

And check the middleware / next config to see if /media served via route? Not relevant.

Also, important: `data.type` is blob MIME from Supabase. For local, contentTypeFromPath. Fine.

Let me look at R4, R5, R6.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1,140p \"app/api/crm/purchase-order/[id]/pdf/route.ts\"; echo \"=====INVOICE PDF=====\"; sed -n 70,140p \"app/api/crm/invoice/[id]/pdf/route.ts\"; echo \"=====KWITANSI=====\"; sed -n 1,90p \"app/api/crm/payment-transactions/[id]/kwitansi/route.ts\""
}
```

import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { createPurchaseOrderPdf } from "@/lib/crm/purchase-order-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ATTACHMENT_LABEL: Record<string, string> = {
  MAIN_DESIGN: "Desain utama",
  FRONT: "Tampak depan",
  BACK: "Tampak belakang",
  LOGO_RIGHT: "Logo kanan",
  LOGO_BACK: "Logo belakang",
  LOGO_FRONT: "Logo depan",
  OTHER: "Lampiran lain",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda tidak memiliki akses untuk mengunduh PO.", { status: 403 }); }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Invoice tidak ditemukan.", { status: 404 });
  const variant = new URL(request.url).searchParams.get("variant") === "penjahit" ? "penjahit" as const : "customer" as const;

  const prisma = getPrismaClient();
  const [purchaseOrder, currentBusiness] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: parsed.data },
      include: {
        opportunity: { select: { customer: { select: { name: true, companyName: true } } } },
        productCategory: { select: { name: true } },
        items: { select: { id: true, name: true, pola: true, garmentType: true, decorationMethods: true, designNotes: true, penjahitDeadline: true, penjahitDesignPath: true, penjahitDesignName: true, penjahitDesignType: true, productCategory: { select: { name: true } } }, orderBy: { position: "asc" } },
        sizes: { select: { itemId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
        rosterEntries: { select: { itemId: true, memberId: true, name: true, size: true, sleeveLength: true }, orderBy: { position: "asc" } },
        attachments: { select: { path: true, kind: true, originalName: true, contentType: true, caption: true }, orderBy: { createdAt: "asc" } },
        // Desain tanpa tahap persetujuan: versi terbaru setiap produk langsung dipakai di PDF.
        designTask: { select: { revisions: { orderBy: [{ revision: "desc" }, { createdAt: "desc" }], select: { itemId: true, attachments: { select: { path: true, kind: true, originalName: true, contentType: true }, orderBy: { createdAt: "asc" } } } } } },
      },
    }),
    prisma.businessProfile.findUnique({ where: { id: "default" } }),
  ]);
  if (!purchaseOrder) return new Response("PO tidak ditemukan.", { status: 404 });
  const storage = createAdminClient().storage;
  // Snapshot lebih dulu; PO lama yang snapshot logonya kosong jatuh ke logo profil terkini,
  // lalu ke logo brand terbaru supaya kop PO tidak pernah memakai ikon lama.
  const logoPath = purchaseOrder.snapshotBusinessLogoPath ?? currentBusiness?.logoPath ?? null;
  let logoBytes = await readDefaultBrandLogoPng();
  if (logoPath) {
    const { data } = await storage.from("business-assets").download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { /* Gunakan logo bawaan. */ }
    }
  }
  const designRevisions = purchaseOrder.designTask?.revisions ?? [];
  const itemNames = new Map(purchaseOrder.items.map((item) => [item.id, item.name]));
  const latestDesignByItem = new Map<string, (typeof designRevisions)[number]>();
  for (const revision of designRevisions) if (!latestDesignByItem.has(revision.itemId)) latestDesignByItem.set(revision.itemId, revision);
  // `itemId` dipakai PDF: gambar desain menempel di lembar produknya masing-masing (H3).
  const designAttachments = [...latestDesignByItem].flatMap(([itemId, revision]) => revision.attachments.map((attachment) => ({
    ...attachment,
    itemId,
    caption: itemNames.get(itemId) ? `Desain produksi ${itemNames.get(itemId)}` : "Desain produksi",
  })));
  // Sprint 11 R3: varian penjahit menampilkan Desain Penjahit tiap produk di atas
  // gambar desain produksi; varian customer tidak menyertakannya (PDF customer tak berubah).
  const penjahitAssets =
    variant === "penjahit"
      ? (await Promise.all(
          purchaseOrder.items.map(async (item) => {
            const path = item.penjahitDesignPath;
            if (!path) return null;
            const label = `Desain penjahit ${item.name}`;
            const originalName = item.penjahitDesignName ?? label;
            const { data } = await storage.from("crm-po-designs").download(path);
            if (!data) return null;
            try {
              return { kind: "PENJAHIT_DESIGN", label, originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId: item.id as string | null };
            } catch {
              return { kind: "PENJAHIT_DESIGN", label, originalName, contentType: item.penjahitDesignType ?? "image/png", bytes: new Uint8Array(), itemId: item.id as string | null };
            }
          }),
        )).filter((asset): asset is NonNullable<typeof asset> => asset !== null)
      : [];
  const assets = [...penjahitAssets, ...(await Promise.all([...purchaseOrder.attachments, ...designAttachments].map(async (item) => {
    const label = item.caption || ATTACHMENT_LABEL[item.kind] || item.originalName;
    // `itemId` wajib diteruskan agar gambar desain menempel di lembar produknya,
    // bukan jatuh ke lembar penutup di akhir dokumen.
    const itemId = ("itemId" in item && typeof item.itemId === "string" ? item.itemId : null) || null;
    if (item.contentType === "application/pdf") return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
    const { data } = await storage.from("crm-po-designs").download(item.path);
    if (!data) return null;
    try {
      return { kind: item.kind, label, originalName: item.originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId };
    } catch {
      return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
    }
  }))).filter((item): item is NonNullable<typeof item> => item !== null)];
  const profile = purchaseOrder.status === "DRAFT" ? currentBusiness : null;
  const pdf = await createPurchaseOrderPdf({
    ...purchaseOrder,
    productCategory: purchaseOrder.productCategory?.name ?? null,
    snapshotBusinessName: purchaseOrder.snapshotBusinessName ?? profile?.name ?? "AS Konveksi",
    snapshotBusinessPhone: purchaseOrder.snapshotBusinessPhone ?? profile?.phone ?? null,
    snapshotBusinessEmail: purchaseOrder.snapshotBusinessEmail ?? profile?.email ?? null,
    snapshotBusinessAddress: purchaseOrder.snapshotBusinessAddress ?? profile?.address ?? null,
  }, logoBytes, assets, variant);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`purchase-order-${purchaseOrder.purchaseOrderNo}${variant === "penjahit" ? "-penjahit" : ""}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
=====INVOICE PDF=====
        select: {
          productName: true, size: true, description: true, quantity: true, unitPrice: true, grossAmount: true,
          discountType: true, discountPercent: true, discountAmount: true, profitPercent: true, profitAmount: true, total: true, subtotal: true,
          addons: { select: { label: true, description: true, unitAmount: true, qty: true }, orderBy: { position: "asc" } },
        },
        orderBy: { position: "asc" },
      },
      salesOrder: { select: { payment: { select: { transactions: { select: { amount: true, status: true } } } } } },
    },
  }), prisma.businessProfile.findUnique({ where: { id: "default" } }), prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { position: "asc" }, select: { name: true, description: true } }),
    // Poin master "Pengaturan invoice" dibaca langsung (live), sama seperti daftar metode pembayaran.
    prisma.invoiceSettingPoint.findMany({ orderBy: [{ section: "asc" }, { position: "asc" }], select: { section: true, text: true } })]);
  if (!invoice) return new Response("Invoice tidak ditemukan.", { status: 404 });

  // Kop identitas memakai snapshot lebih dulu; kolom snapshot yang masih kosong (invoice lama,
  // dibuat sebelum profil perusahaan diisi) jatuh ke profil terkini supaya kopnya tidak polos.
  const logoPath = invoice.status === "DRAFT" ? currentBusiness?.logoPath : invoice.snapshotBusinessLogoPath ?? currentBusiness?.logoPath;
  let logoBytes: Uint8Array | undefined;
  if (logoPath) {
    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { logoBytes = undefined; }
    }
  }
  const signaturePath = invoice.snapshotSignaturePath ?? currentBusiness?.signaturePath ?? null;
  let signatureBytes: Uint8Array | undefined;
  if (signaturePath) {
    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
    if (data) {
      try { signatureBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { signatureBytes = undefined; }
    }
  }
  const pdf = await createInvoicePdf({
    ...invoice,
    snapshotBusinessName: invoice.snapshotBusinessName ?? currentBusiness?.name ?? "AS Konveksi",
    snapshotBusinessPhone: invoice.snapshotBusinessPhone ?? currentBusiness?.phone ?? null,
    snapshotBusinessEmail: invoice.snapshotBusinessEmail ?? currentBusiness?.email ?? null,
    snapshotBusinessAddress: invoice.snapshotBusinessAddress ?? currentBusiness?.address ?? null,
    snapshotSignatureName: invoice.snapshotSignatureName ?? currentBusiness?.signatureName ?? null,
    snapshotSignatureTitle: invoice.snapshotSignatureTitle ?? currentBusiness?.signatureTitle ?? null,
  }, { logo: logoBytes, signature: signatureBytes, paymentMethods, settingPoints });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`invoice-${invoice.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
=====KWITANSI=====
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createReceiptPdf } from "@/lib/crm/receipt-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const prisma = getPrismaClient();
  const [tx, profile] = await Promise.all([
    prisma.paymentTransaction.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        reference: true,
        status: true,
        payment: { select: { salesOrder: { select: { invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, invoice: { select: { snapshotBusinessName: true, snapshotBusinessAddress: true, snapshotBusinessPhone: true, snapshotBusinessEmail: true, snapshotBusinessLogoPath: true, snapshotSignatureName: true, snapshotSignatureTitle: true, snapshotSignaturePath: true } } } } } },
      },
    }),
    // Kop mengikuti snapshot invoice; kolom yang masih kosong (invoice lama, dibuat sebelum
    // profil perusahaan diisi) diambil dari profil terkini supaya kopnya tidak polos.
    prisma.businessProfile.findUnique({
      where: { id: "default" },
      select: { name: true, address: true, phone: true, email: true, logoPath: true, signatureName: true, signatureTitle: true, signaturePath: true },
    }),
  ]);
  if (!tx || tx.status !== "ACTIVE") return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const order = tx.payment.salesOrder;
  const bucket = createAdminClient().storage.from("business-assets");
  const readImage = async (path: string | null) => {
    if (!path) return undefined;
    const { data: file } = await bucket.download(path);
    if (!file) return undefined;
    try {
      return await normalizePdfImage(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return undefined;
    }
  };
  const [logo, signature] = await Promise.all([
    readImage(order.invoice.snapshotBusinessLogoPath ?? profile?.logoPath ?? null),
    readImage(order.invoice.snapshotSignaturePath ?? profile?.signaturePath ?? null),
  ]);
  const pdf = await createReceiptPdf({
    receiptNo: `KWT-${tx.id.slice(-8).toUpperCase()}`,
    invoiceNo: order.invoiceNo,
    customerName: order.snapshotCompanyName ?? order.snapshotCustomerName,
    amount: tx.amount,
    paidAt: tx.paidAt,
    reference: tx.reference,
    businessName: order.invoice.snapshotBusinessName ?? profile?.name ?? "AS Konveksi",
    businessAddress: order.invoice.snapshotBusinessAddress ?? profile?.address ?? null,
    businessPhone: order.invoice.snapshotBusinessPhone ?? profile?.phone ?? null,
    businessEmail: order.invoice.snapshotBusinessEmail ?? profile?.email ?? null,
    signatureName: order.invoice.snapshotSignatureName ?? profile?.signatureName ?? null,
    signatureTitle: order.invoice.snapshotSignatureTitle ?? profile?.signatureTitle ?? null,
  }, { logo, signature });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`kwitansi-${order.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}


**Tool: shell**

**Input:**
```json
{
  "command": "cat \"app/api/keuangan/pengeluaran/[id]/bukti/route.ts\"; echo \"=====R11=====\"; cat \"app/api/crm/payment-transactions/[id]/proof/route.ts\"; echo \"=====R12=====\"; cat \"app/api/crm/purchase-order/[id]/deposit/proof/route.ts\""
}
```

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(FINANCE_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().expense.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
=====R11=====
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().paymentTransaction.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
=====R12=====
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Bukti deposit PO (PurchaseOrderDeposit) — dipakai tombol "Lihat Deposit" dan
 * pratinjau di Detail PO. Selalu membaca data terbaru, jadi hasilnya mengikuti
 * Isi / Ubah Deposit yang terakhir disimpan.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().purchaseOrderDeposit.findUnique({
    where: { purchaseOrderId: id.data },
    select: { proofPath: true, proofFileName: true, proofMimeType: true },
  });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}


---

## Assistant

_Thinking:_

I now have a good picture. Let me also verify the missing points:

1. Are there other places with storage (e.g., `lib/whatsapp/*`)? The grep covered app/lib/worker/scripts. `storage.from` found all. But also check for `upload(` direct maybe in worker chat. Also check `downloadPaymentProof` etc.

2. Are there other files referencing bucket names as literals, e.g., `lib/whatsapp/...`? Let's grep bucket names.

3. Check whether `worker/whatsapp.mjs` K2 handles files not in DB (500 cap). Fine.

4. Check tests/attendance-storage.test.mjs for the test pattern.

5. Check docs/PANDUAN_ABSENSI.md for user name.

Also perhaps check if the worker is imported via `--cwd` and `path.resolve` of ERP_STORAGE_DIR relative path — if `ERP_STORAGE_DIR` is relative, worker cwd is release dir, app cwd is release dir too. Fine.

Another key issue: The app is Next standalone build; module `lib/storage/erp-storage.ts` will bundle; `local-store.mjs` is imported from TS. Next/Turbopack must resolve .mjs import; fine. But TypeScript needs type declarations for `.mjs` — importing a `.mjs` from TS without types may fail `tsc --noEmit` unless `allowJs` or a `.d.ts`. Let's check tsconfig.

**Tool: shell**

**Input:**
```json
{
  "command": "cat tsconfig.json; echo \"=====NEXT CONFIG=====\"; cat next.config.ts; echo \"=====BUCKET REFS=====\"; grep -rn \"crm-po-designs\\|business-assets\\|payment-proofs\\|whatsapp-media\" --include=*.ts --include=*.tsx --include=*.mjs --include=*.js app lib worker scripts tests | grep -v node_modules"
}
```

{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
=====NEXT CONFIG=====
import type { NextConfig } from "next";

function attendanceSecurityHeaders() {
  return [
    { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Kamera & lokasi dibutuhkan halaman absensi. Mikrofon tetap diblokir.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(process.env.NODE_ENV === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "28mb",
    },
    useTypeScriptCli: false,
    serverSourceMaps: false,
    webpackMemoryOptimizations: true,
    // "konva"/"react-konva" SENGAJA tidak dioptimasi: optimizePackageImports
    // memecah barrel import sehingga singleton Konva terduplikasi dan node
    // bentuk (Rect/Image/...) tidak terdaftar -> "has no node with the type".
    optimizePackageImports: ["lucide-react", "recharts", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    maximumRedirects: 0,
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/produk/polo", destination: "/produk/poloshirt", permanent: true },
      { source: "/produk/jaket", destination: "/produk/jacket", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // immutable hanya di production: nama chunk dev tidak di-hash per konten,
        // sehingga immutable membuat dynamic import (next/dynamic) memakai cache lama.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : "no-cache, must-revalidate" }],
      },
      {
        // Khusus rute pratinjau studio website: diizinkan dimuat di dalam iframe
        // oleh domain aplikasi itu sendiri ('self' / SAMEORIGIN), baik di localhost
        // maupun saat di-hosting di Vercel (misal: askonveksi.web.id).
        source: "/cms-preview",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        source: "/cms-preview/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        // Halaman absensi butuh kamera untuk foto dan geolocation untuk bukti lokasi.
        source: "/absensi",
        headers: attendanceSecurityHeaders(),
      },
      {
        source: "/absensi/:path*",
        headers: attendanceSecurityHeaders(),
      },
      {
        // Seluruh halaman lain dilindungi penuh dari framing / clickjacking.
        // /absensi dikecualikan karena sudah punya blok Permissions-Policy sendiri.
        source: "/((?!cms-preview|absensi).*)",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
=====BUCKET REFS=====
app/actions/master-data.ts:984:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:985:      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
app/actions/master-data.ts:995:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:996:      if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
app/actions/master-data.ts:1026:      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
app/actions/master-data.ts:1027:      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
app/actions/whatsapp.ts:190:      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
app/actions/whatsapp.ts:199:      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
app/actions/crm.ts:1851:    const storage = createAdminClient().storage.from("crm-po-designs");
app/actions/production.ts:42:const DESIGN_BUCKET = "crm-po-designs";
app/actions/design.ts:15:const BUCKET = "crm-po-designs";
app/api/whatsapp/media/[id]/route.ts:20:  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:7:const BUCKET = "crm-po-designs";
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts:7:const BUCKET = "crm-po-designs";
app/api/crm/purchase-order/[id]/pdf/route.ts:53:    const { data } = await storage.from("business-assets").download(logoPath);
app/api/crm/purchase-order/[id]/pdf/route.ts:78:            const { data } = await storage.from("crm-po-designs").download(path);
app/api/crm/purchase-order/[id]/pdf/route.ts:94:    const { data } = await storage.from("crm-po-designs").download(item.path);
app/api/crm/invoice/[id]/pdf/route.ts:89:    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/crm/invoice/[id]/pdf/route.ts:97:    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
app/api/crm/payment-transactions/[id]/kwitansi/route.ts:42:  const bucket = createAdminClient().storage.from("business-assets");
app/api/public/business-logo/route.ts:34:    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/master-data/business-profile/signature/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
app/api/master-data/business-profile/logo/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts:17:  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
lib/payment-proof.ts:8:export const PAYMENT_PROOF_BUCKET = "payment-proofs";
worker/whatsapp.mjs:24:const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
scripts/setup-crm-storage.mjs:14:    id: "crm-po-designs",
scripts/setup-crm-storage.mjs:18:    id: "business-assets",
scripts/setup-crm-storage.mjs:22:    id: "whatsapp-media",
scripts/setup-crm-storage.mjs:26:    id: "payment-proofs",
scripts/reset-crm-storage.mjs:19:const purchaseOrderBucket = "crm-po-designs";
tests/crm-validation.test.mjs:1066:  assert.match(storageScript, /crm-po-designs/);
tests/business-profile.test.mjs:67:  assert.match(signatureRouteSource, /business-assets/);


**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 1,120p tests/attendance-storage.test.mjs; echo \"=====PANDUAN ABSENSI=====\"; grep -n \"askonveksi\\|ATTENDANCE_UPLOAD_DIR\\|user\" docs/PANDUAN_ABSENSI.md | head -40; echo \"=====DOCS=====\"; ls docs"
}
```

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const uploadDir = await mkdtemp(join(tmpdir(), "askonveksi-attendance-"));
process.env.ATTENDANCE_UPLOAD_DIR = uploadDir;

const {
  AttendancePhotoError,
  attendancePhotoRelativePath,
  deleteAttendancePhoto,
  optimizeAttendancePhoto,
  readAttendancePhoto,
  resolveAttendancePhoto,
  resolveAttendancePhotoPath,
  saveAttendancePhoto,
} = await import("../lib/attendance/photo.ts");

test("path foto berada di dalam ATTENDANCE_UPLOAD_DIR", () => {
  assert.equal(
    attendancePhotoRelativePath("user_1", "2026-10-21", "foto_1"),
    "user_1/2026/10/foto_1.webp",
  );

  const path = resolveAttendancePhotoPath("user_1/2026/10/foto_1.webp");
  assert.ok(path);
  assert.equal(path.absolute, resolve(uploadDir, "user_1/2026/10/foto_1.webp"));
});

test("path traversal, path absolut, dan ekstensi lain ditolak", () => {
  assert.equal(resolveAttendancePhotoPath("../etc/passwd.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/../../foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/../foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("/etc/passwd.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1\\2026\\10\\foto.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/.rahasia.webp"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/foto.jpg"), null);
  assert.equal(resolveAttendancePhotoPath("user_1/2026/10/foto.webp\0"), null);
  assert.equal(resolveAttendancePhotoPath(null), null);
});

test("simpan, baca, dan hapus foto berjalan di root yang dikonfigurasi", async () => {
  const bytes = Buffer.from("data-foto-uji");
  const relativePath = await saveAttendancePhoto({
    userId: "user_1",
    dateKey: "2026-10-21",
    bytes,
  });

  assert.match(relativePath, /^user_1\/2026\/10\/[a-f0-9-]+\.webp$/);
  const file = await resolveAttendancePhoto(relativePath);
  assert.ok(file);
  assert.equal(file.size, bytes.length);

  const read = await readAttendancePhoto(relativePath);
  assert.ok(read);
  assert.deepEqual(read.bytes, bytes);

  await deleteAttendancePhoto(relativePath);
  assert.equal(await readAttendancePhoto(relativePath), null);
});

test("id pegawai tidak aman tidak bisa dipakai membuat path", () => {
  assert.throws(
    () => attendancePhotoRelativePath("../user", "2026-10-21"),
    AttendancePhotoError,
  );
  assert.throws(
    () => attendancePhotoRelativePath("user_1", "2026-02-30"),
    AttendancePhotoError,
  );
  assert.throws(
    () => attendancePhotoRelativePath("user_1", "2026-10-21", "../foto"),
    AttendancePhotoError,
  );
});

test("foto bukan gambar ditolak sebelum disimpan", async () => {
  const file = new File([Buffer.from("bukan gambar")], "foto.jpg", { type: "image/jpeg" });
  await assert.rejects(() => optimizeAttendancePhoto(file), AttendancePhotoError);
});

test.after(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});
=====PANDUAN ABSENSI=====
106:4. File ditulis ke `ATTENDANCE_UPLOAD_DIR` dengan struktur `userId/tahun/bulan/uuid.webp`.
117:ATTENDANCE_UPLOAD_DIR=/var/lib/askonveksi/attendance
123:sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/attendance
124:sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/attendance
173:tar -C /var/lib/askonveksi -czf /var/backups/askonveksi/attendance-$STAMP.tar.gz attendance
174:pg_dump "$DIRECT_URL" > /var/backups/askonveksi/db-$STAMP.sql
181:3. Ekstrak folder `attendance` ke `ATTENDANCE_UPLOAD_DIR`.
182:4. Perbaiki owner/permission (`askonveksi:askonveksi`, folder `0750`, file `0640`).
221:- `ATTENDANCE_UPLOAD_DIR` ada dan dapat ditulis proses aplikasi.
=====DOCS=====
daftar-aset-desainer.md
PANDUAN_ABSENSI.md
PANDUAN_CMS.md
PRISMA_SETUP.md
RENCANA_CMS_WEBSITE.md
SECURITY_NOTES.md


---

## Assistant

_Thinking:_

Now I have a solid review. Let me note discrepancies / gaps:

1. `.env.example` does not include `ATTENDANCE_UPLOAD_DIR=/var/lib/...` but doc proposes ERP additions—fine.

2. The document's claim "Tidak ada satu pun getPublicUrl/createSignedUrl" — verified true.

3. Claim "13 route" — verified 13.

4. Claim "6 file write" but table lists W1–W9 (9 rows). That's an inconsistency: "Titik tulis (upload/remove) — 6 file" but actually 9 write operations across 7 files (design.ts, production.ts, crm.ts, master-data.ts, whatsapp.ts, lib/payment-proof.ts = 6 files). 6 files is right, 9 points. Similarly 5.2 "File yang diubah (20)" — count? Let's count rows: design, production, crm, master-data, whatsapp, lib/payment-proof, R1..R13 (13), worker, deploy.yml = 6+13+1+1 = 21. Actually 6 action files + lib/payment-proof (already counted in 6 files: design, production, crm, master-data, whatsapp, payment-proof = 6), then 13 routes = 19, plus worker = 20, plus deploy.yml = 21. So the table has 21 rows, not 20. And Fase 2 says "19 file call site app" — that's 6 write files + 13 read routes = 19. So 5.2 says 20 but is actually 21 (19 app call sites + worker + deploy.yml). Minor counting errors.

5. `tests/crm-validation.test.mjs` line ~1049-1071: `storageScript` is `scripts/reset-crm-storage.mjs` (which is unchanged) and the assertion `/crm-po-designs/` there will NOT break. Only `assert.match(designActionSource, /storage\.from\(BUCKET\)/)` and `/storage\.upload\(attachment\.path/` will break. Doc is slightly inaccurate but harmless.

6. Worker env guard issue: K1's condition `if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)`, K2 same, K3 throws if Supabase env missing. If moving to local driver, these Supabase-gating conditions must be replaced with an ERP storage condition; otherwise media won't store in local mode when Supabase creds are absent, or conversely in hybrid. The doc says "Pertahankan guard env" which is ambiguous/wrong: the guard must be adapted. Worth flagging.

7. `erpGet` returning Buffer: Supabase `download` returns a Blob with `.arrayBuffer()` and `.type`. Call sites call `await data.arrayBuffer()`. The doc says shape mimics `{data,error}` to minimize call site changes but the `data` type differs, requiring edits (expected) — and R7/R8/R9 rely on `data.type`, which doc acknowledges for R7/R8 but also R9 uses `data.type`? No, R9 computes contentType locally. R7/R8 use data.type. Good.

8. TypeScript: tsconfig has `allowJs: true` but `checkJs` isn't set. Importing `.mjs` from TS: with moduleResolution bundler and allowJs, TS can resolve .mjs? TS resolves `.mjs` for import specifier with extension if allowJs and allowImportingTsExtensions... Actually importing "./local-store.mjs" from a `.ts` file: TypeScript supports resolving `.mjs` files when `allowJs: true`, and infers types from JS if `checkJs` off? It will still infer types from the JS source (allowJs) — yes, TS includes .js/.mjs and infers. But note `include` only lists `**/*.ts`, `**/*.tsx`, `**/*.mts` — not `**/*.mjs`. However, imported files are still pulled into the program even if not in include (include is only entry globs). So fine. But `checkJs` false means the .mjs is not type-checked; types inferred as any-ish. JSDoc could be used. Not a blocker.

Potential issue: Next.js standalone build with `outputFileTracing` — the `.mjs` module imported by server code gets traced fine. Worker module needs explicit copy (doc covers).

9. Another potentially missing point: `lib/design/image.ts` magic bytes; not relevant.

10. Another missing write/read point? Let me search for `download`/`upload` in lib for storage. We found all `.storage.from`. Also check `lib/whatsapp` for anything using Supabase Storage? No.

11. What about scripts that read/write storage? `scripts/seed-production-demo.mjs` maybe creates files? Let me grep for `storage.` in scripts. Already grep'd `storage.from`, none. But maybe `createClient(...).storage` in other forms. Let me grep "\.storage\b".

12. Also check `app/api/...` for other route that reads files with `readFile`/`/media/` etc. CMS and absensi. Not scope.

13. Backfill script needs both `metadata.size` — Supabase list returns `metadata` with size. OK.

14. Doc says worker imported `../lib/storage/local-store.mjs` and worker is run with `--cwd $CURRENT_LINK` and script path `$CURRENT_LINK/worker/whatsapp.mjs`, so relative import `../lib/storage/local-store.mjs` resolves to `$CURRENT_LINK/lib/storage/local-store.mjs`. Correct.

15. The doc's deploy step `tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs'` — correct style matching existing.

16. One more: `collect-worker-deps.mjs` traces worker imports, so if worker imports `../lib/storage/local-store.mjs`, the tracer will see it as a relative file that resolves outside node_modules; it queues it but the Phase 2 copy only copies traced files under node_modules (`packageDirOf` returns null → skip). So it won't copy the local-store file; hence explicit copy in deploy.yml is needed — doc covers that. But the tracer's `missing` check: relative import resolves fine, so no error. Good. Note: tracer skips `spec === "."`/`".."` only; `../lib/...` resolves. Good.

17. Another important point: `npm test` runs `node --test tests/*.test.mjs`, and test files import `.ts` modules directly (Node 24 type stripping). The new test importing `lib/storage/local-store.mjs` is fine; importing `erp-storage.ts` requires type stripping (Node 24 supports). Fine.

18. `process.env.ERP_STORAGE_DIR` default in local-store must handle relative values with `resolve()`. The doc says resolve(ERP_STORAGE_DIR || ./data/erp-storage). Note that in the app, `process.cwd()` at runtime for standalone server is release dir; fine. Worker `--cwd` release too.

19. Issue: `erpPut` for hybrid writes VPS first then Supabase; in case Supabase write fails, they log error only. That means Supabase copy may be stale but VPS primary. Rollback to `supabase` then would 404 for new files. The doc claims "rollback kapan pun aman: salinan Supabase selalu ikut ter-update". That's not strictly guaranteed by best-effort logging. A more robust hybrid would fail the operation if Supabase write fails (or retry). This is a real design flaw worth flagging — the rollback guarantee in §10 depends on dual-write always succeeding. Similarly "Remove: hapus di keduanya, best-effort" could delete VPS then fail Supabase leaving stale Supabase copy — acceptable for reads? In hybrid, get checks VPS first; if VPS deleted, falls back to Supabase and resurrects a deleted file (dangerous: deletion semantics break, e.g. overwrite deletes old path → then on read, VPS missing → fallback Supabase returns old file for a deleted path). But is a deleted path ever read? For overwritten design old path is no longer referenced. For WA account deletion, media rows deleted too. For rollback cleanup, no DB reference. Still, a stale file could be served if a DB path points to it; not likely. But more important: if VPS delete fails and Supabase delete succeeds, hybrid read falls back... VPS still has file → serves stale. Hmm. Deletion semantics in hybrid can resurrect or leave stale. Better: in hybrid, when get falls back to Supabase, if a tombstone/deleted marker? Overkill. Simpler: hybrid should treat "file missing on VPS" as authoritative after backfill complete; or write a `.deleted` marker. Alternatively use Supabase only as read fallback when file predates migration (timestamps). The doc's log-based approach relies on backfill. Worth raising as a review point.

Actually a cleaner alternative: during hybrid, dual-write and delete both; fallback only for reads. The resurrect scenario requires a read of a deleted path, which is essentially never. Fine but worth a one-line note.

20. The `erpPut` atomic write and `wx`: writing to temp then rename with `upsert:false` needs care: check existence first with `fs.open(path, 'wx')`? The doc says putFile upsert:false uses flag wx — but the atomic implementation writes to temp then renames. `wx` on the temp file doesn't emulate "fail if destination exists" because temp name is unique. So you must check destination existence first (and there's a TOCTOU race, but single-process enough) or use `link()` (atomic fail-if-exists) then unlink temp. The doc's two requirements (`atomic temp+rename` AND `wx for upsert:false`) conflict as written. That's a genuine implementation contradiction worth flagging: for `upsert:false`, open final path with `wx` and write directly (no atomicity needed since final content is never partially replaced — though readers could see partial file). Better: write temp, then `link(temp, final)` which fails with EEXIST atomically, then unlink temp. Or open final with `wx` then write. `link` is the correct approach. Good catch.

21. mkdir mode 0750 with recursive: `mkdir` mode applies only to created dirs; existing dirs may have different mode. Fine.

22. `contentTypeFromPath` for payment-proofs: extension present. For WA inbound path has no extension but R13 uses DB mime type. Fine. For `payment-proof` route, uses DB mime. Fine.

23. Doc's `storeRoot()` per-call resolution: if `ERP_STORAGE_DIR` is relative and cwd differs between test runs, fine.

24. Missing: `getPublicUrl` no. Good.

25. Does the app read any file via direct path with `readFile` (e.g., brand logo file `readDefaultBrandLogoPng`)? That's local in repo, not Supabase.

26. The doc says "13 route" and "19 file call site app" — matches 6+13.

27. Another concern: The public logo route R9 has allowlist regex `business/logo-[A-Za-z0-9-]+\.(png|jpg|jpeg|webp)` — good; `resolveSafe` also validates.

28. Doc says "Semua route tetap berauth requireActor(...) — tidak ada route/file baru yang publik selain R9" — correct. But note R1 catches auth error and returns 403 while others 401; unchanged.

29. Another subtlety: R4 PDF PO reads `snapshotBusinessLogoPath` and also `currentBusiness.logoPath`, which may point to an old logo file that could be missing in VPS if backfill not complete — fallback covers.

30. `.env.example` addition ordering.

31. Also missing from doc: `.env.cloud-bak` and `.env` contain secrets; not relevant.

32. Potential concern: Local disk storage on single VPS + Next standalone: no concurrency issue with multiple PM2 instances? PM2 runs single app process. Worker and app share disk. Fine. But atomic rename across same fs. Fine.

33. Missing consideration: `ERP_STORAGE_DIR` inside `/var/lib/askonveksi` — deploy script doesn't create it; doc Fase 0 does.

34. `scripts/migrate-storage-to-vps.mjs` uses `metadata.size`. Supabase list returns `metadata: { size, mimetype, ...}`. Yes.

35. Supabase list pagination: `list(prefix, {limit:100, offset})` supported. Recursive walk. Fine. Doc mentions.

36. One more risk not listed: `payment-proofs` upload uses `value.type !== mime` — no change.

37. Missing in doc: `app/actions/finance.ts` deletes payment proofs? Let's check calls to deletePaymentProof to ensure semantics.

Let me grep for `uploadPaymentProof|deletePaymentProof`.

38. Also is there a `lib/whatsapp/media.ts`? no.

39. Verify there's no supabase storage usage in `components` (client) — grep showed none.

Let me do those last checks, plus count `storage.` occurrences.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"uploadPaymentProof\\|deletePaymentProof\\|PAYMENT_PROOF_BUCKET\" --include=*.ts --include=*.tsx app lib; echo \"=====ANY STORAGE=====\"; grep -rn \"\\.storage\\b\" --include=*.ts --include=*.tsx --include=*.mjs app lib worker scripts | grep -v \"\\.storage\\.from\""
}
```

app/actions/crm.ts:54:import { proofRequired, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/crm.ts:2639:  const proof = await uploadPaymentProof(formData.get("proof"), actorId);
app/actions/finance.ts:12:import { deletePaymentProof, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/finance.ts:62:    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts:65:    try { await getPrismaClient().$transaction(async (tx) => { const item = await tx.expense.create({ data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? null, ...proof, createdById: actor.id } }); await audit(tx, actor.id, item.id, "EXPENSE_CREATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", "proofPath"]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof.proofPath); throw error; }
app/actions/finance.ts:78:    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts:81:    try { await getPrismaClient().$transaction(async (tx) => { await tx.expense.update({ where: { id }, data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? current.salesOrderId, ...(proof ?? {}) } }); await audit(tx, actor.id, id, "EXPENSE_UPDATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", ...(proof ? ["proofPath"] : [])]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof?.proofPath); throw error; }
app/actions/finance.ts:82:    if (proof) await deletePaymentProof(current.proofPath);
app/actions/finance.ts:195:        const uploaded = await uploadPaymentProof(plan.row.proof, actor.id);
app/actions/finance.ts:202:      for (const path of uploadedPaths) await deletePaymentProof(path);
app/actions/finance.ts:271:      for (const path of supersededProofPaths) await deletePaymentProof(path).catch(() => undefined);
app/actions/finance.ts:275:      for (const path of uploadedPaths) await deletePaymentProof(path);
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:4:import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:24:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/payment-transactions/[id]/proof/route.ts:4:import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
app/api/crm/payment-transactions/[id]/proof/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:4:import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
lib/payment-proof.ts:8:export const PAYMENT_PROOF_BUCKET = "payment-proofs";
lib/payment-proof.ts:24:export async function uploadPaymentProof(value: FormDataEntryValue | null, owner: string): Promise<PaymentProof | null> {
lib/payment-proof.ts:32:  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
lib/payment-proof.ts:37:export async function deletePaymentProof(path: string | null | undefined) {
lib/payment-proof.ts:38:  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
=====ANY STORAGE=====
app/api/crm/purchase-order/[id]/pdf/route.ts:47:  const storage = createAdminClient().storage;
scripts/setup-crm-storage.mjs:30:const { data: buckets, error: listError } = await supabase.storage.listBuckets();
scripts/setup-crm-storage.mjs:36:    ? await supabase.storage.updateBucket(definition.id, definition.options)
scripts/setup-crm-storage.mjs:37:    : await supabase.storage.createBucket(definition.id, definition.options);
scripts/reset-crm-storage.mjs:25:const { data: buckets, error: listError } = await supabase.storage.listBuckets();
scripts/reset-crm-storage.mjs:32:  const { error: emptyError } = await supabase.storage.emptyBucket(bucketId);
scripts/reset-crm-storage.mjs:35:  const { error: deleteError } = await supabase.storage.deleteBucket(bucketId);
scripts/reset-crm-storage.mjs:43:  ? await supabase.storage.updateBucket(purchaseOrderBucket, purchaseOrderBucketOptions)
scripts/reset-crm-storage.mjs:44:  : await supabase.storage.createBucket(purchaseOrderBucket, purchaseOrderBucketOptions);


**Tool: shell**

**Input:**
```json
{
  "command": "git log --oneline -5; echo \"=====STATUS=====\"; git status --short; echo \"=====BRANCH=====\"; git branch --show-current; echo \"=====TRACKING=====\"; tail -40 TRACKING_REVISI.md"
}
```

6e20ddc Merge branch 'dev' of github.com:Aiyon860/askonveksi into dev
53c5169 Fix adalah itu apa cek sendiri
188a308 feat(export): auto-fit Excel columns and add analysis workbooks
cd13a27 fix absen
379959c feat(keuangan): ekspor workbook laporan multi-sheet sesuai template klien
=====STATUS=====
?? FILE_TO_VPS.md
=====BRANCH=====
dev
=====TRACKING=====
### Alur pegawai (`/absensi`)
- [x] Kartu absen menampilkan tanggal/jam server WIB, jam masuk, toleransi, dan status hari libur/non-kerja.
- [x] Dialog kamera `getUserMedia` + pratinjau, ambil foto ke canvas, retake, kirim lewat Server Action. Foto klien diperkecil, server memvalidasi dan re-encode WebP (EXIF hilang).
- [x] Hadir/Terlambat dihitung dari jam masuk + toleransi; contoh 08:00 + 15 menit → 08:15 masih Hadir.
- [x] Setelah sukses dialog menampilkan status dan jam; halaman di-refresh saat ditutup.
- [x] Riwayat bulanan dengan pemilih bulan, foto, lokasi, keterangan, dan status Alpha/Belum absen.
- [x] Halaman memakai lebar penuh area kerja: hero dua kolom di `xl`, strip ringkasan enam metrik, pemilih bulan ringkas, dan tabel lima kolom dengan scroll horizontal yang dapat difokuskan keyboard.
- [x] `Permissions-Policy: camera=(self), geolocation=(self)` khusus `/absensi`; global tetap memblokir kamera. Produksi wajib HTTPS.

### Owner/Developer (`/absensi/laporan` + `/settings#absensi`)
- [x] Filter rentang tanggal (maks 366 hari), pegawai, status, dan jumlah baris; ringkasan Hadir/Terlambat/Izin/Alpha/Belum absen/tingkat kehadiran.
- [x] Catat manual: Hadir/Terlambat dengan jam, Izin wajib keterangan satu tanggal, Alpha tanpa jam; tanggal tidak boleh masa depan/sebelum akun dibuat.
- [x] Koreksi status/jam/keterangan kapan saja dengan audit before/after (isi keterangan tidak disalin ke log); record mandiri tidak dihapus.
- [x] Hapus hanya record `source=OWNER`; setelah dihapus tanggal kembali mengikuti Alpha/Belum absen otomatis.
- [x] Export Excel mengikuti filter aktif dan mengekspor **semua** baris, bukan hanya halaman tabel.
- [x] Pengaturan tanggal mulai absensi, jam masuk, toleransi 0–180 menit, hari kerja Senin–Minggu, dan tambah/hapus hari libur; hanya Owner/Developer yang melihat kartu.
- [x] Laporan memakai lebar penuh area kerja: ringkasan satu strip, filter responsif, dan tabel lebar tetap agar aksi tidak terpotong.
- [x] Foto disajikan lewat `/api/absensi/[id]/foto` yang terautentikasi: pegawai hanya foto sendiri, Owner/Developer semua; path traversal/absolut/backslash/ekstensi lain ditolak.
- [x] Audit: clock-in, catat manual, koreksi, hapus manual, ubah pengaturan, tambah/hapus hari libur; label Indonesia ditambahkan di `lib/audit/labels.ts`.

### Navigasi & tema
- [x] Grup sidebar **Absensi** dengan tone `--nav-tone-attendance`; pegawai melihat **Absen**, Owner/Developer melihat **Laporan absensi**. Developer tetap melihat menu dan dapat membuka semua fitur baru.
- [x] `isNavItemActive("/absensi")` exact-match supaya tidak menyalakan menu saat di `/absensi/laporan`.

### Berkas utama
- `app/actions/attendance.ts`, `lib/attendance/{constants,time,status,types,validation,report,photo,data}.ts`
- `app/(app)/absensi/page.tsx`, `app/(app)/absensi/laporan/page.tsx`
- `components/attendance/*`, `app/api/absensi/[id]/foto/route.ts`, `app/api/absensi/laporan/export/route.ts`
- `app/(app)/settings/page.tsx`, `components/app-nav.tsx`, `next.config.ts`, `prisma/schema.prisma`, migration, `.env.example`
- `docs/PANDUAN_ABSENSI.md`, tes `tests/attendance-*.test.mjs`

### Verifikasi
- [x] `node --test tests/attendance-time.test.mjs tests/attendance-report.test.mjs tests/attendance-validation.test.mjs tests/attendance-storage.test.mjs` — **22/22 lolos** (termasuk Alpha/libur/tanggal mulai, filter/ringkasan, validasi status dan tanggal mulai, path traversal, simpan/baca/hapus foto, foto bukan gambar).
- [x] Laporan diverifikasi headless pada viewport **1920×1080** dan **390×844** dengan sesi Developer: lebar konten 1536 px, tidak ada overflow body; tabel menggeser horizontal di mobile; data awal hanya 4 baris **Belum absen** hari ini, tanpa Alpha historis.
- [x] Halaman pegawai diverifikasi headless pada **1920×1080, 1440×900, 1280×800, 1024×768, dan 390×844**: tidak ada overflow body, ringkasan dan tabel tetap terbaca, serta dialog kamera/GPS diuji dengan perangkat simulasi. Record uji dihapus sehingga data absensi kembali 0.
- [x] `npx tsc --noEmit` bersih; ESLint file absensi bersih; detector layout Impeccable tidak menemukan temuan; `npm run db:validate` lolos; `npm run build` sukses (route `/absensi`, `/absensi/laporan`, `/api/absensi/[id]/foto`, `/api/absensi/laporan/export` terdaftar).
- [x] `npm test` penuh: **298/303 lolos**; 5 kegagalan lama di luar absensi (dashboard documents, CRM, analytics).
- [ ] **Belum diuji di browser nyata**: izin kamera/GPS, tampilan dialog, dan alur retake memerlukan HTTPS + perangkat berkamera.
- [ ] **Migration sudah diterapkan ke database lokal**, tetapi **belum ke produksi**; belum ada commit.
- Catatan build: Turbopack masih memberi 3 peringatan dynamic filesystem access dari modul CMS yang sudah ada; modul foto absensi tidak memicu peringatan. Build tetap exit 0.


---

## Assistant

_Thinking:_

Interesting note: "Catatan build: Turbopack masih memberi 3 peringatan dynamic filesystem access dari modul CMS" — the doc's `getFile` with dynamic path will produce Turbopack warnings too; attendance photo used `/* turbopackIgnore: true */` comments. Worth noting: the new local-store.mjs may trigger Turbopack "dynamic filesystem access" warning. The doc does not mention the `turbopackIgnore` comments that attendance uses. That's a concrete implementation detail missing from the doc. Reading/writing files with dynamic paths may cause Turbopack warnings; attendance explicitly uses `/* turbopackIgnore: true */` on resolve/stat/unlink/writeFile calls. The doc should mention that for `local-store.mjs` (especially the `resolve()` call with `process.env`).

Let me verify what warnings exist and where turbopackIgnore is used.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"turbopackIgnore\" --include=*.ts --include=*.tsx --include=*.mjs app lib | head -30; echo \"=====ABSENSI DOC=====\"; sed -n 95,135p docs/PANDUAN_ABSENSI.md; echo \"=====SECURITY NOTES=====\"; grep -n \"storage\\|Storage\\|VPS\\|upload\" docs/SECURITY_NOTES.md | head -30"
}
```

lib/attendance/photo.ts:15:    /* turbopackIgnore: true */
lib/attendance/photo.ts:54:    const info = await stat(/* turbopackIgnore: true */ path.absolute);
=====ABSENSI DOC=====
- **Hari libur absensi** — tambah tanggal + nama, atau hapus. Tanggal libur tidak dihitung Alpha; record eksplisit tetap tampil.

Perubahan pengaturan memakai optimistic lock `BusinessProfile.version`. Bila pengaturan diubah pengguna lain lebih dulu, simpan ditolak dan perlu muat ulang.

## 5. Penyimpanan foto di VPS

Foto **tidak** disimpan di Supabase Storage. Alurnya:

1. Kamera menghasilkan gambar di browser.
2. Server memvalidasi ukuran (maksimal 5 MB) dan isi gambar dengan `sharp`.
3. Server melakukan re-encode ke **WebP** (maksimal sisi 1280 px, kualitas 82). Metadata EXIF, termasuk GPS dari kamera, hilang.
4. File ditulis ke `ATTENDANCE_UPLOAD_DIR` dengan struktur `userId/tahun/bulan/uuid.webp`.
5. Database hanya menyimpan **path relatif** (`photoPath`), MIME, dan ukuran.
6. Foto disajikan lewat route terautentikasi `/api/absensi/[id]/foto`; pegawai hanya bisa membuka fotonya sendiri, Owner/Developer dapat membuka semua.

Path divalidasi terhadap root, menolak path traversal, path absolut, backslash, segmen tersembunyi, dan ekstensi selain `.webp`.

### Konfigurasi produksi

Tambahkan di environment produksi:

```env
ATTENDANCE_UPLOAD_DIR=/var/lib/askonveksi/attendance
```

Default lokal adalah `./data/attendance` (masuk `.gitignore`). Di produksi **jangan** memakai folder di dalam direktori release/build, karena release baru dapat menghapusnya.

```bash
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/attendance
sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/attendance
```

Pastikan proses aplikasi dapat menulis ke folder tersebut. Folder harus persisten dan ikut backup.

### HTTPS dan header browser

Kamera (`getUserMedia`) dan lokasi (`navigator.geolocation`) hanya berjalan di **secure context**. Produksi wajib HTTPS; `http://localhost` tetap boleh untuk development.

Jika menguji dari HP atau perangkat lain lewat alamat LAN (misalnya `http://192.168.1.10:3000`), browser akan memblokir kamera karena alamat tersebut bukan secure context. Jalankan server development dengan HTTPS:

```bash
=====SECURITY NOTES=====
6:  (exit 1 karena 2 vuln high) sehingga job build/migrate/deploy VPS tidak jalan.


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"process.cwd()\" --include=*.ts --include=*.mjs app lib worker | head -20; echo \"=====README=====\"; cat README.md"
}
```

lib/cms/store.ts:19:  return resolve(process.env.CMS_DATA_DIR || join(process.cwd(), "data/cms"));
lib/cms/media.ts:14:  return resolve(process.env.CMS_UPLOAD_DIR || join(process.cwd(), "data/uploads"));
lib/crm/brand-logo.ts:10:  return normalizePdfImage(new Uint8Array(await readFile(join(process.cwd(), "public/new-logo.webp"))));
lib/attendance/photo.ts:16:    process.env.ATTENDANCE_UPLOAD_DIR || join(process.cwd(), "data/attendance"),
=====README=====
# ERM Askonveksi

Aplikasi operasional internal berbasis Next.js 16, Prisma, PostgreSQL Supabase, dan Supabase Auth. Implementasi saat ini mencakup CRM pipeline, customer, revisi Purchase Order dan invoice, pencatatan DP/lunas, Sales Order immutable, absensi pegawai berbasis kamera, RBAC, serta audit log.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi Supabase/database.
2. Isi `DIRECT_URL` dengan direct connection atau Supavisor session mode. Untuk migration reset CRM 2026-09-02, siapkan storage melalui Storage API, lalu terapkan migration dan buat Prisma Client. Perintah storage mengosongkan serta menghapus bucket bukti persetujuan lama secara permanen.
3. Isi `ATTENDANCE_UPLOAD_DIR` (opsional di lokal, default `./data/attendance`). Di produksi gunakan folder persisten di luar release, misalnya `/var/lib/askonveksi/attendance`.
4. Buat Owner pertama satu kali.
5. Jalankan development server.

```bash
rtk npm run crm:reset-storage
rtk npx prisma migrate deploy
rtk npm run crm:setup-storage
rtk npm run db:generate
rtk npm run bootstrap:owner
rtk npm run dev
```

Untuk menguji kamera absensi dari HP/perangkat lain di jaringan lokal, gunakan HTTPS. Akses lewat alamat LAN biasa (`http://192.168.x.x:3000`) akan memblokir kamera karena bukan secure context.

```bash
rtk npm run dev:https
```

Setelah Owner berhasil login, hapus `BOOTSTRAP_OWNER_PASSWORD` dari environment.

### Data demo Produksi

Setelah migration dan bootstrap Owner selesai, buat masing-masing satu kartu demo Jersey dan Non-Jersey:

```bash
ALLOW_DEMO_DATA=true npm run db:seed:production-demo
```

Script aman dijalankan ulang, menolak berjalan saat `NODE_ENV=production`, dan menandai data dengan awalan `[DEMO]`/`DEMO-`.

## Kontrak akses data

- Supabase SDK hanya menangani Auth dan cookie session.
- Prisma menangani seluruh data aplikasi melalui server.
- Role, status aktif, dan kewajiban ganti password berasal dari `AppUser`, bukan metadata JWT.
- Setiap Server Action memvalidasi input, autentikasi, dan role kembali.
- Tabel aplikasi mengaktifkan RLS serta mencabut akses langsung role `anon`/`authenticated`.
- PO Disepakati, invoice Terbit, dan Sales Order disimpan sebagai dokumen historis yang tidak diedit langsung.
- Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.
- Foto absensi disimpan di filesystem VPS (`ATTENDANCE_UPLOAD_DIR`); database hanya menyimpan path relatif. Foto diambil langsung dari kamera (tanpa unggah galeri), di-reencode ke WebP, dan disajikan lewat route terautentikasi.
- Absensi memakai jam WIB, toleransi keterlambatan, hari kerja, dan kalender hari libur. Owner/Developer mengelola laporan, koreksi, catatan manual, dan pengaturan; Developer tetap memiliki akses penuh ke fitur baru.

## Verifikasi

```bash
rtk npm test
# tes absensi saja
rtk node --test tests/attendance-time.test.mjs tests/attendance-report.test.mjs tests/attendance-validation.test.mjs tests/attendance-storage.test.mjs
rtk npm run db:validate
rtk npm run db:generate
rtk npm run lint
rtk npm run build -- --webpack
```

`@prisma/config` dan `prisma` sementara meng-override dependency transitif yang rentan. Hapus override tersebut setelah Prisma menyediakan rilis stable yang sudah membawa versi patched.

Build webpack disediakan sebagai jalur verifikasi bila Turbopack tidak diizinkan membuka port proses oleh environment sandbox.

Dokumentasi database lebih lanjut tersedia di [docs/PRISMA_SETUP.md](docs/PRISMA_SETUP.md). Panduan absensi, termasuk konfigurasi kamera/HTTPS, penyimpanan VPS, migration, dan backup, tersedia di [docs/PANDUAN_ABSENSI.md](docs/PANDUAN_ABSENSI.md). Keputusan terbaru pipeline CRM tersedia di [PipelineCRM_Baru.md](PipelineCRM_Baru.md).


---

## Assistant

_Thinking:_

I have enough. Now I need to respond: "baca dan pahami file ... dengan detail dan rinci". They want confirmation of understanding. I should summarize my understanding in detail, showing I read it, and importantly surface discrepancies/gaps found by verifying against actual code — that's valuable. Since in plan mode, discuss directly, no file changes. I should also present the open decisions (section 14) and maybe ask them (question tool). The user's instruction is to read and understand. I'll give a structured, detailed explanation of my understanding: goal, architecture, why safe, inventory, phases, risks, and a verification report with findings (accurate vs. needs correction). Then ask for decisions on section 14 so we can proceed.

Let me be precise about the findings:

Verification confirmed:
- 4 buckets + limits (crm-po-designs 5MB any MIME; business-assets 2MB images; whatsapp-media 10MB; payment-proofs 5MB) — matches setup script.
- No getPublicUrl/createSignedUrl anywhere.
- Exactly 23 `storage.from` call sites in app/lib (count? Let me count). Writes: master-data 5 (3 uploads? actually 2 uploads + 2 removes), whatsapp 2, crm 1, production 4, design 1, payment-proof 2 = 17? plus reads. Not needed exact.
- 13 read routes exactly as listed.
- Worker 3 points at lines ~214, ~261, ~610.
- Test assertions at lines 1049-1071 and 1627; business-profile L57-67.
- deploy.yml only copies worker/whatsapp.mjs, verifies tarball entries.
- attendance/cms patterns and `askonveksi` user in docs.

Discrepancies/gaps to correct in the plan:
1. Counting: §2.2 header says 6 files (correct: 6 files) but 9 write points; §5.2 says "20 file" but lists 21; §6 Fase 2 says 19 app files (correct 6+13).
2. Test breakage detail: `storageScript` there is `scripts/reset-crm-storage.mjs` and its `/crm-po-designs/` assertion will NOT break. What breaks: `/storage\.from\(BUCKET\)/` and `/storage\.upload\(attachment\.path/` in design.ts. Also `assert.match(action, /business\/signature-\$\{randomUUID\(\)\}/)` won't break if path building stays. Also `tests/production-*` tests may inspect production.ts source? Let me check whether other tests assert on storage patterns, e.g. production-design-detail / production-workflow. Let me quickly grep tests for `storage.` and `arrayBuffer` etc. I should check to be thorough.

3. `erpGet` data type: Buffer vs Blob — call sites use `await data.arrayBuffer()` in R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13; all need `data` used directly. Doc says wrapper "mimics {data,error} minimizing changes" but data shape differs; also `data.type` used in R7/R8. Present as expected but should be explicit.

4. `putFile` atomicity vs `wx` contradiction: temp+rename cannot implement `upsert:false` via `wx` on the temp file. Recommend: write temp then `link(temp, final)` (EEXIST → duplicate error) then unlink temp; for upsert:true use rename. Also handle EXDEV not needed (same dir).

5. Hybrid dual-write failure semantics: §10 claims rollback is always safe; but §3.3B says Supabase write failures are "best-effort logging". That breaks the guarantee. Recommend: fail the whole put if either write fails during hybrid (VPS primary, then Supabase; if Supabase fails, delete VPS? or return error and cleanup), or at least alert + track. Similarly remove best-effort may resurrect stale files on fallback read (low risk). Need decision.

6. Worker env guards: K1 guard uses Supabase env, K2 same, K3 throws without Supabase env; must become driver-aware (`ERP_STORAGE_DRIVER`). Doc says "guard env" preserved — needs rewording.

7. `.env.example` — add ERP vars; note `.gitignore` covers `/data/`. Confirmed.

8. Turbopack: attendance uses `/* turbopackIgnore: true */` because dynamic fs access; local-store.mjs should do the same (doc missing). Also CMS produces warnings. Worth adding to plan so build doesn't regress with warnings; not fatal but noted in TRACKING.

9. TypeScript: importing .mjs from TS works (allowJs true, allowImportingTsExtensions), but `.mjs` isn't in tsconfig `include`; imported files still get analyzed. Recommend JSDoc types or a companion `.d.ts` to get real types for `erpPut/erpGet`. Or make `erp-storage.ts` do the typing.

10. `getFile` null on invalid path vs error distinction: call sites currently check `if (error) 404`. Wrapper returns `{data:null,error}`; okay. But `erpExists` must replicate Supabase `exists` error 400/404 semantics in hybrid (W2 uses `snapshot.error.status`). With local-first, `exists` returns false on missing. Fine but must not treat permission errors as false. Detail.

11. Risk not covered: file permission/ownership when deploy runs as deploy user vs app user; `install -d` done Fase 0.

12. Another gap: the doc says all files are ERP binaries; but `public/new-logo.webp` fallback and default brand logo are repo files — not migrated, fine.

13. Missing "route R13 content-disposition uses DB mime" already noted.

14. Missing cross-check: `lib/payment-proof.ts` has `import "server-only"`; new erp-storage.ts should also be server-only (important: prevent client bundling). Doc doesn't mention. Recommend `import "server-only"` in erp-storage.ts and maybe local-store guard.

15. `payment-proofs` bucket MIME list includes PDF etc. Fine.

16. Also worth noting: `app/api/crm/purchase-order/[id]/pdf/route.ts` reads legacy PO attachments `purchaseOrderAttachment` paths in `crm-po-designs` — the layout doc has "(path lampiran PO lama bila ada)" — good.

17. Doc says `scripts/migrate-storage-to-vps.mjs` needs `dotenv` and supabase js "already there". Yes both in devDeps/deps; note `@supabase/supabase-js` is a prod dep, `dotenv` is devDependency. `npm ci --omit=dev` in runbook would omit `dotenv` → script fails! That's a real bug: §7 runbook says `npm ci --omit=dev`, but `dotenv` is in devDependencies. The migrate script imports "dotenv/config" (as setup script does). With `--omit=dev`, dotenv won't be installed. Options: use `node --env-file` or install full deps, or read env manually. Great catch. Note that `npm ci --omit=dev` also may run postinstall (`prisma generate`) which requires prisma devDependency... Actually npm ci --omit=dev still runs postinstall? It runs lifecycle scripts; `npm run db:generate` uses prisma CLI (devDependency) → would fail. Let me check package.json postinstall = `npm run db:generate && npm run export:vendor`; with omit=dev, prisma CLI not installed → postinstall fails. Hmm, in npm, `--omit=dev` skips dev deps but scripts run; `prisma` binary may be absent → postinstall fails. Also `@prisma/client` is a prod dep but `prisma` CLI dev. So the runbook command is broken. Better: use a separate env loader (dotenv via `node --env-file`) or `npm ci --ignore-scripts --omit=dev` and `node --env-file=$DEPLOY_PATH/shared/.env scripts/...`. Actually script imports "dotenv/config" itself, so `--env-file` doesn't help the import failure. Could add a fallback env parser. This is worth flagging strongly.

18. `npm ci` in clone: `npm ci --omit=dev` will fail at postinstall due to prisma generate missing CLI? Let's verify: `prisma` is devDependency, `npm ci --omit=dev` doesn't install it, so `npm run db:generate` → `prisma generate` → "prisma: not found" → exit 1. So runbook definitely needs fixing (use `npm ci --ignore-scripts --omit=dev` plus dotenv issue, or install all deps). Better option: run the migration from the deployed release's environment? The release has standalone node_modules; but the script is in repo and not in release. Simplest: clone and `npm ci` full (needs dev deps, fine on VPS) and then run. Or write the script to parse env manually (no dotenv) and `npm ci --omit=dev --ignore-scripts`. I'll flag.

19. Another gap: `scripts/migrate-storage-to-vps.mjs` will create files as the executing user. If run as root (common on VPS), ownership becomes root, and the app user can't read (0640, root-owned) → 404s. Runbook must `sudo -u askonveksi` or chown after. Doc's restore does chown, but migration does not. Important.

20. Also the backup tar of `/var/lib/askonveksi` from `dirname SRC` — fine.

21. Backup script: `tar -C "$(dirname "$SRC")" ...` where SRC may be relative (./data/erp-storage) — dirname is `.` → fine.

22. Rotation `tail -n +15` keeps 14 files (deletes from 15th) — correct.

23. Restore step `sudo systemctl stop <pm2-app>` is wrong, project uses PM2, not systemd. It says "(atau pm2 stop semua)" so okay but sloppy. Also extract path: tar created with `-C dirname SRC` and `basename SRC` = `storage`, so extracting `-C /var/lib/askonveksi` is correct only if SRC=/var/lib/askonveksi/storage. Doc notes default. Fine.

24. `docs/PANDUAN_STORAGE_ERP.md` new doc — fine.

25. `README.md` currently says "Lampiran desain PO berada di bucket privat" — should update as doc says.

26. Add `ERP_STORAGE_DIR`/`DRIVER` to deploy? No, shared/.env.

27. Also: tests use source assertions; when refactoring, tests reading route sources (e.g., production tests) might break. Let me grep tests for relevant patterns to catch additional breakages the doc missed. Let me check tests for `storage` mentions.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"storage\\|arrayBuffer\\|downloaded\\|upload(\" tests/*.test.mjs | grep -v \"attendance-storage\\|cms-\" | head -60"
}
```

tests/crm-validation.test.mjs:1051:  const storageScript = await readFile(new URL("../scripts/reset-crm-storage.mjs", import.meta.url), "utf8");
tests/crm-validation.test.mjs:1062:  assert.doesNotMatch(sql, /DELETE FROM storage\./);
tests/crm-validation.test.mjs:1063:  assert.doesNotMatch(sql, /INSERT INTO storage\./);
tests/crm-validation.test.mjs:1064:  assert.match(storageScript, /emptyBucket\(bucketId\)/);
tests/crm-validation.test.mjs:1065:  assert.match(storageScript, /deleteBucket\(bucketId\)/);
tests/crm-validation.test.mjs:1066:  assert.match(storageScript, /crm-po-designs/);
tests/crm-validation.test.mjs:1067:  assert.match(storageScript, /public: false/);
tests/crm-validation.test.mjs:1068:  assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
tests/crm-validation.test.mjs:1071:  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
tests/crm-validation.test.mjs:1072:  assert.match(designActionSource, /storage\.upload\(attachment\.path/);
tests/crm-validation.test.mjs:1106:  assert.doesNotMatch(sql, /(?:DELETE|INSERT|UPDATE)\s+(?:FROM\s+)?storage\./i);
tests/production-design-detail.test.mjs:147:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
tests/production-design-detail.test.mjs:149:  assert.doesNotMatch(overwrite, /storage\.download\(attachment\.path\)/);
tests/production-view-design-images.test.mjs:77:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"payment-proof\\|proofPath\\|proof\" tests/finance-expense.test.mjs tests/crm-validation.test.mjs | head -30; echo \"=====PROD TESTS=====\"; grep -rn \"production.ts\\|originalPath\\|download(\" tests/production-*.test.mjs | head -30"
}
```

tests/finance-expense.test.mjs:138:  assert.match(form, /name=\{`proof_\$\{name\}_\$\{index\}`\}/);
tests/crm-validation.test.mjs:1607:  const routeSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/deposit/proof/route.ts", import.meta.url), "utf8");
tests/crm-validation.test.mjs:1630:  assert.match(detailSource, /deposit\/proof/);
tests/crm-validation.test.mjs:1632:  assert.match(pageSource, /proofMimeType: poDraft\.deposit\.proofMimeType/);
tests/crm-validation.test.mjs:1633:  assert.match(dataSource, /proofFileName: true, proofMimeType: true, paymentMethod/);
tests/crm-validation.test.mjs:1663:  assert.match(actionSource, /type DealFinalizePayment = \{[\s\S]{0,200}paidAt: Date;[\s\S]{0,200}proof: PaymentProof \| null;\s*\};/);
=====PROD TESTS=====
tests/production-design-detail.test.mjs:14:  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
tests/production-design-detail.test.mjs:39:  assert.match(actions, /originalPath/);
tests/production-design-detail.test.mjs:40:  assert.match(actions, /\.exists\(originalPath\)/);
tests/production-design-detail.test.mjs:52:  assert.match(actions, /\.remove\(\[attachment\.originalPath\]\)/);
tests/production-design-detail.test.mjs:53:  assert.match(actions, /originalPath: null/);
tests/production-design-detail.test.mjs:144:  // Byte desain pengganti harus sampai ke originalPath. Kanvas anotasi mode edit dan
tests/production-design-detail.test.mjs:145:  // "Reset perubahan" sama-sama membaca originalPath, sehingga hanya memperbarui path
tests/production-design-detail.test.mjs:147:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
tests/production-view-design-images.test.mjs:33:  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
tests/production-view-design-images.test.mjs:77:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
tests/production-workflow.test.mjs:21:  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),


---

## Assistant

_Thinking:_

Excellent — additional test breakages the doc missed:

- `tests/production-design-detail.test.mjs`:
  - L40 `/.exists\(originalPath\)/` — if refactored to `erpExists(...)`, `.exists(` disappears → breaks. Unless wrapper exposes an object with `.exists`. Hmm. But the doc says port to erpExists. So this test breaks.
  - L52 `/\.remove\(\[attachment\.originalPath\]\)/` — if `erpRemove(DESIGN_BUCKET, [...])` maybe pattern changes → breaks.
  - L147 `/storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/` → breaks.
- `tests/production-view-design-images.test.mjs` L77 same.
- Possibly `production-workflow.test.mjs` — need to see.

So the doc's "test yang wajib diperbarui" list is incomplete: must include `tests/production-design-detail.test.mjs` and `tests/production-view-design-images.test.mjs`, maybe `tests/production-workflow.test.mjs`, `tests/whatsapp-*.test.mjs`, `tests/dashboard-documents.test.mjs`? Let me check those files for source assertions about storage or route content types. Already grep'd "storage|arrayBuffer" over tests; only those. But production-workflow may assert other strings e.g. `originalPath`. Let me check tests referencing routes/headers (R1-R13). Search tests for route paths.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 25,60p tests/production-design-detail.test.mjs; sed -n 130,155p tests/production-design-detail.test.mjs; echo \"=====VIEWIMAGES=====\"; sed -n 60,85p tests/production-view-design-images.test.mjs; echo \"=====WORKFLOW=====\"; grep -n \"originalPath\\|storage\\|upload\\|remove\\|exists\" tests/production-workflow.test.mjs | head -20"
}
```

  assert.doesNotMatch(editor, /disabled=\{isBusy \|\| !savedAnnotations\.length\}/);
  assert.doesNotMatch(actions, /minimal satu keterangan/);
});

test("WO menunggu anotasi produksi sebelum masuk kanban", () => {
  assert.match(schema, /designCompletedAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "designCompletedAt"/);
  assert.match(board, /designCompletedAt: \{ not: null \}/);
  assert.match(detail, /status: \{ not: "CANCELLED" \}/);
});

test("anotasi menyimpan versi sebelum WO dibuka untuk Produksi", () => {
  assert.match(actions, /upsert: true/);
  assert.match(actions, /contentType: "image\/png"/);
  assert.match(actions, /originalPath/);
  assert.match(actions, /\.exists\(originalPath\)/);
  assert.match(actions, /\[400, 404\]\.includes\(snapshot\.error\.status/);
  assert.match(actions, /upsert: false/);
  assert.match(actions, /designAnnotationsSchema/);
  assert.match(actions, /PRODUCTION_DESIGN_VERSION_SAVED/);
  assert.match(actions, /export async function resetProductionDesignAction/);
  assert.match(actions, /PRODUCTION_DESIGN_RESET/);
  assert.match(actions, /annotations: Prisma\.JsonNull/);
  assert.match(actions, /export async function sendProductionDesignAction/);
  assert.match(actions, /designCompletedAt: new Date\(\)/);
  assert.match(actions, /PRODUCTION_DESIGN_SENT/);
  assert.match(actions, /Desain sudah masuk Produksi dan tidak dapat diubah/);
  assert.match(actions, /\.remove\(\[attachment\.originalPath\]\)/);
  assert.match(actions, /originalPath: null/);
});

test("Detail Desain dan PDF memakai gambar desain yang disetujui", () => {
  assert.match(nav, /href: "\/detail-desain"/);
  assert.match(designList, /rounded-lg border bg-card/);
  assert.match(designList, /border-b p-4/);
  assert.match(designList, /DebouncedSearchInput/);
  assert.match(editor, /onMouseLeave=\{readOnly \? undefined : finishDrawing\}/);
  assert.match(editor, /onDblClick=\{readOnly \? undefined : \(event\) => \{ event\.cancelBubble = true; editNote\(note\); \}\}/);
  // Teks anotasi dapat dipisahkan dari panah: node teks bisa diseret sendiri.
  assert.match(editor, /beginDrag\(note\.id, "text", note\.textX, note\.textY\)/);
  assert.match(editor, /if \(current\.kind === "text"\) return \{ \.\.\.note, textX: x, textY: y \}/);
});

test("mengganti desain menulis ulang salinan aslinya dan memuat ulang pratinjau", () => {
  const overwrite = actions.slice(
    actions.indexOf("export async function overwriteProductionDesignAction"),
    actions.indexOf("export async function resetProductionDesignAction"),
  );
  assert.ok(overwrite.length > 0);

  // Byte desain pengganti harus sampai ke originalPath. Kanvas anotasi mode edit dan
  // "Reset perubahan" sama-sama membaca originalPath, sehingga hanya memperbarui path
  // dan originalName membuat nama file berganti tetapi gambar yang tampil tetap lama.
  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
  // Salinan desain lama sengaja tidak dipertahankan karena desainnya memang diganti.
  assert.doesNotMatch(overwrite, /storage\.download\(attachment\.path\)/);
  assert.match(overwrite, /annotations: Prisma\.JsonNull/);
  assert.match(overwrite, /originalName: file\.name\.slice\(0, 255\)/);

  // Redirect tidak me-mount ulang editor, jadi URL gambar memakai token yang
  // diturunkan dari path penyimpanan: path baru setiap desain diganti, sehingga
  // gambar pasti dimuat ulang tanpa bergantung pada status transisi React.
=====VIEWIMAGES=====

test("D2: upload revisi desain memakai validasi gambar bersama", () => {
  assert.match(designActions, /designImageContentType\(file\.name, bytes\)/);
  assert.match(designActions, /designImageRejection\(file\.name\)/);
  assert.match(designActions, /designImageExtensionFor\(contentType\)/);
  assert.doesNotMatch(designActions, /photoshop|psd/i);
});

test("D2: ganti desain Produksi memakai validasi gambar bersama", () => {
  const overwrite = productionActions.slice(
    productionActions.indexOf("export async function overwriteProductionDesignAction"),
    productionActions.indexOf("export async function resetProductionDesignAction"),
  );
  assert.ok(overwrite.length > 0);
  assert.match(overwrite, /designImageContentType\(file\.name, bytes\)/);
  assert.match(overwrite, /designImageRejection\(file\.name\)/);
  assert.match(overwrite, /designImageExtensionFor\(contentType\)/);
  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
  assert.doesNotMatch(overwrite, /photoshop|psd/i);
  // Salinan asli dan Reset memakai tipe gambar hasil deteksi, bukan selalu PNG.
  assert.match(productionActions, /sniffImageContentType\(originalBytes\) \?\? "image\/png"/);
  assert.match(productionActions, /restoredContentType = sniffImageContentType\(originalBytes\)/);
});

test("D2: pratinjau menampilkan PNG dan JPEG", () => {
  assert.match(designDetail, /DESIGN_IMAGE_CONTENT_TYPES = \["image\/png", "image\/jpeg"\]/);
=====WORKFLOW=====


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"api/desain\\|api/whatsapp/media\\|business-profile/logo\\|business-logo\\|deposit/proof\\|/proof\\|/bukti\\|kwitansi\" tests/*.test.mjs | head -40"
}
```

tests/business-profile.test.mjs:26:  readFile(new URL("../app/api/crm/payment-transactions/[id]/kwitansi/route.ts", import.meta.url), "utf8"),
tests/business-profile.test.mjs:90:test("PDF kwitansi menampilkan gambar tanda tangan dari snapshot invoice", () => {
tests/business-profile.test.mjs:99:test("kop invoice & kwitansi jatuh ke profil terkini bila snapshot masih kosong", () => {
tests/business-profile.test.mjs:108:    assert.ok(receiptRouteSource.includes(fallback), `route kwitansi harus menjatuhkan ${fallback}`);
tests/business-profile.test.mjs:125:test("template kwitansi mengikuti referensi (slip 28,5 x 9 cm, kop, tiga baris)", () => {
tests/business-profile.test.mjs:136:    assert.match(receiptRouteSource, new RegExp(field), `route kwitansi harus memilih ${field}`);
tests/crm-validation.test.mjs:1274:  assert.doesNotMatch(invoiceDetail, /payment-transactions\/\$\{transaction\.id\}\/kwitansi/);
tests/crm-validation.test.mjs:1275:  assert.match(deliveryActions, /api\/crm\/payment-transactions\/\$\{receipt\.id\}\/kwitansi/);
tests/crm-validation.test.mjs:1280:  // Tab Invoice pada peluang memakai komponen yang sama: kwitansi tampil sebelah Lihat PDF.
tests/crm-validation.test.mjs:1607:  const routeSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/deposit/proof/route.ts", import.meta.url), "utf8");
tests/crm-validation.test.mjs:1630:  assert.match(detailSource, /deposit\/proof/);
tests/crm-validation.test.mjs:1632:  assert.match(pageSource, /proofMimeType: poDraft\.deposit\.proofMimeType/);
tests/crm-validation.test.mjs:1633:  assert.match(dataSource, /proofFileName: true, proofMimeType: true, paymentMethod/);
tests/production-view-design-images.test.mjs:36:  readFile(new URL("../app/api/desain/[taskId]/attachments/[attachmentId]/route.ts", import.meta.url), "utf8"),


---

## Assistant

_Thinking:_

Additional test breakages:
- production-design-detail.test.mjs L40 `.exists(originalPath)`, L41 `[400, 404].includes(snapshot.error.status`, L42 `upsert: false`, L52 `.remove([attachment.originalPath])`, L147 `storage.upload(originalPath, ...)`.
- production-view-design-images.test.mjs L77 same.
- Also maybe `tests/crm-validation.test.mjs` L1072 `storage.upload(attachment.path`.

Wait, L41 `[400, 404].includes(snapshot.error.status` — if refactored to erpExists with different error shape, test breaks. The doc only listed 2 test files. So it missed 2 more test files (and possibly more).

Also `tests/whatsapp-messages.test.mjs` might inspect actions/whatsapp.ts for storage. grep showed no storage matches, so fine. Let me check for `outbound/` maybe. And `production-view-design-images.test.mjs` reads route source; check its assertions on route content type etc. Could break if route changes; but assertions may not include storage strings except L77. We'll note.

Now, the user asked to read and understand in detail. I should present:
- Confirmation of understanding (the whole plan summarized).
- Audit verification results: what's confirmed accurate, what's inaccurate/incomplete, plus risks not covered.
- Then ask the 5 decisions (section 14) — maybe use question tool? The user hasn't asked to decide yet; they asked to read and understand. But a natural next step is to resolve decisions. The plan doc says implementation starts after decisions. Since we're in plan mode, I can ask. However, the user only asked to read. I'll provide the review and end with the 5 decisions as a compact list, inviting answers. Maybe using question tool would be good but it only supports up to 5 questions and multiple options. That could be nice, but might be overkill; the user may want to discuss. I think a concise summary + findings + explicit requests for confirmation is appropriate. Since the instruction says "Discuss the plan with the user directly in the conversation", asking via tool is allowed. But 5 questions with options could be helpful. Yet the main goal is "baca dan pahami" — I should demonstrate understanding first.

I'll keep the response structured but not overly long. Include concrete file/line references for the gaps. Provide a "koreksi yang saya usulkan ke dokumen" list. Then list decisions.

Let me double check the count of routes: 13 confirmed. Write files: design.ts, production.ts, crm.ts, master-data.ts, whatsapp.ts, lib/payment-proof.ts = 6 files, 9 write points. App call sites = 19.

Let me also verify the claim about `storage.exists` used only in production.ts — grep.

Also check `metadata.size` in Supabase list? Not needed.

One more check: the doc's W8 says upload + remove if enqueue fails; confirmed. W7 says old file intentionally not deleted; confirmed.

Let me count 5.2 rows exactly to state 21. Rows: design, production, crm, master-data, whatsapp, payment-proof (6), 13 routes (19), worker (20), deploy (21). Yes.

Now the `npm ci --omit=dev` issue: verify package.json postinstall and dotenv devDep. dotenv is devDependencies (yes). script imports dotenv/config. So on VPS clone with `npm ci --omit=dev`, postinstall runs `prisma generate` — prisma CLI is devDep, so fails. Actually npm behavior: `npm ci --omit=dev` still installs dev deps for lifecycle? No — it omits them, then runs `postinstall` of root; script calls `prisma` which may resolve from global? Not guaranteed. So likely fails. Also `sync-export-vendor.mjs` uses maybe exceljs (prod dep). So flag it.

Alternative: run migration using the current release (`$DEPLOY_PATH/current/node_modules/@supabase/supabase-js` and dotenv) by copying script there? Or use `npx --yes dotenv`? Simpler recommendation: run `npm ci` (full) in /tmp clone, or `node --env-file=... scripts/migrate...` with the script not importing dotenv (use conditional import). I'll suggest: script should load env via `node --env-file` (Node 24 supports) and drop `import "dotenv/config"`, then `npm ci --omit=dev --ignore-scripts` works. Note Node 24 supports `--env-file`, yes.

Also ownership: run as app user or chown.

Another potential issue: `ERP_STORAGE_DIR` default `./data/erp-storage` is relative to cwd. In `local-store.mjs`, resolving at import time vs call time matters if tests change env after import. The attendance test sets env before dynamic import. Doc's test pattern does same. Fine; but recommend lazily resolving per call (attendance does lazy via function). Fine.

Another: hybrid read fallback logging on every request for old files could flood logs; throttle or count. Minor.

Also: `erpGet` fallback for an invalid path: resolveSafe rejects → should NOT fall back to Supabase (otherwise a malicious path could hit Supabase). Important security detail: local invalid path must be treated as not found and never forwarded to Supabase. The doc doesn't state this. Worth flagging: in hybrid, `resolveSafe` rejection must short-circuit to `data:null, error` and not fall back, else path traversal protection is bypassed for Supabase (Supabase would reject too, but still).

Also: MIME sniff. Routes that currently use DB contentType stay. R7/R8 switch to extension inference — fine.

R1 comment mentions supabase blob. Wrap.

Another: `erpExists` in hybrid: check VPS AND Supabase? For W2, exists(originalPath) used to decide whether snapshot exists before download. If VPS says false but Supabase has it, do we skip? In hybrid the snapshot may be in Supabase only (pre-backfill) → exists must check VPS then Supabase fallback, else it would re-create a snapshot and possibly fail with upsert:false. Actually W2 then does download(attachment.path) and upload(originalPath, ..., upsert:false); if exists returns false but Supabase has it, upload with upsert:false to both could fail. The current code tolerates copyError if `exists` after is true. In hybrid, erpExists should check both. The doc doesn't specify. Flag it.

Also `erpExists` semantics returning `{data, error}` with `.error.status` is used by tests. If we change tests, fine, but plan needs concrete shape.

Another: The worker's `storeInbound` uploads into `whatsapp-media` but `downloadMediaMessage` cap 5MB; bucket limit 10MB. fine.

Another: Worker `processAccountDeletion` handles 500 messages per run; files removed in chunks. For local, use removeFiles. fine.

Another: Deploy verification: also add `./lib/storage/local-store.mjs` and maybe a check that worker imports it. Fine.

Another: The doc says "5.1 File baru (7)" but `FILE_TO_VPS.md` already exists (it's untracked). Also is `docs/PANDUAN_STORAGE_ERP.md` a new doc. Fine.

Another: the doc says `tests/erp-storage.test.mjs` follows attendance pattern; Node's test runner globs `tests/*.test.mjs`; fine.

Now, about `tests/crm-validation.test.mjs` L1627: statement says "route deposit cocok /PAYMENT_PROOF_BUCKET/". If we keep exporting it and the route keeps importing it, no break. Actually if route changes to `erpGet(PAYMENT_PROOF_BUCKET, ...)` it still contains `PAYMENT_PROOF_BUCKET`. So it won't break. Good.

Business-profile test L67 `assert.match(signatureRouteSource, /business-assets/)` breaks if route uses constant. But wait, `signatureRouteSource` is the signature route, which currently hardcodes `"business-assets"`. If changed to `BUSINESS_ASSETS_BUCKET`, breaks. Unless constant name contains "business-assets" string? No. Confirmed break.

Also business-profile test might have assertion about `action` containing remove? Let's look at L57-67: asserts `action /business\/signature-\$\{randomUUID\(\)\}/`, `removeSignature`, helper magic bytes, page input, route `/business-assets/`. Only last breaks (assuming path building retained).

Now the test in crm-validation ~L1071-1072 will break. Confirmed.

Additional test files missed: production-design-detail (3-4 assertions), production-view-design-images (1 assertion). Let me be precise about which assertions:
- production-design-detail L38-42: `upsert: true`, `contentType`, `originalPath`, `\.exists\(originalPath\)`, `[400,404].includes(snapshot.error.status`, `upsert: false`. Refactor to erpPut/erpExists changes `.exists(` and `snapshot.error.status` and `storage.upload(...)`. L52 `.remove([...])`. L147.
- production-view-design-images L77.

Maybe also L52 in production-design-detail. Yes.

Let me verify the exact section around L130-150 of production-design-detail; done.

Also `tests/production-design-detail.test.mjs` might assert `.remove([nextPath])` etc. Not in grep because it uses `actions` and `.remove(` only found L52. Fine.

Do any tests assert `storage` in `app/actions/whatsapp.ts`? No.

Do any tests assert route headers/content types for R13? Let's grep `nosniff` or `private, no-store` in tests. Not necessary.

OK. One more subtlety: the doc claims "tidak ada perubahan path di baris mana pun" — true, but the local layout inserts bucket name as top-level dir. Confirmed.

Another point: `lib/payment-proof.ts` has `import "server-only"`; routes importing `PAYMENT_PROOF_BUCKET` from it pull in server-only (fine, they're server). New `erp-storage.ts` should be `server-only`.

Another: `erp-storage.ts` importing `local-store.mjs` with `@/lib/storage/local-store.mjs` alias — Turbopack/webpack resolves. For worker, relative path. Fine.

Another: `process.env.ERP_STORAGE_DRIVER` default supabase; for worker, if not set, should default to... doc says follow env. On VPS set hybrid. Locally worker without env would use supabase — consistent. But worker only has fs logic for local media; in `supabase` mode it keeps existing Supabase path. Fine, but the worker module would need both branches. The doc's wording "worker hanya membutuhkan mode local/hybrid-put/hybrid-get sederhana" suggests it has local + supabase.

Now, is there a risk in writing to VPS from app when ERP_STORAGE_DIR missing/default `./data/erp-storage` in production? Default driver is supabase, so no local writes unless hybrid/local. But if driver=hybrid and ERP_STORAGE_DIR unset, it writes to `<release>/data/erp-storage` which gets deleted on deploy. Risk! The doc sets ERP_STORAGE_DIR in shared/.env, but there's no guard. Recommend hard failure in production if driver != supabase and ERP_STORAGE_DIR is not absolute/outside cwd. Good point: add validation `if (NODE_ENV==='production' && driver!=='supabase' && !ERP_STORAGE_DIR absolute) throw`. Worth flagging as risk #11.

Also `ERP_STORAGE_DRIVER` invalid value should throw, not silently default.

Also worker could be started with cwd release and no ERP_STORAGE_DIR → writes inside release. Same guard.

Another risk: backups include files written while tar runs → inconsistent tar? Minor; could mention. Not necessary.

Another: `.env.example` uses `/var/lib/...` as default value which would be copied to local .env and break local (permission denied). The existing `.env.example` for attendance uses `./data/attendance`, with comment for prod. The doc proposes `ERP_STORAGE_DIR=/var/lib/askonveksi/storage` in `.env.example` with a comment "lokal: ./data/erp-storage". That's inconsistent with existing convention and could cause local dev failures if copied verbatim. Recommend `.env.example` value `./data/erp-storage` and document prod value. Good catch.

Also `.env.example` comment "juga diset di shared/.env" fine.

Let's also verify Next.js version docs requirement — AGENTS says read node_modules/next/dist/docs before writing code. Not needed now; mention that implementation will consult docs for route handler conventions (already existing routes).

Now, is `fileSizeLimit` for crm-po-designs 5MB but design.ts MAX_BYTES 5MB; WA 10MB but worker caps inbound 5MB. Doc states cap 5MB inbound. Good.

Let me also double check `app/actions/design.ts` `BUCKET` and `prepareAttachments` path — `design/<taskId>/<uuid>`. Fine.

One more subtle drift: Supabase `remove()` returns `{data, error}` and in W1 `await storage.remove(uploaded)` without checking; wrapper's `erpRemove` should mirror. Fine.

Also W3 `storage.remove([nextPath])` on snapshot error; hybrid remove must delete both. Fine.

Also note: In hybrid, uploading originalPath with `upsert:false` when VPS already exists but content differs → `wx` fails, matching Supabase failure. Then code checks exists → true → continues. Fine.

Another: `putFile` for `upsert:true` with rename may change inode; readers using open handle unaffected. Fine.

Another: content type sniffing on read for R1; unchanged.

Now, what about `lib/design/image.ts` `sniffImageContentType` — not relevant.

I think I have a comprehensive review. Let me also quickly verify the number of `storage.from` call sites? Not necessary.

Now formulate the answer in Indonesian (user writes Indonesian). Structure:

1. Ringkasan pemahaman (short but detailed).
2. Hasil verifikasi terhadap kode (what matches).
3. Temuan: yang perlu dikoreksi/diperjelas (numbered, with file refs).
4. Keputusan yang saya butuhkan (section 14 + maybe 2-3 new ones: hybrid failure semantics, guard env, runbook npm ci/owner).
5. Statement that I won't modify files; in plan mode.

Keep it readable. Use bullet lists and tables maybe. Avoid excessive length but the user asked "detail dan rinci". I'll aim for ~120-180 lines of markdown.

Also note: I should not create plan files. I won't.

Let me write the response.

Key numbers:
- 4 buckets verified, all private, limits.
- 23(?) `storage.from` occurrences. Let me count from grep: master-data 5, whatsapp action 2, crm 1, production 4, design 1, WA media route 1, PO attachment route 1, deposit route 1, penjahit route 1, PO pdf 3, invoice pdf 2, kwitansi 1, public logo 1, signature 1, logo 1, desain route 1, keuangan bukti 1, payment proof route 1, deposit proof route 1, payment-proof.ts 2, worker 3. Total = let's add: 5+2=7, +1=8, +4=12, +1=13, +1=14, +1=15, +1=16, +1=17, +3=20, +2=22, +1=23, +1=24, +1=25, +1=26, +1=27, +1=28, +1=29, +1=30, +1=31, +2=33, +3=36. So 36 call sites. Don't need exact; say "seluruh titik yang memakai Supabase Storage terverifikasi ada; tidak ada yang lolos dari peta" — but I should be careful: did I find any not in the doc? The doc lists all `storage.from` sites. Yes all accounted: 6 write files (with 9 ops), 13 routes, worker 3. The doc's listing matches exactly. Good.

Wait: `lib/payment-proof.ts` write is W9; its reads are via routes. Good.

Also check whether `app/api/crm/purchase-order/[id]/pdf/route.ts` has `const storage = createAdminClient().storage;` — a different shape. Doc mentions R4.

Now the "tests that will break" list:
- tests/crm-validation.test.mjs L1071, L1072 (design.ts assertions). L1066 etc. remain.
- tests/business-profile.test.mjs L67 (and maybe action assertions stay).
- tests/production-design-detail.test.mjs L40, L41, L42, L52, L147.
- tests/production-view-design-images.test.mjs L77.
Possibly `tests/production-design-detail` L38 `upsert: true` still appears if erpPut call uses `{ contentType, upsert: true }`; likely still matches `upsert: true` but L147 explicit `storage.upload` breaks.

Also `tests/crm-validation.test.mjs` L1627 `PAYMENT_PROOF_BUCKET` stays if export kept. Fine.

And maybe tests that assert route uses `createAdminClient`? grep? Let me quickly check for `createAdminClient` in tests. Probably none. I'll not claim.

Also check `tests/business-profile.test.mjs` for "bucket privat" assertions on action path and removeSignature; those stay.

One more: The doc says "19 file call site app" but `app/actions/master-data.ts` etc. Yes 19.

Another important missing item: the `erp-storage.ts` will be imported by `lib/payment-proof.ts` which is imported by `app/api/...` routes; `server-only` fine.

Another: `worker/whatsapp.mjs` uses `createClient` from supabase; in local mode still needed for other features? The worker may use Supabase only for storage. Let me check `createClient` usage: at storeInbound, deletion, send job. If local, could skip, but keeping is fine (Postgres via Prisma, not Supabase client). Actually worker imports `createClient` only for storage (3 places). If we go local, could remove dependency entirely, but keeping for hybrid rollback is fine.

Another: `WHATSAPP_MEDIA_BUCKET` env override in worker and doc's `WHATSAPP_MEDIA_BUCKET` constant. Good.

Deployment: the worker's `--cwd` is `$CURRENT_LINK`, but the script path is `$CURRENT_LINK/worker/whatsapp.mjs`; relative import from module resolves relative to the module file, not cwd. Either way same. Fine.

Now potential build issue: `local-store.mjs` is a `.mjs` inside `lib/`; Next's server bundler will include it via import. In standalone output, the module is bundled (not copied separately) for the app. Worker needs the copied file. Good.

One more: `next build` runs `npm run export:vendor` prebuild; not affected.

Also, `test` script runs `node --test tests/*.test.mjs`, which will include `tests/erp-storage.test.mjs`; Node 24 can import `.mjs` directly. Fine.

Now write the final response. Also mention plan mode: I won't edit anything.

Let me be careful with the claim "storageScript assertion won't break": `tests/crm-validation.test.mjs` L1066 asserts `storageScript` (reset script) contains `crm-po-designs` — unchanged. So correct.

I should also mention the `.env.example` convention issue (attendance uses ./data/attendance).

Let me draft.

Structure:

## Yang saya pahami
- Tujuan, prinsip path tetap, 3 driver, hybrid rollback, no static serving, no schema change.
- Peta 6 write files/9 ops, 13 routes, 3 worker points, deploy constraint, 6 phases with gates.

## Verifikasi ke kode (cocok)
Bullets with confirmations.

## Temuan yang perlu dikoreksi sebelum eksekusi
1. Jumlah file (6 vs 9, 20 vs 21).
2. Daftar test yang patah belum lengkap (add 2 files + exact assertions).
3. `putFile` atomic vs `wx` contradiction → use `link()`.
4. Hybrid dual-write "best-effort" vs rollback guarantee → decide.
5. `erpGet` Buffer vs Blob; `exists` semantics; invalid path must not fall back.
6. Worker guards are Supabase-env-gated → must be driver-aware.
7. Runbook `npm ci --omit=dev` broken (dotenv devDep + postinstall prisma) and ownership risk (root-owned files 0640).
8. `.env.example` default `/var/lib/...` inconsistent; local default should be ./data/erp-storage; add prod guard (absolute path outside release).
9. Turbopack dynamic fs warnings → turbopackIgnore pattern; add server-only.
10. Test claim about storageScript (minor).
11. Backup restore uses systemctl while deploy uses PM2 (minor).
12. `erpExists` security/semantics.

Maybe also: log flood fallback; optional.

## Keputusan yang saya butuhkan
- 5 from doc + 4 new (hybrid failure policy, worker import vs inline, env default/guard, runbook approach). Actually doc's #2 covers worker, #3 offsite, #1 grace, #4 retire, #5 user.
New decisions: A) hybrid write failure policy; B) `erpExists` shape/test update approach (adapt tests vs keep API shape mimicking `storage`); C) runbook migration execution (full npm ci vs --env-file no dotenv); D) env default.

Actually for B, there's a smarter option: make `erp-storage.ts` export an object shaped like Supabase's storage client, e.g. `erpStorage(bucket)` returning `{ upload, download, remove, exists }` with identical signatures. Then call sites change only `createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)` and tests that assert `.exists(originalPath)` / `storage.upload(...)` still pass. That's a strong alternative worth proposing — it minimizes diff and keeps existing tests. This is a valuable design suggestion. It would need to return `{ data, error }` with Blob-like or Buffer. Tests only check source text patterns, so `storage.upload(originalPath, bytes, { contentType, upsert: true })` could remain if `const storage = erpStorage(DESIGN_BUCKET)` and `storage.upload(...)` — but `storage.exists(originalPath)` and `.download` too. The tests assert `\.exists\(originalPath\)`, `\.remove\(\[...\]\)`, `storage\.upload\(originalPath, bytes, ...\)`. If we name the local variable `storage`, these all still match. Only `tests/crm-validation` L1071 asserts `storage\.from\(BUCKET\)` which would become `erpStorage(BUCKET)` — tiny test update. And business-profile L67. This is arguably better than `erpGet/erpPut` free functions. The doc chose free functions, causing more test churn. I should recommend the storage-client-shaped API as an option (decision B).

This is a meaningful architectural recommendation:
```ts
export function erpStorage(bucket: string) {
  return {
    upload(path, bytes, opts) -> { error } (with .status for compat)
    download(path) -> { data: { arrayBuffer(): Promise<ArrayBuffer>; type: string } | null, error }
    remove(paths) -> { error }
    exists(path) -> { data: boolean, error }
  }
}
```
To keep `data.arrayBuffer()` working, return a Blob (Node 24 has Blob global) with type. Or return Buffer and update call sites. If we return `Blob` with `type`, *zero* changes in call-site bodies: just swap the client construction. That's very attractive and drastically reduces risk. Node's `Blob` supports `arrayBuffer()` and `type`. Buffers can be wrapped: `new Blob([buffer], { type })`, but that copies memory. Could instead return a custom object `{ arrayBuffer: async () => buf, type }`. Blob copy of ≤10MB is acceptable but wasteful. Custom object is easy and type-compatible with the parts used.

So my recommendation: implement `erpStorage(bucket)` adapter with the same methods/semantics as `supabase.storage.from(bucket)` including `{data,error}` where error has `status`/`statusCode`/`message`, and `data` is Blob-like (`arrayBuffer()`, `type`). Then 19 call sites change only the source object (1 line each), and most existing tests keep passing. Keep `local-store.mjs` for the worker. This is a better plan than the doc's erpGet/erpPut rewrite. I'll present it as an alternative and ask.

Good. That's a strong review contribution.

Also the `exists` error semantics: Supabase `exists` returns error status 400 for invalid path, 404 for missing? Actually `exists` returns `{data:false, error:null}` for missing? Supabase docs: exists returns error if path invalid; for not found it returns `{data:false, error:null}`? The current code handles `snapshot.error && ![400,404].includes(...)` and then `if (!snapshot.data)`. So wrapper should produce same.

Now, for `download` fallback: return a Blob-like with `type` from `contentTypeFromPath` or DB? The wrapper doesn't have DB mime; `contentTypeFromPath` works for biz assets and design; for payment proof DB mime used by route; for WA inbound no extension and route uses DB mime. So `data.type` only needed R7/R8 where extensions exist. Good.

I'll mention this.

Also note the doc's hybrid get fallback logging: fine.

One more check: does `erpStorage(bucket)` adapter avoid changing `storage.from("business-assets")` in R4? It becomes `erpStorage(BUSINESS_ASSETS_BUCKET)`; fine.

Now, the user might just want confirmation; I'll keep the correction list concise but precise, and ask whether they want me to revise FILE_TO_VPS.md accordingly (but I can't edit in plan mode unless asked; if they ask, then I'd need to switch agents? Plan mode says don't create/update plan files unless explicitly asked, and write only in /home/haydar/.opencode/plan. FILE_TO_VPS.md is a repo file, not a plan file — editing it in plan mode would violate "Do not modify any other files". So I'd tell them to switch agents to implement revisions.)

Alright, write the answer in Indonesian.

Length: maybe 100-140 lines. Use headers and tables sparingly.

Let me make sure I don't overstate: "6 file/9 operasi" — yes.

Test additions table:
| File | Assertion | Dampak |
- crm-validation L1071-1072.
- business-profile L67.
- production-design-detail L40-42, L52, L147.
- production-view-design-images L77.

Note L41 `[400,404].includes(snapshot.error.status)` only breaks if error shape changes.

Also mention `tests/crm-validation` L1066 etc. stay (correcting doc).

Now the new decisions:
A. API shape: free functions (doc) vs adapter `erpStorage(bucket)` (recommended).
B. Hybrid failure policy: fail-hard (recommended) vs best-effort.
C. Migration runbook: fix command (recommended `npm ci --ignore-scripts` + `node --env-file`, drop dotenv import) + run as app user/chown.
D. Env default + prod guard.
E. Worker: import shared module (doc rec) vs inline — doc's #2.
Plus doc's five.

Maybe combine and list 7 decisions, marking the doc's ones.

Final: state no files changed, awaiting decisions, and that revision of the doc / implementation requires switching agents.

Let me write.

Saya sudah membaca `FILE_TO_VPS.md` baris 1–496 dan memverifikasi klaim-klaimnya langsung ke kode. Berikut pemahaman saya, lalu temuan yang menurut saya perlu dikoreksi sebelum dokumen ini dijadikan dasar implementasi.

## 1. Pemahaman inti rencana

**Tujuan:** memindahkan seluruh biner ERP dari Supabase Storage ke disk VPS (`/var/lib/askonveksi/storage`), tanpa menyentuh Postgres/Supabase Auth dan **tanpa mengubah satu pun path relatif di DB**. Struktur bucket dipertahankan 1:1: `<ERP_STORAGE_DIR>/<bucket>/<path-lama>`.

**Kenapa aman:** semua penyajian file sudah lewat route API terautentikasi yang membaca via admin client. Tidak ada URL publik/signed URL yang beredar, jadi mengganti sumber byte tidak mengubah URL, header, atau kontrak route.

**Tiga driver:**
- `supabase` (default) = perilaku lama persis;
- `hybrid` = dual-write, baca VPS dulu lalu fallback Supabase;
- `local` = VPS saja.

`hybrid` adalah jaring pengaman: rollback cukup ganti env + restart, termasuk untuk release lama yang masih membaca Supabase.

**Cakupan yang dipetakan:** 6 file penulis (9 operasi tulis), 13 route baca, 3 titik di `worker/whatsapp.mjs`, plus batasan deploy bahwa worker hanya menyalin satu file sehingga modul bersama harus ikut di-tar.

**Fase 0–6** dijaga gate: modul dulu (tanpa call site) → port app dengan driver `supabase` → worker + deploy → hybrid di produksi → backfill + verifikasi + backup → `local` setelah grace period.

Pemahaman saya sudah mencakup invarian keamanan (auth route, anti-traversal, header, semantik rollback, signature lama tidak dihapus, DEVELOPER tetap punya akses) dan larangan serve folder statis via nginx.

## 2. Klaim yang saya verifikasi dan cocok

- 4 bucket + limit + MIME di `scripts/setup-crm-storage.mjs` sesuai tabel §2.1; `quotation-acceptance-proofs` memang sudah retired di `scripts/reset-crm-storage.mjs`.
- Tidak ada `getPublicUrl`/`createSignedUrl` di `app`, `lib`, `worker`, `scripts`.
- 13 route baca yang didaftar memang ada, dan `requireActor`/role-nya sesuai catatan.
- Titik tulis W1–W9 cocok dengan kode, termasuk:
  - `master-data.ts` sengaja **tidak** menghapus file lama (path tersnapshot di invoice);
  - `production.ts` memakai `exists → download → upload(upsert) → remove`;
  - `design.ts`/`crm.ts`/`whatsapp.ts` menghapus file baru bila transaksi/enqueue gagal.
- Worker K1/K2/K3 ada di sekitar baris yang disebut, termasuk chunk `remove` 100 path.
- `deploy.yml` hanya menyalin `worker/whatsapp.mjs` dan memverifikasi tarball per file — risiko `ERR_MODULE_NOT_FOUND` nyata.
- Pola `lib/attendance/photo.ts` dan `lib/cms/media.ts` sudah memakai disk + path relatif + validasi traversal; user `askonveksi` memang dipakai di `docs/PANDUAN_ABSENSI.md`.
- `.gitignore` sudah menutup `/data/`.

## 3. Temuan yang perlu dikoreksi/diperjelas

### 3.1 Kesalahan hitung kecil
- §2.2 berjudul "6 file" — benar 6 file, tetapi berisi **9 operasi** (W1–W9). Sebaiknya ditulis "6 file / 9 titik tulis".
- §5.2 berjudul "20 file", padahal tabelnya berisi **21 baris** (19 call site app + worker + deploy.yml).
- §6 Fase 2 menyebut "19 file call site app" — ini yang benar (6 penulis + 13 route).

### 3.2 Daftar test yang patah belum lengkap
Dokumen hanya menyebut 2 file test. Verifikasi saya menemukan 2 file lagi:

| File | Assertion yang patah |
|---|---|
| `tests/crm-validation.test.mjs` L1071–1072 | `/storage\.from\(BUCKET\)/`, `/storage\.upload\(attachment\.path/` |
| `tests/business-profile.test.mjs` L67 | `signatureRouteSource` cocok `/business-assets/` |
| `tests/production-design-detail.test.mjs` L40–42, L52, L147 | `\.exists\(originalPath\)`, `[400,404].includes(snapshot.error.status`, `upsert: false`, `\.remove\(\[attachment\.originalPath\]\)`, `storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)` |
| `tests/production-view-design-images.test.mjs` L77 | assertion `storage\.upload\(originalPath, ...\)` yang sama |

Catatan: klaim §2.5 bahwa assertion `storageScript` (`/crm-po-designs/`) akan patah **tidak tepat** — `storageScript` di situ adalah `scripts/reset-crm-storage.mjs` yang tidak diubah. Yang patah hanya assertion terhadap `designActionSource`.

### 3.3 Kontradiksi `putFile` atomik vs `wx`
Rencana mewajibkan dua hal yang saling bertabrakan: tulis ke `<path>.tmp-<random>` lalu `rename`, **dan** `upsert:false` memakai flag `wx`. `wx` pada file temp tidak menolak path final yang sudah ada. Implementasi yang benar:
- `upsert:true`: tulis temp → `rename` (atomik);
- `upsert:false`: tulis temp → `link(temp, final)` (gagal `EEXIST` secara atomik) → `unlink(temp)`.

Tanpa koreksi ini, semantik `upsert:false` Supabase tidak tertiru dan W2/W3 bisa menimpa snapshot.

### 3.4 Jaminan rollback hybrid vs "best-effort"
§3.3B menulis kegagalan tulis Supabase di mode hybrid hanya di-log (best-effort), tetapi §10 menjanjikan "salinan Supabase selalu lengkap". Dua pernyataan ini tidak konsisten. Jika Supabase gagal ditulis dan kemudian rollback ke `supabase`, file baru akan 404. Perlu keputusan eksplisit: **fail-hard** (gagalkan operasi + bersihkan VPS) atau best-effort dengan konsekuensi yang diakui.

Hal serupa untuk `remove`: hapus best-effort di dua tempat bisa menyisakan file di VPS/Supabase; pada mode hybrid, fallback baca bisa "menghidupkan" file yang sudah dihapus. Risikonya rendah (path yang dihapus biasanya sudah tidak dirujuk DB), tapi layak dicatat.

### 3.5 Bentuk API wrapper menimbulkan churn yang tidak perlu
Dokumen memilih `erpGet/erpPut/erpRemove/erpExists` bebas. Akibatnya:
- `erpGet` mengembalikan `Buffer`, sedangkan 13 route sekarang memakai `await data.arrayBuffer()` (dan R7/R8 memakai `data.type`) → semua call site harus diubah;
- pola `.exists(originalPath)` dan `.remove([...])` di `production.ts` berubah sehingga test sumber ikut patah.

Alternatif yang lebih kecil risikonya: adapter berbentuk klien, misalnya `erpStorage(bucket)` yang mengembalikan `{ upload, download, remove, exists }` dengan bentuk hasil `{ data, error }` **meniru supabase-js**, di mana `data` adalah objek mirip Blob (`arrayBuffer()`, `type`). Dengan begitu 19 call site hanya berubah di satu baris konstruksi (`createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)`), dan sebagian besar test sumber lama tetap lolos. Ini keputusan desain yang sebaiknya diambil sebelum Fase 1.

### 3.6 Guard env di worker harus diubah, bukan "dipertahankan"
Saat ini:
- `storeInbound` hanya menyimpan media bila `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SECRET_KEY` ada;
- `processAccountDeletion` juga digerbangi env Supabase;
- `performSendJob` melempar error bila env Supabase tidak ada.

Kalau driver `local` tidak lagi membutuhkan Supabase, guard ini harus menjadi driver-aware. Kalimat "pertahankan guard env" di §6/T3.1 menyesatkan dan bisa membuat media tidak tersimpan di mode local.

### 3.7 Runbook migrasi berpotensi gagal
`§7` menyarankan:
```bash
npm ci --omit=dev
node scripts/migrate-storage-to-vps.mjs
```
Dua masalah:
1. Script mengimpor `dotenv/config`, tetapi `dotenv` ada di **devDependencies** → tidak terpasang dengan `--omit=dev`.
2. `postinstall` menjalankan `prisma generate`, sedangkan CLI `prisma` juga devDependency → `npm ci --omit=dev` berisiko gagal saat postinstall.

Perbaikan yang disarankan: hapus ketergantungan `dotenv` di script migrasi dan jalankan dengan `node --env-file=$DEPLOY_PATH/shared/.env`, lalu `npm ci --ignore-scripts` (atau cukup `npm ci` penuh di clone sementara).

Tambahan: jika script dijalankan sebagai `root`, file hasil backfill akan `root:root` mode `0640` dan **tidak terbaca** proses aplikasi. Runbook harus menjalankannya sebagai user aplikasi atau melakukan `chown` setelahnya.

### 3.8 Default env di `.env.example` berisiko untuk lokal
Dokumen menulis `ERP_STORAGE_DIR=/var/lib/askonveksi/storage` di `.env.example` dengan komentar "lokal: ./data/erp-storage". Konvensi yang sudah ada (`ATTENDANCE_UPLOAD_DIR`) memakai default lokal di `.env.example` dan nilai produksi hanya di dokumentasi. Sebaiknya:
```env
ERP_STORAGE_DIR=./data/erp-storage
ERP_STORAGE_DRIVER=supabase
```
Plus guard produksi: jika driver ≠ `supabase` dan `ERP_STORAGE_DIR` tidak absolut / berada di dalam folder release, **gagal keras** saat start. Tanpa guard ini, hybrid dengan env lupa diset akan menulis ke folder release yang terhapus saat deploy.

### 3.9 Detail implementasi yang belum disebut
- **Turbopack**: `lib/attendance/photo.ts` memakai `/* turbopackIgnore: true */` pada akses fs dinamis; modul `local-store.mjs` hampir pasti memicu peringatan yang sama. Tambahkan pola ini agar build tetap bersih (atau setidaknya tidak menambah warning baru).
- **`server-only`**: `erp-storage.ts` sebaiknya diawali `import "server-only"` seperti `lib/payment-proof.ts`, agar tidak pernah ikut bundle client.
- **Path invalid jangan fallback**: pada mode hybrid, path yang ditolak `resolveSafe` harus langsung `data:null,error` dan **tidak** diteruskan ke Supabase. Kalau fallback dilakukan, validasi traversal menjadi tidak berarti untuk jalur Supabase.
- **`erpExists` di hybrid** harus mengecek VPS **dan** Supabase, karena W2 memakai `exists` untuk memutuskan perlu membuat snapshot atau tidak; kalau hanya cek VPS, snapshot lama yang baru ada di Supabase bisa memicu upload `upsert:false` yang gagal.
- **Log fallback** bisa sangat ramai saat backfill belum selesai; sebaiknya di-throttle atau dihitung per periode, bukan per request.
- **§8.3** memakai `systemctl` padahal deployment memakai PM2 — tulis `pm2 stop` sebagai jalur utama.

## 4. Keputusan yang saya butuhkan sebelum lanjut

Dari dokumen:
1. Grace period hybrid: 1 bulan atau 2 bulan?
2. Worker: impor `lib/storage/local-store.mjs` (disarankan) atau inline fs mini?
3. Backup offsite: aktif sekarang atau lokal dulu?
4. Bucket Supabase di Fase 6.3: dihapus atau disimpan kosong sebagai cold copy?
5. User/group PM2 di VPS: `askonveksi`?

Tambahan dari temuan saya:
6. **Bentuk API**: tetap `erpGet/erpPut/...` seperti dokumen, atau adapter `erpStorage(bucket)` yang meniru supabase-js (lebih sedikit churn + test lama lebih aman)?
7. **Kebijakan gagal tulis Supabase di hybrid**: fail-hard atau best-effort? (Untuk menjaga janji rollback, saya sarankan fail-hard.)
8. **Runbook migrasi**: setuju saya ubah ke `node --env-file` + jalan sebagai user aplikasi (atau chown), dan `.env.example` memakai default lokal + guard produksi?

Saya belum mengubah file apa pun — `FILE_TO_VPS.md` masih untracked dan tidak saya sentuh. Kalau ingin dokumen ini saya revisi (hitung, daftar test, semantik hybrid, runbook) atau langsung masuk implementasi, silakan pindah ke agent non-plan; di mode Plan saya hanya bisa mendiskusikan dan tidak menulis file.

---

## User

oke revisi saja terserah sesuai rekomendasi terbaik mu intinya gini

---

## User

oke revisi saja terserah sesuai rekomendasi terbaik mu intinya gini

---

## User

oke revisi saja terserah sesuai rekomendasi terbaik mu intinya gini, semua yang berhubungan dengan gambar masuk ke vps tapi semua yang berhubungan dengan teks itu ada di supabase jadi termasuk nama path gambarnya misal "vps/public/desain/desain1.jpg" nah itu path nya tertulis di supabase tapi gambar aslinya ada di vps, INGAT ITU HANYA CONTOHH buat yang terbaik sesuai rekomendasi mu, buat revisinya jangan masuk ke code dulu

---

## Assistant

_Thinking:_

The user wants me to revise FILE_TO_VPS.md according to my best recommendations. Key clarification: all images/binaries go to VPS; all text data stays in Supabase Postgres; DB stores the image path (e.g., relative path) while the actual image lives on VPS. Don't touch code yet — just revise the document.

So I need to update FILE_TO_VPS.md with:
- Counting fixes (6 files/9 write points, 21 files, 19 app call sites).
- Complete test breakage list including production tests.
- Fix putFile atomic vs wx → link() approach.
- Hybrid failure policy: fail-hard recommended.
- API shape: erpStorage(bucket) adapter mimicking supabase-js, recommended.
- Worker guards driver-aware.
- Runbook fix: npm ci --omit=dev broken; use --env-file, run as app user/chown.
- .env.example defaults local; production guard.
- Turbopack ignore, server-only.
- Path invalid no fallback; erpExists check both.
- Log throttling.
- pm2 stop in restore.
- Emphasize text in Supabase, binaries on VPS, DB stores relative paths (maybe format `crm-po-designs/...` vs example `vps/public/...`). The user's example is just illustrative. I should keep existing relative path semantics (bucket + relative path) since DB paths are unchanged - important. I should add a clear "prinsip data" section: teks (metadata, path, filename, MIME, size) in Supabase Postgres; binary on VPS. Path stored in Supabase remains the existing relative path (`design/<task>/<uuid>.png`, etc.) — no `vps/` prefix in DB. The VPS layout prefixes bucket name, so full location is `ERP_STORAGE_DIR/<bucket>/<db-path>`. Maybe mention that the DB path example is relative and physical location is derived.

Also update section 14 decisions to resolved decisions (with recommendations chosen default), and maybe keep a small list of ops confirmations (user/group, offsite). The user said "terserah sesuai rekomendasi terbaikmu" — so I should pick recommendations and write them as decided. But some are ops facts (VPS user name) can't be known; I'll mark as ops confirmation with default `askonveksi`.

I should rewrite the document thoroughly. It's 496 lines. I'll produce a revised version, keeping structure but improving. Use write tool to replace entire file (it's untracked but exists). Since user says revise only doc, no code.

Let me plan the revised content carefully.

Title: FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS
Status: revisi 2, rancangan, belum implementasi.
Add changelog "Revisi 2" maybe at top with what changed.

Sections:
1. Prinsip & keputusan
   - Pemisahan teks vs biner: Postgres/Supabase = teks (metadata, path, nama file, MIME, ukuran); VPS = byte biner.
   - Path di DB tetap relatif & tidak diubah; lokasi fisik = ERP_STORAGE_DIR/<bucket>/<path DB>.
   - Example: DB `design/<taskId>/<uuid>.png`; disk `/var/lib/askonveksi/storage/crm-po-designs/design/<taskId>/<uuid>.png`. Explicitly say no `vps/` prefix stored in DB.
   - No schema changes.
   - Driver modes.
   - No public static serving.

2. Peta saat ini (with corrected counts)
   2.1 buckets
   2.2 writes: 6 files / 9 points
   2.3 reads: 13 routes
   2.4 worker 3 points + deploy constraint
   2.5 tests affected (complete: 4 files with exact assertions; note what doesn't break)

3. Arsitektur target
   3.1 layout
   3.2 env (with local defaults + production guard)
   3.3 modules:
     A. local-store.mjs API + rules (atomic via link; turbopackIgnore; no throws on get; contentTypeFromPath)
     B. erp-storage.ts adapter `erpStorage(bucket)` mimicking supabase-js, with `data` Blob-like; driver behavior; fail-hard for hybrid writes; exists checks both; invalid path no fallback; server-only; guards.
     C. worker integration driver-aware
   3.4 deploy workflow

4. Invarian keamanan (checklist, expanded: path invalid no fallback, server-only, guard prod)

5. Daftar file
   5.1 new (7)
   5.2 changed (21)
   5.3 light touches
   5.4 untouched

6. Fase implementasi (0-6) with updated tasks
   - Fase 1 test list updated, API adapter
   - Fase 2 19 call sites with one-line swap
   - test updates explicit
   - Fase 3 worker guards
   - Fase 4 hybrid fail-hard
   - Fase 5 backfill with --env-file and ownership
   - Fase 6

7. Runbook migrasi (corrected commands)
   - clone, `npm ci` full or `npm ci --ignore-scripts` + no dotenv; use `node --env-file`
   - run as app user `sudo -u askonveksi -H` or `runuser`
   - dry-run, execute, verify
   - details on list/walk/idempotent/size check.
   - Also ensure script doesn't import dotenv.
8. Backup & restore (pm2 stop; ownership; offsite recommended active)
9. Monitoring (throttled fallback log, disk alert)
10. Rollback (fail-hard makes guarantee true; local→hybrid first)
11. Risks (add new risks: env release path, root ownership, supabase write failure, log flood, worker env guard)
12. UAT
13. Out of scope
14. Keputusan (resolved with chosen recommendations + remaining ops confirmations)
15. Acceptance per phase summary maybe.

Also mention the DB path example semantics, maybe a table of "teks vs biner".

I should be careful: The document is in Indonesian. Keep it.

Let me decide on API shape details:

`lib/storage/erp-storage.ts`:

```ts
import "server-only";
import { ... } from "./local-store.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const PO_DESIGNS_BUCKET = "crm-po-designs";
export const BUSINESS_ASSETS_BUCKET = "business-assets";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";

type StorageError = { message: string; status?: number; statusCode?: string };
type StorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };

export function erpStorage(bucket: string) {
  return {
    async upload(path, bytes, opts): Promise<{ data: {path} | null; error: StorageError | null }>,
    async download(path): Promise<{ data: StorageFile | null; error: StorageError | null }>,
    async remove(paths): Promise<{ data: ...; error: StorageError | null }>,
    async exists(path): Promise<{ data: boolean; error: StorageError | null }>,
  };
}
```

Call site change: `createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)`. Then `storage.upload(...)`, `storage.download(...)`, `.remove([...])`, `.exists(...)` remain unchanged. Tests asserting `.exists(originalPath)`, `.remove([...])`, `storage.upload(...)` still pass. `tests/crm-validation` L1071 `storage\.from\(BUCKET\)` fails (update to `erpStorage(BUCKET)`), and L1072 passes because `storage.upload(attachment.path` remains. Good: only one assertion there. Business-profile L67 fails because route no longer has literal "business-assets"; update to `BUSINESS_ASSETS_BUCKET` or `erpStorage`.

Actually if we define route `const BUCKET = BUSINESS_ASSETS_BUCKET` and use `erpStorage(BUCKET)`, then route source contains `BUSINESS_ASSETS_BUCKET` not `business-assets`. Test update to assert constant import. Fine.

`erpStorage` should probably be cached per bucket? Not needed.

Driver behavior detail:
- `readDriver()` parses env, throws on invalid; in production requires absolute ERP_STORAGE_DIR if driver != supabase, and rejects path inside `process.cwd()`? Actually releases path is outside shared but process.cwd() = release dir; require absolute + not under cwd. Also warn if under `/tmp`? Keep simple: absolute and not inside cwd.
- `supabase`: delegate.
- `local`: local-store only.
- `hybrid`:
  - upload: write VPS → if fail, throw (no Supabase-only fallback), because VPS is primary; then write Supabase → if fail, delete VPS copy (rollback) and throw a UserFacingError? Hmm, cleaning VPS on Supabase failure ensures consistency but the upload might be retried. That's clean fail-hard: either both succeed or neither. But what if delete VPS fails? Log critical. This guarantees rollback safety.
  - Alternative: VPS first, Supabase second, if Supabase fails → keep VPS, log critical and throw? Then a retry may hit upsert:false and fail because VPS exists. Better to remove VPS then throw. But if removal fails, leave. Document.
  - download: VPS first; if null → Supabase; log throttled.
  - remove: remove both; if either fails, log and return error (call sites largely ignore). Since deletes are best-effort by nature, we keep best-effort but document that stale copies may remain; the primary source of truth for existence is DB path, not storage. But in hybrid read fallback could resurrect. Mitigation: for remove, delete VPS first? If VPS delete succeeds and Supabase fails, fallback read can resurrect. To prevent, write a tombstone? Overkill. Alternative: in hybrid, delete Supabase first, then VPS; if VPS delete fails, local still has file — but read VPS first would serve it. Hmm.
    Realistically: deletion happens for rollback cleanup of new files never referenced by DB, or superseded old paths no longer referenced. The only flow where deleted path could be re-read is if DB still points to old path during a failed transaction (and code removes new path, not old). So resurrection isn't reachable in practice. Document as accepted risk with rationale. Keep remove best-effort on both.
  - exists: VPS OR Supabase, replicating error semantics. In hybrid, error only if both checks error.

`download` Blob-like: return `{ data: { arrayBuffer: async () => buffer.buffer.slice(...), type: contentTypeFromPath(path) }, error: null }`. Buffer's `.buffer` may be a pooled ArrayBuffer; safer `new Uint8Array(buffer).slice().buffer` or just return a wrapper that returns `buffer` converted to ArrayBuffer. Simpler: `arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)`. Or return `new Blob([buf], { type })` — Node's Blob is global since 18. `arrayBuffer()` works; `type` works. Memory copy of up to 10MB is okay. Recommend Blob for correctness and zero call-site changes. But Blob copies; fine. Use `new Blob([buf], { type })`. For supabase path, data is already Blob with type.

`upload` return: call sites mostly check `{ error }`; some use `result.error`. Return `{ data: { path }, error }`.

`exists`: Supabase returns `{ data: boolean, error }`; local returns `{ data, error:null }`. In hybrid, true if either; if both false, false.

`remove`: return `{ data: [], error: null }` or error aggregated.

For local error status: use `status: 404` for missing? `exists` on missing should be `{data:false,error:null}` to avoid W2 throwing. For invalid path, `exists` returns `{ data:false, error: { message, status:400 } }` maybe; W2 tolerates 400. In hybrid we must never forward invalid path to Supabase. Document.

`local-store.mjs` API:
- storeRoot()
- resolveSafe(bucket, relativePath) → `{ absolute, relativePath } | null`; validate bucket too! Bucket should match `/^[a-z0-9-]+$/` to prevent traversal via bucket. Good addition.
- putFile(bucket, path, bytes, { upsert }) → throws `EEXIST` with code `STORAGE_EXISTS`? Better define `StorageConflictError` or throw error with `code`. The adapter maps to Supabase-like error `{ message, statusCode: "409" }`. For `upsert:false` use temp + link.
- getFile → Buffer|null
- removeFiles → `{ failed: Array<{path, message}> }`
- fileExists
- contentTypeFromPath

Atomic implementation detail:
```
const dir = dirname(abs); mkdir(dir, {recursive:true, mode:0o750});
const tmp = join(dir, `.tmp-${randomUUID()}`);
await writeFile(tmp, bytes, { mode: 0o640, flag: "wx" });
try {
  if (upsert) await rename(tmp, abs);
  else { await link(tmp, abs); await unlink(tmp); }
} catch (e) { await unlink(tmp).catch(()=>{}); throw e; }
```
mkdir recursive with mode; note umask. Fine.

Validate relative path segments: reject empty, ".", "..", startsWith("."), contains "\0" or "\\", absolute. Reject bucket with wrong chars. Also reject path length > 500? DB varchar 500; fine.
For WA inbound path without extension, content type passed by caller; `contentTypeFromPath` returns octet-stream but routes use DB type. For `download` adapter type used only in R7/R8, which have extensions.

Need to support a "contentType" hint in get? Not necessary; R7/R8 can call `contentTypeFromPath`.

Backfill script:
- no dotenv import; rely on `--env-file`.
- args: `--dry-run`, `--verify`, maybe `--concurrency`.
- recursive list with pagination; `list` returns folders with id null.
- store source mtime? Not needed.
- write with same owner (run as app user).
- verify sizes + optional `--checksum` sample.
- exit non-zero on missing/mismatch.
- summary per bucket.
- safe path join + validation reusing local-store? Script is mjs and can import `../lib/storage/local-store.mjs` (it's in repo). Yes! Use `putFile`/`getFile` to reuse validation. But putFile with upsert:false would fail for existing; use a `skip if size equal` then putFile(upsert:true) or overwriting. Simpler: direct fs write with validation via resolveSafe. Recommend import `resolveSafe` + write with `upsert:true` (overwrite) after size check. Document.

Package.json scripts:
- `storage:migrate`: `node scripts/migrate-storage-to-vps.mjs` — but needs env. Maybe `node --env-file=.env scripts/...`? The project scripts use plain node with dotenv in scripts (setup). For consistency, could keep dotenv in the migration script but then runbook uses full `npm ci`. Hmm. The cleanest: script self-loads env via `node --env-file` documented in runbook and package script `storage:migrate`: `node --env-file=.env scripts/migrate-storage-to-vps.mjs` — Node 24 supports. But if `.env` missing, `--env-file` errors? `--env-file-if-exists` exists in newer Node. Node 24 has `--env-file-if-exists`. Use that? For local convenience: `node --env-file-if-exists=.env scripts/...`. Good recommendation. But CI? Not needed. However the user's environment Node 24 per deploy. Local maybe also 24 (package uses next 16). Fine. Alternatively keep `dotenv` import and use full `npm ci`. The doc's runbook can say `npm ci` full. Simpler and safest: keep `dotenv/config` in the script (consistent with setup scripts) and change runbook to `npm ci` (full) — not `--omit=dev`. Since clone in /tmp, dev deps install is fine. Then no env-file complexity. But install cost is higher. I'll choose: script uses `dotenv/config` (consistent), runbook `npm ci` full (or `npm ci --include=dev`), run as app user. Note `postinstall` needs prisma CLI, which full install provides. That's the least surprising. Also add `storage:migrate`, `storage:verify`, `storage:backup` scripts in package.json.

Backup offsite: choose "aktifkan sekarang" as recommendation but mark as ops decision; the user said pick best. I'll say recommended enabled, but implementation only provides script + doc; actual rclone config is ops. Set default decision: aktifkan (butuh kredensial rclone di VPS).

Retire buckets: keep empty as cold copy for 1 grace period, then delete after verification. Decision: simpan kosong (cold copy) during T6.x, hapus setelah 1 bulan `local` stabil. Good middle ground.

Worker: import shared module (copy into release). Decision made.

Grace period: 1 month (given volume likely small) but min 14 days clean logs + one successful backup/restore. Decision: 1 bulan.

User: `askonveksi` default, confirm ops.

Hybrid failure: fail-hard. Decision.

API shape: adapter. Decision.

Env: `.env.example` local default + guard. Decision.

Also add "text vs binary" table.

Now update section 5.2 to 21 rows and note counts.

Also update Fase 2 to say 19 call sites, each one-line swap thanks to adapter.

Also update test list in 2.5 and Fase 1/2:
- tests/crm-validation.test.mjs L1071 only; L1072 stays if variable named `storage`.
  Wait: If `design.ts` becomes `const storage = erpStorage(BUCKET);` then `storage.upload(...)` remains. Yes.
  L1071 `storage\.from\(BUCKET\)` breaks → update to `erpStorage\(BUCKET\)`.
- tests/business-profile.test.mjs L67 → `BUSINESS_ASSETS_BUCKET`.
- production-design-detail L147 `storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)` stays! Because adapter method signature same and variable named `storage`. L40 `.exists(originalPath)` stays. L41 `[400,404].includes(snapshot.error.status` stays if adapter error has `status`. L42 `upsert: false` stays. L52 `.remove([attachment.originalPath])` stays. So with the adapter, these tests DON'T break. Excellent. Only production-view-design-images L77 also stays. So the complete breakage list shrinks to 2 assertions in 2 files. This is a strong argument for the adapter. I should state that in the doc: "Dengan adapter, hanya 2 assertion yang perlu diperbarui." And remove the earlier extra test files from breakage list, but mention they were reviewed and remain green because method shape is preserved. However, if we don't implement adapter, they'd break. Since decision is adapter, we say they stay.

But careful: `app/actions/design.ts` currently `import { createAdminClient }`; after swap, `createAdminClient` may still be used elsewhere? In design.ts only for storage; remove import. Fine.

R4 uses `const storage = createAdminClient().storage;` then `storage.from(...)`. With adapter: `const storage = { from: erpStorage }`? Simpler change: replace `storage.from("business-assets")` with `erpStorage(BUSINESS_ASSETS_BUCKET)` and keep variable `storage` only if needed. Details in implementation.

Now routes call sites change one line each:
- `const { data, error } = await createAdminClient().storage.from(BUCKET).download(path)` → `await erpStorage(BUCKET).download(path)`. Bodies unchanged because Blob-like.
- Remove unused import `createAdminClient`.

Test `tests/crm-validation.test.mjs` L1627 `PAYMENT_PROOF_BUCKET` stays; route keeps import.

Also note `tests/crm-validation` L1072 stays.

Great. This makes the plan much cleaner.

Now `erpStorage` Blob type for local: R7/R8 use `data.type` → Blob type from `contentTypeFromPath`. For DB mime better? For business assets extension is reliable. Fine.

For `download` in `local` when file exists but path invalid? resolveSafe null → `{data:null, error:{message:"Path tidak valid", status:400}}`. In supabase mode, delegate as before. In hybrid, invalid path → return error without forwarding.

Now write the revised doc. It will be long (~550 lines). That's okay.

Also update the header status: "Revisi 2 — rancangan; belum diimplementasikan." Add "Perubahan revisi 2" summary block at top (maybe 8 bullets) so the user sees what changed. This is useful.

Let me also add a section "0. Prinsip data: teks vs biner" near top, explicitly honoring the user's instruction:
- Supabase Postgres: semua teks — nama, path, MIME, ukuran, metadata, relasi.
- VPS: semua byte gambar/PDF.
- Path yang disimpan tetap path relatif yang sekarang, tanpa prefix `vps/` atau domain. Contoh:
  - DB: `design/6f.../a1.png` (kolom `DesignAttachment.path`)
  - Disk: `/var/lib/askonveksi/storage/crm-po-designs/design/6f.../a1.png`
  - Contoh user (`vps/public/desain/desain1.jpg`) hanya ilustrasi; kita **tidak** memakai prefix `vps/public` karena akan mengubah isi DB dan memecahkan path lama.
- Bucket name is not stored in DB; it's implied by the table/column. The physical root includes bucket.
- Rationale: no data migration, zero path rewrite, existing rows keep working.

Add a mapping table for each data type: kolom DB → bucket → contoh path DB → lokasi fisik.

E.g.:
| Data | Kolom | Bucket | Path DB | Lokasi fisik |
| Desain revisi | DesignAttachment.path | crm-po-designs | design/<taskId>/<uuid>.png | .../crm-po-designs/design/... |
| Snapshot produksi | DesignAttachment.originalPath | crm-po-designs | production-design-original/<attachmentId>.png | ... |
| Penjahit | PurchaseOrderItem.penjahitDesignPath | ... | penjahit/<itemId>/<uuid>.png |
| Logo | BusinessProfile.logoPath / snapshot | business-assets | business/logo-<uuid>.png |
| Signature | ... |
| Bukti bayar | Expense/PaymentTransaction/PurchaseOrderDeposit.proofPath | payment-proofs | <ownerId>/<uuid>.pdf |
| Media WA | WhatsAppMessage.mediaPath | whatsapp-media | <accountId>/<date>/<messageId> or outbound/... |
| Lampiran PO | PurchaseOrderAttachment.path | crm-po-designs | ? |

Need to check `PurchaseOrderAttachment` path pattern. Let me check quickly in crm.ts for `purchaseOrderAttachment` creation. Search `attach`. Might be `attachment/<poId>/...` or similar. Let me check to be accurate. Also `DesignAttachment.originalPath` for PO attachments? R2 reads purchaseOrderAttachment.path from crm-po-designs. Let me grep for `purchaseOrderAttachment.create` or path builder.

Let me run a quick grep.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"attachment.path\\|purchaseOrderAttachment\\|attachments: { create\\|kind:.*MAIN_DESIGN\" --include=*.ts app/actions/crm.ts | head -30; echo \"=====\"; grep -rn \"path: \\`\" --include=*.ts app/actions/crm.ts app/actions/design.ts | head -20"
}
```

=====
app/actions/crm.ts:1806:    path: `penjahit/${itemId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
app/actions/design.ts:66:      path: `design/${designTaskId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"MAX_BYTES\\|MAX_FILES\\|prepareAttachments\" app/actions/design.ts | head -20; echo \"=====\"; sed -n 1,90p app/actions/design.ts"
}
```

16:const MAX_FILES = 5;
17:const MAX_BYTES = 5 * 1024 * 1024;
54:async function prepareAttachments(files: File[], designTaskId: string) {
56:    if (file.size > MAX_BYTES) throw new UserFacingError(`Setiap file desain maksimal 5 MB (${file.name}).`);
111:    const uploads: Array<{ itemId: string; itemName: string; notes: string | null; attachments: Awaited<ReturnType<typeof prepareAttachments>> }> = [];
115:      if (files.length > MAX_FILES) throw new UserFacingError(`Maksimal lima file setiap versi desain ${item.name}.`);
117:      uploads.push({ itemId: item.id, itemName: item.name, notes: revisionNotes(formData, item.id), attachments: await prepareAttachments(files, task.id) });
=====
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { DESIGN_UPLOADER_ROLES, GATE_OVERRIDE_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { DESIGN_REVISION_LIMIT } from "@/lib/crm/constants";
import { entityIdSchema } from "@/lib/crm/validation";
import { designImageContentType, designImageExtensionFor, designImageRejection } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REVISIONS = DESIGN_REVISION_LIMIT;

// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
// (maxWait 2s / timeout 5s) sering berakhir P2028 "melewati batas waktu"
// saat mengunggah desain multi-produk, jadi anggaran transaksi dinaikkan
// mengikuti pola `DEAL_TRANSACTION_OPTIONS` di crm.ts.
const DESIGN_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

/** Nomor versi berikutnya untuk setiap produk, dihitung terpisah per produk. */
function latestRevisionByItem(revisions: Array<{ itemId: string; revision: number }>) {
  const latest = new Map<string, number>();
  for (const revision of revisions) latest.set(revision.itemId, Math.max(latest.get(revision.itemId) ?? 0, revision.revision));
  return latest;
}

function uploadedFiles(formData: FormData, itemId: string) {
  return formData.getAll(`designFiles-${itemId}`).filter((value): value is File => value instanceof File && value.size > 0);
}

/**
 * Deposit hanya mengunci Upload Desain bila PO mencentang "Perlu deposit".
 * PO tanpa deposit sudah boleh diunggah kapan saja.
 */
function assertDepositSettled(purchaseOrder: { depositRequired: boolean; deposit: { id: string } | null }, role: Actor["role"]) {
  if (!purchaseOrder.depositRequired || purchaseOrder.deposit || hasRole(role, GATE_OVERRIDE_ROLES)) return;
  throw new UserFacingError("Deposit desain belum dibayar. Isi Deposit pada tab PO terlebih dahulu.");
}

function revisionNotes(formData: FormData, itemId: string) {
  const value = formData.get(`notes-${itemId}`);
  return typeof value === "string" ? value.trim().slice(0, 4000) || null : null;
}

async function prepareAttachments(files: File[], designTaskId: string) {
  return Promise.all(files.map(async (file) => {
    if (file.size > MAX_BYTES) throw new UserFacingError(`Setiap file desain maksimal 5 MB (${file.name}).`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // D2: ekstensi dan isi file divalidasi terpusat — hanya PNG/JPG/JPEG (PDF ditolak).
    const contentType = designImageContentType(file.name, bytes);
    if (!contentType) throw new UserFacingError(designImageRejection(file.name));
    return {
      bytes,
      originalName: file.name.slice(0, 255),
      sizeBytes: file.size,
      contentType,
      path: `design/${designTaskId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
    };
  }));
}

/**
 * Satu PO dapat memuat beberapa produk, jadi setiap produk punya form unggah sendiri
 * (`designFiles-<itemId>` + `notes-<itemId>`) dan riwayat versi terpisah (maksimal 4 versi per produk).
 * Tanpa tahap persetujuan, versi terbaru tiap produk langsung menjadi acuan produksi.
 */
export async function uploadDesignRevisionAction(formData: FormData) {
  return runRedirectingAction("/crm/purchase-orders", async () => {
    const actor = await requireActor(DESIGN_UPLOADER_ROLES);
    const taskId = entityIdSchema.safeParse(formData.get("designTaskId"));
    if (!taskId.success) throw new UserFacingError("Tugas desain tidak valid.");

    const prisma = getPrismaClient();
    const task = await prisma.designTask.findUnique({
      where: { id: taskId.data },
      select: {
        id: true,
        revisions: { select: { itemId: true, revision: true } },
        purchaseOrder: {
          select: {
            status: true,


---

## Assistant

_Thinking:_

Where are PurchaseOrder attachments created? Maybe in another action/route. Search for `purchaseOrderAttachment.create` across app.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"purchaseOrderAttachment\\|PurchaseOrderAttachment\" --include=*.ts app | head -30"
}
```

app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:24:  const attachment = await getPrismaClient().purchaseOrderAttachment.findFirst({


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"attachment\" app/actions/crm.ts | grep -i \"path\\|upload\\|storage\" | head -30"
}
```

(no output)

---

## Assistant

_Thinking:_

Interesting: the `PurchaseOrderAttachment` table exists and route reads it, but no writer in app/actions/crm.ts? Maybe legacy rows only; no upload UI. So R2 serves legacy attachments. The doc's layout note "(path lampiran PO lama bila ada)" is right. I'll document as legacy/read-only.

Let me verify the model field and whether anything creates them. Search prisma schema and whole repo for `purchaseOrderAttachment.upsert/create`.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"model PurchaseOrderAttachment\" -A 20 prisma/schema.prisma; echo \"=====\"; grep -rn \"purchaseOrderAttachment\" --include=*.ts --include=*.tsx --include=*.mjs . --exclude-dir=node_modules --exclude-dir=.next | head -20"
}
```

828:model PurchaseOrderAttachment {
829-  id              String                      @id @default(cuid())
830-  purchaseOrderId String
831-  path            String                      @db.VarChar(500)
832-  originalName    String                      @db.VarChar(255)
833-  contentType     String                      @db.VarChar(64)
834-  sizeBytes       Int
835-  kind            PurchaseOrderAttachmentKind @default(OTHER)
836-  caption         String?                     @db.VarChar(160)
837-  purchaseOrder   PurchaseOrder               @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)
838-  createdAt       DateTime                    @default(now()) @db.Timestamptz(3)
839-
840-  @@index([purchaseOrderId, createdAt])
841-}
842-
843-model Invoice {
844-  id                        String                  @id @default(cuid())
845-  invoiceNo                 String                  @unique @db.VarChar(28)
846-  opportunityId             String
847-  purchaseOrderId           String
848-  revision                  Int
=====
./app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:24:  const attachment = await getPrismaClient().purchaseOrderAttachment.findFirst({


---

## Assistant

_Thinking:_

Confirmed: `PurchaseOrderAttachment` is legacy/read-only, no writer. Good to note in the doc.

Now I'll write the revised document. Need to be comprehensive but coherent. Let me draft in Indonesian.

I'll use the write tool to overwrite FILE_TO_VPS.md. Ensure no code changes.

Let me compose the document carefully.

---

# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS

> Status: Revisi 2 — RANCANGAN, belum diimplementasikan.
> Revisi 2 mengadopsi rekomendasi audit: adapter storage, fail-hard hybrid, perbaikan runbook, guard env, dan daftar test yang akurat.
> Prinsip: teks di Supabase Postgres, biner di VPS. Path di DB tetap path relatif lama. Lulus lint/tsc/test/build. DEVELOPER tetap akses penuh.

## 0. Prinsip data: teks vs biner

Table.

Explain example.

Important: DB stores relative path WITHOUT bucket; bucket implied by column. Physical path = ERP_STORAGE_DIR/bucket/relpath. Don't store `vps/public/...` because it would require rewriting DB and break existing rows.

Also what counts as text: originalName, contentType, sizeBytes, mime, annotations JSON, etc. remain in DB. Only bytes move.

## 1. Ringkasan keputusan

- Goal.
- Why safe (audit findings).
- Drivers table.
- Space strategy.
- Domain/static serving not needed.

## 2. Peta lengkap

2.1 buckets table.
2.2 write points 6 files / 9 ops.
2.3 read routes 13.
2.4 worker + deploy.
2.5 tests: only 2 assertions need update with adapter; list them and reviewed-but-safe ones.

## 3. Arsitektur target

3.1 layout tree.
3.2 env (local defaults, production values, guard rules, invalid driver throws).
3.3 modules:
A. local-store.mjs (API, rules: validation, atomic with link, wx temp, mkdir, get null, remove best-effort, contentType, turbopackIgnore).
B. erp-storage.ts adapter (API shape, driver behavior incl fail-hard, Blob-like data, exists both, no fallback invalid path, throttled logs, server-only, production guard).
C. worker integration (driver-aware guards, import shared module, deploy copy).
3.4 deploy workflow.

## 4. Invarian keamanan checklist.

## 5. File list (new 7 / changed 21 / light / untouched).

## 6. Fase implementasi (0–6) with concrete tasks and gates, updated.

## 7. Runbook migrasi (corrected).
Include script behavior, commands:
```
sudo -u askonveksi -H bash -lc '
  cd /tmp && rm -rf askonveksi-migrate && git clone ... && cd askonveksi-migrate
  npm ci
  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```
Note `npm ci` full because dotenv + prisma CLI. If want lighter: `npm ci --ignore-scripts` + no dotenv (script uses env-file). Pick one. Since script imports dotenv, full npm ci. Also mention alternative.

Also chown fallback if run as root.

## 8. Backup & restore (offsite enabled recommended, pm2).
## 9. Monitoring.
## 10. Rollback (table, with fail-hard guarantee).
## 11. Risks (expanded 14 items).
## 12. UAT checklist.
## 13. Out of scope.
## 14. Keputusan (resolved table + remaining ops).
## 15. Definition of done per phase maybe not needed.

Let me write it. Length maybe 600 lines; acceptable.

I need to be accurate about `metadata.size` in list. Supabase `list` returns metadata with size for files. Yes.

For the backfill script using local-store: import `{ putFile, resolveSafe }`? `putFile` is async and can overwrite. Use `putFile(bucket, name, buffer, { upsert: true })` after checking existing size via `fileExists`/`getFile` (stat). Could add `statFile` helper to local-store (size). Add API `statFile(bucket, path) -> {size} | null`. The doc's original API had fileExists only; add statFile for backfill idempotency and verify. Good.

Also `removeFiles` returns failures.

Add `readDriver()`/`assertStorageConfig()` exported for tests.

`erpStorage` error shape: `{ message, status, statusCode }` to preserve W2's use of `snapshot.error.status`.

`exists` error semantics: Supabase `exists` for missing returns `{ data:false, error:null }` typically, invalid path error status 400. Adapter local: missing → false, error null; invalid → error status 400. Hybrid: if local invalid path → error (no Supabase call); else true if either.

`download` error: local missing → `{data:null,error:{message:"Object not found", status:404}}` so call sites that check `if (error)` 404 work. But routes also check `if (error || !data)`. Fine. For local missing, return error 404.

`upload` error mapping: EEXIST → `{status:409, statusCode:"409", message:"The resource already exists"}`; other → 500. W2 checks `copyError && !(await storage.exists(originalPath)).data`; fine.

`remove` errors: aggregate first error.

Type `bytes`: call sites pass `Uint8Array`. Node accepts. For Supabase, it accepts ArrayBuffer/Uint8Array; fine.

Now hybrid upload fail-hard details:
1. VPS write (primary). If fails → return error; do not write Supabase (avoid Supabase-only state).
2. Supabase write. If fails → attempt VPS delete; return error. If cleanup fails, log `[erp-storage] hybrid-put-orphan`.
This guarantees consistency: both or none (barring cleanup failure).
But note: for `upsert:false`, if VPS write succeeds and Supabase write fails because file already existed in Supabase (partial prior state), then cleanup deletes VPS copy; next retry VPS write succeeds again, Supabase still exists → fails again. Hmm: scenario: file exists in Supabase from before backfill (old file) and VPS doesn't; code attempts upsert:false. That is a legitimate error (caller expected new unique path), so fine.
For normal unique uuid paths, no issue.

Hybrid remove: delete both; collect failures; return error if any. Call sites mostly ignore. Document.

Hybrid download fallback log throttle: log once per (bucket,path) per 10 minutes or aggregate counter every N. Simpler: a `Map` with timestamp; log first occurrence per path per process hour; plus `console.info("[erp-storage] fallback-supabase", { bucket, path })`. Good.

Production guard:
```
const driver = parseDriver(process.env.ERP_STORAGE_DRIVER)
if (NODE_ENV === "production" && driver !== "supabase") {
  if (!ERP_STORAGE_DIR || !isAbsolute(...)) throw
  if (dir === cwd or dir.startsWith(cwd+sep)) throw
}
```
Actually in production `ERP_STORAGE_DIR` absolute is required for local/hybrid. For supabase driver, not needed. But also if set relative for supabase, ignore.
For dev/local: default `./data/erp-storage`.

Note: On VPS, `process.cwd()` is release dir; ERP_STORAGE_DIR `/var/lib/...` passes.

Worker: same guard? Worker can import erp-storage? No, that's TS + server-only. Worker should validate env itself or import a shared `storage-config.mjs`. Option: put driver parsing + guard in `local-store.mjs` (`storageDriver()`, `assertLocalReady()`), reused by TS and worker. Good: put config helpers in `local-store.mjs` to avoid duplication. Then `erp-storage.ts` imports them. Document.

So local-store.mjs exports:
- `storageDriver()` → "supabase"|"hybrid"|"local", throws on invalid
- `assertStorageReady()` → throws if driver != supabase and ERP_STORAGE_DIR missing/relative/inside cwd (production only? or always when driver != supabase)
- `storeRoot()`, `resolveSafe()`, `putFile`, `getFile`, `statFile`, `removeFiles`, `fileExists`, `contentTypeFromPath`
- maybe `StorageError` class with `status`.

Worker uses `putFile/getFile/removeFiles/storageDriver`.

Note: the worker is `.mjs` and `local-store.mjs` is `.mjs`; good.

Now the worker guards:
- `storeInbound`: if kind !== TEXT and driver requires storage. For supabase mode require Supabase env; for local/hybrid use local store. Actually hybrid needs Supabase too; guard accordingly.
- `processAccountDeletion`: always attempt removal based on driver; in supabase/hybrid require env.
- `performSendJob`: get attachment via driver; if local, read from disk; if hybrid, local first then Supabase; if supabase, Supabase.
Could reuse a small `readMedia(path)` helper in worker. And `putMedia`, `removeMedia`.

Note: worker can't import `erp-storage.ts`. Implement driver logic inline in worker using local-store + supabase client (~50 lines). This is a slight duplication of driver logic; document that the binary read/write primitives are shared and only the 3-branch driver logic is duplicated in worker (small, tested via T3.4). Alternatively create `lib/storage/erp-storage.mjs` for shared logic? But it needs supabase-js — worker already has it; app TS can import `.mjs` too. Hmm, could put the whole driver logic in `.mjs` (including Supabase) and have `erp-storage.ts` be a thin typed wrapper. That eliminates duplication. But importing supabase admin client in `.mjs` needs env and createClient; doable. Yet app already has `createAdminClient` with server-only. Simpler: keep driver logic only in TS for app; worker duplicates ~40 lines. The doc originally accepted this tradeoff. With user saying "best recommendation", I'd prefer a shared `.mjs` core: `lib/storage/erp-storage.mjs` handles all three drivers and returns supabase-like results; `lib/storage/erp-storage.ts` re-exports typed `erpStorage`. Then worker imports the same `.mjs`, no duplication. The `.mjs` imports `@supabase/supabase-js` and creates a client lazily. But `server-only` guard can't be in `.mjs` (worker would fail? `server-only` package throws only in client bundle? Actually `server-only` throws if imported in client environment; worker is server, fine but the package is a Next convention with package.json exports that throw in browser; importing in plain Node resolves to empty? The `server-only` package's default export throws "This module cannot be imported from a Client Component module" only in browser condition. In Node it's fine.) Still, keep `server-only` only in TS wrapper.

However, `@supabase/supabase-js` in a shared `.mjs` is already a dependency and in the worker deps closure. The collect script traces it anyway. That's fine.

But the app's `createAdminClient` uses `@/lib/supabase/admin` with `server-only` and env validation; duplicating client creation in `.mjs` is slightly divergent. Could accept.

Decision: Use two-layer:
- `local-store.mjs` = fs + config (no Supabase).
- `erp-storage.ts` = app driver logic (TS).
- Worker = ~50 lines inline driver logic using `local-store.mjs` + its existing `createClient`.
This keeps boundaries clean and avoids putting DB/auth concerns in a generic mjs. Duplication is limited to control flow (local vs supabase), primitives shared. The doc can state this explicitly and add a worker test. I'll go with this (matches original doc's accepted alternative but structured).

Actually the original doc's K port said worker imports local-store and implements its own mode. That's what I'll formalize.

Now `erp-storage.ts` return types. Define `ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string }`.

Implementation:
- supabase download returns `data` Blob; pass through.
- local download: `const buf = await getFile(...)`; if null return error 404; return `{ data: new Blob([buf], { type: contentTypeFromPath(path) }), error: null }`. Note `new Blob([buf])` works with Buffer (Uint8Array). Good.
- hybrid: local first, else supabase.

Call sites unchanged.

Now `erpStorage` might need `bucket` validation. `local-store.resolveSafe` validates bucket. For supabase mode, bucket is from constants, fine.

Now write the doc. Let me also mention the `PurchaseOrderAttachment` legacy read-only.

For the test list with adapter:
- `tests/crm-validation.test.mjs` L1071: update `storage\.from\(BUCKET\)` → `erpStorage\(BUCKET\)`. L1072 `storage\.upload\(attachment\.path` stays (variable named storage).
- `tests/business-profile.test.mjs` L67: update `/business-assets/` → `/BUSINESS_ASSETS_BUCKET/` (or assert import + erpStorage). Note the action block assertions stay.
- Everything else (production design tests) stays because method names/signatures preserved.
- New `tests/erp-storage.test.mjs`.
That's a much better story. State that if implementation deviates from adapter shape, re-run full test and update accordingly.

Also mention `tests/crm-validation.test.mjs` L1066 `storageScript` is reset script and does NOT break (correcting revision 1).

Now section 5.2 changed files: 19 app call sites + worker + deploy = 21.

Now Fase 1 test items:
- roundtrip, upsert false/true, traversal including bucket traversal, remove missing, stat/exists, contentType, config guard, adapter supabase mocked? Maybe don't mock Supabase; test driver `local` and path logic. For driver supabase, we can test that config parses and delegation is a thin call; mocking `@/lib/supabase/admin` in Node ESM is hard. Instead, assert production behavior via code review + UAT. The old doc said "mock/stub admin client bila perlu". Keep optional.

Add test for `erpStorage` local driver: upload/download/remove/exists via `ERP_STORAGE_DRIVER=local`. That's testable without Supabase. For supabase driver, not unit-tested (requires network); rely on Fase 2 gate.

But importing `erp-storage.ts` imports `@/lib/supabase/admin` which imports env? Let's check `lib/supabase/admin.ts` — likely creates client lazily. If env missing at import, does it throw? Let me check quickly.

**Tool: shell**

**Input:**
```json
{
  "command": "cat lib/supabase/admin.ts; echo \"=====SERVER-ONLY INSTALLED=====\"; ls node_modules/server-only 2>/dev/null && cat node_modules/server-only/package.json 2>/dev/null | head -30"
}
```

import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Konfigurasi admin Supabase belum lengkap.");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
=====SERVER-ONLY INSTALLED=====
index.js
package.json
{"name":"server-only","main":"index.js"}


---

## Assistant

_Thinking:_

`server-only/index.js` probably throws if imported outside RSC? Let me check content. In Node, importing `server-only` may throw? The package `server-only` index.js is `throw new Error("This module cannot be imported from a Client Component module...")`? Actually Next aliases it. In plain node, `server-only` throws unconditionally unless bundler aliases to empty. Let me check.

**Tool: shell**

**Input:**
```json
{
  "command": "cat node_modules/server-only/index.js; echo \"---\"; node -e 'import(\"server-only\").then(()=>console.log(\"ok\")).catch(e=>console.error(\"ERR\",e.message))'"
}
```

module.exports = {};
---
ok


---

## Assistant

_Thinking:_

Fine. Importing `erp-storage.ts` in Node tests works if env doesn't throw (client is lazy). Good.

Now write the revised document. I'll aim for thorough but not bloated. Let's produce.

I must ensure the file content doesn't accidentally claim implementation done. Keep "rancangan".

Let me write the full markdown now. I'll be careful with tables and code fences.

One more thing: the user example "vps/public/desain/desain1.jpg" — I should explicitly reconcile: we store relative path like `design/...` in DB, not `vps/public/...`. Explain why (existing data compatibility & zero migration). This satisfies "path tertulis di supabase, gambar di VPS".

Also mention text data includes path string, original name, mime, size; all stay in Supabase. Database remains single source of truth for metadata. File existence is not authoritative; missing file → 404, not crash.

Let me draft the content.

I'll include a "Ringkasan perubahan revisi 2" near top:
1. Adapter `erpStorage(bucket)` menggantikan `erpGet/erpPut/...`; call site cukup ganti satu baris; test lama tetap hijau (kecuali 2 assertion).
2. Hybrid fail-hard, bukan best-effort.
3. `putFile` atomik: temp + rename (upsert) / link (no-upsert).
4. Guard config produksi & driver invalid.
5. Worker driver-aware.
6. Runbook migrasi diperbaiki (npm ci penuh, run as app user).
7. .env.example default lokal.
8. Tambahan: statFile, throttled log, turbopackIgnore, server-only, legacy PO attachments read-only.
9. Angka dan daftar test dikoreksi.

Then sections.

Let me write.

**Tool: write**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "content": "# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS\n\n> **Status: Revisi 2 — RANCANGAN, belum diimplementasikan.**\n> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.2**).\n> Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.\n\n---\n\n## 0. Prinsip data: teks di Supabase, biner di VPS\n\n### 0.1 Pembagian yang tegas\n\n| Jenis data | Tempat penyimpanan | Contoh |\n|---|---|---|\n| Teks & metadata | **Supabase Postgres** (satu-satunya sumber kebenaran) | nama file asli, path relatif, MIME, ukuran byte, anotasi JSON, relasi ke PO/invoice/customer |\n| Biner (gambar, PDF) | **Disk VPS** (`ERP_STORAGE_DIR`) | byte PNG desain, PDF bukti bayar, WebP logo, media WhatsApp |\n\nYang dipindahkan **hanya byte file**. Tidak ada kolom baru, tidak ada perubahan tipe kolom, tidak ada penulisan ulang path di baris mana pun.\n\n### 0.2 Bentuk path yang disimpan (penting)\n\nDatabase tetap menyimpan **path relatif lama, tanpa prefix bucket dan tanpa prefix `vps/`**:\n\n```text\nKolom DB : design/6f1c.../a1b2....png\nLokasi   : /var/lib/askonveksi/storage/crm-po-designs/design/6f1c.../a1b2....png\n           └──────── ERP_STORAGE_DIR ────────┘└── bucket ──┘└──── nilai kolom DB ────┘\n```\n\nNama bucket tidak disimpan di DB karena sudah tersirat oleh tabel/kolom pemiliknya. Contoh ilustrasi `vps/public/desain/desain1.jpg` **tidak** dipakai: menambahkan prefix semacam itu berarti menulis ulang seluruh path lama dan memecahkan kompatibilitas. Yang benar adalah path relatif tetap seperti sekarang; lokasi fisik diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path DB.\n\n### 0.3 Peta kolom → bucket → lokasi fisik\n\n| Data | Kolom DB | Bucket | Contoh path DB | Lokasi fisik |\n|---|---|---|---|---|\n| Desain revisi PO | `DesignAttachment.path` | `crm-po-designs` | `design/<taskId>/<uuid>.png` | `<root>/crm-po-designs/design/<taskId>/<uuid>.png` |\n| Snapshot desain awal produksi | `DesignAttachment.originalPath` | `crm-po-designs` | `production-design-original/<attachmentId>.png` | `<root>/crm-po-designs/production-design-original/<attachmentId>.png` |\n| Desain penjahit | `PurchaseOrderItem.penjahitDesignPath` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.png` | `<root>/crm-po-designs/penjahit/<itemId>/<uuid>.png` |\n| Lampiran PO lama (legacy, read-only) | `PurchaseOrderAttachment.path` | `crm-po-designs` | path lama apa adanya | `<root>/crm-po-designs/<path lama>` |\n| Logo perusahaan (dan snapshot invoice/PO) | `BusinessProfile.logoPath`, `Invoice.snapshotBusinessLogoPath`, `PurchaseOrder.snapshotBusinessLogoPath` | `business-assets` | `business/logo-<uuid>.png` | `<root>/business-assets/business/logo-<uuid>.png` |\n| Tanda tangan perusahaan (dan snapshot) | `BusinessProfile.signaturePath`, `Invoice.snapshotSignaturePath` | `business-assets` | `business/signature-<uuid>.webp` | `<root>/business-assets/business/signature-<uuid>.webp` |\n| Bukti pengeluaran / transaksi / deposit | `Expense.proofPath`, `PaymentTransaction.proofPath`, `PurchaseOrderDeposit.proofPath` | `payment-proofs` | `<ownerUserId>/<uuid>.pdf` | `<root>/payment-proofs/<ownerUserId>/<uuid>.pdf` |\n| Media WhatsApp inbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `<accountId>/<YYYY-MM-DD>/<messageId>` (tanpa ekstensi) | `<root>/whatsapp-media/<accountId>/<YYYY-MM-DD>/<messageId>` |\n| Lampiran WhatsApp outbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `<root>/whatsapp-media/outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` |\n\nCatatan: `PurchaseOrderAttachment` sudah tidak punya penulis di kode (hanya route baca R2). Baris lama tetap harus ikut di-backfill, tetapi tidak ada alur upload baru untuk tabel ini.\n\n### 0.4 Ringkasan perubahan revisi 2\n\n1. **Adapter `erpStorage(bucket)`** menggantikan fungsi bebas `erpGet/erpPut/erpRemove/erpExists`. Bentuknya meniru `supabase.storage.from(bucket)`, jadi 19 call site hanya berubah satu baris dan sebagian besar test sumber lama tetap hijau.\n2. **Hybrid fail-hard**, bukan best-effort: tulis dianggap sukses hanya jika VPS **dan** Supabase sama-sama berhasil; kalau salah satu gagal, operasi dibatalkan dan salinan yang terlanjur dibuat dibersihkan. Ini yang membuat janji rollback di bagian 10 benar-benar berlaku.\n3. **`putFile` atomik yang konsisten**: tulis ke file temp, lalu `rename` untuk `upsert:true` atau `link` untuk `upsert:false`. Flag `wx` dipakai pada file temp, bukan pada file final.\n4. **Guard konfigurasi produksi**: driver divalidasi, `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`.\n5. **Worker WhatsApp driver-aware**: guard `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` di tiga titik diganti logika driver, bukan dipertahankan apa adanya.\n6. **Runbook migrasi diperbaiki**: `npm ci --omit=dev` tidak dipakai (dotenv dan Prisma CLI ada di devDependencies); migrasi dijalankan sebagai user aplikasi agar file tidak menjadi milik `root`.\n7. **Default `.env.example` lokal** (`./data/erp-storage`), nilai produksi hanya di dokumentasi.\n8. **Detail implementasi baru**: `statFile`, throttle log fallback, `/* turbopackIgnore: true */`, `import \"server-only\"`, dan penegasan bahwa path tidak valid **tidak boleh** di-fallback ke Supabase.\n9. **Koreksi angka dan daftar test**: 6 file penulis / 9 titik tulis, 21 file diubah, dan hanya 2 assertion test yang perlu diperbarui berkat adapter.\n\n---\n\n## 1. Ringkasan keputusan\n\n**Tujuan:** semua biner ERP (desain PO, desain produksi, desain penjahit, lampiran PO lama, bukti bayar/pengeluaran/deposit, logo & tanda tangan, media WhatsApp) dipindahkan dari Supabase Storage ke disk VPS di `/var/lib/askonveksi/storage`. Supabase Postgres tetap menyimpan seluruh teks dan path relatif.\n\n**Mengapa aman (temuan audit):**\n\n1. Tidak ada satu pun `getPublicUrl`/`createSignedUrl` di codebase. Semua file disajikan lewat route API terautentikasi yang membaca via admin client lalu di-stream. Mengganti sumber byte tidak mengubah URL, header, atau perilaku route.\n2. Semua kolom DB berisi path relatif, bukan URL. Struktur path dipertahankan 1:1 di bawah `<ERP_STORAGE_DIR>/<nama-bucket>/`.\n3. Pola \"file di volume VPS + DB simpan path relatif\" sudah terbukti di modul ini: foto absensi (`lib/attendance/photo.ts`) dan CMS (`lib/cms/media.ts`), termasuk validasi anti path-traversal.\n\n**Driver:**\n\n| `ERP_STORAGE_DRIVER` | Tulis | Baca | Pemakaian |\n|---|---|---|---|\n| `supabase` | Supabase | Supabase | **Default kode** — perilaku lama persis |\n| `hybrid` | VPS **dan** Supabase; gagal salah satu = gagal semua | VPS dulu, fallback Supabase bila belum ada di VPS | Masa transisi produksi (±1 bulan) |\n| `local` | VPS saja | VPS saja | Setelah grace period |\n\n**Domain `askonveksi.web.id` tidak diperlukan untuk penyimpanan.** Jangan serve folder statis via nginx: desain PO, bukti bayar, dan media WA harus tetap hanya lewat route yang butuh login. Route yang sama tetap dipakai; hanya sumber byte-nya yang berubah.\n\n---\n\n## 2. Peta lengkap saat ini (hasil audit)\n\n### 2.1 Bucket Supabase Storage yang aktif (semua privat)\n\nDisiapkan oleh `scripts/setup-crm-storage.mjs` dan diverifikasi ulang:\n\n| Bucket | Limit bucket | Isi |\n|---|---|---|\n| `crm-po-designs` | 5 MB, MIME bebas | Desain revisi PO, salinan original produksi, desain penjahit, lampiran PO lama |\n| `business-assets` | 2 MB, JPG/PNG/WebP | Logo & tanda tangan perusahaan |\n| `payment-proofs` | 5 MB, PDF/JPG/PNG/WebP | Bukti pengeluaran, bukti transaksi bayar, bukti deposit PO |\n| `whatsapp-media` | 10 MB, PDF/JPG/PNG/WebP | Media inbound (dari HP customer) & lampiran outbound |\n\n`quotation-acceptance-proofs` sudah retired (dihapus `scripts/reset-crm-storage.mjs`) — tidak ikut migrasi.\n\n### 2.2 Titik tulis — **6 file, 9 titik**\n\n| # | File | Fungsi | Bucket | Path | Semantik |\n|---|---|---|---|---|---|\n| W1 | `app/actions/design.ts` | `uploadDesignRevisionAction` | `crm-po-designs` | `design/<designTaskId>/<uuid>.(png\\|jpg)` | `upload` (upsert:false), batch; `remove` saat rollback DB |\n| W2 | `app/actions/production.ts` | `saveProductionDesignAction` | `crm-po-designs` | overwrite `attachment.path` (upsert:true) + snapshot `production-design-original/<attachmentId>.png` | `exists`, `download`, `upload` upsert, `upload` upsert:false, `remove` |\n| W3 | `app/actions/production.ts` | `overwriteProductionDesignAction` | `crm-po-designs` | `upload` path baru + snapshot upsert, `remove` path lama & cleanup saat transaksi gagal | idem |\n| W4 | `app/actions/production.ts` | `resetProductionDesignAction` | `crm-po-designs` | `download` originalPath → `upload` ke attachment.path (upsert:true) | idem |\n| W5 | `app/actions/production.ts` | `sendProductionDesignAction` | `crm-po-designs` | `remove` `originalPath` setelah masuk produksi | idem |\n| W6 | `app/actions/crm.ts` (~L1796–1890) | `savePenjahitPlanAction` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.(png\\|jpg)` | `upload` upsert:false, `remove` file baru bila transaksi gagal |\n| W7 | `app/actions/master-data.ts` (~L978–1028) | `updateBusinessProfileAction` | `business-assets` | `business/logo-<uuid>.<ext>`, `business/signature-<uuid>.<ext>` | `upload`, `remove` saat rollback. **File lama sengaja TIDAK dihapus** (path tersnapshot di invoice terkunci) |\n| W8 | `app/actions/whatsapp.ts` (~L186–199) | `sendWhatsAppMessageAction` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `upload`, `remove` bila enqueue gagal |\n| W9 | `lib/payment-proof.ts` | `uploadPaymentProof` / `deletePaymentProof` | `payment-proofs` | `<ownerUserId>/<uuid>.(pdf\\|jpg\\|png\\|webp)` | `upload`, `remove`. Dipanggil dari `app/actions/finance.ts` (expense & HPP) dan `app/actions/crm.ts` (transaksi bayar/deposit) |\n\n### 2.3 Titik baca — **13 route**\n\n| # | Route | Bucket | Catatan |\n|---|---|---|---|\n| R1 | `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | dukung `?original`; content-type di-sniff dari byte |\n| R2 | `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | `crm-po-designs` | lampiran PO legacy |\n| R3 | `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | `crm-po-designs` | thumbnail dialog + PDF |\n| R4 | `app/api/crm/purchase-order/[id]/pdf/route.ts` | `business-assets` + `crm-po-designs` | logo + loop desain/penjahit/lampiran untuk PDF |\n| R5 | `app/api/crm/invoice/[id]/pdf/route.ts` | `business-assets` | logo + signature (snapshot → fallback profil) |\n| R6 | `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `business-assets` | `readImage` logo + signature |\n| R7 | `app/api/master-data/business-profile/logo/route.ts` | `business-assets` | memakai `data.type` dari blob |\n| R8 | `app/api/master-data/business-profile/signature/route.ts` | `business-assets` | idem |\n| R9 | `app/api/public/business-logo/route.ts` | `business-assets` | **satu-satunya route publik**; allowlist regex path dipertahankan |\n| R10 | `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `payment-proofs` | |\n| R11 | `app/api/crm/payment-transactions/[id]/proof/route.ts` | `payment-proofs` | |\n| R12 | `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | `payment-proofs` | |\n| R13 | `app/api/whatsapp/media/[id]/route.ts` | `whatsapp-media` | path tanpa ekstensi; content-type dari kolom DB |\n\n### 2.4 Worker WhatsApp — 3 titik di satu file\n\n| # | Lokasi (~baris) | Fungsi | Bucket | Catatan |\n|---|---|---|---|---|\n| K1 | ~L214 (`storeInbound`) | upload media inbound (maks 5 MB) | `whatsapp-media` | guard saat ini: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` |\n| K2 | ~L261 (`processAccountDeletion`) | batch `remove` saat akun WA dihapus (chunk 100) | `whatsapp-media` | guard Supabase yang sama |\n| K3 | ~L610 (`performSendJob`) | `download` lampiran outbound sebelum dikirim | `whatsapp-media` | melempar error bila env Supabase tidak ada |\n\n**Batasan deployment:** `deploy.yml` hanya menyalin satu file worker (`cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs`). Jika worker memakai modul bersama, file modul itu **wajib** ikut di Package step + verifikasi tarball, kalau tidak worker crash di produksi (`ERR_MODULE_NOT_FOUND`).\n\n### 2.5 Test yang menyentuh pola storage\n\nDengan keputusan **adapter** (bagian 3.3B), hanya dua assertion yang perlu diperbarui:\n\n| File | Assertion | Perubahan |\n|---|---|---|\n| `tests/crm-validation.test.mjs` ~L1071 | `assert.match(designActionSource, /storage\\.from\\(BUCKET\\)/)` | ubah ke `/erpStorage\\(BUCKET\\)/` |\n| `tests/business-profile.test.mjs` ~L67 | `assert.match(signatureRouteSource, /business-assets/)` | ubah ke `/BUSINESS_ASSETS_BUCKET/` (atau assert impor konstanta + `erpStorage`) |\n\nAssertion yang **tetap hijau** dan sudah diverifikasi:\n\n- `tests/crm-validation.test.mjs` ~L1066 (`storageScript` = `scripts/reset-crm-storage.mjs`) — script itu tidak berubah, jadi tidak patah.\n- `tests/crm-validation.test.mjs` ~L1072 (`storage.upload(attachment.path`) — variabel lokal tetap diberi nama `storage`.\n- `tests/crm-validation.test.mjs` ~L1627 (`PAYMENT_PROOF_BUCKET`) — ekspor di `lib/payment-proof.ts` dipertahankan.\n- `tests/production-design-detail.test.mjs` L40–42, L52, L147 — `.exists(originalPath)`, `snapshot.error.status`, `upsert: false`, `.remove([...])`, dan `storage.upload(originalPath, ...)` semuanya dipertahankan oleh adapter.\n- `tests/production-view-design-images.test.mjs` L77 — sama.\n- `tests/business-profile.test.mjs` assertions block `updateBusinessProfileAction` — path `business/signature-...` dan `removeSignature` tidak berubah.\n- `tests/attendance-storage.test.mjs`, `tests/cms-media.test.mjs` — modul lain, di luar cakupan.\n\n---\n\n## 3. Arsitektur target\n\n### 3.1 Layout direktori VPS\n\n```text\n/var/lib/askonveksi/storage/            # ERP_STORAGE_DIR (volume persisten, di luar releases/)\n├── crm-po-designs/\n│   ├── design/<designTaskId>/<uuid>.(png|jpg)\n│   ├── production-design-original/<attachmentId>.png\n│   ├── penjahit/<itemId>/<uuid>.(png|jpg)\n│   └── <path lampiran PO lama bila ada>\n├── business-assets/\n│   └── business/(logo|signature)-<uuid>.(png|jpg|webp)\n├── payment-proofs/\n│   └── <ownerUserId>/<uuid>.(pdf|jpg|png|webp)\n└── whatsapp-media/\n    ├── <accountId>/<YYYY-MM-DD>/<messageId>          # inbound, tanpa ekstensi\n    └── outbound/<YYYY-MM-DD>/<uuid>-<namaAman>\n```\n\n- Ownership: user yang sama dengan proses PM2 (default `askonveksi`), direktori `0750`, file `0640` (pola `lib/attendance/photo.ts`).\n- Lokal/dev: default `./data/erp-storage` (sudah ter-cover `.gitignore` `/data/`).\n- Jangan pernah menaruh `ERP_STORAGE_DIR` di dalam folder release (`$DEPLOY_PATH/releases/...`), karena release lama dipangkas otomatis.\n\n### 3.2 Environment\n\n```bash\n# .env.example (nilai lokal; produksi diisi di $DEPLOY_PATH/shared/.env)\nERP_STORAGE_DIR=./data/erp-storage\nERP_STORAGE_DRIVER=supabase\n```\n\nProduksi:\n\n```bash\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\nERP_STORAGE_DRIVER=hybrid        # lalu local setelah grace period\n```\n\nAturan validasi (dijalankan `lib/storage/local-store.mjs` saat pertama dibutuhkan):\n\n- Nilai driver selain `supabase|hybrid|local` → **throw**, bukan diam-diam jatuh ke default.\n- Driver ≠ `supabase` dan `ERP_STORAGE_DIR` kosong/relatif → throw.\n- Driver ≠ `supabase`, `NODE_ENV=production`, dan `ERP_STORAGE_DIR` berada di dalam `process.cwd()` → throw (mencegah tulisan masuk folder release yang akan dihapus).\n- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada.\n\n### 3.3 Modul baru\n\n#### A. `lib/storage/local-store.mjs` — inti fs, tanpa dependensi build\n\nModul mjs polos (tanpa alias `@/`, tanpa TypeScript) agar dipakai app **dan** worker tanpa duplikasi primitif.\n\n```js\n// Konfigurasi & validasi\nexport function storageDriver()                  // \"supabase\" | \"hybrid\" | \"local\" (throw bila invalid)\nexport function assertStorageReady()             // guard produksi; throw dengan pesan jelas\nexport function storeRoot()                      // resolve(ERP_STORAGE_DIR || ./data/erp-storage)\n\n// Path\nexport function resolveSafe(bucket, relativePath) // { absolute, relativePath } | null\n\n// Operasi file\nexport async function putFile(bucket, relativePath, bytes, { upsert })\nexport async function getFile(bucket, relativePath)      // Buffer | null\nexport async function statFile(bucket, relativePath)     // { size: number } | null\nexport async function removeFiles(bucket, paths)         // { failed: Array<{ path, message }> }\nexport async function fileExists(bucket, relativePath)   // boolean\nexport function contentTypeFromPath(relativePath)        // MIME atau application/octet-stream\n```\n\nAturan implementasi wajib:\n\n1. **Validasi bucket**: hanya `^[a-z0-9][a-z0-9-]*$`; tolak bucket yang mengandung `/`, `\\`, `..`, atau `\\0`.\n2. **Validasi path**: tolak `\\0`, `\\`, path absolut, segmen kosong, `.`, `..`, dan segmen berawalan titik. Setelah `resolve`, pastikan `absolute.startsWith(root + sep)` dan `absolute !== root`. Pola ini mengikuti `resolveAttendancePhotoPath`.\n3. **Tulis atomik**:\n   - buat folder tujuan `mkdir(..., { recursive: true, mode: 0o750 })`;\n   - tulis byte ke `<folder>/.tmp-<uuid>` dengan `{ flag: \"wx\", mode: 0o640 }`;\n   - `upsert:true` → `rename(tmp, final)` (pembaca tidak pernah melihat file setengah jadi);\n   - `upsert:false` → `link(tmp, final)` lalu `unlink(tmp)`. `link` gagal `EEXIST` secara atomik bila file final sudah ada — inilah cara yang benar meniru semantik Supabase, bukan `wx` pada file temp;\n   - pada error apa pun, hapus `tmp` (abaikan `ENOENT`) lalu lempar error asli.\n4. **Baca**: `getFile`/`statFile` mengembalikan `null` untuk path tidak valid atau file tidak ada (tanpa throw). `removeFiles` mengabaikan `ENOENT` dan mengumpulkan kegagalan lain ke `failed`.\n5. **`contentTypeFromPath`**: `png` → `image/png`, `jpg/jpeg` → `image/jpeg`, `webp` → `image/webp`, `pdf` → `application/pdf`, selain itu `application/octet-stream`.\n6. **Turbopack**: akses fs dinamis dibungkus komentar `/* turbopackIgnore: true */` seperti `lib/attendance/photo.ts`, agar build Next tidak menambah peringatan baru.\n7. **Error terstruktur**: sertakan `status` (mis. `409` untuk konflik, `400` untuk path invalid) agar adapter bisa meneruskannya ke call site.\n\n#### B. `lib/storage/erp-storage.ts` — adapter ber-bentuk supabase-js\n\n```ts\nimport \"server-only\";\n\nexport const PO_DESIGNS_BUCKET = \"crm-po-designs\";\nexport const BUSINESS_ASSETS_BUCKET = \"business-assets\";\nexport const PAYMENT_PROOFS_BUCKET = \"payment-proofs\";\nexport const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\";\n\ntype StorageError = { message: string; status?: number; statusCode?: string };\ntype StorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };\n\nexport function erpStorage(bucket: string): {\n  upload(path: string, bytes: Uint8Array, opts?: { contentType?: string; upsert?: boolean }): Promise<{ data: { path: string } | null; error: StorageError | null }>;\n  download(path: string): Promise<{ data: StorageFile | null; error: StorageError | null }>;\n  remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }>;\n  exists(path: string): Promise<{ data: boolean; error: StorageError | null }>;\n};\n```\n\n**Mengapa adapter, bukan fungsi bebas:** call site saat ini memakai `const storage = createAdminClient().storage.from(BUCKET)` lalu `storage.upload(...)`, `storage.download(...)`, `storage.remove(...)`, `storage.exists(...)`. Dengan adapter, satu-satunya perubahan adalah baris konstruksi menjadi `const storage = erpStorage(BUCKET)`. Nama method, argumen, dan bentuk `{ data, error }` tetap, sehingga:\n\n- 19 call site berubah minim (1 baris + hapus import yang tidak terpakai);\n- `data` dibuat mirip `Blob` (`arrayBuffer()`, `type`), jadi `await data.arrayBuffer()` di route tetap jalan;\n- `snapshot.error.status` di W2 tetap tersedia;\n- test sumber yang menyebut `.exists(...)`, `.remove(...)`, `storage.upload(...)` tetap hijau.\n\n**Perilaku per driver:**\n\n- `supabase`: delegasi langsung ke `createAdminClient().storage.from(bucket)`. Perilaku identik dengan kode sekarang (termasuk `data.type`).\n- `local`: seluruh operasi lewat `local-store.mjs`. `download` mengembalikan objek mirip Blob dengan `type` dari `contentTypeFromPath(path)`. File tidak ada → `{ data: null, error: { message, status: 404 } }`.\n- `hybrid`:\n  - **upload**: `putFile` ke VPS dulu. Jika VPS gagal → kembalikan error, **jangan** menulis ke Supabase (mencegah state Supabase-only yang tidak tercermin di disk). Jika VPS sukses, tulis ke Supabase. Jika Supabase gagal → hapus salinan VPS, catat `[erp-storage] hybrid-put-rollback`, lalu kembalikan error. Dengan begitu operasi sukses berarti **keduanya** ada.\n  - **download**: coba VPS; jika tidak ada, fallback Supabase dan catat `[erp-storage] fallback-supabase` (di-throttle per bucket+path, mis. sekali per 10 menit, agar log tidak banjir selama backfill).\n  - **exists**: cek VPS **atau** Supabase. Ini penting untuk W2: snapshot lama yang baru ada di Supabase tidak boleh dianggap tidak ada.\n  - **remove**: hapus di VPS dan Supabase, kumpulkan kegagalan. Bersifat best-effort seperti kode sekarang, tetapi kegagalan dicatat. Risiko \"file hidup lagi lewat fallback\" hanya mungkin bila sebuah path yang sudah dihapus masih dirujuk DB; alur rollback di kode selalu menghapus file yang belum dirujuk DB, sehingga risiko ini diterima dan dicatat.\n  - **path tidak valid**: `resolveSafe` mengembalikan `null` → adapter langsung mengembalikan error `400` **tanpa** meneruskannya ke Supabase. Ini wajib agar validasi traversal tidak bisa dilewati lewat jalur fallback.\n\n**Catatan tipe data:** `download` di mode `supabase` mengembalikan `Blob` asli; di mode `local`/`hybrid` mengembalikan objek mirip Blob. Keduanya mendukung `arrayBuffer()` dan `type`, jadi R7/R8 tidak perlu perubahan isi.\n\n#### C. Worker WhatsApp\n\n`worker/whatsapp.mjs` mengimpor `../lib/storage/local-store.mjs` (relatif terhadap file worker; worker dijalankan dengan `--cwd $CURRENT_LINK`, jadi modul berada di `<release>/lib/storage/local-store.mjs`).\n\nPerubahan tiga titik:\n\n- **K1** `storeInbound`: simpan ke VPS untuk driver `local`/`hybrid`, ke Supabase untuk `supabase`/`hybrid`. Guard lama (`NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY`) diganti logika driver:\n  - `supabase` → wajib env Supabase;\n  - `hybrid` → wajib env Supabase **dan** `ERP_STORAGE_DIR`;\n  - `local` → cukup `ERP_STORAGE_DIR`.\n  Cap 5 MB inbound dan penolakan file kosong tetap.\n- **K2** `processAccountDeletion`: untuk `local`/`hybrid` hapus lewat `removeFiles`; untuk `supabase`/`hybrid` tetap `remove` chunk 100. Chunking berlaku untuk jalur Supabase.\n- **K3** `performSendJob`: baca lampiran lewat VPS dulu (local/hybrid), fallback Supabase (hybrid), atau langsung Supabase (supabase). Error yang dilempar tetap jelas (`Lampiran ... tidak dapat dibaca`).\n\nLogika driver di worker (±40 baris) sengaja ditulis inline di `whatsapp.mjs`; **primitif** fs, validasi path, dan konfigurasi tetap diimpor dari `local-store.mjs`. Ini menghindari dua implementasi validasi path yang bisa berbeda.\n\n**Deploy:** `lib/storage/local-store.mjs` harus ikut disalin ke `deploy_package/lib/storage/`. `scripts/collect-worker-deps.mjs` hanya menyalin isi `node_modules`, jadi file repo ini tidak otomatis ikut.\n\n### 3.4 Deploy workflow (`.github/workflows/deploy.yml`)\n\nTambahan di Package step:\n\n```bash\nmkdir -p deploy_package/lib/storage\ncp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs\n```\n\nTambahan di verifikasi tarball:\n\n```bash\ntar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs' \\\n  || { echo 'local-store.mjs missing'; exit 1; }\n```\n\nTidak ada perubahan urutan job (build → migrate → deploy); langkah Prisma tidak disentuh.\n\n---\n\n## 4. Invarian keamanan (checklist review)\n\n- [ ] Semua route tetap memakai `requireActor(...)`; tidak ada route publik baru selain R9 (allowlist regex dipertahankan).\n- [ ] `resolveSafe` menolak `..`, path absolut, `\\0`, `\\`, segmen tersembunyi, dan bucket tidak valid; diuji dengan test khusus.\n- [ ] Path tidak valid pada driver `hybrid` **tidak** di-fallback ke Supabase.\n- [ ] `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`; driver invalid → throw.\n- [ ] Header respons tidak berubah: `Cache-Control` (`private, no-store` atau `public, immutable` khusus R9), `X-Content-Type-Options: nosniff`, `Content-Disposition` inline/attachment.\n- [ ] Validasi upload di call site tidak berubah (magic bytes `lib/design/image.ts` & `lib/payment-proof.ts`, limit 5/10/2 MB, nama file disanitasi, path dari UUID).\n- [ ] Semantik \"file lama logo/signature tidak dihapus\" (W7) tetap.\n- [ ] Cleanup saat transaksi DB gagal tetap berfungsi di hybrid: hapus di **kedua** lokasi.\n- [ ] `erp-storage.ts` memakai `import \"server-only\"`; tidak ada byte yang melewati client bundle.\n- [ ] Role & gerbang akses tidak tersentuh; DEVELOPER tetap bisa mengakses semua fitur.\n\n---\n\n## 5. Daftar file\n\n### 5.1 File baru (7)\n\n| File | Isi |\n|---|---|\n| `lib/storage/local-store.mjs` | fs + validasi path + konfigurasi driver (3.3A) |\n| `lib/storage/erp-storage.ts` | adapter `erpStorage(bucket)` + konstanta bucket (3.3B) |\n| `scripts/migrate-storage-to-vps.mjs` | backfill Supabase → VPS (bagian 7) |\n| `scripts/backup-erp-storage.sh` | cron backup harian + rotasi (bagian 8) |\n| `tests/erp-storage.test.mjs` | unit test modul (bagian 6, Fase 1) |\n| `docs/PANDUAN_STORAGE_ERP.md` | runbook operasional: env, driver, migrasi, backup/restore, decommission |\n| `FILE_TO_VPS.md` | dokumen ini |\n\n### 5.2 File yang diubah (21)\n\n| File | Perubahan ringkas |\n|---|---|\n| `app/actions/design.ts` | `createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)` (W1) |\n| `app/actions/production.ts` | 4 aksi → `erpStorage(DESIGN_BUCKET)` (W2–W5) |\n| `app/actions/crm.ts` | penjahit → `erpStorage(PO_DESIGNS_BUCKET)` (W6) |\n| `app/actions/master-data.ts` | logo/signature → `erpStorage(BUSINESS_ASSETS_BUCKET)` (W7) |\n| `app/actions/whatsapp.ts` | lampiran outbound → `erpStorage(WHATSAPP_MEDIA_BUCKET)` (W8) |\n| `lib/payment-proof.ts` | inti upload/delete → `erpStorage(PAYMENT_PROOF_BUCKET)`; **ekspor `PAYMENT_PROOF_BUCKET` dipertahankan** |\n| `app/api/desain/[taskId]/attachments/[attachmentId]/route.ts` | `erpStorage` (R1) |\n| `app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts` | idem (R2) |\n| `app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts` | idem (R3) |\n| `app/api/crm/purchase-order/[id]/pdf/route.ts` | `erpStorage` untuk logo + aset desain (R4) |\n| `app/api/crm/invoice/[id]/pdf/route.ts` | logo + signature (R5) |\n| `app/api/crm/payment-transactions/[id]/kwitansi/route.ts` | `readImage` → `erpStorage` (R6) |\n| `app/api/master-data/business-profile/logo/route.ts` | `erpStorage` + `contentTypeFromPath` bila perlu (R7) |\n| `app/api/master-data/business-profile/signature/route.ts` | idem (R8) |\n| `app/api/public/business-logo/route.ts` | `erpStorage`; allowlist regex dipertahankan (R9) |\n| `app/api/keuangan/pengeluaran/[id]/bukti/route.ts` | `erpStorage` (R10) |\n| `app/api/crm/payment-transactions/[id]/proof/route.ts` | idem (R11) |\n| `app/api/crm/purchase-order/[id]/deposit/proof/route.ts` | idem (R12) |\n| `app/api/whatsapp/media/[id]/route.ts` | idem (R13) |\n| `worker/whatsapp.mjs` | K1–K3 driver-aware + impor `local-store.mjs` |\n| `.github/workflows/deploy.yml` | Package step + verifikasi tarball (3.4) |\n\n### 5.3 File yang disentuh ringan\n\n| File | Perubahan |\n|---|---|\n| `.env.example` | `ERP_STORAGE_DIR=./data/erp-storage`, `ERP_STORAGE_DRIVER=supabase` + komentar produksi |\n| `README.md` | satu paragraf: biner ERP di VPS, teks & path di Supabase; rujuk `docs/PANDUAN_STORAGE_ERP.md` |\n| `tests/crm-validation.test.mjs` | 1 assertion (`erpStorage(BUCKET)`) |\n| `tests/business-profile.test.mjs` | 1 assertion (`BUSINESS_ASSETS_BUCKET`) |\n| `package.json` | script `storage:migrate`, `storage:verify`, `storage:backup` |\n| `docs/PANDUAN_ABSENSI.md` | tidak berubah; hanya menjadi rujukan pola |\n\n### 5.4 Sengaja TIDAK diubah\n\n- `prisma/schema.prisma` + semua migrasi — path DB identik.\n- `scripts/setup-crm-storage.mjs`, `scripts/reset-crm-storage.mjs` — tetap ada selama transisi; dinonaktifkan di Fase 6.\n- Modul CMS (`lib/cms/*`) dan absensi (`lib/attendance/*`).\n- Kode Supabase Postgres (`lib/prisma.ts`, `lib/supabase/*`).\n- API publik/signed URL — tidak pernah ada dan tidak akan ditambahkan.\n\n---\n\n## 6. Fase implementasi\n\n### Fase 0 — Persiapan ops (VPS, sebelum kode)\n\n- [ ] T0.1 `df -h /var/lib`: sisa ≥ 2× total bucket saat ini + 5 GB headroom.\n- [ ] T0.2 Catat jumlah objek & byte per bucket (dashboard Supabase atau `--dry-run` setelah Fase 1).\n- [ ] T0.3 `sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage` (konfirmasi user PM2).\n- [ ] T0.4 Tambahkan ke `$DEPLOY_PATH/shared/.env`:\n  - `ERP_STORAGE_DIR=/var/lib/askonveksi/storage`\n  - `ERP_STORAGE_DRIVER=hybrid`\n- [ ] T0.5 Siapkan `/var/backups/askonveksi`; pastikan nama file backup absensi tidak bentrok.\n\n**Gate:** user aplikasi bisa `touch` di folder; env terpasang; kapasitas cukup.\n\n### Fase 1 — Modul storage + unit test (belum menyentuh call site)\n\n- [ ] T1.1 `lib/storage/local-store.mjs` sesuai 3.3A (atomik, `link`, validasi bucket+path, guard driver, `statFile`, `contentTypeFromPath`).\n- [ ] T1.2 `lib/storage/erp-storage.ts` sesuai 3.3B (`import \"server-only\"`, adapter, 3 driver, fail-hard hybrid, throttle log, path invalid tidak fallback).\n- [ ] T1.3 `tests/erp-storage.test.mjs` (pola `tests/attendance-storage.test.mjs`, set env sebelum dynamic import):\n  - roundtrip put → get untuk png/jpg/pdf/webp dan path tanpa ekstensi;\n  - `upsert:false` menolak file yang sudah ada; `upsert:true` menimpa dan pembaca hanya melihat isi baru;\n  - traversal: `../x`, `..`, `/abs`, `a\\0b`, `a\\b`, `.hidden/x`, bucket `../evil`;\n  - `removeFiles` tidak melempar untuk path hilang; `statFile`/`fileExists` akurat;\n  - `contentTypeFromPath` benar + fallback octet-stream;\n  - guard: driver invalid throw; driver non-supabase dengan `ERP_STORAGE_DIR` relatif throw;\n  - adapter driver `local`: upload/download/remove/exists (tanpa jaringan).\n- [ ] T1.4 Perbarui hanya dua assertion di 2.5, lalu jalankan `npm run lint && npx tsc --noEmit && npm test`.\n- [ ] T1.5 `npm run build` sukses (modul belum dipakai produksi).\n\n**Gate:** semua command hijau; diff hanya menambah file + dua assertion test.\n\n### Fase 2 — Port 19 call site app, driver masih `supabase`\n\nUrutan (mudah → sulit):\n\n1. [ ] T2.1 `lib/payment-proof.ts` (W9) + test bukti bayar.\n2. [ ] T2.2 R10, R11, R12.\n3. [ ] T2.3 `app/actions/master-data.ts` (W7) + R7, R8, R9.\n4. [ ] T2.4 R5, R6, R4 (tiga PDF ini dipakai worker via HTTP — uji khusus).\n5. [ ] T2.5 `app/actions/design.ts` (W1) + R1.\n6. [ ] T2.6 `app/actions/production.ts` (W2–W5) — pertahankan urutan `exists → download → upload upsert → remove`.\n7. [ ] T2.7 `app/actions/crm.ts` penjahit (W6) + R3; R2.\n8. [ ] T2.8 `app/actions/whatsapp.ts` (W8) + R13.\n9. [ ] T2.9 Hapus import `createAdminClient` yang tidak terpakai, satu per satu (beberapa file masih memakainya untuk hal lain).\n\nPer porting: pesan `UserFacingError`, `console.error`, dan header respons harus identik.\n\n- [ ] T2.10 `npm run lint && npx tsc --noEmit && npm test && npm run build`.\n\n**Gate:** tanpa env driver (default `supabase`), perilaku aplikasi sama persis; UAT spot-check lulus.\n\n### Fase 3 — Worker + deploy workflow\n\n- [ ] T3.1 Port K1–K3 (driver-aware; cap 5 MB; chunk 100 untuk Supabase; `removeFiles` untuk VPS).\n- [ ] T3.2 `deploy.yml`: salin `local-store.mjs` + verifikasi tarball.\n- [ ] T3.3 `node --check worker/whatsapp.mjs`; `node scripts/collect-worker-deps.mjs /tmp/deploy-check` exit 0.\n- [ ] T3.4 Uji lokal: `npm run whatsapp:worker:dev`, kirim/terima pesan berlampiran, hapus akun uji → file VPS terhapus.\n- [ ] T3.5 `npm run lint && npx tsc --noEmit && npm test && npm run build`.\n\n**Gate:** simulasi layout release (`/tmp/rel/{worker,lib/storage}`) + env temp → tidak ada `ERR_MODULE_NOT_FOUND`; mode `local` tidak membutuhkan env Supabase.\n\n### Fase 4 — Deploy transisi (`hybrid`)\n\n- [ ] T4.1 Merge Fase 1–3 ke `production`.\n- [ ] T4.2 Pastikan `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` sudah ada **sebelum** restart.\n- [ ] T4.3 Smoke test produksi (OWNER/DEVELOPER): PDF invoice & PO, desain PO & penjahit, bukti pengeluaran, kirim WA berfoto.\n- [ ] T4.4 Amati log PM2 24 jam: `[erp-storage] fallback-supabase` wajar untuk file lama; `hybrid-put-rollback`/error tulis VPS harus nol.\n\n**Gate:** upload baru ada di VPS (`find $ERP_STORAGE_DIR -newer /tmp/marker -type f`) **dan** di Supabase.\n\n### Fase 5 — Backfill + verifikasi\n\n- [ ] T5.1 Jalankan `node scripts/migrate-storage-to-vps.mjs` (idempoten).\n- [ ] T5.2 `--verify`: jumlah objek per bucket, ukuran per file, daftar hilang kosong.\n- [ ] T5.3 Checksum sampel ≥ 20 file (termasuk 5 terlama & 5 terbaru): SHA-256 lokal == blob Supabase.\n- [ ] T5.4 UAT penuh bagian 12 dengan `hybrid`.\n- [ ] T5.5 Pasang cron backup + uji restore sekali.\n\n**Gate:** `--verify` bersih, UAT bersih, backup & restore teruji.\n\n### Fase 6 — Final cutover + pemangkasan (setelah grace period)\n\nKriteria masuk: tidak ada `fallback-supabase` selama 14 hari, backup rutin sukses, tidak ada insiden.\n\n- [ ] T6.1 `ERP_STORAGE_DRIVER=local`, restart PM2 app + worker.\n- [ ] T6.2 Spot-check bagian 12 dengan `local`.\n- [ ] T6.3 Simpan bucket Supabase **kosong** sebagai cold copy selama 1 bulan pertama `local`; hapus setelah stabil (atau via dashboard).\n- [ ] T6.4 Rapikan `erp-storage.ts` (jalur Supabase boleh dibiarkan sebagai kode mati; hapus hanya bila yakin), perbarui `docs/PANDUAN_STORAGE_ERP.md` + `README.md`.\n- [ ] T6.5 Catat penghematan & tanggal di `TRACKING_REVISI.md`.\n\n---\n\n## 7. Runbook migrasi data (Fase 5)\n\n`scripts/migrate-storage-to-vps.mjs` (Node mjs; memakai `@supabase/supabase-js` + `dotenv` yang sudah ada, serta `local-store.mjs` untuk validasi/tulis):\n\n1. Baca env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ERP_STORAGE_DIR`.\n2. Untuk tiap bucket `[\"crm-po-designs\",\"business-assets\",\"payment-proofs\",\"whatsapp-media\"]`:\n   - walk rekursif `storage.list(prefix, { limit: 100, offset })`; elemen tanpa `id` = folder → antri;\n   - tiap objek: `storage.download(name)` → `putFile(bucket, name, bytes, { upsert: true })` setelah validasi path;\n   - **skip** bila `statFile` menunjukkan ukuran sama dengan `metadata.size` (idempoten/resume);\n   - verifikasi ukuran tertulis == `metadata.size`; catat kegagalan.\n3. `--dry-run`: listing + estimasi jumlah/bytes.\n4. `--verify`: tanpa menulis; bandingkan jumlah objek & ukuran; exit non-zero bila ada selisih.\n5. Ringkasan akhir per bucket: `objects, bytes, skipped, written, failed`.\n\n**Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses 0604:\n\n```bash\nsudo -u askonveksi -H bash -lc '\n  set -euo pipefail\n  rm -rf /tmp/askonveksi-migrate\n  git clone <repo> /tmp/askonveksi-migrate\n  cd /tmp/askonveksi-migrate\n  npm ci                                  # penuh: dotenv + Prisma CLI ada di devDependencies\n  set -a; . \"$DEPLOY_PATH/shared/.env\"; set +a\n  node scripts/migrate-storage-to-vps.mjs --dry-run\n  node scripts/migrate-storage-to-vps.mjs\n  node scripts/migrate-storage-to-vps.mjs --verify\n'\n```\n\nCatatan:\n\n- `npm ci --omit=dev` **jangan** dipakai: `dotenv` (diimpor script) dan `prisma` (dipanggil `postinstall`) ada di devDependencies.\n- Bila terpaksa menjalankan sebagai root, wajib `chown -R askonveksi:askonveksi /var/lib/askonveksi/storage` dan `chmod 0640` untuk file sebelum aplikasi di-restart.\n- Backfill boleh kapan pun setelah Fase 4; fallback hybrid menutup celah file yang lahir sebelum backfill selesai.\n\n---\n\n## 8. Backup & restore\n\n### 8.1 Backup harian\n\n`scripts/backup-erp-storage.sh`:\n\n```bash\n#!/usr/bin/env bash\nset -euo pipefail\nSRC=\"${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}\"\nDEST=\"${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}\"\nSTAMP=$(date +%Y%m%d-%H%M%S)\nmkdir -p \"$DEST\"\ntar -C \"$(dirname \"$SRC\")\" -czf \"$DEST/erp-storage-$STAMP.tar.gz\" \"$(basename \"$SRC\")\"\nls -1t \"$DEST\"/erp-storage-*.tar.gz | tail -n +15 | xargs -r rm -f\n```\n\nCron user aplikasi: `15 2 * * * /path/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1`\n\n### 8.2 Offsite (diaktifkan)\n\nRekomendasi revisi 2: aktifkan sejak Fase 5, karena setelah `local` file hanya ada di satu disk.\n\n```bash\n0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h\n```\n\nButuh konfigurasi rclone di VPS (B2/S3/Drive). Bila belum tersedia, minimal simpan salinan tar di mesin lain secara manual setiap minggu.\n\n### 8.3 Restore (uji sekali di Fase 5)\n\n```bash\npm2 stop <pm2-app> <pm2-wa>\ntar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz\nsudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage\npm2 start <pm2-app> <pm2-wa>\nnode scripts/migrate-storage-to-vps.mjs --verify   # selama grace period\n```\n\nProyek memakai PM2, bukan systemd; jangan memakai `systemctl` untuk proses aplikasi.\n\n### 8.4 Pasangan backup DB ↔ file\n\nRestore DB (Supabase) dan restore file (tar VPS) harus dari waktu yang berdekatan. Path di DB menunjuk ke file: file hilang = route 404 (bukan crash). Catat prosedur ini di `docs/PANDUAN_STORAGE_ERP.md`.\n\n---\n\n## 9. Monitoring & kapasitas\n\n- [ ] `[erp-storage] fallback-supabase` (di-throttle) = indikator backfill belum tuntas; hilang setelah `local`.\n- [ ] `[erp-storage] hybrid-put-rollback` atau error tulis VPS = **alert**, bukan info.\n- [ ] Cron mingguan: `df -P \"$ERP_STORAGE_DIR\" | tail -1`; alert bila Use% ≥ 80%.\n- [ ] Ukur ulang bulanan: total byte folder vs baseline T0.2.\n- [ ] Pastikan perubahan `deploy.yml` tidak mengubah urutan job Prisma.\n\n---\n\n## 10. Rollback plan\n\n| Situasi | Tindakan |\n|---|---|\n| Bug saat Fase 2 (driver `supabase`) | Revert merge / redeploy release sebelumnya. Nol dampak data. |\n| Bug saat Fase 4–5 (hybrid) | Set `ERP_STORAGE_DRIVER=supabase` + `pm2 restart` kedua proses. Aman karena hybrid fail-hard menjamin setiap upload sukses ada di Supabase. |\n| Redeploy release lama saat hybrid | Aman — release lama membaca Supabase yang selalu ikut ditulis. |\n| Masalah setelah Fase 6 (`local`) | Kembalikan ke `hybrid` (bukan `supabase`) lalu investigasi; sinkronkan local→Supabase dulu bila terpaksa kembali ke `supabase`. |\n\n---\n\n## 11. Risiko & mitigasi\n\n| # | Risiko | Dampak | Mitigasi |\n|---|---|---|---|\n| 1 | Disk VPS gagal / folder salah di dalam `releases/` | Gambar hilang | Path absolut di luar release + guard produksi + backup harian/offsite + `--verify` periodik |\n| 2 | Worker crash karena modul tidak ikut tar | Media WA berhenti tersimpan | Salin `local-store.mjs` + verifikasi tar + simulasi layout release |\n| 3 | Path traversal lewat kolom DB compromised | Kebocoran file | Validasi bucket+path + test traversal + path invalid tidak fallback |\n| 4 | Torn read saat overwrite desain | PDF/gambar rusak | Tulis atomik temp → `rename` |\n| 5 | Lupa satu dari 19 call site | Fitur 404/error | Checklist 5.2 + UAT per fitur |\n| 6 | Test lama patah dan dilewatkan | Regresi | Adapter menjaga bentuk method; hanya 2 assertion diubah; `npm test` wajib hijau |\n| 7 | Hybrid lupa dimatikan | Supabase dobel | Gate Fase 6 + log fallback |\n| 8 | Backup tak pernah diuji | Panic saat insiden | T5.5 wajib restore |\n| 9 | Kapasitas disk kurang | Upload gagal | Gate T0.1 + alert 80% |\n| 10 | Snapshot logo/signature lama menunjuk file yang terhapus | Kop invoice lama rusak | Kebijakan \"file lama tidak dihapus\" + backfill semua objek |\n| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif/di dalam cwd → throw |\n| 12 | Migrasi dijalankan sebagai root | File `root:root 0640`, aplikasi 404 | Runbook `sudo -u askonveksi` + verifikasi ownership |\n| 13 | Tulis Supabase gagal di hybrid | Rollback ke `supabase` kehilangan file baru | Fail-hard + cleanup VPS + log alert |\n| 14 | Log fallback membanjir selama backfill | Log PM2 penuh | Throttle per bucket+path |\n| 15 | Worker masih memakai guard Supabase | Media tidak tersimpan di `local` | Guard driver-aware + uji T3.4 |\n| 16 | `npm ci --omit=dev` di runbook lama | Migrasi gagal start | Runbook diperbaiki (bagian 7) |\n\n---\n\n## 12. UAT checklist (Fase 4/5/6, login OWNER/DEVELOPER)\n\n| Fitur | Langkah uji | Bukti sukses |\n|---|---|---|\n| Upload desain revisi PO | PO DRAFT + deposit lunas → upload 2 PNG → simpan | baris `DesignAttachment` baru; file di `.../crm-po-designs/design/...`; tampil inline |\n| Rollback upload desain | Paksa gagal transaksi (mis. versi > 4) | file hasil upload terhapus di VPS & Supabase |\n| Anotasi & versi produksi | Simpan Versi → Reset → Ganti Desain → Masukkan ke Produksi | snapshot `production-design-original` ada saat anotasi; hilang setelah produksi; PDF benar |\n| Desain penjahit | Dialog Edit PDF Penjahit: upload, ganti, hapus | path `penjahit/<itemId>/...`; thumbnail & PDF benar |\n| Bukti pengeluaran & HPP | Tambah pengeluaran QRIS + PDF; ubah; buka | inline/download benar |\n| Bukti transaksi & deposit | Bayar DP dengan JPG; buka \"Lihat Deposit\" | tampil |\n| Logo & tanda tangan | Ganti logo/signature, centang hapus signature | preview, PDF invoice/PO, kwitansi, `/api/public/business-logo?v=` baru |\n| Lampiran WA outbound | Kirim gambar & PDF | terkirim; tampil di inbox; file di `whatsapp-media/outbound/...` |\n| Media WA inbound | Kirim foto & PDF dari HP | tersimpan (cap 5 MB), tampil |\n| Kirim invoice via WA | Aksi \"Kirim Invoice\" | worker ambil PDF via HTTP; tidak ada error |\n| Hapus akun WA | Hapus akun percobaan | media VPS terhapus |\n| Route publik | Buka landing tanpa login | logo tampil (R9) |\n\n---\n\n## 13. Di luar cakupan (sengaja)\n\n- CMS (`CMS_UPLOAD_DIR`) dan absensi (`ATTENDANCE_UPLOAD_DIR`) — sudah di VPS.\n- Supabase Postgres & Auth — tidak disentuh.\n- Serve file statis via nginx/domain — **tidak dilakukan**.\n- Skema path baru / kompresi / thumbnail — tidak diminta; path lama 1:1.\n\n---\n\n## 14. Keputusan\n\n### 14.1 Sudah dipilih (revisi 2)\n\n| # | Keputusan | Pilihan |\n|---|---|---|\n| 1 | Bentuk API | **Adapter `erpStorage(bucket)`** meniru supabase-js |\n| 2 | Kebijakan hybrid saat tulis gagal | **Fail-hard** (VPS + Supabase harus sama-sama sukses) |\n| 3 | Worker | **Impor `local-store.mjs`** yang ikut disalin ke release; logika driver 3 cabang inline di worker |\n| 4 | Grace period | **1 bulan** `hybrid` (minimal 14 hari tanpa fallback + backup/restore teruji) |\n| 5 | Backup offsite | **Diaktifkan** sejak Fase 5 |\n| 6 | Bucket Supabase di Fase 6 | **Disimpan kosong** 1 bulan sebagai cold copy, lalu hapus |\n| 7 | Default `.env.example` | `./data/erp-storage` + `supabase`; nilai produksi di dokumentasi |\n| 8 | Migrasi | Dijalankan sebagai user aplikasi; `npm ci` penuh; script memakai `putFile` |\n\n### 14.2 Konfirmasi ops yang masih diperlukan\n\n1. Nama user/group PM2 di VPS (default `askonveksi` — konfirmasi saat Fase 0).\n2. Ketersediaan `rclone` + remote tujuan untuk backup offsite.\n3. Lokasi clone sementara yang diizinkan di VPS (`/tmp` dipakai di runbook).\n\n---\n\n*Dokumen ini rancangan. Implementasi dimulai dari Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 tanpa melompati gate. Tidak ada kode yang diubah sampai revisi ini disetujui.*\n"
}
```

Wrote file successfully: FILE_TO_VPS.md

---

## Assistant

_Thinking:_

The file is written. Let me verify line count and maybe check for the typo "0604" which I wrote accidentally in section 7: "tidak terbaca proses 0604" — that's a typo. Let me fix. Also check "di luar folder release" etc.

Let me read the relevant part.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"0604\\|===\\|TODO\\|FIXME\" FILE_TO_VPS.md; wc -l FILE_TO_VPS.md; git status --short"
}
```

508:**Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses 0604:
674 FILE_TO_VPS.md
?? FILE_TO_VPS.md


---

## Assistant

_Thinking:_

Fix the typo line 508. It should say "tidak terbaca proses aplikasi (mode 0640)". Let me edit.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "**Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses 0604:",
  "newString": "**Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses aplikasi (mode `0640`):"
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now I should verify the document reads well. Let me read a few sections to ensure no issues, especially the table in section 2.2 (W2 says "upload upsert + upload upsert:false" etc.). Also check that the "Revisi 2" claims align.

Let me read lines 1-120 and 480-620 quickly.

**Tool: read**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "offset": 1,
  "limit": 80
}
```

Read file /home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md, lines 1-80
1: # FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS
2: 
3: > **Status: Revisi 2 — RANCANGAN, belum diimplementasikan.**
4: > Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.2**).
5: > Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.
6: 
7: ---
8: 
9: ## 0. Prinsip data: teks di Supabase, biner di VPS
10: 
11: ### 0.1 Pembagian yang tegas
12: 
13: | Jenis data | Tempat penyimpanan | Contoh |
14: |---|---|---|
15: | Teks & metadata | **Supabase Postgres** (satu-satunya sumber kebenaran) | nama file asli, path relatif, MIME, ukuran byte, anotasi JSON, relasi ke PO/invoice/customer |
16: | Biner (gambar, PDF) | **Disk VPS** (`ERP_STORAGE_DIR`) | byte PNG desain, PDF bukti bayar, WebP logo, media WhatsApp |
17: 
18: Yang dipindahkan **hanya byte file**. Tidak ada kolom baru, tidak ada perubahan tipe kolom, tidak ada penulisan ulang path di baris mana pun.
19: 
20: ### 0.2 Bentuk path yang disimpan (penting)
21: 
22: Database tetap menyimpan **path relatif lama, tanpa prefix bucket dan tanpa prefix `vps/`**:
23: 
24: ```text
25: Kolom DB : design/6f1c.../a1b2....png
26: Lokasi   : /var/lib/askonveksi/storage/crm-po-designs/design/6f1c.../a1b2....png
27:            └──────── ERP_STORAGE_DIR ────────┘└── bucket ──┘└──── nilai kolom DB ────┘
28: ```
29: 
30: Nama bucket tidak disimpan di DB karena sudah tersirat oleh tabel/kolom pemiliknya. Contoh ilustrasi `vps/public/desain/desain1.jpg` **tidak** dipakai: menambahkan prefix semacam itu berarti menulis ulang seluruh path lama dan memecahkan kompatibilitas. Yang benar adalah path relatif tetap seperti sekarang; lokasi fisik diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path DB.
31: 
32: ### 0.3 Peta kolom → bucket → lokasi fisik
33: 
34: | Data | Kolom DB | Bucket | Contoh path DB | Lokasi fisik |
35: |---|---|---|---|---|
36: | Desain revisi PO | `DesignAttachment.path` | `crm-po-designs` | `design/<taskId>/<uuid>.png` | `<root>/crm-po-designs/design/<taskId>/<uuid>.png` |
37: | Snapshot desain awal produksi | `DesignAttachment.originalPath` | `crm-po-designs` | `production-design-original/<attachmentId>.png` | `<root>/crm-po-designs/production-design-original/<attachmentId>.png` |
38: | Desain penjahit | `PurchaseOrderItem.penjahitDesignPath` | `crm-po-designs` | `penjahit/<itemId>/<uuid>.png` | `<root>/crm-po-designs/penjahit/<itemId>/<uuid>.png` |
39: | Lampiran PO lama (legacy, read-only) | `PurchaseOrderAttachment.path` | `crm-po-designs` | path lama apa adanya | `<root>/crm-po-designs/<path lama>` |
40: | Logo perusahaan (dan snapshot invoice/PO) | `BusinessProfile.logoPath`, `Invoice.snapshotBusinessLogoPath`, `PurchaseOrder.snapshotBusinessLogoPath` | `business-assets` | `business/logo-<uuid>.png` | `<root>/business-assets/business/logo-<uuid>.png` |
41: | Tanda tangan perusahaan (dan snapshot) | `BusinessProfile.signaturePath`, `Invoice.snapshotSignaturePath` | `business-assets` | `business/signature-<uuid>.webp` | `<root>/business-assets/business/signature-<uuid>.webp` |
42: | Bukti pengeluaran / transaksi / deposit | `Expense.proofPath`, `PaymentTransaction.proofPath`, `PurchaseOrderDeposit.proofPath` | `payment-proofs` | `<ownerUserId>/<uuid>.pdf` | `<root>/payment-proofs/<ownerUserId>/<uuid>.pdf` |
43: | Media WhatsApp inbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `<accountId>/<YYYY-MM-DD>/<messageId>` (tanpa ekstensi) | `<root>/whatsapp-media/<accountId>/<YYYY-MM-DD>/<messageId>` |
44: | Lampiran WhatsApp outbound | `WhatsAppMessage.mediaPath` | `whatsapp-media` | `outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` | `<root>/whatsapp-media/outbound/<YYYY-MM-DD>/<uuid>-<namaAman>` |
45: 
46: Catatan: `PurchaseOrderAttachment` sudah tidak punya penulis di kode (hanya route baca R2). Baris lama tetap harus ikut di-backfill, tetapi tidak ada alur upload baru untuk tabel ini.
47: 
48: ### 0.4 Ringkasan perubahan revisi 2
49: 
50: 1. **Adapter `erpStorage(bucket)`** menggantikan fungsi bebas `erpGet/erpPut/erpRemove/erpExists`. Bentuknya meniru `supabase.storage.from(bucket)`, jadi 19 call site hanya berubah satu baris dan sebagian besar test sumber lama tetap hijau.
51: 2. **Hybrid fail-hard**, bukan best-effort: tulis dianggap sukses hanya jika VPS **dan** Supabase sama-sama berhasil; kalau salah satu gagal, operasi dibatalkan dan salinan yang terlanjur dibuat dibersihkan. Ini yang membuat janji rollback di bagian 10 benar-benar berlaku.
52: 3. **`putFile` atomik yang konsisten**: tulis ke file temp, lalu `rename` untuk `upsert:true` atau `link` untuk `upsert:false`. Flag `wx` dipakai pada file temp, bukan pada file final.
53: 4. **Guard konfigurasi produksi**: driver divalidasi, `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`.
54: 5. **Worker WhatsApp driver-aware**: guard `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` di tiga titik diganti logika driver, bukan dipertahankan apa adanya.
55: 6. **Runbook migrasi diperbaiki**: `npm ci --omit=dev` tidak dipakai (dotenv dan Prisma CLI ada di devDependencies); migrasi dijalankan sebagai user aplikasi agar file tidak menjadi milik `root`.
56: 7. **Default `.env.example` lokal** (`./data/erp-storage`), nilai produksi hanya di dokumentasi.
57: 8. **Detail implementasi baru**: `statFile`, throttle log fallback, `/* turbopackIgnore: true */`, `import "server-only"`, dan penegasan bahwa path tidak valid **tidak boleh** di-fallback ke Supabase.
58: 9. **Koreksi angka dan daftar test**: 6 file penulis / 9 titik tulis, 21 file diubah, dan hanya 2 assertion test yang perlu diperbarui berkat adapter.
59: 
60: ---
61: 
62: ## 1. Ringkasan keputusan
63: 
64: **Tujuan:** semua biner ERP (desain PO, desain produksi, desain penjahit, lampiran PO lama, bukti bayar/pengeluaran/deposit, logo & tanda tangan, media WhatsApp) dipindahkan dari Supabase Storage ke disk VPS di `/var/lib/askonveksi/storage`. Supabase Postgres tetap menyimpan seluruh teks dan path relatif.
65: 
66: **Mengapa aman (temuan audit):**
67: 
68: 1. Tidak ada satu pun `getPublicUrl`/`createSignedUrl` di codebase. Semua file disajikan lewat route API terautentikasi yang membaca via admin client lalu di-stream. Mengganti sumber byte tidak mengubah URL, header, atau perilaku route.
69: 2. Semua kolom DB berisi path relatif, bukan URL. Struktur path dipertahankan 1:1 di bawah `<ERP_STORAGE_DIR>/<nama-bucket>/`.
70: 3. Pola "file di volume VPS + DB simpan path relatif" sudah terbukti di modul ini: foto absensi (`lib/attendance/photo.ts`) dan CMS (`lib/cms/media.ts`), termasuk validasi anti path-traversal.
71: 
72: **Driver:**
73: 
74: | `ERP_STORAGE_DRIVER` | Tulis | Baca | Pemakaian |
75: |---|---|---|---|
76: | `supabase` | Supabase | Supabase | **Default kode** — perilaku lama persis |
77: | `hybrid` | VPS **dan** Supabase; gagal salah satu = gagal semua | VPS dulu, fallback Supabase bila belum ada di VPS | Masa transisi produksi (±1 bulan) |
78: | `local` | VPS saja | VPS saja | Setelah grace period |
79: 
80: **Domain `askonveksi.web.id` tidak diperlukan untuk penyimpanan.** Jangan serve folder statis via nginx: desain PO, bukti bayar, dan media WA harus tetap hanya lewat route yang butuh login. Route yang sama tetap dipakai; hanya sumber byte-nya yang berubah.
[Output truncated. Continue reading with offset: 81]

**Tool: read**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "offset": 480,
  "limit": 80
}
```

Read file /home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md, lines 480-559
480: **Gate:** `--verify` bersih, UAT bersih, backup & restore teruji.
481: 
482: ### Fase 6 — Final cutover + pemangkasan (setelah grace period)
483: 
484: Kriteria masuk: tidak ada `fallback-supabase` selama 14 hari, backup rutin sukses, tidak ada insiden.
485: 
486: - [ ] T6.1 `ERP_STORAGE_DRIVER=local`, restart PM2 app + worker.
487: - [ ] T6.2 Spot-check bagian 12 dengan `local`.
488: - [ ] T6.3 Simpan bucket Supabase **kosong** sebagai cold copy selama 1 bulan pertama `local`; hapus setelah stabil (atau via dashboard).
489: - [ ] T6.4 Rapikan `erp-storage.ts` (jalur Supabase boleh dibiarkan sebagai kode mati; hapus hanya bila yakin), perbarui `docs/PANDUAN_STORAGE_ERP.md` + `README.md`.
490: - [ ] T6.5 Catat penghematan & tanggal di `TRACKING_REVISI.md`.
491: 
492: ---
493: 
494: ## 7. Runbook migrasi data (Fase 5)
495: 
496: `scripts/migrate-storage-to-vps.mjs` (Node mjs; memakai `@supabase/supabase-js` + `dotenv` yang sudah ada, serta `local-store.mjs` untuk validasi/tulis):
497: 
498: 1. Baca env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ERP_STORAGE_DIR`.
499: 2. Untuk tiap bucket `["crm-po-designs","business-assets","payment-proofs","whatsapp-media"]`:
500:    - walk rekursif `storage.list(prefix, { limit: 100, offset })`; elemen tanpa `id` = folder → antri;
501:    - tiap objek: `storage.download(name)` → `putFile(bucket, name, bytes, { upsert: true })` setelah validasi path;
502:    - **skip** bila `statFile` menunjukkan ukuran sama dengan `metadata.size` (idempoten/resume);
503:    - verifikasi ukuran tertulis == `metadata.size`; catat kegagalan.
504: 3. `--dry-run`: listing + estimasi jumlah/bytes.
505: 4. `--verify`: tanpa menulis; bandingkan jumlah objek & ukuran; exit non-zero bila ada selisih.
506: 5. Ringkasan akhir per bucket: `objects, bytes, skipped, written, failed`.
507: 
508: **Jalankan sebagai user aplikasi** (bukan root), agar file tidak menjadi `root:root` dan tidak terbaca proses aplikasi (mode `0640`):
509: 
510: ```bash
511: sudo -u askonveksi -H bash -lc '
512:   set -euo pipefail
513:   rm -rf /tmp/askonveksi-migrate
514:   git clone <repo> /tmp/askonveksi-migrate
515:   cd /tmp/askonveksi-migrate
516:   npm ci                                  # penuh: dotenv + Prisma CLI ada di devDependencies
517:   set -a; . "$DEPLOY_PATH/shared/.env"; set +a
518:   node scripts/migrate-storage-to-vps.mjs --dry-run
519:   node scripts/migrate-storage-to-vps.mjs
520:   node scripts/migrate-storage-to-vps.mjs --verify
521: '
522: ```
523: 
524: Catatan:
525: 
526: - `npm ci --omit=dev` **jangan** dipakai: `dotenv` (diimpor script) dan `prisma` (dipanggil `postinstall`) ada di devDependencies.
527: - Bila terpaksa menjalankan sebagai root, wajib `chown -R askonveksi:askonveksi /var/lib/askonveksi/storage` dan `chmod 0640` untuk file sebelum aplikasi di-restart.
528: - Backfill boleh kapan pun setelah Fase 4; fallback hybrid menutup celah file yang lahir sebelum backfill selesai.
529: 
530: ---
531: 
532: ## 8. Backup & restore
533: 
534: ### 8.1 Backup harian
535: 
536: `scripts/backup-erp-storage.sh`:
537: 
538: ```bash
539: #!/usr/bin/env bash
540: set -euo pipefail
541: SRC="${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}"
542: DEST="${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}"
543: STAMP=$(date +%Y%m%d-%H%M%S)
544: mkdir -p "$DEST"
545: tar -C "$(dirname "$SRC")" -czf "$DEST/erp-storage-$STAMP.tar.gz" "$(basename "$SRC")"
546: ls -1t "$DEST"/erp-storage-*.tar.gz | tail -n +15 | xargs -r rm -f
547: ```
548: 
549: Cron user aplikasi: `15 2 * * * /path/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1`
550: 
551: ### 8.2 Offsite (diaktifkan)
552: 
553: Rekomendasi revisi 2: aktifkan sejak Fase 5, karena setelah `local` file hanya ada di satu disk.
554: 
555: ```bash
556: 0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
557: ```
558: 
559: Butuh konfigurasi rclone di VPS (B2/S3/Drive). Bila belum tersedia, minimal simpan salinan tar di mesin lain secara manual setiap minggu.
[Output truncated. Continue reading with offset: 560]

---

## Assistant

_Thinking:_

The document looks good. A couple of details to double-check:

1. Line 4 says "lihat bagian **0.2**" but the summary is in 0.4. Fix to 0.4.
2. `chmod 0640` note: `chmod 0640` only applies to files, but `chmod -R 0640` would break directories. The text says "chmod 0640 untuk file", okay.
3. The W2 row says "upload upsert, upload upsert:false" — original W2 also does `download`, `exists`, `remove`? W2 `saveProductionDesignAction` doesn't remove; it uploads snapshot with upsert:false and overwrites attachment path. Fine.
4. Section 2.5 says only 2 assertions break. Is that truly accurate with adapter? Let's double-check `tests/crm-validation` L1071 and L1072. If we set `const storage = erpStorage(BUCKET);`, L1072 `assert.match(designActionSource, /storage\.upload\(attachment\.path/)` stays. L1071 `storage\.from\(BUCKET\)` fails. Yes.
   Business-profile L67 fails.
   Production tests: `storage.upload(originalPath, bytes, { contentType, upsert: true })` stays if we keep variable `storage` and method signature. L40 `.exists(originalPath)` stays. L41 `[400,404].includes(snapshot.error.status` — adapter must return `error.status`; we specified that. L42 `upsert: false` stays. L52 `.remove([attachment.originalPath])` stays.
   `tests/production-view-design-images` L77 stays.
   What about `tests/crm-validation.test.mjs` L1072 requires `attachment.path` exactly; yes.
   Any test asserting `createAdminClient` in these files? Probably not. Let me grep quickly to be sure. Also maybe `tests/business-profile.test.mjs` has `createAdminClient` assertion? Let me check.

5. There might be a test that asserts routes use `createAdminClient`? grep.

Let me check.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"createAdminClient\\|storage\\.from\\|erpStorage\" tests/*.test.mjs"
}
```

(no output)
Exited with code 1

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"business-assets\\|PAYMENT_PROOF_BUCKET\\|crm-po-designs\" tests/business-profile.test.mjs tests/crm-validation.test.mjs tests/production-*.test.mjs"
}
```

tests/business-profile.test.mjs:67:  assert.match(signatureRouteSource, /business-assets/);
tests/crm-validation.test.mjs:1066:  assert.match(storageScript, /crm-po-designs/);
tests/crm-validation.test.mjs:1627:  assert.match(routeSource, /PAYMENT_PROOF_BUCKET/);


---

## Assistant

_Thinking:_

Wait, the first grep returned no output? That's odd because earlier `grep -rn "storage\.from\(BUCKET\)"` found tests. The pattern "storage\.from" with backslash in shell double quotes? I used `grep -rn "createAdminClient\|storage\.from\|erpStorage"` — basic grep doesn't support `\|` unless -E or escaped? In GNU grep basic regex, `\|` is alternation. It should work. But returned nothing? Earlier we saw `assert.match(designActionSource, /storage\.from\(BUCKET\)/)` in tests/crm-validation. Hmm, maybe because `\|` with double quotes and shell? The command uses double quotes; `\|` stays `\|`. GNU grep BRE supports `\|`. Weird. But the second grep shows the bucket refs. Let me re-run with `-E`. Not critical. Earlier we already confirmed L1071. Let me just check `grep -n "storage" tests/crm-validation.test.mjs tests/production-*`.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -nE \"storage|createAdminClient\" tests/crm-validation.test.mjs tests/production-design-detail.test.mjs tests/production-view-design-images.test.mjs | head -30"
}
```

tests/crm-validation.test.mjs:1051:  const storageScript = await readFile(new URL("../scripts/reset-crm-storage.mjs", import.meta.url), "utf8");
tests/crm-validation.test.mjs:1062:  assert.doesNotMatch(sql, /DELETE FROM storage\./);
tests/crm-validation.test.mjs:1063:  assert.doesNotMatch(sql, /INSERT INTO storage\./);
tests/crm-validation.test.mjs:1064:  assert.match(storageScript, /emptyBucket\(bucketId\)/);
tests/crm-validation.test.mjs:1065:  assert.match(storageScript, /deleteBucket\(bucketId\)/);
tests/crm-validation.test.mjs:1066:  assert.match(storageScript, /crm-po-designs/);
tests/crm-validation.test.mjs:1067:  assert.match(storageScript, /public: false/);
tests/crm-validation.test.mjs:1068:  assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
tests/crm-validation.test.mjs:1071:  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
tests/crm-validation.test.mjs:1072:  assert.match(designActionSource, /storage\.upload\(attachment\.path/);
tests/crm-validation.test.mjs:1106:  assert.doesNotMatch(sql, /(?:DELETE|INSERT|UPDATE)\s+(?:FROM\s+)?storage\./i);
tests/production-design-detail.test.mjs:147:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
tests/production-design-detail.test.mjs:149:  assert.doesNotMatch(overwrite, /storage\.download\(attachment\.path\)/);
tests/production-view-design-images.test.mjs:77:  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);


---

## Assistant

_Thinking:_

Confirmed. Note `tests/production-design-detail.test.mjs:149` `doesNotMatch(overwrite, /storage\.download\(attachment\.path\)/)` — with adapter, overwrite doesn't call download of attachment.path (it uploads new path), so stays. Good.

Now fix the "lihat bagian 0.2" → "0.4". Also, check the document's claim in 2.5 about L40-42 — actual lines may be 40-42 as we saw (`assert.match(actions, /\.exists\(originalPath\)/)` at L40). Yes.

Also the line 4 reference. Let me fix.

Also in section 14.1, "Migrasi ... script memakai putFile" — fine.

One more: in section 3.3A, `assertStorageReady` guard says "produksi" but we might want it always for driver != supabase. I wrote earlier: "Driver ≠ supabase dan ERP_STORAGE_DIR kosong/relatif → throw" (always), plus production and inside cwd → throw. That's good: relative path rejected always for local/hybrid. But local dev default `./data/erp-storage` is relative, so this would throw! Conflict: default local path is relative. Need to resolve: the guard should resolve the default to absolute via `resolve()`; relative path is allowed in dev (resolved against cwd), but in production driver != supabase it must be explicitly absolute and outside cwd. The doc currently says:
- "Driver ≠ supabase dan ERP_STORAGE_DIR kosong/relatif → throw." → this conflicts with local default `./data/erp-storage`.
- Then "Driver ≠ supabase, NODE_ENV=production, dan ERP_STORAGE_DIR berada di dalam process.cwd() → throw."

I should clarify:
- `storeRoot()` = resolve(ERP_STORAGE_DIR || ./data/erp-storage) — relative allowed and resolved.
- In production with driver != supabase: ERP_STORAGE_DIR must be set, absolute, and not under cwd. If unset/relative/inside cwd → throw.
- In dev: relative/default allowed.

Let me fix section 3.2 bullets accordingly. Currently line ~? Let me find.

Also the 0.4 summary item 4 says "ERP_STORAGE_DIR wajib absolut dan di luar folder release saat driver ≠ supabase" — should add "di produksi". Fix.

Also risk #11 says "driver ≠ supabase + produksi + path relatif/di dalam cwd → throw" — correct.

Let me edit those.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.2**).",
  "newString": "> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.4**)."
}
```

Edited FILE_TO_VPS.md (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "4. **Guard konfigurasi produksi**: driver divalidasi, `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`.",
  "newString": "4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release."
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now fix section 3.2 bullets. Let me view the exact text.

**Tool: read**

**Input:**
```json
{}
```

Connection lost while reading the response: ECONNRESET: The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()

---

## Assistant

_Thinking:_

I need to continue. I was about to fix section 3.2 bullets about env guard. Let me read that section to get exact text, then edit.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n 210,245p FILE_TO_VPS.md"
}
```

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


---

## Assistant

_Thinking:_

I need to locate section 3.2 env guard bullets. Let me grep.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"Aturan validasi\\|Nilai driver\\|Driver ≠\\|Driver =\\|\\.env.example (nilai\" FILE_TO_VPS.md"
}
```

189:# .env.example (nilai lokal; produksi diisi di $DEPLOY_PATH/shared/.env)
201:Aturan validasi (dijalankan `lib/storage/local-store.mjs` saat pertama dibutuhkan):
203:- Nilai driver selain `supabase|hybrid|local` → **throw**, bukan diam-diam jatuh ke default.
204:- Driver ≠ `supabase` dan `ERP_STORAGE_DIR` kosong/relatif → throw.
205:- Driver ≠ `supabase`, `NODE_ENV=production`, dan `ERP_STORAGE_DIR` berada di dalam `process.cwd()` → throw (mencegah tulisan masuk folder release yang akan dihapus).
206:- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada.


---

## Assistant

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "- Nilai driver selain `supabase|hybrid|local` → **throw**, bukan diam-diam jatuh ke default.\n- Driver ≠ `supabase` dan `ERP_STORAGE_DIR` kosong/relatif → throw.\n- Driver ≠ `supabase`, `NODE_ENV=production`, dan `ERP_STORAGE_DIR` berada di dalam `process.cwd()` → throw (mencegah tulisan masuk folder release yang akan dihapus).\n- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada.",
  "newString": "- Nilai driver selain `supabase|hybrid|local` → **throw**, bukan diam-diam jatuh ke default.\n- Di lokal/dev, `ERP_STORAGE_DIR` boleh relatif atau kosong; nilainya di-resolve terhadap `process.cwd()` dengan default `./data/erp-storage`.\n- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset, absolut, dan berada di luar `process.cwd()`**. Kosong, relatif, atau di dalam folder release → throw (mencegah tulisan masuk folder release yang akan dihapus).\n- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada dan tidak divalidasi."
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now let me check the rest of the document for consistency. One more concern: in section 2.5 I claim only 2 assertions break; but `tests/crm-validation.test.mjs` line 1072 uses `storage.upload(attachment.path` — if we name variable `storage` yes. Fine.

Also `tests/business-profile.test.mjs` L67 — route changes to `BUSINESS_ASSETS_BUCKET`; yes.

Now check section 5.2 row for R7/R8 "contentTypeFromPath bila perlu": R7/R8 use `data.type`; with adapter local returns type from extension, so no route change needed for content type. The doc says "+ contentTypeFromPath bila perlu" — that's slightly off because adapter provides `type`. But R7/R8 may need no change at all besides `erpStorage`. Let me correct: "`erpStorage`; `data.type` tetap tersedia dari adapter (fallback `contentTypeFromPath`)". Minor but worth fixing for accuracy.

Also section 3.3B says "R7/R8 tidak perlu perubahan isi" — consistent.

Let me fix 5.2 rows.

Also check section 3.3B adapter's `upload` error type includes status; yes.

Another consistency issue: 3.3B `hybrid upload`: "Jika VPS gagal → kembalikan error, jangan menulis ke Supabase". But what about `upsert:false` and file already exists in Supabase (pre-backfill)? VPS write would succeed (file not on VPS), then Supabase upload fails EEXIST, then delete VPS and return error. That's fine.

Another: `local` download returns Blob type from `contentTypeFromPath`, but for payment proofs the routes use DB mime, so fine. For WA inbound no extension, route uses DB mime. Fine.

Another: `erpStorage` for `supabase` mode delegates `download` returning Blob; `data.type` from Supabase. Good.

Now let me fix the R7/R8 row.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "| `app/api/master-data/business-profile/logo/route.ts` | `erpStorage` + `contentTypeFromPath` bila perlu (R7) |\n| `app/api/master-data/business-profile/signature/route.ts` | idem (R8) |",
  "newString": "| `app/api/master-data/business-profile/logo/route.ts` | `erpStorage`; `data.type` tetap tersedia dari adapter (R7) |\n| `app/api/master-data/business-profile/signature/route.ts` | idem (R8) |"
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now, let's do a final sanity check of the doc: grep for leftover references to `erpGet`/`erpPut` in places that imply the chosen API, and for contradictory counts.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"erpGet\\|erpPut\\|erpRemove\\|erpExists\\|best-effort\\|--omit=dev\\|19 file\\|20 file\\|21 file\\|6 file\" FILE_TO_VPS.md"
}
```

50:1. **Adapter `erpStorage(bucket)`** menggantikan fungsi bebas `erpGet/erpPut/erpRemove/erpExists`. Bentuknya meniru `supabase.storage.from(bucket)`, jadi 19 call site hanya berubah satu baris dan sebagian besar test sumber lama tetap hijau.
51:2. **Hybrid fail-hard**, bukan best-effort: tulis dianggap sukses hanya jika VPS **dan** Supabase sama-sama berhasil; kalau salah satu gagal, operasi dibatalkan dan salinan yang terlanjur dibuat dibersihkan. Ini yang membuat janji rollback di bagian 10 benar-benar berlaku.
55:6. **Runbook migrasi diperbaiki**: `npm ci --omit=dev` tidak dipakai (dotenv dan Prisma CLI ada di devDependencies); migrasi dijalankan sebagai user aplikasi agar file tidak menjadi milik `root`.
58:9. **Koreksi angka dan daftar test**: 6 file penulis / 9 titik tulis, 21 file diubah, dan hanya 2 assertion test yang perlu diperbarui berkat adapter.
99:### 2.2 Titik tulis — **6 file, 9 titik**
283:  - **remove**: hapus di VPS dan Supabase, kumpulkan kegagalan. Bersifat best-effort seperti kode sekarang, tetapi kegagalan dicatat. Risiko "file hidup lagi lewat fallback" hanya mungkin bila sebuah path yang sudah dihapus masih dirujuk DB; alur rollback di kode selalu menghapus file yang belum dirujuk DB, sehingga risiko ini diterima dan dicatat.
476:- [ ] T5.3 Checksum sampel ≥ 20 file (termasuk 5 terlama & 5 terbaru): SHA-256 lokal == blob Supabase.
526:- `npm ci --omit=dev` **jangan** dipakai: `dotenv` (diimpor script) dan `prisma` (dipanggil `postinstall`) ada di devDependencies.
619:| 16 | `npm ci --omit=dev` di runbook lama | Migrasi gagal start | Runbook diperbaiki (bagian 7) |


**Tool: shell**

**Input:**
```json
{
  "command": "wc -l FILE_TO_VPS.md; git status --short; node -e \"const fs=require('fs');const s=fs.readFileSync('FILE_TO_VPS.md','utf8');console.log('fences',(s.match(/^```/gm)||[]).length);\""
}
```

/usr/bin/bash: -c: line 1: unexpected EOF while looking for matching ``'

Exited with code 2

---

## Assistant

_Thinking:_

The shell command failed because of backticks in double quotes (the node -e with template? Actually the `grep` was fine; the second command's node script contains backticks? No, it contains `^```/gm` inside double quotes, causing shell command substitution issues. Not important. Let me run wc/git separately.

**Tool: shell**

**Input:**
```json
{
  "command": "wc -l FILE_TO_VPS.md; git status --short"
}
```

674 FILE_TO_VPS.md
?? FILE_TO_VPS.md


---

## Assistant

_Thinking:_

Now the doc is revised. Let me do a final review of some key sections to ensure no contradictions:

- Section 2.5 only 2 assertions.
- Section 3.3B API.
- Section 6 Fase 1 test list.
- Section 14 decisions.

Let me read 240-330 and 440-480 quickly.

**Tool: read**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "offset": 246,
  "limit": 90
}
```

Read file /home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md, lines 246-335
246: 
247: #### B. `lib/storage/erp-storage.ts` — adapter ber-bentuk supabase-js
248: 
249: ```ts
250: import "server-only";
251: 
252: export const PO_DESIGNS_BUCKET = "crm-po-designs";
253: export const BUSINESS_ASSETS_BUCKET = "business-assets";
254: export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
255: export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
256: 
257: type StorageError = { message: string; status?: number; statusCode?: string };
258: type StorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };
259: 
260: export function erpStorage(bucket: string): {
261:   upload(path: string, bytes: Uint8Array, opts?: { contentType?: string; upsert?: boolean }): Promise<{ data: { path: string } | null; error: StorageError | null }>;
262:   download(path: string): Promise<{ data: StorageFile | null; error: StorageError | null }>;
263:   remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }>;
264:   exists(path: string): Promise<{ data: boolean; error: StorageError | null }>;
265: };
266: ```
267: 
268: **Mengapa adapter, bukan fungsi bebas:** call site saat ini memakai `const storage = createAdminClient().storage.from(BUCKET)` lalu `storage.upload(...)`, `storage.download(...)`, `storage.remove(...)`, `storage.exists(...)`. Dengan adapter, satu-satunya perubahan adalah baris konstruksi menjadi `const storage = erpStorage(BUCKET)`. Nama method, argumen, dan bentuk `{ data, error }` tetap, sehingga:
269: 
270: - 19 call site berubah minim (1 baris + hapus import yang tidak terpakai);
271: - `data` dibuat mirip `Blob` (`arrayBuffer()`, `type`), jadi `await data.arrayBuffer()` di route tetap jalan;
272: - `snapshot.error.status` di W2 tetap tersedia;
273: - test sumber yang menyebut `.exists(...)`, `.remove(...)`, `storage.upload(...)` tetap hijau.
274: 
275: **Perilaku per driver:**
276: 
277: - `supabase`: delegasi langsung ke `createAdminClient().storage.from(bucket)`. Perilaku identik dengan kode sekarang (termasuk `data.type`).
278: - `local`: seluruh operasi lewat `local-store.mjs`. `download` mengembalikan objek mirip Blob dengan `type` dari `contentTypeFromPath(path)`. File tidak ada → `{ data: null, error: { message, status: 404 } }`.
279: - `hybrid`:
280:   - **upload**: `putFile` ke VPS dulu. Jika VPS gagal → kembalikan error, **jangan** menulis ke Supabase (mencegah state Supabase-only yang tidak tercermin di disk). Jika VPS sukses, tulis ke Supabase. Jika Supabase gagal → hapus salinan VPS, catat `[erp-storage] hybrid-put-rollback`, lalu kembalikan error. Dengan begitu operasi sukses berarti **keduanya** ada.
281:   - **download**: coba VPS; jika tidak ada, fallback Supabase dan catat `[erp-storage] fallback-supabase` (di-throttle per bucket+path, mis. sekali per 10 menit, agar log tidak banjir selama backfill).
282:   - **exists**: cek VPS **atau** Supabase. Ini penting untuk W2: snapshot lama yang baru ada di Supabase tidak boleh dianggap tidak ada.
283:   - **remove**: hapus di VPS dan Supabase, kumpulkan kegagalan. Bersifat best-effort seperti kode sekarang, tetapi kegagalan dicatat. Risiko "file hidup lagi lewat fallback" hanya mungkin bila sebuah path yang sudah dihapus masih dirujuk DB; alur rollback di kode selalu menghapus file yang belum dirujuk DB, sehingga risiko ini diterima dan dicatat.
284:   - **path tidak valid**: `resolveSafe` mengembalikan `null` → adapter langsung mengembalikan error `400` **tanpa** meneruskannya ke Supabase. Ini wajib agar validasi traversal tidak bisa dilewati lewat jalur fallback.
285: 
286: **Catatan tipe data:** `download` di mode `supabase` mengembalikan `Blob` asli; di mode `local`/`hybrid` mengembalikan objek mirip Blob. Keduanya mendukung `arrayBuffer()` dan `type`, jadi R7/R8 tidak perlu perubahan isi.
287: 
288: #### C. Worker WhatsApp
289: 
290: `worker/whatsapp.mjs` mengimpor `../lib/storage/local-store.mjs` (relatif terhadap file worker; worker dijalankan dengan `--cwd $CURRENT_LINK`, jadi modul berada di `<release>/lib/storage/local-store.mjs`).
291: 
292: Perubahan tiga titik:
293: 
294: - **K1** `storeInbound`: simpan ke VPS untuk driver `local`/`hybrid`, ke Supabase untuk `supabase`/`hybrid`. Guard lama (`NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY`) diganti logika driver:
295:   - `supabase` → wajib env Supabase;
296:   - `hybrid` → wajib env Supabase **dan** `ERP_STORAGE_DIR`;
297:   - `local` → cukup `ERP_STORAGE_DIR`.
298:   Cap 5 MB inbound dan penolakan file kosong tetap.
299: - **K2** `processAccountDeletion`: untuk `local`/`hybrid` hapus lewat `removeFiles`; untuk `supabase`/`hybrid` tetap `remove` chunk 100. Chunking berlaku untuk jalur Supabase.
300: - **K3** `performSendJob`: baca lampiran lewat VPS dulu (local/hybrid), fallback Supabase (hybrid), atau langsung Supabase (supabase). Error yang dilempar tetap jelas (`Lampiran ... tidak dapat dibaca`).
301: 
302: Logika driver di worker (±40 baris) sengaja ditulis inline di `whatsapp.mjs`; **primitif** fs, validasi path, dan konfigurasi tetap diimpor dari `local-store.mjs`. Ini menghindari dua implementasi validasi path yang bisa berbeda.
303: 
304: **Deploy:** `lib/storage/local-store.mjs` harus ikut disalin ke `deploy_package/lib/storage/`. `scripts/collect-worker-deps.mjs` hanya menyalin isi `node_modules`, jadi file repo ini tidak otomatis ikut.
305: 
306: ### 3.4 Deploy workflow (`.github/workflows/deploy.yml`)
307: 
308: Tambahan di Package step:
309: 
310: ```bash
311: mkdir -p deploy_package/lib/storage
312: cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
313: ```
314: 
315: Tambahan di verifikasi tarball:
316: 
317: ```bash
318: tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs' \
319:   || { echo 'local-store.mjs missing'; exit 1; }
320: ```
321: 
322: Tidak ada perubahan urutan job (build → migrate → deploy); langkah Prisma tidak disentuh.
323: 
324: ---
325: 
326: ## 4. Invarian keamanan (checklist review)
327: 
328: - [ ] Semua route tetap memakai `requireActor(...)`; tidak ada route publik baru selain R9 (allowlist regex dipertahankan).
329: - [ ] `resolveSafe` menolak `..`, path absolut, `\0`, `\`, segmen tersembunyi, dan bucket tidak valid; diuji dengan test khusus.
330: - [ ] Path tidak valid pada driver `hybrid` **tidak** di-fallback ke Supabase.
331: - [ ] `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`; driver invalid → throw.
332: - [ ] Header respons tidak berubah: `Cache-Control` (`private, no-store` atau `public, immutable` khusus R9), `X-Content-Type-Options: nosniff`, `Content-Disposition` inline/attachment.
333: - [ ] Validasi upload di call site tidak berubah (magic bytes `lib/design/image.ts` & `lib/payment-proof.ts`, limit 5/10/2 MB, nama file disanitasi, path dari UUID).
334: - [ ] Semantik "file lama logo/signature tidak dihapus" (W7) tetap.
335: - [ ] Cleanup saat transaksi DB gagal tetap berfungsi di hybrid: hapus di **kedua** lokasi.
[Output truncated. Continue reading with offset: 336]

**Tool: read**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "offset": 430,
  "limit": 50
}
```

Read file /home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md, lines 430-479
430: 
431: **Gate:** semua command hijau; diff hanya menambah file + dua assertion test.
432: 
433: ### Fase 2 — Port 19 call site app, driver masih `supabase`
434: 
435: Urutan (mudah → sulit):
436: 
437: 1. [ ] T2.1 `lib/payment-proof.ts` (W9) + test bukti bayar.
438: 2. [ ] T2.2 R10, R11, R12.
439: 3. [ ] T2.3 `app/actions/master-data.ts` (W7) + R7, R8, R9.
440: 4. [ ] T2.4 R5, R6, R4 (tiga PDF ini dipakai worker via HTTP — uji khusus).
441: 5. [ ] T2.5 `app/actions/design.ts` (W1) + R1.
442: 6. [ ] T2.6 `app/actions/production.ts` (W2–W5) — pertahankan urutan `exists → download → upload upsert → remove`.
443: 7. [ ] T2.7 `app/actions/crm.ts` penjahit (W6) + R3; R2.
444: 8. [ ] T2.8 `app/actions/whatsapp.ts` (W8) + R13.
445: 9. [ ] T2.9 Hapus import `createAdminClient` yang tidak terpakai, satu per satu (beberapa file masih memakainya untuk hal lain).
446: 
447: Per porting: pesan `UserFacingError`, `console.error`, dan header respons harus identik.
448: 
449: - [ ] T2.10 `npm run lint && npx tsc --noEmit && npm test && npm run build`.
450: 
451: **Gate:** tanpa env driver (default `supabase`), perilaku aplikasi sama persis; UAT spot-check lulus.
452: 
453: ### Fase 3 — Worker + deploy workflow
454: 
455: - [ ] T3.1 Port K1–K3 (driver-aware; cap 5 MB; chunk 100 untuk Supabase; `removeFiles` untuk VPS).
456: - [ ] T3.2 `deploy.yml`: salin `local-store.mjs` + verifikasi tarball.
457: - [ ] T3.3 `node --check worker/whatsapp.mjs`; `node scripts/collect-worker-deps.mjs /tmp/deploy-check` exit 0.
458: - [ ] T3.4 Uji lokal: `npm run whatsapp:worker:dev`, kirim/terima pesan berlampiran, hapus akun uji → file VPS terhapus.
459: - [ ] T3.5 `npm run lint && npx tsc --noEmit && npm test && npm run build`.
460: 
461: **Gate:** simulasi layout release (`/tmp/rel/{worker,lib/storage}`) + env temp → tidak ada `ERR_MODULE_NOT_FOUND`; mode `local` tidak membutuhkan env Supabase.
462: 
463: ### Fase 4 — Deploy transisi (`hybrid`)
464: 
465: - [ ] T4.1 Merge Fase 1–3 ke `production`.
466: - [ ] T4.2 Pastikan `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` sudah ada **sebelum** restart.
467: - [ ] T4.3 Smoke test produksi (OWNER/DEVELOPER): PDF invoice & PO, desain PO & penjahit, bukti pengeluaran, kirim WA berfoto.
468: - [ ] T4.4 Amati log PM2 24 jam: `[erp-storage] fallback-supabase` wajar untuk file lama; `hybrid-put-rollback`/error tulis VPS harus nol.
469: 
470: **Gate:** upload baru ada di VPS (`find $ERP_STORAGE_DIR -newer /tmp/marker -type f`) **dan** di Supabase.
471: 
472: ### Fase 5 — Backfill + verifikasi
473: 
474: - [ ] T5.1 Jalankan `node scripts/migrate-storage-to-vps.mjs` (idempoten).
475: - [ ] T5.2 `--verify`: jumlah objek per bucket, ukuran per file, daftar hilang kosong.
476: - [ ] T5.3 Checksum sampel ≥ 20 file (termasuk 5 terlama & 5 terbaru): SHA-256 lokal == blob Supabase.
477: - [ ] T5.4 UAT penuh bagian 12 dengan `hybrid`.
478: - [ ] T5.5 Pasang cron backup + uji restore sekali.
479: 
[Output truncated. Continue reading with offset: 480]

---

## Assistant

_Thinking:_

The doc looks coherent. One inconsistency: section 4 checklist item says "ERP_STORAGE_DIR wajib absolut ... saat driver ≠ supabase" without "di produksi", while section 3.2 clarifies production-only. Fix for consistency.

Also section 3.3A API comment `assertStorageReady() // guard produksi` fine.

Also one more subtlety: the adapter `remove` signature in supabase-js returns `{ data: FileObject[] | null, error }`; our `data: unknown` is okay for call sites (they only check error). Fine.

Potential issue: `upload` call sites pass `Uint8Array`; in TS, `Uint8Array<ArrayBufferLike>` might not be assignable to `Uint8Array` in TS 5.7+ due to generic ArrayBuffer? Since `bytes` from `new Uint8Array(...)`, it's `Uint8Array<ArrayBuffer>`; fine. But `Buffer` passed? In payment-proof `bytes` is Uint8Array. Fine. Could type as `Uint8Array | ArrayBuffer`. Minor. Not needed in doc.

One more: `erp-storage.ts` uses `process.env.WHATSAPP_MEDIA_BUCKET` at module load; fine.

Fix section 4 item. Also check 3.2's env guard mentions "di luar process.cwd()" — good.

Then final response to user summarizing what was revised. The user said "revisi saja ... jangan masuk ke code dulu". I've only edited the doc. I should state that.

Let me also double-check that the doc still says "Revisi 2" and not claiming implementation. Yes.

One more thought: The user emphasized "semua yang berhubungan dengan gambar masuk ke vps tapi semua yang berhubungan dengan teks itu ada di supabase". I covered in section 0. But note "PDF" isn't "gambar" — still binary; I included "biner (gambar, PDF)". Good.

Maybe add a sentence: "Tidak ada teks yang ikut pindah ke VPS; nama file, MIME, ukuran, dan path tetap di kolom DB." Already in 0.1.

Also user example `vps/public/desain/desain1.jpg` — I explicitly addressed in 0.2. Good.

Let me fix section 4 and then finalize.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md",
  "oldString": "- [ ] `ERP_STORAGE_DIR` wajib absolut dan di luar folder release saat driver ≠ `supabase`; driver invalid → throw.",
  "newString": "- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release; driver invalid → throw."
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now final response. Summarize what changed, where, and key decisions. Keep concise but informative. Mention no code touched. Mention the file is still untracked. Offer next step: implementation after approval, or adjust.

Also note the user asked "jangan masuk ke code dulu" — confirm. Could mention next step is Fase 0/1 when ready.

I should not ask too many questions. Maybe mention the 3 ops confirmations remain (user, rclone, /tmp). But say defaults are set.

Let me write in Indonesian.

`FILE_TO_VPS.md` sudah direvisi penuh (674 baris) dan **belum ada kode yang disentuh** — hanya dokumen ini yang berubah.

## Inti revisi

**1. Prinsip teks vs biner ditegaskan di bagian 0**
- Supabase Postgres = semua teks: nama file, path relatif, MIME, ukuran, anotasi, relasi.
- VPS = byte gambar/PDF saja.
- Path DB tetap bentuk lama (`design/<taskId>/<uuid>.png`) **tanpa** prefix `vps/` atau nama bucket. Lokasi fisik diturunkan: `ERP_STORAGE_DIR/<bucket>/<path DB>`.
- Contoh `vps/public/desain/desain1.jpg` dijelaskan sebagai ilustrasi yang **tidak** dipakai, karena akan memaksa penulisan ulang seluruh path lama.
- Ditambahkan tabel pemetaan kolom DB → bucket → path DB → lokasi fisik untuk semua jenis file.

**2. API diubah ke adapter `erpStorage(bucket)`**
Menggantikan `erpGet/erpPut/...`. Bentuknya meniru `supabase.storage.from(bucket)`, jadi 19 call site cukup ganti satu baris. Efeknya test lama tetap hijau; hanya **2 assertion** yang perlu diperbarui (`crm-validation` L1071 dan `business-profile` L67).

**3. Hybrid jadi fail-hard**
Tulis sukses hanya jika VPS **dan** Supabase sama-sama berhasil. Kalau Supabase gagal, salinan VPS dibersihkan dan operasi dikembalikan sebagai error. Ini membuat janji rollback di bagian 10 benar-benar berlaku.

**4. `putFile` atomik yang benar**
Temp file + `rename` untuk `upsert:true`; temp file + `link` untuk `upsert:false` (bukan `wx` pada file temp, yang tidak menolak path final yang sudah ada).

**5. Guard produksi**
Driver invalid → throw. Di produksi dengan driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release. Di lokal tetap boleh relatif/default `./data/erp-storage`.

**6. Worker driver-aware**
Guard `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` di K1–K3 diganti logika driver, sehingga mode `local` tidak butuh env Supabase.

**7. Runbook migrasi diperbaiki**
`npm ci --omit=dev` dihapus (dotenv + Prisma CLI ada di devDependencies). Migrasi dijalankan sebagai user aplikasi agar file tidak `root:root`, dengan catatan `chown` bila terpaksa root.

**8. Detail yang sebelumnya hilang**
`statFile`, throttle log fallback, `/* turbopackIgnore: true */`, `import "server-only"`, path invalid tidak boleh fallback ke Supabase, `erpExists` hybrid cek dua lokasi, dan restore memakai `pm2` (bukan `systemctl`).

**9. Angka & daftar test dikoreksi**
6 file penulis / 9 titik tulis, 21 file diubah, 19 call site app. Klaim lama bahwa assertion `storageScript` patah juga dikoreksi (script itu tidak berubah).

## Keputusan yang sudah dipilih
Adapter, hybrid fail-hard, worker impor `local-store.mjs`, grace period 1 bulan, backup offsite aktif, bucket Supabase disimpan kosong 1 bulan lalu dihapus, `.env.example` default lokal.

Yang masih perlu konfirmasi saat Fase 0 hanya tiga hal operasional: nama user PM2 (default `askonveksi`), ketersediaan `rclone`, dan izin pemakaian `/tmp` di VPS.

Kalau dokumen ini sudah oke, langkah berikutnya adalah implementasi Fase 0 → 1 (buat `local-store.mjs`, `erp-storage.ts`, dan test-nya) tanpa menyentuh call site dulu.

---

## User

oke sekarang kerjakan semua itu dengan hati hati dan pastikan selesai dengan benar tanpa kesalahan karena hari besok harus sudah presentasi jadi pastikan semua upload gambar ke vps / hapus gambar / edit gambar ke vps bisa dijalnkan

---

## Assistant

_Thinking:_

The user now asks to implement everything, carefully, ready for presentation tomorrow. This is a large implementation. We're no longer in plan mode. I need to implement the plan: Fase 1 modules + port all call sites + worker + deploy + tests + env + docs. Also need to verify lint, tsc, tests, build. This is substantial.

Let me first load the relevant skills per AGENTS.md? The task is backend storage migration, security-sensitive. AGENTS says before implementing any new feature, create plan and sharpen with grill-me skill. But grill-me isn't in available skills list. We've already planned extensively. For security-sensitive work, use `security-and-hardening` skill. For Prisma queries not relevant. Maybe load `security-and-hardening` since handling untrusted paths/files. Also `antislop`? Probably not needed. We should use the security skill per project instructions. Let me invoke it.

Also note: user wants "besok presentasi" so prioritize working upload/delete/edit images to VPS. We should implement carefully and run tests/build. Need to be mindful of time/tokens.

Let me load the skill and then inspect the exact code sections to modify. Let me plan the implementation order:

1. Create `lib/storage/local-store.mjs`.
2. Create `lib/storage/erp-storage.ts`.
3. Create `tests/erp-storage.test.mjs`.
4. Update `lib/payment-proof.ts`.
5. Update routes (13).
6. Update actions (design, production, crm, master-data, whatsapp).
7. Update worker.
8. Update deploy.yml, .env.example, package.json, README, docs.
9. Update 2 test assertions.
10. Run lint, tsc, tests, build.

Given the user's emphasis "semua upload gambar ke vps / hapus gambar / edit gambar ke vps bisa dijalankan", the driver default should probably be... They want images to go to VPS now. The plan default is `supabase`, with production `hybrid`. But for tomorrow's presentation, they likely want the app to actually store to VPS. Locally, if `.env` doesn't set `ERP_STORAGE_DRIVER`, default `supabase` means uploads still go to Supabase — not VPS. The user says "pastikan semua upload gambar ke vps ... bisa dijalankan". Maybe they want local/dev to use VPS by default? Hmm.

The document says default `supabase` for zero-risk. But user now explicitly wants uploads to VPS. We could set `.env.example` driver default `supabase` but their local `.env`? We shouldn't edit `.env` secrets maybe. We can check `.env` for ERP vars. The presentation likely runs locally or on VPS? They said "hari besok harus sudah presentasi". They want the feature working. Best approach: implement drivers, and set `.env` (local) to `ERP_STORAGE_DRIVER=local` + `ERP_STORAGE_DIR=./data/erp-storage` so uploads go to VPS during presentation. But modifying `.env` is sensitive; however it's a local config and user asked for uploads to VPS. Alternatively use `hybrid` locally? Without Supabase creds in local? `.env` likely has Supabase creds. Hybrid would dual-write, demonstrating VPS. But if local `.env` has Supabase, hybrid works. Yet user wants VPS. I think setting local `.env` to `local` is best for demonstrating VPS. But existing files in Supabase won't be visible locally unless backfilled; presentation may use existing data. Hybrid avoids broken images for old files (fallback to Supabase) and writes to VPS. That's safer for presentation: `hybrid`. But the user said "semua upload gambar ke vps / hapus / edit gambar ke vps bisa dijalankan" — hybrid writes to VPS and deletes both. Reads fallback. Perfect. Set local `.env` `ERP_STORAGE_DRIVER=hybrid` and `ERP_STORAGE_DIR=./data/erp-storage` so existing images still load while new ones go to VPS. But if Supabase creds present. Yes.

Wait: if local `.env` currently connects to production Supabase, hybrid will write to production Supabase too. That's fine (dual-write). But during presentation we don't want to pollute? They probably want files to persist. Hmm.

Alternatively default driver could be `local` when env missing? No — breaks old images. Hybrid is best.

We can add ERP vars to `.env` directly? The file is gitignored. I can append. But careful not to overwrite. We'll inspect `.env` (contains secrets; don't print fully). Use grep for ERP vars and presence of Supabase env keys, without printing values.

Also, the doc says implement Fase 0-6, but Fase 4-6 are ops/deploy steps. We can implement code + docs + scripts + tests. We cannot run VPS ops or deploy. The user says implement all, but realistically code. We should implement code and verify locally; note ops steps remain.

Critical: The user says "pastikan semua upload gambar ke vps / hapus gambar / edit gambar ke vps bisa dijalankan". So we must ensure local driver works and tests prove it. Maybe run an integration test with `ERP_STORAGE_DRIVER=local` for upload/get/delete/edit flows (without DB). Unit tests cover.

Let me load security skill first, then inspect files.

Actually, to save time, maybe skip skill? Project AGENTS explicitly says use security-and-hardening for security-sensitive work including untrusted input, storage. Must comply. Load it.

Then read exact call site snippets in parallel. Let me do skills + grep for createAdminClient imports across the 19 files.

Let's start.

**Tool: skill**

**Input:**
```json
{
  "id": "security-and-hardening"
}
```

<skill_content name="security-and-hardening">
# Skill: security-and-hardening

# Security and Hardening

## Overview

Security-first development practices for web applications. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory. Security isn't a phase — it's a constraint on every line of code that touches user data, authentication, or external systems.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services
- Adding file uploads, webhooks, or callbacks
- Handling payment or PII data

## Process: Threat Model First

Controls bolted on without a threat model are guesses. Before hardening, spend five minutes thinking like an attacker:

1. **Map the trust boundaries.** Where does untrusted data cross into your system? HTTP requests, form fields, file uploads, webhooks, third-party APIs, message queues, and **LLM output**. Every boundary is attack surface.
2. **Name the assets.** What's worth stealing or breaking? Credentials, PII, payment data, admin actions, money movement.
3. **Run STRIDE over each boundary** — a quick lens, not a ceremony:

| Threat | Ask | Typical mitigation |
|---|---|---|
| **S**poofing | Can someone impersonate a user/service? | Authentication, signature verification |
| **T**ampering | Can data be altered in transit or at rest? | Integrity checks, parameterized queries, HTTPS |
| **R**epudiation | Can an action be denied later? | Audit logging of security events |
| **I**nformation disclosure | Can data leak? | Encryption, field allowlists, generic errors |
| **D**enial of service | Can it be overwhelmed? | Rate limiting, input size caps, timeouts |
| **E**levation of privilege | Can a user gain rights they shouldn't? | Authorization checks, least privilege |

4. **Write abuse cases next to use cases.** For each feature, ask "how would I misuse this?" — then make that your first test.

If you can't name the trust boundaries for a feature, you're not ready to secure it. This is OWASP **A04: Insecure Design** — most breaches begin in design, not code.

## The Three-Tier Boundary System

### Always Do (No Exceptions)

- **Validate all external input** at the system boundary (API routes, form handlers)
- **Parameterize all database queries** — never concatenate user input into SQL
- **Encode output** to prevent XSS (use framework auto-escaping, don't bypass it)
- **Use HTTPS** for all external communication
- **Hash passwords** with bcrypt/scrypt/argon2 (never store plaintext)
- **Set security headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **Use httpOnly, secure, sameSite cookies** for sessions
- **Run the detected package manager's native audit** against the committed lockfile before every release

### Ask First (Requires Human Approval)

- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling
- Granting elevated permissions or roles

### Never Do

- **Never commit secrets** to version control (API keys, passwords, tokens)
- **Never log sensitive data** (passwords, tokens, full credit card numbers)
- **Never trust client-side validation** as a security boundary
- **Never disable security headers** for convenience
- **Never use `eval()` or `innerHTML`** with user-provided data
- **Never store sessions in client-accessible storage** (localStorage for auth tokens)
- **Never expose stack traces** or internal error details to users

## OWASP Top 10 Prevention Patterns

These are prevention patterns, not a ranking. For the 2021 ordering, see the quick-reference table in `../../references/security-checklist.md`.

### Injection (SQL, NoSQL, OS Command)

```typescript
// BAD: SQL injection via string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// GOOD: ORM with parameterized input
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### Broken Authentication

```typescript
// Password hashing
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET,  // From environment, not code
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,     // Not accessible via JavaScript
    secure: true,       // HTTPS only
    sameSite: 'lax',    // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  },
}));
```

### Cross-Site Scripting (XSS)

```typescript
// BAD: Rendering user input as HTML
element.innerHTML = userInput;

// GOOD: Use framework auto-escaping (React does this by default)
return <div>{userInput}</div>;

// If you MUST render HTML, sanitize first
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### Broken Access Control

```typescript
// Always check authorization, not just authentication
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);

  // Check that the authenticated user owns this resource
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' }
    });
  }

  // Proceed with update
  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

### Security Misconfiguration

```typescript
// Security headers (use helmet for Express)
import helmet from 'helmet';
app.use(helmet());

// Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // Tighten if possible
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  },
}));

// CORS — restrict to known origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

### Sensitive Data Exposure

```typescript
// Never return sensitive fields in API responses
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}

// Use environment variables for secrets
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

### Server-Side Request Forgery (SSRF)

Any time the server fetches a URL the user influenced — webhooks, "import from URL", image proxies, link previews — an attacker can aim it at internal services (cloud metadata, `localhost`, private IPs).

```typescript
// BAD: fetch whatever the user gives you
await fetch(req.body.webhookUrl);

// GOOD: allowlist scheme + host, reject if ANY resolved IP is private, forbid redirects
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_HOSTS = new Set(['hooks.example.com']);

async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  // Resolve ALL records; a single private/reserved address fails the check.
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.some((a) => ipaddr.parse(a.address).range() !== 'unicast')) {
    throw new Error('private/reserved IP');
  }
  return url;
}

await fetch(await assertSafeUrl(req.body.webhookUrl), { redirect: 'error' });
```

The `range() !== 'unicast'` check covers loopback, link-local `169.254.169.254` (cloud metadata, the #1 SSRF target), private, and unique-local ranges across IPv4 and IPv6.

**Caveat — this still has a TOCTOU gap.** `fetch` resolves DNS again after the check, so an attacker using a short-TTL record can rebind to an internal IP between validation and connection. For high-risk surfaces, resolve once and connect to the pinned IP, or put a filtering agent in front (`request-filtering-agent` / `ssrf-req-filter`).

## Input Validation Patterns

### Schema Validation at Boundaries

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

// Validate at the route handler
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten(),
      },
    });
  }
  // result.data is now typed and validated
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

### File Upload Safety

```typescript
// Restrict file types and sizes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ValidationError('File type not allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
  // Don't trust the file extension — check magic bytes if critical
}
```

## Triaging Dependency Audit Results

Package-manager audits report known advisories; they do not prove a package is trustworthy or that vulnerable code is reachable. Use this decision tree:

```
The native package-manager audit reports a vulnerability
├── Severity: critical or high
│   ├── Is the vulnerable code reachable in runtime, build, test, or deployment paths?
│   │   ├── YES --> Fix immediately (update, patch, or replace the dependency)
│   │   └── NO (confirmed unused across those paths) --> Fix soon, but not a blocker
│   └── Is a fix available?
│       ├── YES --> Update to the patched version
│       └── NO --> Check for workarounds, consider replacing the dependency, or add to allowlist with a review date
├── Severity: moderate
│   ├── Reachable in production? --> Fix in the next release cycle
│   └── Dev-only? --> Fix when convenient, track in backlog
└── Severity: low
    └── Track and fix during regular dependency updates
```

**Key questions:**
- Is the vulnerable function actually called in your code path?
- Is the dependency a runtime dependency or dev-only?
- Is the vulnerability exploitable given your deployment context (e.g., a server-side vulnerability in a client-only app)?

When you defer a fix, document the reason and set a review date.

### Supply-Chain Hygiene

Do not assume npm or treat the nearest manifest as the install root. Apply this order:

1. **Find the installation boundary and manager.** Use the workspace root that owns the lockfile, or an independent nested project only when it is outside that workspace. There, corroborate `packageManager` (when present), the lockfile, and CI; stop on disagreement or competing lockfiles. Pin the manager version and use the matrix in `../../references/security-checklist.md`.
2. **Block dependency scripts before first execution.** Bootstrap with scripts disabled or a documented fail-closed policy, inspect the pending script source, approve only the minimum required packages, commit the policy, then verify with a clean frozen/immutable install. Never blanket-approve scripts.

Audits only find known advisories; they do not catch a newly malicious or typosquatted package. Therefore:

- **Never apply forced audit remediation automatically** (`npm audit fix --force` or equivalent). Preview the remediation, read changelogs, and test each resulting upgrade; forced fixes may cross declared dependency ranges.
- **Verify registry signatures and provenance where supported** (`npm audit signatures`, `pnpm audit signatures`) and treat absence as a signal to investigate, not automatic proof of compromise.
- **Review new dependencies, lockfile diffs, and script-policy changes together** — ownership, maintenance, release age, provenance, transitive graph, and typosquats such as `cross-env` vs `crossenv` (OWASP **A06**, **LLM03**).

## Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter limit for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // 10 attempts per 15 minutes
}));
```

## Secrets Management

```
.env files:
  ├── .env.example  → Committed (template with placeholder values)
  ├── .env          → NOT committed (contains real secrets)
  └── .env.local    → NOT committed (local overrides)

.gitignore must include:
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
```

**Always check before committing:**
```bash
# Check for accidentally staged secrets
git diff --cached | grep -i "password\|secret\|api_key\|token"
```

**If a secret is ever committed, rotate it.** Deleting the line or rewriting history is not enough — assume it's compromised the moment it reaches a remote. Revoke and reissue the key first, then purge it from history.

## Data Privacy & Compliance

Securing data is "can an attacker read it?" Privacy is "should *we* even hold it, and for how long?" — a separate question that hardening doesn't answer. The cheapest data to protect, breach, and comply over is the data you never collected. Treat personal data as a liability to minimize, not an asset to hoard.

**Know what you hold.** You can't protect or honor a deletion request for data you can't find. Classify fields as you add them:

| Class | Examples | Handling |
|---|---|---|
| **Non-personal** | Aggregates, anonymized counts | Normal handling |
| **Personal (PII)** | Name, email, IP, device/user IDs | Minimize, access-control, include in export/delete |
| **Sensitive** | Health, finance, location, biometrics, gov IDs, anything about minors | Extra basis to collect, stricter access, often encryption + audit logging |

**Operating rules:**
- **Minimize and set a purpose.** Collect a field only against a stated use. "It might be useful later" is not a purpose — it's latent breach scope. Don't log PII into telemetry (the `observability-and-instrumentation` skill makes the same point from the ops side).
- **Set retention up front, then actually delete.** Every personal-data store needs a TTL and a working deletion path — including backups, caches, search indexes, and analytics copies. Data with no expiry is a breach scheduled for later.
- **Support the data-subject rights your jurisdiction requires** (GDPR/CCPA and kin): export, correct, and delete on request. These are engineering features — design the schema so a user's data is *findable* and *erasable*, not smeared irreversibly across systems.
- **Get consent before collection or third-party sharing**, and make it auditable. Sending PII to an analytics/ad/LLM vendor is "sharing" — the user's choice gates it, and the vendor needs a data-processing agreement.
- **Localize defaults, don't hardcode one region's law.** Data-residency and rules differ by user location; make the policy a configurable boundary, not an assumption.

When data crosses a trust boundary, validate it as untrusted (see Input Validation above); when a privacy incident exposes personal data, the breach-notification clock is part of the postmortem — follow the `debugging-and-error-recovery` skill.

## Securing AI / LLM Features

If your app calls an LLM — chatbots, summarizers, agents, RAG — it inherits a new attack surface. Map it to the [OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/):

- **Treat all model output as untrusted input (LLM05: Improper Output Handling).** Never pass LLM output straight into `eval`, SQL, a shell, `innerHTML`, or a file path. Validate and encode it exactly as you would raw user input.
- **Assume prompts can be hijacked (LLM01: Prompt Injection).** Untrusted text in the context window — a user message, a fetched web page, a PDF — can carry instructions. The system prompt is not a security boundary; enforce permissions in code, not in the prompt.
- **Keep secrets and other users' data out of prompts (LLM02 / LLM07).** Anything in the context can be echoed back. Don't put API keys, cross-tenant data, or the full system prompt where the model can repeat it.
- **Constrain tool and agent permissions (LLM06: Excessive Agency).** Scope tools to the minimum, require confirmation for destructive or irreversible actions, and validate every tool argument.
- **Bound consumption (LLM10: Unbounded Consumption).** Cap tokens, request rate, and loop/recursion depth so a crafted input can't run up cost or hang the system.
- **Isolate retrieval data (LLM08: Vector and Embedding Weaknesses).** In RAG, treat the vector store as a trust boundary: partition embeddings per tenant so one user can't retrieve another's data, and validate documents before indexing so poisoned content can't steer answers.

```typescript
// BAD: trusting model output as a command or as markup
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);                                   // arbitrary query execution
container.innerHTML = await llm.reply(userMessage);   // stored XSS, via the model

// GOOD: model output is data — parse defensively, then validate, then encode
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output'); // JSON.parse or schema failed
}
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```

## Security Review Checklist

```markdown
### Authentication
- [ ] Passwords hashed with bcrypt/scrypt/argon2 (salt rounds ≥ 12)
- [ ] Session tokens are httpOnly, secure, sameSite
- [ ] Login has rate limiting
- [ ] Password reset tokens expire

### Authorization
- [ ] Every endpoint checks user permissions
- [ ] Users can only access their own resources
- [ ] Admin actions require admin role verification

### Input
- [ ] All user input validated at the boundary
- [ ] SQL queries are parameterized
- [ ] HTML output is encoded/escaped
- [ ] Server-side URL fetches are allowlisted (no SSRF to internal services)

### Data
- [ ] No secrets in code or version control
- [ ] Sensitive fields excluded from API responses
- [ ] PII encrypted at rest (if applicable)
- [ ] Personal data is classified, collected against a stated purpose, and minimized
- [ ] Personal data has a retention limit and a working deletion path (incl. backups/indexes)
- [ ] Export/delete (data-subject) requests are supported where required; sharing with third parties has consent

### Infrastructure
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS restricted to known origins
- [ ] Dependencies audited for vulnerabilities
- [ ] Error messages don't expose internals

### Supply Chain
- [ ] One authoritative lockfile committed; CI uses that manager's frozen/immutable install
- [ ] Native audit triaged by reachability and fix risk; dependency install scripts blocked unless explicitly approved
- [ ] New dependencies reviewed (ownership, provenance, release age, transitive graph)

### AI / LLM (if used)
- [ ] Model output treated as untrusted (no eval/SQL/innerHTML/shell)
- [ ] Secrets and other users' data kept out of prompts
- [ ] Tool/agent permissions scoped; destructive actions require confirmation
```
## See Also

For detailed security checklists and pre-commit verification steps, see `../../references/security-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is an internal tool, security doesn't matter" | Internal tools get compromised. Attackers target the weakest link. |
| "We'll add security later" | Security retrofitting is 10x harder than building it in. Add it now. |
| "No one would try to exploit this" | Automated scanners will find it. Security by obscurity is not security. |
| "The framework handles security" | Frameworks provide tools, not guarantees. You still need to use them correctly. |
| "It's just a prototype" | Prototypes become production. Security habits from day one. |
| "Threat modeling is overkill here" | Five minutes of "how would I attack this?" prevents the design flaws no control can patch later. |
| "It's just LLM output, it's only text" | That "text" can be a SQL statement, a script tag, or a shell command. Treat it like any untrusted input. |
| "The audit passed, so the dependency is safe" | Audits match known advisories. They do not detect a newly malicious package or make unreviewed install scripts safe to execute. |
| "Collect it now, we might need it later" | Data you don't hold can't be breached, subpoenaed, or mis-deleted. "Might need it" is breach scope, not a purpose. |
| "We'll handle deletion requests manually" | Manual erasure misses backups, caches, and analytics copies. If the schema can't find a user's data, you can't honor the request — design for it. |
| "Compliance is legal's problem, not ours" | Export, deletion, retention, and consent are schema and code. Legal can't bolt them on after you've smeared PII across ten systems. |

## Red Flags

- User input passed directly to database queries, shell commands, or HTML rendering
- Secrets in source code or commit history
- API endpoints without authentication or authorization checks
- Missing CORS configuration or wildcard (`*`) origins
- No rate limiting on authentication endpoints
- Stack traces or internal errors exposed to users
- Dependencies with known critical vulnerabilities, competing lockfiles at one installation boundary, non-reproducible installs, or blanket-approved scripts
- Server fetches user-supplied URLs without an allowlist (SSRF)
- LLM/model output passed into a query, the DOM, a shell, or `eval`
- Secrets, PII, or the full system prompt placed inside an LLM context window
- Personal data collected with no stated purpose, retention limit, or deletion path
- PII sent to analytics/ad/LLM vendors with no consent or data-processing agreement
- "Delete my account" that only flips a flag while the personal data lingers in stores and backups

## Verification

After implementing security-relevant code:

- [ ] The native audit has no unmitigated reachable critical/high findings; CI preserves the authoritative lockfile and blocks unreviewed dependency scripts
- [ ] No secrets in source code or git history
- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected endpoint
- [ ] Security headers present in response (check with browser DevTools)
- [ ] Error responses don't expose internal details
- [ ] Rate limiting active on auth endpoints
- [ ] Server-side URL fetches validated against an allowlist (no SSRF)
- [ ] LLM/model output validated and encoded before use (if AI features present)
- [ ] Personal data is classified, minimized to a stated purpose, and has a retention limit
- [ ] Deletion and export requests work end-to-end (including backups, caches, and analytics copies)

Base directory for this skill: /home/haydar/Code/askonveksi/askonveksi/.agents/skills/security-and-hardening
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
</skill_files>
</skill_content>

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"ERP_STORAGE\\|NEXT_PUBLIC_SUPABASE_URL\\|SUPABASE_SECRET_KEY\" .env | sed 's/=.*/=<set>/' ; echo \"---\"; grep -n \"createAdminClient\" app/actions/design.ts app/actions/production.ts app/actions/crm.ts app/actions/master-data.ts app/actions/whatsapp.ts lib/payment-proof.ts app/api/desain/\\[taskId\\]/attachments/\\[attachmentId\\]/route.ts app/api/crm/purchase-order/\\[id\\]/attachments/\\[attachmentId\\]/route.ts app/api/crm/purchase-order/\\[id\\]/items/\\[itemId\\]/penjahit-design/route.ts app/api/crm/purchase-order/\\[id\\]/pdf/route.ts app/api/crm/invoice/\\[id\\]/pdf/route.ts app/api/crm/payment-transactions/\\[id\\]/kwitansi/route.ts app/api/master-data/business-profile/logo/route.ts app/api/master-data/business-profile/signature/route.ts app/api/public/business-logo/route.ts app/api/keuangan/pengeluaran/\\[id\\]/bukti/route.ts app/api/crm/payment-transactions/\\[id\\]/proof/route.ts app/api/crm/purchase-order/\\[id\\]/deposit/proof/route.ts app/api/whatsapp/media/\\[id\\]/route.ts"
}
```

3:NEXT_PUBLIC_SUPABASE_URL=<set>
5:SUPABASE_SECRET_KEY=<set>
---
app/actions/design.ts:13:import { createAdminClient } from "@/lib/supabase/admin";
app/actions/design.ts:121:    const storage = createAdminClient().storage.from(BUCKET);
app/actions/production.ts:14:import { createAdminClient } from "@/lib/supabase/admin";
app/actions/production.ts:88:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:160:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:244:      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:296:        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
app/actions/crm.ts:55:import { createAdminClient } from "@/lib/supabase/admin";
app/actions/crm.ts:1851:    const storage = createAdminClient().storage.from("crm-po-designs");
app/actions/master-data.ts:27:import { createAdminClient } from "@/lib/supabase/admin";
app/actions/master-data.ts:984:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:995:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:1026:      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
app/actions/master-data.ts:1027:      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
app/actions/whatsapp.ts:12:import { createAdminClient } from "@/lib/supabase/admin";
app/actions/whatsapp.ts:190:      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
app/actions/whatsapp.ts:199:      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
lib/payment-proof.ts:6:import { createAdminClient } from "@/lib/supabase/admin";
lib/payment-proof.ts:32:  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
lib/payment-proof.ts:38:  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts:6:import { createAdminClient } from "@/lib/supabase/admin";
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts:17:  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:5:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:30:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts:5:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts:31:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
app/api/crm/purchase-order/[id]/pdf/route.ts:9:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/purchase-order/[id]/pdf/route.ts:47:  const storage = createAdminClient().storage;
app/api/crm/invoice/[id]/pdf/route.ts:7:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/invoice/[id]/pdf/route.ts:89:    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/crm/invoice/[id]/pdf/route.ts:97:    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
app/api/crm/payment-transactions/[id]/kwitansi/route.ts:8:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/payment-transactions/[id]/kwitansi/route.ts:42:  const bucket = createAdminClient().storage.from("business-assets");
app/api/master-data/business-profile/logo/route.ts:3:import { createAdminClient } from "@/lib/supabase/admin";
app/api/master-data/business-profile/logo/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
app/api/master-data/business-profile/signature/route.ts:3:import { createAdminClient } from "@/lib/supabase/admin";
app/api/master-data/business-profile/signature/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
app/api/public/business-logo/route.ts:2:import { createAdminClient } from "@/lib/supabase/admin";
app/api/public/business-logo/route.ts:34:    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:6:import { createAdminClient } from "@/lib/supabase/admin";
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/payment-transactions/[id]/proof/route.ts:6:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/payment-transactions/[id]/proof/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:6:import { createAdminClient } from "@/lib/supabase/admin";
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:24:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/whatsapp/media/[id]/route.ts:4:import { createAdminClient } from "@/lib/supabase/admin";
app/api/whatsapp/media/[id]/route.ts:20:  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);


---

## Assistant

_Thinking:_

Good. `.env` has Supabase creds but no ERP vars. I'll add ERP_STORAGE_DIR and ERP_STORAGE_DRIVER=hybrid (for presentation, so old images still load; new uploads to VPS). But first implement.

Let me start writing `lib/storage/local-store.mjs`. Need Node fs/promises, path, crypto.

Key design:

```js
import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class StorageError extends Error {
  constructor(message, status = 500, code = "STORAGE_ERROR") { super(message); this.name="StorageError"; this.status=status; this.code=code; }
}

export function storageDriver() {
  const raw = (process.env.ERP_STORAGE_DRIVER || "supabase").trim().toLowerCase();
  if (!["supabase","hybrid","local"].includes(raw)) throw new StorageError(`ERP_STORAGE_DRIVER tidak valid: ${raw}`, 500, "INVALID_DRIVER");
  return raw;
}

export function storeRoot() {
  return resolve(process.env.ERP_STORAGE_DIR || join(process.cwd(), "data/erp-storage"));
}

export function assertStorageReady() {
  const driver = storageDriver();
  if (driver === "supabase") return driver;
  const configured = (process.env.ERP_STORAGE_DIR || "").trim();
  if (process.env.NODE_ENV === "production") {
    if (!configured) throw new StorageError("ERP_STORAGE_DIR wajib diset di produksi...", 500, "INVALID_STORAGE_DIR");
    if (!isAbsolute(configured)) throw ...
    const root = resolve(configured);
    const cwd = resolve(process.cwd());
    if (root === cwd || root.startsWith(`${cwd}${sep}`)) throw ...
  }
  return driver;
}
```

Wait: `storeRoot()` is called even in production supabase mode? No, only local/hybrid operations call it. But `assertStorageReady` for supabase returns without checking.

Should `assertStorageReady` check `process.env.NODE_ENV === "production"` only? In local dev with relative default, allowed. Good.

For tests, they set `NODE_ENV`? likely not, so relative ok.

`resolveSafe(bucket, relativePath)`:
```js
function assertBucket(bucket) {
  if (typeof bucket !== "string" || !BUCKET_PATTERN.test(bucket)) return null;
  return bucket;
}
export function resolveSafe(bucket, relativePath) {
  if (!assertBucket(bucket)) return null;
  if (typeof relativePath !== "string") return null;
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) return null;
  if (isAbsolute(relativePath)) return null;
  const parts = relativePath.split("/");
  if (parts.some(p => !p || p === "." || p === ".." || p.startsWith("."))) return null;
  const root = storeRoot();
  const absolute = resolve(root, bucket, relativePath);
  const bucketRoot = resolve(root, bucket);
  if (!absolute.startsWith(`${bucketRoot}${sep}`)) return null;
  return { absolute, relativePath, bucket };
}
```
This also prevents a path escaping the bucket into another bucket.

`putFile`:
```js
export async function putFile(bucket, relativePath, bytes, { upsert = false } = {}) {
  const target = resolveSafe(bucket, relativePath);
  if (!target) throw new StorageError("Path penyimpanan tidak valid.", 400, "INVALID_PATH");
  const buffer = toBuffer(bytes);
  const dir = dirname(target.absolute);
  await mkdir(dir, { recursive: true, mode: 0o750 });
  const tmp = join(dir, `.tmp-${randomUUID()}`);
  await writeFile(tmp, buffer, { flag: "wx", mode: 0o640 });
  try {
    if (upsert) {
      await rename(tmp, target.absolute);
    } else {
      await link(tmp, target.absolute);
      await unlink(tmp);
    }
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    if (error && error.code === "EEXIST") throw new StorageError("File sudah ada.", 409, "FILE_EXISTS");
    throw error;
  }
}
```
If rename succeeds, tmp gone. If link succeeds then unlink fails, final exists and tmp remains; we should catch unlink separately? `await unlink(tmp)` could throw, then catch unlinks tmp again and throws even though link succeeded — bad. Better:
```js
if (upsert) await rename(tmp, target.absolute);
else { await link(tmp, target.absolute); await unlink(tmp).catch(()=>undefined); }
```
And catch only around link/rename. Also if writeFile fails, no cleanup needed (tmp may be partial; unlink in catch of writeFile?). Wrap:
```js
try { await writeFile(...) } catch (e) { await unlink(tmp).catch(...); throw e; }
```

`toBuffer(bytes)`: if Buffer.isBuffer -> bytes; if ArrayBuffer -> Buffer.from; if ArrayBuffer.isView -> Buffer.from(bytes.buffer, byteOffset, byteLength); else throw TypeError.

`getFile`: resolveSafe; try readFile; catch ENOENT -> null; other -> throw? The plan says null for invalid/missing. For permission errors, throwing is better than hiding. But callers treat null as 404. I'll return null only ENOENT/ENOTDIR; rethrow others. For invalid path return null.

`statFile`: similar.

`removeFiles`:
```js
export async function removeFiles(bucket, paths) {
  const failed = [];
  for (const p of paths) {
    const target = resolveSafe(bucket, p);
    if (!target) { failed.push({ path: p, message: "Path tidak valid" }); continue; }
    try { await unlink(target.absolute); } catch (e) { if (e.code !== "ENOENT") failed.push({path:p,message:e.message}); }
  }
  return { failed };
}
```

`fileExists`: statFile !== null.

`contentTypeFromPath`: extname lower.

`assertStorageReady` should be called lazily on each op? If driver local and production invalid, throw at first op. We can call `assertStorageReady()` inside `storeRoot()`? Then every test with default driver supabase won't care. For local driver in dev, relative allowed. For production, throws. But `storageDriver()` called each time; fine. Let's have `storeRoot()` call `assertStorageReady()` first? If driver supabase, `storeRoot()` shouldn't be used. But if someone calls resolveSafe with supabase driver, it would call storeRoot. That's fine. Actually adapter only calls local functions when driver != supabase. Migration script sets driver maybe local; it should call assertStorageReady. I'll call `assertStorageReady()` at start of `storeRoot()` to enforce. But then `assertStorageReady` calls `storageDriver`; no recursion. Good.

Careful: In dev with driver local and no ERP_STORAGE_DIR, allowed (default). Good.

`storageDriver` caching? Env could change in tests after import; tests set before import. For adapter, reading per call is fine and allows tests to flip env. But fs root resolution per call. Fine, small overhead.

Now `erp-storage.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStorageReady, contentTypeFromPath, fileExists, getFile, putFile, removeFiles, statFile, storageDriver, StorageError,
} from "./local-store.mjs";
```

TypeScript importing named exports from mjs: TS infers types from JSDoc or any. Since allowJs true, it will infer. But `.mjs` may not be included; import pulls it. However `isolatedModules` etc. fine. To avoid type errors from implicit any (noImplicitAny is part of strict; JS files aren't checked but inferred exports from JS may be any; assigning to typed returned functions is fine). We can add JSDoc types in mjs for better inference, but not required. Yet `import { StorageError }` as a class type is fine.

Potential TS error: "Could not find a declaration file for module './local-store.mjs'" if allowJs false, but true. With `moduleResolution: bundler` and `allowImportingTsExtensions`, importing `.mjs` should resolve. Let's test after creating.

Adapter:

```ts
export type ErpStorageError = { message: string; status?: number; statusCode?: string };
export type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };
type UploadResult = { data: { path: string } | null; error: ErpStorageError | null };

function toSupabaseError(error: unknown): ErpStorageError {
  if (error instanceof StorageError) return { message: error.message, status: error.status, statusCode: String(error.status) };
  return { message: error instanceof Error ? error.message : "Kesalahan penyimpanan.", status: 500, statusCode: "500" };
}
```

Need `StorageError` exported from mjs. Good.

`blobFromBuffer(buffer, type)`: `new Blob([buffer], { type })`. Node 18+. Next server runtime Node. `Blob` type in TS DOM lib included. Good. But `new Blob([buffer])` with Buffer type may complain in TS because Buffer<ArrayBufferLike> not assignable to BlobPart in newer @types/node? Could use `new Blob([new Uint8Array(buffer)])`. Let's do `new Blob([new Uint8Array(buffer)], { type })`. Still typed Uint8Array<ArrayBufferLike>. TS 5.7 introduced generic; `new Uint8Array(buffer)` returns `Uint8Array<ArrayBuffer>`? `buffer` is Buffer; `new Uint8Array(buffer)` copies and returns Uint8Array<ArrayBuffer>. Fine.

Actually for downloads, returning Blob copies memory. Acceptable.

Supabase delegation functions:
```ts
function supabaseStorage(bucket: string) {
  return createAdminClient().storage.from(bucket);
}
```

`upload`:
```ts
async upload(path, bytes, opts = {}) {
  const driver = storageDriver();
  if (driver === "supabase") return supabaseStorage(bucket).upload(path, bytes, opts);
  try {
    await putFile(bucket, path, bytes, { upsert: opts.upsert ?? false });
  } catch (e) { return { data: null, error: toSupabaseError(e) }; }
  if (driver === "hybrid") {
    const { error } = await supabaseStorage(bucket).upload(path, bytes, opts);
    if (error) {
      const cleanup = await removeFiles(bucket, [path]);
      console.error("[erp-storage] hybrid-put-rollback", { bucket, path, message: error.message, cleanupFailed: cleanup.failed.length });
      return { data: null, error };
    }
  }
  return { data: { path }, error: null };
}
```
But `opts` contentType unused by local (fine). Also `putFile` throws; convert.

Important: `storageDriver()` can throw invalid driver. Should we catch? Let it throw; config error should fail loudly. But an action returning 500 vs UserFacingError. It's a server misconfig; throw is fine. However tests? fine.

`download`:
```ts
async download(path) {
  const driver = storageDriver();
  if (driver === "supabase") return supabaseStorage(bucket).download(path);
  const target = resolveSafe? -> getFile returns null for invalid; but we need distinguish invalid path to avoid fallback.
  const file = await getFile(bucket, path); // null invalid/missing
  if (file) return { data: new Blob([new Uint8Array(file)], { type: contentTypeFromPath(path) }), error: null };
  if (driver === "local") return { data: null, error: { message: "File tidak ditemukan.", status: 404 } };
  // hybrid: if path invalid, do NOT fallback
  if (!resolveSafe(bucket, path)) return { data: null, error: { message: "Path tidak valid.", status: 400 } };
  logFallback(...)
  return supabaseStorage(bucket).download(path);
}
```
But `getFile` returns null for invalid and missing; we call `resolveSafe` again to distinguish. Fine. Or export `isSafePath`. Use `resolveSafe` imported.

Note: if local read throws permission error, getFile throws; we should catch and return 500 rather than fallback. Wrap:
```ts
try { file = await getFile(...) } catch (e) { return { data:null, error: toSupabaseError(e) } }
```
If file null and path safe → fallback.

`exists`:
```ts
async exists(path) {
  const driver = storageDriver();
  if (driver === "supabase") return supabaseStorage(bucket).exists(path);
  const safe = resolveSafe(bucket, path);
  if (!safe) return { data: false, error: { message: "Path tidak valid.", status: 400 } };
  try { if (await fileExists(bucket, path)) return { data: true, error: null }; } catch (e) { return { data:false, error: toSupabaseError(e) }; }
  if (driver === "local") return { data: false, error: null };
  // hybrid
  const remote = await supabaseStorage(bucket).exists(path);
  return remote;
}
```
If Supabase exists errors (network), return error.

`remove`:
```ts
async remove(paths) {
  const driver = storageDriver();
  if (driver === "supabase") return supabaseStorage(bucket).remove(paths);
  const local = await removeFiles(bucket, paths);
  if (driver === "local") return { data: null, error: local.failed.length ? {...} : null };
  const remote = await supabaseStorage(bucket).remove(paths);
  if (local.failed.length || remote.error) { log; return { data: null, error: local.failed.length ? ... : remote.error }; }
  return { data: null, error: null };
}
```
`data: null` is acceptable? Call sites check error only. Supabase returns array; not used. Fine. But TS return type `data: unknown` to accommodate.

Log throttle:
```ts
const fallbackLogAt = new Map<string, number>();
const FALLBACK_LOG_INTERVAL_MS = 10 * 60 * 1000;
function logFallback(bucket, path) { const key=...; const now=Date.now(); const last=...; if (!last || now-last>...) { map.set; console.info("[erp-storage] fallback-supabase", { bucket, path }); } }
```
Bound map size? If many paths, map grows. Could clear when > 1000. Add simple guard.

`assertStorageReady` call: adapter calls `storageDriver()` but not `assertStorageReady`; `putFile` -> `storeRoot()` -> assert. `getFile` -> resolveSafe -> storeRoot -> assert. Good. But hybrid `download` fallback calls resolveSafe (storeRoot -> assert) before Supabase. Good. In production, misconfig throws instead of silently fallback.

However for hybrid, when local file missing and path is safe, `getFile` calls `storeRoot` (assert) then returns null; then fallback. Good.

Now, `resolveSafe` import needed in adapter.

Worker driver: implement helpers in whatsapp.mjs using local-store. Need to keep line references not important.

Worker code changes:
- import `{ contentTypeFromPath, getFile, putFile, removeFiles, storageDriver }` from "../lib/storage/local-store.mjs";
- helper functions near `mediaBucket`:
```js
const erpStorageDriver = () => storageDriver();
function supabaseConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY); }
function storageClient() { return createClient(...).storage.from(mediaBucket); }
function mediaReady() { const d=storageDriver(); return d==="local" ? true : supabaseConfigured(); }
async function storeMedia(path, buffer, contentType) { const d=storageDriver(); if (d==="supabase") { const up= await ...; if (up.error) throw up.error; return; } await putFile(mediaBucket, path, buffer, { upsert:false }); if (d==="hybrid") { const up=await ...; if (up.error) { await removeFiles(mediaBucket,[path]); throw up.error; } } }
async function readMedia(path) { const d=...; if (d!=="supabase") { const buf=await getFile(...); if (buf) return buf; if (d==="local") throw new Error("Lampiran tidak ditemukan."); } if (!supabaseConfigured()) throw ...; const downloaded=await ...; if (downloaded.error) throw downloaded.error; return Buffer.from(await downloaded.data.arrayBuffer()); }
async function removeMedia(paths) { const d=...; if (d!=="supabase") { const {failed}=await removeFiles(...); for log; } if (d!=="local") { if (!supabaseConfigured()) return; chunk remove } }
```
Then replace K1/K2/K3.

K1 current guard: `if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)`. We need to attempt storage if driver selected. But in supabase mode without creds, skip (same as before). In local mode, always. So `if (kind !== "TEXT" && mediaStorageReady())`. But if hybrid without Supabase creds, `mediaStorageReady` should false? We want hybrid requires both; if creds absent, throw? The worker should log and skip? Better: `mediaStorageReady()` returns: supabase→supabaseConfigured; hybrid→supabaseConfigured; local→true. If hybrid without creds, skip storing (same as before) rather than crashing inbound handler. But the plan says hybrid requires both. For robustness in worker, skip with a log if not ready. I'll implement `mediaStorageReady()` for hybrid requires both, and `storeInbound` logs warning if not ready. Hmm, silent data loss. But current behavior skips if no creds. Keep that.

Actually `storageDriver()` may throw if invalid; wrap in try/catch? Let it throw at startup: call `assertStorageReady()` at worker startup maybe. But worker in local mode on a machine without Supabase should start. `local-store.assertStorageReady()` handles. We can call `const driver = storageDriver()` at startup for validation. If invalid, worker throws (good). But if hybrid without creds, no throw; media skips or errors. We can check `if (driver !== "local" && !supabaseConfigured()) console.error(...)`. Fine.

K2: currently guarded by `paths.length && env`. Replace:
```js
if (paths.length) {
  await removeMedia(paths);
}
```
`removeMedia` handles driver and no creds (skip Supabase with log).

K3:
```js
} else if (payload.attachment?.path) {
  const buffer = await readMedia(payload.attachment.path);
  ...
}
```
Remove the Supabase env throw.

Need to ensure `contentTypeFromPath` not needed in worker because contentType from payload/DB.

Deploy: add copy + verification.

Now actions/routes. Use Perl/sed? Safer to use edit tool per file, but 19 files. Could use a scripted replacement with `perl -0pi` but risky. We can do targeted `edit` calls. Many are simple. Let's plan replacements:

- design.ts:
  - import line `import { createAdminClient } from "@/lib/supabase/admin";` → `import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";`
  - `const BUCKET = "crm-po-designs";` remove? Could keep but constants duplicated. Replace with `const BUCKET = PO_DESIGNS_BUCKET;` or just use `PO_DESIGNS_BUCKET` in erpStorage. Simplest: remove const BUCKET and use `const storage = erpStorage(PO_DESIGNS_BUCKET);`. Test expects `erpStorage(BUCKET)` after update, so keep `const BUCKET = PO_DESIGNS_BUCKET;` and `erpStorage(BUCKET)`. Good.
- production.ts:
  - import replace.
  - `const DESIGN_BUCKET = "crm-po-designs";` → `const DESIGN_BUCKET = PO_DESIGNS_BUCKET;`
  - 4 occurrences `createAdminClient().storage.from(DESIGN_BUCKET)` → `erpStorage(DESIGN_BUCKET)`.
- crm.ts:
  - import replace (but crm.ts may use createAdminClient elsewhere? grep showed only line 55 import and line 1851. So replace).
  - line 1851 `const storage = createAdminClient().storage.from("crm-po-designs");` → `const storage = erpStorage(PO_DESIGNS_BUCKET);`
- master-data.ts:
  - import replace if only used for storage (grep showed only those lines). Replace import with `import { BUSINESS_ASSETS_BUCKET, erpStorage } ...`.
  - 4 occurrences: `createAdminClient().storage.from("business-assets")` → `erpStorage(BUSINESS_ASSETS_BUCKET)`.
- whatsapp.ts:
  - import replace (only storage uses? grep showed only lines 190/199, so yes).
  - 2 occurrences → `erpStorage(WHATSAPP_MEDIA_BUCKET)`.
- lib/payment-proof.ts:
  - import replace; keep `PAYMENT_PROOF_BUCKET`; import `erpStorage` and `PAYMENT_PROOFS_BUCKET`? We can keep `export const PAYMENT_PROOF_BUCKET = "payment-proofs"` and use `erpStorage(PAYMENT_PROOF_BUCKET)`. Also export `PAYMENT_PROOFS_BUCKET` alias in erp-storage. Fine.
- Routes:
  - Replace import.
  - Replace `createAdminClient().storage.from(...)` with `erpStorage(...)`.
  - Remove unused constants? Keep BUCKET = PO_DESIGNS_BUCKET for R2/R3.
  - R4: `const storage = createAdminClient().storage;` then `storage.from(...)`. Replace with `const storage = { from: erpStorage }`? Cleaner: replace `const storage = createAdminClient().storage;` with nothing and replace `storage.from("business-assets")` → `erpStorage(BUSINESS_ASSETS_BUCKET)`, `storage.from("crm-po-designs")` → `erpStorage(PO_DESIGNS_BUCKET)`. Two occurrences.
  - R5: import; replace 2 calls.
  - R6: `const bucket = createAdminClient().storage.from("business-assets");` → `const bucket = erpStorage(BUSINESS_ASSETS_BUCKET);`
  - R7/R8/R9/R13/R10/R11/R12: import + call.
- For R9 public route, keep `contentTypeFor` (it has its own allowlist). We can leave `contentTypeFor` as is; adapter returns Blob with type, route ignores it and uses its own. Fine.
- R13 uses `process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media"` → `WHATSAPP_MEDIA_BUCKET`.
- R1 uses literal `"crm-po-designs"` → `PO_DESIGNS_BUCKET`.

Need to check each file's imports for `createAdminClient` only used for storage. Confirmed via grep earlier for all 19. Good.

For `app/api/crm/purchase-order/[id]/pdf/route.ts`, `const storage = createAdminClient().storage;` then 3 `.from`. I'll replace each `.from("...")` with `erpStorage(...)` and delete `const storage` line. Ensure no other `storage` use. Grep shows lines 53, 78, 94 only. Good.

For `app/api/crm/invoice/[id]/pdf/route.ts`, two calls. Good.

For `app/api/crm/payment-transactions/[id]/kwitansi/route.ts`, one.

Now, `import "server-only"` in erp-storage prevents importing it from worker (worker imports local-store only), fine.

Potential Next build issue: importing `.mjs` from `.ts` with `@/` alias; use relative `./local-store.mjs` (same dir). Good.

Potential issue: Next/Turbopack might not resolve `.mjs` with explicit extension? It should. `allowImportingTsExtensions` only for TS extensions. Bundlers handle `.mjs`.

Potential TS module type: `import { ... } from "./local-store.mjs"` — TS with `moduleResolution: bundler` resolves. Let's test.

Test file `tests/erp-storage.test.mjs`:
- Set env before dynamic import:
```js
const root = await mkdtemp(join(tmpdir(), "askonveksi-erp-storage-"));
process.env.ERP_STORAGE_DIR = root;
process.env.ERP_STORAGE_DRIVER = "local";
const store = await import("../lib/storage/local-store.mjs");
const { erpStorage } = await import("../lib/storage/erp-storage.ts");
```
But importing `erp-storage.ts` imports `server-only` (ok) and `@/lib/supabase/admin` alias. Node cannot resolve `@/` alias! The project tests import `.ts` files directly (Node type stripping), and `.ts` files import `@/lib/...` aliases. How do tests handle aliases? Node 24 doesn't resolve `@/` natively. Let's check: tests import `../lib/attendance/photo.ts`, and photo.ts imports `./constants.ts` (relative) and `sharp` (package). No `@/` alias. Many tested modules use relative imports. But `erp-storage.ts` importing `@/lib/supabase/admin` would fail in Node test. Does Node support tsconfig paths? No (until maybe Node 24 `--experimental-strip-types` doesn't handle paths). The test would fail to import `erp-storage.ts`.

Options:
1. Make `erp-storage.ts` import `../supabase/admin.ts` relative instead of `@/lib/supabase/admin`. That resolves in Node tests and Next. Use `../supabase/admin`.
2. Or don't unit-test `erp-storage.ts`; test only local-store. But we want adapter tests. Use relative import.
Also `erp-storage.ts` imports `server-only` (package, fine) and `./local-store.mjs` (relative, fine).

Does `lib/supabase/admin.ts` import `@/`? It imports `server-only` and `@supabase/supabase-js` only. Good. So use relative `../supabase/admin`.

But Node type stripping of `erp-storage.ts` will strip types but not transform `.ts` extension imports? It imports `../supabase/admin` without extension — Node ESM requires extension. In TS with bundler, extensionless works. But Node test importing `erp-storage.ts` will fail on `../supabase/admin` (no extension). Existing tested TS files use explicit `.ts` extensions (e.g., `./constants.ts`) because `allowImportingTsExtensions` is on. Indeed photo.ts imports `./constants.ts`. So to be Node-test-friendly, import `../supabase/admin.ts` and `./local-store.mjs`. Does Next accept `.ts` extension imports? `allowImportingTsExtensions: true` allows TS; bundler handles. Existing code uses `.ts` in lib files (attendance), so yes.

But `erp-storage.ts` imported by app actions via `@/lib/storage/erp-storage` (no extension) — bundler fine.

Test import `../lib/storage/erp-storage.ts` → its internal imports resolve with explicit `.ts`. Good. `lib/supabase/admin.ts` imports `server-only` and `@supabase/supabase-js` (package). Good.

Potential issue: `server-only` imported in Node test returns empty (we verified). Good.

So test adapter local mode works.

For typecheck, `import { ... } from "./local-store.mjs"` — TS will infer. Fine.

Now, `.env` addition: use append. Need to decide driver. For presentation, set `ERP_STORAGE_DRIVER=hybrid` and `ERP_STORAGE_DIR=./data/erp-storage`. But if local server runs in production mode? `next dev` sets NODE_ENV=development. `next start` sets production; relative ERP_STORAGE_DIR would throw in production. For presentation, likely `npm run dev` or `npm run build && npm start`. If `npm start` with relative path in production, our guard throws! That would break. Hmm. The guard says production + driver != supabase + relative → throw. If they run `npm run dev`, fine. But "presentasi besok" could be `npm run dev` on laptop. To be safe, set an absolute path in local `.env` for hybrid: `ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage`. Then it works in dev and production locally. On VPS they'll set `/var/lib/askonveksi/storage`. Good.

But hardcoding absolute path in `.env` is fine (gitignored). Use `pwd`. We'll append.

Alternatively default dev driver local. But old images in Supabase would 404 if local. Hybrid is best.

Wait: hybrid mode requires Supabase creds present; `.env` has them. Good.

But hybrid writes to production Supabase bucket; if presentation uses existing local DB pointing to the same Supabase project, fine. New uploads mirrored. Good.

Now, one concern: `assertStorageReady` in production checks `ERP_STORAGE_DIR` is absolute and not under cwd. Local absolute path is under cwd (`/home/haydar/Code/askonveksi/askonveksi/data/erp-storage` within cwd). That would throw in `npm start` production! Hmm. The guard is designed for VPS releases. For local production run, this is annoying. Options:
- Only enforce "outside cwd" when cwd path looks like a release dir? Too clever.
- Add env override `ERP_STORAGE_ALLOW_CWD=true`? Not needed.
- Relax guard: require absolute in production; warn (not throw) if inside cwd. The critical risk is relative path, which is caught. Absolute inside cwd could be intentional local production. On VPS, `ERP_STORAGE_DIR` is `/var/lib/...` absolute. So change: production + driver != supabase → must be absolute; if inside cwd, log warn but allow. This avoids breaking local `npm start`. The doc said throw, but practical presentation > strict. We can document "absolute required; inside cwd warned". I think that's the right call. Update doc later accordingly.

Actually the real risk is writing inside `releases/<id>`. An absolute path inside cwd is detectable; but a warning is enough, and VPS config is correct. Let me implement:
```js
if (production) {
  if (!configured) throw;
  if (!isAbsolute(configured)) throw;
  if (inside cwd) console.warn("[erp-storage] ERP_STORAGE_DIR berada di dalam folder aplikasi; ...");
}
```
Good.

Now `storeRoot()` calls `assertStorageReady()` every time; if warning, logs every op → noisy. Cache guard result in a module-level variable keyed by env values? Simple:
```js
let lastReadyKey = "";
function ensureReady() { const key = `${storageDriver()}|${process.env.ERP_STORAGE_DIR||""}|${process.env.NODE_ENV||""}`; if (key !== lastReadyKey) { assertStorageReady(); lastReadyKey = key; } }
```
But `assertStorageReady` itself computes. Implement `storeRoot()`: `assertStorageReady()` once per key. Or just accept warning logs. Better cache.

Careful: tests change env between tests in same process; cache key includes env, so re-validates. Good.

Implement:
```js
let readinessKey = null;
function ensureStorageReady() {
  const key = `${process.env.ERP_STORAGE_DRIVER||""}|${process.env.ERP_STORAGE_DIR||""}|${process.env.NODE_ENV||""}`;
  if (key === readinessKey) return;
  assertStorageReady();
  readinessKey = key;
}
```
`storeRoot()` calls ensureStorageReady.

`assertStorageReady` exported and callable.

Now, `storageDriver()` invalid throws every call; fine.

Let me write local-store and erp-storage now.

Then tests.

Let me start with files.

Mulai implementasi. Saya kerjakan modul inti dulu, lalu port semua call site, worker, deploy, dan verifikasi penuh.

**Tool: write**

**Input:**
```json
{
  "content": "import { randomUUID } from \"node:crypto\";\nimport { link, mkdir, readFile, rename, stat, unlink, writeFile } from \"node:fs/promises\";\nimport { dirname, extname, isAbsolute, join, resolve, sep } from \"node:path\";\n\nconst DRIVERS = new Set([\"supabase\", \"hybrid\", \"local\"]);\nconst BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]*$/;\n\nexport class StorageError extends Error {\n  constructor(message, status = 500, code = \"STORAGE_ERROR\") {\n    super(message);\n    this.name = \"StorageError\";\n    this.status = status;\n    this.code = code;\n  }\n}\n\n/** Driver aktif. Nilai tidak dikenal langsung gagal agar salah konfigurasi tidak diam-diam memakai Supabase. */\nexport function storageDriver() {\n  const driver = String(process.env.ERP_STORAGE_DRIVER || \"supabase\").trim().toLowerCase();\n  if (!DRIVERS.has(driver)) {\n    throw new StorageError(`ERP_STORAGE_DRIVER tidak valid: \"${driver}\". Gunakan supabase, hybrid, atau local.`, 500, \"INVALID_DRIVER\");\n  }\n  return driver;\n}\n\nexport function storeRoot() {\n  ensureStorageReady();\n  return resolve(process.env.ERP_STORAGE_DIR || join(process.cwd(), \"data/erp-storage\"));\n}\n\nlet readinessKey = null;\n\n/**\n * Guard konfigurasi. Di produksi, driver non-Supabase wajib memakai path absolut\n * agar file tidak pernah ditulis ke folder release yang akan dipangkas deploy.\n */\nexport function assertStorageReady() {\n  const driver = storageDriver();\n  if (driver === \"supabase\") return driver;\n\n  const configured = String(process.env.ERP_STORAGE_DIR || \"\").trim();\n  if (process.env.NODE_ENV === \"production\") {\n    if (!configured) {\n      throw new StorageError(\n        \"ERP_STORAGE_DIR wajib diset di produksi saat ERP_STORAGE_DRIVER bukan supabase.\",\n        500,\n        \"INVALID_STORAGE_DIR\",\n      );\n    }\n    if (!isAbsolute(configured)) {\n      throw new StorageError(\n        \"ERP_STORAGE_DIR wajib berupa path absolut di produksi.\",\n        500,\n        \"INVALID_STORAGE_DIR\",\n      );\n    }\n    const root = resolve(configured);\n    const cwd = resolve(process.cwd());\n    if (root === cwd || root.startsWith(`${cwd}${sep}`)) {\n      console.warn(\"[erp-storage] ERP_STORAGE_DIR berada di dalam folder aplikasi; gunakan volume persisten di luar release.\", { root });\n    }\n  }\n  return driver;\n}\n\nfunction ensureStorageReady() {\n  const key = `${process.env.ERP_STORAGE_DRIVER || \"\"}|${process.env.ERP_STORAGE_DIR || \"\"}|${process.env.NODE_ENV || \"\"}`;\n  if (key === readinessKey) return;\n  assertStorageReady();\n  readinessKey = key;\n}\n\n/**\n * Validasi bucket + path relatif sebelum menyentuh filesystem.\n * Menolak traversal, path absolut, backslash, NUL, segmen kosong/tersembunyi,\n * dan path yang keluar dari folder bucket.\n */\nexport function resolveSafe(bucket, relativePath) {\n  if (typeof bucket !== \"string\" || !BUCKET_PATTERN.test(bucket)) return null;\n  if (typeof relativePath !== \"string\" || !relativePath) return null;\n  if (relativePath.includes(\"\\0\") || relativePath.includes(\"\\\\\")) return null;\n  if (isAbsolute(relativePath)) return null;\n\n  const parts = relativePath.split(\"/\");\n  if (parts.some((part) => !part || part === \".\" || part === \"..\" || part.startsWith(\".\"))) return null;\n\n  const root = storeRoot();\n  const bucketRoot = resolve(root, bucket);\n  const absolute = resolve(bucketRoot, relativePath);\n  if (!absolute.startsWith(`${bucketRoot}${sep}`)) return null;\n\n  return { absolute, bucket, relativePath };\n}\n\nfunction toBuffer(bytes) {\n  if (Buffer.isBuffer(bytes)) return bytes;\n  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);\n  if (ArrayBuffer.isView(bytes)) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);\n  throw new StorageError(\"Isi file tidak valid.\", 400, \"INVALID_BYTES\");\n}\n\n/**\n * Tulis atomik. Pembaca tidak pernah melihat file setengah jadi.\n * upsert:true -> rename (menimpa); upsert:false -> link (gagal EEXIST bila sudah ada).\n */\nexport async function putFile(bucket, relativePath, bytes, { upsert = false } = {}) {\n  const target = resolveSafe(bucket, relativePath);\n  if (!target) throw new StorageError(\"Path penyimpanan tidak valid.\", 400, \"INVALID_PATH\");\n\n  const buffer = toBuffer(bytes);\n  const folder = dirname(target.absolute);\n  await mkdir(folder, { recursive: true, mode: 0o750 });\n\n  const temporary = join(folder, `.tmp-${randomUUID()}`);\n  try {\n    await writeFile(temporary, buffer, { flag: \"wx\", mode: 0o640 });\n  } catch (error) {\n    await unlink(temporary).catch(() => undefined);\n    throw error;\n  }\n\n  try {\n    if (upsert) {\n      await rename(temporary, target.absolute);\n    } else {\n      await link(temporary, target.absolute);\n      await unlink(temporary).catch(() => undefined);\n    }\n  } catch (error) {\n    await unlink(temporary).catch(() => undefined);\n    if (error && error.code === \"EEXIST\") {\n      throw new StorageError(\"File sudah ada.\", 409, \"FILE_EXISTS\");\n    }\n    throw error;\n  }\n}\n\nexport async function getFile(bucket, relativePath) {\n  const target = resolveSafe(bucket, relativePath);\n  if (!target) return null;\n  try {\n    return await readFile(target.absolute);\n  } catch (error) {\n    if (error && (error.code === \"ENOENT\" || error.code === \"ENOTDIR\")) return null;\n    throw error;\n  }\n}\n\nexport async function statFile(bucket, relativePath) {\n  const target = resolveSafe(bucket, relativePath);\n  if (!target) return null;\n  try {\n    const info = await stat(target.absolute);\n    return info.isFile() ? { size: info.size } : null;\n  } catch (error) {\n    if (error && (error.code === \"ENOENT\" || error.code === \"ENOTDIR\")) return null;\n    throw error;\n  }\n}\n\nexport async function fileExists(bucket, relativePath) {\n  return (await statFile(bucket, relativePath)) !== null;\n}\n\n/** Hapus best-effort. ENOENT diabaikan; kegagalan lain dikumpulkan. */\nexport async function removeFiles(bucket, paths) {\n  const failed = [];\n  for (const relativePath of paths || []) {\n    const target = resolveSafe(bucket, relativePath);\n    if (!target) {\n      failed.push({ path: relativePath, message: \"Path tidak valid.\" });\n      continue;\n    }\n    try {\n      await unlink(target.absolute);\n    } catch (error) {\n      if (error && (error.code === \"ENOENT\" || error.code === \"ENOTDIR\")) continue;\n      failed.push({ path: relativePath, message: error instanceof Error ? error.message : \"Gagal menghapus file.\" });\n    }\n  }\n  return { failed };\n}\n\nexport function contentTypeFromPath(relativePath) {\n  const extension = extname(typeof relativePath === \"string\" ? relativePath : \"\").toLowerCase();\n  if (extension === \".png\") return \"image/png\";\n  if (extension === \".jpg\" || extension === \".jpeg\") return \"image/jpeg\";\n  if (extension === \".webp\") return \"image/webp\";\n  if (extension === \".pdf\") return \"application/pdf\";\n  return \"application/octet-stream\";\n}\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/local-store.mjs"
}
```

Created file successfully: lib/storage/local-store.mjs

---

## Assistant

_Thinking:_

Now erp-storage.ts. Need careful typing and imports with `.ts`/`.mjs` extensions for Node tests. Let's write.

Consider `createAdminClient` returns SupabaseClient; `.storage.from(bucket)` typed. We'll type loosely to keep it simple.

Implementation details:

```ts
import "server-only";

import { createAdminClient } from "../supabase/admin.ts";
import {
  contentTypeFromPath,
  getFile,
  putFile,
  removeFiles,
  resolveSafe,
  statFile,
  StorageError,
  storageDriver,
} from "./local-store.mjs";
```

Wait: `import "server-only"` in a `.ts` tested by node; fine.

But importing `../supabase/admin.ts` with extension: Next bundler handles `.ts` imports because `allowImportingTsExtensions`. Existing files in lib/attendance do it. Good.

Type of `StorageError`: TS may not know it's a class if JS inference; `instanceof StorageError` works at runtime; TS might complain "StorageError only refers to a type"? With allowJs, imported class values are inferred. Should be okay. To be safe, avoid `instanceof`; use duck typing:
```ts
function toError(error: unknown): ErpStorageError {
  const status = typeof (error as {status?: unknown})?.status === "number" ? ...
}
```
Simpler and avoids type issues. Use `const candidate = error as { message?: unknown; status?: unknown }`.

`Blob` availability: Next server Node. `new Blob([new Uint8Array(buffer)], { type })`.

Potential TS issue: `Buffer` type from @types/node, but `new Uint8Array(buffer)` where buffer is Buffer works.

Supabase `upload` accepts `FileBody` = ArrayBuffer | ArrayBufferView | Blob | Buffer | File | FormData | ReadableStream | string. `Uint8Array` is ArrayBufferView. Good.

`supabaseStorage(bucket)` returns `ReturnType<typeof createAdminClient>["storage"]...`. Type inference fine.

For `download`, Supabase returns `{ data: Blob | null; error }`. Our return type `{ data: ErpStorageFile | null; error }`. Blob has arrayBuffer and type, so assignable. But Supabase's error type has message/status/statusCode; assignable to our error type? `statusCode?: string` maybe; yes. Return directly may have type mismatch on `data`? Blob is assignable to `{arrayBuffer(): Promise<ArrayBuffer>; type: string}`. Yes.

For `upload`, Supabase's return `{ data: { path, id, fullPath } | null; error }` assignable to `{data:{path:string}|null}`. Yes, extra props okay structurally.

For `exists`, fine.

For `remove`, Supabase returns `{ data: FileObject[] | null; error }`; our `data: unknown` accepts.

But TypeScript may complain about the union because `supabaseStorage(bucket).upload(...)` expects options type where `contentType` etc. Our opts type is compatible. `upsert` optional.

Let's define:

```ts
export type ErpStorageError = { message: string; status?: number; statusCode?: string };
export type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };
export type ErpUploadOptions = { contentType?: string; upsert?: boolean };
export type ErpStorage = {
  upload(path: string, bytes: Uint8Array, opts?: ErpUploadOptions): Promise<{ data: { path: string } | null; error: ErpStorageError | null }>;
  download(path: string): Promise<{ data: ErpStorageFile | null; error: ErpStorageError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: ErpStorageError | null }>;
  exists(path: string): Promise<{ data: boolean; error: ErpStorageError | null }>;
};
```

Supabase error type may have `statusCode?: string`; fine.

Fallback log:
```ts
const fallbackLogAt = new Map<string, number>();
const FALLBACK_LOG_INTERVAL = 10*60*1000;
function logFallback(bucket,path) {
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const last = fallbackLogAt.get(key) ?? 0;
  if (now - last < FALLBACK_LOG_INTERVAL) return;
  if (fallbackLogAt.size > 1000) fallbackLogAt.clear();
  fallbackLogAt.set(key, now);
  console.info("[erp-storage] fallback-supabase", { bucket, path });
}
```

`erpStorage`:
```ts
export function erpStorage(bucket: string): ErpStorage {
  return {
    async upload(path, bytes, opts = {}) {
      const driver = storageDriver();
      if (driver === "supabase") return supabaseClient(bucket).upload(path, bytes, opts);
      try { await putFile(bucket, path, bytes, { upsert: opts.upsert ?? false }); }
      catch (error) { return { data: null, error: toStorageError(error) }; }
      if (driver === "hybrid") {
        const { error } = await supabaseClient(bucket).upload(path, bytes, opts);
        if (error) {
          const { failed } = await removeFiles(bucket, [path]);
          console.error("[erp-storage] hybrid-put-rollback", { bucket, path, message: error.message, cleanupFailed: failed.length });
          return { data: null, error };
        }
      }
      return { data: { path }, error: null };
    },
    async download(path) {...},
    async remove(paths) {...},
    async exists(path) {...},
  };
}
```

For `download` local:
```ts
const safe = resolveSafe(bucket, path);
if (!safe) return { data: null, error: { message: "Path tidak valid.", status: 400, statusCode: "400" } };
let buffer: Buffer | null;
try { buffer = await getFile(bucket, path); } catch (e) { return { data:null, error: toStorageError(e) }; }
if (buffer) return { data: new Blob([new Uint8Array(buffer)], { type: contentTypeFromPath(path) }), error: null };
if (driver === "local") return { data: null, error: { message: "File tidak ditemukan.", status: 404, statusCode: "404" } };
logFallback(bucket, path);
return supabaseClient(bucket).download(path);
```
Note `resolveSafe` calls storeRoot → guard. Good.

`remove`:
```ts
const driver = storageDriver();
if (driver === "supabase") return supabaseClient(bucket).remove(paths);
const local = await removeFiles(bucket, paths);
if (driver === "local") {
  return { data: null, error: local.failed.length ? { message: ..., status: 500, statusCode: "500" } : null };
}
const remote = await supabaseClient(bucket).remove(paths);
if (local.failed.length || remote.error) {
  console.error("[erp-storage] remove-partial", { bucket, failed: local.failed.length, remote: remote.error?.message });
  return { data: null, error: local.failed.length ? {...} : remote.error };
}
return { data: null, error: null };
```

`exists`:
```ts
const driver = storageDriver();
if (driver === "supabase") return supabaseClient(bucket).exists(path);
const safe = resolveSafe(bucket, path);
if (!safe) return { data:false, error:{...400} };
try { if (await fileExists(bucket,path)) return {data:true,error:null}; } catch (e) { return {data:false,error:toStorageError(e)}; }
if (driver === "local") return { data:false, error:null };
return supabaseClient(bucket).exists(path);
```
Note `fileExists` calls statFile → resolveSafe again. Fine.

`toStorageError`:
```ts
function toStorageError(error: unknown): ErpStorageError {
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "Kesalahan penyimpanan.";
  const status = typeof candidate?.status === "number" ? candidate.status : 500;
  return { message, status, statusCode: String(status) };
}
```

`supabaseClient(bucket)`:
```ts
function supabaseClient(bucket: string) {
  return createAdminClient().storage.from(bucket);
}
```

Constants:
```ts
export const PO_DESIGNS_BUCKET = "crm-po-designs";
export const BUSINESS_ASSETS_BUCKET = "business-assets";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
```
Note `WHATSAPP_MEDIA_BUCKET` evaluated at module load; fine.

Potential conflict: `lib/payment-proof.ts` exports `PAYMENT_PROOF_BUCKET` and imports `erpStorage` + maybe `PAYMENT_PROOFS_BUCKET`. Keep local export to satisfy tests; use local constant in erpStorage call. Or import `erpStorage` only and use `PAYMENT_PROOF_BUCKET`. Simpler.

Now write file.

**Tool: write**

**Input:**
```json
{
  "content": "import \"server-only\";\n\nimport { createAdminClient } from \"../supabase/admin.ts\";\nimport {\n  contentTypeFromPath,\n  fileExists,\n  getFile,\n  putFile,\n  removeFiles,\n  resolveSafe,\n  storageDriver,\n} from \"./local-store.mjs\";\n\nexport const PO_DESIGNS_BUCKET = \"crm-po-designs\";\nexport const BUSINESS_ASSETS_BUCKET = \"business-assets\";\nexport const PAYMENT_PROOFS_BUCKET = \"payment-proofs\";\nexport const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\";\n\nexport type ErpStorageError = { message: string; status?: number; statusCode?: string };\nexport type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };\nexport type ErpUploadOptions = { contentType?: string; upsert?: boolean };\n\nexport type ErpStorage = {\n  upload(\n    path: string,\n    bytes: Uint8Array,\n    opts?: ErpUploadOptions,\n  ): Promise<{ data: { path: string } | null; error: ErpStorageError | null }>;\n  download(path: string): Promise<{ data: ErpStorageFile | null; error: ErpStorageError | null }>;\n  remove(paths: string[]): Promise<{ data: unknown; error: ErpStorageError | null }>;\n  exists(path: string): Promise<{ data: boolean; error: ErpStorageError | null }>;\n};\n\nfunction supabaseClient(bucket: string) {\n  return createAdminClient().storage.from(bucket);\n}\n\nfunction toStorageError(error: unknown): ErpStorageError {\n  const candidate = error as { message?: unknown; status?: unknown } | null;\n  const message = typeof candidate?.message === \"string\" ? candidate.message : \"Kesalahan penyimpanan.\";\n  const status = typeof candidate?.status === \"number\" ? candidate.status : 500;\n  return { message, status, statusCode: String(status) };\n}\n\nfunction missingError(): ErpStorageError {\n  return { message: \"File tidak ditemukan.\", status: 404, statusCode: \"404\" };\n}\n\nfunction invalidPathError(): ErpStorageError {\n  return { message: \"Path penyimpanan tidak valid.\", status: 400, statusCode: \"400\" };\n}\n\n// Log fallback dibatasi agar backfill file lama tidak membanjiri log PM2.\nconst FALLBACK_LOG_INTERVAL_MS = 10 * 60 * 1000;\nconst fallbackLogAt = new Map<string, number>();\n\nfunction logFallback(bucket: string, path: string) {\n  const key = `${bucket}/${path}`;\n  const now = Date.now();\n  const last = fallbackLogAt.get(key) ?? 0;\n  if (now - last < FALLBACK_LOG_INTERVAL_MS) return;\n  if (fallbackLogAt.size > 1000) fallbackLogAt.clear();\n  fallbackLogAt.set(key, now);\n  console.info(\"[erp-storage] fallback-supabase\", { bucket, path });\n}\n\n/**\n * Adapter dengan bentuk yang sama seperti `supabase.storage.from(bucket)`.\n * Tujuannya: call site cukup mengganti satu baris konstruksi, tanpa mengubah\n * nama method, argumen, maupun pemeriksaan `{ data, error }`.\n */\nexport function erpStorage(bucket: string): ErpStorage {\n  return {\n    async upload(path, bytes, opts = {}) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).upload(path, bytes, opts);\n\n      try {\n        await putFile(bucket, path, bytes, { upsert: opts.upsert ?? false });\n      } catch (error) {\n        return { data: null, error: toStorageError(error) };\n      }\n\n      if (driver === \"hybrid\") {\n        const { error } = await supabaseClient(bucket).upload(path, bytes, opts);\n        if (error) {\n          // Fail-hard: jangan tinggalkan file yang hanya ada di VPS, karena rollback\n          // ke driver supabase akan menghilangkannya.\n          const { failed } = await removeFiles(bucket, [path]);\n          console.error(\"[erp-storage] hybrid-put-rollback\", {\n            bucket,\n            path,\n            message: error.message,\n            cleanupFailed: failed.length,\n          });\n          return { data: null, error };\n        }\n      }\n\n      return { data: { path }, error: null };\n    },\n\n    async download(path) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).download(path);\n\n      // Path tidak valid tidak boleh diteruskan ke Supabase: validasi traversal\n      // harus berlaku sama di semua driver.\n      if (!resolveSafe(bucket, path)) return { data: null, error: invalidPathError() };\n\n      let buffer: Buffer | null;\n      try {\n        buffer = await getFile(bucket, path);\n      } catch (error) {\n        return { data: null, error: toStorageError(error) };\n      }\n\n      if (buffer) {\n        return {\n          data: new Blob([new Uint8Array(buffer)], { type: contentTypeFromPath(path) }),\n          error: null,\n        };\n      }\n\n      if (driver === \"local\") return { data: null, error: missingError() };\n\n      logFallback(bucket, path);\n      return supabaseClient(bucket).download(path);\n    },\n\n    async remove(paths) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).remove(paths);\n\n      const local = await removeFiles(bucket, paths);\n      if (driver === \"local\") {\n        return {\n          data: null,\n          error: local.failed.length ? toStorageError({ message: local.failed[0]?.message, status: 500 }) : null,\n        };\n      }\n\n      const remote = await supabaseClient(bucket).remove(paths);\n      if (local.failed.length || remote.error) {\n        console.error(\"[erp-storage] remove-partial\", {\n          bucket,\n          localFailed: local.failed.length,\n          remoteMessage: remote.error?.message,\n        });\n        return {\n          data: null,\n          error: local.failed.length\n            ? toStorageError({ message: local.failed[0]?.message, status: 500 })\n            : remote.error,\n        };\n      }\n\n      return { data: null, error: null };\n    },\n\n    async exists(path) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).exists(path);\n\n      if (!resolveSafe(bucket, path)) return { data: false, error: invalidPathError() };\n\n      try {\n        if (await fileExists(bucket, path)) return { data: true, error: null };\n      } catch (error) {\n        return { data: false, error: toStorageError(error) };\n      }\n\n      if (driver === \"local\") return { data: false, error: null };\n\n      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).\n      return supabaseClient(bucket).exists(path);\n    },\n  };\n}\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Created file successfully: lib/storage/erp-storage.ts

---

## Assistant

_Thinking:_

Now the test file. Need to be careful with imports and env. Node test file can import both modules. But `

---

## Assistant

_Thinking:_

Continue: create tests/erp-storage.test.mjs. Then port call sites.

Let me write the test file now.

Test cases:
1. resolveSafe rejects traversal, bucket invalid.
2. put/get roundtrip for png/jpg/pdf/webp and extensionless.
3. upsert false rejects duplicate; upsert true overwrites and content read is new.
4. atomic temp cleanup: after put, no `.tmp-*` remains.
5. remove missing no throw; stat/exists.
6. contentTypeFromPath.
7. driver invalid throws; production relative throws (set NODE_ENV=production temporarily).
8. adapter local: upload/download/remove/exists; invalid path; missing file 404; upload duplicate error 409; download data type.
9. adapter local does not require Supabase env.

Important: `assertStorageReady` caches readinessKey; changing NODE_ENV then calling may re-evaluate because key includes NODE_ENV. But production relative test: set `process.env.NODE_ENV="production"`, `ERP_STORAGE_DIR` unset? We set root absolute at top. For testing relative, save old values, set NODE_ENV production, ERP_STORAGE_DIR="relative/path", call `assertStorageReady()` expecting throw; restore. Cache key changes; after restore key changes again. Good.

But Node's `process.env.NODE_ENV` may be undefined by default; setting is fine.

For adapter import: `await import("../lib/storage/erp-storage.ts")`. It imports `../supabase/admin.ts` which imports `server-only` and `@supabase/supabase-js`. Should work in Node (we tested server-only). `@supabase/supabase-js` package installed. Good.

But `erp-storage.ts` imports `./local-store.mjs`; fine.

Potential issue: Node type stripping rejects `import { type ... }`? We don't use. It strips `export type` fine? Node 24 supports type stripping including `export type`. The project's tests already import .ts with types. Fine.

Test runner glob includes this file. Test cleanup removes temp dir.

`File` not needed.

For adapter upload local, contentType; download Blob; `data.type` should be image/png based on path. Also `await data.arrayBuffer()`.

For invalid path adapter upload: `putFile` returns error 400; adapter catches and maps status 400. Good.

For duplicate: first upload, second upload upsert false → error.status 409. Good.

For hybrid tests we can't without Supabase; skip.

Let me write.

**Tool: write**

**Input:**
```json
{
  "content": "import assert from \"node:assert/strict\";\nimport { mkdtemp, readdir, rm } from \"node:fs/promises\";\nimport { tmpdir } from \"node:os\";\nimport { join } from \"node:path\";\nimport test from \"node:test\";\n\nconst storageRoot = await mkdtemp(join(tmpdir(), \"askonveksi-erp-storage-\"));\nprocess.env.ERP_STORAGE_DIR = storageRoot;\nprocess.env.ERP_STORAGE_DRIVER = \"local\";\n\nconst {\n  StorageError,\n  assertStorageReady,\n  contentTypeFromPath,\n  fileExists,\n  getFile,\n  putFile,\n  removeFiles,\n  resolveSafe,\n  statFile,\n  storageDriver,\n  storeRoot,\n} = await import(\"../lib/storage/local-store.mjs\");\nconst { erpStorage } = await import(\"../lib/storage/erp-storage.ts\");\n\nconst BUCKET = \"crm-po-designs\";\n\ntest(\"root storage mengikuti ERP_STORAGE_DIR\", () => {\n  assert.equal(storeRoot(), storageRoot);\n  assert.equal(storageDriver(), \"local\");\n  assert.equal(assertStorageReady(), \"local\");\n});\n\ntest(\"validasi path menolak traversal, absolut, backslash, NUL, dan bucket tidak valid\", () => {\n  assert.equal(resolveSafe(BUCKET, \"../etc/passwd\"), null);\n  assert.equal(resolveSafe(BUCKET, \"design/../../etc/passwd\"), null);\n  assert.equal(resolveSafe(BUCKET, \"/etc/passwd\"), null);\n  assert.equal(resolveSafe(BUCKET, \"design\\\\a.png\"), null);\n  assert.equal(resolveSafe(BUCKET, \"design/a\\0.png\"), null);\n  assert.equal(resolveSafe(BUCKET, \".hidden/a.png\"), null);\n  assert.equal(resolveSafe(BUCKET, \"design//a.png\"), null);\n  assert.equal(resolveSafe(\"../evil\", \"a.png\"), null);\n  assert.equal(resolveSafe(\"Business Assets\", \"a.png\"), null);\n\n  const safe = resolveSafe(BUCKET, \"design/task-1/a.png\");\n  assert.ok(safe);\n  assert.equal(safe.absolute, join(storageRoot, BUCKET, \"design/task-1/a.png\"));\n});\n\ntest(\"put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi\", async () => {\n  const samples = [\n    [\"design/task-1/a.png\", \"image/png\"],\n    [\"design/task-1/b.jpg\", \"image/jpeg\"],\n    [\"design/task-1/c.jpeg\", \"image/jpeg\"],\n    [\"design/task-1/d.webp\", \"image/webp\"],\n    [\"proofs/e.pdf\", \"application/pdf\"],\n    [\"whatsapp/account/2026-10-23/message-id\", \"application/octet-stream\"],\n  ];\n\n  for (const [path, expected] of samples) {\n    const bytes = Buffer.from(`isi-${path}`);\n    await putFile(BUCKET, path, bytes, { upsert: false });\n    const read = await getFile(BUCKET, path);\n    assert.ok(read);\n    assert.deepEqual(read, bytes);\n    assert.equal(contentTypeFromPath(path), expected);\n    assert.equal(await fileExists(BUCKET, path), true);\n    assert.equal((await statFile(BUCKET, path))?.size, bytes.length);\n  }\n});\n\ntest(\"upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp\", async () => {\n  const path = \"design/task-2/overwrite.png\";\n  await putFile(BUCKET, path, Buffer.from(\"versi-1\"), { upsert: false });\n  await assert.rejects(\n    () => putFile(BUCKET, path, Buffer.from(\"versi-2\"), { upsert: false }),\n    (error) => error instanceof StorageError && error.status === 409,\n  );\n  assert.equal((await getFile(BUCKET, path)).toString(), \"versi-1\");\n\n  await putFile(BUCKET, path, Buffer.from(\"versi-3\"), { upsert: true });\n  assert.equal((await getFile(BUCKET, path)).toString(), \"versi-3\");\n\n  const folder = join(storageRoot, BUCKET, \"design/task-2\");\n  const entries = await readdir(folder);\n  assert.equal(entries.some((entry) => entry.startsWith(\".tmp-\")), false, \"tidak ada file temp tertinggal\");\n});\n\ntest(\"get/stat untuk path hilang atau tidak valid mengembalikan null\", async () => {\n  assert.equal(await getFile(BUCKET, \"design/task-3/tidak-ada.png\"), null);\n  assert.equal(await statFile(BUCKET, \"design/task-3/tidak-ada.png\"), null);\n  assert.equal(await getFile(BUCKET, \"../rahasia.png\"), null);\n  assert.equal(await statFile(BUCKET, \"../rahasia.png\"), null);\n  assert.equal(await fileExists(BUCKET, \"../rahasia.png\"), false);\n});\n\ntest(\"removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid\", async () => {\n  const path = \"design/task-4/hapus.png\";\n  await putFile(BUCKET, path, Buffer.from(\"hapus\"), { upsert: false });\n\n  const result = await removeFiles(BUCKET, [path, path, \"../tidak-boleh\"]);\n  assert.equal(await fileExists(BUCKET, path), false);\n  assert.equal(result.failed.length, 1);\n  assert.equal(result.failed[0].path, \"../tidak-boleh\");\n});\n\ntest(\"driver invalid dan path relatif di produksi ditolak\", () => {\n  const previous = {\n    driver: process.env.ERP_STORAGE_DRIVER,\n    dir: process.env.ERP_STORAGE_DIR,\n    nodeEnv: process.env.NODE_ENV,\n  };\n  try {\n    process.env.ERP_STORAGE_DRIVER = \"disk\";\n    assert.throws(() => storageDriver(), /ERP_STORAGE_DRIVER tidak valid/);\n\n    process.env.ERP_STORAGE_DRIVER = \"local\";\n    process.env.ERP_STORAGE_DIR = \"data/erp-storage\";\n    process.env.NODE_ENV = \"production\";\n    assert.throws(() => assertStorageReady(), /path absolut/);\n\n    process.env.ERP_STORAGE_DIR = \"\";\n    assert.throws(() => assertStorageReady(), /wajib diset/);\n  } finally {\n    process.env.ERP_STORAGE_DRIVER = previous.driver;\n    process.env.ERP_STORAGE_DIR = previous.dir;\n    process.env.NODE_ENV = previous.nodeEnv;\n  }\n});\n\ntest(\"adapter local: upload, download, exists, remove\", async () => {\n  const storage = erpStorage(BUCKET);\n  const path = \"design/task-5/adapter.png\";\n  const bytes = new Uint8Array(Buffer.from(\"adapter-bytes\"));\n\n  const uploaded = await storage.upload(path, bytes, { contentType: \"image/png\", upsert: false });\n  assert.equal(uploaded.error, null);\n  assert.equal(uploaded.data?.path, path);\n\n  const exists = await storage.exists(path);\n  assert.equal(exists.data, true);\n  assert.equal(exists.error, null);\n\n  const downloaded = await storage.download(path);\n  assert.equal(downloaded.error, null);\n  assert.ok(downloaded.data);\n  assert.equal(downloaded.data.type, \"image/png\");\n  assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()), Buffer.from(bytes));\n\n  const removed = await storage.remove([path]);\n  assert.equal(removed.error, null);\n  assert.equal((await storage.exists(path)).data, false);\n  assert.equal((await storage.download(path)).error?.status, 404);\n});\n\ntest(\"adapter local: konflik upload, path invalid, dan file hilang\", async () => {\n  const storage = erpStorage(BUCKET);\n  const path = \"design/task-6/konflik.png\";\n\n  assert.equal((await storage.upload(path, new Uint8Array([1]), { upsert: false })).error, null);\n  const conflict = await storage.upload(path, new Uint8Array([2]), { upsert: false });\n  assert.equal(conflict.error?.status, 409);\n\n  const invalid = await storage.upload(\"../keluar.png\", new Uint8Array([3]), { upsert: false });\n  assert.equal(invalid.error?.status, 400);\n\n  const invalidDownload = await storage.download(\"../keluar.png\");\n  assert.equal(invalidDownload.error?.status, 400);\n  assert.equal(invalidDownload.data, null);\n\n  const invalidExists = await storage.exists(\"../keluar.png\");\n  assert.equal(invalidExists.data, false);\n  assert.equal(invalidExists.error?.status, 400);\n});\n\ntest.after(async () => {\n  await rm(storageRoot, { recursive: true, force: true });\n});\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/tests/erp-storage.test.mjs"
}
```

Created file successfully: tests/erp-storage.test.mjs

---

## Assistant

_Thinking:_

Let me continue from where the summary left off. I've created local-store.mjs, erp-storage.ts, and tests/erp-storage.test.mjs. Next: port call sites, worker, deploy, env, docs, tests, then verify.

Let me first check the current state of files and run the new test quickly to catch issues early. Let me inspect package.json test script and tsconfig.

Saya lanjut dari modul inti. Pertama saya cek konfigurasi test/TS dan jalankan test storage baru untuk menangkap masalah awal.

**Tool: shell**

**Input:**
```json
{
  "command": "cat package.json && echo \"---TSCONFIG---\" && cat tsconfig.json && echo \"---NODE---\" && node --version",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

{
  "name": "askonveksi",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "dev:https": "next dev --experimental-https",
    "build": "next build",
    "start": "next start",
    "whatsapp:worker": "node worker/whatsapp.mjs",
    "whatsapp:worker:dev": "node --watch worker/whatsapp.mjs",
    "broadcast-test:prepare": "node --env-file=.env.broadcast-test scripts/broadcast-test-prepare.mjs",
    "broadcast-test:migrate": "node --env-file=.env.broadcast-test scripts/broadcast-test-migrate.mjs",
    "broadcast-test:seed": "node --env-file=.env.broadcast-test scripts/seed-broadcast-test.mjs",
    "broadcast-test:dev": "node scripts/broadcast-test-dev.mjs",
    "broadcast-test:worker": "node --env-file=.env.broadcast-test worker/whatsapp.mjs",
    "postinstall": "npm run db:generate && npm run export:vendor",
    "export:vendor": "node scripts/sync-export-vendor.mjs",
    "predev": "npm run export:vendor",
    "predev:https": "npm run export:vendor",
    "prebuild": "npm run export:vendor",
    "test": "node --test tests/*.test.mjs",
    "lint": "eslint",
    "bootstrap:owner": "node scripts/bootstrap-owner.mjs",
    "crm:reset-storage": "node scripts/reset-crm-storage.mjs",
    "crm:setup-storage": "node scripts/setup-crm-storage.mjs",
    "cms:setup": "node scripts/cms-setup.mjs",
    "cms:validate": "node scripts/cms-validate.mjs",
    "cms:backup": "node scripts/cms-backup.mjs",
    "cms:clean-orphans": "node scripts/cms-clean-orphans.mjs",
    "db:seed:production-demo": "node scripts/seed-production-demo.mjs",
    "db:backfill:production": "node scripts/backfill-production-work-orders.mjs",
    "db:backfill:po-categories": "node scripts/backfill-purchase-order-categories.mjs",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate"
  },
  "dependencies": {
    "@base-ui/react": "^1.7.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "@supabase/ssr": "^0.12.5",
    "@supabase/supabase-js": "2.112.4",
    "@tiptap/extension-link": "^3.32.0",
    "@tiptap/react": "^3.32.0",
    "@tiptap/starter-kit": "^3.32.0",
    "@whiskeysockets/baileys": "7.0.0-rc14",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "exceljs": "4.4.0",
    "gsap": "^3.15.0",
    "konva": "^10.7.0",
    "lucide-react": "^1.34.0",
    "motion": "^13.2.0",
    "next": "16.3.8",
    "pdf-lib": "^1.17.1",
    "pg": "^8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-konva": "^19.2.0",
    "recharts": "^3.8.0",
    "sanitize-html": "^2.18.1",
    "sharp": "0.35.5",
    "swr": "^2.5.1",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/sanitize-html": "^2.16.2",
    "dotenv": "^17.4.2",
    "eslint": "^9",
    "eslint-config-next": "16.3.3",
    "prisma": "^7.10.0",
    "shadcn": "^4.19.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "overrides": {
    "exceljs": {
      "uuid": "11.1.1"
    },
    "@prisma/config": {
      "deepmerge-ts": "8.0.2"
    },
    "prisma": {
      "mysql2": "3.24.4"
    },
    "fast-uri": "3.1.8",
    "readdir-glob": {
      "minimatch": {
        "brace-expansion": "2.1.7"
      }
    },
    "eslint": {
      "minimatch": {
        "brace-expansion": "1.1.21"
      }
    }
  }
}
---TSCONFIG---
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
---NODE---
v26.7.0


**Tool: shell**

**Input:**
```json
{
  "command": "git status --short && echo \"---\" && ls -la lib/storage tests/erp-storage.test.mjs",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

?? FILE_TO_VPS.md
?? lib/storage/
?? tests/erp-storage.test.mjs
---
-rw-r--r-- 1 haydar haydar 7001 Oct 23 10:16 tests/erp-storage.test.mjs

lib/storage:
total 24
drwxr-xr-x  2 haydar haydar 4096 Oct 23 10:15 .
drwxr-xr-x 16 haydar haydar 4096 Oct 23 10:15 ..
-rw-r--r--  1 haydar haydar 6234 Oct 23 10:15 erp-storage.ts
-rw-r--r--  1 haydar haydar 6745 Oct 23 10:15 local-store.mjs


---

## Assistant

_Thinking:_

Run the storage test alone.

**Tool: shell**

**Input:**
```json
{
  "command": "node --test tests/erp-storage.test.mjs",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi",
  "timeout": 120000
}
```

(node:115908) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ root storage mengikuti ERP_STORAGE_DIR (0.720721ms)
✔ validasi path menolak traversal, absolut, backslash, NUL, dan bucket tidak valid (0.286025ms)
✔ put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi (8.012327ms)
✔ upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp (1.776165ms)
✔ get/stat untuk path hilang atau tidak valid mengembalikan null (0.383475ms)
✔ removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid (0.69698ms)
✔ driver invalid dan path relatif di produksi ditolak (0.290761ms)
✔ adapter local: upload, download, exists, remove (1.179347ms)
✔ adapter local: konflik upload, path invalid, dan file hilang (0.900301ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 171.135017


**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -50",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi",
  "timeout": 180000
}
```

(no output)

---

## Assistant

_Thinking:_

Great, core works and tsc passes currently (new files included). Now port call sites. Let me inspect the exact snippets to edit. I'll use grep with context, perhaps read relevant lines. Let me get the 19 files and relevant line ranges.

Modul inti lulus test dan typecheck. Sekarang saya port semua call site. Saya baca snippet persisnya dulu agar edit tidak salah.

**Tool: shell**

**Input:**
```json
{
  "command": "for f in app/actions/design.ts app/actions/production.ts app/actions/crm.ts app/actions/master-data.ts app/actions/whatsapp.ts lib/payment-proof.ts; do echo \"===== $f\"; grep -n -C 2 'createAdminClient\\|BUCKET\\|storage\\.from' \"$f\"; done",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

===== app/actions/design.ts
11-import { designImageContentType, designImageExtensionFor, designImageRejection } from "@/lib/design/image";
12-import { getPrismaClient } from "@/lib/prisma";
13:import { createAdminClient } from "@/lib/supabase/admin";
14-
15:const BUCKET = "crm-po-designs";
16-const MAX_FILES = 5;
17-const MAX_BYTES = 5 * 1024 * 1024;
--
119-    if (!uploads.length) throw new UserFacingError("Pilih minimal satu file desain.");
120-
121:    const storage = createAdminClient().storage.from(BUCKET);
122-    const uploaded: string[] = [];
123-    let opportunityId: string;
===== app/actions/production.ts
12-import { designImageContentType, designImageExtensionFor, designImageRejection, sniffImageContentType } from "@/lib/design/image";
13-import { getPrismaClient } from "@/lib/prisma";
14:import { createAdminClient } from "@/lib/supabase/admin";
15-import {
16-  addProductionNoteSchema,
--
40-}
41-
42:const DESIGN_BUCKET = "crm-po-designs";
43-const MAX_DESIGN_BYTES = 5 * 1024 * 1024;
44-
--
86-    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
87-    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
88:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
89-    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
90-    if (!attachment.originalPath) {
--
158-    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diganti.");
159-
160:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
161-    const folder = attachment.path.includes("/") ? attachment.path.slice(0, attachment.path.lastIndexOf("/")) : "design";
162-    const nextPath = `${folder}/${randomUUID()}.${designImageExtensionFor(contentType)}`;
--
242-    let restoredContentType: "image/png" | "image/jpeg" | undefined;
243-    if (attachment.originalPath) {
244:      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
245-      const { data: original, error: downloadError } = await storage.download(attachment.originalPath);
246-      if (downloadError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
--
294-    if (attachment.originalPath) {
295-      try {
296:        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
297-        if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
298-        else {
===== app/actions/crm.ts
53-import { getPrismaClient } from "@/lib/prisma";
54-import { proofRequired, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
55:import { createAdminClient } from "@/lib/supabase/admin";
56-import { ensureProductionWorkOrder } from "@/lib/production/service";
57-import { enqueueIssuedInvoiceWhatsAppJob, enqueueManualWhatsAppMessage } from "@/lib/whatsapp/jobs";
--
1849-    if (!deadlines.size && !uploads.length && !removals.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");
1850-
1851:    const storage = createAdminClient().storage.from("crm-po-designs");
1852-    try {
1853-      for (const upload of uploads) {
===== app/actions/master-data.ts
25-import { getPrismaClient } from "@/lib/prisma";
26-import { SITE_LOGO_CACHE_TAG } from "@/lib/site-logo";
27:import { createAdminClient } from "@/lib/supabase/admin";
28-
29-// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
--
982-      const image = await readBusinessImage(logo, "Logo");
983-      uploadedLogoPath = `business/logo-${randomUUID()}.${image.extension}`;
984:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
985-      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
986-    }
--
993-      const image = await readBusinessImage(signature, "Gambar tanda tangan");
994-      uploadedSignaturePath = `business/signature-${randomUUID()}.${image.extension}`;
995:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
996-      if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
997-    }
--
1024-      }, MASTER_DATA_TRANSACTION_OPTIONS);
1025-    } catch (error) {
1026:      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
1027:      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
1028-      throw error;
1029-    }
===== app/actions/whatsapp.ts
10-import { createCustomerSchema, entityIdSchema, firstValidationMessage } from "@/lib/crm/validation";
11-import { getPrismaClient } from "@/lib/prisma";
12:import { createAdminClient } from "@/lib/supabase/admin";
13-import { normalizeWhatsAppNumber, remoteJidForNumber, whatsappAccountSchema, whatsappTemplateSchema } from "@/lib/whatsapp/core";
14-import { enqueueInvoiceWhatsAppMessage, enqueueManualWhatsAppMessage, ensureCustomerWhatsAppConversation, getInvoiceWhatsAppMessage } from "@/lib/whatsapp/jobs";
--
188-      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `lampiran-${randomUUID()}`;
189-      const path = `outbound/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
190:      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
191-      if (result.error) throw new UserFacingError("Lampiran belum dapat disimpan.");
192-      attachment = { path, mimeType, fileName: safeName, sizeBytes: file.size, kind: mimeType.startsWith("image/") ? "IMAGE" : "DOCUMENT" };
--
197-      return flashMessagePath(`/whatsapp?conversation=${resultId}`, "notice", "Pesan dijadwalkan untuk dikirim.");
198-    } catch (error) {
199:      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
200-      throw error;
201-    }
===== lib/payment-proof.ts
4-
5-import { UserFacingError } from "@/lib/actions/response";
6:import { createAdminClient } from "@/lib/supabase/admin";
7-
8:export const PAYMENT_PROOF_BUCKET = "payment-proofs";
9-export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
10-const types = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
--
30-  const extension = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
31-  const proofPath = `${owner}/${randomUUID()}.${extension}`;
32:  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
33-  if (error) throw new UserFacingError("Bukti tidak dapat diunggah.");
34-  return { proofPath, proofFileName: value.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || `bukti.${extension}`, proofMimeType: mime, proofSize: value.size };
--
36-
37-export async function deletePaymentProof(path: string | null | undefined) {
38:  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
39-}


**Tool: shell**

**Input:**
```json
{
  "command": "for f in \"app/api/desain/[taskId]/attachments/[attachmentId]/route.ts\" \"app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts\" \"app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts\" \"app/api/crm/purchase-order/[id]/pdf/route.ts\" \"app/api/crm/invoice/[id]/pdf/route.ts\" \"app/api/crm/payment-transactions/[id]/kwitansi/route.ts\" \"app/api/master-data/business-profile/logo/route.ts\" \"app/api/master-data/business-profile/signature/route.ts\" \"app/api/public/business-logo/route.ts\" \"app/api/keuangan/pengeluaran/[id]/bukti/route.ts\" \"app/api/crm/payment-transactions/[id]/proof/route.ts\" \"app/api/crm/purchase-order/[id]/deposit/proof/route.ts\" \"app/api/whatsapp/media/[id]/route.ts\"; do echo \"===== $f\"; grep -n -C 1 'createAdminClient\\|storage\\.from\\|const storage' \"$f\"; done",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

===== app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
5-import { getPrismaClient } from "@/lib/prisma";
6:import { createAdminClient } from "@/lib/supabase/admin";
7-
--
16-  const original = new URL(request.url).searchParams.has("original");
17:  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
18-  if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
===== app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
4-import { getPrismaClient } from "@/lib/prisma";
5:import { createAdminClient } from "@/lib/supabase/admin";
6-
--
29-
30:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
31-  if (error) return new Response("Lampiran tidak dapat dibuka.", { status: 404 });
===== app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
4-import { getPrismaClient } from "@/lib/prisma";
5:import { createAdminClient } from "@/lib/supabase/admin";
6-
--
30-
31:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
32-  if (error) return new Response("Desain penjahit tidak dapat dibuka.", { status: 404 });
===== app/api/crm/purchase-order/[id]/pdf/route.ts
8-import { getPrismaClient } from "@/lib/prisma";
9:import { createAdminClient } from "@/lib/supabase/admin";
10-
--
46-  if (!purchaseOrder) return new Response("PO tidak ditemukan.", { status: 404 });
47:  const storage = createAdminClient().storage;
48-  // Snapshot lebih dulu; PO lama yang snapshot logonya kosong jatuh ke logo profil terkini,
--
52-  if (logoPath) {
53:    const { data } = await storage.from("business-assets").download(logoPath);
54-    if (data) {
--
77-            const originalName = item.penjahitDesignName ?? label;
78:            const { data } = await storage.from("crm-po-designs").download(path);
79-            if (!data) return null;
--
93-    if (item.contentType === "application/pdf") return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
94:    const { data } = await storage.from("crm-po-designs").download(item.path);
95-    if (!data) return null;
===== app/api/crm/invoice/[id]/pdf/route.ts
6-import { getPrismaClient } from "@/lib/prisma";
7:import { createAdminClient } from "@/lib/supabase/admin";
8-import { downloadFilename } from "@/lib/download-filename";
--
88-  if (logoPath) {
89:    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
90-    if (data) {
--
96-  if (signaturePath) {
97:    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
98-    if (data) {
===== app/api/crm/payment-transactions/[id]/kwitansi/route.ts
7-import { getPrismaClient } from "@/lib/prisma";
8:import { createAdminClient } from "@/lib/supabase/admin";
9-
--
41-  const order = tx.payment.salesOrder;
42:  const bucket = createAdminClient().storage.from("business-assets");
43-  const readImage = async (path: string | null) => {
===== app/api/master-data/business-profile/logo/route.ts
2-import { getPrismaClient } from "@/lib/prisma";
3:import { createAdminClient } from "@/lib/supabase/admin";
4-
--
14-  if (!profile?.logoPath) return new Response("Logo tidak ditemukan.", { status: 404 });
15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
16-  if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
===== app/api/master-data/business-profile/signature/route.ts
2-import { getPrismaClient } from "@/lib/prisma";
3:import { createAdminClient } from "@/lib/supabase/admin";
4-
--
14-  if (!profile?.signaturePath) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
16-  if (error || !data) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
===== app/api/public/business-logo/route.ts
1-import { getPrismaClient } from "@/lib/prisma";
2:import { createAdminClient } from "@/lib/supabase/admin";
3-
--
33-    }
34:    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
35-    if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
===== app/api/keuangan/pengeluaran/[id]/bukti/route.ts
5-import { getPrismaClient } from "@/lib/prisma";
6:import { createAdminClient } from "@/lib/supabase/admin";
7-
--
15-  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
17-  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
===== app/api/crm/payment-transactions/[id]/proof/route.ts
5-import { getPrismaClient } from "@/lib/prisma";
6:import { createAdminClient } from "@/lib/supabase/admin";
7-
--
15-  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
17-  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
===== app/api/crm/purchase-order/[id]/deposit/proof/route.ts
5-import { getPrismaClient } from "@/lib/prisma";
6:import { createAdminClient } from "@/lib/supabase/admin";
7-
--
23-  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
24:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
25-  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
===== app/api/whatsapp/media/[id]/route.ts
3-import { getPrismaClient } from "@/lib/prisma";
4:import { createAdminClient } from "@/lib/supabase/admin";
5-
--
19-  if (!message?.mediaPath) return new Response("Lampiran tidak ditemukan.", { status: 404 });
20:  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
21-  if (result.error) return new Response("Lampiran tidak ditemukan.", { status: 404 });


---

## Assistant

_Thinking:_

Need to check BUCKET constants in R2/R3/R1, and imports of PAYMENT_PROOF_BUCKET. Also app/actions/design.ts imports designImage* from alias; not relevant.

Let me check top of routes for BUCKET definitions and payment-proof import.

**Tool: shell**

**Input:**
```json
{
  "command": "for f in \"app/api/desain/[taskId]/attachments/[attachmentId]/route.ts\" \"app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts\" \"app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts\" \"app/api/keuangan/pengeluaran/[id]/bukti/route.ts\" \"app/api/crm/payment-transactions/[id]/proof/route.ts\" \"app/api/crm/purchase-order/[id]/deposit/proof/route.ts\"; do echo \"===== $f\"; sed -n '1,30p' \"$f\"; done",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

===== app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
import { DESIGN_VIEW_ROLES, DETAIL_DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { sniffImageContentType } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
  try { await requireActor([...DESIGN_VIEW_ROLES, ...DETAIL_DESIGN_VIEW_ROLES]); } catch { return new Response("Anda tidak berhak membuka file desain.", { status: 403 }); }
  const values = await params;
  const taskId = entityIdSchema.safeParse(values.taskId);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!taskId.success || !attachmentId.success) return new Response("File desain tidak ditemukan.", { status: 404 });
  const attachment = await getPrismaClient().designAttachment.findFirst({ where: { id: attachmentId.data, designRevision: { designTaskId: taskId.data } }, select: { path: true, originalPath: true, originalName: true, contentType: true } });
  if (!attachment) return new Response("File desain tidak ditemukan.", { status: 404 });
  const original = new URL(request.url).searchParams.has("original");
  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
  if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
  const disposition = new URL(request.url).searchParams.has("inline") ? "inline" : "attachment";
  // Salinan desain awal dan revisi lama bisa berjenis beda dari kolom contentType,
  // jadi tipe dikenali ulang dari isi file agar pratinjau dengan `nosniff` tetap tampil.
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new Response(buffer, { headers: { "Content-Type": sniffImageContentType(bytes) ?? attachment.contentType, "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
===== app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka lampiran desain.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!purchaseOrderId.success || !attachmentId.success) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const attachment = await getPrismaClient().purchaseOrderAttachment.findFirst({
    where: { id: attachmentId.data, purchaseOrderId: purchaseOrderId.data },
    select: { path: true, originalName: true, contentType: true },
  });
  if (!attachment) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
===== app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

/** Pratinjau desain penjahit per produk (Sprint 11 R3) — dipakai thumbnail dialog & PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka desain penjahit.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const itemId = entityIdSchema.safeParse(values.itemId);
  if (!purchaseOrderId.success || !itemId.success) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const item = await getPrismaClient().purchaseOrderItem.findFirst({
    where: { id: itemId.data, purchaseOrderId: purchaseOrderId.data, penjahitDesignPath: { not: null } },
    select: { penjahitDesignPath: true, penjahitDesignName: true, penjahitDesignType: true },
  });
  if (!item?.penjahitDesignPath) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

===== app/api/keuangan/pengeluaran/[id]/bukti/route.ts
import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(FINANCE_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().expense.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
===== app/api/crm/payment-transactions/[id]/proof/route.ts
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().paymentTransaction.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
===== app/api/crm/purchase-order/[id]/deposit/proof/route.ts
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Bukti deposit PO (PurchaseOrderDeposit) — dipakai tombol "Lihat Deposit" dan
 * pratinjau di Detail PO. Selalu membaca data terbaru, jadi hasilnya mengikuti
 * Isi / Ubah Deposit yang terakhir disimpan.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().purchaseOrderDeposit.findUnique({
    where: { purchaseOrderId: id.data },
    select: { proofPath: true, proofFileName: true, proofMimeType: true },
  });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"createAdminClient\" app lib --include='*.ts' --include='*.tsx' | grep -v 'lib/supabase/admin'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

app/actions/master-data.ts:984:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:995:      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:1026:      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
app/actions/master-data.ts:1027:      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
app/actions/whatsapp.ts:190:      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
app/actions/whatsapp.ts:199:      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
app/actions/crm.ts:1851:    const storage = createAdminClient().storage.from("crm-po-designs");
app/actions/production.ts:88:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:160:    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:244:      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
app/actions/production.ts:296:        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
app/actions/design.ts:121:    const storage = createAdminClient().storage.from(BUCKET);
app/actions/users.ts:52:    const admin = createAdminClient();
app/actions/users.ts:152:    const admin = emailWillChange || passwordWillChange ? createAdminClient() : null;
app/api/whatsapp/media/[id]/route.ts:20:  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts:30:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
app/api/crm/purchase-order/[id]/deposit/proof/route.ts:24:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts:31:  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
app/api/crm/purchase-order/[id]/pdf/route.ts:47:  const storage = createAdminClient().storage;
app/api/crm/invoice/[id]/pdf/route.ts:89:    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/crm/invoice/[id]/pdf/route.ts:97:    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
app/api/crm/payment-transactions/[id]/proof/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/crm/payment-transactions/[id]/kwitansi/route.ts:42:  const bucket = createAdminClient().storage.from("business-assets");
app/api/keuangan/pengeluaran/[id]/bukti/route.ts:16:  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
app/api/public/business-logo/route.ts:34:    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
app/api/master-data/business-profile/signature/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
app/api/master-data/business-profile/logo/route.ts:15:  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts:17:  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
lib/storage/erp-storage.ts:3:import { createAdminClient } from "../supabase/admin.ts";
lib/storage/erp-storage.ts:35:  return createAdminClient().storage.from(bucket);
lib/payment-proof.ts:32:  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
lib/payment-proof.ts:38:  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);


---

## Assistant

_Thinking:_

`app/actions/users.ts` legitimately uses createAdminClient for auth, leave it. All others to port.

Let me perform edits file by file. I can use a Node script for exact replacements to avoid many tool calls, but instructions prefer dedicated edit tool. However 19 files × ~2 edits = many calls. I can use a small Node script for mechanical exact replacements with verification; that's a shell command but acceptable. Yet risk of missing. Let's use `perl`? The instructions say prefer dedicated tools; `edit` is reliable. I'll batch multiple edits per message? Each `edit` call is a separate tool invocation, but I can call multiple in parallel? They edit different files, so yes. However within same file, multiple edits can conflict if parallel. I'll do one edit per file where possible by replacing a larger block? Let me do sequential groups.

Actually, I can use `execute` code mode to call tools? No file edit tool in Code Mode catalog. Only shell/read/write/edit available outside execute. Wait, the tool catalog listed only opencode tools for execute; but I have direct edit/write/read tools in this environment. Fine.

Let me do edits in parallel across distinct files. For each file, one edit covering import + call? They're not adjacent. I need two edits per file. I can do import replacement and call replacement in same file sequentially. Let me group by file and use multiple sequential messages, or use `replaceAll` for repeated patterns.

For design.ts: two edits.
For production.ts: import + 4 calls (replaceAll `createAdminClient().storage.from(DESIGN_BUCKET)` with `erpStorage(DESIGN_BUCKET)`), plus const change.
For crm.ts: import + call.
master-data.ts: import + replaceAll `createAdminClient().storage.from("business-assets")` → `erpStorage(BUSINESS_ASSETS_BUCKET)`.
whatsapp.ts: import + replaceAll `createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media")` → `erpStorage(WHATSAPP_MEDIA_BUCKET)`.
payment-proof.ts: import + 2 calls.

Routes similarly.

Let me start with the 6 action/lib files. I'll do a batch of edits, but sequential per file. Use one edit call per file combining import line and maybe constant if near? Import lines and constants are adjacent in design/production. For design:

old:
```
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";
```
new:
```
import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

const BUCKET = PO_DESIGNS_BUCKET;
```
Then call.

production import + const not adjacent (lines 14 and 42) but I can do separate.

Let me do parallel calls for distinct files' first edits, then second edits.

Group 1: imports/consts:
- design.ts
- production.ts import
- crm.ts import
- master-data.ts import
- whatsapp.ts import
- payment-proof.ts import + bucket? `PAYMENT_PROOF_BUCKET` stays; just import.

Let me do these.

Semua titik akses sudah teridentifikasi. Saya port sekarang, mulai dari action dan `lib/payment-proof.ts`.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/design.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";\n\nconst BUCKET = \"crm-po-designs\";",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";\n\nconst BUCKET = PO_DESIGNS_BUCKET;"
}
```

Edited app/actions/design.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/production.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";"
}
```

Edited app/actions/production.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/crm.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";"
}
```

Edited app/actions/crm.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/master-data.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";"
}
```

Edited app/actions/master-data.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/whatsapp.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";",
  "newString": "import { erpStorage, WHATSAPP_MEDIA_BUCKET } from \"@/lib/storage/erp-storage\";"
}
```

Edited app/actions/whatsapp.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/payment-proof.ts",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";",
  "newString": "import { erpStorage } from \"@/lib/storage/erp-storage\";"
}
```

Edited lib/payment-proof.ts (1 replacement)

---

## Assistant

_Thinking:_

Now the call replacements. Do parallel across files; within same file use replaceAll where applicable. production has DESIGN_BUCKET const change + 4 calls. I can do two edits sequentially for production. Let's batch first edit per file:

design: call
production: const change
crm: call
master-data: replaceAll calls
whatsapp: replaceAll calls
payment-proof: two calls (replaceAll pattern? same expression `.storage.from(PAYMENT_PROOF_BUCKET)` appears twice with different methods; replaceAll of `createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)` → `erpStorage(PAYMENT_PROOF_BUCKET)` works).

Then production calls replaceAll.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/design.ts",
  "oldString": "    const storage = createAdminClient().storage.from(BUCKET);",
  "newString": "    const storage = erpStorage(BUCKET);"
}
```

Edited app/actions/design.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/production.ts",
  "oldString": "const DESIGN_BUCKET = \"crm-po-designs\";",
  "newString": "const DESIGN_BUCKET = PO_DESIGNS_BUCKET;"
}
```

Edited app/actions/production.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/crm.ts",
  "oldString": "    const storage = createAdminClient().storage.from(\"crm-po-designs\");",
  "newString": "    const storage = erpStorage(PO_DESIGNS_BUCKET);"
}
```

Edited app/actions/crm.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/master-data.ts",
  "oldString": "createAdminClient().storage.from(\"business-assets\")",
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "replaceAll": true
}
```

Edited app/actions/master-data.ts (4 replacements)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/whatsapp.ts",
  "oldString": "createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\")",
  "newString": "erpStorage(WHATSAPP_MEDIA_BUCKET)",
  "replaceAll": true
}
```

Edited app/actions/whatsapp.ts (2 replacements)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/payment-proof.ts",
  "oldString": "createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)",
  "newString": "erpStorage(PAYMENT_PROOF_BUCKET)",
  "replaceAll": true
}
```

Edited lib/payment-proof.ts (2 replacements)

---

## Assistant

_Thinking:_

Now production 4 calls.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/production.ts",
  "newString": "createAdminClient().storage.from(DESIGN_BUCKET)",
  "oldString": "erpStorage(DESIGN_BUCKET)",
  "replaceAll": true
}
```

Could not find oldString in /home/haydar/Code/askonveksi/askonveksi/app/actions/production.ts. It must match exactly, including whitespace and indentation.

---

## Assistant

_Thinking:_

I swapped old/new. Correct: old `createAdminClient().storage.from(DESIGN_BUCKET)`, new `erpStorage(DESIGN_BUCKET)`.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/actions/production.ts",
  "newString": "erpStorage(DESIGN_BUCKET)",
  "oldString": "createAdminClient().storage.from(DESIGN_BUCKET)",
  "replaceAll": true
}
```

Edited app/actions/production.ts (4 replacements)

---

## Assistant

_Thinking:_

Now routes. 13 files. Import replacements + calls. Let me do imports in parallel.

R1 desain: import line replace.
R2 attachments: import + BUCKET const? Keep BUCKET = PO_DESIGNS_BUCKET. Change import to `{ erpStorage, PO_DESIGNS_BUCKET }` and const.
R3 same.
R4 pdf: import `{ BUSINESS_ASSETS_BUCKET, erpStorage, PO_DESIGNS_BUCKET }`; remove `const storage`.
R5 invoice: import `{ BUSINESS_ASSETS_BUCKET, erpStorage }`; calls.
R6 kwitansi: import `{ BUSINESS_ASSETS_BUCKET, erpStorage }`; call.
R7 logo route: import `{ BUSINESS_ASSETS_BUCKET, erpStorage }`; call.
R8 signature same.
R9 public logo same.
R10 keuangan bukti: import `{ erpStorage }`; keep PAYMENT_PROOF_BUCKET import; call.
R11 payment proof route same.
R12 deposit proof same.
R13 whatsapp media: import `{ erpStorage, WHATSAPP_MEDIA_BUCKET }`; call.

Do imports first. For R1, `createAdminClient` import → `{ erpStorage, PO_DESIGNS_BUCKET }` but call uses literal currently; we'll change to PO_DESIGNS_BUCKET. Could just import `{ erpStorage }` and call `erpStorage("crm-po-designs")`; simpler. But consistent constants. Let's use constant.

For R2/R3, need const change. Combine import + const where adjacent:
R2:
```
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";
```
→
```
import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

const BUCKET = PO_DESIGNS_BUCKET;
```
Same for R3.

R1 import only; call later.

R4 import only, then remove const storage and calls.

Let's batch imports.

Action selesai. Sekarang 13 route baca; saya ganti import dan pemanggilan storage satu per satu.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/desain/[taskId]/attachments/[attachmentId]/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";\n\nconst BUCKET = PO_DESIGNS_BUCKET;",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";\n\nconst BUCKET = \"crm-po-designs\";"
}
```

Edited app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts",
  "newString": "import { erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";\n\nconst BUCKET = PO_DESIGNS_BUCKET;",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";\n\nconst BUCKET = \"crm-po-designs\";"
}
```

Edited app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/pdf/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage, PO_DESIGNS_BUCKET } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/crm/purchase-order/[id]/pdf/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/invoice/[id]/pdf/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/crm/invoice/[id]/pdf/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/payment-transactions/[id]/kwitansi/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/crm/payment-transactions/[id]/kwitansi/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/master-data/business-profile/logo/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/master-data/business-profile/logo/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/master-data/business-profile/signature/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/master-data/business-profile/signature/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/public/business-logo/route.ts",
  "newString": "import { BUSINESS_ASSETS_BUCKET, erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/public/business-logo/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/keuangan/pengeluaran/[id]/bukti/route.ts",
  "newString": "import { erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/keuangan/pengeluaran/[id]/bukti/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/payment-transactions/[id]/proof/route.ts",
  "newString": "import { erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/crm/payment-transactions/[id]/proof/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/deposit/proof/route.ts",
  "newString": "import { erpStorage } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/crm/purchase-order/[id]/deposit/proof/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/whatsapp/media/[id]/route.ts",
  "newString": "import { erpStorage, WHATSAPP_MEDIA_BUCKET } from \"@/lib/storage/erp-storage\";",
  "oldString": "import { createAdminClient } from \"@/lib/supabase/admin\";"
}
```

Edited app/api/whatsapp/media/[id]/route.ts (1 replacement)

---

## Assistant

_Thinking:_

Now calls. For R4 need remove `const storage` and replace `storage.from(...)`. Do:

R1: `createAdminClient().storage.from("crm-po-designs")` → `erpStorage(PO_DESIGNS_BUCKET)`.
R2/R3: `createAdminClient().storage.from(BUCKET)` → `erpStorage(BUCKET)`.
R4: remove `  const storage = createAdminClient().storage;\n` and replace `storage.from("business-assets")` → `erpStorage(BUSINESS_ASSETS_BUCKET)`, `storage.from("crm-po-designs")` → `erpStorage(PO_DESIGNS_BUCKET)`.
R5: replaceAll `createAdminClient().storage.from("business-assets")` → `erpStorage(BUSINESS_ASSETS_BUCKET)`.
R6: `const bucket = createAdminClient().storage.from("business-assets");` → `const bucket = erpStorage(BUSINESS_ASSETS_BUCKET);`
R7/R8/R9: calls.
R10/R11/R12: `createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)` → `erpStorage(PAYMENT_PROOF_BUCKET)`.
R13: `createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media")` → `erpStorage(WHATSAPP_MEDIA_BUCKET)`.

Batch.

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts",
  "newString": "erpStorage(PO_DESIGNS_BUCKET)",
  "oldString": "createAdminClient().storage.from(\"crm-po-designs\")"
}
```

Edited app/api/desain/[taskId]/attachments/[attachmentId]/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts",
  "newString": "erpStorage(BUCKET)",
  "oldString": "createAdminClient().storage.from(BUCKET)"
}
```

Edited app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts",
  "newString": "erpStorage(BUCKET)",
  "oldString": "createAdminClient().storage.from(BUCKET)"
}
```

Edited app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/pdf/route.ts",
  "newString": "  // Snapshot lebih dulu; PO lama yang snapshot logonya kosong jatuh ke logo profil terkini,",
  "oldString": "  const storage = createAdminClient().storage;\n  // Snapshot lebih dulu; PO lama yang snapshot logonya kosong jatuh ke logo profil terkini,"
}
```

Edited app/api/crm/purchase-order/[id]/pdf/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/invoice/[id]/pdf/route.ts",
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "oldString": "createAdminClient().storage.from(\"business-assets\")",
  "replaceAll": true
}
```

Edited app/api/crm/invoice/[id]/pdf/route.ts (2 replacements)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/payment-transactions/[id]/kwitansi/route.ts",
  "newString": "  const bucket = erpStorage(BUSINESS_ASSETS_BUCKET);",
  "oldString": "  const bucket = createAdminClient().storage.from(\"business-assets\");"
}
```

Edited app/api/crm/payment-transactions/[id]/kwitansi/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/master-data/business-profile/logo/route.ts",
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "oldString": "createAdminClient().storage.from(\"business-assets\")"
}
```

Edited app/api/master-data/business-profile/logo/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/master-data/business-profile/signature/route.ts",
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "oldString": "createAdminClient().storage.from(\"business-assets\")"
}
```

Edited app/api/master-data/business-profile/signature/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/public/business-logo/route.ts",
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "oldString": "createAdminClient().storage.from(\"business-assets\")"
}
```

Edited app/api/public/business-logo/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/keuangan/pengeluaran/[id]/bukti/route.ts",
  "newString": "erpStorage(PAYMENT_PROOF_BUCKET)",
  "oldString": "createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)"
}
```

Edited app/api/keuangan/pengeluaran/[id]/bukti/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/payment-transactions/[id]/proof/route.ts",
  "newString": "erpStorage(PAYMENT_PROOF_BUCKET)",
  "oldString": "createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)"
}
```

Edited app/api/crm/payment-transactions/[id]/proof/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/deposit/proof/route.ts",
  "newString": "erpStorage(PAYMENT_PROOF_BUCKET)",
  "oldString": "createAdminClient().storage.from(PAYMENT_PROOF_BUCKET)"
}
```

Edited app/api/crm/purchase-order/[id]/deposit/proof/route.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/whatsapp/media/[id]/route.ts",
  "newString": "erpStorage(WHATSAPP_MEDIA_BUCKET)",
  "oldString": "createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\")"
}
```

Edited app/api/whatsapp/media/[id]/route.ts (1 replacement)

---

## Assistant

_Thinking:_

Now R4 calls: `storage.from("business-assets")` and `storage.from("crm-po-designs")` (2 occurrences). Replace.

**Tool: edit**

**Input:**
```json
{
  "newString": "erpStorage(BUSINESS_ASSETS_BUCKET)",
  "oldString": "storage.from(\"business-assets\")",
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/pdf/route.ts"
}
```

Edited app/api/crm/purchase-order/[id]/pdf/route.ts (1 replacement)

---

## Assistant

**Tool: edit**

**Input:**
```json
{
  "newString": "erpStorage(PO_DESIGNS_BUCKET)",
  "oldString": "storage.from(\"crm-po-designs\")",
  "path": "/home/haydar/Code/askonveksi/askonveksi/app/api/crm/purchase-order/[id]/pdf/route.ts",
  "replaceAll": true
}
```

Edited app/api/crm/purchase-order/[id]/pdf/route.ts (2 replacements)

---

## Assistant

_Thinking:_

Now verify no remaining `createAdminClient().storage` outside adapter.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"createAdminClient().storage\\|storage.from(\" app lib --include='*.ts' --include='*.tsx' | grep -v 'lib/storage/erp-storage.ts' || true",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(no output)

**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

app/api/crm/payment-transactions/[id]/proof/route.ts(19,29): error TS18047: 'data' is possibly 'null'.
app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts(33,29): error TS18047: 'data' is possibly 'null'.
app/api/crm/purchase-order/[id]/deposit/proof/route.ts(27,29): error TS18047: 'data' is possibly 'null'.
app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts(34,29): error TS18047: 'data' is possibly 'null'.
app/api/desain/[taskId]/attachments/[attachmentId]/route.ts(22,24): error TS18047: 'data' is possibly 'null'.
app/api/keuangan/pengeluaran/[id]/bukti/route.ts(19,29): error TS18047: 'data' is possibly 'null'.
app/api/whatsapp/media/[id]/route.ts(23,29): error TS18047: 'result.data' is possibly 'null'.


---

## Assistant

_Thinking:_

The Supabase typed `download` returns `data: Blob | null` but these routes previously narrowed via `if (error)`? Supabase's error union maybe had data non-null when error null? Actually Supabase types return `{ data: Blob; error: null } | { data: null; error: StorageError }`? Hmm. Our type says `data: ErpStorageFile | null; error: ErpStorageError | null` independently, so TS doesn't narrow. Need to either change adapter return type to a discriminated union, or adjust routes to check `!data`. Better: make return type discriminated union so existing call sites narrow with `if (error)`. Supabase itself likely does. Let's define:

```ts
export type ErpStorageResult<T> =
  | { data: T; error: null }
  | { data: null; error: ErpStorageError };
```

Then `download` returns `ErpStorageResult<ErpStorageFile>`. But hybrid fallback returns Supabase result typed accordingly. `upload` similarly. `exists` data boolean with error. `remove` unknown.

Would this break existing code expecting `{data,error}`? No. For `exists`, call sites check `{ data }` maybe. Let's inspect production usage of exists. Also `remove` returns data null on success in hybrid; with union success requires data T; make T = unknown/null? If union success `{data: null,error:null}` okay if T=null. But distinct success/error is useful. For remove, define `ErpStorageResult<null>`.

However TypeScript narrowing by `if (error)` works in discriminated union if `error` is literal null vs object. Good.

But there is a subtle issue: in adapter upload, returning `supabaseClient(bucket).upload(...)` has Supabase's own union; assignable. `download` return supabase result; assignable if Supabase union data Blob (non-null). Good.

If hybrid fallback returns `supabase...download`, fine.

`exists` local success `{data:true,error:null}` fits `ErpStorageResult<boolean>`; failure data:null, error object. Good.

Let's update types. Define:
```ts
export type ErpStorageResult<T> =
  | { data: T; error: null }
  | { data: null; error: ErpStorageError };
```
Upload: `ErpStorageResult<{path:string}>`.
Download: `ErpStorageResult<ErpStorageFile>`.
Exists: `ErpStorageResult<boolean>`.
Remove: `ErpStorageResult<null>` (success data null; but type success allows null). Actually `ErpStorageResult<null>` both branches data null. Fine, error distinguishes. But the adapter's `remove` returns `{ data: null, error: null }` on success, and in hybrid it returns remote.error union? `return { data: null, error: remote.error }` where remote.error is ErpStorageError (truthy) or maybe null? In branch `local.failed.length || remote.error` guarantees at least one truthy, but remote.error could be null while local.failed.length >0, then we return the local error. In ternary yes. So type okay. In fail branch returning `remote.error` in else when local.failed length 0 implies remote.error truthy. TS may not narrow; but assigning `ErpStorageError | null` to `error: ErpStorageError` in failure branch may fail. We'll see.

Alternatively simpler: keep `data: T | null; error: ErpStorageError | null` and fix 7 routes by adding `|| !data`. That's also fine and less type churn. But the adapter's goal is drop-in compatibility with Supabase, and Supabase's type does narrow. Let's use discriminated union; better.

Need also `upload` success local `{data:{path},error:null}` fits. Supabase's upload union assignable? Supabase types: `{ data: { path: string; id: string; fullPath: string }; error: null } | { data: null; error: StorageError }`. `StorageError` has `message`, `statusCode?: string`, `status?: number`? Let's check version. Likely yes. Assignable to ErpStorageError. Good.

But in upload hybrid branch:
```ts
const { error } = await supabaseClient(bucket).upload(...)
if (error) {... return { data:null, error } }
```
fine.

`exists` fallback returns supabase union `{data:boolean,error:null}|{data:null,error}`; assignable to `ErpStorageResult<boolean>`? Success data boolean, error null; failure data null, error. Yes.

Let's edit erp-storage.ts types.

Type error muncul karena adapter belum memakai discriminated union seperti Supabase. Saya perbaiki tipe hasil agar `if (error)` tetap menyempitkan `data`, tanpa mengubah call site.

**Tool: edit**

**Input:**
```json
{
  "newString": "export type ErpStorageError = { message: string; status?: number; statusCode?: string };\nexport type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };\nexport type ErpUploadOptions = { contentType?: string; upsert?: boolean };\nexport type ErpStorageResult<T> =\n  | { data: T; error: null }\n  | { data: null; error: ErpStorageError };\n\nexport type ErpStorage = {\n  upload(\n    path: string,\n    bytes: Uint8Array,\n    opts?: ErpUploadOptions,\n  ): Promise<ErpStorageResult<{ path: string }>>;\n  download(path: string): Promise<ErpStorageResult<ErpStorageFile>>;\n  remove(paths: string[]): Promise<ErpStorageResult<null>>;\n  exists(path: string): Promise<ErpStorageResult<boolean>>;\n};",
  "oldString": "export type ErpStorageError = { message: string; status?: number; statusCode?: string };\nexport type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };\nexport type ErpUploadOptions = { contentType?: string; upsert?: boolean };\n\nexport type ErpStorage = {\n  upload(\n    path: string,\n    bytes: Uint8Array,\n    opts?: ErpUploadOptions,\n  ): Promise<{ data: { path: string } | null; error: ErpStorageError | null }>;\n  download(path: string): Promise<{ data: ErpStorageFile | null; error: ErpStorageError | null }>;\n  remove(paths: string[]): Promise<{ data: unknown; error: ErpStorageError | null }>;\n  exists(path: string): Promise<{ data: boolean; error: ErpStorageError | null }>;\n};",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

---

## Assistant

_Thinking:_

Now rerun tsc.

**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

lib/storage/erp-storage.ts(134,11): error TS2322: Type '(paths: string[]) => Promise<{ data: FileObject[]; error: null; } | { data: null; error: ErpStorageError | null; }>' is not assignable to type '(paths: string[]) => Promise<ErpStorageResult<null>>'.
  Type 'Promise<{ data: FileObject[]; error: null; } | { data: null; error: ErpStorageError | null; }>' is not assignable to type 'Promise<ErpStorageResult<null>>'.
    Type '{ data: FileObject[]; error: null; } | { data: null; error: ErpStorageError | null; }' is not assignable to type 'ErpStorageResult<null>'.
      Type '{ data: FileObject[]; error: null; }' is not assignable to type 'ErpStorageResult<null>'.
        Type '{ data: FileObject[]; error: null; }' is not assignable to type '{ data: null; error: null; }'.
          Types of property 'data' are incompatible.
            Type 'FileObject[]' is not assignable to type 'null'.
lib/storage/erp-storage.ts(164,11): error TS2322: Type '(path: string) => Promise<{ data: boolean; error: null; } | { data: boolean; error: StorageError; } | { data: false; error: ErpStorageError; }>' is not assignable to type '(path: string) => Promise<ErpStorageResult<boolean>>'.
  Type 'Promise<{ data: boolean; error: null; } | { data: boolean; error: StorageError; } | { data: false; error: ErpStorageError; }>' is not assignable to type 'Promise<ErpStorageResult<boolean>>'.
    Type '{ data: boolean; error: null; } | { data: boolean; error: StorageError; } | { data: false; error: ErpStorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
      Type '{ data: boolean; error: StorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
        Type '{ data: boolean; error: StorageError; }' is not assignable to type '{ data: boolean; error: null; }'.
          Types of property 'error' are incompatible.
            Type 'StorageError' is not assignable to type 'null'.


**Tool: shell**

**Input:**
```json
{
  "command": "node --test tests/erp-storage.test.mjs 2>&1 | tail -20",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ root storage mengikuti ERP_STORAGE_DIR (0.702512ms)
✔ validasi path menolak traversal, absolut, backslash, NUL, dan bucket tidak valid (0.269107ms)
✔ put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi (7.776676ms)
✔ upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp (1.573097ms)
✔ get/stat untuk path hilang atau tidak valid mengembalikan null (0.360198ms)
✔ removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid (0.79292ms)
✔ driver invalid dan path relatif di produksi ditolak (0.253671ms)
✔ adapter local: upload, download, exists, remove (1.114252ms)
✔ adapter local: konflik upload, path invalid, dan file hilang (0.727ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 125.145695


---

## Assistant

_Thinking:_

Supabase's `.remove` returns data FileObject[] non-null even on error? And `.exists` returns `{data: boolean, error: StorageError}` (data not null on error). Need to normalize in adapter for supabase driver instead of returning directly. Also upload/download? Those apparently narrowed fine. For remove:
```ts
if (driver === "supabase") {
  const result = await supabaseClient(bucket).remove(paths);
  return result.error ? { data: null, error: result.error } : { data: null, error: null };
}
```
For exists:
```ts
if (driver === "supabase") {
  const result = await supabaseClient(bucket).exists(path);
  return result.error ? { data: false, error: result.error } : { data: result.data, error: null };
}
```
And hybrid fallback exists similarly:
```ts
const result = await supabaseClient(bucket).exists(path);
return result.error ? { data:false, error: result.error } : { data: result.data, error:null };
```
Also hybrid remove remote result: we only inspect `.error`; fine.

Let's edit.

**Tool: edit**

**Input:**
```json
{
  "newString": "    async remove(paths) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") {\n        const result = await supabaseClient(bucket).remove(paths);\n        return result.error ? { data: null, error: result.error } : { data: null, error: null };\n      }",
  "oldString": "    async remove(paths) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).remove(paths);",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "    async exists(path) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") {\n        const result = await supabaseClient(bucket).exists(path);\n        return result.error ? { data: false, error: result.error } : { data: result.data, error: null };\n      }",
  "oldString": "    async exists(path) {\n      const driver = storageDriver();\n      if (driver === \"supabase\") return supabaseClient(bucket).exists(path);",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).\n      const result = await supabaseClient(bucket).exists(path);\n      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };\n    },",
  "oldString": "      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).\n      return supabaseClient(bucket).exists(path);\n    },",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

---

## Assistant

**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

lib/storage/erp-storage.ts(167,11): error TS2322: Type '(path: string) => Promise<{ data: boolean; error: null; } | { data: false; error: ErpStorageError; }>' is not assignable to type '(path: string) => Promise<ErpStorageResult<boolean>>'.
  Type 'Promise<{ data: boolean; error: null; } | { data: false; error: ErpStorageError; }>' is not assignable to type 'Promise<ErpStorageResult<boolean>>'.
    Type '{ data: boolean; error: null; } | { data: false; error: ErpStorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
      Type '{ data: false; error: ErpStorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
        Type '{ data: false; error: ErpStorageError; }' is not assignable to type '{ data: boolean; error: null; }'.
          Types of property 'error' are incompatible.
            Type 'ErpStorageError' is not assignable to type 'null'.


---

## Assistant

_Thinking:_

The issue: in failure union, data is `false` not `null`. Our ErpStorageResult failure requires `data: null`. We used `{data:false,error}` for exists. Change to `{data:null,error}`. But call sites might check `exists.data` false and not error? Let's inspect production usage. `const { data: exists } = ...` maybe. If error, data null; fine. Find.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"\\.exists(\" app lib --include='*.ts' --include='*.tsx' | grep -v erp-storage",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

app/actions/production.ts:91:      const snapshot = await storage.exists(originalPath);
app/actions/production.ts:102:        if (copyError && !(await storage.exists(originalPath)).data) {


---

## Assistant

_Thinking:_

At line 102, `(await storage.exists(originalPath)).data` used as boolean; null works. At line 91, inspect surrounding.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '84,116p' app/actions/production.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    const storage = erpStorage(DESIGN_BUCKET);
    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
    if (!attachment.originalPath) {
      const snapshot = await storage.exists(originalPath);
      if (snapshot.error && ![400, 404].includes(snapshot.error.status ?? 0)) {
        console.error("Gagal memeriksa salinan desain awal.", { status: snapshot.error.status, statusCode: snapshot.error.statusCode });
        throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
      }
      if (!snapshot.data) {
        const { data: original, error: originalError } = await storage.download(attachment.path);
        if (originalError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
        const originalBytes = new Uint8Array(await original.arrayBuffer());
        // Jenis gambar disesuaikan agar pratinjau (nosniff) tidak menolak JPEG yang dilabeli PNG.
        const { error: copyError } = await storage.upload(originalPath, originalBytes, { contentType: sniffImageContentType(originalBytes) ?? "image/png", upsert: false });
        if (copyError && !(await storage.exists(originalPath)).data) {
          console.error("Gagal menyimpan salinan desain awal.", { status: copyError.status, statusCode: copyError.statusCode });
          throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
        }
      }
    }
    const { error } = await storage.upload(attachment.path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new UserFacingError("Gambar desain belum dapat disimpan.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { contentType: "image/png", sizeBytes: bytes.length, originalPath, annotations: annotations.data } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_VERSION_SAVED", ["annotations"], { attachmentId: attachment.id });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    revalidatePath("/detail-desain");
    revalidatePath(`/crm/purchase-orders`);
    return flashMessagePath(fallback, "notice", "Versi desain disimpan. Konfirmasikan untuk memasukkannya ke Produksi.");


---

## Assistant

_Thinking:_

Fine. Change failure data to null. In upload/download also failure uses data null already. Update all `data: false` error returns in exists. There are 3: supabase error, invalid path, catch, hybrid. Let's inspect lines around exists.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '160,195p' lib/storage/erp-storage.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

            : remote.error,
        };
      }

      return { data: null, error: null };
    },

    async exists(path) {
      const driver = storageDriver();
      if (driver === "supabase") {
        const result = await supabaseClient(bucket).exists(path);
        return result.error ? { data: false, error: result.error } : { data: result.data, error: null };
      }

      if (!resolveSafe(bucket, path)) return { data: false, error: invalidPathError() };

      try {
        if (await fileExists(bucket, path)) return { data: true, error: null };
      } catch (error) {
        return { data: false, error: toStorageError(error) };
      }

      if (driver === "local") return { data: false, error: null };

      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).
      const result = await supabaseClient(bucket).exists(path);
      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };
    },
  };
}


---

## Assistant

_Thinking:_

Replace error cases with data:null.

**Tool: edit**

**Input:**
```json
{}
```

Connection lost while reading the response: ECONNRESET: The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()

---

## Assistant

_Thinking:_

Continue: fix exists error returns data:null, then tsc. I need to be careful not to repeat content, just proceed.

Edit each of the three error returns:
- supabase error `{ data: false, error: result.error }` → `{ data: null, error: result.error }`
- invalid path `{ data: false, error: invalidPathError() }` → `{ data: null, error: invalidPathError() }`
- catch `{ data: false, error: toStorageError(error) }` → `{ data: null, ... }`
- hybrid fallback result.error same.

Use replaceAll `{ data: false, error:` → `{ data: null, error:` within file? It may affect only exists. Search file for `data: false`.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"data: false\" lib/storage/erp-storage.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

171:        return result.error ? { data: false, error: result.error } : { data: result.data, error: null };
174:      if (!resolveSafe(bucket, path)) return { data: false, error: invalidPathError() };
179:        return { data: false, error: toStorageError(error) };
182:      if (driver === "local") return { data: false, error: null };
186:      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };


---

## Assistant

_Thinking:_

Line 182 local missing is success `{data:false,error:null}`, keep. Replace error ones.

**Tool: edit**

**Input:**
```json
{
  "newString": "        return result.error ? { data: null, error: result.error } : { data: result.data, error: null };",
  "oldString": "        return result.error ? { data: false, error: result.error } : { data: result.data, error: null };",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts",
  "replaceAll": true
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "      if (!resolveSafe(bucket, path)) return { data: null, error: invalidPathError() };",
  "oldString": "      if (!resolveSafe(bucket, path)) return { data: false, error: invalidPathError() };",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "        return { data: null, error: toStorageError(error) };",
  "oldString": "        return { data: false, error: toStorageError(error) };",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

---

## Assistant

_Thinking:_

Our test asserts `invalidExists.data === false`; now null. Update test to assert null and error 400. Also `(await storage.exists(path)).data` false after remove: local missing returns false success, fine. Update the one assertion.

**Tool: edit**

**Input:**
```json
{
  "newString": "  const invalidExists = await storage.exists(\"../keluar.png\");\n  assert.equal(invalidExists.data, null);\n  assert.equal(invalidExists.error?.status, 400);",
  "oldString": "  const invalidExists = await storage.exists(\"../keluar.png\");\n  assert.equal(invalidExists.data, false);\n  assert.equal(invalidExists.error?.status, 400);",
  "path": "/home/haydar/Code/askonveksi/askonveksi/tests/erp-storage.test.mjs"
}
```

Edited tests/erp-storage.test.mjs (1 replacement)

---

## Assistant

**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

lib/storage/erp-storage.ts(167,11): error TS2322: Type '(path: string) => Promise<{ data: boolean; error: null; } | { data: null; error: ErpStorageError; } | { data: false; error: StorageError; }>' is not assignable to type '(path: string) => Promise<ErpStorageResult<boolean>>'.
  Type 'Promise<{ data: boolean; error: null; } | { data: null; error: ErpStorageError; } | { data: false; error: StorageError; }>' is not assignable to type 'Promise<ErpStorageResult<boolean>>'.
    Type '{ data: boolean; error: null; } | { data: null; error: ErpStorageError; } | { data: false; error: StorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
      Type '{ data: false; error: StorageError; }' is not assignable to type 'ErpStorageResult<boolean>'.
        Type '{ data: false; error: StorageError; }' is not assignable to type '{ data: boolean; error: null; }'.
          Types of property 'error' are incompatible.
            Type 'StorageError' is not assignable to type 'null'.


**Tool: shell**

**Input:**
```json
{
  "command": "node --test tests/erp-storage.test.mjs 2>&1 | tail -15",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

✔ put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi (10.999135ms)
✔ upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp (1.556452ms)
✔ get/stat untuk path hilang atau tidak valid mengembalikan null (0.371662ms)
✔ removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid (0.639852ms)
✔ driver invalid dan path relatif di produksi ditolak (0.271057ms)
✔ adapter local: upload, download, exists, remove (1.386831ms)
✔ adapter local: konflik upload, path invalid, dan file hilang (0.762582ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 122.33458


---

## Assistant

_Thinking:_

Still line 167, likely `if (await fileExists(...)) return { data: true, error: null };`? No, error says `{ data:false, error: StorageError }` remains. grep.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"data: false\" lib/storage/erp-storage.ts && sed -n '166,188p' lib/storage/erp-storage.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

182:      if (driver === "local") return { data: false, error: null };
186:      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };

    async exists(path) {
      const driver = storageDriver();
      if (driver === "supabase") {
        const result = await supabaseClient(bucket).exists(path);
        return result.error ? { data: null, error: result.error } : { data: result.data, error: null };
      }

      if (!resolveSafe(bucket, path)) return { data: null, error: invalidPathError() };

      try {
        if (await fileExists(bucket, path)) return { data: true, error: null };
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }

      if (driver === "local") return { data: false, error: null };

      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).
      const result = await supabaseClient(bucket).exists(path);
      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };
    },
  };


---

## Assistant

_Thinking:_

The replaceAll only replaced first occurrence because exact text included `result.error ? ...` twice but maybe both; it said 1 replacement. The hybrid one remains. Fix.

**Tool: edit**

**Input:**
```json
{
  "newString": "      return result.error ? { data: null, error: result.error } : { data: result.data, error: null };",
  "oldString": "      return result.error ? { data: false, error: result.error } : { data: result.data, error: null };",
  "path": "/home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts"
}
```

Edited lib/storage/erp-storage.ts (1 replacement)

---

## Assistant

_Thinking:_

 

**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -80",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(no output)

---

## Assistant

_Thinking:_

Typecheck clean. Now update worker. Need to inspect worker code around K1-K3 and imports/top.

Typecheck bersih. Lanjut ke worker WhatsApp: saya baca bagian K1–K3 dan helper storage yang ada.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '1,80p' worker/whatsapp.mjs && echo \"---K1---\" && sed -n '195,235p' worker/whatsapp.mjs && echo \"---K2---\" && sed -n '245,280p' worker/whatsapp.mjs && echo \"---K3---\" && sed -n '590,640p' worker/whatsapp.mjs",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

import "dotenv/config";

import makeWASocket, { DisconnectReason, downloadMediaMessage, getContentType, useMultiFileAuthState as loadMultiFileAuthState } from "@whiskeysockets/baileys";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
const lockConnectionString = process.env.DIRECT_URL || connectionString;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
// (maxWait 2s / timeout 5s) bisa P2028, jadi anggaran transaksi dinaikkan.
const WORKER_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
// Advisory locks need a session-stable connection; avoid transaction poolers for this client.
const lockClient = new Client({ connectionString: lockConnectionString });
const authRoot = path.resolve(process.env.WHATSAPP_AUTH_PATH || ".data/baileys-auth");
const workerId = process.env.WHATSAPP_WORKER_ID || `worker-${process.pid}`;
const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
const campaignRecipientAllowlist = process.env.BROADCAST_TEST_RECIPIENTS
  ? new Set(process.env.BROADCAST_TEST_RECIPIENTS.split(",").map(normalizeNumber).filter(Boolean))
  : null;
const sessions = new Map();
let stopping = false;
let lastTickAt = 0;
let lastAutomationAt = 0;
let lastInvoiceScanAt = 0;
let lastLagMs = 0;
let ticking = false;

const DEFAULT_INVOICE_ISSUED_TEMPLATE = "Halo {{customer_name}}, invoice {{invoice_no}} dari {{business_name}} sebesar {{invoice_total}} telah diterbitkan. Batas pembayaran: {{invoice_due_date}}. Dokumen invoice terlampir. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_INVOICE_DUE_TEMPLATE = "Halo {{customer_name}}, pengingat pembayaran {{payment_label}} untuk invoice {{invoice_no}} sebesar {{payment_amount}} jatuh tempo pada {{payment_due_date}}. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_ORDER_REMINDER_TEMPLATE = "Halo {{customer_name}}, sudah waktunya meninjau kebutuhan order berikutnya di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.";

const silentLogger = {
  level: "silent",
  child() { return this; },
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
};

const consoleInfo = console.info.bind(console);
const consoleWarn = console.warn.bind(console);
console.info = (...args) => {
  if (args[0] !== "Closing session:" && args[0] !== "Opening session:") consoleInfo(...args);
};
console.warn = (...args) => {
  if (args[0] !== "Session already closed") consoleWarn(...args);
};

function cleanError(error) {
  return error instanceof Error ? error.message.slice(0, 500) : "Kesalahan worker WhatsApp.";
}

function normalizeNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function directJid(value) {
  if (typeof value !== "string") return null;
  const [user, server] = value.split("@");
  if (server === "s.whatsapp.net") {
    const number = normalizeNumber(user);
    return number ? `${number}@s.whatsapp.net` : null;
  }
  return server === "lid" && /^\d+$/.test(user) ? `${user}@lid` : null;
}

function nextSendAt(reference) {
  const jakarta = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
  const parts = [jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate()];
  if (jakarta.getUTCHours() < 9) return new Date(Date.UTC(...parts, 2));
  if (jakarta.getUTCHours() >= 17) return new Date(Date.UTC(parts[0], parts[1], parts[2] + 1, 2));
  return reference;
---K1---
}

async function storeInbound(accountId, message, remoteJid) {
  const customer = await findCustomer(remoteJid);
  const contentType = getContentType(message.message);
  const kind = contentType === "imageMessage" ? "IMAGE" : contentType === "documentMessage" ? "DOCUMENT" : "TEXT";
  let mediaPath = null;
  let mediaMimeType = null;
  let mediaFileName = null;
  let mediaSizeBytes = null;
  if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    const buffer = await downloadMediaMessage(message, "buffer", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });
    // Cap 5MB agar muat di worker 200M (sebelumnya 10MB).
    if (buffer.length <= 5 * 1024 * 1024) {
      const media = kind === "IMAGE" ? message.message.imageMessage : message.message.documentMessage;
      mediaMimeType = media?.mimetype || "application/octet-stream";
      mediaFileName = media?.fileName || `${message.key.id}.${kind === "IMAGE" ? "jpg" : "bin"}`;
      mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
      if (uploaded.error) throw uploaded.error;
      mediaSizeBytes = buffer.length;
    }
  }
  const text = messageText(message) || (kind === "TEXT" ? "Pesan tidak didukung." : null);
  const occurredAt = new Date(Number(message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000);
  await prisma.$transaction(async (tx) => {
    const conversation = await tx.whatsAppConversation.upsert({
      where: { accountId_remoteJid: { accountId, remoteJid } },
      create: { accountId, remoteJid, customerId: customer?.id, unreadCount: 1, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
      update: { customerId: customer?.id || undefined, unreadCount: { increment: 1 }, isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
    });
    const stored = await tx.whatsAppMessage.upsert({
      where: { accountId_whatsappMessageId: { accountId, whatsappMessageId: message.key.id } },
      create: { accountId, conversationId: conversation.id, whatsappMessageId: message.key.id, direction: "INBOUND", kind, status: "DELIVERED", text, mediaPath, mediaMimeType, mediaFileName, mediaSizeBytes, occurredAt },
      update: {},
    });
    if (customer) {
      const authorId = customer.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
      if (authorId) await tx.communicationActivity.upsert({
        where: { whatsappMessageId: stored.id },
---K2---
  if (socket) {
    await socket.logout().catch(() => undefined);
    sessions.delete(account.id);
  }
  await rm(path.join(authRoot, account.id), { recursive: true, force: true });
  const messages = await prisma.whatsAppMessage.findMany({
    where: { accountId: account.id },
    select: { id: true, mediaPath: true },
    orderBy: { id: "asc" },
    take: 500,
  });
  if (messages.length) {
    const paths = [...new Set(messages.map((message) => message.mediaPath).filter(Boolean))];
    if (paths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));
        if (error) console.error(`[whatsapp-worker] delete media ${account.id}: ${cleanError(error)}`);
      }
    }
    await prisma.whatsAppMessage.deleteMany({ where: { id: { in: messages.map((message) => message.id) } } });
    return;
  }
  const conversations = await prisma.whatsAppConversation.findMany({
    where: { accountId: account.id },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 500,
  });
  if (conversations.length) {
    await prisma.whatsAppConversation.deleteMany({ where: { id: { in: conversations.map((conversation) => conversation.id) } } });
    return;
  }
  await prisma.whatsAppAccount.delete({ where: { id: account.id } });
  console.error(`[whatsapp-worker] account ${account.id} deleted`);
}
---K3---
    const socket = account && sessions.get(account.id);
    if (!account || account.status !== "CONNECTED" || !account.sendEnabled || !socket) throw new Error("Nomor WhatsApp aktif sedang offline.");
    const payload = job.payload;
    const customerNumber = normalizeNumber(job.customer?.whatsapp);
    const remoteJid = (job.type === "MANUAL" || job.type === "CAMPAIGN_TEST" ? directJid(job.message?.conversation.remoteJid) || directJid(payload.remoteJid) : null)
      || (customerNumber ? `${customerNumber}@s.whatsapp.net` : null);
    if (!remoteJid) throw new Error("Nomor WhatsApp customer tidak valid.");
    const text = String(payload.text || "").trim();
    const activityContent = text || `[${String(payload.attachment?.kind || payload.attachment?.type || "pesan").toLowerCase()}]`;
    let content = { text };
    if (payload.attachment?.type === "invoice") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const secret = process.env.WHATSAPP_WORKER_SECRET;
      if (!appUrl || !secret) throw new Error("Konfigurasi URL/secret invoice worker belum tersedia.");
      const response = await fetch(`${appUrl}/api/crm/invoice/${payload.attachment.invoiceId}/pdf`, { headers: { authorization: `Bearer ${secret}` } });
      if (!response.ok) throw new Error("PDF invoice gagal diambil.");
      content = { document: Buffer.from(await response.arrayBuffer()), mimetype: "application/pdf", fileName: `invoice-${job.invoiceId}.pdf`, caption: text };
    } else if (payload.attachment?.path) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Konfigurasi Storage worker belum tersedia.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);
      if (downloaded.error) throw downloaded.error;
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      content = payload.attachment.kind === "IMAGE"
        ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }
        : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };
    }
    const preparedAt = new Date();
    const conversation = await prisma.whatsAppConversation.upsert({ where: { accountId_remoteJid: { accountId: account.id, remoteJid } }, create: { accountId: account.id, remoteJid, ...(job.customerId ? { customerId: job.customerId } : {}) }, update: job.customerId ? { customerId: job.customerId } : {} });
    const preparedMessage = job.message
      ? await prisma.whatsAppMessage.update({ where: { id: job.message.id }, data: { accountId: account.id, conversationId: conversation.id, status: "SENDING", errorMessage: null, failedAt: null } })
      : await prisma.whatsAppMessage.create({ data: { accountId: account.id, conversationId: conversation.id, direction: "OUTBOUND", status: "SENDING", kind: payload.attachment ? "DOCUMENT" : "TEXT", text, mediaFileName: payload.attachment?.type === "invoice" ? `invoice-${job.invoiceId}.pdf` : payload.attachment?.fileName ?? null, mediaMimeType: payload.attachment?.type === "invoice" ? "application/pdf" : payload.attachment?.mimeType ?? null, sentById: typeof payload.sentById === "string" ? payload.sentById : null, automationJobId: job.id, occurredAt: preparedAt } });
    await prisma.whatsAppAutomationJob.update({ where: { id: job.id }, data: { accountId: account.id } });
    sendStarted = true;
    const sent = await socket.sendMessage(remoteJid, content);
    consoleInfo(`[whatsapp-worker] job ${job.id} sent to ${remoteJid}`);
    const occurredAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({ where: { id: conversation.id }, data: { isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: activityContent.slice(0, 240) } });
      const message = await tx.whatsAppMessage.update({ where: { id: preparedMessage.id }, data: { whatsappMessageId: sent.key.id, status: "SENT", sentAt: occurredAt, occurredAt } });
      const authorId = message.sentById || job.customer?.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
      if (authorId && job.customerId) await tx.communicationActivity.upsert({ where: { whatsappMessageId: message.id }, create: { customerId: job.customerId, opportunityId: job.opportunityId, authorId, kind: "COMMUNICATION", channel: "WHATSAPP", direction: "OUTBOUND", content: activityContent, occurredAt, whatsappMessageId: message.id }, update: {} });
      await tx.whatsAppAutomationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", accountId: account.id, completedAt: occurredAt, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      if (job.type === "REACTIVATION" && job.reminderId) {
        const reminder = await tx.customerReminder.findUnique({ where: { id: job.reminderId }, select: { generation: true, nextOccurrence: true, sourceSalesOrder: { select: { acceptedAt: true } } } });
        if (reminder) {
          const settings = await tx.businessProfile.findUnique({ where: { id: "default" }, select: { repeatOrderIntervals: true } });
          const intervals = settings?.repeatOrderIntervals || [6, 5];
          let occurrence = reminder.nextOccurrence + 1;
          let dueAt = repeatOrderDueAt(reminder.sourceSalesOrder.acceptedAt, intervals, occurrence);
          while (dueAt <= occurredAt) dueAt = repeatOrderDueAt(reminder.sourceSalesOrder.acceptedAt, intervals, ++occurrence);


**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"mediaBucket\\|SUPABASE\\|storage\\|createClient\" worker/whatsapp.mjs",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

10:import { createClient } from "@supabase/supabase-js";
24:const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
205:  if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
213:      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
214:      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
258:    if (paths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
259:      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
261:        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));
608:      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Konfigurasi Storage worker belum tersedia.");
609:      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
610:      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);


---

## Assistant

_Thinking:_

Implement worker helpers. Need to import local-store, and handle `storageDriver()` possibly invalid. Add:

```js
import { contentTypeFromPath, getFile, putFile, removeFiles, resolveSafe, storageDriver } from "../lib/storage/local-store.mjs";
```

Note worker is ESM under package without type module, but `.mjs` is ESM; it imports `.mjs` fine.

Helpers after mediaBucket:

```js
const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const driver = () => storageDriver();
function mediaStorageReady() {
  const d = storageDriver();
  if (d === "local") return true;
  return supabaseConfigured();
}
function supabaseStorage() {
  return createClient(...).storage.from(mediaBucket);
}
async function storeInboundMedia(path, buffer, contentType) {
  const d = storageDriver();
  if (d !== "supabase") {
    await putFile(mediaBucket, path, buffer, { upsert: false });
  }
  if (d !== "local") {
    if (!supabaseConfigured()) throw new Error("Konfigurasi Supabase Storage worker belum tersedia.");
    const uploaded = await supabaseStorage().upload(path, buffer, { contentType, upsert: false });
    if (uploaded.error) {
      if (d === "hybrid") await removeFiles(mediaBucket, [path]);
      throw uploaded.error;
    }
  }
}
async function readMedia(path) {
  const d = storageDriver();
  if (d !== "supabase") {
    if (!resolveSafe(mediaBucket, path)) throw new Error("Path media tidak valid.");
    const buffer = await getFile(mediaBucket, path);
    if (buffer) return buffer;
    if (d === "local") throw new Error("Lampiran tidak ditemukan.");
  }
  if (!supabaseConfigured()) throw new Error("Konfigurasi Supabase Storage worker belum tersedia.");
  const downloaded = await supabaseStorage().download(path);
  if (downloaded.error || !downloaded.data) throw downloaded.error || new Error("Lampiran tidak ditemukan.");
  return Buffer.from(await downloaded.data.arrayBuffer());
}
async function deleteMedia(paths) {
  if (!paths.length) return;
  const d = storageDriver();
  if (d !== "supabase") {
    const { failed } = await removeFiles(mediaBucket, paths);
    for (const item of failed) console.error(`[whatsapp-worker] delete media lokal ${item.path}: ${item.message}`);
  }
  if (d === "local") return;
  if (!supabaseConfigured()) {
    console.error("[whatsapp-worker] Supabase Storage belum dikonfigurasi; media Supabase tidak dihapus.");
    return;
  }
  const supabase = supabaseStorage();
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.remove(paths.slice(index, index + 100));
    if (error) console.error(`[whatsapp-worker] delete media: ${cleanError(error)}`);
  }
}
```

But `cleanError` defined after helpers? Function declarations hoist, fine. `mediaBucket` const defined before helpers. Good.

K1: `if (kind !== "TEXT" && mediaStorageReady())` and replace upload block with `await storeInboundMedia(mediaPath, buffer, mediaMimeType);`.

If hybrid but no Supabase creds, mediaStorageReady false; skip storing, same as before. If local, true. If invalid driver, storageDriver throws at call, worker crash (fine, misconfig).

K2: replace if block with `await deleteMedia(paths);` But note deleteMedia logs error with no account id. Could pass context? Simpler: `await deleteMedia(paths);`. Remove `createClient` block.

K3: replace env guard + client with `const buffer = await readMedia(payload.attachment.path);`.

Also remove `createClient` import? Still used by helpers (supabaseStorage). Yes.

Potential issue: `readMedia` returns Buffer but `getFile` returns Buffer. Fine.

`resolveSafe` import only for path validation in readMedia. For hybrid missing local and invalid path, throw. Good.

Now apply edits.

**Tool: edit**

**Input:**
```json
{
  "newString": "import { Client } from \"pg\";\nimport { createClient } from \"@supabase/supabase-js\";\nimport { getFile, putFile, removeFiles, resolveSafe, storageDriver } from \"../lib/storage/local-store.mjs\";",
  "oldString": "import { Client } from \"pg\";\nimport { createClient } from \"@supabase/supabase-js\";",
  "path": "/home/haydar/Code/askonveksi/askonveksi/worker/whatsapp.mjs"
}
```

Edited worker/whatsapp.mjs (1 replacement)

---

## Assistant

**Tool: edit**

**Input:**
```json
{
  "newString": "const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\";\n\nconst supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);\nconst mediaStorageReady = () => storageDriver() === \"local\" || supabaseConfigured();\n\nfunction supabaseMedia() {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n  const key = process.env.SUPABASE_SECRET_KEY;\n  if (!url || !key) throw new Error(\"Konfigurasi Supabase Storage worker belum tersedia.\");\n  return createClient(url, key, { auth: { persistSession: false } }).storage.from(mediaBucket);\n}\n\n/** Tulis media ke driver aktif. Hybrid wajib sukses di VPS dan Supabase. */\nasync function storeWorkerMedia(mediaPath, buffer, contentType) {\n  const driver = storageDriver();\n  if (driver !== \"supabase\") await putFile(mediaBucket, mediaPath, buffer, { upsert: false });\n  if (driver === \"local\") return;\n\n  const uploaded = await supabaseMedia().upload(mediaPath, buffer, { contentType, upsert: false });\n  if (!uploaded.error) return;\n  if (driver === \"hybrid\") await removeFiles(mediaBucket, [mediaPath]);\n  throw uploaded.error;\n}\n\n/** Baca media dari VPS lebih dulu; hybrid jatuh ke Supabase untuk file lama. */\nasync function readWorkerMedia(mediaPath) {\n  const driver = storageDriver();\n  if (driver !== \"supabase\") {\n    if (!resolveSafe(mediaBucket, mediaPath)) throw new Error(\"Path media tidak valid.\");\n    const buffer = await getFile(mediaBucket, mediaPath);\n    if (buffer) return buffer;\n    if (driver === \"local\") throw new Error(\"Lampiran tidak ditemukan.\");\n  }\n  const downloaded = await supabaseMedia().download(mediaPath);\n  if (downloaded.error || !downloaded.data) throw downloaded.error || new Error(\"Lampiran tidak ditemukan.\");\n  return Buffer.from(await downloaded.data.arrayBuffer());\n}\n\nasync function deleteWorkerMedia(paths) {\n  if (!paths.length) return;\n  const driver = storageDriver();\n  if (driver !== \"supabase\") {\n    const { failed } = await removeFiles(mediaBucket, paths);\n    for (const item of failed) console.error(`[whatsapp-worker] delete media lokal ${item.path}: ${item.message}`);\n  }\n  if (driver === \"local\") return;\n  if (!supabaseConfigured()) {\n    console.error(\"[whatsapp-worker] Supabase Storage belum dikonfigurasi; media Supabase tidak dihapus.\");\n    return;\n  }\n  const storage = supabaseMedia();\n  for (let index = 0; index < paths.length; index += 100) {\n    const { error } = await storage.remove(paths.slice(index, index + 100));\n    if (error) console.error(`[whatsapp-worker] delete media: ${cleanError(error)}`);\n  }\n}",
  "oldString": "const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || \"whatsapp-media\";",
  "path": "/home/haydar/Code/askonveksi/askonveksi/worker/whatsapp.mjs"
}
```

Edited worker/whatsapp.mjs (1 replacement)

---

## Assistant

_Thinking:_

Now K1, K2, K3.

**Tool: edit**

**Input:**
```json
{
  "newString": "  if (kind !== \"TEXT\" && mediaStorageReady()) {\n    const buffer = await downloadMediaMessage(message, \"buffer\", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });\n    // Cap 5MB agar muat di worker 200M (sebelumnya 10MB).\n    if (buffer.length <= 5 * 1024 * 1024) {\n      const media = kind === \"IMAGE\" ? message.message.imageMessage : message.message.documentMessage;\n      mediaMimeType = media?.mimetype || \"application/octet-stream\";\n      mediaFileName = media?.fileName || `${message.key.id}.${kind === \"IMAGE\" ? \"jpg\" : \"bin\"}`;\n      mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;\n      await storeWorkerMedia(mediaPath, buffer, mediaMimeType);\n      mediaSizeBytes = buffer.length;\n    }\n  }",
  "oldString": "  if (kind !== \"TEXT\" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {\n    const buffer = await downloadMediaMessage(message, \"buffer\", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });\n    // Cap 5MB agar muat di worker 200M (sebelumnya 10MB).\n    if (buffer.length <= 5 * 1024 * 1024) {\n      const media = kind === \"IMAGE\" ? message.message.imageMessage : message.message.documentMessage;\n      mediaMimeType = media?.mimetype || \"application/octet-stream\";\n      mediaFileName = media?.fileName || `${message.key.id}.${kind === \"IMAGE\" ? \"jpg\" : \"bin\"}`;\n      mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;\n      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });\n      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });\n      if (uploaded.error) throw uploaded.error;\n      mediaSizeBytes = buffer.length;\n    }\n  }",
  "path": "/home/haydar/Code/askonveksi/askonveksi/worker/whatsapp.mjs"
}
```

Edited worker/whatsapp.mjs (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "  if (messages.length) {\n    const paths = [...new Set(messages.map((message) => message.mediaPath).filter(Boolean))];\n    if (paths.length) await deleteWorkerMedia(paths);\n    await prisma.whatsAppMessage.deleteMany({ where: { id: { in: messages.map((message) => message.id) } } });\n    return;\n  }",
  "oldString": "  if (messages.length) {\n    const paths = [...new Set(messages.map((message) => message.mediaPath).filter(Boolean))];\n    if (paths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {\n      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });\n      for (let index = 0; index < paths.length; index += 100) {\n        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));\n        if (error) console.error(`[whatsapp-worker] delete media ${account.id}: ${cleanError(error)}`);\n      }\n    }\n    await prisma.whatsAppMessage.deleteMany({ where: { id: { in: messages.map((message) => message.id) } } });\n    return;\n  }",
  "path": "/home/haydar/Code/askonveksi/askonveksi/worker/whatsapp.mjs"
}
```

Edited worker/whatsapp.mjs (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "    } else if (payload.attachment?.path) {\n      const buffer = await readWorkerMedia(payload.attachment.path);\n      content = payload.attachment.kind === \"IMAGE\"\n        ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }\n        : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };\n    }",
  "oldString": "    } else if (payload.attachment?.path) {\n      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error(\"Konfigurasi Storage worker belum tersedia.\");\n      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });\n      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);\n      if (downloaded.error) throw downloaded.error;\n      const buffer = Buffer.from(await downloaded.data.arrayBuffer());\n      content = payload.attachment.kind === \"IMAGE\"\n        ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }\n        : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };\n    }",
  "path": "/home/haydar/Code/askonveksi/askonveksi/worker/whatsapp.mjs"
}
```

Edited worker/whatsapp.mjs (1 replacement)

---

## Assistant

_Thinking:_

Check worker for remaining direct storage / createClient usage, syntax check.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"storage.from\\|createClient\\|SUPABASE_SECRET_KEY\" worker/whatsapp.mjs && node --check worker/whatsapp.mjs",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

10:import { createClient } from "@supabase/supabase-js";
27:const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
32:  const key = process.env.SUPABASE_SECRET_KEY;
34:  return createClient(url, key, { auth: { persistSession: false } }).storage.from(mediaBucket);


**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"createAdminClient().storage\\|storage.from(\" app lib --include='*.ts' --include='*.tsx' | grep -v 'lib/storage/erp-storage.ts' || true",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(no output)

---

## Assistant

_Thinking:_

Worker syntax check passed (no output). Good.

Now update tests assertions. Check `tests/crm-validation.test.mjs` L1071 and `tests/business-profile.test.mjs` L67.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n -C 4 \"erpStorage\\|BUCKET\\|createAdminClient\" tests/crm-validation.test.mjs | sed -n '1,80p'; echo \"---\"; grep -n -C 4 \"BUSINESS_ASSETS_BUCKET\\|business-assets\" tests/business-profile.test.mjs | sed -n '1,80p'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

1067-  assert.match(storageScript, /public: false/);
1068-  assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
1069-  assert.match(sql, /REVOKE ALL ON TABLE "PurchaseOrder"[\s\S]+FROM anon, authenticated/);
1070-  // Halaman persetujuan desain dihapus: unggahan langsung menjadi acuan produksi.
1071:  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
1072-  assert.match(designActionSource, /storage\.upload\(attachment\.path/);
1073-  assert.doesNotMatch(designActionSource, /reviewDesignRevisionAction|APPROVED/);
1074-  const productionActionSource = await readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8");
1075-  assert.doesNotMatch(productionActionSource, /status: "APPROVED"/);
--
1623-  // Action tidak redirect: sukses/gagal dikembalikan sebagai state form.
1624-  assert.match(actionSource, /export async function recordPurchaseOrderDepositAction\(_prevState: CrmActionState, formData: FormData\): Promise<CrmActionState>/);
1625-  // Route bukti deposit membaca PurchaseOrderDeposit dari bucket pembayaran yang sama.
1626-  assert.match(routeSource, /purchaseOrderDeposit\.findUnique/);
1627:  assert.match(routeSource, /PAYMENT_PROOF_BUCKET/);
1628-  assert.match(routeSource, /CRM_VIEW_ROLES/);
1629-  // Detail PO menampilkan pratinjau bukti + mime type ikut ditransfer ke client.
1630-  assert.match(detailSource, /deposit\/proof/);
1631-  assert.match(detailSource, /PaymentProofPreview/);
---
63-  assert.match(helper, /2 \* 1024 \* 1024/, "batas 2 MB ikut diterapkan ke gambar tanda tangan");
64-  assert.match(helper, /0x89, 0x50, 0x4e, 0x47/, "magic bytes PNG diperiksa");
65-  assert.match(pageSource, /name="signature" type="file"/);
66-  assert.match(pageSource, /api\/master-data\/business-profile\/signature/);
67:  assert.match(signatureRouteSource, /business-assets/);
68-});
69-
70-test("snapshot invoice menyimpan gambar tanda tangan dan tidak lagi menulis rekening", () => {
71-  assert.equal(crmActionSource.match(/snapshotSignaturePath: business\?\.signaturePath/g)?.length, 2, "dipakai saat invoice dibuat dan dikunci");


---

## Assistant

_Thinking:_

Line 1071 expects `/storage\.from\(BUCKET\)/`; after port it is `erpStorage(BUCKET)`. Update to `erpStorage\(BUCKET\)`. Line 1072 expects `storage.upload` still exists (yes, storage = erpStorage). Good.

Business-profile line 67 expects `/business-assets/` in signature route; now route uses constant `BUSINESS_ASSETS_BUCKET` and import, no literal. Update to `BUSINESS_ASSETS_BUCKET`. But does route still import PAYMENT? Let's check signature route now. It imports constant; yes. Update.

Also search tests for other references that may break: `crm-po-designs` in route source, `createAdminClient`, `storage.from`. Let's grep tests.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"storage\\\\\\\\.from\\|storage\\.from\\|createAdminClient\\|business-assets\\|crm-po-designs\\|PAYMENT_PROOF_BUCKET\" tests/*.test.mjs | head -80",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

tests/business-profile.test.mjs:67:  assert.match(signatureRouteSource, /business-assets/);
tests/crm-validation.test.mjs:1066:  assert.match(storageScript, /crm-po-designs/);
tests/crm-validation.test.mjs:1071:  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
tests/crm-validation.test.mjs:1627:  assert.match(routeSource, /PAYMENT_PROOF_BUCKET/);
tests/erp-storage.test.mjs:26:const BUCKET = "crm-po-designs";


---

## Assistant

_Thinking:_

Update two.

**Tool: edit**

**Input:**
```json
{}
```

Connection lost while reading the response: ECONNRESET: The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()

---

## Assistant

_Thinking:_

Continue. Need to edit two test assertions.

**Tool: edit**

**Input:**
```json
{
  "newString": "  assert.match(designActionSource, /erpStorage\\(BUCKET\\)/);",
  "oldString": "  assert.match(designActionSource, /storage\\.from\\(BUCKET\\)/);",
  "path": "/home/haydar/Code/askonveksi/askonveksi/tests/crm-validation.test.mjs"
}
```

Edited tests/crm-validation.test.mjs (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "  assert.match(signatureRouteSource, /BUSINESS_ASSETS_BUCKET/);",
  "oldString": "  assert.match(signatureRouteSource, /business-assets/);",
  "path": "/home/haydar/Code/askonveksi/askonveksi/tests/business-profile.test.mjs"
}
```

Edited tests/business-profile.test.mjs (1 replacement)

---

## Assistant

_Thinking:_

Now deploy workflow, env example, package scripts, docs. Let's inspect deploy workflow and .env.example, README relevant.

Sekarang deploy, env, dan dokumentasi. Saya baca workflow serta env contoh agar perubahannya presisi.

**Tool: shell**

**Input:**
```json
{
  "command": "cat .github/workflows/deploy.yml",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

name: Deploy to VPS

on:
  push:
    branches: [production]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: production-deploy
  cancel-in-progress: false

env:
  NODE_VERSION: '24'
  KEEP_RELEASES: 5

jobs:
  build:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit production dependencies
        run: npm audit --omit=dev --audit-level=high

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm run test --if-present -- --ci

      - name: Build standalone release
        env:
          NODE_ENV: production
          NEXT_TELEMETRY_DISABLED: '1'
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${{ secrets.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY }}
        run: npm run build

      - name: Verify standalone output
        run: |
          test -d .next/standalone
          test -d .next/static
          test -f .next/standalone/server.js

      - name: Package release
        run: |
          mkdir -p deploy_package/.next deploy_package/worker
          cp -r .next/standalone/. deploy_package/
          cp -r .next/static deploy_package/.next/static
          if [ -d public ]; then cp -aT public deploy_package/public; fi
          cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs
          # Worker deps missing from the standalone trace (dotenv, baileys,
          # supabase + transitive). Copied from this same npm-ci tree so
          # versions stay identical; skips what standalone already ships.
          node scripts/collect-worker-deps.mjs deploy_package
          tar -czf release.tar.gz -C deploy_package .
          tar -tzf release.tar.gz | grep -qx './server.js'
          tar -tzf release.tar.gz | grep -qx './worker/whatsapp.mjs'
          # File-level checks: standalone dirs may be pruned, so a present
          # directory proves nothing. Fail the build here, not on the VPS.
          for f in node_modules/dotenv/package.json node_modules/@whiskeysockets/baileys/package.json node_modules/@supabase/supabase-js/package.json node_modules/ws/wrapper.mjs node_modules/pg/esm/index.mjs node_modules/pg-pool/index.js node_modules/postgres-array/index.js node_modules/.prisma/client/default.js node_modules/@prisma/client/default.js; do
            tar -tzf release.tar.gz | grep -q "^\./$f$" || { echo "Worker file missing in tarball: $f"; exit 1; }
          done

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: release
          path: release.tar.gz
          retention-days: 3

  migrate:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Apply Prisma migrations
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: npm exec prisma migrate deploy

  deploy:
    needs: migrate
    runs-on: ubuntu-latest
    environment: production
    env:
      DEPLOY_PATH: ${{ vars.DEPLOY_PATH }}
      PM2_APP_NAME: ${{ vars.PM2_APP_NAME }}
      APP_PORT: ${{ vars.APP_PORT }}
      VPS_HOST: ${{ vars.VPS_HOST }}
      VPS_USER: ${{ vars.VPS_USER }}
      VPS_PORT: ${{ vars.VPS_PORT || '22' }}
    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: release

      - name: Configure SSH
        env:
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
          VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
        run: |
          install -d -m 700 ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_ed25519
          printf '%s\n' "$VPS_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts

      - name: Set release name
        id: release
        run: echo "name=${GITHUB_SHA::12}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" >> "$GITHUB_OUTPUT"

      - name: Upload release archive
        env:
          RELEASE: ${{ steps.release.outputs.name }}
        run: |
          scp -i ~/.ssh/id_ed25519 -P "$VPS_PORT" \
            -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
            release.tar.gz "$VPS_USER@$VPS_HOST:/tmp/askonveksi-release-$RELEASE.tar.gz"

      - name: Deploy, verify, and roll back on failure
        env:
          RELEASE: ${{ steps.release.outputs.name }}
        run: |
          DEPLOY_PATH_B64=$(printf '%s' "$DEPLOY_PATH" | base64 -w0)
          PM2_APP_NAME_B64=$(printf '%s' "$PM2_APP_NAME" | base64 -w0)
          APP_PORT_B64=$(printf '%s' "$APP_PORT" | base64 -w0)
          RELEASE_B64=$(printf '%s' "$RELEASE" | base64 -w0)
          KEEP_RELEASES_B64=$(printf '%s' "$KEEP_RELEASES" | base64 -w0)
          ssh -i ~/.ssh/id_ed25519 -p "$VPS_PORT" \
            -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
            "$VPS_USER@$VPS_HOST" \
            "DEPLOY_PATH_B64=$DEPLOY_PATH_B64 PM2_APP_NAME_B64=$PM2_APP_NAME_B64 APP_PORT_B64=$APP_PORT_B64 RELEASE_B64=$RELEASE_B64 KEEP_RELEASES_B64=$KEEP_RELEASES_B64 bash -s" <<'ENDSSH'
          set -euo pipefail

          decode() { printf '%s' "$1" | base64 --decode; }
          DEPLOY_PATH=$(decode "$DEPLOY_PATH_B64")
          PM2_APP_NAME=$(decode "$PM2_APP_NAME_B64")
          APP_PORT=$(decode "$APP_PORT_B64")
          RELEASE=$(decode "$RELEASE_B64")
          KEEP_RELEASES=$(decode "$KEEP_RELEASES_B64")

          [[ "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_PATH" != / ]] || { echo 'DEPLOY_PATH must be an absolute non-root path.'; exit 1; }
          [[ "$PM2_APP_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'PM2_APP_NAME contains invalid characters.'; exit 1; }
          [[ "$APP_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && (( APP_PORT <= 65535 )) || { echo 'APP_PORT must be valid.'; exit 1; }
          [[ "$RELEASE" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'RELEASE contains invalid characters.'; exit 1; }
          [[ "$KEEP_RELEASES" =~ ^[1-9][0-9]*$ ]] || { echo 'KEEP_RELEASES must be a positive integer.'; exit 1; }

          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          command -v pm2 >/dev/null || { echo 'PM2 is not available for the deploy user.'; exit 1; }
          command -v curl >/dev/null || { echo 'curl is not available for the deploy user.'; exit 1; }

          RELEASE_DIR="$DEPLOY_PATH/releases/$RELEASE"
          CURRENT_LINK="$DEPLOY_PATH/current"
          ARCHIVE="/tmp/askonveksi-release-$RELEASE.tar.gz"
          PREVIOUS_RELEASE=""
          if [ -L "$CURRENT_LINK" ]; then
            PREVIOUS_RELEASE=$(readlink -f "$CURRENT_LINK")
          fi

          install -d "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared"
          test -w "$DEPLOY_PATH" || { echo 'DEPLOY_PATH is not writable by the deploy user.'; exit 1; }
          test -f "$DEPLOY_PATH/shared/.env" || { echo 'Shared runtime .env is missing.'; exit 1; }
          test -f "$ARCHIVE" || { echo 'Release archive is missing.'; exit 1; }
          test ! -e "$RELEASE_DIR" || { echo 'Release directory already exists.'; exit 1; }
          mkdir "$RELEASE_DIR"
          tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
          rm -f "$ARCHIVE"
          ln -sfn "$DEPLOY_PATH/shared/.env" "$RELEASE_DIR/.env"
          # Persist Baileys auth across releases (WA session survives rollback/deploy).
          install -d "$DEPLOY_PATH/shared/.data/baileys-auth"
          ln -sfn "$DEPLOY_PATH/shared/.data" "$RELEASE_DIR/.data"

          ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
          export NODE_ENV=production PORT="$APP_PORT" HOSTNAME=127.0.0.1
          WA_PORT="$(grep -E '^WHATSAPP_HEALTH_PORT=' "$DEPLOY_PATH/shared/.env" 2>/dev/null | cut -d= -f2 | tr -d ' "' || true)"
          WA_PORT="${WA_PORT:-3001}"
          WA_APP_NAME="${PM2_APP_NAME}-wa"

          start_pm2() {
            pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
            pm2 start "$CURRENT_LINK/server.js" --name "$PM2_APP_NAME" --cwd "$CURRENT_LINK" --time --kill-timeout 10000 \
              --max-memory-restart 600M --node-args="--max-old-space-size=600"
          }

          start_wa() {
            # Worker deps ship inside the release (see Package step); the
            # dotenv check below proves the closure is complete.
            if [ ! -f "$CURRENT_LINK/worker/whatsapp.mjs" ]; then echo 'WA worker file missing, skipping.'; return 0; fi
            if [ ! -d "$CURRENT_LINK/node_modules/dotenv" ]; then echo 'Worker deps missing in release, skipping WA worker.'; return 0; fi
            pm2 delete "$WA_APP_NAME" >/dev/null 2>&1 || true
            # Cap 300M: baseline worker ~180MB; 200M membunuh tiap menit.
            # Cron 03:00 WIB: restart terjadwal sebagai backstop bocor memori
            # (wajib di sini, bukan manual — deploy me-recreate proses PM2).
            WHATSAPP_HEALTH_PORT="$WA_PORT" pm2 start "$CURRENT_LINK/worker/whatsapp.mjs" --name "$WA_APP_NAME" --cwd "$CURRENT_LINK" --time --kill-timeout 10000 \
              --max-memory-restart 300M --node-args="--max-old-space-size=280" \
              --exp-backoff-restart-delay=5000 --cron "0 3 * * *" || echo 'WA worker failed to start, continuing without it.'
          }

          start_pm2
          start_wa

          healthy=0
          for _ in $(seq 1 15); do
            if curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT" -o /dev/null; then
              healthy=1
              break
            fi
            sleep 2
          done

          if curl -fsS --max-time 5 "http://127.0.0.1:$WA_PORT/health" -o /dev/null 2>/dev/null; then
            echo 'WA worker healthy.'
          else
            echo 'WA worker not healthy (optional, deploy continues).'
          fi

          if [ "$healthy" -ne 1 ]; then
            echo 'Health check failed, rolling back.'
            if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
              ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
              start_pm2
              start_wa
              pm2 save
            else
              pm2 delete "$PM2_APP_NAME" || true
              rm -f "$CURRENT_LINK"
            fi
            exit 1
          fi

          pm2 save
          find "$DEPLOY_PATH/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
            | sort -rn \
            | tail -n +$((KEEP_RELEASES + 1)) \
            | cut -d' ' -f2- \
            | xargs -r rm -rf --
          ENDSSH


**Tool: shell**

**Input:**
```json
{
  "command": "cat .env.example && echo \"---README storage mentions---\" && grep -n -i \"storage\\|supabase\\|whatsapp-media\\|payment-proof\\|business-assets\\|crm-po-designs\" README.md | head -60",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

# Connect to Postgres via the shared transaction-mode pooler (IPv4-only)
DATABASE_URL=postgresql://user:password@host:5432/
# Connect to Postgres via the shared session-mode pooler (used for migrations)
DIRECT_URL=postgresql://user:password@host:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_key
BOOTSTRAP_OWNER_NAME=Nama Owner
BOOTSTRAP_OWNER_EMAIL=owner@example.com
BOOTSTRAP_OWNER_PASSWORD=
ALLOW_DEMO_DATA=false
PUBLIC_LEAD_RATE_LIMIT_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Token dari metode verifikasi tag HTML di Google Search Console
GOOGLE_SITE_VERIFICATION=
WHATSAPP_AUTH_PATH=.data/baileys-auth
WHATSAPP_TIMEZONE=Asia/Jakarta
WHATSAPP_WORKER_ID=worker-1
WHATSAPP_WORKER_SECRET=replace-with-at-least-32-random-characters
WHATSAPP_HEALTH_PORT=3001
WHATSAPP_MEDIA_BUCKET=whatsapp-media
# CMS website: simpan di volume persisten (bukan di dalam folder build)
CMS_DATA_DIR=/var/lib/askonveksi/cms
CMS_UPLOAD_DIR=/var/lib/askonveksi/uploads
# Opsional: lokasi cadangan harian (default ./data/backups)
CMS_BACKUP_DIR=/var/lib/askonveksi/backups
# Absensi: foto kamera disimpan di filesystem VPS, bukan Supabase Storage.
# Lokal default ./data/attendance. Produksi: gunakan volume persisten di luar folder build/release.
ATTENDANCE_UPLOAD_DIR=./data/attendance
---README storage mentions---
3:Aplikasi operasional internal berbasis Next.js 16, Prisma, PostgreSQL Supabase, dan Supabase Auth. Implementasi saat ini mencakup CRM pipeline, customer, revisi Purchase Order dan invoice, pencatatan DP/lunas, Sales Order immutable, absensi pegawai berbasis kamera, RBAC, serta audit log.
7:1. Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi Supabase/database.
8:2. Isi `DIRECT_URL` dengan direct connection atau Supavisor session mode. Untuk migration reset CRM 2026-09-02, siapkan storage melalui Storage API, lalu terapkan migration dan buat Prisma Client. Perintah storage mengosongkan serta menghapus bucket bukti persetujuan lama secara permanen.
14:rtk npm run crm:reset-storage
16:rtk npm run crm:setup-storage
42:- Supabase SDK hanya menangani Auth dan cookie session.
57:rtk node --test tests/attendance-time.test.mjs tests/attendance-report.test.mjs tests/attendance-validation.test.mjs tests/attendance-storage.test.mjs


---

## Assistant

_Thinking:_

Need update deploy.yml package step to copy lib/storage/local-store.mjs and verify. Also .env.example add ERP vars. Package scripts add migration/backup? Plan calls for scripts. Let's check FILE_TO_VPS.md for exact env/scripts/docs expectations. We should read relevant sections to ensure implementation aligns.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n -i \"ERP_STORAGE\\|deploy_package\\|local-store\\|migrasi\\|backup\\|scripts/\\|PANDUAN\\|package.json\\|\\.env\" FILE_TO_VPS.md | head -120",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

1:# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS
16:| Biner (gambar, PDF) | **Disk VPS** (`ERP_STORAGE_DIR`) | byte PNG desain, PDF bukti bayar, WebP logo, media WhatsApp |
27:           └──────── ERP_STORAGE_DIR ────────┘└── bucket ──┘└──── nilai kolom DB ────┘
30:Nama bucket tidak disimpan di DB karena sudah tersirat oleh tabel/kolom pemiliknya. Contoh ilustrasi `vps/public/desain/desain1.jpg` **tidak** dipakai: menambahkan prefix semacam itu berarti menulis ulang seluruh path lama dan memecahkan kompatibilitas. Yang benar adalah path relatif tetap seperti sekarang; lokasi fisik diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path DB.
53:4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release.
55:6. **Runbook migrasi diperbaiki**: `npm ci --omit=dev` tidak dipakai (dotenv dan Prisma CLI ada di devDependencies); migrasi dijalankan sebagai user aplikasi agar file tidak menjadi milik `root`.
56:7. **Default `.env.example` lokal** (`./data/erp-storage`), nilai produksi hanya di dokumentasi.
69:2. Semua kolom DB berisi path relatif, bukan URL. Struktur path dipertahankan 1:1 di bawah `<ERP_STORAGE_DIR>/<nama-bucket>/`.
74:| `ERP_STORAGE_DRIVER` | Tulis | Baca | Pemakaian |
88:Disiapkan oleh `scripts/setup-crm-storage.mjs` dan diverifikasi ulang:
97:`quotation-acceptance-proofs` sudah retired (dihapus `scripts/reset-crm-storage.mjs`) — tidak ikut migrasi.
139:**Batasan deployment:** `deploy.yml` hanya menyalin satu file worker (`cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs`). Jika worker memakai modul bersama, file modul itu **wajib** ikut di Package step + verifikasi tarball, kalau tidak worker crash di produksi (`ERR_MODULE_NOT_FOUND`).
152:- `tests/crm-validation.test.mjs` ~L1066 (`storageScript` = `scripts/reset-crm-storage.mjs`) — script itu tidak berubah, jadi tidak patah.
167:/var/lib/askonveksi/storage/            # ERP_STORAGE_DIR (volume persisten, di luar releases/)
184:- Jangan pernah menaruh `ERP_STORAGE_DIR` di dalam folder release (`$DEPLOY_PATH/releases/...`), karena release lama dipangkas otomatis.
189:# .env.example (nilai lokal; produksi diisi di $DEPLOY_PATH/shared/.env)
190:ERP_STORAGE_DIR=./data/erp-storage
191:ERP_STORAGE_DRIVER=supabase
197:ERP_STORAGE_DIR=/var/lib/askonveksi/storage
198:ERP_STORAGE_DRIVER=hybrid        # lalu local setelah grace period
201:Aturan validasi (dijalankan `lib/storage/local-store.mjs` saat pertama dibutuhkan):
204:- Di lokal/dev, `ERP_STORAGE_DIR` boleh relatif atau kosong; nilainya di-resolve terhadap `process.cwd()` dengan default `./data/erp-storage`.
205:- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset, absolut, dan berada di luar `process.cwd()`**. Kosong, relatif, atau di dalam folder release → throw (mencegah tulisan masuk folder release yang akan dihapus).
206:- Driver = `supabase` → `ERP_STORAGE_DIR` tidak wajib ada dan tidak divalidasi.
210:#### A. `lib/storage/local-store.mjs` — inti fs, tanpa dependensi build
218:export function storeRoot()                      // resolve(ERP_STORAGE_DIR || ./data/erp-storage)
255:export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
278:- `local`: seluruh operasi lewat `local-store.mjs`. `download` mengembalikan objek mirip Blob dengan `type` dari `contentTypeFromPath(path)`. File tidak ada → `{ data: null, error: { message, status: 404 } }`.
290:`worker/whatsapp.mjs` mengimpor `../lib/storage/local-store.mjs` (relatif terhadap file worker; worker dijalankan dengan `--cwd $CURRENT_LINK`, jadi modul berada di `<release>/lib/storage/local-store.mjs`).
296:  - `hybrid` → wajib env Supabase **dan** `ERP_STORAGE_DIR`;
297:  - `local` → cukup `ERP_STORAGE_DIR`.
302:Logika driver di worker (±40 baris) sengaja ditulis inline di `whatsapp.mjs`; **primitif** fs, validasi path, dan konfigurasi tetap diimpor dari `local-store.mjs`. Ini menghindari dua implementasi validasi path yang bisa berbeda.
304:**Deploy:** `lib/storage/local-store.mjs` harus ikut disalin ke `deploy_package/lib/storage/`. `scripts/collect-worker-deps.mjs` hanya menyalin isi `node_modules`, jadi file repo ini tidak otomatis ikut.
311:mkdir -p deploy_package/lib/storage
312:cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
318:tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs' \
319:  || { echo 'local-store.mjs missing'; exit 1; }
331:- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release; driver invalid → throw.
347:| `lib/storage/local-store.mjs` | fs + validasi path + konfigurasi driver (3.3A) |
349:| `scripts/migrate-storage-to-vps.mjs` | backfill Supabase → VPS (bagian 7) |
350:| `scripts/backup-erp-storage.sh` | cron backup harian + rotasi (bagian 8) |
352:| `docs/PANDUAN_STORAGE_ERP.md` | runbook operasional: env, driver, migrasi, backup/restore, decommission |
378:| `worker/whatsapp.mjs` | K1–K3 driver-aware + impor `local-store.mjs` |
385:| `.env.example` | `ERP_STORAGE_DIR=./data/erp-storage`, `ERP_STORAGE_DRIVER=supabase` + komentar produksi |
386:| `README.md` | satu paragraf: biner ERP di VPS, teks & path di Supabase; rujuk `docs/PANDUAN_STORAGE_ERP.md` |
389:| `package.json` | script `storage:migrate`, `storage:verify`, `storage:backup` |
390:| `docs/PANDUAN_ABSENSI.md` | tidak berubah; hanya menjadi rujukan pola |
394:- `prisma/schema.prisma` + semua migrasi — path DB identik.
395:- `scripts/setup-crm-storage.mjs`, `scripts/reset-crm-storage.mjs` — tetap ada selama transisi; dinonaktifkan di Fase 6.
409:- [ ] T0.4 Tambahkan ke `$DEPLOY_PATH/shared/.env`:
410:  - `ERP_STORAGE_DIR=/var/lib/askonveksi/storage`
411:  - `ERP_STORAGE_DRIVER=hybrid`
412:- [ ] T0.5 Siapkan `/var/backups/askonveksi`; pastikan nama file backup absensi tidak bentrok.
418:- [ ] T1.1 `lib/storage/local-store.mjs` sesuai 3.3A (atomik, `link`, validasi bucket+path, guard driver, `statFile`, `contentTypeFromPath`).
426:  - guard: driver invalid throw; driver non-supabase dengan `ERP_STORAGE_DIR` relatif throw;
456:- [ ] T3.2 `deploy.yml`: salin `local-store.mjs` + verifikasi tarball.
457:- [ ] T3.3 `node --check worker/whatsapp.mjs`; `node scripts/collect-worker-deps.mjs /tmp/deploy-check` exit 0.
466:- [ ] T4.2 Pastikan `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` sudah ada **sebelum** restart.
470:**Gate:** upload baru ada di VPS (`find $ERP_STORAGE_DIR -newer /tmp/marker -type f`) **dan** di Supabase.
474:- [ ] T5.1 Jalankan `node scripts/migrate-storage-to-vps.mjs` (idempoten).
478:- [ ] T5.5 Pasang cron backup + uji restore sekali.
480:**Gate:** `--verify` bersih, UAT bersih, backup & restore teruji.
484:Kriteria masuk: tidak ada `fallback-supabase` selama 14 hari, backup rutin sukses, tidak ada insiden.
486:- [ ] T6.1 `ERP_STORAGE_DRIVER=local`, restart PM2 app + worker.
489:- [ ] T6.4 Rapikan `erp-storage.ts` (jalur Supabase boleh dibiarkan sebagai kode mati; hapus hanya bila yakin), perbarui `docs/PANDUAN_STORAGE_ERP.md` + `README.md`.
494:## 7. Runbook migrasi data (Fase 5)
496:`scripts/migrate-storage-to-vps.mjs` (Node mjs; memakai `@supabase/supabase-js` + `dotenv` yang sudah ada, serta `local-store.mjs` untuk validasi/tulis):
498:1. Baca env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ERP_STORAGE_DIR`.
517:  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
518:  node scripts/migrate-storage-to-vps.mjs --dry-run
519:  node scripts/migrate-storage-to-vps.mjs
520:  node scripts/migrate-storage-to-vps.mjs --verify
532:## 8. Backup & restore
534:### 8.1 Backup harian
536:`scripts/backup-erp-storage.sh`:
541:SRC="${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}"
542:DEST="${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}"
549:Cron user aplikasi: `15 2 * * * /path/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1`
556:0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
565:tar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz
568:node scripts/migrate-storage-to-vps.mjs --verify   # selama grace period
573:### 8.4 Pasangan backup DB ↔ file
575:Restore DB (Supabase) dan restore file (tar VPS) harus dari waktu yang berdekatan. Path di DB menunjuk ke file: file hilang = route 404 (bukan crash). Catat prosedur ini di `docs/PANDUAN_STORAGE_ERP.md`.
583:- [ ] Cron mingguan: `df -P "$ERP_STORAGE_DIR" | tail -1`; alert bila Use% ≥ 80%.
594:| Bug saat Fase 4–5 (hybrid) | Set `ERP_STORAGE_DRIVER=supabase` + `pm2 restart` kedua proses. Aman karena hybrid fail-hard menjamin setiap upload sukses ada di Supabase. |
604:| 1 | Disk VPS gagal / folder salah di dalam `releases/` | Gambar hilang | Path absolut di luar release + guard produksi + backup harian/offsite + `--verify` periodik |
605:| 2 | Worker crash karena modul tidak ikut tar | Media WA berhenti tersimpan | Salin `local-store.mjs` + verifikasi tar + simulasi layout release |
611:| 8 | Backup tak pernah diuji | Panic saat insiden | T5.5 wajib restore |
614:| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif/di dalam cwd → throw |
615:| 12 | Migrasi dijalankan sebagai root | File `root:root 0640`, aplikasi 404 | Runbook `sudo -u askonveksi` + verifikasi ownership |
619:| 16 | `npm ci --omit=dev` di runbook lama | Migrasi gagal start | Runbook diperbaiki (bagian 7) |
659:| 3 | Worker | **Impor `local-store.mjs`** yang ikut disalin ke release; logika driver 3 cabang inline di worker |
660:| 4 | Grace period | **1 bulan** `hybrid` (minimal 14 hari tanpa fallback + backup/restore teruji) |
661:| 5 | Backup offsite | **Diaktifkan** sejak Fase 5 |
663:| 7 | Default `.env.example` | `./data/erp-storage` + `supabase`; nilai produksi di dokumentasi |
664:| 8 | Migrasi | Dijalankan sebagai user aplikasi; `npm ci` penuh; script memakai `putFile` |
669:2. Ketersediaan `rclone` + remote tujuan untuk backup offsite.


---

## Assistant

_Thinking:_

The doc says production guard throws if inside cwd. I relaxed to warn. Need decide whether to align with doc or adjust doc. User wants presentation. If production local run uses absolute path within cwd, doc would throw. We could set local .env to `ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage` inside cwd; with warn it works. On VPS path outside release works. I'll update doc to say "di luar release; path di dalam cwd diberi peringatan" perhaps. Or we can make guard stricter only if cwd contains `/releases/`? Better to align doc with code by updating the doc line 205 and checklist 331, 614. But the user approved doc; modifying to match practical behavior is okay as long as security intent preserved: reject relative, warn inside cwd. Actually the strongest failure mode is writing inside release dir; a warning won't prevent it. But production path inside cwd might be legitimate in local prod. Could require `ERP_STORAGE_ALLOW_CWD` override. That might be over-engineering. Let's think.

On VPS, cwd = `$CURRENT_LINK` (release dir) due PM2 `--cwd "$CURRENT_LINK"`. ERP_STORAGE_DIR `/var/lib/askonveksi/storage` outside cwd. Good. If someone sets `ERP_STORAGE_DIR=./data/erp-storage`, relative → throw. If someone sets absolute inside release, warn only. The risk is misconfiguration; warning might be missed. But for local presentation, absolute inside project cwd is expected. We could allow inside cwd only when `DEPLOY_PATH` unset or cwd not under a `releases` folder. Simpler: throw if inside cwd AND `process.env.NODE_ENV === "production"` AND `process.env.ERP_STORAGE_ALLOW_CWD !== "true"`. Then local `.env` sets `ERP_STORAGE_ALLOW_CWD=true`? Adds complexity. Alternatively set local `.env` driver=local and ERP_STORAGE_DIR outside cwd, e.g. `/home/haydar/.local/share/askonveksi/erp-storage`. That satisfies strict guard and demonstrates VPS-like disk. But uploads would be outside project; okay. However backup/migration for local? Fine.

Better to keep strict guard per doc. For presentation, set `.env` `ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage` would throw in production. If they run `npm run dev`, no throw. If they run `npm start`, throw. To avoid surprise, use an absolute path outside cwd: `/home/haydar/Code/askonveksi-storage`? That requires write permission (parent /home/haydar/Code likely writable). Or `/var/lib/askonveksi/storage` may require sudo. Use `/home/haydar/askonveksi-storage` (home writable). That works for `npm start` and `npm run dev`. But then local presentation files live outside project; acceptable. Yet user likely expects project data folder. Hmm.

The summary decision said: "Production guard: non-Supabase driver requires configured absolute ERP_STORAGE_DIR; warning (not hard failure) if inside cwd to permit local npm start." So the approved plan in the summary explicitly chose warning, not throw. Great — keep code as is. Update FILE_TO_VPS.md lines that say throw inside cwd to match (warning) to avoid inconsistency. Since summary says approved decisions, yes.

Now create deploy modifications. Package step:
```
mkdir -p deploy_package/.next deploy_package/worker deploy_package/lib/storage
...
cp worker/whatsapp.mjs ...
mkdir -p deploy_package/lib/storage
cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
```
Then tar verification add `./lib/storage/local-store.mjs`.

Also build step needs `ERP_STORAGE_*`? Build doesn't execute storage ops at build, but `WHATSAPP_MEDIA_BUCKET` is read at module load in erp-storage.ts during build compilation? Next build may import route modules during prerender; `process.env.WHATSAPP_MEDIA_BUCKET` fallback fine. No required env. `ERP_STORAGE_DRIVER` not needed at build. Fine.

Also deploy step should verify storage dir exists? Add check in SSH: `test -d "$ERP_STORAGE_DIR"`? The env is in shared/.env; shell doesn't source it. We can grep. But runbook covers T0. Could add an optional check warning. Not necessary for presentation; but plan says gate? Let's focus code.

Add `.env.example`:
```
# ERP binaries on VPS disk (Postgres keeps relative paths)
ERP_STORAGE_DIR=./data/erp-storage
ERP_STORAGE_DRIVER=supabase
```
Plus comment production values.

Package scripts:
```
"storage:migrate": "node --env-file=.env scripts/migrate-storage-to-vps.mjs",
"storage:verify": "node --env-file=.env scripts/migrate-storage-to-vps.mjs --verify",
"storage:backup": "bash scripts/backup-erp-storage.sh"
```
But plan says scripts use env; maybe `node scripts/...` relies on dotenv? The migration script can import "dotenv/config". Then no `--env-file` needed. `storage:backup` script could use shell with env loaded? If run from repo, `.env` not auto-loaded. Better `storage:backup`: `bash scripts/backup-erp-storage.sh` and script sources `.env` if present? The doc's backup script uses `ERP_STORAGE_DIR` env. For local convenience, shell can `[ -f .env ] && set -a; . ./.env; set +a` but `.env` may have spaces/quotes; `set -a` works mostly. Alternatively use `node` to run? Keep simple.

Need create migration script and backup script and docs. The plan requires. User asked "kerjakan semua itu". Let's implement them well.

Migration script requirements (section 7). Let's read section 7 fully to implement correct table/column list.

Saya baca bagian runbook migrasi/backup di dokumen agar script yang dibuat sesuai daftar tabel dan perilaku yang disetujui.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '360,590p' FILE_TO_VPS.md",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

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



---

## Assistant

_Thinking:_

We need to write migration script with walk and verify. Let's implement robustly.

Migration script details:
- import "dotenv/config"
- import { createClient } from "@supabase/supabase-js";
- import { putFile, statFile, resolveSafe } from "../lib/storage/local-store.mjs";
- import path? no.
- buckets constant.
- flags: `--dry-run`, `--verify`.
- env validation: URL, key, ERP_STORAGE_DIR required (for local-store default? For migration, require explicit to avoid writing to cwd). Use `process.env.ERP_STORAGE_DIR`; if missing, error. Also `storageDriver` guard? local-store's `putFile` calls storeRoot -> assertStorageReady. If `ERP_STORAGE_DRIVER` is `supabase` (default) and running migration, `putFile` still works? `assertStorageReady` returns supabase without checking dir, but `storeRoot` uses ERP_STORAGE_DIR. That's fine; migration writes local regardless of driver. But `putFile` doesn't check driver. Good. However if NODE_ENV=production and ERP_STORAGE_DIR relative, guard throws. Good.
- Supabase client: `createClient(url, key, { auth: { persistSession:false } })`.
- walk: `storage.from(bucket).list(prefix, { limit: 100, offset })`. Supabase list returns `{ data: array | null, error }`. Each item: `{ name, id, metadata, created_at, updated_at, last_accessed_at }`. Folders have `id === null` (often). Need recursive listing. Prefix is folder path without trailing slash? Supabase list uses prefix. Build prefix: `parent ? `${parent}/${item.name}` : item.name`. For root, prefix `""`.
- Pagination: loop offset from 0, limit 100 until data.length < 100. Supabase may return fewer due to folders; loop until empty or <limit. Good.
- For each object, `fullPath = prefix ? `${prefix}/${item.name}` : item.name`. Download. `metadata.size` may be number or string. 
- `statFile(bucket, fullPath)` returns `{size}` or null. Note `statFile` validates path and will reject hidden segments, backslashes etc. If object path invalid, record failure. `resolveSafe` perhaps before download to skip. Use `resolveSafe`; if null → failure "path tidak valid".
- If not dryrun and existing size === metadata.size → skipped.
- Download error → failure.
- Write with `putFile(bucket, fullPath, Buffer.from(await data.arrayBuffer()), { upsert: true })`. Supabase `download` returns Blob.
- After write, `statFile` verify size.
- `--verify`: for each object, statFile; if null or size mismatch → missing list. Also count local objects? Plan says compare count & size. We can count objects listed from Supabase and verify each. To detect extra local files, walk local dirs? Could implement optional local walk to count. Simpler: verify every remote object exists with same size; report remote count/bytes. Additional local orphans not harmful. But plan says jumlah objek per bucket; we can walk local with fs `readdir` recursive and compare. Let's implement local walk with `readdir` from fs/promises and `readFile`? No need. Use local `storeRoot` and `readdir` recursive; but path validation. Could add. Yet keep script straightforward. `--verify` should exit nonzero if missing. Counting local extras isn't critical. We can report local files count via fs walk. Let's implement helper `walkLocal(bucket)` using `readdir(dir, { withFileTypes: true })`; skip hidden `.tmp-` and dotfiles; validate via `resolveSafe`? Build relative. Need import `storeRoot`, `resolveSafe`. Use `readdir` and `stat`. But no need for full check. I'll implement to compare counts, and list extras.

Data structure summary per bucket: `{objects, bytes, skipped, written, failed, missing}`.
- `dryRun`: still download? No, only list and estimate. Do not download. Report count/

---

## Assistant

_Thinking:_

Let me continue; I was about to write the migration script. Need to be efficient. I'll write it now, then backup script, docs, env, deploy, package.

Migration script code:

```js
import "dotenv/config";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { putFile, resolveSafe, statFile, storeRoot } from "../lib/storage/local-store.mjs";

const BUCKETS = ["crm-po-designs", "business-assets", "payment-proofs", "whatsapp-media"];
const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry-run");
const verifyOnly = flags.has("--verify");
...
```

Check env:
```js
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const dir = process.env.ERP_STORAGE_DIR;
if (!url || !key) fail(...)
if (!dir) fail("ERP_STORAGE_DIR wajib...")
```
createClient.

`listAll(bucket)`:
```js
async function listAll(bucket) {
  const entries = [];
  const queue = [""];
  while (queue.length) {
    const prefix = queue.shift();
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.from(bucket).list(prefix, { limit: 100, offset });
      if (error) throw new Error(...);
      const items = data ?? [];
      for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) entries.push({ path: fullPath, size: Number(item.metadata?.size ?? 0) });
        else queue.push(fullPath);
      }
      if (items.length < 100) break;
      offset += 100;
    }
  }
  return entries;
}
```
Potential duplicate folder queue; okay.

`--verify`:
- For each bucket list remote; for each entry statFile; if missing/mismatch. Local count via walk:
```js
async function walkLocal(bucket) {
  const root = join(storeRoot(), bucket);
  const files = [];
  async function walk(dir, prefix) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return; throw e; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else if (entry.isFile()) { const info = await stat(join(dir, entry.name)); files.push({ path: rel, size: info.size }); }
    }
  }
  await walk(root, "");
  return files;
}
```
Then compare maps; report missing and extra, mismatched.

For migrate:
- if dryRun just list.
- else for each object: 
  - `if (!resolveSafe(bucket, path)) { fail }`
  - `const existing = await statFile(...); if (existing?.size === size) { skipped++; continue; }`
  - download; write; verify.
- Handle per-file errors and continue.

Should we use `storageDriver`? `putFile` will call `storeRoot` and guard. `ERP_STORAGE_DRIVER` may be `supabase`, which means `assertStorageReady` skips checks; but `storeRoot` uses dir. Fine. The script is a local write tool, independent of driver. But if driver invalid, `assertStorageReady` throws. Maybe set `ERP_STORAGE_DRIVER=local` in script? No, don't mutate. It's okay.

Potential issue: `statFile` calls `assertStorageReady` which if NODE_ENV=production and `ERP_STORAGE_DIR` inside cwd warns only. Fine.

Exit code: `process.exitCode = 1` if failures/missing.

Output per bucket.

Now backup script exactly as doc plus safety check that SRC exists, and support local `.env`? The script can source `../.env`? Running from repo root via npm script; use:
```bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
```
But `.env` may contain values with special shell chars (e.g., passwords with `$`?), sourcing can be unsafe. Existing project uses dotenv; backup script env vars set by cron likely. Avoid sourcing. Keep as doc, but add validation `[ -d "$SRC" ] || { echo ...; exit 1; }`, `tar -C "$(dirname "$SRC")" ...` and rotation. Also quote. Set umask? Backup contains sensitive docs; mode 0600? tar creates 0644 by default. Use `umask 077` before tar so backup 0600. Good.

`storage:backup` script can be `bash scripts/backup-erp-storage.sh`.

Docs `docs/PANDUAN_STORAGE_ERP.md`: comprehensive but concise. Include env, drivers, layout, flow upload/edit/delete, migration, verify, backup/restore, rollback, troubleshooting. We can write ~150 lines.

README: add paragraph near intro/config. Let's inspect first 60 lines.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '1,70p' README.md",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

# ERM Askonveksi

Aplikasi operasional internal berbasis Next.js 16, Prisma, PostgreSQL Supabase, dan Supabase Auth. Implementasi saat ini mencakup CRM pipeline, customer, revisi Purchase Order dan invoice, pencatatan DP/lunas, Sales Order immutable, absensi pegawai berbasis kamera, RBAC, serta audit log.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi Supabase/database.
2. Isi `DIRECT_URL` dengan direct connection atau Supavisor session mode. Untuk migration reset CRM 2026-09-02, siapkan storage melalui Storage API, lalu terapkan migration dan buat Prisma Client. Perintah storage mengosongkan serta menghapus bucket bukti persetujuan lama secara permanen.
3. Isi `ATTENDANCE_UPLOAD_DIR` (opsional di lokal, default `./data/attendance`). Di produksi gunakan folder persisten di luar release, misalnya `/var/lib/askonveksi/attendance`.
4. Buat Owner pertama satu kali.
5. Jalankan development server.

```bash
rtk npm run crm:reset-storage
rtk npx prisma migrate deploy
rtk npm run crm:setup-storage
rtk npm run db:generate
rtk npm run bootstrap:owner
rtk npm run dev
```

Untuk menguji kamera absensi dari HP/perangkat lain di jaringan lokal, gunakan HTTPS. Akses lewat alamat LAN biasa (`http://192.168.x.x:3000`) akan memblokir kamera karena bukan secure context.

```bash
rtk npm run dev:https
```

Setelah Owner berhasil login, hapus `BOOTSTRAP_OWNER_PASSWORD` dari environment.

### Data demo Produksi

Setelah migration dan bootstrap Owner selesai, buat masing-masing satu kartu demo Jersey dan Non-Jersey:

```bash
ALLOW_DEMO_DATA=true npm run db:seed:production-demo
```

Script aman dijalankan ulang, menolak berjalan saat `NODE_ENV=production`, dan menandai data dengan awalan `[DEMO]`/`DEMO-`.

## Kontrak akses data

- Supabase SDK hanya menangani Auth dan cookie session.
- Prisma menangani seluruh data aplikasi melalui server.
- Role, status aktif, dan kewajiban ganti password berasal dari `AppUser`, bukan metadata JWT.
- Setiap Server Action memvalidasi input, autentikasi, dan role kembali.
- Tabel aplikasi mengaktifkan RLS serta mencabut akses langsung role `anon`/`authenticated`.
- PO Disepakati, invoice Terbit, dan Sales Order disimpan sebagai dokumen historis yang tidak diedit langsung.
- Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.
- Foto absensi disimpan di filesystem VPS (`ATTENDANCE_UPLOAD_DIR`); database hanya menyimpan path relatif. Foto diambil langsung dari kamera (tanpa unggah galeri), di-reencode ke WebP, dan disajikan lewat route terautentikasi.
- Absensi memakai jam WIB, toleransi keterlambatan, hari kerja, dan kalender hari libur. Owner/Developer mengelola laporan, koreksi, catatan manual, dan pengaturan; Developer tetap memiliki akses penuh ke fitur baru.

## Verifikasi

```bash
rtk npm test
# tes absensi saja
rtk node --test tests/attendance-time.test.mjs tests/attendance-report.test.mjs tests/attendance-validation.test.mjs tests/attendance-storage.test.mjs
rtk npm run db:validate
rtk npm run db:generate
rtk npm run lint
rtk npm run build -- --webpack
```

`@prisma/config` dan `prisma` sementara meng-override dependency transitif yang rentan. Hapus override tersebut setelah Prisma menyediakan rilis stable yang sudah membawa versi patched.

Build webpack disediakan sebagai jalur verifikasi bila Turbopack tidak diizinkan membuka port proses oleh environment sandbox.

Dokumentasi database lebih lanjut tersedia di [docs/PRISMA_SETUP.md](docs/PRISMA_SETUP.md). Panduan absensi, termasuk konfigurasi kamera/HTTPS, penyimpanan VPS, migration, dan backup, tersedia di [docs/PANDUAN_ABSENSI.md](docs/PANDUAN_ABSENSI.md). Keputusan terbaru pipeline CRM tersedia di [PipelineCRM_Baru.md](PipelineCRM_Baru.md).


---

## Assistant

_Thinking:_

Now implement deploy, env, package, README, docs, scripts. Use parallel writes for new files, edits for existing.

First deploy.yml edit.

**Tool: edit**

**Input:**
```json
{
  "newString": "      - name: Package release\n        run: |\n          mkdir -p deploy_package/.next deploy_package/worker deploy_package/lib/storage\n          cp -r .next/standalone/. deploy_package/\n          cp -r .next/static deploy_package/.next/static\n          if [ -d public ]; then cp -aT public deploy_package/public; fi\n          cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs\n          # Worker imports shared storage primitives; the standalone trace does\n          # not include this repo file, so copy it explicitly.\n          cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs\n          # Worker deps missing from the standalone trace (dotenv, baileys,\n          # supabase + transitive). Copied from this same npm-ci tree so\n          # versions stay identical; skips what standalone already ships.\n          node scripts/collect-worker-deps.mjs deploy_package\n          tar -czf release.tar.gz -C deploy_package .\n          tar -tzf release.tar.gz | grep -qx './server.js'\n          tar -tzf release.tar.gz | grep -qx './worker/whatsapp.mjs'\n          tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs'\n          # File-level checks: standalone dirs may be pruned, so a present\n          # directory proves nothing. Fail the build here, not on the VPS.\n          for f in node_modules/dotenv/package.json node_modules/@whiskeysockets/baileys/package.json node_modules/@supabase/supabase-js/package.json node_modules/ws/wrapper.mjs node_modules/pg/esm/index.mjs node_modules/pg-pool/index.js node_modules/postgres-array/index.js node_modules/.prisma/client/default.js node_modules/@prisma/client/default.js; do\n            tar -tzf release.tar.gz | grep -q \"^\\./$f$\" || { echo \"Worker file missing in tarball: $f\"; exit 1; }\n          done",
  "oldString": "      - name: Package release\n        run: |\n          mkdir -p deploy_package/.next deploy_package/worker\n          cp -r .next/standalone/. deploy_package/\n          cp -r .next/static deploy_package/.next/static\n          if [ -d public ]; then cp -aT public deploy_package/public; fi\n          cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs\n          # Worker deps missing from the standalone trace (dotenv, baileys,\n          # supabase + transitive). Copied from this same npm-ci tree so\n          # versions stay identical; skips what standalone already ships.\n          node scripts/collect-worker-deps.mjs deploy_package\n          tar -czf release.tar.gz -C deploy_package .\n          tar -tzf release.tar.gz | grep -qx './server.js'\n          tar -tzf release.tar.gz | grep -qx './worker/whatsapp.mjs'\n          # File-level checks: standalone dirs may be pruned, so a present\n          # directory proves nothing. Fail the build here, not on the VPS.\n          for f in node_modules/dotenv/package.json node_modules/@whiskeysockets/baileys/package.json node_modules/@supabase/supabase-js/package.json node_modules/ws/wrapper.mjs node_modules/pg/esm/index.mjs node_modules/pg-pool/index.js node_modules/postgres-array/index.js node_modules/.prisma/client/default.js node_modules/@prisma/client/default.js; do\n            tar -tzf release.tar.gz | grep -q \"^\\./$f$\" || { echo \"Worker file missing in tarball: $f\"; exit 1; }\n          done",
  "path": "/home/haydar/Code/askonveksi/askonveksi/.github/workflows/deploy.yml"
}
```

Edited .github/workflows/deploy.yml (1 replacement)

---

## Assistant

_Thinking:_

Need deploy step verify ERP_STORAGE_DIR before PM2? Add in SSH script after shared/.env check:
```bash
ERP_DIR="$(grep -E '^ERP_STORAGE_DIR=' ... | cut ...)"
if driver != supabase then test -n and absolute and test -d/writable
```
Could be useful, but not essential. The doc says Fase 0. I'll add a non-fatal or fatal check? If env missing in shared/.env and new code defaults supabase, app still works but not VPS. For actual feature, we want fail. But adding fatal could break deploy if they haven't added env yet (and they want presentation, likely local). Since deploy is production and plan says ensure env before restart, add warning rather than fail:
```bash
ERP_DRIVER="$(grep -E '^ERP_STORAGE_DRIVER=' ... | cut -d= -f2 | tr -d ' "' || true)"
if [ -n "$ERP_DRIVER" ] && [ "$ERP_DRIVER" != "supabase" ]; then
  ERP_DIR=...
  [ -n "$ERP_DIR" ] || { echo '...'; exit 1; }
  case "$ERP_DIR" in /*) ;; *) echo...; exit 1;; esac
  test -d "$ERP_DIR" && test -w "$ERP_DIR" || { echo ...; exit 1; }
fi
```
This is good safety. Add after shared/.env check. But grep values could include comments; fine. Let's add.

Also build step might need ERP env? No.

Now .env.example add. Then package scripts. Then README. Then docs + scripts.

Let's do env + package + README in parallel.

**Tool: edit**

**Input:**
```json
{
  "newString": "          test -f \"$DEPLOY_PATH/shared/.env\" || { echo 'Shared runtime .env is missing.'; exit 1; }\n          ERP_DRIVER=\"$(grep -E '^ERP_STORAGE_DRIVER=' \"$DEPLOY_PATH/shared/.env\" 2>/dev/null | cut -d= -f2 | tr -d ' \"' || true)\"\n          if [ -n \"$ERP_DRIVER\" ] && [ \"$ERP_DRIVER\" != \"supabase\" ]; then\n            ERP_DIR=\"$(grep -E '^ERP_STORAGE_DIR=' \"$DEPLOY_PATH/shared/.env\" 2>/dev/null | cut -d= -f2- | tr -d ' \"' || true)\"\n            [ -n \"$ERP_DIR\" ] || { echo 'ERP_STORAGE_DIR wajib diisi saat driver bukan supabase.'; exit 1; }\n            case \"$ERP_DIR\" in /*) ;; *) echo 'ERP_STORAGE_DIR harus path absolut.'; exit 1 ;; esac\n            case \"$ERP_DIR\" in \"$DEPLOY_PATH\"/*) echo 'ERP_STORAGE_DIR tidak boleh di dalam DEPLOY_PATH (release akan dipangkas).'; exit 1 ;; esac\n            test -d \"$ERP_DIR\" || { echo \"ERP_STORAGE_DIR tidak ada: $ERP_DIR\"; exit 1; }\n            test -w \"$ERP_DIR\" || { echo \"ERP_STORAGE_DIR tidak writable oleh user deploy: $ERP_DIR\"; exit 1; }\n          fi\n          test -f \"$ARCHIVE\" || { echo 'Release archive is missing.'; exit 1; }",
  "oldString": "          test -f \"$DEPLOY_PATH/shared/.env\" || { echo 'Shared runtime .env is missing.'; exit 1; }\n          test -f \"$ARCHIVE\" || { echo 'Release archive is missing.'; exit 1; }",
  "path": "/home/haydar/Code/askonveksi/askonveksi/.github/workflows/deploy.yml"
}
```

Edited .github/workflows/deploy.yml (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "WHATSAPP_MEDIA_BUCKET=whatsapp-media\n# Biner ERP (gambar desain, bukti bayar, logo, media WA) disimpan di disk VPS.\n# Database tetap menyimpan path relatif; jangan menambahkan prefix vps/ ke path.\n# Lokal: cukup ./data/erp-storage. Produksi: path absolut di luar release,\n# mis. /var/lib/askonveksi/storage, dan driver hybrid lalu local.\nERP_STORAGE_DIR=./data/erp-storage\nERP_STORAGE_DRIVER=supabase\n# Opsional: lokasi backup harian ERP (script storage:backup)\nERP_STORAGE_BACKUP_DIR=/var/backups/askonveksi\n# CMS website: simpan di volume persisten (bukan di dalam folder build)",
  "oldString": "WHATSAPP_MEDIA_BUCKET=whatsapp-media\n# CMS website: simpan di volume persisten (bukan di dalam folder build)",
  "path": "/home/haydar/Code/askonveksi/askonveksi/.env.example"
}
```

Edited .env.example (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "    \"crm:backup\": \"node scripts/cms-backup.mjs\",\n    \"storage:migrate\": \"node scripts/migrate-storage-to-vps.mjs\",\n    \"storage:verify\": \"node scripts/migrate-storage-to-vps.mjs --verify\",\n    \"storage:backup\": \"bash scripts/backup-erp-storage.sh\",",
  "oldString": "    \"crm:backup\": \"node scripts/cms-backup.mjs\",",
  "path": "/home/haydar/Code/askonveksi/askonveksi/package.json"
}
```

Could not find oldString in /home/haydar/Code/askonveksi/askonveksi/package.json. It must match exactly, including whitespace and indentation.

**Tool: edit**

**Input:**
```json
{
  "newString": "- Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.\n- Biner ERP (gambar desain, bukti pembayaran, logo/tanda tangan, media WhatsApp) disimpan di disk VPS melalui `ERP_STORAGE_DIR`; database Supabase hanya menyimpan teks, metadata, dan path relatif. Panduan operasional, migrasi, dan backup ada di [docs/PANDUAN_STORAGE_ERP.md](docs/PANDUAN_STORAGE_ERP.md).",
  "oldString": "- Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.",
  "path": "/home/haydar/Code/askonveksi/askonveksi/README.md"
}
```

Edited README.md (1 replacement)

---

## Assistant

_Thinking:_

Package scripts line is `"cms:backup": "node scripts/cms-backup.mjs"` not crm. Let's edit correctly.

**Tool: edit**

**Input:**
```json
{
  "newString": "    \"cms:backup\": \"node scripts/cms-backup.mjs\",\n    \"cms:clean-orphans\": \"node scripts/cms-clean-orphans.mjs\",\n    \"storage:migrate\": \"node scripts/migrate-storage-to-vps.mjs\",\n    \"storage:verify\": \"node scripts/migrate-storage-to-vps.mjs --verify\",\n    \"storage:backup\": \"bash scripts/backup-erp-storage.sh\",",
  "oldString": "    \"cms:backup\": \"node scripts/cms-backup.mjs\",\n    \"cms:clean-orphans\": \"node scripts/cms-clean-orphans.mjs\",",
  "path": "/home/haydar/Code/askonveksi/askonveksi/package.json"
}
```

Edited package.json (1 replacement)

---

## Assistant

_Thinking:_

Now create migration script, backup script, docs. Use write.

Migration script considerations:
- `storeRoot` import triggers no side effect.
- `assertStorageReady` maybe call early to validate. `storeRoot()` calls ensure. Call `storeRoot()` after env validation.
- When driver is `supabase`, no guard for dir. We require dir ourselves.
- `putFile` writes with upsert true.
- `statFile` validates path; if object path contains hidden segment (e.g., `.DS_Store`), returns null and we'd write? putFile would reject. Record failure.
- `resolveSafe` returns null for invalid; record failure.
- Listing: Supabase folder placeholder objects can have `id`? If a zero-byte object named folder with id, treat as file. Fine.
- Error handling per bucket.

Let me write `scripts/migrate-storage-to-vps.mjs`.

> Note: `createClient` must not persist session. `storage.list` API can throw? It returns error. Wrap.

`walkLocal` uses `storeRoot`; if bucket missing, returns [].

Exit code. Provide summary.

Potential issue: `--verify` with no local dir: storeRoot ensures local driver? If `NODE_ENV` not production, fine. `walkLocal` readdir ENOENT returns empty; then all remote missing.

Dry-run should also compute existing/skipped? It can stat each remote (no download). Yes: dry-run list + stat to report would-write/skip, no network download. Good.

Implement:
```js
for (const object of objects) {
  const safe = resolveSafe(bucket, object.path);
  if (!safe) { failed...; continue; }
  const local = await statFile(...);
  if (local?.size === object.size) { summary.skipped++; continue; }
  if (dryRun) { summary.wouldWrite++; summary.bytes += object.size; continue; }
  const {data,error}=await supabase.storage.from(bucket).download(object.path);
  ...
}
```
For dryRun bytes should be total remote bytes, not only wouldWrite. Report both.

`--verify`: 
```js
const localFiles = await walkLocal(bucket);
const localMap = new Map(...);
for remote: if missing/mismatch -> missing.push
extras = local files not in remotePaths.
```
Exit 1 if missing/extras/mismatch. Extra local files may be legitimate if left from removed records; treat as warning? Plan says compare count; mark extras but maybe exit nonzero. Use `missing` failure, `extra` warning but exit? To be safe, report extras and count as failure (data integrity). Could be annoying; but verify should be clean. Do exit nonzero for missing/mismatch only; extras listed as warning. Hmm, plan says "bandingkan jumlah objek & ukuran; exit non-zero bila ada selisih." Extras are a count difference, so exit nonzero. Let's include extras in failure count. For presentation, they may not run verify. Fine.

`formatBytes` helper.

Now docs. Let's write after.

Sekarang saya buat script migrasi, backup, dan panduan operasional.

**Tool: write**

**Input:**
```json
{
  "content": "import \"dotenv/config\";\n\nimport { readdir, stat } from \"node:fs/promises\";\nimport { join } from \"node:path\";\nimport { createClient } from \"@supabase/supabase-js\";\nimport { putFile, resolveSafe, statFile, storeRoot } from \"../lib/storage/local-store.mjs\";\n\nconst BUCKETS = [\"crm-po-designs\", \"business-assets\", \"payment-proofs\", \"whatsapp-media\"];\nconst PAGE_SIZE = 100;\nconst flags = new Set(process.argv.slice(2));\nconst dryRun = flags.has(\"--dry-run\");\nconst verifyOnly = flags.has(\"--verify\");\n\nfunction fail(message) {\n  console.error(`[storage-migrate] ${message}`);\n  process.exit(1);\n}\n\nfunction formatBytes(value) {\n  if (!Number.isFinite(value) || value <= 0) return \"0 B\";\n  const units = [\"B\", \"KB\", \"MB\", \"GB\", \"TB\"];\n  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);\n  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;\n}\n\nconst supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;\nconst supabaseKey = process.env.SUPABASE_SECRET_KEY;\nif (!supabaseUrl || !supabaseKey) fail(\"NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diset.\");\nif (!process.env.ERP_STORAGE_DIR) fail(\"ERP_STORAGE_DIR wajib diset (path absolut volume VPS).\");\n\nconst storage = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }).storage;\nconst root = storeRoot();\n\nasync function listBucket(bucket) {\n  const objects = [];\n  const folders = [\"\"];\n\n  while (folders.length) {\n    const prefix = folders.shift();\n    let offset = 0;\n\n    for (;;) {\n      const { data, error } = await storage.from(bucket).list(prefix, { limit: PAGE_SIZE, offset });\n      if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);\n      const items = data ?? [];\n\n      for (const item of items) {\n        const path = prefix ? `${prefix}/${item.name}` : item.name;\n        if (item.id) {\n          objects.push({ path, size: Number(item.metadata?.size ?? 0) });\n        } else if (!folders.includes(path)) {\n          folders.push(path);\n        }\n      }\n\n      if (items.length < PAGE_SIZE) break;\n      offset += PAGE_SIZE;\n    }\n  }\n\n  return objects;\n}\n\nasync function walkLocal(bucket) {\n  const bucketRoot = join(root, bucket);\n  const files = [];\n\n  async function walk(folder, prefix) {\n    let entries;\n    try {\n      entries = await readdir(folder, { withFileTypes: true });\n    } catch (error) {\n      if (error?.code === \"ENOENT\") return;\n      throw error;\n    }\n\n    for (const entry of entries) {\n      if (entry.name.startsWith(\".\")) continue;\n      const path = prefix ? `${prefix}/${entry.name}` : entry.name;\n      if (entry.isDirectory()) {\n        await walk(join(folder, entry.name), path);\n      } else if (entry.isFile()) {\n        const info = await stat(join(folder, entry.name));\n        files.push({ path, size: info.size });\n      }\n    }\n  }\n\n  await walk(bucketRoot, \"\");\n  return files;\n}\n\nasync function verifyBucket(bucket) {\n  const remote = await listBucket(bucket);\n  const local = await walkLocal(bucket);\n  const localByPath = new Map(local.map((file) => [file.path, file.size]));\n  const remotePaths = new Set(remote.map((file) => file.path));\n  const missing = [];\n  const mismatched = [];\n\n  for (const file of remote) {\n    const localSize = localByPath.get(file.path);\n    if (localSize === undefined) missing.push(file);\n    else if (localSize !== file.size) mismatched.push({ ...file, localSize });\n  }\n\n  const extra = local.filter((file) => !remotePaths.has(file.path));\n  const remoteBytes = remote.reduce((sum, file) => sum + file.size, 0);\n\n  console.log(\n    `[verify] ${bucket}: remote=${remote.length} (${formatBytes(remoteBytes)}) local=${local.length} ` +\n      `missing=${missing.length} mismatched=${mismatched.length} extra=${extra.length}`,\n  );\n\n  for (const file of missing.slice(0, 20)) console.error(`  - hilang: ${file.path} (${file.size} B)`);\n  for (const file of mismatched.slice(0, 20)) console.error(`  - ukuran beda: ${file.path} remote=${file.size} local=${file.localSize}`);\n  for (const file of extra.slice(0, 20)) console.error(`  - ekstra lokal: ${file.path} (${file.size} B)`);\n\n  return missing.length + mismatched.length + extra.length;\n}\n\nasync function migrateBucket(bucket) {\n  const objects = await listBucket(bucket);\n  const summary = { objects: objects.length, bytes: objects.reduce((sum, file) => sum + file.size, 0), skipped: 0, written: 0, failed: 0 };\n\n  for (const object of objects) {\n    if (!resolveSafe(bucket, object.path)) {\n      summary.failed += 1;\n      console.error(`[migrate] path tidak valid, dilewati: ${bucket}/${object.path}`);\n      continue;\n    }\n\n    try {\n      const existing = await statFile(bucket, object.path);\n      if (existing && existing.size === object.size) {\n        summary.skipped += 1;\n        continue;\n      }\n\n      if (dryRun) {\n        summary.written += 1;\n        continue;\n      }\n\n      const { data, error } = await storage.from(bucket).download(object.path);\n      if (error || !data) throw new Error(error?.message || \"download kosong\");\n\n      const bytes = Buffer.from(await data.arrayBuffer());\n      if (bytes.length !== object.size) {\n        throw new Error(`ukuran download ${bytes.length} B != metadata ${object.size} B`);\n      }\n\n      await putFile(bucket, object.path, bytes, { upsert: true });\n      const written = await statFile(bucket, object.path);\n      if (!written || written.size !== object.size) {\n        throw new Error(`verifikasi tulis gagal: ${written?.size ?? \"tidak ada\"} B != ${object.size} B`);\n      }\n\n      summary.written += 1;\n    } catch (error) {\n      summary.failed += 1;\n      console.error(`[migrate] gagal ${bucket}/${object.path}: ${error instanceof Error ? error.message : String(error)}`);\n    }\n  }\n\n  console.log(\n    `[${dryRun ? \"dry-run\" : \"migrate\"}] ${bucket}: objects=${summary.objects} bytes=${formatBytes(summary.bytes)} ` +\n      `written=${summary.written} skipped=${summary.skipped} failed=${summary.failed}`,\n  );\n\n  return summary.failed;\n}\n\nconsole.log(`[storage-migrate] driver=${process.env.ERP_STORAGE_DRIVER || \"supabase\"} root=${root}`);\nif (verifyOnly) console.log(\"[storage-migrate] mode verify: tidak menulis file\");\n\nlet failures = 0;\nfor (const bucket of BUCKETS) {\n  try {\n    failures += verifyOnly ? await verifyBucket(bucket) : await migrateBucket(bucket);\n  } catch (error) {\n    failures += 1;\n    console.error(`[storage-migrate] bucket ${bucket} gagal: ${error instanceof Error ? error.message : String(error)}`);\n  }\n}\n\nif (failures > 0) {\n  console.error(`[storage-migrate] selesai dengan ${failures} masalah.`);\n  process.exitCode = 1;\n} else {\n  console.log(\"[storage-migrate] selesai tanpa masalah.\");\n}\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/scripts/migrate-storage-to-vps.mjs"
}
```

Created file successfully: scripts/migrate-storage-to-vps.mjs

**Tool: write**

**Input:**
```json
{
  "content": "#!/usr/bin/env bash\nset -euo pipefail\n\n# Backup harian biner ERP (gambar, PDF, media WA) dari volume VPS.\n# Jalankan sebagai user aplikasi agar file tetap bisa dibaca proses PM2.\nSRC=\"${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}\"\nDEST=\"${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}\"\nSTAMP=\"$(date +%Y%m%d-%H%M%S)\"\nKEEP=\"${ERP_STORAGE_BACKUP_KEEP:-14}\"\n\nif [ ! -d \"$SRC\" ]; then\n  echo \"[storage-backup] folder sumber tidak ada: $SRC\" >&2\n  exit 1\nfi\n\nmkdir -p \"$DEST\"\numask 077\n\nTARGET=\"$DEST/erp-storage-$STAMP.tar.gz\"\ntar -C \"$(dirname \"$SRC\")\" -czf \"$TARGET\" \"$(basename \"$SRC\")\"\necho \"[storage-backup] dibuat: $TARGET ($(du -h \"$TARGET\" | cut -f1))\"\n\n# Rotasi: simpan $KEEP arsip terbaru.\nls -1t \"$DEST\"/erp-storage-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f --\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/scripts/backup-erp-storage.sh"
}
```

Created file successfully: scripts/backup-erp-storage.sh

---

## Assistant

_Thinking:_

Need chmod +x backup script. Now docs. Write comprehensive but not overly long. Include the warning difference: production non-supabase requires absolute ERP_STORAGE_DIR; inside cwd warns (not throws). But FILE_TO_VPS says throw. We should align doc. Let's decide: update local-store to throw for inside cwd? The user's presentation might use `npm run dev` (NODE_ENV development) so no issue. For `npm start` with absolute inside cwd, warning. The summary explicitly says warning. I'll document warning. Also update FILE_TO_VPS lines 205, 331, 614 to match. Later.

Write docs/PANDUAN_STORAGE_ERP.md.

Content:
- Overview, layout.
- Env table.
- Drivers (supabase/hybrid/local).
- Flow upload/edit/delete.
- Local setup for presentation: `ERP_STORAGE_DRIVER=hybrid`, abs path, restart, verify.
- Migration commands.
- Backup/restore.
- Rollback.
- Troubleshooting (ERR_MODULE_NOT_FOUND, 404, permission, hybrid rollback, path invalid).
- Security: no public URL, route auth, path validation, 0640/0750.

Let's write.

**Tool: write**

**Input:**
```json
{
  "content": "# Panduan Storage ERP di VPS\n\nDokumen ini menjelaskan cara kerja penyimpanan biner ERP: **gambar dan PDF di disk VPS**, sedangkan **teks, metadata, dan path relatif tetap di Supabase Postgres**.\n\n## 1. Prinsip\n\n- Database tidak pernah menyimpan URL atau prefix `vps/`. Nilai kolom tetap seperti sebelumnya, misalnya `design/<taskId>/<uuid>.png`.\n- Lokasi fisik file diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path database:\n\n```text\n/var/lib/askonveksi/storage/          # ERP_STORAGE_DIR\n├── crm-po-designs/design/...         # desain PO, revisi, desain penjahit\n├── business-assets/business/...      # logo dan tanda tangan\n├── payment-proofs/<owner>/...        # bukti bayar dan bukti pengeluaran\n└── whatsapp-media/<account>/...      # media masuk/keluar WhatsApp\n```\n\n- Tidak ada signed URL atau akses publik langsung. Semua pembacaan melewati route yang sudah memeriksa autentikasi/role.\n- Path divalidasi sebelum menyentuh filesystem: menolak `..`, path absolut, backslash, NUL, segmen tersembunyi, dan bucket tidak valid.\n- Penulisan atomik: file ditulis ke file sementara lalu `rename` (upsert) atau `link` (tanpa upsert), sehingga pembaca tidak pernah melihat file setengah jadi.\n- Role DEVELOPER tetap memiliki akses penuh ke seluruh fitur, termasuk fitur baru yang memakai storage ini.\n\n## 2. Variabel environment\n\n| Variabel | Wajib | Keterangan |\n|---|---|---|\n| `ERP_STORAGE_DIR` | Saat driver ≠ `supabase` | Folder akar biner. Produksi: path absolut di luar release, mis. `/var/lib/askonveksi/storage`. |\n| `ERP_STORAGE_DRIVER` | Tidak | `supabase` (default), `hybrid`, atau `local`. |\n| `WHATSAPP_MEDIA_BUCKET` | Tidak | Default `whatsapp-media`. |\n| `ERP_STORAGE_BACKUP_DIR` | Tidak | Default `/var/backups/askonveksi` untuk `npm run storage:backup`. |\n\nContoh `.env` lokal untuk presentasi (path absolut agar tetap aman saat `npm start`):\n\n```dotenv\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/home/<user>/askonveksi-storage\n```\n\nContoh produksi di `$DEPLOY_PATH/shared/.env`:\n\n```dotenv\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n```\n\nAturan validasi (`lib/storage/local-store.mjs`):\n\n- Driver tidak dikenal → error, bukan diam-diam memakai Supabase.\n- Produksi + driver ≠ `supabase`: `ERP_STORAGE_DIR` wajib diset dan absolut.\n- Path di dalam folder aplikasi hanya diberi peringatan agar `npm start` lokal tetap bisa dipakai; di VPS tetap gunakan volume di luar release.\n\n## 3. Mode driver\n\n| Driver | Tulis | Baca | Dipakai kapan |\n|---|---|---|---|\n| `supabase` | Supabase Storage | Supabase Storage | Default; perilaku lama, tanpa perubahan. |\n| `hybrid` | VPS **dan** Supabase (fail-hard) | VPS dulu, fallback Supabase | Masa transisi/backfill. File lama tetap tampil, upload baru masuk VPS. |\n| `local` | VPS saja | VPS saja | Setelah backfill dan grace period. |\n\n### Hybrid fail-hard\n\n1. Tulis ke VPS.\n2. Tulis ke Supabase.\n3. Jika Supabase gagal, salinan VPS dihapus dan operasi dianggap gagal.\n\nDengan begitu, rollback ke driver `supabase` tidak kehilangan file yang baru diunggah. Kegagalan rollback dicatat sebagai `[erp-storage] hybrid-put-rollback`.\n\n## 4. Alur fitur\n\n### Upload gambar/PDF\n\n1. Server Action memvalidasi tipe dan ukuran.\n2. `erpStorage(bucket).upload(path, bytes, { contentType, upsert })` menulis ke VPS.\n3. Database menyimpan path relatif yang sama seperti sebelumnya.\n\nTitik upload: desain PO (`app/actions/design.ts`), revisi/penjahit (`app/actions/production.ts`, `app/actions/crm.ts`), logo/tanda tangan (`app/actions/master-data.ts`), bukti bayar (`lib/payment-proof.ts`), lampiran WhatsApp (`app/actions/whatsapp.ts`), dan worker WhatsApp.\n\n### Edit/ganti gambar\n\n- File baru ditulis dengan path baru, lalu database diarahkan ke path baru.\n- File lama dihapus setelah operasi database berhasil, sama seperti perilaku Supabase sebelumnya.\n- `upsert: true` dipakai hanya saat menimpa path yang sama (mis. penyimpanan versi desain).\n\n### Hapus gambar\n\n- `erpStorage(bucket).remove([...])` menghapus di VPS.\n- Pada `hybrid`, penghapusan juga dilakukan di Supabase.\n- File yang sudah hilang tidak membuat operasi gagal.\n\n### Membaca gambar\n\n- Route memakai `erpStorage(bucket).download(path)` dan mengembalikan `Response` dengan header yang sama seperti sebelumnya.\n- Pada `hybrid`, jika file belum ada di VPS, route membaca Supabase dan mencatat `[erp-storage] fallback-supabase` (dibatasi 10 menit per path).\n\n## 5. Menyiapkan VPS\n\n```bash\nsudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage\nsudo install -d -o askonveksi -g askonveksi -m 0750 /var/backups/askonveksi\n```\n\nPastikan user PM2 dapat menulis:\n\n```bash\nsudo -u askonveksi test -w /var/lib/askonveksi/storage && echo OK\n```\n\nTambahkan env ke `$DEPLOY_PATH/shared/.env`, lalu deploy/restart. Deploy workflow memverifikasi bahwa `ERP_STORAGE_DIR` ada, absolut, di luar `DEPLOY_PATH`, dan writable saat driver bukan `supabase`.\n\n## 6. Migrasi file lama (backfill)\n\nScript: `scripts/migrate-storage-to-vps.mjs`.\n\n```bash\n# pratinjau jumlah/byte\nnpm run storage:migrate -- --dry-run\n\n# salin file yang belum ada / ukurannya berbeda (idempoten)\nnpm run storage:migrate\n\n# bandingkan remote vs lokal; exit != 0 bila ada selisih\nnpm run storage:verify\n```\n\nScript membaca bucket `crm-po-designs`, `business-assets`, `payment-proofs`, dan `whatsapp-media`, lalu menulis dengan `putFile(..., { upsert: true })`. File dengan ukuran sama dilewati sehingga aman dijalankan ulang.\n\nJalankan sebagai user aplikasi, bukan root:\n\n```bash\nsudo -u askonveksi -H bash -lc '\n  set -euo pipefail\n  cd /path/ke/repo\n  set -a; . \"$DEPLOY_PATH/shared/.env\"; set +a\n  node scripts/migrate-storage-to-vps.mjs --dry-run\n  node scripts/migrate-storage-to-vps.mjs\n  node scripts/migrate-storage-to-vps.mjs --verify\n'\n```\n\nJika terpaksa root, perbaiki ownership sebelum restart:\n\n```bash\nsudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage\nsudo find /var/lib/askonveksi/storage -type f -exec chmod 0640 {} +\n```\n\n## 7. Backup dan restore\n\n### Backup harian\n\n```bash\nnpm run storage:backup\n```\n\nScript membuat `$ERP_STORAGE_BACKUP_DIR/erp-storage-<STAMP>.tar.gz`, mode `0600`, dan menyimpan 14 arsip terbaru (ubah dengan `ERP_STORAGE_BACKUP_KEEP`).\n\nCron user aplikasi:\n\n```cron\n15 2 * * * /path/ke/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1\n```\n\nAktifkan salinan offsite, misalnya:\n\n```cron\n0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h\n```\n\n### Restore\n\n```bash\npm2 stop <pm2-app> <pm2-wa>\ntar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz\nsudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage\npm2 start <pm2-app> <pm2-wa>\nnpm run storage:verify\n```\n\nRestore database Supabase dan file VPS harus dari waktu yang berdekatan. Path di database menunjuk ke file; file yang hilang menghasilkan 404, bukan crash.\n\n## 8. Rollback\n\n| Kondisi | Tindakan |\n|---|---|\n| Bug saat hybrid | Set `ERP_STORAGE_DRIVER=supabase`, restart app + worker. Upload baru kembali ke Supabase; file yang sudah hybrid ada di kedua tempat. |\n| File VPS rusak/hilang | Restore tar terbaru, perbaiki ownership, jalankan `npm run storage:verify`. |\n| Worker `ERR_MODULE_NOT_FOUND` | Pastikan `lib/storage/local-store.mjs` ada di release dan tarball (deploy workflow sudah memverifikasi). |\n| Semua gambar 404 setelah pindah driver | Cek `ERP_STORAGE_DIR`, ownership `askonveksi`, dan hasil `storage:verify`; jangan arahkan ke folder release. |\n\n## 9. Troubleshooting\n\n- **`ERP_STORAGE_DIR wajib diset`** — driver bukan `supabase` tetapi env kosong.\n- **`ERP_STORAGE_DIR wajib berupa path absolut`** — gunakan `/var/lib/...`, bukan `./data/...`, di produksi.\n- **`Path penyimpanan tidak valid`** — path dari database mengandung `..`, backslash, NUL, atau segmen tersembunyi. Periksa data, jangan melemahkan validasi.\n- **`File sudah ada`** — upload `upsert: false` ke path yang sudah terisi. Gunakan path unik atau `upsert: true` bila memang menimpa.\n- **`hybrid-put-rollback`** — tulis Supabase gagal; periksa kredensial/bucket. File VPS sudah dibersihkan.\n- **`fallback-supabase` sering muncul** — backfill belum selesai; jalankan `storage:verify` lalu migrasi.\n\n## 10. Checklist presentasi lokal\n\n1. Isi `.env`: `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` absolut.\n2. Pastikan `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan `DATABASE_URL` masih terisi.\n3. Jalankan `npm run dev` (atau `npm run build && npm start`).\n4. Upload desain/logo/bukti bayar, lalu cek file muncul di `$ERP_STORAGE_DIR/<bucket>/...`.\n5. Ganti gambar, pastikan pratinjau berubah dan file lama terhapus.\n6. Hapus gambar, pastikan route mengembalikan 404 dan file VPS hilang.\n7. Kirim pesan WhatsApp berlampiran bila worker aktif, lalu cek media di `whatsapp-media/`.\n",
  "path": "/home/haydar/Code/askonveksi/askonveksi/docs/PANDUAN_STORAGE_ERP.md"
}
```

Created file successfully: docs/PANDUAN_STORAGE_ERP.md

**Tool: shell**

**Input:**
```json
{
  "command": "chmod +x scripts/backup-erp-storage.sh && node --check scripts/migrate-storage-to-vps.mjs && node --check worker/whatsapp.mjs && bash -n scripts/backup-erp-storage.sh",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(no output)

---

## Assistant

_Thinking:_

Now update FILE_TO_VPS.md to match warning behavior and mark implementation? Maybe not necessary for code, but consistency. We'll do later after tests.

Add ERP vars to local `.env` for presentation. Need inspect `.env` structure without printing secrets. Use grep keys. We know no ERP vars. We'll append with absolute path. Which driver? `hybrid` to keep old images visible. But if parser has existing `ERP_STORAGE_DRIVER` absent. Append at end. Use shell `grep -q`. Set `ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage` (inside cwd; warn only in production). Or outside cwd to avoid warn: `/home/haydar/Code/askonveksi-storage`. The summary says under project data directory. Use project `data/erp-storage`; .gitignore likely ignores data. Let's check .gitignore.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"data\\|storage\" .gitignore | head -30; echo \"---ENV KEYS---\"; grep -oE '^[A-Z0-9_]+' .env | sort",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

49:/.data/
52:/data/
---ENV KEYS---
ALLOW_DEMO_DATA
BOOTSTRAP_OWNER_EMAIL
BOOTSTRAP_OWNER_NAME
BOOTSTRAP_OWNER_PASSWORD
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_URL
PUBLIC_LEAD_RATE_LIMIT_SECRET
SUPABASE_SECRET_KEY
WHATSAPP_AUTH_PATH
WHATSAPP_HEALTH_PORT
WHATSAPP_MEDIA_BUCKET
WHATSAPP_TIMEZONE
WHATSAPP_WORKER_ID
WHATSAPP_WORKER_SECRET


**Tool: shell**

**Input:**
```json
{
  "command": "ls -la data 2>/dev/null || true; ls -ld /home/haydar/Code/askonveksi/askonveksi/data 2>/dev/null || true",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

total 20
drwxr-xr-x  5 haydar haydar 4096 Oct 18 01:06 .
drwxr-xr-x 27 haydar haydar 4096 Oct 22 22:46 ..
drwxr-xr-x  3 haydar haydar 4096 Oct 18 01:06 backups
drwxr-xr-x  3 haydar haydar 4096 Oct 18 01:06 cms
drwxr-xr-x  2 haydar haydar 4096 Oct 18 01:06 uploads
drwxr-xr-x 5 haydar haydar 4096 Oct 18 01:06 /home/haydar/Code/askonveksi/askonveksi/data


---

## Assistant

_Thinking:_

Interesting data already has backups/cms/uploads. Append ERP vars. Use absolute path. For presentation, hybrid. But if Supabase bucket files are old and local empty, hybrid fallback works. New uploads write both. Deleting old image: local remove (ENOENT ignored) + Supabase remove works. Editing old image: download fallback, upload new to both, remove old original (local no-op + Supabase). Perfect.

Append via shell.

**Tool: shell**

**Input:**
```json
{
  "command": "if ! grep -q '^ERP_STORAGE_DRIVER=' .env; then\n  printf '\\n# ERP binaries: VPS disk; database keeps relative paths.\\nERP_STORAGE_DRIVER=hybrid\\nERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage\\n' >> .env\nfi\ngrep -n '^ERP_STORAGE_' .env",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

20:ERP_STORAGE_DRIVER=hybrid
21:ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage


---

## Assistant

_Thinking:_

Now run lint, tests, tsc, build. But before, check package.json valid JSON, and inspect routes for issues. Also `erp-storage.ts` import of `../supabase/admin.ts` may fail Next build? Let's run lint first (fast-ish). Then full test. Then build.

Potential lint issue: `app/actions/production.ts` etc. import order? ESLint Next likely simple. `erp-storage.ts` uses `any`? No.

Potential issue: `Blob` in Node types. tsc passed.

Run lint and tests in parallel.

Kode utama selesai. Sekarang verifikasi: lint dan seluruh test dulu.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run lint 2>&1 | tail -60",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 lint
> eslint


/home/haydar/Code/askonveksi/askonveksi/app/actions/crm.ts
   561:65  warning  'addonGross' is defined but never used  @typescript-eslint/no-unused-vars
  2279:49  warning  '_addons' is defined but never used     @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/components/analytics/analytics-content-client.tsx
   26:3   warning  'Check' is defined but never used                        @typescript-eslint/no-unused-vars
   35:3   warning  'Filter' is defined but never used                       @typescript-eslint/no-unused-vars
   37:3   warning  'Handshake' is defined but never used                    @typescript-eslint/no-unused-vars
   39:3   warning  'Lightbulb' is defined but never used                    @typescript-eslint/no-unused-vars
  110:10  warning  'filterDropdownOpen' is assigned a value but never used  @typescript-eslint/no-unused-vars
  166:12  warning  'handleApplyFilter' is defined but never used            @typescript-eslint/no-unused-vars
  176:12  warning  'handleClearAllFilters' is defined but never used        @typescript-eslint/no-unused-vars
  194:9   warning  'hasActiveFilters' is assigned a value but never used    @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/components/analytics/lead-sources/lead-sources-content-client.tsx
   8:3   warning  'Users' is defined but never used                    @typescript-eslint/no-unused-vars
  14:3   warning  'TrendingUp' is defined but never used               @typescript-eslint/no-unused-vars
  20:3   warning  'SlidersHorizontal' is defined but never used        @typescript-eslint/no-unused-vars
  29:3   warning  'CheckCircle2' is defined but never used             @typescript-eslint/no-unused-vars
  30:3   warning  'AlertTriangle' is defined but never used            @typescript-eslint/no-unused-vars
  31:3   warning  'Lightbulb' is defined but never used                @typescript-eslint/no-unused-vars
  34:15  warning  'PieChartIcon' is defined but never used             @typescript-eslint/no-unused-vars
  53:3   warning  'LeadSourceChannelDetail' is defined but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/components/dashboard/dashboard-content-client.tsx
   18:3   warning  'Legend' is defined but never used                      @typescript-eslint/no-unused-vars
   35:3   warning  'Compass' is defined but never used                     @typescript-eslint/no-unused-vars
   43:3   warning  'Megaphone' is defined but never used                   @typescript-eslint/no-unused-vars
   50:3   warning  'Receipt' is defined but never used                     @typescript-eslint/no-unused-vars
   85:10  warning  'getLeadSourceIcon' is defined but never used           @typescript-eslint/no-unused-vars
  114:10  warning  'formatDonutOmzet' is defined but never used            @typescript-eslint/no-unused-vars
  337:9   warning  'leadSourcesMerged' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/lib/crm/analytics-data.ts
    7:26  warning  'formatPercentage' is defined but never used                @typescript-eslint/no-unused-vars
  340:9   warning  'prevLeadDateCondition' is assigned a value but never used  @typescript-eslint/no-unused-vars
  888:9   warning  'prevLeadCount' is assigned a value but never used          @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/lib/crm/lead-sources-data.ts
    7:26  warning  'formatPercentage' is defined but never used         @typescript-eslint/no-unused-vars
  268:5   warning  'allLeadSources' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/scripts/import-agustus-2026.mjs
  35:10  warning  'readFileSync' is defined but never used  @typescript-eslint/no-unused-vars

✖ 31 problems (0 errors, 31 warnings)



**Tool: shell**

**Input:**
```json
{
  "command": "npm test 2>&1 | tail -80",
  "timeout": 600000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

✔ G2: detail Work Order hanya lihat; Detail Desain dikunci DEVELOPER (0.295307ms)
(node:134643) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/production/validation.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ workflow Produksi memiliki dua jalur yang disepakati (3.115684ms)
✔ Work Order dibuat otomatis dan idempoten dari pembayaran serta data PO (1.270811ms)
✔ Work Order satu-ke-banyak dengan Sales Order per item PO dan menyimpan urutan tahap (1.258239ms)
✔ migrasi Produksi menutup Data API dan mengaktifkan RLS (0.511121ms)
✔ perpindahan tahap divalidasi server dan memakai optimistic concurrency (0.821152ms)
✔ board produksi auto-refresh setelah kartu dipindah (0.309417ms)
✔ Kendala kartu dihapus saat proses maju, tidak tersentuh saat masuk Retur (0.531273ms)
✔ alasan Mundur langsung (REVERT) menimpa Text Area Kendala kartu beserta jejak waktunya (0.34277ms)
✔ kartu membawa pil Retur atau Wajib QC selalu di posisi paling atas kolom tahap; kolom Retur tetap terbaru di atas (0.504758ms)
✔ kartu kanban menampilkan tanggal Kendala dan Masuk Pada (1.17223ms)
✔ transaksi perpindahan tahap memakai anggaran waktu yang lebih longgar (0.324663ms)
✔ mundur langsung dengan alasan wajib tanpa parkir Retur; badge Retur menempel permanen (4.142207ms)
✔ peringatan Wajib QC menempel saat kartu ditarik mundur dari QC dan dilepas saat kartu masuk QC lagi (0.607131ms)
✔ Non-Jersey dapat melewati tahap dengan kendala opsional dan jejak status (0.99882ms)
✔ kartu demo memakai ID Work Order tetap tanpa melonggarkan ID relasi (0.809427ms)
✔ seed development membuat satu kartu tiap jalur secara idempotent dan terproteksi (1.102294ms)
✔ kanban Produksi punya tiga jalur bertingkat dengan filter kategori produk kedua (1.221654ms)
✔ kartu Retur berdiam di kolom Retur sampai dipindahkan, badge bertahan, merah hilang di Selesai (0.537877ms)
✔ halaman Produksi menampilkan tab jalur dan chip kategori dengan pilihan pertama otomatis (0.243266ms)
✔ halaman detail kembali ke kanban pada grup dan kategori yang sama (0.168456ms)
✔ backfill kategori produk PO lama hanya mengisi PO yang masih kosong (0.178733ms)
✔ tanggal kanban diserialisasi di dalam cache sehingga cache hit tetap berupa string (0.208745ms)
✔ Jersey: kartu ber-badge Retur/Wajib QC boleh melewati tahap; kartu biasa tetap satu-ke-satu (0.472767ms)
(node:134695) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/site.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ metadata utama menargetkan pencarian konveksi lokal (1.249693ms)
(node:134741) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/whatsapp/core.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ nomor WhatsApp Indonesia dinormalisasi ke kode negara (1.739379ms)
✔ pesan invoice menyertakan template dan menghapus kalimat deadline saat tanggal kosong (0.92739ms)
✔ worker menagih pembayaran per target dan menjadwalkan reminder order berikutnya (0.37217ms)
✔ pola repeat order 6, 5 berulang dari tanggal order, termasuk akhir bulan (1.759071ms)
✔ campaign memvalidasi tanggal WIB dan variabel penerima (2.856057ms)
✔ pagination campaign membatasi parameter URL yang tidak valid (0.450565ms)
✔ switch campaign hanya menerima nilai boolean dan versi yang valid (2.029191ms)
✔ campaign hanya dikendalikan oleh switch, tanpa pembatalan permanen (0.430849ms)
✔ penghapusan campaign memerlukan versi valid dan menjaga riwayat job (0.926099ms)
✔ template hanya menerima variabel yang diizinkan (0.992069ms)
✔ pengiriman menunggu jam operasional Jakarta (0.327508ms)
✔ pesan manual dikirim segera tanpa aturan jam automasi (0.14562ms)
✔ campaign test memakai job terpisah tanpa customer (9.940858ms)
✔ penerbitan invoice menjadwalkan PDF dan pesan pada saat transaksi diterbitkan (0.255416ms)
✔ pairing ulang meminta kode baru pada socket worker yang masih aktif (0.38387ms)
(node:134743) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/whatsapp/health.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ health WhatsApp mengklasifikasikan seluruh kondisi akun (1.65056ms)
✔ perubahan health hanya memberi notifikasi setelah status awal diketahui (0.528871ms)
✔ banner hilang hanya ketika koneksi sehat dan tidak ada job gagal (0.322739ms)
✔ endpoint membatasi data berdasarkan sesi dan pemilik job (5.420325ms)
✔ Admin Customer mengelola akun WhatsApp tanpa mendapat akses Data Master (1.381063ms)
✔ logout membersihkan pemicu pairing agar status tidak mental kembali (0.851022ms)
✔ hapus nomor hanya menandai flag; worker menghapus bertahap di latar (1.26138ms)
✔ toast flash dideduplikasi lintas pemasangan PageMessage (1.868625ms)
(node:134744) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/whatsapp/browser.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ akses Sales dibatasi ke conversation customer miliknya (3.771903ms)
✔ endpoint hanya mengirim field bubble dan melarang cache HTTP (0.567548ms)
✔ query mengambil 200 pesan terbaru lalu membaliknya menjadi kronologis (0.296938ms)
✔ cache dan loading dipisahkan berdasarkan conversation (0.450633ms)
ℹ tests 340
ℹ suites 0
ℹ pass 340
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1119.286921


---

## Assistant

_Thinking:_

Lint 0 errors, tests 340 pass. Now build. But before build, need examine whether build environment has env? `.env` loaded by Next; driver hybrid, absolute path. Build may try to prerender public routes that call storage; `assertStorageReady` in production sees absolute path inside cwd -> warns only. Good.

Run build. Next 16 uses Turbopack by default? `next build` maybe webpack. Could take a while. Use timeout 600000.

Lint bersih (0 error) dan 340 test lulus. Sekarang build produksi.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run build 2>&1 | tail -120",
  "timeout": 900000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

    ./app/actions/crm.ts
    ./app/(app)/customers/page.tsx


  Finalizing page optimization ...

Route (app)                                                      Revalidate  Expire
┌ ○ /                                                                    1h      1y
├ ○ /_not-found
├ ƒ /absensi
├ ƒ /absensi/laporan
├ ƒ /account/password
├ ƒ /admin/users
├ ƒ /analytics
├ ƒ /analytics/lead-sources
├ ƒ /api/absensi/[id]/foto
├ ƒ /api/cms/media
├ ƒ /api/crm/analytics
├ ƒ /api/crm/analytics/lead-sources
├ ƒ /api/crm/badge-counts
├ ƒ /api/crm/broadcast-date-template
├ ƒ /api/crm/customers
├ ƒ /api/crm/dashboard
├ ƒ /api/crm/dashboard/trends
├ ƒ /api/crm/invoice/[id]/pdf
├ ƒ /api/crm/payment-transactions/[id]/kwitansi
├ ƒ /api/crm/payment-transactions/[id]/proof
├ ƒ /api/crm/pipeline
├ ƒ /api/crm/purchase-order/[id]/attachments/[attachmentId]
├ ƒ /api/crm/purchase-order/[id]/deposit/proof
├ ƒ /api/crm/purchase-order/[id]/items/[itemId]/penjahit-design
├ ƒ /api/crm/purchase-order/[id]/pdf
├ ƒ /api/crm/roster-preview
├ ƒ /api/crm/roster-template
├ ƒ /api/desain/[taskId]/attachments/[attachmentId]
├ ƒ /api/export/[dataset]
├ ƒ /api/export/analysis-workbook
├ ƒ /api/export/finance-workbook
├ ƒ /api/flash-message
├ ƒ /api/keuangan/pengeluaran/[id]/bukti
├ ƒ /api/master-data/business-profile/logo
├ ƒ /api/master-data/business-profile/signature
├ ƒ /api/produksi/board
├ ƒ /api/public/business-logo
├ ƒ /api/public/leads
├ ƒ /api/whatsapp/conversations/[id]/messages
├ ƒ /api/whatsapp/deletions
├ ƒ /api/whatsapp/health
├ ƒ /api/whatsapp/media/[id]
├ ƒ /campaigns
├ ƒ /cms
├ ƒ /cms-preview
├ ƒ /cms/beranda
├ ƒ /cms/katalog-kain
├ ƒ /cms/kontak
├ ƒ /cms/pengaturan
├ ƒ /cms/portofolio
├ ƒ /cms/produk
├ ƒ /cms/produk/[slug]
├ ƒ /cms/riwayat
├ ƒ /cms/riwayat/[file]
├ ƒ /cms/size-chart
├ ○ /contact                                                             1h      1y
├ ƒ /crm
├ ƒ /crm/follow-up
├ ƒ /crm/follow-up/settings
├ ƒ /crm/invoices
├ ƒ /crm/pelanggan
├ ƒ /crm/pelanggan/[id]
├ ƒ /crm/peluang/[id]
├ ƒ /crm/prospek
├ ƒ /crm/purchase-orders
├ ƒ /crm/sales-orders
├ ƒ /customers
├ ƒ /customers/[id]
├ ƒ /dashboard
├ ƒ /detail-desain
├ ƒ /detail-desain/[workOrderId]
├ ○ /katalog-kain                                                        1h      1y
├ ƒ /keuangan
├ ƒ /keuangan/laporan
├ ƒ /keuangan/pemasukan
├ ƒ /keuangan/pengeluaran
├ ƒ /keuangan/pengeluaran/riwayat
├ ○ /landing
├ ƒ /log-aktivitas
├ ƒ /login
├ ƒ /master-data/business-profile
├ ƒ /master-data/customer-types
├ ƒ /master-data/garment-sizes
├ ƒ /master-data/invoice-settings
├ ƒ /master-data/lead-sources
├ ƒ /master-data/payment-methods
├ ƒ /master-data/product-categories
├ ƒ /master-data/whatsapp/accounts
├ ƒ /master-data/whatsapp/templates
├ ƒ /media/[...path]
├ ○ /portofolio                                                          1h      1y
├   /produk/[slug]
│ ├ ● /produk/kemeja                                                     1h      1y
│ ├ ● /produk/pdh                                                        1h      1y
│ ├ ● /produk/jaket                                                      1h      1y
│ └ ● [+21 more paths]
├ ƒ /produksi
├ ƒ /produksi/[id]
├ ○ /robots.txt
├ ƒ /sales-orders/[id]
├ ƒ /settings
├ ○ /sitemap.xml
├ ○ /size-chart                                                          1h      1y
├ ƒ /whatsapp
└ ƒ /whatsapp/jobs


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand



---

## Assistant

_Thinking:_

Build succeeded (no error at tail, route table shown). Need confirm exit code? Shell would show if failed? It returned output with no explicit error; likely 0. Let's check `.next/BUILD_ID` and maybe run `git diff` review. Also need integration test with actual local store + adapter to simulate upload/edit/delete. Unit tests cover local adapter. But we should also test path with actual project env? We can write a quick temp script using local-store to simulate exactly:
- upload new, overwrite upsert, remove. Already tests.
Maybe test `erpStorage` in `hybrid` without Supabase impossible.

Need inspect `app/api/master-data/business-profile/logo/route.ts` for `data.type` usage. Adapter provides type. Good.

Need check all modified files for accidental leftover imports or changed behavior. Use git diff.

Build sukses. Saya review diff menyeluruh untuk memastikan tidak ada import tertinggal atau perilaku yang berubah.

**Tool: shell**

**Input:**
```json
{
  "command": "git status --short && echo \"---DIFF STAT---\" && git diff --stat && echo \"---UNTRACKED---\" && git status --short | grep '^??'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

 M .env.example
 M .github/workflows/deploy.yml
 M README.md
 M app/actions/crm.ts
 M app/actions/design.ts
 M app/actions/master-data.ts
 M app/actions/production.ts
 M app/actions/whatsapp.ts
 M app/api/crm/invoice/[id]/pdf/route.ts
 M app/api/crm/payment-transactions/[id]/kwitansi/route.ts
 M app/api/crm/payment-transactions/[id]/proof/route.ts
 M app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
 M app/api/crm/purchase-order/[id]/deposit/proof/route.ts
 M app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
 M app/api/crm/purchase-order/[id]/pdf/route.ts
 M app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
 M app/api/keuangan/pengeluaran/[id]/bukti/route.ts
 M app/api/master-data/business-profile/logo/route.ts
 M app/api/master-data/business-profile/signature/route.ts
 M app/api/public/business-logo/route.ts
 M app/api/whatsapp/media/[id]/route.ts
 M lib/payment-proof.ts
 M package.json
 M tests/business-profile.test.mjs
 M tests/crm-validation.test.mjs
 M worker/whatsapp.mjs
?? FILE_TO_VPS.md
?? docs/PANDUAN_STORAGE_ERP.md
?? lib/storage/
?? scripts/backup-erp-storage.sh
?? scripts/migrate-storage-to-vps.mjs
?? tests/erp-storage.test.mjs
---DIFF STAT---
 .env.example                                       |  8 +++
 .github/workflows/deploy.yml                       | 15 ++++-
 README.md                                          |  1 +
 app/actions/crm.ts                                 |  4 +-
 app/actions/design.ts                              |  6 +-
 app/actions/master-data.ts                         | 10 +--
 app/actions/production.ts                          | 12 ++--
 app/actions/whatsapp.ts                            |  6 +-
 app/api/crm/invoice/[id]/pdf/route.ts              |  6 +-
 .../payment-transactions/[id]/kwitansi/route.ts    |  4 +-
 .../crm/payment-transactions/[id]/proof/route.ts   |  4 +-
 .../[id]/attachments/[attachmentId]/route.ts       |  6 +-
 .../crm/purchase-order/[id]/deposit/proof/route.ts |  4 +-
 .../[id]/items/[itemId]/penjahit-design/route.ts   |  6 +-
 app/api/crm/purchase-order/[id]/pdf/route.ts       |  9 ++-
 .../[taskId]/attachments/[attachmentId]/route.ts   |  4 +-
 app/api/keuangan/pengeluaran/[id]/bukti/route.ts   |  4 +-
 app/api/master-data/business-profile/logo/route.ts |  4 +-
 .../business-profile/signature/route.ts            |  4 +-
 app/api/public/business-logo/route.ts              |  4 +-
 app/api/whatsapp/media/[id]/route.ts               |  4 +-
 lib/payment-proof.ts                               |  6 +-
 package.json                                       |  3 +
 tests/business-profile.test.mjs                    |  2 +-
 tests/crm-validation.test.mjs                      |  2 +-
 worker/whatsapp.mjs                                | 76 +++++++++++++++++-----
 26 files changed, 141 insertions(+), 73 deletions(-)
---UNTRACKED---
?? FILE_TO_VPS.md
?? docs/PANDUAN_STORAGE_ERP.md
?? lib/storage/
?? scripts/backup-erp-storage.sh
?? scripts/migrate-storage-to-vps.mjs
?? tests/erp-storage.test.mjs


**Tool: shell**

**Input:**
```json
{
  "command": "git diff -- app/actions/design.ts app/actions/production.ts app/actions/crm.ts app/actions/master-data.ts app/actions/whatsapp.ts lib/payment-proof.ts | sed -n '1,240p'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

diff --git a/app/actions/crm.ts b/app/actions/crm.ts
index d5235cc..848fe9a 100644
--- a/app/actions/crm.ts
+++ b/app/actions/crm.ts
@@ -52,7 +52,7 @@ import {
 } from "@/lib/crm/validation";
 import { getPrismaClient } from "@/lib/prisma";
 import { proofRequired, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 import { ensureProductionWorkOrder } from "@/lib/production/service";
 import { enqueueIssuedInvoiceWhatsAppJob, enqueueManualWhatsAppMessage } from "@/lib/whatsapp/jobs";
 import { DEFAULT_ORDER_REMINDER_TEMPLATE, renderWhatsAppTemplate } from "@/lib/whatsapp/core";
@@ -1848,7 +1848,7 @@ export async function savePenjahitPlanAction(_prevState: CrmActionState, formDat
     }
     if (!deadlines.size && !uploads.length && !removals.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");
 
-    const storage = createAdminClient().storage.from("crm-po-designs");
+    const storage = erpStorage(PO_DESIGNS_BUCKET);
     try {
       for (const upload of uploads) {
         const { error } = await storage.upload(upload.path, upload.bytes, { contentType: upload.contentType, upsert: false });
diff --git a/app/actions/design.ts b/app/actions/design.ts
index 1e6a246..e639754 100644
--- a/app/actions/design.ts
+++ b/app/actions/design.ts
@@ -10,9 +10,9 @@ import { DESIGN_REVISION_LIMIT } from "@/lib/crm/constants";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { designImageContentType, designImageExtensionFor, designImageRejection } from "@/lib/design/image";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 
-const BUCKET = "crm-po-designs";
+const BUCKET = PO_DESIGNS_BUCKET;
 const MAX_FILES = 5;
 const MAX_BYTES = 5 * 1024 * 1024;
 const MAX_REVISIONS = DESIGN_REVISION_LIMIT;
@@ -118,7 +118,7 @@ export async function uploadDesignRevisionAction(formData: FormData) {
     }
     if (!uploads.length) throw new UserFacingError("Pilih minimal satu file desain.");
 
-    const storage = createAdminClient().storage.from(BUCKET);
+    const storage = erpStorage(BUCKET);
     const uploaded: string[] = [];
     let opportunityId: string;
     try {
diff --git a/app/actions/master-data.ts b/app/actions/master-data.ts
index ee588a0..f8f237a 100644
--- a/app/actions/master-data.ts
+++ b/app/actions/master-data.ts
@@ -24,7 +24,7 @@ import {
 } from "@/lib/master-data-excel";
 import { getPrismaClient } from "@/lib/prisma";
 import { SITE_LOGO_CACHE_TAG } from "@/lib/site-logo";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 
 // Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
 // (maxWait 2s / timeout 5s) bisa berakhir P2028 "melewati batas waktu",
@@ -981,7 +981,7 @@ export async function updateBusinessProfileAction(formData: FormData) {
     if (logo instanceof File && logo.size) {
       const image = await readBusinessImage(logo, "Logo");
       uploadedLogoPath = `business/logo-${randomUUID()}.${image.extension}`;
-      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
+      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
       if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
     }
 
@@ -992,7 +992,7 @@ export async function updateBusinessProfileAction(formData: FormData) {
     if (signature instanceof File && signature.size) {
       const image = await readBusinessImage(signature, "Gambar tanda tangan");
       uploadedSignaturePath = `business/signature-${randomUUID()}.${image.extension}`;
-      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
+      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
       if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
     }
     const removeSignature = formData.get("removeSignature") === "1" && !uploadedSignaturePath;
@@ -1023,8 +1023,8 @@ export async function updateBusinessProfileAction(formData: FormData) {
         });
       }, MASTER_DATA_TRANSACTION_OPTIONS);
     } catch (error) {
-      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
-      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
+      if (uploadedLogoPath) await erpStorage(BUSINESS_ASSETS_BUCKET).remove([uploadedLogoPath]);
+      if (uploadedSignaturePath) await erpStorage(BUSINESS_ASSETS_BUCKET).remove([uploadedSignaturePath]);
       throw error;
     }
     revalidatePath("/master-data/business-profile");
diff --git a/app/actions/production.ts b/app/actions/production.ts
index 1874257..9af3161 100644
--- a/app/actions/production.ts
+++ b/app/actions/production.ts
@@ -11,7 +11,7 @@ import { requireActor, requireDeveloperActor } from "@/lib/auth/session";
 import { firstValidationMessage } from "@/lib/crm/validation";
 import { designImageContentType, designImageExtensionFor, designImageRejection, sniffImageContentType } from "@/lib/design/image";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 import {
   addProductionNoteSchema,
   assignProductionStepSchema,
@@ -39,7 +39,7 @@ function revalidateProductionBoard() {
   revalidateTag("production-board", { expire: 0 });
 }
 
-const DESIGN_BUCKET = "crm-po-designs";
+const DESIGN_BUCKET = PO_DESIGNS_BUCKET;
 const MAX_DESIGN_BYTES = 5 * 1024 * 1024;
 
 const designVersionSchema = z.object({ workOrderId: z.string().trim().min(10).max(40), attachmentId: z.string().trim().min(10).max(40) });
@@ -85,7 +85,7 @@ export async function saveProductionDesignAction(formData: FormData) {
     const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
     if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
     if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
-    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
+    const storage = erpStorage(DESIGN_BUCKET);
     const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
     if (!attachment.originalPath) {
       const snapshot = await storage.exists(originalPath);
@@ -157,7 +157,7 @@ export async function overwriteProductionDesignAction(formData: FormData) {
     if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
     if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diganti.");
 
-    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
+    const storage = erpStorage(DESIGN_BUCKET);
     const folder = attachment.path.includes("/") ? attachment.path.slice(0, attachment.path.lastIndexOf("/")) : "design";
     const nextPath = `${folder}/${randomUUID()}.${designImageExtensionFor(contentType)}`;
     const { error: uploadError } = await storage.upload(nextPath, bytes, { contentType, upsert: false });
@@ -241,7 +241,7 @@ export async function resetProductionDesignAction(formData: FormData) {
     let originalSize: number | undefined;
     let restoredContentType: "image/png" | "image/jpeg" | undefined;
     if (attachment.originalPath) {
-      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
+      const storage = erpStorage(DESIGN_BUCKET);
       const { data: original, error: downloadError } = await storage.download(attachment.originalPath);
       if (downloadError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
       const originalBytes = new Uint8Array(await original.arrayBuffer());
@@ -293,7 +293,7 @@ export async function sendProductionDesignAction(formData: FormData) {
     }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
     if (attachment.originalPath) {
       try {
-        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
+        const { error } = await erpStorage(DESIGN_BUCKET).remove([attachment.originalPath]);
         if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
         else {
           try { await getPrismaClient().designAttachment.update({ where: { id: attachment.id }, data: { originalPath: null } }); }
diff --git a/app/actions/whatsapp.ts b/app/actions/whatsapp.ts
index 96ba208..8a078f7 100644
--- a/app/actions/whatsapp.ts
+++ b/app/actions/whatsapp.ts
@@ -9,7 +9,7 @@ import { requireActor } from "@/lib/auth/session";
 import { nextCustomerNo } from "@/lib/crm/numbers";
 import { createCustomerSchema, entityIdSchema, firstValidationMessage } from "@/lib/crm/validation";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, WHATSAPP_MEDIA_BUCKET } from "@/lib/storage/erp-storage";
 import { normalizeWhatsAppNumber, remoteJidForNumber, whatsappAccountSchema, whatsappTemplateSchema } from "@/lib/whatsapp/core";
 import { enqueueInvoiceWhatsAppMessage, enqueueManualWhatsAppMessage, ensureCustomerWhatsAppConversation, getInvoiceWhatsAppMessage } from "@/lib/whatsapp/jobs";
 
@@ -187,7 +187,7 @@ export async function sendWhatsAppMessageAction(formData: FormData) {
       if (!mimeType) throw new UserFacingError("Lampiran harus berupa PDF, JPG, PNG, atau WebP yang valid.");
       const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `lampiran-${randomUUID()}`;
       const path = `outbound/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
-      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
+      const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
       if (result.error) throw new UserFacingError("Lampiran belum dapat disimpan.");
       attachment = { path, mimeType, fileName: safeName, sizeBytes: file.size, kind: mimeType.startsWith("image/") ? "IMAGE" : "DOCUMENT" };
     }
@@ -196,7 +196,7 @@ export async function sendWhatsAppMessageAction(formData: FormData) {
       refreshWhatsApp();
       return flashMessagePath(`/whatsapp?conversation=${resultId}`, "notice", "Pesan dijadwalkan untuk dikirim.");
     } catch (error) {
-      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
+      if (attachment) await erpStorage(WHATSAPP_MEDIA_BUCKET).remove([attachment.path]);
       throw error;
     }
   });
diff --git a/lib/payment-proof.ts b/lib/payment-proof.ts
index aee2df4..48fbb63 100644
--- a/lib/payment-proof.ts
+++ b/lib/payment-proof.ts
@@ -3,7 +3,7 @@ import "server-only";
 import { randomUUID } from "node:crypto";
 
 import { UserFacingError } from "@/lib/actions/response";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage } from "@/lib/storage/erp-storage";
 
 export const PAYMENT_PROOF_BUCKET = "payment-proofs";
 export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
@@ -29,11 +29,11 @@ export async function uploadPaymentProof(value: FormDataEntryValue | null, owner
   if (!mime || !types.has(value.type) || value.type !== mime) throw new UserFacingError("Bukti harus PDF, JPEG, PNG, atau WebP yang valid.");
   const extension = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
   const proofPath = `${owner}/${randomUUID()}.${extension}`;
-  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
+  const { error } = await erpStorage(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
   if (error) throw new UserFacingError("Bukti tidak dapat diunggah.");
   return { proofPath, proofFileName: value.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || `bukti.${extension}`, proofMimeType: mime, proofSize: value.size };
 }
 
 export async function deletePaymentProof(path: string | null | undefined) {
-  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
+  if (path) await erpStorage(PAYMENT_PROOF_BUCKET).remove([path]);
 }


---

## Assistant

_Thinking:_

Diff looks good. Check route diffs.

**Tool: shell**

**Input:**
```json
{
  "command": "git diff -- app/api | sed -n '1,320p'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

diff --git a/app/api/crm/invoice/[id]/pdf/route.ts b/app/api/crm/invoice/[id]/pdf/route.ts
index 78a2b98..612f201 100644
--- a/app/api/crm/invoice/[id]/pdf/route.ts
+++ b/app/api/crm/invoice/[id]/pdf/route.ts
@@ -4,7 +4,7 @@ import { normalizePdfImage } from "@/lib/crm/pdf-image";
 import { requireActor } from "@/lib/auth/session";
 import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 import { downloadFilename } from "@/lib/download-filename";
 import { timingSafeEqual } from "node:crypto";
 
@@ -86,7 +86,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   const logoPath = invoice.status === "DRAFT" ? currentBusiness?.logoPath : invoice.snapshotBusinessLogoPath ?? currentBusiness?.logoPath;
   let logoBytes: Uint8Array | undefined;
   if (logoPath) {
-    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
+    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
     if (data) {
       try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { logoBytes = undefined; }
     }
@@ -94,7 +94,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   const signaturePath = invoice.snapshotSignaturePath ?? currentBusiness?.signaturePath ?? null;
   let signatureBytes: Uint8Array | undefined;
   if (signaturePath) {
-    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
+    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(signaturePath);
     if (data) {
       try { signatureBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { signatureBytes = undefined; }
     }
diff --git a/app/api/crm/payment-transactions/[id]/kwitansi/route.ts b/app/api/crm/payment-transactions/[id]/kwitansi/route.ts
index 275f6d7..10e9a98 100644
--- a/app/api/crm/payment-transactions/[id]/kwitansi/route.ts
+++ b/app/api/crm/payment-transactions/[id]/kwitansi/route.ts
@@ -5,7 +5,7 @@ import { normalizePdfImage } from "@/lib/crm/pdf-image";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { downloadFilename } from "@/lib/download-filename";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -39,7 +39,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   ]);
   if (!tx || tx.status !== "ACTIVE") return new Response("Kwitansi tidak ditemukan.", { status: 404 });
   const order = tx.payment.salesOrder;
-  const bucket = createAdminClient().storage.from("business-assets");
+  const bucket = erpStorage(BUSINESS_ASSETS_BUCKET);
   const readImage = async (path: string | null) => {
     if (!path) return undefined;
     const { data: file } = await bucket.download(path);
diff --git a/app/api/crm/payment-transactions/[id]/proof/route.ts b/app/api/crm/payment-transactions/[id]/proof/route.ts
index 7b2ab80..e39d2b7 100644
--- a/app/api/crm/payment-transactions/[id]/proof/route.ts
+++ b/app/api/crm/payment-transactions/[id]/proof/route.ts
@@ -3,7 +3,7 @@ import { requireActor } from "@/lib/auth/session";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -13,7 +13,7 @@ export async function GET(_request: Request, { params }: { params: Promise<{ id:
   if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
   const proof = await getPrismaClient().paymentTransaction.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
   if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
-  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
+  const { data, error } = await erpStorage(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
   if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
   const inline = proof.proofMimeType.startsWith("image/");
   return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
diff --git a/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts b/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
index ce5eebd..85b78c1 100644
--- a/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
+++ b/app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
@@ -2,9 +2,9 @@ import { requireActor } from "@/lib/auth/session";
 import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 
-const BUCKET = "crm-po-designs";
+const BUCKET = PO_DESIGNS_BUCKET;
 
 export async function GET(
   _request: Request,
@@ -27,7 +27,7 @@ export async function GET(
   });
   if (!attachment) return new Response("Lampiran tidak ditemukan.", { status: 404 });
 
-  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
+  const { data, error } = await erpStorage(BUCKET).download(attachment.path);
   if (error) return new Response("Lampiran tidak dapat dibuka.", { status: 404 });
 
   return new Response(await data.arrayBuffer(), {
diff --git a/app/api/crm/purchase-order/[id]/deposit/proof/route.ts b/app/api/crm/purchase-order/[id]/deposit/proof/route.ts
index d1cc0dc..5244165 100644
--- a/app/api/crm/purchase-order/[id]/deposit/proof/route.ts
+++ b/app/api/crm/purchase-order/[id]/deposit/proof/route.ts
@@ -3,7 +3,7 @@ import { requireActor } from "@/lib/auth/session";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -21,7 +21,7 @@ export async function GET(_request: Request, { params }: { params: Promise<{ id:
     select: { proofPath: true, proofFileName: true, proofMimeType: true },
   });
   if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
-  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
+  const { data, error } = await erpStorage(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
   if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
   const inline = proof.proofMimeType.startsWith("image/");
   return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
diff --git a/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts b/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
index 3d88fa5..1416a9c 100644
--- a/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
+++ b/app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
@@ -2,9 +2,9 @@ import { requireActor } from "@/lib/auth/session";
 import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 
-const BUCKET = "crm-po-designs";
+const BUCKET = PO_DESIGNS_BUCKET;
 
 /** Pratinjau desain penjahit per produk (Sprint 11 R3) — dipakai thumbnail dialog & PDF. */
 export async function GET(
@@ -28,7 +28,7 @@ export async function GET(
   });
   if (!item?.penjahitDesignPath) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });
 
-  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
+  const { data, error } = await erpStorage(BUCKET).download(item.penjahitDesignPath);
   if (error) return new Response("Desain penjahit tidak dapat dibuka.", { status: 404 });
 
   return new Response(await data.arrayBuffer(), {
diff --git a/app/api/crm/purchase-order/[id]/pdf/route.ts b/app/api/crm/purchase-order/[id]/pdf/route.ts
index 4db6047..6565a19 100644
--- a/app/api/crm/purchase-order/[id]/pdf/route.ts
+++ b/app/api/crm/purchase-order/[id]/pdf/route.ts
@@ -6,7 +6,7 @@ import { normalizePdfImage } from "@/lib/crm/pdf-image";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { downloadFilename } from "@/lib/download-filename";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -44,13 +44,12 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
     prisma.businessProfile.findUnique({ where: { id: "default" } }),
   ]);
   if (!purchaseOrder) return new Response("PO tidak ditemukan.", { status: 404 });
-  const storage = createAdminClient().storage;
   // Snapshot lebih dulu; PO lama yang snapshot logonya kosong jatuh ke logo profil terkini,
   // lalu ke logo brand terbaru supaya kop PO tidak pernah memakai ikon lama.
   const logoPath = purchaseOrder.snapshotBusinessLogoPath ?? currentBusiness?.logoPath ?? null;
   let logoBytes = await readDefaultBrandLogoPng();
   if (logoPath) {
-    const { data } = await storage.from("business-assets").download(logoPath);
+    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
     if (data) {
       try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { /* Gunakan logo bawaan. */ }
     }
@@ -75,7 +74,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
             if (!path) return null;
             const label = `Desain penjahit ${item.name}`;
             const originalName = item.penjahitDesignName ?? label;
-            const { data } = await storage.from("crm-po-designs").download(path);
+            const { data } = await erpStorage(PO_DESIGNS_BUCKET).download(path);
             if (!data) return null;
             try {
               return { kind: "PENJAHIT_DESIGN", label, originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId: item.id as string | null };
@@ -91,7 +90,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
     // bukan jatuh ke lembar penutup di akhir dokumen.
     const itemId = ("itemId" in item && typeof item.itemId === "string" ? item.itemId : null) || null;
     if (item.contentType === "application/pdf") return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
-    const { data } = await storage.from("crm-po-designs").download(item.path);
+    const { data } = await erpStorage(PO_DESIGNS_BUCKET).download(item.path);
     if (!data) return null;
     try {
       return { kind: item.kind, label, originalName: item.originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId };
diff --git a/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts b/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
index 8855113..b5549bf 100644
--- a/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
+++ b/app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
@@ -3,7 +3,7 @@ import { requireActor } from "@/lib/auth/session";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { sniffImageContentType } from "@/lib/design/image";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
 
 export async function GET(request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
   try { await requireActor([...DESIGN_VIEW_ROLES, ...DETAIL_DESIGN_VIEW_ROLES]); } catch { return new Response("Anda tidak berhak membuka file desain.", { status: 403 }); }
@@ -14,7 +14,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ task
   const attachment = await getPrismaClient().designAttachment.findFirst({ where: { id: attachmentId.data, designRevision: { designTaskId: taskId.data } }, select: { path: true, originalPath: true, originalName: true, contentType: true } });
   if (!attachment) return new Response("File desain tidak ditemukan.", { status: 404 });
   const original = new URL(request.url).searchParams.has("original");
-  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
+  const { data, error } = await erpStorage(PO_DESIGNS_BUCKET).download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
   if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
   const disposition = new URL(request.url).searchParams.has("inline") ? "inline" : "attachment";
   // Salinan desain awal dan revisi lama bisa berjenis beda dari kolom contentType,
diff --git a/app/api/keuangan/pengeluaran/[id]/bukti/route.ts b/app/api/keuangan/pengeluaran/[id]/bukti/route.ts
index 9fc9f76..58a6fdf 100644
--- a/app/api/keuangan/pengeluaran/[id]/bukti/route.ts
+++ b/app/api/keuangan/pengeluaran/[id]/bukti/route.ts
@@ -3,7 +3,7 @@ import { requireActor } from "@/lib/auth/session";
 import { entityIdSchema } from "@/lib/crm/validation";
 import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -13,7 +13,7 @@ export async function GET(_request: Request, { params }: { params: Promise<{ id:
   if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
   const proof = await getPrismaClient().expense.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
   if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
-  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
+  const { data, error } = await erpStorage(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
   if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
   const inline = proof.proofMimeType.startsWith("image/");
   return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
diff --git a/app/api/master-data/business-profile/logo/route.ts b/app/api/master-data/business-profile/logo/route.ts
index 74b7304..31dc5f1 100644
--- a/app/api/master-data/business-profile/logo/route.ts
+++ b/app/api/master-data/business-profile/logo/route.ts
@@ -1,6 +1,6 @@
 import { requireActor } from "@/lib/auth/session";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -12,7 +12,7 @@ export async function GET() {
   }
   const profile = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { logoPath: true } });
   if (!profile?.logoPath) return new Response("Logo tidak ditemukan.", { status: 404 });
-  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.logoPath);
+  const { data, error } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(profile.logoPath);
   if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
   return new Response(await data.arrayBuffer(), {
     headers: {
diff --git a/app/api/master-data/business-profile/signature/route.ts b/app/api/master-data/business-profile/signature/route.ts
index a2c80f0..a2d783e 100644
--- a/app/api/master-data/business-profile/signature/route.ts
+++ b/app/api/master-data/business-profile/signature/route.ts
@@ -1,6 +1,6 @@
 import { requireActor } from "@/lib/auth/session";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -12,7 +12,7 @@ export async function GET() {
   }
   const profile = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { signaturePath: true } });
   if (!profile?.signaturePath) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
-  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
+  const { data, error } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(profile.signaturePath);
   if (error || !data) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
   return new Response(await data.arrayBuffer(), {
     headers: {
diff --git a/app/api/public/business-logo/route.ts b/app/api/public/business-logo/route.ts
index af1b0d2..8aa8350 100644
--- a/app/api/public/business-logo/route.ts
+++ b/app/api/public/business-logo/route.ts
@@ -1,5 +1,5 @@
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 /** Jangan di-prerender saat build; logo harus selalu mengikuti profil terbaru. */
@@ -31,7 +31,7 @@ export async function GET() {
     if (!logoPath || !contentType || !LOGO_PATH_PATTERN.test(logoPath)) {
       return new Response("Logo tidak ditemukan.", { status: 404 });
     }
-    const { data, error } = await createAdminClient().storage.from("business-assets").download(logoPath);
+    const { data, error } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
     if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
     // URL memuat `?v=` versi profil, jadi cache immutable aman: ganti logo = URL baru.
     return new Response(await data.arrayBuffer(), {
diff --git a/app/api/whatsapp/media/[id]/route.ts b/app/api/whatsapp/media/[id]/route.ts
index f1694ef..b250528 100644
--- a/app/api/whatsapp/media/[id]/route.ts
+++ b/app/api/whatsapp/media/[id]/route.ts
@@ -1,7 +1,7 @@
 import { CRM_ROLES } from "@/lib/auth/permissions";
 import { requireActor } from "@/lib/auth/session";
 import { getPrismaClient } from "@/lib/prisma";
-import { createAdminClient } from "@/lib/supabase/admin";
+import { erpStorage, WHATSAPP_MEDIA_BUCKET } from "@/lib/storage/erp-storage";
 
 export const runtime = "nodejs";
 
@@ -17,7 +17,7 @@ export async function GET(_request: Request, { params }: { params: Promise<{ id:
     select: { mediaPath: true, mediaMimeType: true, mediaFileName: true },
   });
   if (!message?.mediaPath) return new Response("Lampiran tidak ditemukan.", { status: 404 });
-  const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").download(message.mediaPath);
+  const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).download(message.mediaPath);
   if (result.error) return new Response("Lampiran tidak ditemukan.", { status: 404 });
   const inlineImage = ["image/jpeg", "image/png", "image/webp"].includes(message.mediaMimeType ?? "");


**Tool: shell**

**Input:**
```json
{
  "command": "git diff -- worker/whatsapp.mjs .github/workflows/deploy.yml .env.example package.json README.md tests | sed -n '1,360p'",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

diff --git a/.env.example b/.env.example
index d4bcf66..853b4be 100644
--- a/.env.example
+++ b/.env.example
@@ -19,6 +19,14 @@ WHATSAPP_WORKER_ID=worker-1
 WHATSAPP_WORKER_SECRET=replace-with-at-least-32-random-characters
 WHATSAPP_HEALTH_PORT=3001
 WHATSAPP_MEDIA_BUCKET=whatsapp-media
+# Biner ERP (gambar desain, bukti bayar, logo, media WA) disimpan di disk VPS.
+# Database tetap menyimpan path relatif; jangan menambahkan prefix vps/ ke path.
+# Lokal: cukup ./data/erp-storage. Produksi: path absolut di luar release,
+# mis. /var/lib/askonveksi/storage, dan driver hybrid lalu local.
+ERP_STORAGE_DIR=./data/erp-storage
+ERP_STORAGE_DRIVER=supabase
+# Opsional: lokasi backup harian ERP (script storage:backup)
+ERP_STORAGE_BACKUP_DIR=/var/backups/askonveksi
 # CMS website: simpan di volume persisten (bukan di dalam folder build)
 CMS_DATA_DIR=/var/lib/askonveksi/cms
 CMS_UPLOAD_DIR=/var/lib/askonveksi/uploads
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 355b874..cf3e703 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -59,11 +59,14 @@ jobs:
 
       - name: Package release
         run: |
-          mkdir -p deploy_package/.next deploy_package/worker
+          mkdir -p deploy_package/.next deploy_package/worker deploy_package/lib/storage
           cp -r .next/standalone/. deploy_package/
           cp -r .next/static deploy_package/.next/static
           if [ -d public ]; then cp -aT public deploy_package/public; fi
           cp worker/whatsapp.mjs deploy_package/worker/whatsapp.mjs
+          # Worker imports shared storage primitives; the standalone trace does
+          # not include this repo file, so copy it explicitly.
+          cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs
           # Worker deps missing from the standalone trace (dotenv, baileys,
           # supabase + transitive). Copied from this same npm-ci tree so
           # versions stay identical; skips what standalone already ships.
@@ -71,6 +74,7 @@ jobs:
           tar -czf release.tar.gz -C deploy_package .
           tar -tzf release.tar.gz | grep -qx './server.js'
           tar -tzf release.tar.gz | grep -qx './worker/whatsapp.mjs'
+          tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs'
           # File-level checks: standalone dirs may be pruned, so a present
           # directory proves nothing. Fail the build here, not on the VPS.
           for f in node_modules/dotenv/package.json node_modules/@whiskeysockets/baileys/package.json node_modules/@supabase/supabase-js/package.json node_modules/ws/wrapper.mjs node_modules/pg/esm/index.mjs node_modules/pg-pool/index.js node_modules/postgres-array/index.js node_modules/.prisma/client/default.js node_modules/@prisma/client/default.js; do
@@ -189,6 +193,15 @@ jobs:
           install -d "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared"
           test -w "$DEPLOY_PATH" || { echo 'DEPLOY_PATH is not writable by the deploy user.'; exit 1; }
           test -f "$DEPLOY_PATH/shared/.env" || { echo 'Shared runtime .env is missing.'; exit 1; }
+          ERP_DRIVER="$(grep -E '^ERP_STORAGE_DRIVER=' "$DEPLOY_PATH/shared/.env" 2>/dev/null | cut -d= -f2 | tr -d ' "' || true)"
+          if [ -n "$ERP_DRIVER" ] && [ "$ERP_DRIVER" != "supabase" ]; then
+            ERP_DIR="$(grep -E '^ERP_STORAGE_DIR=' "$DEPLOY_PATH/shared/.env" 2>/dev/null | cut -d= -f2- | tr -d ' "' || true)"
+            [ -n "$ERP_DIR" ] || { echo 'ERP_STORAGE_DIR wajib diisi saat driver bukan supabase.'; exit 1; }
+            case "$ERP_DIR" in /*) ;; *) echo 'ERP_STORAGE_DIR harus path absolut.'; exit 1 ;; esac
+            case "$ERP_DIR" in "$DEPLOY_PATH"/*) echo 'ERP_STORAGE_DIR tidak boleh di dalam DEPLOY_PATH (release akan dipangkas).'; exit 1 ;; esac
+            test -d "$ERP_DIR" || { echo "ERP_STORAGE_DIR tidak ada: $ERP_DIR"; exit 1; }
+            test -w "$ERP_DIR" || { echo "ERP_STORAGE_DIR tidak writable oleh user deploy: $ERP_DIR"; exit 1; }
+          fi
           test -f "$ARCHIVE" || { echo 'Release archive is missing.'; exit 1; }
           test ! -e "$RELEASE_DIR" || { echo 'Release directory already exists.'; exit 1; }
           mkdir "$RELEASE_DIR"
diff --git a/README.md b/README.md
index b470183..3404354 100644
--- a/README.md
+++ b/README.md
@@ -46,6 +46,7 @@ Script aman dijalankan ulang, menolak berjalan saat `NODE_ENV=production`, dan m
 - Tabel aplikasi mengaktifkan RLS serta mencabut akses langsung role `anon`/`authenticated`.
 - PO Disepakati, invoice Terbit, dan Sales Order disimpan sebagai dokumen historis yang tidak diedit langsung.
 - Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.
+- Biner ERP (gambar desain, bukti pembayaran, logo/tanda tangan, media WhatsApp) disimpan di disk VPS melalui `ERP_STORAGE_DIR`; database Supabase hanya menyimpan teks, metadata, dan path relatif. Panduan operasional, migrasi, dan backup ada di [docs/PANDUAN_STORAGE_ERP.md](docs/PANDUAN_STORAGE_ERP.md).
 - Foto absensi disimpan di filesystem VPS (`ATTENDANCE_UPLOAD_DIR`); database hanya menyimpan path relatif. Foto diambil langsung dari kamera (tanpa unggah galeri), di-reencode ke WebP, dan disajikan lewat route terautentikasi.
 - Absensi memakai jam WIB, toleransi keterlambatan, hari kerja, dan kalender hari libur. Owner/Developer mengelola laporan, koreksi, catatan manual, dan pengaturan; Developer tetap memiliki akses penuh ke fitur baru.
 
diff --git a/package.json b/package.json
index 2982d17..ce61bf8 100644
--- a/package.json
+++ b/package.json
@@ -28,6 +28,9 @@
     "cms:validate": "node scripts/cms-validate.mjs",
     "cms:backup": "node scripts/cms-backup.mjs",
     "cms:clean-orphans": "node scripts/cms-clean-orphans.mjs",
+    "storage:migrate": "node scripts/migrate-storage-to-vps.mjs",
+    "storage:verify": "node scripts/migrate-storage-to-vps.mjs --verify",
+    "storage:backup": "bash scripts/backup-erp-storage.sh",
     "db:seed:production-demo": "node scripts/seed-production-demo.mjs",
     "db:backfill:production": "node scripts/backfill-production-work-orders.mjs",
     "db:backfill:po-categories": "node scripts/backfill-purchase-order-categories.mjs",
diff --git a/tests/business-profile.test.mjs b/tests/business-profile.test.mjs
index 5e5187b..048703b 100644
--- a/tests/business-profile.test.mjs
+++ b/tests/business-profile.test.mjs
@@ -64,7 +64,7 @@ test("unggah gambar tanda tangan divalidasi dan disimpan ke bucket privat", () =
   assert.match(helper, /0x89, 0x50, 0x4e, 0x47/, "magic bytes PNG diperiksa");
   assert.match(pageSource, /name="signature" type="file"/);
   assert.match(pageSource, /api\/master-data\/business-profile\/signature/);
-  assert.match(signatureRouteSource, /business-assets/);
+  assert.match(signatureRouteSource, /BUSINESS_ASSETS_BUCKET/);
 });
 
 test("snapshot invoice menyimpan gambar tanda tangan dan tidak lagi menulis rekening", () => {
diff --git a/tests/crm-validation.test.mjs b/tests/crm-validation.test.mjs
index 2170916..992e56c 100644
--- a/tests/crm-validation.test.mjs
+++ b/tests/crm-validation.test.mjs
@@ -1068,7 +1068,7 @@ test("revisi CRM membuat PO, invoice, pembayaran, dan bucket desain privat", asy
   assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
   assert.match(sql, /REVOKE ALL ON TABLE "PurchaseOrder"[\s\S]+FROM anon, authenticated/);
   // Halaman persetujuan desain dihapus: unggahan langsung menjadi acuan produksi.
-  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
+  assert.match(designActionSource, /erpStorage\(BUCKET\)/);
   assert.match(designActionSource, /storage\.upload\(attachment\.path/);
   assert.doesNotMatch(designActionSource, /reviewDesignRevisionAction|APPROVED/);
   const productionActionSource = await readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8");
diff --git a/worker/whatsapp.mjs b/worker/whatsapp.mjs
index 34aa5d1..754e2de 100644
--- a/worker/whatsapp.mjs
+++ b/worker/whatsapp.mjs
@@ -8,6 +8,7 @@ import { createServer } from "node:http";
 import path from "node:path";
 import { Client } from "pg";
 import { createClient } from "@supabase/supabase-js";
+import { getFile, putFile, removeFiles, resolveSafe, storageDriver } from "../lib/storage/local-store.mjs";
 
 const connectionString = process.env.DATABASE_URL;
 if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
@@ -22,6 +23,61 @@ const lockClient = new Client({ connectionString: lockConnectionString });
 const authRoot = path.resolve(process.env.WHATSAPP_AUTH_PATH || ".data/baileys-auth");
 const workerId = process.env.WHATSAPP_WORKER_ID || `worker-${process.pid}`;
 const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
+
+const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
+const mediaStorageReady = () => storageDriver() === "local" || supabaseConfigured();
+
+function supabaseMedia() {
+  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
+  const key = process.env.SUPABASE_SECRET_KEY;
+  if (!url || !key) throw new Error("Konfigurasi Supabase Storage worker belum tersedia.");
+  return createClient(url, key, { auth: { persistSession: false } }).storage.from(mediaBucket);
+}
+
+/** Tulis media ke driver aktif. Hybrid wajib sukses di VPS dan Supabase. */
+async function storeWorkerMedia(mediaPath, buffer, contentType) {
+  const driver = storageDriver();
+  if (driver !== "supabase") await putFile(mediaBucket, mediaPath, buffer, { upsert: false });
+  if (driver === "local") return;
+
+  const uploaded = await supabaseMedia().upload(mediaPath, buffer, { contentType, upsert: false });
+  if (!uploaded.error) return;
+  if (driver === "hybrid") await removeFiles(mediaBucket, [mediaPath]);
+  throw uploaded.error;
+}
+
+/** Baca media dari VPS lebih dulu; hybrid jatuh ke Supabase untuk file lama. */
+async function readWorkerMedia(mediaPath) {
+  const driver = storageDriver();
+  if (driver !== "supabase") {
+    if (!resolveSafe(mediaBucket, mediaPath)) throw new Error("Path media tidak valid.");
+    const buffer = await getFile(mediaBucket, mediaPath);
+    if (buffer) return buffer;
+    if (driver === "local") throw new Error("Lampiran tidak ditemukan.");
+  }
+  const downloaded = await supabaseMedia().download(mediaPath);
+  if (downloaded.error || !downloaded.data) throw downloaded.error || new Error("Lampiran tidak ditemukan.");
+  return Buffer.from(await downloaded.data.arrayBuffer());
+}
+
+async function deleteWorkerMedia(paths) {
+  if (!paths.length) return;
+  const driver = storageDriver();
+  if (driver !== "supabase") {
+    const { failed } = await removeFiles(mediaBucket, paths);
+    for (const item of failed) console.error(`[whatsapp-worker] delete media lokal ${item.path}: ${item.message}`);
+  }
+  if (driver === "local") return;
+  if (!supabaseConfigured()) {
+    console.error("[whatsapp-worker] Supabase Storage belum dikonfigurasi; media Supabase tidak dihapus.");
+    return;
+  }
+  const storage = supabaseMedia();
+  for (let index = 0; index < paths.length; index += 100) {
+    const { error } = await storage.remove(paths.slice(index, index + 100));
+    if (error) console.error(`[whatsapp-worker] delete media: ${cleanError(error)}`);
+  }
+}
 const campaignRecipientAllowlist = process.env.BROADCAST_TEST_RECIPIENTS
   ? new Set(process.env.BROADCAST_TEST_RECIPIENTS.split(",").map(normalizeNumber).filter(Boolean))
   : null;
@@ -202,7 +258,7 @@ async function storeInbound(accountId, message, remoteJid) {
   let mediaMimeType = null;
   let mediaFileName = null;
   let mediaSizeBytes = null;
-  if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
+  if (kind !== "TEXT" && mediaStorageReady()) {
     const buffer = await downloadMediaMessage(message, "buffer", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });
     // Cap 5MB agar muat di worker 200M (sebelumnya 10MB).
     if (buffer.length <= 5 * 1024 * 1024) {
@@ -210,9 +266,7 @@ async function storeInbound(accountId, message, remoteJid) {
       mediaMimeType = media?.mimetype || "application/octet-stream";
       mediaFileName = media?.fileName || `${message.key.id}.${kind === "IMAGE" ? "jpg" : "bin"}`;
       mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;
-      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
-      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
-      if (uploaded.error) throw uploaded.error;
+      await storeWorkerMedia(mediaPath, buffer, mediaMimeType);
       mediaSizeBytes = buffer.length;
     }
   }
@@ -255,13 +309,7 @@ async function processAccountDeletion(account) {
   });
   if (messages.length) {
     const paths = [...new Set(messages.map((message) => message.mediaPath).filter(Boolean))];
-    if (paths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
-      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
-      for (let index = 0; index < paths.length; index += 100) {
-        const { error } = await supabase.storage.from(mediaBucket).remove(paths.slice(index, index + 100));
-        if (error) console.error(`[whatsapp-worker] delete media ${account.id}: ${cleanError(error)}`);
-      }
-    }
+    if (paths.length) await deleteWorkerMedia(paths);
     await prisma.whatsAppMessage.deleteMany({ where: { id: { in: messages.map((message) => message.id) } } });
     return;
   }
@@ -605,11 +653,7 @@ async function processOneJob() {
       if (!response.ok) throw new Error("PDF invoice gagal diambil.");
       content = { document: Buffer.from(await response.arrayBuffer()), mimetype: "application/pdf", fileName: `invoice-${job.invoiceId}.pdf`, caption: text };
     } else if (payload.attachment?.path) {
-      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Konfigurasi Storage worker belum tersedia.");
-      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
-      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);
-      if (downloaded.error) throw downloaded.error;
-      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
+      const buffer = await readWorkerMedia(payload.attachment.path);
       content = payload.attachment.kind === "IMAGE"
         ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }
         : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };


---

## Assistant

_Thinking:_

One concern: In `readWorkerMedia`, when driver is `hybrid` and file is missing locally, `getFile` returns null; then falls to Supabase. If Supabase has no creds, `supabaseMedia` throws; fine. When driver is `supabase`, it skips local. Good.

Another concern: `mediaStorageReady()` for `hybrid` requires Supabase creds. If driver hybrid and creds missing, inbound media skipped, but `storageDriver` returns hybrid and `storeWorkerMedia` would throw if called. Since mediaStorageReady false, not called. Outbound `readWorkerMedia` would throw when Supabase missing. Fine.

Now, important: `lib/storage/local-store.mjs` uses `storeRoot()` `resolve(process.env.ERP_STORAGE_DIR || join(process.cwd(), "data/erp-storage"))`. With `ERP_STORAGE_DIR` absolute, fine.

Potential issue with `putFile` upsert false and `link` on some filesystems (e.g., overlayfs) works? Linux ext4 yes. On Windows? VPS Linux. Local Linux. Fine. Could use `link` failing with EPERM on some filesystems (e.g., network mount). Not relevant.

Potential issue with `putFile` upsert false: if target exists, `link` fails EEXIST; temp cleanup. Good.

Potential issue: file mode 0640 and dir 0750. Worker/app run as same user. Fine.

Potential issue with `removeFiles` on directory path: unlink fails EISDIR; logged. Fine.

Now, check build logs for warnings related to our code or `server-only`? Build succeeded. Need confirm exit code and look for errors earlier in output. The tail only shows route table. Let's re-run? No, just check `echo $?` isn't possible after. We can inspect `.next/BUILD_ID` exists and maybe build logs file? The shell tool returns no exit code. It would likely show error if nonzero but could truncate. Let's use `test -f .next/BUILD_ID && echo ok`. Fine.

Now, need integration test: actually simulate the app flows to VPS in `local` mode with adapter and representative paths. Unit test already does. But also test `PUT` "edit image" flow (overwrite upsert) and delete. Covered in test. Maybe add test for `erpStorage` with `upsert:true` overwriting. Currently adapter test only upload new, remove. Production overwrite uses upsert false new path, then remove old. The `saveProductionDesignAction` uses upload upsert true to overwrite same path. Unit test local-store covers upsert true, but adapter not. Could add one test to adapter to ensure upsert true. Good for confidence. Also test `exists` on missing returns false no error. Already after remove `exists` false.

Add adapter upsert test:
- upload path v1, upload same path v2 upsert true, download v2.
- Also test bytes returned type fallback octet-stream for no ext. Already local-store contentType test.

Maybe no need, but user wants edit image working. Let's add.

Also test `removeFiles` invalid path failure: covered.

Now, a bigger concern: `erp-storage.ts` imports `../supabase/admin.ts` with `.ts` extension. Next build succeeded, so fine.

Another concern: build with `NODE_ENV=production` and `.env` `ERP_STORAGE_DRIVER=hybrid` might have triggered warnings during build; routes are dynamic mostly. Build succeeded.

Now test scripts `storage:verify` against actual Supabase/local? Not now; would download maybe. We can run `storage:migrate --dry-run`? It lists Supabase buckets and may take; could reveal env/credentials. It might be expensive but useful. However with `.env` driver hybrid and ERP_STORAGE_DIR; script uses Supabase creds. Could run `npm run storage:migrate -- --dry-run` to verify listing works, but network and bucket sizes. It might take a while but okay. Not necessary for presentation; uploading via app is what matters. We could run `node scripts/migrate-storage-to-vps.mjs --verify` but local empty → all missing, exit 1. Not useful. Dry-run would show remote counts; good confidence in script. But accessing production Supabase storage is safe (read-only). Let's consider later.

Need test actual local adapter in a standalone runtime with `ERP_STORAGE_DRIVER=local` and paths. Unit test does. Good.

Now, update FILE_TO_VPS.md to reflect:
- Guard warning vs throw inside cwd.
- Implementation status maybe add a note at top? Not required, but the doc is the approved plan; keeping it as plan is fine. However line 205/331/614 inconsistency could confuse. Let's update precisely.

Search lines:
205: "Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset, absolut, dan berada di luar `process.cwd()`**. Kosong, relatif, atau di dalam folder release → throw ..."
Change to: wajib diset & absolut; path di dalam cwd diberi peringatan (agar `npm start` lokal tetap bisa), di VPS gunakan di luar release.
331 checklist: "wajib diset, absolut, dan di luar folder release; driver invalid → throw."
→ "wajib diset dan absolut; peringatan bila di dalam folder aplikasi; driver invalid → throw."
614 risk: "Guard: driver ≠ supabase + produksi + path relatif/di dalam cwd → throw"
→ "Guard: driver ≠ supabase + produksi + path relatif → throw; path di dalam cwd → warning."

Also line 53 summary says "wajib diset, absolut, dan di luar folder release." maybe update. Let's grep all.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -n \"di luar.*release\\|di luar.*cwd\\|di dalam.*cwd\\|di dalam folder release\\|di dalam.*release\" FILE_TO_VPS.md",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

53:4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release.
167:/var/lib/askonveksi/storage/            # ERP_STORAGE_DIR (volume persisten, di luar releases/)
184:- Jangan pernah menaruh `ERP_STORAGE_DIR` di dalam folder release (`$DEPLOY_PATH/releases/...`), karena release lama dipangkas otomatis.
205:- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset, absolut, dan berada di luar `process.cwd()`**. Kosong, relatif, atau di dalam folder release → throw (mencegah tulisan masuk folder release yang akan dihapus).
331:- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release; driver invalid → throw.
604:| 1 | Disk VPS gagal / folder salah di dalam `releases/` | Gambar hilang | Path absolut di luar release + guard produksi + backup harian/offsite + `--verify` periodik |
614:| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif/di dalam cwd → throw |


---

## Assistant

_Thinking:_

Update lines 53, 205, 331, 614. Keep advice "never inside release". Since deploy workflow actually rejects inside DEPLOY_PATH, strong protection in production deploy. Local inside cwd only warning. Good.

Also update FILE_TO_VPS status? Maybe add "Status implementasi" at top with date and checked items? Not necessary; but could be helpful. The user didn't ask. Avoid extra.

Let's edit.

**Tool: edit**

**Input:**
```json
{
  "newString": "4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset dan absolut. Deploy workflow menolak path di dalam `DEPLOY_PATH`; runtime memberi peringatan bila path berada di dalam folder aplikasi (agar `npm start` lokal tetap bisa).",
  "oldString": "4. **Guard konfigurasi produksi**: driver divalidasi; di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release.",
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Edited FILE_TO_VPS.md (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset dan absolut**. Kosong atau relatif → throw. Path di dalam `process.cwd()` → peringatan (bukan throw) agar `npm start` lokal tetap bisa; di VPS tetap gunakan volume di luar release. Deploy workflow menolak path di dalam `DEPLOY_PATH`.",
  "oldString": "- Di produksi (`NODE_ENV=production`) dan driver ≠ `supabase`: `ERP_STORAGE_DIR` **wajib diset, absolut, dan berada di luar `process.cwd()`**. Kosong, relatif, atau di dalam folder release → throw (mencegah tulisan masuk folder release yang akan dihapus).",
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Edited FILE_TO_VPS.md (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset dan absolut; path di dalam folder aplikasi diberi peringatan; driver invalid → throw.",
  "oldString": "- [ ] Di produksi, saat driver ≠ `supabase`, `ERP_STORAGE_DIR` wajib diset, absolut, dan di luar folder release; driver invalid → throw.",
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Edited FILE_TO_VPS.md (1 replacement)

**Tool: edit**

**Input:**
```json
{
  "newString": "| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif → throw; path di dalam cwd → warning; deploy menolak path di dalam DEPLOY_PATH |",
  "oldString": "| 11 | `ERP_STORAGE_DIR` lupa diset di produksi | File ditulis ke folder release yang akan dihapus | Guard: driver ≠ supabase + produksi + path relatif/di dalam cwd → throw |",
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now add adapter upsert test. Also maybe test worker helper? Worker imports dotenv/Prisma etc.; can't easily unit test. But `node --check` passed.

Add test:
```js
test("adapter local: upsert true menimpa isi dan mempertahankan path", async () => {...});
```
Also test `exists` local missing false no error. Already after remove `exists` false. Add explicit.

Let's edit test.

**Tool: edit**

**Input:**
```json
{
  "newString": "test(\"adapter local: upsert true menimpa gambar di path yang sama\", async () => {\n  const storage = erpStorage(BUCKET);\n  const path = \"design/task-6/edit-gambar.png\";\n  assert.equal((await storage.upload(path, new Uint8Array([1, 2, 3]), { contentType: \"image/png\", upsert: false })).error, null);\n  assert.equal((await storage.upload(path, new Uint8Array([9, 8, 7, 6]), { contentType: \"image/png\", upsert: true })).error, null);\n  const downloaded = await storage.download(path);\n  assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()), Buffer.from([9, 8, 7, 6]));\n  assert.equal((await storage.exists(\"design/task-6/tidak-ada.png\")).data, false);\n});\n\ntest.after(async () => {\n  await rm(storageRoot, { recursive: true, force: true });\n});",
  "oldString": "test.after(async () => {\n  await rm(storageRoot, { recursive: true, force: true });\n});",
  "path": "/home/haydar/Code/askonveksi/askonveksi/tests/erp-storage.test.mjs"
}
```

Edited tests/erp-storage.test.mjs (1 replacement)

---

## Assistant

_Thinking:_

Now run tests and tsc again.

**Tool: shell**

**Input:**
```json
{
  "command": "node --test tests/erp-storage.test.mjs 2>&1 | tail -18",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

✔ root storage mengikuti ERP_STORAGE_DIR (0.753368ms)
✔ validasi path menolak traversal, absolut, backslash, NUL, dan bucket tidak valid (0.29354ms)
✔ put -> get roundtrip untuk semua ekstensi dan path tanpa ekstensi (9.365479ms)
✔ upsert:false menolak file yang sudah ada; upsert:true menimpa tanpa sisa file temp (2.131456ms)
✔ get/stat untuk path hilang atau tidak valid mengembalikan null (0.491378ms)
✔ removeFiles mengabaikan ENOENT dan mengumpulkan path tidak valid (0.674583ms)
✔ driver invalid dan path relatif di produksi ditolak (0.290059ms)
✔ adapter local: upload, download, exists, remove (1.248396ms)
✔ adapter local: konflik upload, path invalid, dan file hilang (0.884653ms)
✔ adapter local: upsert true menimpa gambar di path yang sama (0.895428ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 120.823578


**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit 2>&1 | head -40",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(no output)

---

## Assistant

_Thinking:_

Now consider a real end-to-end simulation of action flows without auth/DB? We can simulate adapter with `ERP_STORAGE_DRIVER=local` and actual project paths, including "upload, edit, delete". Unit tests already. But maybe test `hybrid` fail-hard rollback? Can't without Supabase. We can mock? Overkill.

Important: There is a subtle issue with `erpStorage.upload` in hybrid mode and `putFile` upsert false: If the file already exists in Supabase but not VPS (old file) and an action uploads to the same path with `upsert:false`, VPS write succeeds, Supabase upload fails with "already exists" (or maybe succeeds if upsert false returns error). Then we rollback VPS and return error, causing user-visible failure. Do any flows upload to a path that might already exist in Supabase? Paths generally include randomUUID and are unique. For design revisions, path `design/<taskId>/<uuid>` unique. For logo/signature, unique. Payment proof unique. WhatsApp unique. Production overwrite uses `upsert`? Let's check: `saveProductionDesignAction` uploads to `attachment.path` with `upsert: true` (existing path, both locations). Fine. `overwriteProductionDesignAction` generates new path with uuid, upsert false. Fine. So no issue.

Another subtle issue: hybrid `remove` calls `removeFiles` then Supabase remove. If local path doesn't exist, removeFiles returns no failures; Supabase remove works. Good.

Another: hybrid `download` when local file exists but is zero-length/corrupt: returns local. Fine.

Another: `exists` local missing in hybrid calls Supabase. For `saveProductionDesignAction`, if originalPath exists only in Supabase, exists true; then no copy; later upload to `attachment.path` etc. Fine. If originalPath missing both, exists false; downloads `attachment.path` (fallback), uploads original to VPS + Supabase. Good.

Another: `resetProductionDesignAction` downloads original (fallback), uploads to attachment.path with upsert? Let's check around line 241. It uses `storage.upload(attachment.path, originalBytes, { contentType: ..., upsert: true })` likely. Good.

Now a critical concern: `lib/storage/erp-storage.ts` is imported by `lib/payment-proof.ts`, which is imported by tests. Tests dynamic import `erp-storage.ts` and `../supabase/admin.ts`. That works. But tests run with `NODE_ENV` maybe undefined, and `ERP_STORAGE_DRIVER` set to local; fine. However test file sets env globally in the same process; Node test runner runs each test file in a separate process, so no cross-file contamination. Good.

Now, `server-only` package behavior in Next build: importing `server-only` in `erp-storage.ts` is fine in server components/routes. But is `erp-storage.ts` ever imported by a client component? No, only actions/routes. Build passed, so fine.

Now, check `tests` total after adding 1: 341. Run full test again? We already ran 340 before adding; storage test 10 pass. But full test might have new failures? Only added a test; run `npm test` again at end. Build after test change not needed for code but final verification should include build; we already built before adding only test and doc. Build unaffected. But final claim should be accurate: after docs/test changes, code unchanged except docs. tsc still clean. Run full test once more and maybe build not needed. However we changed `erp-storage.ts` after the first build? Let's timeline: build occurred after type fixes? Yes, build was run after all code edits and test assertion changes? Let's verify: We fixed type in `erp-storage.ts` (exists data null) before running build? Sequence: type errors fixed, tsc clean, worker, tests assertions, deploy/env/docs/scripts, then lint/test (340 pass), then build. Wait, build was after all code edits including erp-storage final. Yes. Then after build we only added a test and edited FILE_TO_VPS/doc. So build remains valid.

But we also updated `.env` after? `.env` was updated before lint/test/build? Yes, env appended before lint/test/build? Let's check timeline: appended .env after docs/scripts, before lint/test. Build used `.env` hybrid. Good.

Now, we should verify actual runtime storage operations through the app's adapter, perhaps using a small Node script with `ERP_STORAGE_DRIVER=local` and actual path, to confirm file appears under project data. Unit test uses temp root; enough. But we can simulate and then clean up. Not necessary.

More important: run `npm run storage:migrate -- --dry-run` to ensure the migration script works with Supabase and lists buckets. This verifies credentials and script. It's read-only. But if buckets are large, listing takes time. Given presentation tomorrow, useful to know. Let's run with a timeout; dotenv loads `.env` (hybrid). The script calls `storeRoot()` (absolute project data) and lists 4 buckets. Could take a few seconds. Let's do it. Also `storage:verify` would fail because local empty; skip.

Wait: `migrate-storage-to-vps.mjs` uses `storage.from(bucket).list(prefix, { limit, offset })`; Supabase's `list` signature is `list(path?, options?)`. Fine.

Let's run dry-run.

Saya uji script migrasi dalam mode `--dry-run` (read-only) untuk memastikan kredensial dan struktur bucket terbaca.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run storage:migrate -- --dry-run 2>&1 | tail -40",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 storage:migrate
> node scripts/migrate-storage-to-vps.mjs --dry-run

[storage-migrate] driver=hybrid root=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
[migrate] path tidak valid, dilewati: crm-po-designs/design/.emptyFolderPlaceholder
[migrate] path tidak valid, dilewati: crm-po-designs/production-design-original/.emptyFolderPlaceholder
[dry-run] crm-po-designs: objects=38 bytes=12.8 MB written=36 skipped=0 failed=2
[dry-run] business-assets: objects=7 bytes=392.3 KB written=7 skipped=0 failed=0
[dry-run] payment-proofs: objects=42 bytes=14.4 MB written=42 skipped=0 failed=0
[migrate] path tidak valid, dilewati: whatsapp-media/cmtv9bgmn00006bi8p9q42uj6/.emptyFolderPlaceholder
[migrate] path tidak valid, dilewati: whatsapp-media/outbound/.emptyFolderPlaceholder
[dry-run] whatsapp-media: objects=2 bytes=0 B written=0 skipped=0 failed=2
[storage-migrate] selesai dengan 4 masalah.


---

## Assistant

_Thinking:_

Dry-run works; 4 `.emptyFolderPlaceholder` invalid due hidden segments. Those are Supabase folder placeholders, not real files. The script marks failures and exits nonzero, which could be alarming. We should skip `.emptyFolderPlaceholder` explicitly (or skip zero-byte hidden placeholder objects) without counting as failure. This is important for verify/migrate clean run. Also `whatsapp-media` objects=2 but both placeholders, bytes=0; real media maybe none. Good.

Modify listBucket to skip entries named `.emptyFolderPlaceholder` (and maybe any dotfile? Hidden files could be legitimate? Supabase uses `.emptyFolderPlaceholder` only). In migration, when listing, if item.id and item.name === ".emptyFolderPlaceholder" skip. Also in `walkLocal`, hidden skipped. This aligns. Add:
```js
if (item.name === ".emptyFolderPlaceholder") continue;
```
before path. Then dry-run no failures. Re-run. Also `--verify` would not expect placeholder. Good.

Let's edit.

Dry-run berhasil membaca semua bucket. Empat “kegagalan” hanya placeholder folder kosong Supabase; saya kecualikan agar migrasi/verify bersih.

**Tool: edit**

**Input:**
```json
{
  "newString": "      for (const item of items) {\n        // Supabase membuat objek penanda folder kosong; bukan file ERP.\n        if (item.name === \".emptyFolderPlaceholder\") continue;\n        const path = prefix ? `${prefix}/${item.name}` : item.name;",
  "oldString": "      for (const item of items) {\n        const path = prefix ? `${prefix}/${item.name}` : item.name;",
  "path": "/home/haydar/Code/askonveksi/askonveksi/scripts/migrate-storage-to-vps.mjs"
}
```

Edited scripts/migrate-storage-to-vps.mjs (1 replacement)

---

## Assistant

_Thinking:_

Re-run dry-run.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run storage:migrate -- --dry-run 2>&1 | tail -20",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 storage:migrate
> node scripts/migrate-storage-to-vps.mjs --dry-run

[storage-migrate] driver=hybrid root=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
[dry-run] crm-po-designs: objects=36 bytes=12.8 MB written=36 skipped=0 failed=0
[dry-run] business-assets: objects=7 bytes=392.3 KB written=7 skipped=0 failed=0
[dry-run] payment-proofs: objects=42 bytes=14.4 MB written=42 skipped=0 failed=0
[dry-run] whatsapp-media: objects=0 bytes=0 B written=0 skipped=0 failed=0
[storage-migrate] selesai tanpa masalah.


---

## Assistant

_Thinking:_

Good. Total 85 objects, ~27.6MB. We could actually run backfill now for presentation so old images are also on VPS (hybrid fallback works anyway). User wants all uploads to VPS; backfill old files would make local VPS complete and avoid fallback. It's safe (writes to VPS, no changes to Supabase). Should we run migration? It will download 27MB and write to `data/erp-storage`. This is beneficial and demonstrates. But plan says run backfill in Fase 5 after deploy hybrid; locally for presentation, doing it now means old images load from VPS. `hybrid` writes new ones. Let's run `npm run storage:migrate` (not dry-run), then `storage:verify`. This uses production Supabase read and local writes. 85 files, 27MB, fast. It will prove migration script. Do it. Then verify. This is a real operation, not destructive to Supabase. Should be fine.

Before that, note `payment-proofs` 42 files 14.4MB. Good.

Run migrate then verify.

Backfill aman (hanya membaca Supabase lalu menulis salinan ke VPS). Saya jalankan sekarang agar gambar lama langsung tersedia di VPS untuk presentasi, lalu verifikasi.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run storage:migrate 2>&1 | tail -30",
  "timeout": 600000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 storage:migrate
> node scripts/migrate-storage-to-vps.mjs

[storage-migrate] driver=hybrid root=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
[migrate] crm-po-designs: objects=36 bytes=12.8 MB written=36 skipped=0 failed=0
[migrate] business-assets: objects=7 bytes=392.3 KB written=7 skipped=0 failed=0
[migrate] payment-proofs: objects=42 bytes=14.4 MB written=42 skipped=0 failed=0
[migrate] whatsapp-media: objects=0 bytes=0 B written=0 skipped=0 failed=0
[storage-migrate] selesai tanpa masalah.


---

## Assistant

_Thinking:_

Now run verify. It walks local and compares. Note local may contain `.emptyFolderPlaceholder`? walkLocal skips hidden. Good. It may find extra files if migration wrote them all. Run.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run storage:verify 2>&1 | tail -30",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 storage:verify
> node scripts/migrate-storage-to-vps.mjs --verify

[storage-migrate] driver=hybrid root=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
[storage-migrate] mode verify: tidak menulis file
[verify] crm-po-designs: remote=36 (12.8 MB) local=36 missing=0 mismatched=0 extra=0
[verify] business-assets: remote=7 (392.3 KB) local=7 missing=0 mismatched=0 extra=0
[verify] payment-proofs: remote=42 (14.4 MB) local=42 missing=0 mismatched=0 extra=0
[verify] whatsapp-media: remote=0 (0 B) local=0 missing=0 mismatched=0 extra=0
[storage-migrate] selesai tanpa masalah.


---

## Assistant

_Thinking:_

Excellent. Now all old files mirrored locally. For presentation hybrid, reads hit VPS; new uploads to both; delete both.

Need now verify actual file permissions and structure. `find data/erp-storage -type f | head`, modes. Also ensure files owned by current user. Fine.

Now, potential issue: the local `.env` absolute path is inside cwd and NODE_ENV=production (`npm start`) will warn each readiness change only once. Fine.

But there is a subtle problem: `ensureStorageReady` caches readiness key including `NODE_ENV`. In Next production, first call logs warning. Fine.

Now, one more important thing: `app/api/crm/purchase-order/[id]/pdf/route.ts` `readDefaultBrandLogoPng` maybe reads from public assets, no change.

Now, update deploy workflow check: `case "$ERP_DIR" in "$DEPLOY_PATH"/*)` — if `ERP_DIR` has trailing slash or symlink path, might bypass. Fine. But `tr -d ' "'` removes quotes only, not leading spaces. Fine.

One concern: deploy workflow uses `tar -tzf release.tar.gz | grep -qx './lib/storage/local-store.mjs'`; the standalone output may include `lib/storage`? We copy after `cp -r .next/standalone/.`; then `cp lib/storage/local-store.mjs deploy_package/lib/storage/local-store.mjs`; directory exists from mkdir. Good. The tar entry should be `./lib/storage/local-store.mjs`. Good.

But the Next standalone trace may also include `lib/storage/local-store.mjs`? Irrelevant.

Now, `.github/workflows/deploy.yml` also has build env only Supabase URL/publishable key/encryption. It doesn't set `SUPABASE_SECRET_KEY`, but build likely doesn't need. Fine.

Now, Node test warning `MODULE_TYPELESS_PACKAGE_JSON` for erp-storage.ts. Existing tests have same warnings. Fine.

Now, full test again (341) and lint? Lint already clean before adding test; test JS may trigger lint warnings? ESLint targets all files including tests; our test file may have no warnings. But we added `scripts/migrate...`; lint may include it and flag unused? Let's run lint and full test at final. Build already. We should also run `npm run build` one final time? Code unchanged since build except migration script (not part of Next build) and test. `erp-storage.ts` unchanged after build. So no need, but for the claim "build passed after final changes", script/test changes don't affect build. Could run anyway to be safe, but expensive. We have time. Let's first run lint + full test.

Also need run `node scripts/collect-worker-deps.mjs /tmp/deploy-check` per plan T3.3. This may create a temp dir and copy deps; could be slow? Let's inspect script.

Backfill dan verify bersih: 85 file (27,6 MB) sekarang ada di VPS dan cocok dengan Supabase. Saya jalankan verifikasi akhir (lint, seluruh test, dan simulasi packaging worker).

**Tool: shell**

**Input:**
```json
{
  "command": "npm run lint 2>&1 | tail -25",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

  53:3   warning  'LeadSourceChannelDetail' is defined but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/components/dashboard/dashboard-content-client.tsx
   18:3   warning  'Legend' is defined but never used                      @typescript-eslint/no-unused-vars
   35:3   warning  'Compass' is defined but never used                     @typescript-eslint/no-unused-vars
   43:3   warning  'Megaphone' is defined but never used                   @typescript-eslint/no-unused-vars
   50:3   warning  'Receipt' is defined but never used                     @typescript-eslint/no-unused-vars
   85:10  warning  'getLeadSourceIcon' is defined but never used           @typescript-eslint/no-unused-vars
  114:10  warning  'formatDonutOmzet' is defined but never used            @typescript-eslint/no-unused-vars
  337:9   warning  'leadSourcesMerged' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/lib/crm/analytics-data.ts
    7:26  warning  'formatPercentage' is defined but never used                @typescript-eslint/no-unused-vars
  340:9   warning  'prevLeadDateCondition' is assigned a value but never used  @typescript-eslint/no-unused-vars
  888:9   warning  'prevLeadCount' is assigned a value but never used          @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/lib/crm/lead-sources-data.ts
    7:26  warning  'formatPercentage' is defined but never used         @typescript-eslint/no-unused-vars
  268:5   warning  'allLeadSources' is assigned a value but never used  @typescript-eslint/no-unused-vars

/home/haydar/Code/askonveksi/askonveksi/scripts/import-agustus-2026.mjs
  35:10  warning  'readFileSync' is defined but never used  @typescript-eslint/no-unused-vars

✖ 31 problems (0 errors, 31 warnings)



**Tool: shell**

**Input:**
```json
{
  "command": "npm test 2>&1 | tail -25",
  "timeout": 600000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(Use `node --trace-warnings ...` to show where the warning was created)
✔ health WhatsApp mengklasifikasikan seluruh kondisi akun (1.618973ms)
✔ perubahan health hanya memberi notifikasi setelah status awal diketahui (0.668346ms)
✔ banner hilang hanya ketika koneksi sehat dan tidak ada job gagal (0.279984ms)
✔ endpoint membatasi data berdasarkan sesi dan pemilik job (13.325307ms)
✔ Admin Customer mengelola akun WhatsApp tanpa mendapat akses Data Master (6.108977ms)
✔ logout membersihkan pemicu pairing agar status tidak mental kembali (2.521514ms)
✔ hapus nomor hanya menandai flag; worker menghapus bertahap di latar (2.786673ms)
✔ toast flash dideduplikasi lintas pemasangan PageMessage (3.440713ms)
(node:147283) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/whatsapp/browser.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ akses Sales dibatasi ke conversation customer miliknya (2.16386ms)
✔ endpoint hanya mengirim field bubble dan melarang cache HTTP (0.569256ms)
✔ query mengambil 200 pesan terbaru lalu membaliknya menjadi kronologis (0.369619ms)
✔ cache dan loading dipisahkan berdasarkan conversation (0.343535ms)
ℹ tests 341
ℹ suites 0
ℹ pass 341
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1153.749672


**Tool: shell**

**Input:**
```json
{
  "command": "rm -rf /tmp/askonveksi-deploy-check && node scripts/collect-worker-deps.mjs /tmp/askonveksi-deploy-check && test -f /tmp/askonveksi-deploy-check/node_modules/dotenv/package.json && echo \"worker-deps-ok\"",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

optional dep skipped: pg-native
optional dep skipped: jimp
optional dep skipped: audio-decode
optional dep skipped: @img/sharp-wasm32/versions
optional dep skipped: @img/sharp-darwin-arm64/sharp.node
optional dep skipped: @img/sharp-darwin-x64/sharp.node
optional dep skipped: @img/sharp-linux-arm/sharp.node
optional dep skipped: @img/sharp-linux-arm64/sharp.node
optional dep skipped: @img/sharp-linux-ppc64/sharp.node
optional dep skipped: @img/sharp-linux-riscv64/sharp.node
optional dep skipped: @img/sharp-linux-s390x/sharp.node
optional dep skipped: @img/sharp-linuxmusl-arm64/sharp.node
optional dep skipped: @img/sharp-linuxmusl-x64/sharp.node
optional dep skipped: @img/sharp-win32-arm64/sharp.node
optional dep skipped: @img/sharp-win32-ia32/sharp.node
optional dep skipped: @img/sharp-win32-x64/sharp.node
optional dep skipped: @img/sharp-freebsd-wasm32/sharp.node
optional dep skipped: @img/sharp-webcontainers-wasm32/sharp.node
optional dep skipped: @img/sharp-wasm32/sharp.node
optional dep skipped: @img/sharp-libvips-dev/include
optional dep skipped: @img/sharp-libvips-dev/cplusplus
optional dep skipped: link-preview-js
optional dep skipped: bufferutil
optional dep skipped: utf-8-validate
worker deps: 92 packages traced, 92 ensured, 0 files merged into pruned dirs
worker-deps-ok


---

## Assistant

_Thinking:_

All good. Now simulate release layout with local-store import: 
```
mkdir -p /tmp/rel/worker /tmp/rel/lib/storage
cp worker/whatsapp.mjs ... 
cp lib/storage/local-store.mjs ...
cd /tmp/rel && ERP_STORAGE_DRIVER=local ERP_STORAGE_DIR=/tmp/... node --check? 
```
`node --check` doesn't resolve imports. We can run a small import of worker? Worker connects DB and starts; not desirable. Instead `node -e "import('./worker/whatsapp.mjs')"` would execute and require DATABASE_URL; no. Could just test `node --input-type=module -e "import('./lib/storage/local-store.mjs')"`. Plan says simulate layout + env temp → no ERR_MODULE_NOT_FOUND. The worker's import is relative `../lib/storage/local-store.mjs`; from `/tmp/rel/worker/whatsapp.mjs` it resolves `/tmp/rel/lib/storage/local-store.mjs`. We can use `node --check`? It doesn't resolve. Use a stub? We can use `node --experimental-...`? Simplest: create `/tmp/rel/worker/import-check.mjs` that imports `../lib/storage/local-store.mjs` and use `node -e`. But that proves path. Actually we can run `node --input-type=module -e "import('/tmp/rel/worker/../lib/storage/local-store.mjs')"`. Fine.

But not strictly necessary; deploy workflow verification covers file presence. Still, do a quick check and clean up.

Now, one major thing: check `.env` is not tracked and data not tracked; yes gitignored.

Now, need inspect `git diff` for `.github/workflows/deploy.yml` line `case "$ERP_DIR" in "$DEPLOY_PATH"/*)`—shell `case` pattern with quoted variable plus `/*` works? In `case` patterns, quoting `$DEPLOY_PATH` prevents glob expansion of the variable, but `/*` outside quotes is a pattern wildcard. Yes: `"$DEPLOY_PATH"/*` concatenates literal path + wildcard. Should work. However if `DEPLOY_PATH=/var/www/app`, pattern `/var/www/app/*`. Good. If ERP_DIR is a symlink inside deploy path pointing outside, it passes; minor.

Now, think about security of `local-store.resolveSafe`:
- `resolve(root, bucket, relativePath)` and check startsWith bucketRoot + sep. Good.
- It rejects segments starting with `.`; Supabase paths could include hidden files, but `.emptyFolderPlaceholder` skipped. WhatsApp filenames could start with `.`? `sendWhatsAppMessageAction` safeName allows dots at start; path is `outbound/date/uuid-.name` so segment starts with uuid, fine. Payment proof owner path maybe user id, uuid. Design task IDs. Fine.
- Files with `%2e%2e` not decoded; path from DB is literal. Fine.
- Symlink attack: if an attacker can create symlinks inside storage dir, `resolve` prefix check doesn't prevent following symlink out. But only app writes files, and it creates regular files; no symlink creation from user input. However if storage dir compromised, not relevant. Could use `realpath` but complexity. Fine.

- `putFile` with `upsert:true` uses `rename`, which follows target symlink? `rename` replaces the symlink itself, not target. Good.
- `getFile` follows symlink; only if attacker creates one. Acceptable.

- `contentTypeFromPath` returns `application/octet-stream` for no ext. For WhatsApp media path no ext, route uses DB MIME; adapter `data.type` not used by R13? Let's check R13: uses `result.data.arrayBuffer` and DB MIME. Fine.

Now, one subtle issue: Next's `Blob` in Node 20? The runtime here Node 26; VPS Node 24 per deploy. Blob available. Good.

Now, verify `erpStorage` `upload` type accepts `image.bytes` from `readBusinessImage` (Uint8Array) and `bytes` from `Buffer`? `lib/payment-proof.ts` uses `new Uint8Array(await value.arrayBuffer())` likely. `design.ts` uses `ArrayBuffer`? Let's check. tsc passed, so compatible (Uint8Array). Supabase upload accepts ArrayBuffer too; our type requires Uint8Array. tsc passed, so call sites pass Uint8Array/Buffer. Buffer is a Uint8Array subtype. Good.

Now, one more concern: `const storage = erpStorage(BUCKET)` in `design.ts` and test regex `erpStorage\(BUCKET\)` passes. Good.

Now, check `app/api/desain/...` route uses `error` then `data` narrowing; tsc passed.

Now, update `FILE_TO_VPS.md` status of tasks? It still has unchecked boxes. That's fine as plan, but the user asked to implement. Could mark implemented phases in doc to avoid confusion? Maybe add a short "Status implementasi (lokal)" section at top with checked items and pending ops. This would be helpful. But editing a 674-line plan could be unnecessary. Yet if they open the doc, unchecked boxes might imply not done. We can add a status note near top:

```
> Status per 2026-10-23: Fase 1–3 implemented and verified locally ... Fase 4–6 (deploy/backfill production/grace) operational steps, not executed here. Local backfill 85 files done...
```

But `FILE_TO_VPS.md` is untracked; it's the plan. The summary says it was revised and approved. Adding status is useful. Let's inspect top lines to place.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '1,40p' FILE_TO_VPS.md",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS

> **Status: Revisi 2 — RANCANGAN, belum diimplementasikan.**
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


---

## Assistant

_Thinking:_

Update status line to reflect implemented and verified, with pending ops. Good.

**Tool: edit**

**Input:**
```json
{
  "newString": "# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS\n\n> **Status per 2026-10-23: Fase 1–3 SUDAH DIIMPLEMENTASIKAN dan diverifikasi lokal.**\n> `npm run lint` (0 error), `npx tsc --noEmit`, `npm test` (341 lulus), dan `npm run build` sukses.\n> Backfill lokal sudah dijalankan: 85 objek / ±27,6 MB dari 4 bucket ada di VPS dan `storage:verify` bersih.\n> Fase 4–6 (deploy produksi, grace period, cutover) tetap merupakan langkah operasional VPS yang belum dijalankan dari sesi ini.\n> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.4**).\n> Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.",
  "oldString": "# FILE_TO_VPS.md — Rencana Migrasi File ERP dari Supabase Storage ke VPS\n\n> **Status: Revisi 2 — RANCANGAN, belum diimplementasikan.**\n> Revisi 2 mengadopsi hasil audit kode dan mengganti beberapa keputusan revisi 1 (lihat bagian **0.4**).\n> Prinsip proyek (AGENTS.md): setiap perubahan tidak boleh mengurangi akses role DEVELOPER; semua perubahan wajib lulus `npm run lint && npx tsc --noEmit && npm test && npm run build`.",
  "path": "/home/haydar/Code/askonveksi/askonveksi/FILE_TO_VPS.md"
}
```

Edited FILE_TO_VPS.md (1 replacement)

---

## Assistant

_Thinking:_

Now simulate release layout import. Also inspect local storage files/modes, and possibly check one known image served via adapter? We can directly call `erpStorage` with local mode for a known backfilled path and verify Blob/type. But test does. Still, a real path from DB would be good. We can query DB for a design attachment path and use adapter? That needs Prisma and DB; possible with a small `node --input-type=module` importing Prisma? More complexity. The migration verify confirms files.

Let's run release import check and list storage.

**Tool: shell**

**Input:**
```json
{
  "command": "rm -rf /tmp/askonveksi-release-check && mkdir -p /tmp/askonveksi-release-check/worker /tmp/askonveksi-release-check/lib/storage && cp worker/whatsapp.mjs /tmp/askonveksi-release-check/worker/whatsapp.mjs && cp lib/storage/local-store.mjs /tmp/askonveksi-release-check/lib/storage/local-store.mjs && cd /tmp/askonveksi-release-check && ERP_STORAGE_DRIVER=local ERP_STORAGE_DIR=/tmp/askonveksi-release-check/storage node --input-type=module -e \"const m = await import('./lib/storage/local-store.mjs'); await m.putFile('whatsapp-media','acc/2026-10-23/x',Buffer.from('ok')); console.log(m.storeRoot(), (await m.getFile('whatsapp-media','acc/2026-10-23/x')).toString())\"",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

/tmp/askonveksi-release-check/storage ok


**Tool: shell**

**Input:**
```json
{
  "command": "find data/erp-storage -type f | wc -l; du -sh data/erp-storage; find data/erp-storage -type f -printf '%m %u:%g %p\\n' | head -5; find data/erp-storage -type d -printf '%m %p\\n' | head -5",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

85
28M	data/erp-storage
640 haydar:haydar data/erp-storage/business-assets/business/logo-49719931-6757-4546-8540-56a8b2b6b4b0.png
640 haydar:haydar data/erp-storage/business-assets/business/logo-7f2901f2-8e57-4f2a-86cc-7ca79c523de7.jpg
640 haydar:haydar data/erp-storage/business-assets/business/signature-0249161b-047f-47b5-9c98-d839b2067e06.jpg
640 haydar:haydar data/erp-storage/business-assets/business/signature-5303526e-bc36-4acd-bb65-5957393a9fe6.jpg
640 haydar:haydar data/erp-storage/business-assets/business/logo-3fb8fbf6-2884-45fc-9c9d-8a8e9020c05f.webp
750 data/erp-storage
750 data/erp-storage/business-assets
750 data/erp-storage/business-assets/business
750 data/erp-storage/payment-proofs
750 data/erp-storage/payment-proofs/cmtbjlwmi0000wpijxdo8tagf


---

## Assistant

_Thinking:_

Good.

Now, one thing: `find data/erp-storage -type f` count 85 exactly matches remote. Great.

Now, should we run `npm run build` again after all changes? Code changes since build: migration script, FILE doc, test. None affect build. But `scripts/` might be linted but not built. The final build from earlier is valid. However to be rigorous and because the user demands no errors, we can run build once more. It took maybe a couple minutes. Let's do it and capture exit. Also maybe `npx tsc --noEmit` already final. Build may use `.next` cache and be faster. Run final build after all code done.

Simulasi layout release berhasil (worker dapat mengimpor `local-store.mjs`), dan 85 file VPS memiliki permission `0640`, folder `0750`. Saya jalankan build final sekali lagi setelah semua perubahan.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run build 2>&1 | tail -30; test -f .next/BUILD_ID && echo \"BUILD_ID_OK\"",
  "timeout": 900000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

├ ƒ /master-data/invoice-settings
├ ƒ /master-data/lead-sources
├ ƒ /master-data/payment-methods
├ ƒ /master-data/product-categories
├ ƒ /master-data/whatsapp/accounts
├ ƒ /master-data/whatsapp/templates
├ ƒ /media/[...path]
├ ○ /portofolio                                                          1h      1y
├   /produk/[slug]
│ ├ ● /produk/kemeja                                                     1h      1y
│ ├ ● /produk/pdh                                                        1h      1y
│ ├ ● /produk/jaket                                                      1h      1y
│ └ ● [+21 more paths]
├ ƒ /produksi
├ ƒ /produksi/[id]
├ ○ /robots.txt
├ ƒ /sales-orders/[id]
├ ƒ /settings
├ ○ /sitemap.xml
├ ○ /size-chart                                                          1h      1y
├ ƒ /whatsapp
└ ƒ /whatsapp/jobs


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand

BUILD_ID_OK


---

## Assistant

_Thinking:_

Great. Now, let's think if there are any hidden issues that would break the app tomorrow:

1. **Hybrid driver + Supabase env**: `.env` has `SUPABASE_SECRET_KEY`; good.
2. **Upload via actions**: `erpStorage.upload` with hybrid writes VPS then Supabase. If Supabase bucket doesn't exist? They exist (migration listed files). Good.
3. **Delete**: hybrid removes VPS then Supabase. `removeFiles` resolves path; paths valid. Good.
4. **Edit**: 
   - Design revision upload: new path unique, writes both. Old removal? `design.ts` maybe removes old files? Let's inspect flow around upload to ensure `remove` path uses adapter. We replaced only one call in design (`const storage`), and all `storage.*` calls use it. Good.
   - Production overwrite: `storage.upload(nextPath, ..., upsert:false)`; then DB transaction; then remove old path? Let's inspect lines 160-210 to ensure no direct Supabase left (grep said none). Good.
   - Master data logo/signature: upload new path, DB transaction, remove old logo/signature via `storage`? Let's check master-data around 1000-1040; grep showed only upload/remove calls with adapter. Is there a direct `storage.remove` for old paths? The diff shows only 4 replacements, including uploads and catch rollback. How does it delete old logo? Maybe Prisma DB update only, old file left orphaned (existing behavior). Not a break.
   - CRM penjahit: adapter. Good.
5. **Reads**: all 13 routes adapter. Good.
6. **Worker**: imports local-store from release path. Deploy copies. Good.
7. **Worker hybrid**: inbound `mediaStorageReady` true if Supabase creds, writes VPS + Supabase. Outbound reads VPS first. Delete both. Good.
8. **Worker local**: no Supabase needed for media; but worker still uses Supabase DB via DATABASE_URL (Postgres), not Supabase client. `mediaStorageReady()` returns true for local. `supabaseMedia` only called if driver != local in store/delete/read. In `readWorkerMedia`, if local file missing, throws before Supabase. Good.
9. **`storageDriver()` invalid**: throws; app actions would throw, not return UserFacingError. That's config error; okay.
10. **Production guard**: `ERP_STORAGE_DIR` absolute in shared `.env` (to be set). Deploy verifies. Good.
11. **Deploy workflow**: build doesn't have `ERP_STORAGE_DIR`; `erp-storage.ts` evaluated at build? It defines `WHATSAPP_MEDIA_BUCKET` from env; no `storeRoot` at module load. No issue. Build succeeded locally with `.env`; but CI build sets `NODE_ENV=production` and Supabase public env only. Does any route execute storage at build? Dynamic routes; public business-logo is `force-dynamic` likely. Build succeeded locally; CI may differ but unlikely. `erp-storage.ts` import `server-only` is fine.
12. **`server-only` in tests**: works.
13. **`Blob` memory**: fine.
14. **Path traversal**: good.
15. **Permissions**: files 0640, dirs 0750; app user same as VPS deploy user. If migration run as app user, correct. If not, docs.
16. **Backup script**: `set -u` with `ERP_STORAGE_DIR` default; good. Rotation `tail -n +$((KEEP+1))` fine. `xargs -r` Linux.
17. **Migration script**: `.emptyFolderPlaceholder` skipped; verify counts. Good. One issue: `storeRoot()` calls `assertStorageReady`; if `NODE_ENV=production` and ERP_STORAGE_DIR absolute inside cwd, warns; okay. If driver `supabase`, `assertStorageReady` returns without requiring dir, but script requires dir explicitly. Good.
18. **Migration script when local file exists with same size but different content**: skip; plan uses size idempotency. Fine.
19. **Migration script folders**: Supabase list returns folder items with `id: null`; we queue. Could duplicate folders across pages; `folders.includes` avoids duplicates. Good.
20. **`--verify` extras**: local may have temp files `.tmp-*` hidden; skipped; fine. Could have leftover `.emptyFolderPlaceholder` local? We never write them. Good.
21. **`whatsapp-media`**: remote 0, local 0. New inbound media path has no extension; adapter `contentTypeFromPath` returns octet-stream for download Blob type. R13 uses DB MIME; worker uses DB MIME. Fine.
22. **PDF routes**: adapter returns Blob, `arrayBuffer` works. Good.
23. **`app/api/master-data/business-profile/logo/route.ts`** uses `data.type`? Let's inspect to ensure adapter supplies. tsc passed. At runtime Blob type from contentTypeFromPath. If file is `.jpg` but actual PNG, route uses path type; existing Supabase also used metadata. Fine.
24. **Public business logo** allowlist regex: unchanged.
25. **`lib/payment-proof.ts`** test maybe asserts `createAdminClient`? Full tests passed.

Now, one potential issue: the `erpStorage.upload` returns `{ data: { path }, error: null }` for local/hybrid, but existing call sites sometimes use `uploaded.data?.path`? Search.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn \"\\.upload(\" app lib --include='*.ts' --include='*.tsx' | grep -v 'storage/erp-storage' | sed -n '1,80p'; echo \"---data.path usage---\"; grep -rn \"uploaded\\.data\\|result\\.data\\|\\.data?\\.path\" app lib --include='*.ts' --include='*.tsx' | head -40",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

app/actions/master-data.ts:984:      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
app/actions/master-data.ts:995:      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
app/actions/whatsapp.ts:190:      const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
app/actions/crm.ts:1854:        const { error } = await storage.upload(upload.path, upload.bytes, { contentType: upload.contentType, upsert: false });
app/actions/production.ts:101:        const { error: copyError } = await storage.upload(originalPath, originalBytes, { contentType: sniffImageContentType(originalBytes) ?? "image/png", upsert: false });
app/actions/production.ts:108:    const { error } = await storage.upload(attachment.path, bytes, { contentType: "image/png", upsert: true });
app/actions/production.ts:163:    const { error: uploadError } = await storage.upload(nextPath, bytes, { contentType, upsert: false });
app/actions/production.ts:170:    const { error: snapshotError } = await storage.upload(originalPath, bytes, { contentType, upsert: true });
app/actions/production.ts:249:      const { error: uploadError } = await storage.upload(attachment.path, originalBytes, { contentType: restoredContentType, upsert: true });
app/actions/design.ts:126:        const { error } = await storage.upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
lib/payment-proof.ts:32:  const { error } = await erpStorage(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
---data.path usage---
app/api/whatsapp/media/[id]/route.ts:23:  return new Response(await result.data.arrayBuffer(), {
lib/storage/erp-storage.ts:171:        return result.error ? { data: null, error: result.error } : { data: result.data, error: null };
lib/storage/erp-storage.ts:186:      return result.error ? { data: null, error: result.error } : { data: result.data, error: null };


---

## Assistant

_Thinking:_

No data.path usage from uploads. Good.

Now, `storage.remove` return `{ data: null, error }`; call sites check error only. Good.

Now, one thing: Existing Supabase `upload` might accept `contentType` and use it for MIME metadata; local adapter ignores `contentType` and infers on download from extension. All paths have extensions except WhatsApp media. For WhatsApp media, read path uses DB MIME. For design paths, extension matches content type (validated). For payment proofs, extension matches. For logo/signature, extension matches. Good.

But `production.ts` `originalPath` fallback is `production-design-original/<attachmentId>.png`; uploaded original bytes may be JPEG but content type sniffed, yet path `.png`. On download, adapter `contentTypeFromPath` returns `image/png` for a JPEG. Route R1 `sniffImageContentType` overrides for design route. Production PDF route does `normalizePdfImage` and doesn't use `data.type`. PDF invoice/PO route uses normalizePdfImage. So okay. `storage.download` Blob type may be wrong for such files, but call sites don't trust it for design. Existing Supabase would set contentType from upload metadata (`sniffImageContentType(...) ?? "image/png"`), perhaps image/jpeg. Not an issue.

Now, check `app/api/desain/...` uses `sniffImageContentType(bytes)`; good.

Now, run a quick real adapter test against actual backfilled file with `ERP_STORAGE_DRIVER=local` and all bucket paths, to ensure `resolveSafe` accepts actual paths (task IDs etc.). The migration wrote them via `putFile`, so accepted. Good.

Now, check if any path contains uppercase or special chars rejected by bucket pattern? Bucket names from constants are lowercase with hyphen. Good.

Now, local `.env` has `ERP_STORAGE_DRIVER=hybrid`; `npm run dev` will use hybrid. Old images mirrored. Great for presentation.

Would it be better to set `local` instead of `hybrid` to guarantee uploads only VPS? User wants uploads to VPS; hybrid does. Reads fallback. Keep hybrid for safety.

Now, one potential presentation issue: if Supabase Storage is slow/unavailable, hybrid uploads fail (fail-hard) and user sees "gambar belum dapat disimpan" even though VPS succeeded, and file rolled back. The plan explicitly chose fail-hard. For presentation, if Supabase network is fine, okay. But the user's emphasis is VPS. Could we set `local` locally to remove dependency on Supabase Storage entirely for new uploads? Then old files are already backfilled locally (we did!), so all reads/writes work purely local. That might be *more robust* for presentation and truly "semua upload gambar ke vps". Since we backfilled all 85 files, `local` works for existing images. This is likely better: no network dependency on Supabase Storage, faster, and exactly demonstrates VPS. The DB still Supabase. The only caveat: if someone uploads and Supabase migration later expects those files in Supabase, migration script only copies Supabase→VPS, not reverse. But for local presentation, files only on VPS is fine. However if local DB is production Supabase and they create records there, the files won't exist on production VPS until copied. Hmm. They are presenting locally; not necessarily writing production data. Hybrid protects consistency with production Supabase. The plan default for transition is hybrid. The summary decision: "Local `.env` plan: use `ERP_STORAGE_DRIVER=hybrid` and an absolute `ERP_STORAGE_DIR` under the project `data/` directory for presentation compatibility." So follow that. Keep hybrid.

Now, verify `.env` not accidentally adding a newline issue. Fine.

Now, one more check: `FILE_TO_VPS.md` line 190 says `.env.example` driver supabase; okay. Docs local recommends hybrid.

Now, security: `lib/storage/erp-storage.ts` logs `path` on fallback. Paths are not secrets. Fine.

Potential issue: `removeFiles` returns failed entries with message from fs error, could include absolute path in logs? Only message. Fine.

Potential issue: `StorageError` stack not leaked to user; adapter returns message "Path penyimpanan tidak valid." or "File sudah ada." User-facing actions replace with generic messages. Good.

Now, run `git diff --check` for whitespace errors. Also ensure no CRLF. Then maybe `git status`.

**Tool: shell**

**Input:**
```json
{
  "command": "git diff --check && echo \"DIFF_CHECK_OK\"; git status --short",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

DIFF_CHECK_OK
 M .env.example
 M .github/workflows/deploy.yml
 M README.md
 M app/actions/crm.ts
 M app/actions/design.ts
 M app/actions/master-data.ts
 M app/actions/production.ts
 M app/actions/whatsapp.ts
 M app/api/crm/invoice/[id]/pdf/route.ts
 M app/api/crm/payment-transactions/[id]/kwitansi/route.ts
 M app/api/crm/payment-transactions/[id]/proof/route.ts
 M app/api/crm/purchase-order/[id]/attachments/[attachmentId]/route.ts
 M app/api/crm/purchase-order/[id]/deposit/proof/route.ts
 M app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts
 M app/api/crm/purchase-order/[id]/pdf/route.ts
 M app/api/desain/[taskId]/attachments/[attachmentId]/route.ts
 M app/api/keuangan/pengeluaran/[id]/bukti/route.ts
 M app/api/master-data/business-profile/logo/route.ts
 M app/api/master-data/business-profile/signature/route.ts
 M app/api/public/business-logo/route.ts
 M app/api/whatsapp/media/[id]/route.ts
 M lib/payment-proof.ts
 M package.json
 M tests/business-profile.test.mjs
 M tests/crm-validation.test.mjs
 M worker/whatsapp.mjs
?? FILE_TO_VPS.md
?? docs/PANDUAN_STORAGE_ERP.md
?? lib/storage/
?? scripts/backup-erp-storage.sh
?? scripts/migrate-storage-to-vps.mjs
?? tests/erp-storage.test.mjs


**Tool: shell**

**Input:**
```json
{
  "command": "npx tsc --noEmit && echo \"TSC_OK\"",
  "timeout": 180000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

TSC_OK


---

## Assistant

_Thinking:_

Now, should we start the dev server and smoke test upload? That requires auth/login and UI. Could use Playwright? Not installed. We could test storage adapter directly with real files (done). Could run `npm run dev` and hit public logo route to confirm it serves from VPS. That's a good end-to-end check without auth: `/api/public/business-logo` may be accessible publicly and reads current profile logo (if any) via `erpStorage`. We can start dev server in background and curl. But dev server may take time; `npm start` after build is faster. Start `npm start` on a port, curl `/api/public/business-logo` (should 200 if logo exists) and maybe `/api/master-data/business-profile/logo` (401). Then stop. Also could test `/media/[...path]` unrelated.

This would validate actual Next runtime compatibility (Blob, mjs import, env). Build succeeded but runtime is important. Let's do it: run `PORT=3100 npm start` in background, wait for health, curl. Need manage process. Use shell with `npm start > /tmp/askonveksi-start.log 2>&1 & echo $!`? Background tool returns and we can later kill. But instructions: background commands return immediately and notify. We can use `background: true`, then curl in separate command, then kill. Need know PID. Use `nohup` and store PID. Better use `shell` with command `PORT=3100 npm start > /tmp/askonveksi-start.log 2>&1 & echo $! > /tmp/askonveksi-start.pid` (foreground shell exits). Then poll curl with retries. Then kill. This is acceptable.

Potential issue: `.env` loaded by `next start` (Next loads .env automatically). `ERP_STORAGE_DRIVER=hybrid` and absolute path. `/api/public/business-logo` will call DB. If DB reachable, it will read profile and download from local VPS. It might also read `getPrismaClient`; works. Let's test. If no logoPath, returns 404 (still route works). Better test `/api/public/business-logo`; check status and content-type. If 200 with image, confirms VPS read path. Also test a known design attachment route requires auth (401), not useful. Public logo is best.

Could also test PDF invoice route with worker secret (no session?) It uses `timingSafeEqual` secret maybe. But requires DB and id. Not needed.

Let's start.

Saya lakukan smoke test runtime nyata: jalankan server produksi, lalu akses route logo publik yang membaca file dari VPS.

**Tool: shell**

**Input:**
```json
{
  "command": "PORT=3100 HOSTNAME=127.0.0.1 nohup npm start > /tmp/askonveksi-start.log 2>&1 & echo $! > /tmp/askonveksi-start.pid; echo \"started $(cat /tmp/askonveksi-start.pid)\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

started 152858


---

## Assistant

_Thinking:_

Poll server.

**Tool: shell**

**Input:**
```json
{
  "command": "for i in $(seq 1 30); do if curl -fsS --max-time 2 http://127.0.0.1:3100/api/public/business-logo -o /tmp/logo-check.bin; then echo \"OK after ${i}s\"; file /tmp/logo-check.bin; wc -c < /tmp/logo-check.bin; break; fi; sleep 1; done; echo \"---LOG---\"; tail -20 /tmp/askonveksi-start.log",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

OK after 1s
/tmp/logo-check.bin: RIFF (little-endian) data, WebP image, XMP metadata, EXIF metadata, with alpha, 1920x1080 
87630
---LOG---

> askonveksi@0.1.0 start
> next start

▲ Next.js 16.3.8
- Local:         http://localhost:3100
- Network:       http://100.87.77.66:3100
✓ Ready in 76ms
✓ Running next.config.ts took 30ms
⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.
[erp-storage] ERP_STORAGE_DIR berada di dalam folder aplikasi; gunakan volume persisten di luar release. { root: '/home/haydar/Code/askonveksi/askonveksi/data/erp-storage' }


---

## Assistant

_Thinking:_

Excellent! Public logo served a WebP from VPS (87630 bytes), and the guard warning appeared as expected. This is a strong end-to-end verification.

Now test upload/delete/edit via a real server action? Difficult without auth. But we can test the adapter in-process (done). We can also use an authenticated session if login credentials are in `.env` (BOOTSTRAP_OWNER_PASSWORD maybe empty). Not necessary.

Could test the worker's `readWorkerMedia` against actual media 0 files? None. No.

Could test upload through a server action using direct module import? Server actions require cookies/auth. Not easy.

We can test adapter with the actual project storage root and a temporary bucket path, simulating upload/edit/delete, then remove. This uses same code as actions. Let's run a Node script (with `ERP_STORAGE_DRIVER=local`, `ERP_STORAGE_DIR=/home/.../data/erp-storage`) importing `erp-storage.ts` and doing upload/overwrite/download/remove in a temp folder inside a real bucket, then cleanup. Unit tests already, but using real root is good. However adapter import `server-only` and Supabase admin; with local driver no network. Let's do:
```
ERP_STORAGE_DRIVER=local ERP_STORAGE_DIR=... node --input-type=module -e "const {erpStorage}=await import('./lib/storage/erp-storage.ts'); ... upload('design/__smoke__/a.png'), overwrite, download, remove..."
```
Then ensure directory removed? `removeFiles` removes file but leaves folder; cleanup with rmdir or leave empty `__smoke__` folder. We can remove folder via shell after. This is a real end-to-end storage test. Let's do it and print results.

Route publik berhasil menyajikan WebP 87 KB dari VPS. Sekarang uji adapter nyata (upload → edit → baca → hapus) di root storage proyek.

**Tool: shell**

**Input:**
```json
{
  "command": "ERP_STORAGE_DRIVER=local ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage node --input-type=module -e '\nconst { erpStorage } = await import(\"./lib/storage/erp-storage.ts\");\nconst s = erpStorage(\"crm-po-designs\");\nconst p = \"design/__smoke__/gambar.png\";\nconst a = await s.upload(p, new Uint8Array([1,2,3]), { contentType: \"image/png\", upsert: false });\nconst e1 = await s.exists(p);\nconst b = await s.upload(p, new Uint8Array([9,8,7,6]), { contentType: \"image/png\", upsert: true });\nconst d = await s.download(p);\nconst bytes = [...new Uint8Array(await d.data.arrayBuffer())];\nconst r = await s.remove([p]);\nconst e2 = await s.exists(p);\nconsole.log(JSON.stringify({ upload: a.error, existsAfterUpload: e1.data, overwrite: b.error, bytes, remove: r.error, existsAfterRemove: e2.data }));\nif (a.error || b.error || r.error || bytes.join(\",\") !== \"9,8,7,6\" || !e1.data || e2.data) process.exit(1);\n' && rmdir data/erp-storage/crm-po-designs/design/__smoke__ && echo \"ADAPTER_SMOKE_OK\"",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

(node:153802) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/haydar/Code/askonveksi/askonveksi/lib/storage/erp-storage.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/haydar/Code/askonveksi/askonveksi/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
{"upload":null,"existsAfterUpload":true,"overwrite":null,"bytes":[9,8,7,6],"remove":null,"existsAfterRemove":false}
ADAPTER_SMOKE_OK


---

## Assistant

_Thinking:_

Excellent. Stop server.

**Tool: shell**

**Input:**
```json
{
  "command": "kill \"$(cat /tmp/askonveksi-start.pid)\" 2>/dev/null || true; sleep 1; ps -p \"$(cat /tmp/askonveksi-start.pid)\" >/dev/null 2>&1 && kill -9 \"$(cat /tmp/askonveksi-start.pid)\" || true; echo \"server stopped\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

server stopped


---

## Assistant

_Thinking:_

Now, consider whether `next start` warning "does not work with output standalone" matters for local presentation. If they run `npm start`, the warning says use `node .next/standalone/server.js`. But the server did start and route worked. In Next 16, `next start` with standalone may still work? It ran. The project likely uses `npm start` locally already. Fine. For VPS, PM2 runs standalone server.js. Good.

Now, one important issue: In standalone mode, is `lib/storage/local-store.mjs` included in `.next/standalone`? The worker needs it copied separately; app's `erp-storage.ts` imports it, so Next's bundler should bundle it into the server chunks (not rely on file path). Build succeeded. But does the standalone server need the `.mjs` file at runtime? Next bundles imported modules into chunks, so likely bundled. We could verify by running `.next/standalone/server.js` and hitting logo. This is the actual VPS runtime. Great idea: run `node .next/standalone/server.js` with PORT=3101, HOSTNAME=127.0.0.1, and `.env`? Standalone server reads `.env`? Next standalone may not copy `.env`; deploy symlinks `.env` into release. Locally `.next/standalone` may not have `.env`. We can set env vars explicitly or symlink `.env` into `.next/standalone/.env` temporarily. However `.next/standalone` structure includes a nested project? For Next standalone, server.js at root. We can run:
```
cp -s ../../.env? 
```
Better not modify build output. Set env vars from `.env`? We can use `node --env-file=.env .next/standalone/server.js`, but Next's standalone server may load `.env` itself. `--env-file` works for process env; all needed vars. Then curl. This validates standalone including bundled local-store. Let's try, but be careful: `.next/standalone/server.js` may expect static assets at `.next/static` (not copied locally by build). The logo route doesn't need static. Start with PORT=3101.

Command:
```
PORT=3101 HOSTNAME=127.0.0.1 node --env-file=.env .next/standalone/server.js > /tmp/standalone.log 2>&1 &
```
Then curl. Let's do.

Saya uji juga runtime standalone (yang dipakai PM2 di VPS) untuk memastikan `local-store.mjs` ikut ter-bundle dan route VPS tetap jalan.

**Tool: shell**

**Input:**
```json
{
  "command": "PORT=3101 HOSTNAME=127.0.0.1 nohup node --env-file=.env .next/standalone/server.js > /tmp/askonveksi-standalone.log 2>&1 & echo $! > /tmp/askonveksi-standalone.pid; echo \"started $(cat /tmp/askonveksi-standalone.pid)\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

started 154239


---

## Assistant

_Thinking:_

Poll.

**Tool: shell**

**Input:**
```json
{
  "command": "for i in $(seq 1 30); do if curl -fsS --max-time 2 http://127.0.0.1:3101/api/public/business-logo -o /tmp/logo-standalone.bin; then echo \"OK after ${i}s\"; file /tmp/logo-standalone.bin; wc -c < /tmp/logo-standalone.bin; break; fi; sleep 1; done; echo \"---LOG---\"; tail -20 /tmp/askonveksi-standalone.log",
  "timeout": 120000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

OK after 1s
/tmp/logo-standalone.bin: RIFF (little-endian) data, WebP image, XMP metadata, EXIF metadata, with alpha, 1920x1080 
87630
---LOG---
▲ Next.js 16.3.8
- Local:         http://127.0.0.1:3101
- Network:       http://127.0.0.1:3101
✓ Ready in 0ms
✓ Running next.config took 1.8ms


---

## Assistant

_Thinking:_

Standalone runtime works and local-store bundled. Stop.

**Tool: shell**

**Input:**
```json
{
  "command": "kill \"$(cat /tmp/askonveksi-standalone.pid)\" 2>/dev/null || true; sleep 1; ps -p \"$(cat /tmp/askonveksi-standalone.pid)\" >/dev/null 2>&1 && kill -9 \"$(cat /tmp/askonveksi-standalone.pid)\" || true; echo \"standalone stopped\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

standalone stopped


---

## Assistant

_Thinking:_

Now, think about whether the migration script's `storeRoot()` uses `NODE_ENV` from `.env`? dotenv doesn't set NODE_ENV. Fine.

Now, docs say "Role DEVELOPER..." not much. Good.

Now, check `tests/erp-storage.test.mjs` lint warnings? Lint output 31 warnings, none from our new files? The output tail only showed existing warnings. Let's grep lint output for our files: run `npm run lint 2>&1 | grep -E "lib/storage|erp-storage|migrate-storage|backup-erp|tests/erp"` to ensure none.

**Tool: shell**

**Input:**
```json
{
  "command": "npm run lint 2>&1 | grep -E \"lib/storage|erp-storage|migrate-storage|backup-erp|tests/erp\" || echo \"NO_LINT_ISSUES_IN_NEW_FILES\"",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

NO_LINT_ISSUES_IN_NEW_FILES


---

## Assistant

_Thinking:_

Now, one more consideration: `npm run storage:migrate -- --dry-run` output `driver=hybrid`; migration writes local regardless. Fine.

Potential issue: `scripts/backup-erp-storage.sh` defaults `SRC=/var/lib/askonveksi/storage`; locally running `npm run storage:backup` without env would fail (source missing), but `.env` sets `ERP_STORAGE_DIR`; however npm doesn't load `.env` into shell, so `storage:backup` locally would use default and fail. Should we make the script load `.env` or accept an argument? For local convenience, could use `ERP_STORAGE_DIR` from environment; user can run `ERP_STORAGE_DIR=... npm run storage:backup`. But package script without env is misleading. The plan says `storage:backup` script. We could make the npm script use `node --env-file=.env`? Bash can't use Node env-file. Could change package script to `node --env-file=.env scripts/backup-erp-storage.mjs`, but we wrote shell. Or have the shell script source `.env` safely via a Node one-liner? Simpler: in the shell script, if `ERP_STORAGE_DIR` is unset and `.env` exists in repo root, parse only `ERP_STORAGE_DIR` and `ERP_STORAGE_BACKUP_DIR` with grep/sed:
```bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${ERP_STORAGE_DIR:-}" ] && [ -f "$ROOT/.env" ]; then
  ERP_STORAGE_DIR="$(grep -E '^ERP_STORAGE_DIR=' "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')"
fi
```
But `SRC` assignment happens before. Could reorder. This is helpful for local. Yet `.env` path may contain spaces; trim quotes only. Fine. But on VPS, env is exported by cron or loaded? Cron doesn't load `.env`; the script runs from repo with `shared/.env` symlink? The repo checkout in `/path/ke/repo` may have its own `.env` or not. The doc cron uses `/path/ke/repo/scripts/backup...` and assumes `ERP_STORAGE_DIR` env; cron won't have it unless defined in crontab. The runbook should show env in crontab or script default `/var/lib/askonveksi/storage`, which is default. So VPS works without env. Local `npm run storage:backup` would default to `/var/lib/...` and fail. Not critical; docs can say set env. But better make local work.

Maybe simpler: add `scripts/backup-erp-storage.sh` argument handling? `SRC="${1:-${ERP_STORAGE_DIR:-...}}"`. Then `npm run storage:backup -- data/erp-storage`. But package script doesn't pass. Hmm.

We can leave it; the main feature is upload/read/delete. Backup is ops. The user asked "kerjakan semua itu", but local backup isn't essential for presentation. Still, polish.

Let's modify the shell script to read `.env` fallback for `ERP_STORAGE_DIR` and `ERP_STORAGE_BACKUP_DIR` if unset, using a small safe parser. Avoid sourcing arbitrary shell. Something like:

```bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
read_env() {
  local key="$1" file="$ROOT/.env" line
  [ -f "$file" ] || return 0
  line="$(grep -E "^${key}=" "$file" | tail -n 1)" || return 0
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}
SRC="${ERP_STORAGE_DIR:-$(read_env ERP_STORAGE_DIR)}"
SRC="${SRC:-/var/lib/askonveksi/storage}"
DEST="${ERP_STORAGE_BACKUP_DIR:-$(read_env ERP_STORAGE_BACKUP_DIR)}"
DEST="${DEST:-/var/backups/askonveksi}"
```
This reads local `.env` if present; on VPS repo maybe no `.env`, defaults. Good. But if `.env` has inline comments, path gets comment; unlikely. Add `| sed 's/[[:space:]]#.*$//'`? Not needed.

Do we want backup to include `data/erp-storage` from project; yes.

Let's update. Also `KEEP` from env only; fine.

Then test local backup into /tmp to avoid filling /var: `ERP_STORAGE_BACKUP_DIR=/tmp/askonveksi-backup-test npm run storage:backup`. It will read `.env` for SRC. Then verify tar. Then remove. Good.

Let's edit.

Saya rapikan script backup agar otomatis membaca `ERP_STORAGE_DIR` dari `.env` saat dijalankan lokal, lalu uji backup dan restore tar.

**Tool: edit**

**Input:**
```json
{
  "newString": "# Backup harian biner ERP (gambar, PDF, media WA) dari volume VPS.\n# Jalankan sebagai user aplikasi agar file tetap bisa dibaca proses PM2.\nROOT=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"\n\nread_env() {\n  local key=\"$1\" file=\"$ROOT/.env\" line\n  [ -f \"$file\" ] || return 0\n  line=\"$(grep -E \"^${key}=\" \"$file\" | tail -n 1)\" || return 0\n  line=\"${line#*=}\"\n  line=\"${line%\\\"}\"; line=\"${line#\\\"}\"\n  line=\"${line%\\'}\"; line=\"${line#\\'}\"\n  printf '%s' \"$line\"\n}\n\nSRC=\"${ERP_STORAGE_DIR:-$(read_env ERP_STORAGE_DIR)}\"\nSRC=\"${SRC:-/var/lib/askonveksi/storage}\"\nDEST=\"${ERP_STORAGE_BACKUP_DIR:-$(read_env ERP_STORAGE_BACKUP_DIR)}\"\nDEST=\"${DEST:-/var/backups/askonveksi}\"\nSTAMP=\"$(date +%Y%m%d-%H%M%S)\"\nKEEP=\"${ERP_STORAGE_BACKUP_KEEP:-14}\"",
  "oldString": "# Backup harian biner ERP (gambar, PDF, media WA) dari volume VPS.\n# Jalankan sebagai user aplikasi agar file tetap bisa dibaca proses PM2.\nSRC=\"${ERP_STORAGE_DIR:-/var/lib/askonveksi/storage}\"\nDEST=\"${ERP_STORAGE_BACKUP_DIR:-/var/backups/askonveksi}\"\nSTAMP=\"$(date +%Y%m%d-%H%M%S)\"\nKEEP=\"${ERP_STORAGE_BACKUP_KEEP:-14}\"",
  "path": "/home/haydar/Code/askonveksi/askonveksi/scripts/backup-erp-storage.sh"
}
```

Edited scripts/backup-erp-storage.sh (1 replacement)

---

## Assistant

_Thinking:_

Test backup.

**Tool: shell**

**Input:**
```json
{
  "command": "rm -rf /tmp/askonveksi-backup-test && ERP_STORAGE_BACKUP_DIR=/tmp/askonveksi-backup-test npm run storage:backup && ls -l /tmp/askonveksi-backup-test && tar -tzf /tmp/askonveksi-backup-test/*.tar.gz | head -5",
  "timeout": 300000,
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```


> askonveksi@0.1.0 storage:backup
> bash scripts/backup-erp-storage.sh

[storage-backup] dibuat: /tmp/askonveksi-backup-test/erp-storage-20261023-103807.tar.gz (27M)
total 26956
-rw------- 1 haydar haydar 27600965 Oct 23 10:38 erp-storage-20261023-103807.tar.gz
erp-storage/
erp-storage/business-assets/
erp-storage/business-assets/business/
erp-storage/business-assets/business/logo-49719931-6757-4546-8540-56a8b2b6b4b0.png
erp-storage/business-assets/business/logo-7f2901f2-8e57-4f2a-86cc-7ca79c523de7.jpg


---

## Assistant

_Thinking:_

Backup works, mode 0600. Clean temp.

**Tool: shell**

**Input:**
```json
{
  "command": "rm -rf /tmp/askonveksi-backup-test && bash -n scripts/backup-erp-storage.sh && node --check scripts/migrate-storage-to-vps.mjs && echo \"SCRIPTS_OK\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

SCRIPTS_OK


---

## Assistant

_Thinking:_

Now consider updating `.env.example` `ERP_STORAGE_BACKUP_DIR=/var/backups...` might be dangerous locally but only used by backup script with explicit; fine.

Now, run full test once more? We changed only shell script since last test. No need. But final summary should list:
- `npm run lint` 0 errors, 31 pre-existing warnings.
- `npx tsc --noEmit` pass.
- `npm test` 341 pass.
- `npm run build` pass.
- `storage:migrate --dry-run` clean; actual migrate 85 files; verify clean.
- runtime smoke tests: `next start` and standalone served logo from VPS; adapter upload/edit/read/delete smoke OK.
- worker release layout import OK.
- backup script OK.

Need maybe report what remains for VPS production:
- Add env to `$DEPLOY_PATH/shared/.env`: `ERP_STORAGE_DIR=/var/lib/askonveksi/storage`, `ERP_STORAGE_DRIVER=hybrid`.
- Create dir with correct ownership.
- Deploy via push to production, deploy workflow verifies.
- Then backfill on VPS (`storage:migrate`, `storage:verify`).
- 1 month grace then `local`.

The user asked in Indonesian; respond Indonesian. Be concise but complete. Mention local `.env` set to hybrid and 85 files backfilled, so presentation works. Mention how to run: `npm run dev` or `npm run build && node .next/standalone/server.js`? Actually `npm start` works but warns; better `npm run dev` for presentation or `npm run build && npm start` (works despite warning). They likely use `npm run dev`.

Wait: We should verify `.env` driver hybrid and absolute path. Yes.

One thing: user requires "SETIAP PENAMBAHAN FITUR ATAU PENYEMBUNYIAN PENGHAPUSAN FITUR USER ROLE DEVELOPER TETAP BISA MENGAKSESNYA". We didn't change role logic; DEVELOPER access unchanged. Mention.

Now, potential concern: The uploaded files from app in hybrid mode to Supabase use `createAdminClient()` with `SUPABASE_SECRET_KEY`; same as before. In local `.env`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` present. Good.

Potential concern: `app/actions/design.ts` uses `BUCKET = PO_DESIGNS_BUCKET`; test regex `erpStorage(BUCKET)` matches. Full tests pass.

Potential concern: In `erp-storage.ts`, `WHATSAPP_MEDIA_BUCKET` is read at module import. If environment `WHATSAPP_MEDIA_BUCKET` changes at runtime (rare), not updated. Existing code read per call. Not an issue. But worker uses its own `mediaBucket` at startup. Fine.

Potential concern: In `erp-storage.ts`, `upload` for `supabase` returns Supabase result directly with data `{ path, id, fullPath }`; our type says `{ path }`; structural extra okay. Good.

Potential concern: `remove` for `supabase` returns `{data:null,error:null}` losing list; no caller uses. Good.

Potential concern: `exists` for `supabase` normalizes error; good.

Potential concern: `download` for `supabase` returns Supabase Blob; our type matches. Good.

Potential concern: `download` hybrid fallback if `resolveSafe` returns null → 400 and no fallback. Production `saveProductionDesignAction` handles `[400,404]` as acceptable for `exists`, but download invalid path would throw UserFacingError. Data paths are valid. Good.

Potential concern: `assertStorageReady` warning logs every process only once due to readinessKey? Let's verify: `storeRoot()` calls `ensureStorageReady()`, which computes key and compares. First call warns, sets key. Subsequent calls no warning. In the runtime log, only one warning. Good.

Potential issue: `readinessKey` is module-level; if env changes from hybrid to local in same process, key changes and revalidates. Good.

Potential issue: For `NODE_ENV=production`, `ERP_STORAGE_DIR` relative throws at first storage op. During Next build, are any storage ops executed? Build succeeded with absolute. In CI, no ERP_STORAGE_DIR and driver defaults supabase, so no check. At runtime on VPS, env set. Good.

Now, should we add `ERP_STORAGE_DRIVER` to build env in deploy workflow? If CI build has no env, `WHATSAPP_MEDIA_BUCKET` fallback and no storeRoot call. No. If some route prerenders and calls storage with default supabase, it would try Supabase with secret missing. Build succeeded locally with hybrid and secret present. CI build only has public key, not secret; if a route executes at build and calls `createAdminClient`, it would fail. But that was already the case before our change for Supabase routes. Build previously succeeded in CI presumably. No new issue.

Now, should we update `.github/workflows/deploy.yml` to include `ERP_STORAGE_DIR` in build env? Not necessary and could trigger guard. Avoid.

Now, check `docs/PANDUAN_STORAGE_ERP.md` says `npm run dev` or `npm run build && npm start`; okay. It says `npm run storage:verify` after restore; script uses `.env`; good.

Now, update `FILE_TO_VPS.md` line 139 says deploy only copies worker; we changed. The plan's implementation table already says deploy. Fine.

Now, should we mark checkboxes in FILE_TO_VPS? The status note covers. Fine.

Now, one more thing: `.env.example` says `ERP_STORAGE_DRIVER=supabase`; local `.env` hybrid. Good.

Now, check `git status` for `data/` not tracked (ignored). Good.

Now, maybe `FILE_TO_VPS.md` untracked is fine; user may want it committed. We don't commit unless asked. The summary says no commit made. We should not commit.

Now, final response. But before final, maybe run `git diff --check` again after doc/script edits. And `npx tsc` passed after all TS changes. Full test passed before script edit; script not tested by Node test. Fine.

Let's do final quick checks:
- `git diff --check`
- `grep -rn "createAdminClient().storage" app lib` (none)
- `node --check worker` (done)
- `npm test` maybe not needed again. But adding test already ran.
- Check `.env` driver and storage path via grep (safe).
- Check no server processes left. Use `ps` maybe.

Let's run combined.

**Tool: shell**

**Input:**
```json
{
  "command": "git diff --check && echo \"DIFF_OK\"; grep -rn \"createAdminClient().storage\" app lib --include='*.ts' --include='*.tsx' || echo \"NO_DIRECT_STORAGE\"; grep -n '^ERP_STORAGE_' .env; pgrep -af 'next-server|standalone/server.js|next start' || true",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

DIFF_OK
lib/storage/erp-storage.ts:38:  return createAdminClient().storage.from(bucket);
20:ERP_STORAGE_DRIVER=hybrid
21:ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
7924 next-server (v16.2.11)
124738 next-server (v16.2.6)
156899 /usr/bin/bash -c git diff --check && echo "DIFF_OK"; grep -rn "createAdminClient().storage" app lib --include='*.ts' --include='*.tsx' || echo "NO_DIRECT_STORAGE"; grep -n '^ERP_STORAGE_' .env; pgrep -af 'next-server|standalone/server.js|next start' || true


**Tool: shell**

**Input:**
```json
{
  "command": "find data/erp-storage -type f | wc -l; du -sh data/erp-storage; node --check worker/whatsapp.mjs; echo \"WORKER_SYNTAX_OK\"",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

85
28M	data/erp-storage
WORKER_SYNTAX_OK


---

## Assistant

_Thinking:_

There are two next-server processes pre-existing (v16.2.11, v16.2.6) not ours? Our PIDs 152858 and 154239 were killed. These may be other dev servers the user has running. Don't kill unknown. Could be old dev servers using old code/env, which might affect presentation! The user may have a dev server running from before; it won't have new code (unless hot reload picks up changes). Next dev hot reloads. The PIDs show versions 16.2.11 and 16.2.6, while package says 16.3.8; likely stale processes from other projects. We shouldn't touch. But for presentation, they should restart their dev server to load `.env` changes and new code. Mention "restart dev server".

Wait, `.env` changes require restart; Next dev may reload env changes? Next dev can reload env? Usually requires restart. Important: Tell user to stop and restart `npm run dev` so `ERP_STORAGE_DRIVER=hybrid` is loaded. If an existing dev server is running, it may be using old env (no ERP vars), defaulting to supabase. That would mean uploads still go to Supabase, violating the presentation requirement. We must ensure they restart. We could check if port 3000 is in use and which process; but we shouldn't kill user processes. Could inspect `ps -o lstart` and cwd. Let's see.

**Tool: shell**

**Input:**
```json
{
  "command": "ps -o pid,ppid,lstart,args -p 7924,124738 2>/dev/null; for p in 7924 124738; do echo \"--- $p cwd\"; readlink /proc/$p/cwd 2>/dev/null || true; done; ss -ltnp 2>/dev/null | grep -E ':3000|:3100|:3101' || true",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

    PID    PPID                  STARTED COMMAND
   7924    7696 Fri Oct 23 09:19:12 2026 next-server (v16.2.11)
 124738  124727 Fri Oct 23 10:21:42 2026 next-server (v16.2.6)
--- 7924 cwd
--- 124738 cwd
/home/haydar/Code/POS/app
LISTEN 0      511                                         *:3000             *:*    users:(("next-server (v1",pid=124738,fd=24))


---

## Assistant

_Thinking:_

Port 3000 is a different project `/home/haydar/Code/POS/app`, so not ours. PID 7924 cwd unavailable (permission). Our app isn't running. User will start it. Mention restart.

Now, is the `.env` addition at lines 20-21 maybe inside a block? We appended at end, but grep shows lines 20-21, perhaps file has 21 lines. Fine.

One more thought: `ERP_STORAGE_DIR` under project `data/` is inside cwd. Production guard warns only; `npm start` works. Good. The warning appeared. For presentation, harmless. If they want no warning, set outside cwd, but then existing backfilled files under project data wouldn't be used unless moved. Keep.

Now, we need maybe set `ERP_STORAGE_DRIVER=hybrid` in `.env` and ensure `npm run dev` picks it. Yes.

Now, final answer should be a concise report with:
1. What's done.
2. Verification results.
3. Presentation steps.
4. Remaining VPS production steps.

Mention files changed and key architecture. Avoid overlong. The user asked in Indonesian; answer Indonesian.

Need be honest: `next start` warning about standalone; recommend `npm run dev` for presentation, or `npm start` still worked. Actually for presentation, running `npm run dev` is simplest. If they run `npm run build && npm start`, it worked. Mention "restart dev server". The local `.env` now points to `data/erp-storage` and hybrid; 85 old files backfilled.

Also mention delete/edit tested:
- Adapter smoke: upload → exists → overwrite → bytes updated → remove → exists false.
- Public logo route served 87 KB WebP from VPS via both `next start` and standalone.
- Unit tests 10 storage tests, full 341 pass.

Also mention `npm run storage:verify` clean.

Remaining:
- On VPS, create `/var/lib/askonveksi/storage` owned by app user; add env to shared `.env`; deploy. Then run `npm run storage:migrate` and `storage:verify` on VPS. For now local presentation works.
- Grace period 1 month before switching to `local`.

Mention DEVELOPER role unaffected.

Potential final caution: Since `.env` is local and ignored, if they present from another machine, they need same env and files. Probably they present this machine.

Let's formulate.

Selesai. Semua upload, edit, hapus, dan baca gambar/PDF sekarang bisa melalui disk VPS, dengan database tetap menyimpan path relatif seperti sebelumnya.

## Yang sudah dikerjakan

- **Modul storage inti**
  - `lib/storage/local-store.mjs` — validasi path anti-traversal, tulis atomik (`rename`/`link`), permission `0640/0750`, guard env produksi.
  - `lib/storage/erp-storage.ts` — adapter dengan bentuk `supabase.storage.from(bucket)`; mode `supabase`, `hybrid`, `local`.
- **Semua 19 call site diporting**: 6 penulis (desain, produksi, penjahit, logo/tanda tangan, bukti bayar, lampiran WA) dan 13 route pembaca.
- **Worker WhatsApp** driver-aware untuk simpan/baca/hapus media.
- **Deploy workflow** menyalin `lib/storage/local-store.mjs` ke release + memverifikasi tarball dan `ERP_STORAGE_DIR`.
- **Script operasional**: migrasi/verify dan backup + dokumentasi `docs/PANDUAN_STORAGE_ERP.md`.
- **Role DEVELOPER tidak berubah** — tetap akses penuh.

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` | 0 error (31 warning lama) |
| `npx tsc --noEmit` | lulus |
| `npm test` | **341 lulus, 0 gagal** |
| `npm run build` | sukses |
| `storage:verify` | 85 file / 27,6 MB, `missing=0 mismatched=0 extra=0` |
| Smoke test adapter | upload → edit/overwrite → baca byte baru → hapus → hilang |
| Smoke test runtime | logo publik 87 KB WebP tersaji dari VPS, baik `next start` maupun standalone |

## Untuk presentasi besok

`.env` lokal sudah diisi:

```dotenv
ERP_STORAGE_DRIVER=hybrid
ERP_STORAGE_DIR=/home/haydar/Code/askonveksi/askonveksi/data/erp-storage
```

Semua 85 file lama sudah di-backfill ke `data/erp-storage`, jadi gambar lama tetap tampil tanpa bergantung pada Supabase Storage. **Restart dev server** agar env baru terbaca:

```bash
npm run dev
```

Saat presentasi:
- upload baru → masuk VPS dan Supabase,
- edit/ganti gambar → file baru di VPS, file lama dihapus,
- hapus gambar → file VPS dan Supabase dihapus,
- baca gambar → dari VPS, fallback Supabase hanya untuk file yang belum ada.

## Sisa langkah produksi VPS

1. Buat `/var/lib/askonveksi/storage` milik user aplikasi.
2. Tambahkan ke `$DEPLOY_PATH/shared/.env`:
   ```dotenv
   ERP_STORAGE_DRIVER=hybrid
   ERP_STORAGE_DIR=/var/lib/askonveksi/storage
   ```
3. Deploy, lalu jalankan `npm run storage:migrate` dan `npm run storage:verify` di VPS.
4. Setelah grace period 1 bulan, ganti driver ke `local`.

---

## User

lalu apa yang harus aku kerjakan di vps? apa langkah langkah nya? dan bagaimana cara test nya agar berhasil?

---

## Assistant

_Thinking:_

The user is in plan mode now. They ask: what do I need to do on the VPS? Steps? How to test so it succeeds? We should discuss the plan directly, no file changes. We have full context of implementation. Need provide a VPS operational runbook, tailored to their setup (DEPLOY_PATH, PM2 app names, shared/.env, deploy workflow). We should be precise, safe, and include verification tests (upload/edit/delete/read) on VPS, worker media, backup/restore, rollback.

We should perhaps inspect the repo for specifics: deploy workflow uses `$DEPLOY_PATH`, `$PM2_APP_NAME`, `$APP_PORT`, `WHATSAPP_HEALTH_PORT`. The shared env path. We already know. But plan mode allows reading files, no modifications. Could inspect docs? We have enough. Maybe check `docs/PANDUAN_STORAGE_ERP.md` and deploy workflow for exact paths. We already wrote them. Need tailor to VPS user `askonveksi` assumed. The user asks in Indonesian. We should respond in Indonesian.

We need include:
- Prerequisites: SSH access, know DEPLOY_PATH, PM2 app name, app user, disk space.
- Phase 0: preflight, backup DB and current Supabase buckets, record counts, disk capacity. Ensure no deploy while mid-migration? Steps.
- Phase 1: create storage dir `/var/lib/askonveksi/storage` owned by app user, mode 0750, test write. Create backup dir `/var/backups/askonveksi`. Set env in `$DEPLOY_PATH/shared/.env` with driver hybrid and absolute path. Important: do not put inside releases.
- Phase 2: deploy code (push to production branch). What workflow does: verifies env dir, copies local-store into release, restarts app + WA worker. Watch deploy logs.
- Phase 3: post-deploy smoke checks:
  - `pm2 status`, `pm2 logs`.
  - Check logs for startup errors, local-store.
  - `find $ERP_STORAGE_DIR -type f` etc.
  - Via browser: upload design revision, check file appears in VPS path; edit/overwrite; delete; read PDF invoice/PO.
  - Use `find`/`stat`/`sha256sum` to confirm.
  - Test each bucket: design, logo/signature, payment proof, WhatsApp media.
  - Test worker: send/receive WhatsApp image; check file created; delete account? Careful.
- Phase 4: backfill production files: run migration as app user from a checkout/release. Commands. `--dry-run`, migrate, verify. Note repo needs `npm ci` full; but release has node_modules standalone not dev deps. They can use a temp clone. The doc has runbook. Simplify: `sudo -u askonveksi -H bash -lc 'cd /path/repo && ...'`; ensure env loaded from shared/.env. Use `node scripts/migrate...` after `npm ci` (full). If using release, scripts not included? Deploy package only includes server/worker, not scripts. So use git clone or the repo checkout. Need mention `npm ci` (not omit dev) because dotenv/prisma CLI. Alternatively run from the project repo on VPS if exists. We should state.
- Phase 5: backup cron + test restore. Add cron for backup and rclone offsite. Test backup file and restore to temp dir, not production. Verify tar. Then maybe test real restore in maintenance window.
- Phase 6: monitoring:
  - `pm2 logs app --lines 200 | grep erp-storage`
  - `fallback-supabase` normal for old files until backfill; after backfill, should disappear.
  - `hybrid-put-rollback` = alert.
  - disk usage `df -h`, folder size `du -sh`.
- Phase 7: rollback:
  - Set driver back to supabase in shared/.env, `pm2 restart app wa --update-env`; since hybrid fail-hard, all new files exist in Supabase too.
  - If worker breaks due missing local-store, deploy fix; or rollback release symlink and restart.
- Phase 8: final cutover after 1 month:
  - `ERP_STORAGE_DRIVER=local`, restart, verify, keep Supabase buckets empty for 1 month, then delete.
- Testing criteria/checklist: table of tests and expected results. Include exact commands:
  - `sudo -u askonveksi test -w ...`
  - `grep -E '^ERP_STORAGE_' "$DEPLOY_PATH/shared/.env"` — careful not to print secrets; only these two.
  - `pm2 env <id>`? Maybe don't expose secrets.
  - `curl` health endpoints: app port, WA health port.
  - `find "$ERP_STORAGE_DIR" -type f -mmin -5`
  - `sha256sum` compare local vs Supabase? For a sample, use `storage:verify`.
  - Browser tests.
- Specific to their deploy paths: They have GitHub Actions deploy to VPS. Need know `DEPLOY_PATH` variable. The runbook should say substitute actual. Maybe infer from docs? Not given. We can use `$DEPLOY_PATH` placeholder and tell them to get from GitHub environment variables: `gh variable list`? They may not have. Simpler: `DEPLOY_PATH` is configured in GitHub repo environment `production` variables. They can check GitHub Settings → Environments → production → Variables. Or on VPS `readlink -f /path/to/current` if they know. We can show `pm2 jlist` to find `pm_cwd` / script path:
  ```
  pm2 jlist | jq '.[] | {name, pm_cwd, pm_exec_path}'
  ```
  That reveals release path. Then `DEPLOY_PATH=$(dirname $(dirname $(readlink -f ...)))`? The app script is `$CURRENT_LINK/server.js`, so `readlink -f $(pm2 jlist ... pm_exec_path)` → `$DEPLOY_PATH/releases/<id>/server.js`. `dirname` twice → releases dir; `dirname` again → DEPLOY_PATH. But jq may not be installed. Use `pm2 describe <app> | grep -E 'script path|exec cwd'`. Mention.

- Order of operations: Do NOT deploy before creating dir and env, because deploy workflow now verifies and will fail if driver != supabase and dir missing. So exact order: create dir → set env → deploy. This is important. If they deploy first with old env absent, driver absent = supabase, workflow check skipped, app stays supabase; then setting env requires restart. But better order.

- Need include how to edit shared `.env` safely:
  ```
  cd "$DEPLOY_PATH/shared"
  cp .env .env.bak.$(date +%F-%H%M)
  grep -q '^ERP_STORAGE_DRIVER=' .env && sed -i ... || printf ...
  ```
  But avoid complex sed; use `nano`/`vim`, or commands:
  ```
  printf '\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n' >> .env
  ```
  But if keys already exist, duplicates. Use a small script to remove existing then append:
  ```
  sed -i '/^ERP_STORAGE_DRIVER=/d;/^ERP_STORAGE_DIR=/d' .env
  printf 'ERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n' >> .env
  ```
  Backup first. Check with `grep -n '^ERP_STORAGE_' .env`. Permission: shared/.env owned by app user; use `sudo -u askonveksi` or edit as deploy user. Since deploy user likely same as app user. Use `sudo -u askonveksi`.
  Important: don't paste secrets in chat.

- How to test upload/edit/delete on VPS:
  - Use browser with OWNER or DEVELOPER account.
  - Desain: CRM → PO → upload design; note path? The UI doesn't show path. Use `find "$ERP_STORAGE_DIR/crm-po-designs/design" -type f -mmin -5`.
  - Edit: use "Ganti desain" or production "Ubah desain"; check new file appears and old removed. Need be careful: design revision upload adds a new file; old revision files may remain. Editing production design with overwrite removes old? Let's be accurate: `overwriteProductionDesignAction` uploads new path and then removes old attachment path? Let's verify to describe correctly. In production.ts lines ~160-200, after upload new path, DB update, then remove old? Let's inspect quickly to ensure test steps match behavior. Plan mode allows read. Let's inspect relevant sections.

Sebelum saya susun runbook VPS-nya, saya cek dulu perilaku edit/hapus di aksi produksi dan desain agar langkah test-nya benar-benar sesuai kode.

**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '150,215p' app/actions/production.ts; echo '--- reset/send ---'; sed -n '235,320p' app/actions/production.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diganti.");

    const storage = erpStorage(DESIGN_BUCKET);
    const folder = attachment.path.includes("/") ? attachment.path.slice(0, attachment.path.lastIndexOf("/")) : "design";
    const nextPath = `${folder}/${randomUUID()}.${designImageExtensionFor(contentType)}`;
    const { error: uploadError } = await storage.upload(nextPath, bytes, { contentType, upsert: false });
    if (uploadError) throw new UserFacingError("File desain belum dapat disimpan.");

    // Kanvas anotasi mode edit dan "Reset perubahan" sama-sama membaca originalPath,
    // sehingga byte desain pengganti harus ditulis juga ke salinan aslinya. Kalau hanya
    // path dan originalName yang diperbarui, nama file berganti tapi gambar tetap lama.
    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
    const { error: snapshotError } = await storage.upload(originalPath, bytes, { contentType, upsert: true });
    if (snapshotError) {
      await storage.remove([nextPath]);
      console.error("Gagal menyalin desain pengganti ke salinan aslinya.", { status: snapshotError.status, statusCode: snapshotError.statusCode });
      throw new UserFacingError("File desain belum dapat disimpan.");
    }

    try {
      await getPrismaClient().$transaction(async (tx) => {
        await tx.designAttachment.update({
          where: { id: attachment.id },
          data: {
            path: nextPath,
            contentType,
            sizeBytes: bytes.length,
            originalName: file.name.slice(0, 255),
            originalPath,
            annotations: Prisma.JsonNull,
          },
        });
        await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_REPLACED", ["path", "contentType", "sizeBytes", "originalName", "originalPath", "annotations"], { attachmentId: attachment.id, previousPath: attachment.path, nextPath });
      }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    } catch (error) {
      await storage.remove([nextPath]);
      throw error;
    }

    if (attachment.path !== nextPath) {
      const { error: removeError } = await storage.remove([attachment.path]);
      if (removeError) console.error("Gagal menghapus file desain lama.", { status: removeError.status, statusCode: removeError.statusCode });
    }
    revalidatePath("/detail-desain");
    revalidatePath(`/detail-desain/${target.id}`);
    revalidatePath("/crm/purchase-orders");
    return flashMessagePath(fallback, "notice", "Desain berhasil diganti dan file desain lama sudah dihapus.");
  });
}

export async function resetProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh memakai aksi ini.
    const actor = await requireDeveloperActor();
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const target = await getPrismaClient().productionWorkOrder.findFirst({
--- reset/send ---
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!target || !attachment) throw new UserFacingError("File desain tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    let originalSize: number | undefined;
    let restoredContentType: "image/png" | "image/jpeg" | undefined;
    if (attachment.originalPath) {
      const storage = erpStorage(DESIGN_BUCKET);
      const { data: original, error: downloadError } = await storage.download(attachment.originalPath);
      if (downloadError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
      const originalBytes = new Uint8Array(await original.arrayBuffer());
      restoredContentType = sniffImageContentType(originalBytes) ?? "image/png";
      const { error: uploadError } = await storage.upload(attachment.path, originalBytes, { contentType: restoredContentType, upsert: true });
      if (uploadError) throw new UserFacingError("Desain awal belum dapat dipulihkan.");
      originalSize = originalBytes.length;
    }
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { annotations: Prisma.JsonNull, ...(restoredContentType === undefined ? {} : { contentType: restoredContentType, sizeBytes: originalSize }) } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_RESET", ["annotations"], { attachmentId: attachment.id });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    revalidatePath("/detail-desain");
    revalidatePath("/crm/purchase-orders");
    return flashMessagePath(fallback, "notice", "Perubahan desain dikembalikan ke desain awal.");
  });
}

export async function sendProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh memakai aksi ini.
    const actor = await requireDeveloperActor();
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const order = await getPrismaClient().productionWorkOrder.findUnique({
      where: { id: parsed.data.workOrderId },
      select: {
        id: true,
        designCompletedAt: true,
        status: true,
        salesOrder: { select: {
          purchaseOrder: { select: {
            designTask: { select: {
              revisions: {
                orderBy: { revision: "desc" },
                select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, annotations: true, originalPath: true } } },
              },
            } },
          } },
        } },
      },
    });
    const attachment = order?.salesOrder.purchaseOrder.designTask?.revisions.flatMap((revision) => revision.attachments)[0];
    if (!order || !attachment || order.status !== "ACTIVE" || order.designCompletedAt || !designAnnotationsSchema.safeParse(attachment.annotations).success) throw new UserFacingError("Simpan versi desain terlebih dahulu sebelum memasukkannya ke Produksi.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productionWorkOrder.update({ where: { id: order.id }, data: { designCompletedAt: new Date() } });
      await productionAudit(tx, actor.id, order.id, "PRODUCTION_DESIGN_SENT", ["designCompletedAt"], { attachmentId: parsed.data.attachmentId });
    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
    if (attachment.originalPath) {
      try {
        const { error } = await erpStorage(DESIGN_BUCKET).remove([attachment.originalPath]);
        if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
        else {
          try { await getPrismaClient().designAttachment.update({ where: { id: attachment.id }, data: { originalPath: null } }); }
          catch { console.error("Gambar asli desain sudah dihapus, tetapi status penyimpanannya belum diperbarui."); }
        }
      } catch { console.error("Gagal menghapus gambar asli desain setelah masuk Produksi."); }
    }
    revalidatePath("/detail-desain");
    revalidateProductionBoard();
    return flashMessagePath("/detail-desain", "notice", "Work Order masuk ke kanban Produksi.");
  });
}

// Perpindahan tahap berjalan di atas pooler Supabase yang bisa lambat. Default Prisma
// (maxWait 2s / timeout 5s) sering berakhir P2028 "melewati batas waktu" di kanban,
// jadi anggaran transaksi dinaikkan mengikuti pola `DEAL_TRANSACTION_OPTIONS` di crm.ts.
const MOVE_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

// Transaksi tulis kecil lain (2-3 query berurutan) juga bisa P2028 di pooler
// yang lambat; diberi anggaran yang sama tanpa mengubah isolation level.


**Tool: shell**

**Input:**
```json
{
  "command": "sed -n '900,1050p' app/actions/master-data.ts | grep -n -C 3 'logoPath\\|signaturePath\\|remove\\|upload'; echo '--- design remove? ---'; grep -n -C 4 '\\.remove(' app/actions/design.ts app/actions/crm.ts app/actions/production.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

78-    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
79-
80-    const logo = formData.get("logo");
81:    let uploadedLogoPath: string | null = null;
82-    if (logo instanceof File && logo.size) {
83-      const image = await readBusinessImage(logo, "Logo");
84:      uploadedLogoPath = `business/logo-${randomUUID()}.${image.extension}`;
85:      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
86-      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
87-    }
88-
89-    // Gambar tanda tangan boleh diganti atau dihapus. File lama sengaja tidak
90-    // ikut dihapus: path-nya sudah tersimpan di snapshot invoice yang terkunci.
91-    const signature = formData.get("signature");
92:    let uploadedSignaturePath: string | null = null;
93-    if (signature instanceof File && signature.size) {
94-      const image = await readBusinessImage(signature, "Gambar tanda tangan");
95:      uploadedSignaturePath = `business/signature-${randomUUID()}.${image.extension}`;
96:      const { error } = await erpStorage(BUSINESS_ASSETS_BUCKET).upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
97-      if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
98-    }
99:    const removeSignature = formData.get("removeSignature") === "1" && !uploadedSignaturePath;
100-
101-    try {
102-      await getPrismaClient().$transaction(async (tx) => {
--
112-            signatureName: parsed.data.signatureName,
113-            signatureTitle: parsed.data.signatureTitle,
114-            invoiceNotes: parsed.data.invoiceNotes,
115:            ...(uploadedLogoPath ? { logoPath: uploadedLogoPath } : {}),
116:            ...(uploadedSignaturePath ? { signaturePath: uploadedSignaturePath } : {}),
117:            ...(removeSignature ? { signaturePath: null } : {}),
118-            version: { increment: 1 },
119-          },
120-        });
121-        if (updated.count !== 1) throw new UserFacingError("Profil perusahaan sudah berubah. Muat ulang halaman.");
122-        await tx.auditEvent.create({
123:          data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "BUSINESS_PROFILE_UPDATED", changedFields: ["name", "phone", "email", "address", "signatureName", "signatureTitle", "invoiceNotes", ...(uploadedLogoPath ? ["logoPath"] : []), ...(uploadedSignaturePath || removeSignature ? ["signaturePath"] : [])] },
124-        });
125-      }, MASTER_DATA_TRANSACTION_OPTIONS);
126-    } catch (error) {
127:      if (uploadedLogoPath) await erpStorage(BUSINESS_ASSETS_BUCKET).remove([uploadedLogoPath]);
128:      if (uploadedSignaturePath) await erpStorage(BUSINESS_ASSETS_BUCKET).remove([uploadedSignaturePath]);
129-      throw error;
130-    }
131-    revalidatePath("/master-data/business-profile");
--- design remove? ---
app/actions/design.ts-175-      revalidatePath("/crm/purchase-orders");
app/actions/design.ts-176-      revalidateTag("purchase-orders", { expire: 0 });
app/actions/design.ts-177-      revalidatePath(`/crm/peluang/${opportunityId}`);
app/actions/design.ts-178-    } catch (error) {
app/actions/design.ts:179:      if (uploaded.length) await storage.remove(uploaded);
app/actions/design.ts-180-      throw error;
app/actions/design.ts-181-    }
app/actions/design.ts-182-
app/actions/design.ts-183-    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", `Versi desain ${uploads.map((upload) => upload.itemName).join(", ")} berhasil diunggah.`);
--
app/actions/crm.ts-1881-        });
app/actions/crm.ts-1882-      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
app/actions/crm.ts-1883-    } catch (error) {
app/actions/crm.ts-1884-      // Berkas baru dibatalkan; berkas lama masih dirujuk DB lama sehingga PDF lama tetap tampil.
app/actions/crm.ts:1885:      await Promise.all(uploads.map((upload) => storage.remove([upload.path])));
app/actions/crm.ts-1886-      throw error;
app/actions/crm.ts-1887-    }
app/actions/crm.ts-1888-    // File lama dilepas hanya setelah transaksi sukses (best-effort): object storage bukan sumber data.
app/actions/crm.ts:1889:    await Promise.all([...supersededPaths, ...removals.map((entry) => entry.oldPath)].map((path) => storage.remove([path])));
app/actions/crm.ts-1890-
app/actions/crm.ts-1891-    revalidatePath("/crm");
app/actions/crm.ts-1892-    revalidatePurchaseOrderList();
app/actions/crm.ts-1893-    revalidatePath(`/crm/peluang/${purchaseOrder.opportunityId}`);
--
app/actions/production.ts-168-    // path dan originalName yang diperbarui, nama file berganti tapi gambar tetap lama.
app/actions/production.ts-169-    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
app/actions/production.ts-170-    const { error: snapshotError } = await storage.upload(originalPath, bytes, { contentType, upsert: true });
app/actions/production.ts-171-    if (snapshotError) {
app/actions/production.ts:172:      await storage.remove([nextPath]);
app/actions/production.ts-173-      console.error("Gagal menyalin desain pengganti ke salinan aslinya.", { status: snapshotError.status, statusCode: snapshotError.statusCode });
app/actions/production.ts-174-      throw new UserFacingError("File desain belum dapat disimpan.");
app/actions/production.ts-175-    }
app/actions/production.ts-176-
--
app/actions/production.ts-189-        });
app/actions/production.ts-190-        await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_REPLACED", ["path", "contentType", "sizeBytes", "originalName", "originalPath", "annotations"], { attachmentId: attachment.id, previousPath: attachment.path, nextPath });
app/actions/production.ts-191-      }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
app/actions/production.ts-192-    } catch (error) {
app/actions/production.ts:193:      await storage.remove([nextPath]);
app/actions/production.ts-194-      throw error;
app/actions/production.ts-195-    }
app/actions/production.ts-196-
app/actions/production.ts-197-    if (attachment.path !== nextPath) {
app/actions/production.ts:198:      const { error: removeError } = await storage.remove([attachment.path]);
app/actions/production.ts-199-      if (removeError) console.error("Gagal menghapus file desain lama.", { status: removeError.status, statusCode: removeError.statusCode });
app/actions/production.ts-200-    }
app/actions/production.ts-201-    revalidatePath("/detail-desain");
app/actions/production.ts-202-    revalidatePath(`/detail-desain/${target.id}`);
--
app/actions/production.ts-292-      await productionAudit(tx, actor.id, order.id, "PRODUCTION_DESIGN_SENT", ["designCompletedAt"], { attachmentId: parsed.data.attachmentId });
app/actions/production.ts-293-    }, PRODUCTION_WRITE_TRANSACTION_OPTIONS);
app/actions/production.ts-294-    if (attachment.originalPath) {
app/actions/production.ts-295-      try {
app/actions/production.ts:296:        const { error } = await erpStorage(DESIGN_BUCKET).remove([attachment.originalPath]);
app/actions/production.ts-297-        if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
app/actions/production.ts-298-        else {
app/actions/production.ts-299-          try { await getPrismaClient().designAttachment.update({ where: { id: attachment.id }, data: { originalPath: null } }); }
app/actions/production.ts-300-          catch { console.error("Gambar asli desain sudah dihapus, tetapi status penyimpanannya belum diperbarui."); }


---

## Assistant

_Thinking:_

Good. Important nuance: logo/signature old files are intentionally not deleted; changing logo leaves old file. This affects "edit/delete test" expectations. For upload/edit/delete:
- Logo edit: new file written; old file intentionally kept (because invoice snapshots may reference it). Don't expect old file removed.
- Signature remove: DB `signaturePath=null` but old file intentionally kept. So "delete" for signature does not delete file. Important to explain.
- Design production replace: old file removed after success.
- CRM penjahit removals: old file removed after transaction.
- Payment proof edit: probably new proof uploaded, old removed? Need check. `uploadPaymentProof` and action flow. But likely old proof removed. Could mention generic.
- Design revision upload: new revision files; rollback removes on failure. Old revisions remain as history.

The user asks "apa yang harus aku kerjakan di vps? langkah langkahnya? bagaimana cara testnya agar berhasil?" We should give a focused, actionable runbook, but in plan mode no changes. We can present it in chat. Maybe they want to know specifically what to do on VPS after our local implementation. We need be clear about assumptions (app user, paths). Could ask for actual DEPLOY_PATH, PM2 app name, VPS OS, but we can provide placeholders and commands to discover. The user likely expects a plan now, not implementation.

We should include:
1. **Preconditions / information to collect** (commands):
   - SSH.
   - `pm2 ls`.
   - Find deploy path:
     ```
     pm2 jlist | node -e ... 
     ```
     Simpler:
     ```
     pm2 describe <APP> | grep -E "script path|exec cwd"
     ```
     `exec cwd` might be current release; `readlink -f "$DEPLOY_PATH/current"`.
   - `DEPLOY_PATH` from GitHub env variables or `dirname "$(dirname "$(readlink -f /path/to/current)")"`.
   - `id $(whoami)`; disk `df -h`.
2. **Preflight backup**:
   - `pg_dump`? DB is Supabase; backups configured. At least record counts and copy shared `.env`.
   - `cp "$DEPLOY_PATH/shared/.env" ...`.
   - `du -sh "$DEPLOY_PATH"`, `df -h`.
3. **Create storage & backup dirs**:
   ```
   sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage
   sudo install -d -o askonveksi -g askonveksi -m 0750 /var/backups/askonveksi
   sudo -u askonveksi test -w /var/lib/askonveksi/storage
   ```
   Use actual user (`pm2` user). If root runs PM2, adjust (not recommended).
4. **Set env before deploy**:
   ```
   cd "$DEPLOY_PATH/shared"
   cp .env ".env.bak.$(date +%F-%H%M%S)"
   grep -n '^ERP_STORAGE_' .env || true
   sed -i '/^ERP_STORAGE_DRIVER=/d;/^ERP_STORAGE_DIR=/d' .env
   printf '\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n' >> .env
   chown askonveksi:askonveksi .env; chmod 600 .env
   grep -n '^ERP_STORAGE_' .env
   ```
   Important: `shared/.env` is symlinked into release; editing is safe. Don't print secrets.
5. **Deploy**:
   - Push/merge to `production` branch or GitHub Actions manual run.
   - Watch workflow: Lint/Test/Build/Package/Deploy.
   - New deploy checks:
     - `lib/storage/local-store.mjs` in tar.
     - `ERP_STORAGE_DIR` exists/absolute/writable/outside DEPLOY_PATH.
   - After deploy:
     ```
     pm2 ls
     pm2 describe <app> | grep -E 'script path|exec cwd|status'
     pm2 logs <app> --lines 100 --nostream | grep -E 'erp-storage|Error|ERR_MODULE'
     pm2 logs <app>-wa --lines 100 --nostream | tail
     curl -fsS http://127.0.0.1:$APP_PORT >/dev/null && echo app-ok
     curl -fsS http://127.0.0.1:$WA_PORT/health && echo wa-ok
     ```
     Actually health endpoint may return JSON; `curl -fsS` good.
   - Check env inside PM2 process? `pm2 env <id> | grep ERP_STORAGE` might print only env? `pm2 env` outputs all env including secrets. Avoid. Use `tr '\0' '\n' < /proc/$(pgrep -f ...)/environ | grep ERP_STORAGE` also secrets adjacent but grep only lines. Could use:
     ```
     for pid in $(pgrep -f "releases/.*/server.js"); do tr '\0' '\n' < /proc/$pid/environ | grep '^ERP_STORAGE_'; done
     ```
     This is safe (only lines). But PM2 loads env at start; if you edited shared/.env and didn't restart, process env may still old. Deploy restarts PM2; good.
6. **Smoke test before backfill** (hybrid with existing remote files):
   - Login as OWNER/DEVELOPER.
   - Open an existing PO/design/logo using old Supabase data → should still display (fallback). Check `pm2 logs ... | grep fallback-supabase` (throttled).
   - Upload new design revision → check local file:
     ```
     find /var/lib/askonveksi/storage/crm-po-designs -type f -mmin -5 -printf '%TY-%Tm-%Td %TH:%TM %s %p\n'
     ```
     and check Supabase dashboard object exists (hybrid).
   - Edit/ganti desain produksi:
     - Upload replacement; verify new file appears, old path removed from VPS (and Supabase).
     - Use `find` + maybe DB query? Could use UI preview.
   - Delete/hapus:
     - Penjahit plan removal: remove a design in PO; verify VPS file gone.
     - Payment proof: delete/replace; verify old removed (need code check). Let's inspect payment proof removal to be accurate. Search `deletePaymentProof`.

**Tool: shell**

**Input:**
```json
{
  "command": "grep -rn -C 3 \"deletePaymentProof\" app lib | sed -n '1,160p'; echo '--- penjahit removals ---'; sed -n '1800,1900p' app/actions/crm.ts",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

app/actions/finance.ts-9-import { requireActor } from "@/lib/auth/session";
app/actions/finance.ts-10-import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";
app/actions/finance.ts-11-import { getPrismaClient } from "@/lib/prisma";
app/actions/finance.ts:12:import { deletePaymentProof, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/finance.ts-13-
app/actions/finance.ts-14-function blankToUndefined(value: unknown) { return value == null || (typeof value === "string" && value.trim() === "") ? undefined : value; }
app/actions/finance.ts-15-const expenseSchema = z.object({ id: z.string().cuid().optional(), purpose: z.string().trim().min(2, "Keperluan minimal 2 karakter.").max(500), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."), amount: z.coerce.number().finite().positive("Nominal harus lebih dari 0."), category: z.enum(EXPENSE_CATEGORIES), paymentMethodId: z.string().trim().min(1, "Metode pembayaran wajib dipilih.").max(40), isReimbursable: z.boolean(), customerName: z.preprocess(blankToUndefined, z.string().trim().max(160).optional()), salesOrderId: z.preprocess(blankToUndefined, z.string().cuid().optional()) });
--
app/actions/finance.ts-62-    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts-63-    if (!proof) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
app/actions/finance.ts-64-    await assertPaymentMethod(parsed.data.paymentMethodId);
app/actions/finance.ts:65:    try { await getPrismaClient().$transaction(async (tx) => { const item = await tx.expense.create({ data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? null, ...proof, createdById: actor.id } }); await audit(tx, actor.id, item.id, "EXPENSE_CREATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", "proofPath"]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof.proofPath); throw error; }
app/actions/finance.ts-66-    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dicatat.");
app/actions/finance.ts-67-  });
app/actions/finance.ts-68-}
--
app/actions/finance.ts-78-    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts-79-    if (!proof && !current.proofPath) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
app/actions/finance.ts-80-    await assertPaymentMethod(parsed.data.paymentMethodId);
app/actions/finance.ts:81:    try { await getPrismaClient().$transaction(async (tx) => { await tx.expense.update({ where: { id }, data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? current.salesOrderId, ...(proof ?? {}) } }); await audit(tx, actor.id, id, "EXPENSE_UPDATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", ...(proof ? ["proofPath"] : [])]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof?.proofPath); throw error; }
app/actions/finance.ts:82:    if (proof) await deletePaymentProof(current.proofPath);
app/actions/finance.ts-83-    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil diperbarui.");
app/actions/finance.ts-84-  });
app/actions/finance.ts-85-}
--
app/actions/finance.ts-199-        }
app/actions/finance.ts-200-      }
app/actions/finance.ts-201-    } catch (error) {
app/actions/finance.ts:202:      for (const path of uploadedPaths) await deletePaymentProof(path);
app/actions/finance.ts-203-      throw error;
app/actions/finance.ts-204-    }
app/actions/finance.ts-205-    const supersededProofPaths: string[] = [];
--
app/actions/finance.ts-268-        return result;
app/actions/finance.ts-269-      }, FINANCE_TRANSACTION_OPTIONS);
app/actions/finance.ts-270-      // File bukti lama yang terganti dibersihkan setelah komit (best-effort).
app/actions/finance.ts:271:      for (const path of supersededProofPaths) await deletePaymentProof(path).catch(() => undefined);
app/actions/finance.ts-272-      if (updated.count) { revalidatePath("/keuangan/pemasukan"); revalidatePath("/keuangan/pengeluaran"); revalidatePath("/keuangan/pengeluaran/riwayat"); }
app/actions/finance.ts-273-      return flashMessagePath("/keuangan/pemasukan", "notice", plans.length ? "Biaya HPP diperbarui dan otomatis masuk ke Pengeluaran kategori Project." : "Biaya HPP berhasil diperbarui.");
app/actions/finance.ts-274-    } catch (error) {
app/actions/finance.ts:275:      for (const path of uploadedPaths) await deletePaymentProof(path);
app/actions/finance.ts-276-      throw error;
app/actions/finance.ts-277-    }
app/actions/finance.ts-278-  });
--
lib/payment-proof.ts-34-  return { proofPath, proofFileName: value.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || `bukti.${extension}`, proofMimeType: mime, proofSize: value.size };
lib/payment-proof.ts-35-}
lib/payment-proof.ts-36-
lib/payment-proof.ts:37:export async function deletePaymentProof(path: string | null | undefined) {
lib/payment-proof.ts-38-  if (path) await erpStorage(PAYMENT_PROOF_BUCKET).remove([path]);
lib/payment-proof.ts-39-}
--- penjahit removals ---
  if (!contentType) throw new UserFacingError(designImageRejection(file.name));
  return {
    itemId,
    bytes,
    contentType,
    originalName: file.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || "desain-penjahit",
    path: `penjahit/${itemId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
  };
}

export async function savePenjahitPlanAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderIdSchema.safeParse({ purchaseOrderId: formValue(formData, "purchaseOrderId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parsed.data.purchaseOrderId },
      select: {
        id: true,
        purchaseOrderNo: true,
        status: true,
        opportunityId: true,
        version: true,
        items: { orderBy: { position: "asc" }, select: { id: true, name: true, penjahitDesignPath: true } },
      },
    });
    if (!purchaseOrder) throw new UserFacingError("Purchase order tidak ditemukan.");
    if (!purchaseOrder.items.length) throw new UserFacingError("PO belum memiliki produk, jadi deadline penjahit belum bisa diisi.");
    if ((purchaseOrder.status !== "DRAFT" && purchaseOrder.status !== "AGREED") && !hasRole(actor.role, GATE_OVERRIDE_ROLES)) throw new UserFacingError("Deadline & desain penjahit hanya dapat diubah selama PO berstatus Draft atau Disepakati.");
    if (purchaseOrder.version !== parsed.data.version) throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");

    const deadlines = new Map<string, Date | null>();
    const uploads: PenjahitDesignUpload[] = [];
    const removals: Array<{ itemId: string; oldPath: string }> = [];
    const supersededPaths: string[] = [];
    for (const item of purchaseOrder.items) {
      const rawDeadline = formData.get(`deadline-${item.id}`);
      // Kunci selalu ada di dialog; "" berarti mengosongkan deadline, kehilangan kunci = tidak diubah.
      if (typeof rawDeadline === "string") deadlines.set(item.id, optionalDate(rawDeadline.trim() || undefined));
      const design = formData.get(`design-${item.id}`);
      if (design instanceof File && design.size > 0) {
        uploads.push(await preparePenjahitDesign(design, item.id));
        if (item.penjahitDesignPath) supersededPaths.push(item.penjahitDesignPath);
      } else if (formData.get(`removeDesign-${item.id}`) === "1" && item.penjahitDesignPath) {
        removals.push({ itemId: item.id, oldPath: item.penjahitDesignPath });
      }
    }
    if (!deadlines.size && !uploads.length && !removals.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");

    const storage = erpStorage(PO_DESIGNS_BUCKET);
    try {
      for (const upload of uploads) {
        const { error } = await storage.upload(upload.path, upload.bytes, { contentType: upload.contentType, upsert: false });
        if (error) throw new UserFacingError("Gambar desain penjahit belum dapat disimpan.");
      }
      await prisma.$transaction(async (tx) => {
        const guarded = await tx.purchaseOrder.updateMany({ where: { id: purchaseOrder.id, version: parsed.data.version }, data: { version: { increment: 1 } } });
        if (guarded.count === 0) throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
        const current = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrder.id }, select: { status: true } });
        if (!current || ((current.status !== "DRAFT" && current.status !== "AGREED") && !hasRole(actor.role, GATE_OVERRIDE_ROLES))) throw new UserFacingError("PO tidak lagi berstatus Draft atau Disepakati.");
        for (const item of purchaseOrder.items) {
          const upload = uploads.find((entry) => entry.itemId === item.id);
          const removal = removals.find((entry) => entry.itemId === item.id);
          const hasDeadline = deadlines.has(item.id);
          if (!hasDeadline && !upload && !removal) continue;
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: {
              ...(hasDeadline ? { penjahitDeadline: deadlines.get(item.id) ?? null } : {}),
              ...(upload ? { penjahitDesignPath: upload.path, penjahitDesignName: upload.originalName, penjahitDesignType: upload.contentType } : {}),
              ...(removal ? { penjahitDesignPath: null, penjahitDesignName: null, penjahitDesignType: null } : {}),
            },
          });
        }
        await audit(tx, actor, "PurchaseOrder", purchaseOrder.id, "PENJAHIT_PLAN_UPDATED", ["penjahitDeadline", "penjahitDesign"], {
          purchaseOrderNo: purchaseOrder.purchaseOrderNo,
          deadlineCount: deadlines.size,
          uploadCount: uploads.length,
          removalCount: removals.length,
        });
      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
    } catch (error) {
      // Berkas baru dibatalkan; berkas lama masih dirujuk DB lama sehingga PDF lama tetap tampil.
      await Promise.all(uploads.map((upload) => storage.remove([upload.path])));
      throw error;
    }
    // File lama dilepas hanya setelah transaksi sukses (best-effort): object storage bukan sumber data.
    await Promise.all([...supersededPaths, ...removals.map((entry) => entry.oldPath)].map((path) => storage.remove([path])));

    revalidatePath("/crm");
    revalidatePurchaseOrderList();
    revalidatePath(`/crm/peluang/${purchaseOrder.opportunityId}`);
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function markPurchaseOrderDesignSentAction(formData: FormData) {


**Tool: shell**

**Input:**
```json
{
  "command": "grep -n -C 4 \"logoPath\\|signaturePath\" app/actions/master-data.ts | sed -n '1,120p'; echo '--- proof upload usage ---'; grep -rn -C 2 \"uploadPaymentProof\" app/actions/crm.ts app/actions | head -80",
  "workdir": "/home/haydar/Code/askonveksi/askonveksi"
}
```

1010-            address: parsed.data.address,
1011-            signatureName: parsed.data.signatureName,
1012-            signatureTitle: parsed.data.signatureTitle,
1013-            invoiceNotes: parsed.data.invoiceNotes,
1014:            ...(uploadedLogoPath ? { logoPath: uploadedLogoPath } : {}),
1015:            ...(uploadedSignaturePath ? { signaturePath: uploadedSignaturePath } : {}),
1016:            ...(removeSignature ? { signaturePath: null } : {}),
1017-            version: { increment: 1 },
1018-          },
1019-        });
1020-        if (updated.count !== 1) throw new UserFacingError("Profil perusahaan sudah berubah. Muat ulang halaman.");
1021-        await tx.auditEvent.create({
1022:          data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "BUSINESS_PROFILE_UPDATED", changedFields: ["name", "phone", "email", "address", "signatureName", "signatureTitle", "invoiceNotes", ...(uploadedLogoPath ? ["logoPath"] : []), ...(uploadedSignaturePath || removeSignature ? ["signaturePath"] : [])] },
1023-        });
1024-      }, MASTER_DATA_TRANSACTION_OPTIONS);
1025-    } catch (error) {
1026-      if (uploadedLogoPath) await erpStorage(BUSINESS_ASSETS_BUCKET).remove([uploadedLogoPath]);
--- proof upload usage ---
app/actions/crm.ts-52-} from "@/lib/crm/validation";
app/actions/crm.ts-53-import { getPrismaClient } from "@/lib/prisma";
app/actions/crm.ts:54:import { proofRequired, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/crm.ts-55-import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
app/actions/crm.ts-56-import { ensureProductionWorkOrder } from "@/lib/production/service";
--
app/actions/crm.ts-2637-  const method = await getPrismaClient().paymentMethod.findFirst({ where: { id: paymentMethodId, isActive: true }, select: { name: true } });
app/actions/crm.ts-2638-  if (!method) throw new UserFacingError("Metode pembayaran tidak tersedia.");
app/actions/crm.ts:2639:  const proof = await uploadPaymentProof(formData.get("proof"), actorId);
app/actions/crm.ts-2640-  if (proofRequired(method.name) && !proof && !hasExistingProof) throw new UserFacingError(`Bukti pembayaran wajib untuk metode ${method.name}.`);
app/actions/crm.ts-2641-  return proof;
--
app/actions/crm.ts-52-} from "@/lib/crm/validation";
app/actions/crm.ts-53-import { getPrismaClient } from "@/lib/prisma";
app/actions/crm.ts:54:import { proofRequired, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/crm.ts-55-import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";
app/actions/crm.ts-56-import { ensureProductionWorkOrder } from "@/lib/production/service";
--
app/actions/crm.ts-2637-  const method = await getPrismaClient().paymentMethod.findFirst({ where: { id: paymentMethodId, isActive: true }, select: { name: true } });
app/actions/crm.ts-2638-  if (!method) throw new UserFacingError("Metode pembayaran tidak tersedia.");
app/actions/crm.ts:2639:  const proof = await uploadPaymentProof(formData.get("proof"), actorId);
app/actions/crm.ts-2640-  if (proofRequired(method.name) && !proof && !hasExistingProof) throw new UserFacingError(`Bukti pembayaran wajib untuk metode ${method.name}.`);
app/actions/crm.ts-2641-  return proof;
--
app/actions/finance.ts-10-import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";
app/actions/finance.ts-11-import { getPrismaClient } from "@/lib/prisma";
app/actions/finance.ts:12:import { deletePaymentProof, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";
app/actions/finance.ts-13-
app/actions/finance.ts-14-function blankToUndefined(value: unknown) { return value == null || (typeof value === "string" && value.trim() === "") ? undefined : value; }
--
app/actions/finance.ts-60-    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
app/actions/finance.ts-61-    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data pengeluaran tidak valid.");
app/actions/finance.ts:62:    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts-63-    if (!proof) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
app/actions/finance.ts-64-    await assertPaymentMethod(parsed.data.paymentMethodId);
--
app/actions/finance.ts-76-    if (!current) throw new UserFacingError("Pengeluaran tidak ditemukan.");
app/actions/finance.ts-77-    if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat diubah.");
app/actions/finance.ts:78:    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
app/actions/finance.ts-79-    if (!proof && !current.proofPath) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
app/actions/finance.ts-80-    await assertPaymentMethod(parsed.data.paymentMethodId);
--
app/actions/finance.ts-193-    try {
app/actions/finance.ts-194-      for (const plan of plans) {
app/actions/finance.ts:195:        const uploaded = await uploadPaymentProof(plan.row.proof, actor.id);
app/actions/finance.ts-196-        if (uploaded) {
app/actions/finance.ts-197-          (plan as { proofUpload?: PaymentProof }).proofUpload = uploaded;


---

## Assistant

_Thinking:_

Good. We can now give a precise runbook including expected old-file behavior for logo/signature (kept intentionally). Important to avoid misleading tests.

The user asks "lalu apa yang harus aku kerjakan di vps? apa langkah langkah nya? dan bagaimana cara test nya agar berhasil?" We're in plan mode; respond with a plan, no file edits. We can organize by stages with commands and acceptance criteria. Since they might not know actual `DEPLOY_PATH`, `PM2_APP_NAME`, show discovery commands.

Need decide level of detail. Desired oververbosity 5. But this is an operational runbook; be thorough enough. Maybe ~120-180 lines? We can use headings and code blocks. The user likely wants practical steps. Include "jangan deploy dulu sebelum env & folder" warning.

Let's draft:

**Assumptions / discover first**
- SSH as deploy user (not root).
- Commands:
```bash
whoami
pm2 ls
pm2 describe <APP> | grep -E 'script path|exec cwd|status'
```
- Find DEPLOY_PATH:
```bash
pm2 jlist | node -e '...'
```
Maybe simpler:
```bash
readlink -f "$(pm2 describe <APP> | awk -F': ' '/script path/{print $2}')"
```
But `pm2 describe` output may have ANSI colors. Suggest from GitHub env vars or `ls -l /path/to/current`.

We can say "Ganti `<APP>`, `<APP>-wa`, `$DEPLOY_PATH`, `$APP_PORT`, `$WA_PORT` dengan nilai Anda. Ambil `DEPLOY_PATH` dari GitHub Environment `production` atau dari `pm2 describe`." Good.

**Phase 0 — Backup & capacity**
```bash
df -h /var/lib /var/backups
du -sh "$DEPLOY_PATH"
cp "$DEPLOY_PATH/shared/.env" "$DEPLOY_PATH/shared/.env.bak.$(date +%F-%H%M%S)"
```
Maybe DB backup: Supabase dashboard backup; record counts with `npm run storage:migrate -- --dry-run` after code? Before deploy, current repo local has script. On VPS can run from clone. Alternatively use Supabase dashboard. Keep simple.

**Phase 1 — create dirs**
```bash
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/backups/askonveksi
sudo -u askonveksi bash -lc 'touch /var/lib/askonveksi/storage/.write-test && rm /var/lib/askonveksi/storage/.write-test && echo OK'
```
Use actual app user; if PM2 under root, don't; recommend dedicated user.

**Phase 2 — env before deploy**
```bash
cd "$DEPLOY_PATH/shared"
cp .env .env.bak...
sed -i '/^ERP_STORAGE_DRIVER=/d;/^ERP_STORAGE_DIR=/d' .env
printf '\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n' >> .env
sudo chown askonveksi:askonveksi .env && sudo chmod 600 .env
grep -n '^ERP_STORAGE_' .env
```
Note: ensure no duplicate; the deploy workflow reads these.

**Phase 3 — deploy**
- Push to `production` / run workflow.
- Watch:
  - build: tarball contains `lib/storage/local-store.mjs`.
  - deploy: checks dir writable/outside DEPLOY_PATH.
  - PM2 app + WA restarted.
- Commands:
```bash
pm2 ls
pm2 describe <app> | grep -E 'status|script path|exec cwd'
pm2 logs <app> --lines 100 --nostream | grep -E 'erp-storage|Error|ERR_MODULE' || true
pm2 logs <app>-wa --lines 100 --nostream | tail -30
curl -fsS "http://127.0.0.1:$APP_PORT" -o /dev/null && echo app-ok
curl -fsS "http://127.0.0.1:$WA_PORT/health" && echo wa-ok
```
- Verify process env (optional):
```bash
for pid in $(pgrep -f "$DEPLOY_PATH/current/server.js"); do tr '\0' '\n' < /proc/$pid/environ | grep '^ERP_STORAGE_'; done
```
Maybe not necessary; `pm2 restart --update-env`? Deploy uses `pm2 delete` + `pm2 start`, so new env loaded. Good.

**Phase 4 — pre-backfill smoke tests (hybrid)**
Test order:
1. Old image display: open existing PO design/logo. Expect visible; logs may show fallback-supabase (normal).
2. Upload new design:
   - Record marker: `date +%s > /tmp/storage-marker`
   - Upload via UI.
   - `find "$ERP_STORAGE_DIR" -type f -newer /tmp/storage-marker -printf ...`
   - Expected: new file in `crm-po-designs/design/<taskId>/<uuid>.png`.
   - Verify Supabase dashboard same path exists (hybrid).
3. Edit/replace design (Production Detail):
   - Upload replacement.
   - Expected: new file appears; old file removed; UI preview updates.
   - `find` shows old path gone.
   - Note: design revisions are historical; old revision remains. Use "Ganti desain" in Detail Desain (Production) to test delete-old.
4. Delete penjahit design:
   - PO → edit penjahit plan → remove design → save.
   - Expected: local file gone; route preview 404.
5. Payment proof:
   - Create expense with proof; `payment-proofs/<userId>/<uuid>.pdf`.
   - Edit expense and replace proof; old local file removed.
   - Delete? If no delete action, not.
6. Logo/signature:
   - Upload new logo: new file in `business-assets/business/logo-*.png`; old logo intentionally remains (snapshot invoice). This is not a bug.
   - Edit signature: new file; old intentionally remains. Remove signature only clears DB pointer, file remains intentionally.
7. Read PDF:
   - Generate invoice PDF and PO PDF; verify logo/signature/design appear; no 404.
8. WhatsApp:
   - Send image to WA account; worker stores under `whatsapp-media/<accountId>/<date>/<messageId>`.
   - Send outbound attachment from app; worker reads from VPS and sends.
   - Check `pm2 logs <app>-wa` for errors.
9. Permission test:
   - As DEVELOPER, access all new features? The user specifically cares. Test login as DEVELOPER and open design/PO/payment/WA pages; upload one image. No new role gates added.
10. Security test:
   - Try path traversal? Not via UI. Could use route with invalid path? Not exposed. Perhaps not needed.

Expected results table.

**Phase 5 — backfill production**
Important: run as app user, from a full checkout. Commands:
```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  cd /path/to/askonveksi-repo   # full git checkout, not releases
  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```
But `$DEPLOY_PATH` inside single quotes? `sudo -u ... bash -lc '...'` and `$DEPLOY_PATH` needs expansion inside the shell. The outer single quotes prevent local expansion; inside the bash -lc, `$DEPLOY_PATH` is set? It may not be in environment. Better:
```bash
sudo -u askonveksi -H bash -lc "set -euo pipefail; cd /path/repo; set -a; . '$DEPLOY_PATH/shared/.env'; set +a; ..."
```
But double quotes may expand `$` in .env? Sourcing handles. Careful with secrets and special chars; use no `echo`. Could instead:
```bash
sudo -u askonveksi -H env $(grep -v '^#' "$DEPLOY_PATH/shared/.env" | xargs) ...
```
unsafe. Keep doc's method but instruct to set `DEPLOY_PATH` inside:
```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  DEPLOY_PATH=/path/ke/deploy
  cd /path/ke/repo
  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  ...
'
```
Single-quoted outer means `$DEPLOY_PATH` expands inside inner shell. Set literal path. Good.
- If repo on VPS is a release, `scripts/` isn't included. Use `git clone` temp or a full checkout. `npm ci` full. The migration script only needs `dotenv`, `@supabase/supabase-js`, and local-store; `npm ci` full installs. Could `npm ci` in temp clone. Provide:
```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  rm -rf /tmp/askonveksi-migrate
  git clone <repo-url> /tmp/askonveksi-migrate
  cd /tmp/askonveksi-migrate
  npm ci
  set -a; . /path/ke/deploy/shared/.env; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```
- Expected: counts per bucket, `failed=0`; verify missing=0/mismatched=0/extra=0.
- After backfill, clear `fallback-supabase` expectation; old files now local. But log throttle may retain old entries; check new logs.

**Phase 6 — backup**
```bash
sudo -u askonveksi -H env ERP_STORAGE_DIR=... ERP_STORAGE_BACKUP_DIR=... /path/repo/scripts/backup-erp-storage.sh
```
Script auto-reads `.env` if run from repo; on VPS default `/var/lib/...` works if repo has no `.env`; but it may read repo `.env` which may be absent. Set env explicitly.
- Test restore to temp:
```bash
mkdir -p /tmp/restore-test
tar -C /tmp/restore-test -xzf /var/backups/askonveksi/erp-storage-*.tar.gz
find /tmp/restore-test -type f | wc -l
cmp /tmp/restore-test/erp-storage/... <(??) 
```
Compare one file checksum with live:
```bash
sha256sum /var/lib/askonveksi/storage/.../file
sha256sum /tmp/restore-test/erp-storage/.../file
```
- Add cron:
```cron
15 2 * * * ERP_STORAGE_DIR=/var/lib/askonveksi/storage ERP_STORAGE_BACKUP_DIR=/var/backups/askonveksi /path/to/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1
0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
```
Cron doesn't inherit env; specify inline. Good.
- Test `rclone lsf remote:...`.

**Phase 7 — monitoring**
- `pm2 logs app --lines 0 | grep ...`? PM2 logs real-time. Use `pm2 logs <app> --lines 200 --nostream | grep`.
- `grep -R "fallback-supabase"` logs. `pm2 logs` output not persisted unless configured. Could use `pm2 install pm2-logrotate`; optional.
- Disk: `df -h /var/lib`, `du -sh /var/lib/askonveksi/storage`.
- Alert thresholds.

**Phase 8 — rollback**
- Set driver supabase, restart both with `--update-env`? Since PM2 start was used with env from `.env` via cwd; PM2 app loads `.env`? The app uses Next standalone, which reads `.env`? In deploy, `shared/.env` symlinked to `$RELEASE_DIR/.env`; Next standalone server loads `.env`? Standalone may load `.env` automatically. The PM2 process was started with `--cwd $CURRENT_LINK`, so Next loads `.env` from cwd. Editing shared `.env` then `pm2 restart app --update-env` should reload; but the process environment wasn't necessarily populated from `.env` (Next loads it internally on restart). `pm2 restart` restarts and Next re-reads `.env`. Good.
- `pm2 restart <app> <app>-wa --update-env`.
- Because hybrid fail-hard, all new uploads exist in Supabase. Rollback safe.
- If local-store missing: deploy fix; don't manually copy into release (next deploy overwrites).
- If storage dir full: free space, expand volume; app uploads fail with user-facing error; reads still work.

**Final cutover after 1 month**
- Only after: no fallback logs 14 days, verify clean, backup/restore tested.
- `ERP_STORAGE_DRIVER=local`, restart; run spot checks; keep Supabase buckets empty for 1 month; then delete.
- Don't delete Supabase buckets early.

**Acceptance checklist** table.

Need maybe mention the **local `.env` driver hybrid** doesn't affect VPS; VPS uses shared `.env`. Fine.

Need mention **do not run migrate as root** (permissions). Good.

Need mention **deploy workflow will fail if `ERP_STORAGE_DIR` inside `DEPLOY_PATH`**. Good.

Need mention **backup includes all files but not DB**; pair with Supabase DB backup.

Need mention **test with DEVELOPER account** due AGENTS requirement. Good.

Could mention **the new code default remains `supabase`**, so if env isn't set, app behaves as before; VPS steps switch to hybrid. This is important.

Need maybe ask them for actual values to tailor commands? The user asks "apa langkahnya"; we can provide placeholders and say if they share `pm2 ls` output / DEPLOY_PATH, I can tailor. Since we're in plan mode, we can ask at end. But avoid blocking. We can state "Ganti placeholder berikut..." and offer to tailor.

Also note: We already backfilled the **local** storage, not VPS. On VPS, after deploy, run backfill. Good distinction.

We should not claim we did anything on VPS; we didn't. State "yang sudah selesai hanya di mesin lokal". Good.

Let's write the response in Indonesian, with headings and commands. Keep it readable.

Potential detail: PM2 app names. The deploy workflow uses `$PM2_APP_NAME` and `$PM2_APP_NAME-wa`. We can show:
```bash
pm2 ls
# contoh: askonveksi, askonveksi-wa
```
Discover deploy path:
```bash
pm2 describe askonveksi | grep -E 'script path|exec cwd|status'
```
`exec cwd` may be `/var/www/askonveksi/current`. Then:
```bash
DEPLOY_PATH="$(dirname "$(dirname "$(readlink -f /var/www/askonveksi/current)")")"
```
Wait: `/var/www/askonveksi/current` symlink → `/var/www/askonveksi/releases/<id>`. `dirname` → `/var/www/askonveksi/releases`; `dirname` again → `/var/www/askonveksi`. But `readlink -f /var/www/askonveksi/current` gives release dir. `dirname` twice from release dir: `dirname(release)` = releases; `dirname(releases)` = DEPLOY_PATH. So:
```bash
RELEASE_DIR="$(readlink -f "$DEPLOY_PATH/current")"
DEPLOY_PATH="$(dirname "$(dirname "$RELEASE_DIR")")"
```
But need initial `DEPLOY_PATH` to find current; chicken-and-egg. Use `pm2 describe` to get cwd. Or from GitHub variable. Simpler: tell them get from GitHub. Or:
```bash
pm2 describe askonveksi | sed -n 's/.*exec cwd *│ *//p'
```
Output table formatting. Eh.

Maybe show:
```bash
pm2 jlist | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")); for (const p of a) console.log(p.name, p.pm2_env.pm_cwd, p.pm2_env.pm_exec_path)'
```
This is reliable. `pm2 jlist` outputs JSON; Node parses. If jq installed, shorter:
```bash
pm2 jlist | jq -r '.[] | [.name,.pm2_env.pm_cwd,.pm2_env.pm_exec_path] | @tsv'
```
Use jq if available; fallback Node. We can include one.

Then `DEPLOY_PATH=$(dirname "$(dirname "$(readlink -f <exec_path>)")")`? Exec path = `$DEPLOY_PATH/current/server.js` (symlink path?) PM2 stores `pm_exec_path` as `$CURRENT_LINK/server.js` maybe `/var/www/askonveksi/current/server.js`; `readlink -f` resolves to release/server.js; `dirname` → release; `dirname` → releases; `dirname` → DEPLOY_PATH. So three dirnames from file:
```bash
DEPLOY_PATH="$(dirname "$(dirname "$(dirname "$(readlink -f "$EXEC_PATH")")")")"
```
If exec path is `$DEPLOY_PATH/current/server.js`; readlink -f → `$DEPLOY_PATH/releases/<id>/server.js`; dirname x3 → `$DEPLOY_PATH`. Good. But if exec path is `$DEPLOY_PATH/releases/<id>/server.js`, same. Good.
Could include this derivation but it's a bit much. Simpler: "Ambil `DEPLOY_PATH` dari GitHub → Settings → Environments → production → Variables, atau lihat `pm2 jlist`". Then commands use `$DEPLOY_PATH`.

For env editing, they might use `sudo -u askonveksi` but `$DEPLOY_PATH/shared` may be owned by deploy user. Use `sudo -u askonveksi` to avoid root-owned `.env`. If they SSH as deploy user, no sudo needed. Mention "jalankan sebagai user PM2, bukan root".

For commands with `$DEPLOY_PATH`, if using `sudo -u`, environment var may not pass; use literal path.

**Testing with curl**:
- App health: `curl -I http://127.0.0.1:$APP_PORT` (Next root may redirect 307 to login; `-f` fails on 3xx? `curl -fsS` follows? `-f` doesn't fail on 3xx, it fails >=400. Fine.)
- WA health: `curl -fsS http://127.0.0.1:$WA_PORT/health`.
- Public logo: `curl -fsS -o /tmp/logo -w '%{http_code} %{content_type} %{size_download}\n' http://127.0.0.1:$APP_PORT/api/public/business-logo`. If no logo, 404; but likely logo exists. This confirms VPS read.
- Could compare bytes with local file? On VPS, find logo path from DB not easy; but public route serves latest logo. Good.

**How to know the file path for a UI upload**:
- Use `find "$ERP_STORAGE_DIR" -type f -mmin -3 -printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\n' | sort`.
- For old files: `find ... -type f | wc -l`.
- For a specific bucket: `find "$ERP_STORAGE_DIR/crm-po-designs/design" -type f -mmin -5`.
- Compare with Supabase dashboard object list.

**How to verify hybrid writes both**:
- After upload, check VPS file exists; then Supabase Dashboard → Storage → bucket → same relative path. Or use `storage:migrate --verify` after backfill (it compares all).
- To verify a single object via Supabase API, could use `node` script, but not necessary.

**Backfill expected counts**:
- On local we saw 36 design, 7 business, 42 payment, 0 WA. On VPS, counts may differ because new uploads; run dry-run to see.

**Testing worker media**:
- Inbound: send image from a phone to connected WA; wait; `find "$ERP_STORAGE_DIR/whatsapp-media" -type f -mmin -5`.
- Outbound: app WhatsApp → attach image → send; worker logs `job ... sent`; VPS file exists; recipient receives.
- Delete account: UI "hapus nomor" flags deletion; worker deletes in batches; verify media files removed. But this is destructive; use test account only.

**Backup restore test**:
- Since app is running, don't extract over live dir. Extract to temp and compare checksums. Then optionally do a full restore during maintenance.
- `tar -tzf` list.
- `sha256sum` sample.

**Rollback**:
- exact commands:
```bash
cd "$DEPLOY_PATH/shared"
cp .env .env.bak.rollback
sed -i '/^ERP_STORAGE_DRIVER=/d' .env
printf 'ERP_STORAGE_DRIVER=supabase\n' >> .env
pm2 restart <app> <app>-wa --update-env
```
- Keep `ERP_STORAGE_DIR` in env? If driver supabase, it's ignored; can leave for later. Better leave both, only flip driver. No need to remove dir.
- After rollback, new files from hybrid are in Supabase, so app works.
- If rollback due worker module missing, set driver supabase doesn't fix import error because worker imports local-store at top. But deploy now includes it. If worker still fails, check release file and redeploy. Mention.

**Monitoring logs**:
- `pm2 logs <app> --lines 200 --nostream | grep -E '\[erp-storage\]'`.
- `pm2 logs <app>-wa --lines 200 --nostream | grep -E 'media|ERR_MODULE|Error'`.
- `fallback-supabase` before backfill normal; after backfill should stop.
- `hybrid-put-rollback` = urgent.

**One important operational warning**: Do NOT set `ERP_STORAGE_DRIVER=local` on production before backfill + verify. Otherwise old images 404. Sequence: hybrid → deploy → backfill → verify → grace → local.

**One more**: Do not delete Supabase buckets until grace period ends.

**One more**: Do not put `ERP_STORAGE_DIR` inside `$DEPLOY_PATH/releases`; deploy workflow rejects inside DEPLOY_PATH.

**Test matrix** maybe table:
| Test | Action | Expected |
- Old image load
- New design upload
- Replace production design
- Remove penjahit design
- Payment proof replace
- Logo/signature
- PDF invoice/PO
- WA inbound/outbound
- DEVELOPER role
- Disk/permission
- Backup.

Need keep response not too huge. Maybe 150 lines. The user asked "apa langkah langkahnya dan bagaimana cara test nya agar berhasil" — they likely want detailed. We'll give clear phases and a test checklist.

Since plan mode: end with "Kalau Anda kirim output `pm2 ls` dan `DEPLOY_PATH`, saya bisa sesuaikan command-nya" and note "Saya belum mengubah apa pun di VPS." Also if they want implementation, they need switch agents (system says if user asks to implement, tell them switch). They asked plan, so no need.

Let's ensure no inaccurate claims:
- Deploy workflow verifies `ERP_STORAGE_DIR` outside `DEPLOY_PATH`; yes.
- Deploy workflow restarts app and WA; yes, `start_pm2`, `start_wa`.
- Worker media deletion on account deletion is batched, yes.
- Logo/signature old files intentionally kept, confirmed.
- Payment proof old file deleted on update, confirmed finance.ts line 82.
- Design revision old files remain (history), yes.
- Production design replace old file removed, confirmed.
- Penjahit remove old file removed, confirmed.

Also mention "Desain revisi" vs "Ganti desain produksi":
- Upload revisi di CRM menambah file baru; file revisi lama tetap sebagai histori. Itu bukan test hapus.
- Untuk test hapus, gunakan desain penjahit (remove) atau ganti desain produksi (old removed) or bukti pengeluaran replace.

This nuance is valuable.

Let's write final in Indonesian.

Yang sudah selesai baru di **mesin lokal**. Di VPS belum ada perubahan. Berikut urutan yang aman, jangan dibalik: **buat folder → set env → deploy → smoke test → backfill → backup → monitoring**.

Ganti placeholder ini dengan nilai Anda:
- `<APP>` = nama PM2 aplikasi, mis. `askonveksi`
- `<APP>-wa` = worker WhatsApp, mis. `askonveksi-wa`
- `$DEPLOY_PATH` = folder deploy, mis. `/var/www/askonveksi`
- `$APP_PORT` / `$WA_PORT` = port aplikasi dan health worker

Ambil `DEPLOY_PATH` dari GitHub → Settings → Environments → `production` → Variables, atau lihat proses PM2:

```bash
pm2 ls
pm2 describe <APP> | grep -E 'status|script path|exec cwd'
```

---

## Fase 0 — Preflight VPS

Jalankan sebagai user deploy, bukan root:

```bash
whoami
df -h /var/lib /var/backups
du -sh "$DEPLOY_PATH"
free -h
```

Backup konfigurasi sebelum diubah:

```bash
cp "$DEPLOY_PATH/shared/.env" \
   "$DEPLOY_PATH/shared/.env.bak.$(date +%F-%H%M%S)"
```

Pastikan Anda tahu user yang menjalankan PM2:

```bash
pm2 describe <APP> | grep -E 'exec cwd|uid|gid'
```

Contoh di bawah memakai user `askonveksi`. Kalau user PM2 Anda berbeda, ganti.

---

## Fase 1 — Siapkan folder storage

```bash
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/backups/askonveksi

sudo -u askonveksi bash -lc '
  touch /var/lib/askonveksi/storage/.write-test &&
  rm /var/lib/askonveksi/storage/.write-test &&
  echo "storage writable"
'
```

Cek kapasitas. Sediakan minimal 2× ukuran bucket saat ini + 5 GB cadangan:

```bash
df -h /var/lib
```

**Jangan** memakai folder di dalam `$DEPLOY_PATH/releases` karena release lama otomatis dipangkas saat deploy.

---

## Fase 2 — Set env SEBELUM deploy

Ini penting. Deploy workflow baru akan menolak driver non-Supabase jika folder/env belum siap.

```bash
cd "$DEPLOY_PATH/shared"

# hapus baris lama agar tidak duplikat
sed -i '/^ERP_STORAGE_DRIVER=/d;/^ERP_STORAGE_DIR=/d' .env

printf '\nERP_STORAGE_DRIVER=hybrid\nERP_STORAGE_DIR=/var/lib/askonveksi/storage\n' >> .env

chown askonveksi:askonveksi .env
chmod 600 .env

grep -n '^ERP_STORAGE_' .env
```

Yang diharapkan:

```text
ERP_STORAGE_DRIVER=hybrid
ERP_STORAGE_DIR=/var/lib/askonveksi/storage
```

Jangan tampilkan seluruh isi `.env` di chat/log karena berisi secret.

---

## Fase 3 — Deploy kode

Deploy lewat push ke branch `production` atau jalankan workflow manual.

Yang harus terlihat di workflow:
1. Lint dan test lulus.
2. Build standalone lulus.
3. Tarball berisi:
   ```text
   ./worker/whatsapp.mjs
   ./lib/storage/local-store.mjs
   ```
4. Deploy step memverifikasi:
   - `ERP_STORAGE_DIR` ada,
   - absolut,
   - di luar `$DEPLOY_PATH`,
   - writable oleh user deploy.

Setelah deploy:

```bash
pm2 ls

pm2 describe <APP> | grep -E 'status|script path|exec cwd'
pm2 describe <APP>-wa | grep -E 'status|script path|exec cwd'

pm2 logs <APP> --lines 150 --nostream | grep -E 'erp-storage|ERR_MODULE|Error' || true
pm2 logs <APP>-wa --lines 150 --nostream | tail -40

curl -fsS "http://127.0.0.1:$APP_PORT" -o /dev/null && echo "app OK"
curl -fsS "http://127.0.0.1:$WA_PORT/health" && echo "worker OK"
```

Cek proses benar-benar memakai env baru:

```bash
for pid in $(pgrep -f "$DEPLOY_PATH/current/server.js"); do
  tr '\0' '\n' < "/proc/$pid/environ" | grep '^ERP_STORAGE_'
done
```

Kalau kosong, restart dengan env terbaru:

```bash
pm2 restart <APP> <APP>-wa --update-env
```

---

## Fase 4 — Smoke test sebelum backfill (mode hybrid)

Pada tahap ini:
- file baru ditulis ke **VPS + Supabase**,
- file lama yang belum ada di VPS dibaca dari Supabase,
- log `[erp-storage] fallback-supabase` masih wajar.

### 4.1 Test baca file lama

1. Login sebagai OWNER atau DEVELOPER.
2. Buka PO/desain/logo lama.
3. Pastikan gambar masih tampil.
4. Cek log:
   ```bash
   pm2 logs <APP> --lines 200 --nostream | grep 'fallback-supabase' || true
   ```

### 4.2 Test upload gambar baru

Buat penanda waktu:

```bash
date +%s > /tmp/storage-marker
```

Lalu dari UI:
- upload desain revisi baru, atau
- upload logo baru, atau
- upload bukti pembayaran.

Cek file VPS:

```bash
find /var/lib/askonveksi/storage \
  -type f -newer /tmp/storage-marker \
  -printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\n' | sort
```

Yang diharapkan, contoh:

```text
/var/lib/askonveksi/storage/crm-po-designs/design/<taskId>/<uuid>.png
```

Lalu cek di Supabase Dashboard → Storage → bucket yang sama → path relatif yang sama **juga ada**. Itu bukti hybrid sukses di dua tempat.

### 4.3 Test edit/ganti gambar

Gunakan **Ganti Desain** di Detail Desain/Produksi:

1. Catat file desain lama:
   ```bash
   find /var/lib/askonveksi/storage/crm-po-designs/design -type f
   ```
2. Ganti desain dari UI.
3. Yang diharapkan:
   - file baru muncul,
   - file desain lama **terhapus** dari VPS dan Supabase,
   - pratinjau di UI berubah.

Catatan:
- Upload **revisi desain baru** di CRM tidak menghapus revisi lama karena revisi lama memang histori.
- Yang menghapus file lama adalah **Ganti Desain Produksi** atau **hapus desain penjahit**.

### 4.4 Test hapus gambar

Pilih salah satu:

**A. Hapus desain penjahit**
1. Buka PO.
2. Edit rencana penjahit.
3. Centang hapus desain, lalu simpan.
4. Cek file lama:
   ```bash
   find /var/lib/askonveksi/storage/crm-po-designs/penjahit -type f
   ```
   File yang dihapus harus hilang.

**B. Ganti bukti pengeluaran**
1. Edit pengeluaran.
2. Upload bukti baru.
3. Simpan.
4. File bukti lama di `payment-proofs/<userId>/` harus terhapus.

**C. Hapus tanda tangan**
- Menghapus tanda tangan dari profil **hanya mengosongkan path di DB**.
- File lama sengaja **tidak dihapus** karena masih dipakai snapshot invoice lama.
- Ini bukan bug; jangan menganggap test gagal.

### 4.5 Test logo dan tanda tangan

- Upload logo baru → file baru di `business-assets/business/logo-*.png`.
- Upload tanda tangan baru → file baru di `business-assets/business/signature-*`.
- Logo/tanda tangan lama sengaja dipertahankan untuk snapshot invoice/PO.
- Buka halaman Master Data dan pastikan gambar baru tampil.

### 4.6 Test PDF yang membaca gambar

Buka:
- PDF Purchase Order,
- PDF Invoice,
- Kwitansi,
- Bukti pembayaran/pengeluaran.

Yang diharapkan:
- logo, tanda tangan, dan desain tampil,
- tidak ada 404,
- tidak ada error di `pm2 logs`.

### 4.7 Test WhatsApp

**Media masuk:**
1. Kirim gambar ke nomor WA yang terhubung.
2. Tunggu worker memproses.
3. Cek:
   ```bash
   find /var/lib/askonveksi/storage/whatsapp-media -type f -mmin -5 -ls
   ```

**Media keluar:**
1. Kirim lampiran gambar/PDF dari aplikasi.
2. Pastikan penerima menerima file.
3. Cek file di VPS dan log worker:
   ```bash
   pm2 logs <APP>-wa --lines 100 --nostream | tail -40
   ```

### 4.8 Test role DEVELOPER

Login sebagai DEVELOPER:
- buka desain, PO, invoice, pembayaran, WhatsApp,
- lakukan satu upload gambar,
- pastikan tidak ada menu/fitur baru yang terblokir.

Tidak ada perubahan aturan role pada implementasi ini, tetapi ini tetap perlu diuji sesuai aturan proyek.

---

## Fase 5 — Backfill semua file lama ke VPS

Setelah smoke test lolos. Jalankan sebagai user aplikasi, **bukan root**, dari full checkout repo (bukan folder release, karena `scripts/` tidak ikut ke release).

```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail

  DEPLOY_PATH=/path/ke/deploy
  REPO=/path/ke/checkout/askonveksi

  cd "$REPO"
  npm ci

  set -a
  . "$DEPLOY_PATH/shared/.env"
  set +a

  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```

Kalau belum ada checkout di VPS:

```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  rm -rf /tmp/askonveksi-migrate
  git clone <URL_REPO> /tmp/askonveksi-migrate
  cd /tmp/askonveksi-migrate
  npm ci
  set -a; . /path/ke/deploy/shared/.env; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```

Yang diharapkan di akhir:

```text
[verify] crm-po-designs: ... missing=0 mismatched=0 extra=0
[verify] business-assets: ... missing=0 mismatched=0 extra=0
[verify] payment-proofs: ... missing=0 mismatched=0 extra=0
[verify] whatsapp-media: ... missing=0 mismatched=0 extra=0
[storage-migrate] selesai tanpa masalah.
```

Setelah backfill:
- file lama sudah ada di VPS,
- log `fallback-supabase` baru seharusnya tidak muncul lagi,
- jangan langsung hapus bucket Supabase. Tunggu grace period.

---

## Fase 6 — Backup + uji restore

Tes backup manual:

```bash
sudo -u askonveksi -H env \
  ERP_STORAGE_DIR=/var/lib/askonveksi/storage \
  ERP_STORAGE_BACKUP_DIR=/var/backups/askonveksi \
  /path/ke/repo/scripts/backup-erp-storage.sh
```

Cek hasil:

```bash
ls -lh /var/backups/askonveksi/erp-storage-*.tar.gz
tar -tzf /var/backups/askonveksi/erp-storage-*.tar.gz | head
```

Tes restore ke folder sementara, jangan timpa folder produksi:

```bash
rm -rf /tmp/restore-test
mkdir -p /tmp/restore-test
tar -C /tmp/restore-test -xzf /var/backups/askonveksi/erp-storage-*.tar.gz
find /tmp/restore-test -type f | wc -l
```

Bandingkan checksum satu file:

```bash
sha256sum /var/lib/askonveksi/storage/.../file.png
sha256sum /tmp/restore-test/erp-storage/.../file.png
```

Pasang cron (sesuaikan path repo):

```cron
15 2 * * * ERP_STORAGE_DIR=/var/lib/askonveksi/storage ERP_STORAGE_BACKUP_DIR=/var/backups/askonveksi /path/ke/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1
0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
```

Tes cron sekali:

```bash
sudo -u askonveksi /path/ke/repo/scripts/backup-erp-storage.sh
tail -20 /var/log/erp-storage-backup.log
```

Backup file **tidak menggantikan backup database**. Restore DB Supabase dan file VPS harus dari waktu berdekatan.

---

## Fase 7 — Monitoring setelah deploy

Cek log:

```bash
pm2 logs <APP> --lines 300 --nostream | grep -E '\[erp-storage\]|Error' || true
pm2 logs <APP>-wa --lines 300 --nostream | grep -E 'media|Error|ERR_MODULE' || true
```

Arti log:

| Log | Arti | Tindakan |
|---|---|---|
| `fallback-supabase` | File belum ada di VPS, dibaca dari Supabase | Wajar sebelum backfill; setelah backfill harus berhenti |
| `hybrid-put-rollback` | Tulis Supabase gagal, file VPS dibatalkan | **Alert**; cek kredensial/bucket Supabase |
| `remove-partial` | Hapus VPS/Supabase tidak sepenuhnya sukses | Cek permission dan koneksi |
| `ERR_MODULE_NOT_FOUND` | `local-store.mjs` tidak ada di release | Cek tarball/deploy, jangan copy manual ke release |
| 404 pada gambar lama | File belum di-backfill atau path salah | Jalankan `storage:verify`, cek `ERP_STORAGE_DIR` |

Cek kapasitas mingguan:

```bash
df -P /var/lib | tail -1
du -sh /var/lib/askonveksi/storage
find /var/lib/askonveksi/storage -type f | wc -l
```

---

## Fase 8 — Rollback jika bermasalah

Karena mode `hybrid` fail-hard, setiap upload baru sudah ada di Supabase juga. Rollback aman:

```bash
cd "$DEPLOY_PATH/shared"
cp .env ".env.bak.rollback.$(date +%F-%H%M%S)"

sed -i '/^ERP_STORAGE_DRIVER=/d' .env
printf 'ERP_STORAGE_DRIVER=supabase\n' >> .env

pm2 restart <APP> <APP>-wa --update-env
```

Biarkan `ERP_STORAGE_DIR` tetap ada; nilainya tidak dipakai saat driver `supabase`.

Kalau worker error `ERR_MODULE_NOT_FOUND`, jangan rollback driver saja — worker tetap mengimpor modul itu. Cek release:

```bash
ls -l "$DEPLOY_PATH/current/lib/storage/local-store.mjs"
```

Kalau tidak ada, perbaiki deploy dan deploy ulang.

---

## Fase 9 — Cutover final setelah grace period

Baru lakukan setelah:
- `storage:verify` bersih,
- tidak ada `fallback-supabase` selama minimal 14 hari,
- backup + restore sudah teruji,
- UAT semua fitur lolos.

```bash
cd "$DEPLOY_PATH/shared"
sed -i '/^ERP_STORAGE_DRIVER=/d' .env
printf 'ERP_STORAGE_DRIVER=local\n' >> .env
pm2 restart <APP> <APP>-wa --update-env
```

Setelah `local`:
- semua baca/tulis hanya ke VPS,
- biarkan bucket Supabase **kosong** selama 1 bulan sebagai cold copy,
- baru hapus bucket setelah stabil.

---

## Checklist test minimum sebelum presentasi/Produksi

| No | Test | Ekspektasi |
|---|---|---|
| 1 | Buka gambar lama | Tampil, tidak 404 |
| 2 | Upload desain baru | File muncul di VPS dan Supabase |
| 3 | Ganti desain produksi | File baru ada, file lama terhapus |
| 4 | Hapus desain penjahit | File VPS hilang |
| 5 | Ganti bukti pengeluaran | Bukti lama terhapus, baru tampil |
| 6 | Upload logo/tanda tangan | File baru di `business-assets` |
| 7 | PDF PO/Invoice/Kwitansi | Logo/tanda tangan/desain tampil |
| 8 | WhatsApp masuk bergambar | File di `whatsapp-media` |
| 9 | WhatsApp keluar bergambar | Terkirim, file dibaca dari VPS |
| 10 | Login DEVELOPER | Semua fitur tetap bisa diakses |
| 11 | `storage:verify` | `missing=0 mismatched=0 extra=0` |
| 12 | Backup + restore sample | Checksum sama |

Kalau Anda kirimkan output `pm2 ls`, `pm2 describe <APP>`, dan `DEPLOY_PATH` yang sebenarnya, saya bisa tuliskan versi command final tanpa placeholder. Saya belum mengubah apa pun di VPS.

---

## User

bantu aku menyambungkan ke vps ku dengan settingan berikut yang sudah digunakan temanku

---

## User

aku baru saja menbuat koneksi ke vps ku dengan cara ssh askonveksi-cloud apakah kamu bisa mengaksesnya dan menconfigurasi persiapanya di vps ku? tapi jangan ubah dulu code nya, fokus ke vps dulu
