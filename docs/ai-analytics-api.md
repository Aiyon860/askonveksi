# API & MCP analitik untuk asisten AI

Jembatan baca-saja supaya ChatGPT, Claude, atau Gemini bisa menjawab pertanyaan seperti
"omzet bulan ini berapa?", "customer paling banyak dari kota mana?", "produk apa yang paling
sering dipesan?" tanpa pernah menyentuh database langsung.

## Prinsip

| Aspek | Keputusan |
| --- | --- |
| Data | Hanya **agregat**. Tidak ada nomor WhatsApp, email, alamat, atau nama lengkap customer (top customer disamarkan). |
| Akses | Token Bearer per integrasi, disimpan sebagai hash SHA-256, bisa dicabut kapan saja. |
| Tulis | Tidak ada endpoint tulis. Token bocor tidak bisa mengubah/menghapus apa pun. |
| Rate limit | 60 permintaan/menit per token (HTTP 429 + `Retry-After: 60`). |
| Audit | Setiap panggilan dicatat di tabel `AiApiEvent` (token, endpoint, parameter, status, durasi). |
| Biaya | Rp0: berjalan di server aplikasi yang sudah ada, tanpa API key LLM. |

Domain produksi: **https://askonveksi.web.id** (diambil dari `lib/site.ts`, bisa ditimpa
dengan env `AI_PUBLIC_BASE_URL`). Semua URL di bawah memakai domain itu.

## Membuat token

1. Masuk sebagai Developer/Owner.
2. Buka **Data Master → Akses AI** (`/admin/ai-access`).
3. Isi nama token (mis. `ChatGPT Marketing`), pilih masa berlaku, klik **Buat token**.
4. Salin token yang muncul — hanya ditampilkan sekali.

Token yang dicabut langsung ditolak dengan `403 token_revoked`.

## Endpoint REST

Semua endpoint memakai header `Authorization: Bearer <token>` (alternatif: `x-api-key`).
Parameter periode: `preset` (`this-month`, `last-month`, `7d`, `30d`, `this-year`, `all`,
`today`, `yesterday`) atau `from`/`to` (`YYYY-MM-DD`). `brand` = `ASKONVEKSI` (default), `SAGA`, `ALL`.

| Endpoint | Isi |
| --- | --- |
| `GET /api/ai` | Katalog metrik, definisi, batas privasi, dan konfirmasi token valid |
| `GET /api/ai/overview` | Omzet, pesanan, AOV, pcs, HPP, laba kotor, margin, pertumbuhan vs periode sebelumnya, rincian per brand |
| `GET /api/ai/products?limit=10` | Produk terlaris (omzet, pcs, harga rata-rata, porsi omzet) + sebaran JERSEY/NON_JERSEY/AKSESORI |
| `GET /api/ai/customers` | Sebaran kota, sumber lead, jenis customer, siklus hidup, repeat rate, top customer (nama disamarkan) |
| `GET /api/ai/timeseries?granularity=month` | Deret omzet/pesanan/pcs per hari, minggu, atau bulan |
| `GET /api/ai/pipeline` | Jumlah peluang per tahap, win rate, nilai terbuka, sisa piutang, follow-up lewat tenggat |

Contoh:

```bash
curl "https://askonveksi.web.id/api/ai/overview?preset=this-year&brand=ALL" \
  -H "Authorization: Bearer askai_xxx"
```

Setiap respons menyertakan `meta` (periode, brand, definisi metrik) dan — pada endpoint yang
relevan — `quality` berisi persentase kelengkapan kota/sumber lead beserta `warnings`.
Asisten AI diinstruksikan menyebutkan peringatan itu, bukan menyimpulkan dari data yang kosong.

## MCP (satu integrasi untuk tiga asisten)

Endpoint: `POST https://askonveksi.web.id/api/mcp`
Transport: Streamable HTTP, stateless, `enableJsonResponse`.
Header: `Authorization: Bearer <token>`, `Content-Type: application/json`,
`Accept: application/json, text/event-stream`.

Tool yang tersedia:

