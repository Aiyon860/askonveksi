import { updateFollowUpSettingsAction } from "@/app/actions/follow-up-settings";
import { AttendanceHolidayManager } from "@/components/attendance/attendance-holiday-manager";
import { AttendanceSettingsForm } from "@/components/attendance/attendance-settings-form";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { RepeatOrderPatternForm } from "@/components/settings/repeat-order-pattern-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_ADMIN_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireOwnerAreaPage } from "@/lib/auth/owner-area";
import { getAttendanceHolidays, getAttendanceSettings } from "@/lib/attendance/data";
import { jakartaDateKey } from "@/lib/attendance/time";
import { getFollowUpSettings } from "@/lib/crm/follow-up-settings";

export default async function SettingsPage() {
  const actor = await requireOwnerAreaPage();
  const settings = await getFollowUpSettings();
  const canManageAttendance = hasRole(actor.role, ATTENDANCE_ADMIN_ROLES);
  const [attendanceSettings, holidays] = canManageAttendance
    ? await Promise.all([getAttendanceSettings(), getAttendanceHolidays()])
    : [null, null];

  return (
    <main className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Pengaturan" description="Atur pengingat otomatis dan preferensi operasional." />
      <PageMessage />

      {/* Isi pengaturan sedikit; dua kolom supaya tidak menyisakan ruang kosong. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {canManageAttendance && attendanceSettings ? (
        <>
          <Card id="absensi" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Pengaturan absensi</CardTitle>
              <CardDescription>
                Tanggal mulai, jam masuk, toleransi keterlambatan, dan hari kerja untuk absensi pegawai.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceSettingsForm settings={attendanceSettings} today={jakartaDateKey(new Date())} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hari libur absensi</CardTitle>
              <CardDescription>
                Tanggal libur tidak dihitung Alpha. Record absensi yang sudah ada tetap ditampilkan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceHolidayManager holidays={holidays ?? []} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Reminder repeat order</CardTitle>
          <CardDescription>
            Jeda bulan diulang dari awal setelah jeda terakhir. Pola 6, 5 berarti bulan ke-6, 11, 17, 22,
            dan seterusnya dari order terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepeatOrderPatternForm intervals={settings.repeatOrderIntervals} version={settings.version} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengingat pembayaran</CardTitle>
          <CardDescription>
            Nilai negatif berarti sebelum deadline, 0 tepat pada deadline, dan nilai positif setelah deadline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateFollowUpSettingsAction}>
            <input type="hidden" name="version" value={settings.version} />
            <FieldGroup>
              {settings.invoiceReminderOffsets.map((offset, index) => (
                <Field key={`${index}-${offset}`}>
                  <FieldLabel htmlFor={`offset-${index}`}>Pengingat {index + 1}</FieldLabel>
                  <Input
                    id={`offset-${index}`}
                    name="offset"
                    type="number"
                    required
                    min={-365}
                    max={365}
                    step={1}
                    defaultValue={offset}
                  />
                  <FieldDescription>Satuan hari dari deadline pembayaran.</FieldDescription>
                </Field>
              ))}
              <SubmitButton className="self-end">Simpan pengingat</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
