-- Urutan kategori produk dipaksa selamanya: Jersey, lalu Non-jersey, terakhir Aksesoris.
-- Di dalam grup tetap memakai urutan position dan nama lama.
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      ORDER BY
        CASE "garmentType" WHEN 'JERSEY' THEN 0 WHEN 'NON_JERSEY' THEN 1 ELSE 2 END,
        "position",
        "name"
    ) - 1 AS new_position
  FROM "ProductCategory"
)
UPDATE "ProductCategory" AS p
SET "position" = o.new_position
FROM ordered AS o
WHERE p."id" = o."id" AND p."position" IS DISTINCT FROM o.new_position;
