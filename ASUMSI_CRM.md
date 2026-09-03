# Asumsi

1. Pengiriman invoice dilakukan manual. Cetak PDF → kirim ke klien/customer lewat Admin
2. Invoice berisi harga berdasarkan ukuran dan jumlah pada PO Disepakati. Pembayaran Lunas atau DP dicatat terpisah saat Deal.
3. Status CRM:
   - Lead Baru
   - Follow Up
   - Negosiasi
   - Deal
   - Lost

4. Admin input manual data diri dan spesifikasi desain di WA atau IG DM
5. Klien melihat trace orderan dari barcode order yang diberikan dari pihak konveksi
6. Kalo repeat order, itu buat data order baru nya itu tetap dari konveksi langsung bukan klien

## Kanban Board

| Lead Baru | Follow Up | Negosiasi | Deal | Lost |
|---|---|---|---|---|
| Data customer | Data customer | PO + invoice dan revisinya | Sudah DP/lunas | Batal |

7. Masuk halaman CRM langsung keluar kanban board sales pipeline, terus ada tab atau tombol ke halaman-halaman list klien
8. Menambah kanban board lagi untuk sisi produksi
