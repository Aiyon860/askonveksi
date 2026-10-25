-- Desain penjahit per produk boleh lebih dari satu gambar.
-- Satu gambar dicetak sebagai satu halaman penuh di PDF varian penjahit.
--
-- Backfill: desain lama (kolom tunggal penjahitDesignPath) dipindah menjadi
-- baris pertama (position 0) supaya PDF & thumbnail tetap tampil. Kolom lama
-- tidak dihapus agar tetap menjadi fallback dokumen lama.

CREATE TABLE IF NOT EXISTS "PurchaseOrderItemDesign" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(64) NOT NULL,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderItemDesign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderItemDesign_position_nonnegative" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderItemDesign_itemId_position_key" ON "PurchaseOrderItemDesign"("itemId", "position");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItemDesign_itemId_position_idx" ON "PurchaseOrderItemDesign"("itemId", "position");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItemDesign_itemId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderItemDesign"
      ADD CONSTRAINT "PurchaseOrderItemDesign_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PurchaseOrderItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

INSERT INTO "PurchaseOrderItemDesign" ("id", "itemId", "position", "path", "originalName", "contentType", "createdAt")
SELECT
  'legacy-' || item."id",
  item."id",
  0,
  item."penjahitDesignPath",
  COALESCE(item."penjahitDesignName", 'desain-penjahit'),
  COALESCE(item."penjahitDesignType", 'image/png'),
  item."createdAt"
FROM "PurchaseOrderItem" item
WHERE item."penjahitDesignPath" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PurchaseOrderItemDesign" design
    WHERE design."itemId" = item."id" AND design."position" = 0
  );

ALTER TABLE "PurchaseOrderItemDesign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PurchaseOrderItemDesign" FROM anon, authenticated;
