import { createHmac } from "node:crypto";

import { Prisma } from "@prisma/client";

import { nextCustomerNo, nextOpportunityNo } from "@/lib/crm/numbers";
import { publicLeadSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 5;

function json(message: string, status = 200) {
  return Response.json({ message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function fingerprint(request: Request) {
  const secret = process.env.PUBLIC_LEAD_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(requestAddress(request)).digest("hex");
}

async function consumeRateLimit(key: string) {
  const prisma = getPrismaClient();
  await prisma.publicRateLimitBucket.deleteMany({
    where: { updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket" ("key", "windowStart", "count", "updatedAt")
    VALUES (${key}, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "PublicRateLimitBucket"."windowStart" <= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 1
        ELSE "PublicRateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "PublicRateLimitBucket"."windowStart" <= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP
        ELSE "PublicRateLimitBucket"."windowStart"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count"
  `);
  return (rows[0]?.count ?? RATE_LIMIT_MAX + 1) <= RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") return json("Format permintaan tidak didukung.", 415);

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json("Permintaan tidak dapat diproses.", 403);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json("Data yang dikirim terlalu besar.", 413);

  const rateKey = fingerprint(request);
  if (!rateKey) return json("Formulir belum dapat digunakan. Hubungi tim Askonveksi melalui WhatsApp.", 503);
  if (!(await consumeRateLimit(rateKey))) return json("Terlalu banyak permintaan. Coba lagi dalam 15 menit.", 429);

  let raw: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return json("Data yang dikirim terlalu besar.", 413);
    raw = JSON.parse(body);
  } catch {
    return json("Data formulir tidak valid.", 400);
  }

  const parsed = publicLeadSchema.safeParse(raw);
  if (!parsed.success) return json("Periksa kembali data formulir.", 422);
  if (parsed.data.website) return json("Terima kasih. Tim Askonveksi akan menghubungi Anda.");

  const prisma = getPrismaClient();
  const existing = await prisma.opportunity.findUnique({
    where: { publicSubmissionKey: parsed.data.submissionKey },
    select: { id: true },
  });
  if (existing) return json("Terima kasih. Tim Askonveksi akan menghubungi Anda.");

  try {
    await prisma.$transaction(async (tx) => {
      const [customerType, leadSource] = await Promise.all([
        tx.customerType.findUnique({ where: { id: "master-ct-unclassified" }, select: { id: true } }),
        tx.leadSource.findUnique({ where: { name: "Landing Page" }, select: { id: true } }),
      ]);
      if (!customerType || !leadSource) throw new Error("Public lead master data is not configured");

      const customer = await tx.customer.create({
        data: {
          customerNo: await nextCustomerNo(tx),
          name: parsed.data.name,
          whatsapp: parsed.data.whatsapp,
          city: parsed.data.city,
          customerTypeId: customerType.id,
          leadSourceId: leadSource.id,
        },
        select: { id: true },
      });
      await tx.opportunity.create({
        data: {
          opportunityNo: await nextOpportunityNo(tx),
          customerId: customer.id,
          leadSourceId: leadSource.id,
          publicSubmissionKey: parsed.data.submissionKey,
          title: parsed.data.productName,
          productName: parsed.data.productName,
          estimatedQuantity: parsed.data.estimatedQuantity,
          deadline: parsed.data.deadline ? new Date(`${parsed.data.deadline}T00:00:00.000Z`) : null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      return json("Lead belum dapat disimpan. Silakan coba lagi atau hubungi kami melalui WhatsApp.", 500);
    }
  }

  return json("Terima kasih. Tim Askonveksi akan menghubungi Anda.", 201);
}
