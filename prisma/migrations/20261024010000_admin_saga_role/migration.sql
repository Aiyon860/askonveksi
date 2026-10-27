-- Role baru "Admin Saga": tim lapangan yang hanya membuka halaman Absen,
-- sama seperti Desainer. Nilai enum lama tidak dihapus agar riwayat audit tetap valid.
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'ADMIN_SAGA';
