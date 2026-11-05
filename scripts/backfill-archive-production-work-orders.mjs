#!/usr/bin/env node
/**
 * Pulihkan Work Order arsip: SO berbayar tanpa WO karena PO kehilangan item/ukuran.
 *
 *   node scripts/backfill-archive-production-work-orders.mjs           dry-run
 *   node scripts/backfill-archive-production-work-orders.mjs --apply
 */

import "dotenv/config";

import { randomBytes } from "node:crypto";

import pg from "pg";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL belum dikonfigurasi.");
  process.exit(1);
}

const STAGES = {
  JERSEY: ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"],
  NON_JERSEY: ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"],
  AKSESORI: ["JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"],
};

function brandCode(brand) {
  return brand === "SAGA" ? "SG" : "AS";
}

function cuid() {
  return `cm${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 30_000 });
await client.connect();

try {
  const { rows: candidates } = await client.query(`
    select
      so.id as so_id,
      so.brand,
      so."salesOrderNo",
      so."acceptedAt",
      so."createdById",
      po.id as po_id,
      po."productName",
      po."garmentType",
      po."productCategoryId",
      po.deadline,
      coalesce((select sum(i.quantity)::int from "SalesOrderItem" i where i."salesOrderId" = so.id), 0) as qty,
      coalesce((select i.size from "SalesOrderItem" i where i."salesOrderId" = so.id order by i.position asc limit 1), 'All Size') as size_label,
      (select pt."createdById" from "DealPayment" d
         join "PaymentTransaction" pt on pt."paymentId" = d.id
        where d."salesOrderId" = so.id and pt.status = 'ACTIVE' and pt.amount > 0
        order by pt."paidAt" asc limit 1) as payer_id,
      (select i.id from "PurchaseOrderItem" i where i."purchaseOrderId" = po.id order by i.position asc limit 1) as existing_item_id,
      exists(select 1 from "PurchaseOrderSize" s where s."purchaseOrderId" = po.id) as has_size
    from "SalesOrder" so
    join "PurchaseOrder" po on po.id = so."purchaseOrderId"
    where so.status = 'ACTIVE'
      and po.status = 'AGREED'
      and po."garmentType" is not null
      and po.deadline is not null
      and not exists (select 1 from "ProductionWorkOrder" wo where wo."salesOrderId" = so.id)
      and exists (select 1 from "DealPayment" d where d."salesOrderId" = so.id)
    order by so."acceptedAt" asc nulls last
  `);

  const ready = candidates.filter((row) => row.qty > 0);
  console.log(`Kandidat: ${candidates.length}; siap: ${ready.length}`);

  if (!APPLY) {
    for (const row of ready.slice(0, 15)) {
      console.log(`dry-run ${row.salesOrderNo} · ${row.productName} · ${row.qty} pcs · ${row.garmentType}`);
    }
    if (ready.length > 15) console.log(`… +${ready.length - 15} lagi`);
    console.log(`Dry-run. Jalankan ulang dengan --apply.`);
    process.exit(0);
  }

  const counters = new Map();
  async function nextWoNo(brand, date) {
    const year = date.getUTCFullYear();
    const key = `work-order:${brand}:${year}`;
    if (!counters.has(key)) {
      const existing = await client.query(`select value from "SequenceCounter" where key = $1`, [key]);
      counters.set(key, existing.rows[0]?.value ?? 0);
    }
    const value = counters.get(key) + 1;
    counters.set(key, value);
    return { key, value, no: `WO-${brandCode(brand)}-${year}-${String(value).padStart(5, "0")}` };
  }

  let created = 0;
  for (const row of ready) {
    const at = row.acceptedAt ? new Date(row.acceptedAt) : new Date();
    const endAt = new Date(at.getTime() + 11 * 86_400_000);
    const span = Math.max(endAt.getTime() - at.getTime(), 1);
    const garment = row.garmentType;
    const stages = garment === "AKSESORI" ? STAGES.AKSESORI : garment === "JERSEY" ? STAGES.JERSEY : STAGES.NON_JERSEY;
    const route = garment === "JERSEY" ? "JERSEY" : "NON_JERSEY";
    const actorId = row.payer_id || row.createdById;
    const { key, value, no: workOrderNo } = await nextWoNo(row.brand, at);
    const woId = cuid();

    await client.query("begin");
    try {
      let itemId = row.existing_item_id;
      if (!itemId) {
        itemId = cuid();
        await client.query(
          `insert into "PurchaseOrderItem"
            (id, "purchaseOrderId", position, name, "productCategoryId", "garmentType", "createdAt")
           values ($1,$2,0,$3,$4,$5::"GarmentType",$6)`,
          [itemId, row.po_id, row.productName, row.productCategoryId, garment, at],
        );
      }

      if (!row.has_size) {
        await client.query(
          `insert into "PurchaseOrderSize"
            (id, "purchaseOrderId", position, "itemId", size, "sleeveLength", quantity)
           values ($1,$2,0,$3,$4,'PANJANG'::"SleeveLength",$5)`,
          [cuid(), row.po_id, itemId, String(row.size_label).slice(0, 40), row.qty],
        );
      }

      await client.query(
        `insert into "ProductionWorkOrder" (
          id, brand, "workOrderNo", "salesOrderId", "purchaseOrderItemId", "itemName",
          route, "productName", quantity, deadline, "stageSequence", "currentStage",
          status, "completedAt", "stageEnteredAt", "designCompletedAt", version, "createdAt", "updatedAt"
        ) values (
          $1, $2::"Brand", $3, $4, $5, $6,
          $7::"ProductionRoute", $8, $9, $10, $11::"ProductionStage"[], 'SELESAI'::"ProductionStage",
          'COMPLETED'::"ProductionWorkOrderStatus", $12, $12, $13, 1, $13, now()
        )`,
        [woId, row.brand, workOrderNo, row.so_id, itemId, row.productName, route, row.productName, row.qty, row.deadline, stages, endAt, at],
      );

      const stepValues = [];
      const stepParams = [];
      let p = 1;
      for (let position = 0; position < stages.length; position += 1) {
        const startedAt = new Date(at.getTime() + (span * position) / stages.length);
        const completedAt = new Date(at.getTime() + (span * (position + 1)) / stages.length);
        stepValues.push(`($${p++},$${p++},$${p++}::"ProductionStage",$${p++},'COMPLETED'::"ProductionStepStatus",1,$${p++},$${p++},$${p++})`);
        stepParams.push(cuid(), woId, stages[position], position, startedAt, completedAt, completedAt);
      }
      await client.query(
        `insert into "ProductionStep"
          (id, "workOrderId", stage, position, status, "attemptCount", "startedAt", "completedAt", "updatedAt")
         values ${stepValues.join(",")}`,
        stepParams,
      );

      await client.query(
        `insert into "ProductionActivity"
          (id, "workOrderId", "actorId", type, "toStage", note, "createdAt")
         values ($1,$2,$3,'CREATED'::"ProductionActivityType",$4::"ProductionStage",$5,$6)`,
        [cuid(), woId, actorId, stages[0], "Backfill dari arsip keuangan (PO tanpa item/ukuran).", at],
      );

      await client.query(
        `insert into "AuditEvent"
          (id, brand, "actorId", "entityType", "entityId", action, "changedFields", metadata, "createdAt")
         values ($1,$2::"Brand",$3,'ProductionWorkOrder',$4,'PRODUCTION_WORK_ORDER_CREATED',$5,$6::jsonb,$7)`,
        [
          cuid(),
          row.brand,
          actorId,
          woId,
          ["route", "productName", "quantity", "deadline", "designCompletedAt", "stageSequence", "currentStage"],
          JSON.stringify({ backfill: "archive-keuangan", salesOrderId: row.so_id, workOrderNo }),
          at,
        ],
      );

      await client.query(
        `insert into "SequenceCounter" (key, value, "updatedAt")
         values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, "updatedAt" = now()`,
        [key, value],
      );

      await client.query("commit");
      created += 1;
      if (created % 25 === 0 || created === ready.length) console.log(`… ${created}/${ready.length}`);
    } catch (error) {
      await client.query("rollback");
      console.error(`Gagal ${row.salesOrderNo}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  console.log(`Selesai. Dibuat: ${created}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
