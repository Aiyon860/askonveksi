import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { performance } from "perf_hooks";

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const t0 = performance.now();
  await supabase.auth.getClaims();
  const t1 = performance.now();
  console.log(`getClaims: ${t1 - t0}ms`);
}
run();
