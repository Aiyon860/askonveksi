import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Generation does not need a database connection. Commands such as
    // `prisma db pull` will require DATABASE_URL to be set in .env.
    url: process.env.DATABASE_URL,
  },
});
