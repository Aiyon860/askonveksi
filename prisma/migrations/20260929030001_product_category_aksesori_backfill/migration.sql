-- Kategori aksesori yang sudah ada dipindahkan ke jenis Aksesori.
UPDATE "ProductCategory"
SET "garmentType" = 'AKSESORI'
WHERE lower("name") IN ('lanyard', 'topi', 'totebag', 'ganci');
