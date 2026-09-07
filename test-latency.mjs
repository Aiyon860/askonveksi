import "dotenv/config";
import { getPrismaClient } from "./lib/prisma.ts";
import { performance } from "perf_hooks";

async function run() {
  const t0 = performance.now();
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  const t1 = performance.now();
  console.log(`Prisma connect + query: ${t1 - t0}ms`);
  
  const t2 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const t3 = performance.now();
  console.log(`Prisma second query: ${t3 - t2}ms`);
}
run();
