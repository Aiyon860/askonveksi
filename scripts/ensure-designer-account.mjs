import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const email = "desainer@example.com";
const password = process.env.DESIGNER_PASSWORD;
const required = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length || !password) {
  console.error(`Konfigurasi belum lengkap: ${[...missing, !password ? "DESIGNER_PASSWORD" : null].filter(Boolean).join(", ")}`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

try {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error("Akun Auth tidak dapat diperiksa.");
  let user = listed.users.find((item) => item.email?.toLowerCase() === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Akun desainer tidak dapat dibuat.");
    user = data.user;
  }

  await prisma.appUser.upsert({
    where: { authUserId: user.id },
    create: { authUserId: user.id, email, name: "Desainer", role: "DESIGNER", isActive: true },
    update: { email, name: "Desainer", role: "DESIGNER", isActive: true },
  });
  console.log("Akun desainer siap digunakan.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Akun desainer gagal disiapkan.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