| Tool | Kegunaan |
| --- | --- |
| `analytics_catalog` | Definisi metrik & batas privasi |
| `sales_overview` | Ringkasan omzet/HPP/margin/pertumbuhan |
| `top_products` | Produk & jenis pakaian terlaris |
| `customer_breakdown` | Kota, sumber lead, jenis customer, repeat, top customer |
| `revenue_trend` | Tren harian/mingguan/bulanan |
| `pipeline_status` | Funnel, win rate, piutang, follow-up lewat tenggat |

### Menyambungkan

**Claude / ChatGPT (custom connector)** — isi URL `https://askonveksi.web.id/api/mcp`.
Klien akan membuka halaman OAuth Askonveksi; tempel token `askai_…` di sana.
(Alternatif Claude: Request headers → `Authorization: Bearer <token>` bila UI menampilkannya.)

**Cursor** — `~/.cursor/mcp.json` / `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "askonveksi": {
      "url": "https://askonveksi.web.id/api/mcp",
      "headers": { "Authorization": "Bearer askai_xxx" }
    }
  }
}
```

**Gemini CLI**

```bash
gemini mcp add askonveksi https://askonveksi.web.id/api/mcp \
  --transport http --header "Authorization: Bearer askai_xxx"
```

### Uji manual MCP

```bash
curl -X POST https://askonveksi.web.id/api/mcp \
  -H "Authorization: Bearer askai_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sales_overview","arguments":{"brand":"ALL","preset":"this-year"}}}'
```

## Definisi angka

- **Omzet**: `SUM(SalesOrder.total)` untuk SalesOrder `ACTIVE`, berdasarkan `acceptedAt`.
- **HPP**: jumlah komponen `SalesOrderCost` (kain, zipper, jahit, pres, DTF/plastisol, bordir, lainnya).
- **Laba kotor** = omzet − HPP; **margin** = laba kotor ÷ omzet.
- **pcs** = jumlah `SalesOrderItem.quantity`; **AOV** = omzet ÷ jumlah pesanan.
- **Piutang** = `SUM(DealPayment.outstandingAmount)` Sales Order aktif (bukan total invoice terbit,
  karena invoice tetap `ISSUED` setelah dibayar).
- **Win rate** = peluang `DEAL` ÷ seluruh peluang pada periode.
- Periode memakai batas hari **Asia/Jakarta**, sama dengan halaman Analytics.

## Keterbatasan data (perlu diketahui sebelum menafsirkan)

- Kota customer terisi sangat sedikit (9 dari 550), sumber lead 8 dari 416 peluang. AI akan
  memberi peringatan; lengkapi kolom kota/sumber lead agar analisis geografis dan kanal bermakna.
- Nama produk berasal dari baris `SalesOrderItem`, jadi variasi ejaan bisa terpisah menjadi
  beberapa baris pada `products`.
- Omzet per jenis pakaian tidak tersedia (harga disimpan per baris pesanan, bukan per jenis);
  `byGarmentType` melaporkan pesanan dan pcs.

## Catatan deployment di VPS

1. `prisma migrate deploy` harus jalan (CI sudah melakukannya) agar tabel
   `AiApiToken`/`AiApiEvent` ada.
2. `/api/ai` dan `/api/mcp` sengaja dikecualikan dari middleware sesi Supabase
   (`middleware.ts`), jadi tidak butuh cookie login dan tidak menambah latensi.
3. Nginx harus meneruskan `X-Forwarded-Proto` agar tautan yang ditampilkan benar,
   dan mengizinkan `POST /api/mcp` (body JSON-RPC) tanpa buffering khusus.
4. Tidak ada port tambahan: API/MCP memakai port aplikasi yang sudah ada.

## Berkas terkait

| Berkas | Peran |
| --- | --- |
| `lib/ai/analytics.ts` | Seluruh query agregat |
| `lib/ai/auth.ts` | Hash & verifikasi token |
| `lib/ai/rate-limit.ts` | Bucket 60 permintaan/menit |
| `lib/ai/http.ts` | Gerbang auth → rate limit → handler → audit |
| `lib/ai/catalog.ts` | Katalog metrik (REST + MCP) |
| `lib/ai/mcp.ts` | Definisi tool MCP |
| `app/api/ai/**`, `app/api/mcp/route.ts` | Endpoint publik |
| `app/(app)/admin/ai-access/page.tsx` | Halaman pembuatan/pencabutan token |
| `prisma/migrations/20261110010000_ai_analytics_api` | Tabel `AiApiToken`, `AiApiEvent` |
