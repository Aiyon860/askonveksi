-- ============================================================================
-- CLEANUP CHAT WHATSAPP (Askonveksi)
-- ============================================================================
-- TUJUAN:
--  Hapus SEMUA riwayat chat: WhatsAppMessage + WhatsAppConversation.
--
-- YANG ikut terdampak (otomatis, aman):
--  - CommunicationActivity yang menempel ke pesan -> kolom whatsappMessageId
--    di-set NULL (relasi onDelete: SetNull), aktivitasnya TETAP ada.
--  - WhatsAppConversation yang menempel ke customer -> baris percakapan
--    dihapus, CUSTOMER-nya tetap ada.
--
-- YANG SENGAJA TIDAK DIHAPUS:
--  Customer, Opportunity, dan seluruh tabel order/keuangan/desain/master.
--  WhatsAppAccount & WhatsAppTemplate juga dipertahankan (koneksi Baileys
--  dan template pesan tetap utuh, tinggal pakai lagi).
--
-- CARA PAKAI (pilih salah satu):
--  Lokal    : PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres \
--               -d askonveksi_local -v ON_ERROR_STOP=1 \
--               -f scripts/cleanup-whatsapp-chats.sql
--  Supabase : paste isi file ini ke SQL Editor, atau:
--               psql "$DIRECT_URL" -f scripts/cleanup-whatsapp-chats.sql
--
-- Script ini SATU TRANSAKSI: guard akan ROLLBACK otomatis bila jumlah
-- Customer/Opportunity berubah (lihat PENJAGA di bawah).
-- Catatan: file media di bucket Storage TIDAK ikut terhapus (baris DB saja).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PENJAGA: snapshot data yang WAJIB utuh
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _guard_before AS
SELECT 'Customer' AS tbl, count(*) AS c FROM "Customer"
UNION ALL SELECT 'Opportunity', count(*) FROM "Opportunity"
UNION ALL SELECT 'WhatsAppAccount', count(*) FROM "WhatsAppAccount"
UNION ALL SELECT 'WhatsAppTemplate', count(*) FROM "WhatsAppTemplate"
UNION ALL SELECT 'CommunicationActivity', count(*) FROM "CommunicationActivity";

-- Ringkasan SEBELUM:
SELECT 'SEBELUM' AS fase, tbl, c FROM _guard_before ORDER BY tbl;

-- ----------------------------------------------------------------------------
-- 1. HAPUS PESAN DULU (menempel ke conversation via Restrict, jadi harus duluan)
-- ----------------------------------------------------------------------------
DELETE FROM "WhatsAppMessage";

-- ----------------------------------------------------------------------------
-- 2. HAPUS PERCAKAPAN
-- ----------------------------------------------------------------------------
DELETE FROM "WhatsAppConversation";

-- ----------------------------------------------------------------------------
-- PENJAGA: verifikasi akhir. Rollback bila ada data wajib yang berubah.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  after_c BIGINT;
BEGIN
  FOR r IN SELECT tbl, c AS before_c FROM _guard_before LOOP
    CASE r.tbl
      WHEN 'Customer' THEN SELECT count(*) INTO after_c FROM "Customer";
      WHEN 'Opportunity' THEN SELECT count(*) INTO after_c FROM "Opportunity";
      WHEN 'WhatsAppAccount' THEN SELECT count(*) INTO after_c FROM "WhatsAppAccount";
      WHEN 'WhatsAppTemplate' THEN SELECT count(*) INTO after_c FROM "WhatsAppTemplate";
      WHEN 'CommunicationActivity' THEN SELECT count(*) INTO after_c FROM "CommunicationActivity";
    END CASE;
    IF after_c IS DISTINCT FROM r.before_c THEN
      RAISE EXCEPTION 'PENJAGA GAGAL: % berubah % -> % (rollback!)',
        r.tbl, r.before_c, after_c;
    END IF;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- RINGKASAN SESUDAH (target: Message & Conversation = 0)
-- ----------------------------------------------------------------------------
SELECT 'SESUDAH' AS fase, 'WhatsAppMessage' AS tbl, count(*) AS c FROM "WhatsAppMessage"
UNION ALL SELECT 'SESUDAH', 'WhatsAppConversation', count(*) FROM "WhatsAppConversation"
UNION ALL SELECT 'SESUDAH', 'WhatsAppAccount:utuh', count(*) FROM "WhatsAppAccount"
UNION ALL SELECT 'SESUDAH', 'WhatsAppTemplate:utuh', count(*) FROM "WhatsAppTemplate"
ORDER BY tbl;

COMMIT;
