import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Runtime uses DATABASE_URL. Prisma CLI prefers a direct or Supavisor
    // session-mode connection because transaction pooling cannot run migrations.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
