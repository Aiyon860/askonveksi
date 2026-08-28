CREATE TABLE "CustomerType" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerType_name_required" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL),
    CONSTRAINT "CustomerType_position_nonnegative" CHECK ("position" >= 0)
);

CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadSource_name_required" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL),
    CONSTRAINT "LeadSource_position_nonnegative" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "CustomerType_name_key" ON "CustomerType"("name");
CREATE UNIQUE INDEX "CustomerType_name_case_insensitive_key" ON "CustomerType"(LOWER("name"));
CREATE INDEX "CustomerType_isActive_position_name_idx" ON "CustomerType"("isActive", "position", "name");
CREATE UNIQUE INDEX "LeadSource_name_key" ON "LeadSource"("name");
CREATE UNIQUE INDEX "LeadSource_name_case_insensitive_key" ON "LeadSource"(LOWER("name"));
CREATE INDEX "LeadSource_isActive_position_name_idx" ON "LeadSource"("isActive", "position", "name");

INSERT INTO "CustomerType" ("id", "name", "description", "position") VALUES
    ('master-ct-personal', 'Personal', 'Customer perorangan.', 10),
    ('master-ct-perusahaan', 'Perusahaan', 'Badan usaha atau perusahaan.', 20),
    ('master-ct-komunitas', 'Komunitas', 'Komunitas atau kelompok nonformal.', 30),
    ('master-ct-instansi', 'Instansi', 'Instansi pemerintah atau organisasi resmi.', 40),
    ('master-ct-reseller', 'Reseller', 'Mitra yang menjual kembali produk.', 50),
    ('master-ct-unclassified', 'Belum diklasifikasikan', 'Kategori sementara untuk data lama.', 999);

INSERT INTO "LeadSource" ("id", "name", "position") VALUES
    ('master-ls-whatsapp', 'WhatsApp', 10),
    ('master-ls-instagram', 'Instagram', 20),
    ('master-ls-referral', 'Referral', 30),
    ('master-ls-website', 'Website', 40),
    ('master-ls-marketplace', 'Marketplace', 50),
    ('master-ls-event', 'Event', 60),
    ('master-ls-walkin', 'Walk-in', 70),
    ('master-ls-other', 'Lainnya', 999);

ALTER TABLE "Customer"
    ADD COLUMN "city" VARCHAR(120),
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "customerTypeId" TEXT,
    ADD COLUMN "leadSourceId" TEXT,
    ADD COLUMN "salesPicId" TEXT;

UPDATE "Customer" SET "customerTypeId" = 'master-ct-unclassified' WHERE "customerTypeId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "customerTypeId" SET NOT NULL;

CREATE INDEX "Customer_customerTypeId_archivedAt_idx" ON "Customer"("customerTypeId", "archivedAt");
CREATE INDEX "Customer_leadSourceId_idx" ON "Customer"("leadSourceId");
CREATE INDEX "Customer_salesPicId_idx" ON "Customer"("salesPicId");
CREATE INDEX "Customer_city_idx" ON "Customer"("city");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerTypeId_fkey"
    FOREIGN KEY ("customerTypeId") REFERENCES "CustomerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_leadSourceId_fkey"
    FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_salesPicId_fkey"
    FOREIGN KEY ("salesPicId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadSource" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CustomerType", "LeadSource" FROM anon, authenticated;
