# Progress dokumentasi user flows

## Meta

- Mulai / lanjut: 2026-11-10
- URL: `http://localhost:3000` · `npm run dev`
- Browser: Playwright-core + Moli CDP
- Auth uji: pola `{local-part}123` — lihat `00-index.md`
- Dilarang dipatuhi: tidak ubah kode app, tidak tulis test, tidak hapus data

## Ringkas

| Metrik | Nilai |
| --- | --- |
| Fitur di index | **40** |
| Status `browser` | **40** |
| Scope docs read-only | **Selesai** (klaim yang bisa diisi tanpa seed/mutasi sudah ditutup) |

## Checklist sesi ini

| Item | Hasil |
| --- | --- |
| Gap-fill UI sebelumnya | Logout, brand, masters, WA, finance filters, CMS denial, dll. |
| Gap-fill kode + sisa UI | Pesan error/sukses users, campaign, production, payment, HPP, attendance settings, business profile images, CMS save, pipeline move dialog, analytics API errors, PO revisi form labels (Veronica), camera error copy |
| Seed / mutasi | **Tidak dilakukan** |

## Evidence baru (putaran ini)

- `04-absen-camera.png`, `18-invoice-veronica.png`, `33-analytics.png`, `34-analytics-lead.png`
- `continue-gapfill10.json`, `continue-gapfill11.json`

## Blokir tersisa (butuh izin user / di luar docs)

1. Seed PO draft 0-revisi multi-item → dialog `Unggah desain` first/multi.
2. Seed WO `Belum dikirim` + attachment → editor anotasi Detail Desain.
3. Patch Owner `/detail-desain` 500 → 403.
4. Form create PO dari peluang **tanpa** PO; issue invoice dari PO Disepakati **tanpa** invoice (data lokal tidak punya kombinasi itu tanpa mutasi).
5. Mutasi sukses end-to-end (bayar/void/absen kamera/simpan settings flash live).
6. Password pola produksi/staging (di luar lokal).

## Berikutnya (bukan docs murni)

- Seed terkontrol **jika** diizinkan.
- Fix detail desain access error.
- Matriks E2E Playwright dari `docs/user-flows/*`.
