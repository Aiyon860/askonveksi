import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "BOOTSTRAP_OWNER_NAME",
  "BOOTSTRAP_OWNER_EMAIL",
  "BOOTSTRAP_OWNER_PASSWORD",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Konfigurasi bootstrap belum lengkap: ${missing.join(", ")}`);
  process.exit(1);
}

const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
const strongPassword = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
if (!strongPassword) {
  console.error("BOOTSTRAP_OWNER_PASSWORD harus minimal 12 karakter dan memiliki huruf besar, kecil, angka, serta simbol.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let authUserId;

try {
  const existingUsers = await prisma.appUser.count();
  if (existingUsers > 0) {
    throw new Error("Bootstrap hanya dapat dijalankan saat tabel AppUser masih kosong.");
  }

  const email = process.env.BOOTSTRAP_OWNER_EMAIL.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Akun Auth Owner tidak dapat dibuat.");
  authUserId = data.user.id;

  await prisma.$transaction(
    async (tx) => {
      if (await tx.appUser.count()) throw new Error("Bootstrap hanya dapat dijalankan saat tabel AppUser masih kosong.");
      const owner = await tx.appUser.create({
        data: {
          authUserId,
          email,
          name: process.env.BOOTSTRAP_OWNER_NAME.trim(),
          role: "OWNER",
          isActive: true,
          mustChangePassword: true,
        },
        select: { id: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: owner.id,
          entityType: "AppUser",
          entityId: owner.id,
          action: "OWNER_BOOTSTRAPPED",
          changedFields: ["email", "name", "role", "isActive", "mustChangePassword"],
          metadata: { role: "OWNER" },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  console.log("Owner pertama berhasil dibuat. Hapus variabel BOOTSTRAP_OWNER_PASSWORD dari environment setelah login pertama.");
} catch (error) {
  if (authUserId) await supabase.auth.admin.deleteUser(authUserId);
  console.error(error instanceof Error ? error.message : "Bootstrap Owner gagal.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
