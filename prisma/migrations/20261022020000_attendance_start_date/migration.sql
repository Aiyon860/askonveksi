-- Batas awal perhitungan absensi. Hari kerja sebelum tanggal ini tidak
-- diturunkan menjadi Alpha, sehingga modul bisa dimulai dari nol tanpa
-- menghapus tanggal pembuatan akun pegawai.
BEGIN;

ALTER TABLE "BusinessProfile"
  ADD COLUMN "attendanceStartDate" DATE NOT NULL
    DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date);

UPDATE "BusinessProfile"
SET "attendanceStartDate" = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date;

COMMIT;
