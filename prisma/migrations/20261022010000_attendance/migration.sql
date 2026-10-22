-- Modul absensi: pengaturan Owner, record harian pegawai, koreksi manual,
-- dan kalender hari libur. Foto disimpan di filesystem VPS; kolom photoPath
-- hanya menyimpan path relatif terhadap ATTENDANCE_UPLOAD_DIR.
--
-- Migrasi ini sengaja TANPA BEGIN/COMMIT (Prisma sudah membungkus tiap
-- migrasi dalam satu transaksi) dan idempotent: aman dijalankan ulang kalau
-- sebagian object sudah terlanjur ada, mis. saat schema pernah di-push manual.
-- Tanpa BEGIN/COMMIT, kegagalan di tengah file ikut me-rollback seluruh DDL
-- sehingga retry tidak pernah menyisakan state setengah jadi.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AttendanceStatus' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TERLAMBAT', 'IZIN', 'ALPHA');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AttendanceSource' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "AttendanceSource" AS ENUM ('SELF', 'OWNER');
  END IF;
END
$$;

ALTER TABLE "BusinessProfile"
  ADD COLUMN IF NOT EXISTS "attendanceCheckInTime" VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "attendanceLateToleranceMin" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "attendanceWorkDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BusinessProfile_attendance_check_in_time_check'
      AND conrelid = '"BusinessProfile"'::regclass
  ) THEN
    ALTER TABLE "BusinessProfile"
      ADD CONSTRAINT "BusinessProfile_attendance_check_in_time_check"
        CHECK ("attendanceCheckInTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BusinessProfile_attendance_late_tolerance_check'
      AND conrelid = '"BusinessProfile"'::regclass
  ) THEN
    ALTER TABLE "BusinessProfile"
      ADD CONSTRAINT "BusinessProfile_attendance_late_tolerance_check"
        CHECK ("attendanceLateToleranceMin" BETWEEN 0 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BusinessProfile_attendance_work_days_check'
      AND conrelid = '"BusinessProfile"'::regclass
  ) THEN
    ALTER TABLE "BusinessProfile"
      ADD CONSTRAINT "BusinessProfile_attendance_work_days_check"
        CHECK (
          CARDINALITY("attendanceWorkDays") BETWEEN 1 AND 7
          AND "attendanceWorkDays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[]
        );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "checkInAt" TIMESTAMPTZ(3),
  "note" VARCHAR(500),
  "photoPath" VARCHAR(500),
  "photoMimeType" VARCHAR(100),
  "photoSize" INTEGER,
  "latitude" DECIMAL(9, 6),
  "longitude" DECIMAL(9, 6),
  "accuracyMeters" INTEGER,
  "locationAt" TIMESTAMPTZ(3),
  "source" "AttendanceSource" NOT NULL,
  "recordedById" TEXT,
  "correctedById" TEXT,
  "correctedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attendance_check_in_status_check" CHECK (
    ("status" IN ('HADIR', 'TERLAMBAT') AND "checkInAt" IS NOT NULL)
    OR ("status" IN ('IZIN', 'ALPHA') AND "checkInAt" IS NULL)
  ),
  CONSTRAINT "Attendance_self_photo_check" CHECK (
    "source" <> 'SELF' OR "photoPath" IS NOT NULL
  ),
  CONSTRAINT "Attendance_owner_recorder_check" CHECK (
    "source" <> 'OWNER' OR "recordedById" IS NOT NULL
  ),
  CONSTRAINT "Attendance_location_pair_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR (
      "latitude" IS NOT NULL AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90
      AND "longitude" BETWEEN -180 AND 180
    )
  ),
  CONSTRAINT "Attendance_accuracy_check" CHECK (
    "accuracyMeters" IS NULL OR "accuracyMeters" >= 0
  )
);

-- Kalau tabel sudah dibuat sebelumnya tanpa beberapa kolom, lengkapi dulu
-- sebelum constraint/index dipasang.
ALTER TABLE "Attendance"
  ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS "date" DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS "status" "AttendanceStatus" NOT NULL,
  ADD COLUMN IF NOT EXISTS "checkInAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "note" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "photoPath" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "photoMimeType" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "photoSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "accuracyMeters" INTEGER,
  ADD COLUMN IF NOT EXISTS "locationAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "source" "AttendanceSource" NOT NULL,
  ADD COLUMN IF NOT EXISTS "recordedById" TEXT,
  ADD COLUMN IF NOT EXISTS "correctedById" TEXT,
  ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_userId_date_key" ON "Attendance"("userId", "date");
CREATE INDEX IF NOT EXISTS "Attendance_date_status_idx" ON "Attendance"("date", "status");
CREATE INDEX IF NOT EXISTS "Attendance_recordedById_idx" ON "Attendance"("recordedById");
CREATE INDEX IF NOT EXISTS "Attendance_correctedById_idx" ON "Attendance"("correctedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attendance_userId_fkey' AND conrelid = '"Attendance"'::regclass
  ) THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attendance_recordedById_fkey' AND conrelid = '"Attendance"'::regclass
  ) THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attendance_correctedById_fkey' AND conrelid = '"Attendance"'::regclass
  ) THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_correctedById_fkey"
      FOREIGN KEY ("correctedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AttendanceHoliday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AttendanceHoliday_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceHoliday_name_not_blank" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL)
);

ALTER TABLE "AttendanceHoliday"
  ADD COLUMN IF NOT EXISTS "date" DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceHoliday_date_key" ON "AttendanceHoliday"("date");

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceHoliday" ENABLE ROW LEVEL SECURITY;

-- Role anon/authenticated hanya ada di Supabase; di Postgres biasa REVOKE ke
-- role yang tidak ada akan menggagalkan migrasi, jadi dicek dulu.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "Attendance" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE "AttendanceHoliday" FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "Attendance" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE "AttendanceHoliday" FROM authenticated';
  END IF;
END
$$;
