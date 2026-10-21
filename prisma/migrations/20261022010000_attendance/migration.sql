-- Modul absensi: pengaturan Owner, record harian pegawai, koreksi manual,
-- dan kalender hari libur. Foto disimpan di filesystem VPS; kolom photoPath
-- hanya menyimpan path relatif terhadap ATTENDANCE_UPLOAD_DIR.
BEGIN;

CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TERLAMBAT', 'IZIN', 'ALPHA');
CREATE TYPE "AttendanceSource" AS ENUM ('SELF', 'OWNER');

ALTER TABLE "BusinessProfile"
  ADD COLUMN "attendanceCheckInTime" VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN "attendanceLateToleranceMin" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "attendanceWorkDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6];

ALTER TABLE "BusinessProfile"
  ADD CONSTRAINT "BusinessProfile_attendance_check_in_time_check"
    CHECK ("attendanceCheckInTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "BusinessProfile_attendance_late_tolerance_check"
    CHECK ("attendanceLateToleranceMin" BETWEEN 0 AND 180),
  ADD CONSTRAINT "BusinessProfile_attendance_work_days_check"
    CHECK (
      CARDINALITY("attendanceWorkDays") BETWEEN 1 AND 7
      AND "attendanceWorkDays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[]
    );

CREATE TABLE "Attendance" (
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

CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");
CREATE INDEX "Attendance_date_status_idx" ON "Attendance"("date", "status");
CREATE INDEX "Attendance_recordedById_idx" ON "Attendance"("recordedById");
CREATE INDEX "Attendance_correctedById_idx" ON "Attendance"("correctedById");

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Attendance_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Attendance_correctedById_fkey"
    FOREIGN KEY ("correctedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AttendanceHoliday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AttendanceHoliday_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceHoliday_name_not_blank" CHECK (NULLIF(BTRIM("name"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "AttendanceHoliday_date_key" ON "AttendanceHoliday"("date");

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Attendance" FROM anon, authenticated;

ALTER TABLE "AttendanceHoliday" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AttendanceHoliday" FROM anon, authenticated;

COMMIT;
