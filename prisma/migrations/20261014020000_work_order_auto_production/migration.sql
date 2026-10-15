-- Halaman Detail Desain disembunyikan: Work Order langsung masuk Produksi saat
-- dibuat (designCompletedAt diisi pada createProductionWorkOrder).
-- Samakan WO aktif lama yang belum dikirim agar tetap tampil di kanban Produksi.

UPDATE "ProductionWorkOrder"
SET "designCompletedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "designCompletedAt" IS NULL AND "status" <> 'CANCELLED';
