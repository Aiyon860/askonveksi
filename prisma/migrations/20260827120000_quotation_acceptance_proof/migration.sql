ALTER TABLE "Quotation"
ADD COLUMN "acceptanceProofPath" VARCHAR(500),
ADD COLUMN "acceptanceProofName" VARCHAR(255),
ADD COLUMN "acceptanceProofType" VARCHAR(64);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotation-acceptance-proofs',
  'quotation-acceptance-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
