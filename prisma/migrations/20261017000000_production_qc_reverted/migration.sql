-- Peringatan "Wajib QC" berdiri sendiri dari Retur:
--   * menempel saat kartu ditarik mundur (REVERT) dari kolom QC ke tahap sebelumnya;
--   * hilang saat kartu mendarat kembali di QC;
--   * selama menempel, kartu tidak boleh dipindahkan melewati QC.
ALTER TABLE "ProductionWorkOrder"
  ADD COLUMN "qcReverted" BOOLEAN NOT NULL DEFAULT false;
