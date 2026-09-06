import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['query'] });

async function run() {
  const salesOrderId = "cm0q95w6d000108jz01abc123"; // Just a dummy ID, or find a real one
  const realOrder = await prisma.salesOrder.findFirst();
  if (!realOrder) return console.log("No order");
  
  console.log("---- Fetching Detail ----");
  const t0 = performance.now();
  await prisma.salesOrder.findUnique({
    where: { id: realOrder.id },
    select: {
      id: true,
      salesOrderNo: true,
      opportunity: { select: { id: true } },
      invoice: { select: { id: true } },
      purchaseOrder: { select: { id: true, sizes: { select: { size: true } } } },
      payment: { select: { kind: true, terms: { select: { position: true } } } },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: { select: { id: true } },
      productionWorkOrder: { select: { id: true } },
    }
  });
  const t1 = performance.now();
  console.log(`Time: ${t1 - t0}ms`);
}
run();
