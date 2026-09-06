import "dotenv/config";
import pg from "pg";
import { performance } from "perf_hooks";

const directUrl = process.env.DATABASE_URL.replace("aws-0-ap-southeast-2.pooler.supabase.com:6543", "db.jiefrvsgusenjnfzuzfc.supabase.co:5432");

async function run() {
  const pool = new pg.Pool({ connectionString: directUrl });
  
  const t0 = performance.now();
  await pool.query("SELECT 1");
  const t1 = performance.now();
  console.log(`pg pool connect + query: ${t1 - t0}ms`);
  
  const t2 = performance.now();
  await pool.query("SELECT 1");
  const t3 = performance.now();
  console.log(`pg pool second query: ${t3 - t2}ms`);
  
  await pool.end();
}
run();
