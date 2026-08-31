# Backup grafik dashboard

`dashboard-grafik.bundle` menyimpan commit `8ae61b1` yang khusus menambahkan:

- grafik pendapatan bulanan dan order selesai/lunas di dashboard;
- data dummy, filter tahun, formatter Rupiah, dan aksesibilitas grafik;
- komponen chart/native select serta dependensi `recharts` yang diperlukan.

Setelah `git pull`, pulihkan dengan:

```bash
git fetch backup/dashboard-grafik/dashboard-grafik.bundle dev:refs/remotes/backup/dashboard-grafik
git cherry-pick refs/remotes/backup/dashboard-grafik
```

Jika `cherry-pick` melaporkan konflik karena dashboard baru sudah berubah, jangan hapus perubahan baru. Batalkan dengan `git cherry-pick --abort`, lalu pasang ulang bagian grafik secara manual dari commit backup:

```bash
git show refs/remotes/backup/dashboard-grafik -- app/dashboard/page.tsx
```
