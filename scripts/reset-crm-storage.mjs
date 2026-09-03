import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const requiredVariables = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length) {
  throw new Error(`Environment belum lengkap: ${missingVariables.join(", ")}`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const retiredBuckets = ["quotation-acceptance-proofs"];
const purchaseOrderBucket = "crm-po-designs";
const purchaseOrderBucketOptions = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};
const { data: buckets, error: listError } = await supabase.storage.listBuckets();

if (listError) throw new Error(`Daftar bucket tidak dapat dibaca: ${listError.message}`);

for (const bucketId of retiredBuckets) {
  if (!buckets.some((bucket) => bucket.id === bucketId)) continue;

  const { error: emptyError } = await supabase.storage.emptyBucket(bucketId);
  if (emptyError) throw new Error(`Bucket ${bucketId} tidak dapat dikosongkan: ${emptyError.message}`);

  const { error: deleteError } = await supabase.storage.deleteBucket(bucketId);
  if (deleteError) throw new Error(`Bucket ${bucketId} tidak dapat dihapus: ${deleteError.message}`);

  console.log(`Bucket lama dihapus: ${bucketId}`);
}

const existingPurchaseOrderBucket = buckets.some((bucket) => bucket.id === purchaseOrderBucket);
const { error: configureError } = existingPurchaseOrderBucket
  ? await supabase.storage.updateBucket(purchaseOrderBucket, purchaseOrderBucketOptions)
  : await supabase.storage.createBucket(purchaseOrderBucket, purchaseOrderBucketOptions);

if (configureError) throw new Error(`Bucket ${purchaseOrderBucket} tidak dapat disiapkan: ${configureError.message}`);

console.log(`Bucket privat siap: ${purchaseOrderBucket}`);
console.log("Reset storage CRM selesai.");
