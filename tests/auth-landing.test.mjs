import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { landingPathForRole } from "../lib/auth/landing-path.ts";
import { canAccessPath } from "../lib/auth/page-access.ts";
import { APP_ROLES } from "../lib/auth/permissions.ts";

// Regresi: login pernah mengirim semua role non-ADMIN_PO ke /dashboard, sehingga
// Desainer dan Admin Saga mendarat di halaman yang menolak mereka (403). Tujuan
// setelah login sekarang wajib lewat landingPathForRole dan tidak boleh menunjuk
// halaman yang tidak boleh dibuka role tersebut.

test("tujuan setelah login mengikuti role, bukan satu path untuk semua", () => {
  assert.equal(landingPathForRole("DESIGNER"), "/absensi");
  assert.equal(landingPathForRole("ADMIN_SAGA"), "/absensi");
  assert.equal(landingPathForRole("ADMIN_PO"), "/produksi");
  assert.equal(landingPathForRole("ADMIN_CUSTOMER"), "/dashboard");
  assert.equal(landingPathForRole("KEUANGAN"), "/dashboard");
  assert.equal(landingPathForRole("OWNER"), "/dashboard");
  assert.equal(landingPathForRole("DEVELOPER"), "/dashboard");
});

test("setiap role mendarat di halaman yang memang boleh dibukanya", () => {
  for (const role of APP_ROLES) {
    const landing = landingPathForRole(role);
    assert.equal(
      canAccessPath(role, landing),
      true,
      `${role} tidak boleh diarahkan ke ${landing} karena akan ditolak (403)`,
    );
  }
});

test("tujuan setelah login hanya ditentukan satu sumber", async () => {
  const files = ["../app/actions/auth.ts", "../app/login/page.tsx"];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /"\/(produksi|dashboard)"\s*:\s*"\/(produksi|dashboard)"/, `${file} masih memilih path tujuan sendiri`);
    assert.match(source, /landingPathForRole\(/, `${file} harus memakai landingPathForRole`);
  }
});

test("role khusus absen tidak pernah berhenti di halaman 403", async () => {
  const source = await readFile(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /isAttendanceOnly\(actor\.role\)/);
  assert.match(source, /redirect\(landingPathForRole\(actor\.role\)\)/);
});
