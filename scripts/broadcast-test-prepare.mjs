import { Client } from "pg";

import { assertBroadcastTestDatabase } from "./broadcast-test-config.mjs";

assertBroadcastTestDatabase();
const client = new Client({ connectionString: process.env.DIRECT_URL });

try {
  await client.connect();
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      public BOOLEAN NOT NULL DEFAULT false,
      avif_autodetection BOOLEAN NOT NULL DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );
  `);
  console.log("Database broadcast test siap untuk migration.");
} finally {
  await client.end();
}
