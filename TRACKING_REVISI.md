# TRACKING REVISI ASKONVEKSI

**Tanggal:** 10 Okt 2026 · **Cabang:** `dev` · **Aturan:** role DEVELOPER tetap full akses di semua fitur.

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

## SPRINT 3 — Role & Produksi (D + G) — prioritas 2

- [x] D1 — Role `ADMIN_PO` (hak = Admin Customer) + upload desain langsung detailing
- [x] D2 — Gambar hanya PNG/JPG (tolak PDF)
- [x] D3 — Detailing desain opsional
- [x] G1 — Jalur Aksesori 5 stage: Produksi-QC-Packing-Pengiriman-Selesai
- [x] G2 — Admin Customer view-only produksi
- [x] G3 — Status Retur setelah Selesai + badge sticky (hilang saat kembali Selesai)

## SPRINT 4 — CRM & Broadcast (B + H) — prioritas 3

- [ ] B1 — Tambah prospek, PIC lock Michelle
- [ ] B2 — Sumber Lead "Lainnya" bisa custom
- [ ] B3 — Kanban pipeline font bold (Prospek ke kanan)
- [ ] B4 — Data Master boleh tambah/edit/hapus oleh Admin Customer
- [ ] H1 — Import tanggal Excel ke Broadcast (tanpa detail order tidak apa)
- [ ] H2 — Kategori produk di Broadcast (samakan dengan Campaign)
- [ ] H3 — Upload PO 2+ gambar/desain jadi 1 file + keputusan N WO (terkait C2)

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
