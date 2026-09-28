-- Perpindahan tahap mundur pada kanban Produksi dicatat sebagai aktivitas tersendiri
-- agar riwayat aktivitas dapat membedakan maju (STAGE_MOVED) dari mundur.
ALTER TYPE "ProductionActivityType" ADD VALUE IF NOT EXISTS 'STAGE_REVERTED';
