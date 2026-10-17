-- Bersihkan tabel log aktivitas (AuditEvent) — reset sebelum demo.
--
-- Cara pakai:
--   - Supabase : buka SQL Editor, tempel seluruh isi file ini, Run.
--   - psql     : psql "$DATABASE_URL" -f scripts/clear-audit-log.sql
--
-- Kenapa ada UPDATE dulu (jangan dihapus):
--   CommunicationActivity.sourceAuditEventId -> AuditEvent.id memakai
--   ON DELETE RESTRICT. Tanpa melepas tautan, DELETE akan gagal dengan
--   error foreign key begitu ada riwayat komunikasi yang tertaut.
--   Kolom itu nullable dan hanya jejak asal-usul saat penulisan (tidak
--   dibaca halaman mana pun), jadi mengosongkannya aman — baris riwayat
--   komunikasi customer tetap utuh, hanya kehilangan tautan auditnya.
--
-- Hasil: halaman /log-aktivitas kembali kosong; aksi berikutnya tercatat
-- lagi secara otomatis. Tidak ada tabel lain yang dihapus.

BEGIN;

UPDATE "CommunicationActivity"
SET "sourceAuditEventId" = NULL
WHERE "sourceAuditEventId" IS NOT NULL;

DELETE FROM "AuditEvent";

COMMIT;

-- Verifikasi (opsional, jalankan terpisah):
-- SELECT count(*) AS sisa_log_aktivitas FROM "AuditEvent";                -- harus 0
-- SELECT count(*) AS riwayat_komunikasi FROM "CommunicationActivity";    -- tidak berubah
