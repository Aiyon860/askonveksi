import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const requiredVariables = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) throw new Error(`Environment belum lengkap: ${missingVariables.join(", ")}`);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const definitions = [
  {
    id: "crm-po-designs",
    options: { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  },
  {
    id: "business-assets",
    options: { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  },
];
const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw new Error(`Daftar bucket tidak dapat dibaca: ${listError.message}`);

for (const definition of definitions) {
  const exists = buckets.some((bucket) => bucket.id === definition.id);
  const { error } = exists
    ? await supabase.storage.updateBucket(definition.id, definition.options)
    : await supabase.storage.createBucket(definition.id, definition.options);
  if (error) throw new Error(`Bucket ${definition.id} tidak dapat disiapkan: ${error.message}`);
  console.log(`Bucket privat siap: ${definition.id}`);
}
