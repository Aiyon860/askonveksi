import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { assertBroadcastTestDatabase, broadcastTestRecipients } from "./broadcast-test-config.mjs";

assertBroadcastTestDatabase();
const authUserId = process.env.BROADCAST_TEST_AUTH_USER_ID || "";
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId)) throw new Error("BROADCAST_TEST_AUTH_USER_ID harus UUID login Supabase yang valid.");
const email = (process.env.BROADCAST_TEST_USER_EMAIL || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("BROADCAST_TEST_USER_EMAIL harus email login Supabase yang valid.");
const [customerNumber, prospectNumber] = broadcastTestRecipients();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  await prisma.$transaction(async (tx) => {
    const developer = await tx.appUser.upsert({
      where: { authUserId },
      update: { email, name: process.env.BROADCAST_TEST_USER_NAME?.trim() || "Broadcast Test Developer", role: "DEVELOPER", isActive: true },
      create: { id: "broadcast-test-developer", authUserId, email, name: process.env.BROADCAST_TEST_USER_NAME?.trim() || "Broadcast Test Developer", role: "DEVELOPER", isActive: true },
    });
    const customerType = await tx.customerType.upsert({
      where: { name: "Broadcast Test" },
      update: { isActive: true },
      create: { id: "broadcast-test-customer-type", name: "Broadcast Test", description: "Data lokal untuk broadcast test.", position: 0, isActive: true },
    });
    await tx.businessProfile.upsert({
      where: { id: "default" },
      update: { name: "AS Konveksi Broadcast Test" },
      create: { id: "default", name: "AS Konveksi Broadcast Test" },
    });
    const optedIn = { customerTypeId: customerType.id, salesPicId: developer.id, whatsappConsentStatus: "OPTED_IN", whatsappOptedInAt: new Date(), whatsappOptInSource: "broadcast-test" };
    await tx.customer.upsert({
      where: { id: "broadcast-test-customer" },
      update: { ...optedIn, whatsapp: customerNumber, lifecycle: "CUSTOMER", archivedAt: null },
      create: { id: "broadcast-test-customer", customerNo: "BROADCAST-TEST-CUSTOMER", name: "Customer Broadcast Test", whatsapp: customerNumber, lifecycle: "CUSTOMER", ...optedIn },
    });
    await tx.customer.upsert({
      where: { id: "broadcast-test-prospect" },
      update: { ...optedIn, whatsapp: prospectNumber, lifecycle: "PROSPEK", archivedAt: null },
      create: { id: "broadcast-test-prospect", customerNo: "BROADCAST-TEST-PROSPECT", name: "Prospek Broadcast Test", whatsapp: prospectNumber, lifecycle: "PROSPEK", ...optedIn },
    });
    await tx.opportunity.upsert({
      where: { id: "broadcast-test-opportunity" },
      update: { customerId: "broadcast-test-prospect", title: "Prospek Broadcast Test", stage: "LEAD_BARU", isRepeatOrder: false, salesPicId: developer.id },
      create: { id: "broadcast-test-opportunity", opportunityNo: "BROADCAST-TEST-OPP", customerId: "broadcast-test-prospect", title: "Prospek Broadcast Test", stage: "LEAD_BARU", salesPicId: developer.id },
    });
  });
  console.log("Seed broadcast test selesai: satu customer dan satu prospek.");
} finally {
  await prisma.$disconnect();
}
