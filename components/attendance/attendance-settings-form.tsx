import { updateAttendanceSettingsAction } from "@/app/actions/attendance";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_WORK_DAY_OPTIONS } from "@/lib/attendance/constants";
import type { AttendanceSettings } from "@/lib/attendance/types";

export function AttendanceSettingsForm({
  settings,
  today,
}: {
  settings: AttendanceSettings;
  today: string;
}) {
  return (
    <form action={updateAttendanceSettingsAction}>
      <input type="hidden" name="version" value={settings.version} />
      <FieldGroup className="gap-5">
        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor="attendance-start-date" required>Mulai berlaku absensi</FieldLabel>
          <Input
            id="attendance-start-date"
            name="startDate"
            type="date"
            defaultValue={settings.startDate}
            max={today}
            required
          />
          <FieldDescription>
            Hari kerja sebelum tanggal ini tidak dihitung Alpha. Record yang sudah ada tetap ditampilkan.
          </FieldDescription>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="attendance-check-in-time" required>Jam masuk</FieldLabel>
            <Input
              id="attendance-check-in-time"
              name="checkInTime"
              type="time"
              defaultValue={settings.checkInTime}
              required
            />
            <FieldDescription>Waktu WIB. Dipakai untuk menentukan Hadir atau Terlambat.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="attendance-tolerance" required>Toleransi keterlambatan</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="attendance-tolerance"
                name="lateToleranceMinutes"
                type="number"
                min={0}
                max={180}
                step={1}
                defaultValue={settings.lateToleranceMinutes}
                className="w-28"
                required
              />
              <span className="text-sm text-muted-foreground">menit</span>
            </div>
            <FieldDescription>
              Contoh: jam masuk 08:00 + toleransi 15 menit → 08:15 masih Hadir.
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel required>Hari kerja</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ATTENDANCE_WORK_DAY_OPTIONS.map((day) => (
              <Field key={day.value} orientation="horizontal" className="gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id={`attendance-work-day-${day.value}`}
                  name="workDays"
                  value={String(day.value)}
                  defaultChecked={settings.workDays.includes(day.value)}
                />
                <FieldLabel htmlFor={`attendance-work-day-${day.value}`} className="font-normal">
                  {day.label}
                </FieldLabel>
              </Field>
            ))}
          </div>
          <FieldDescription>
            Alpha otomatis hanya dihitung sejak tanggal mulai, pada hari kerja yang dipilih, bukan hari libur, dan bukan hari ini.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="mt-5 flex justify-end">
        <SubmitButton pendingLabel="Menyimpan...">Simpan pengaturan absensi</SubmitButton>
      </div>
    </form>
  );
}
