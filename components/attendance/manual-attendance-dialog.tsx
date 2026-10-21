"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { createManualAttendanceAction } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUSES } from "@/lib/attendance/constants";
import type { AttendanceEmployeeOption } from "@/lib/attendance/types";
import { ROLE_LABEL } from "@/lib/crm/constants";

type TriggerSize = React.ComponentProps<typeof Button>["size"];
type TriggerVariant = React.ComponentProps<typeof Button>["variant"];

export function ManualAttendanceDialog({
  employees,
  defaultCheckInTime,
  today,
  returnTo,
  initialUserId,
  initialDate,
  triggerLabel = "Catat manual",
  triggerSize = "default",
  triggerVariant = "outline",
}: {
  employees: AttendanceEmployeeOption[];
  defaultCheckInTime: string;
  today: string;
  returnTo: string;
  initialUserId?: string;
  initialDate?: string;
  triggerLabel?: string;
  triggerSize?: TriggerSize;
  triggerVariant?: TriggerVariant;
}) {
  const [status, setStatus] = useState<(typeof ATTENDANCE_STATUSES)[number]>("HADIR");
  const needsTime = status === "HADIR" || status === "TERLAMBAT";

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} disabled={employees.length === 0} />}
      >
        <CalendarPlus data-icon="inline-start" aria-hidden="true" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat absensi manual</DialogTitle>
          <DialogDescription>
            Gunakan untuk pegawai yang lupa absen atau izin yang disetujui Owner.
          </DialogDescription>
        </DialogHeader>

        <form action={createManualAttendanceAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="manual-attendance-user" required>Pegawai</FieldLabel>
              <NativeSelect id="manual-attendance-user" name="userId" className="w-full" defaultValue={initialUserId ?? ""} required>
                <option value="" disabled>Pilih pegawai</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {ROLE_LABEL[employee.role]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="manual-attendance-date" required>Tanggal</FieldLabel>
                <Input
                  id="manual-attendance-date"
                  name="date"
                  type="date"
                  max={today}
                  defaultValue={initialDate ?? today}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-attendance-status" required>Status</FieldLabel>
                <NativeSelect
                  id="manual-attendance-status"
                  name="status"
                  className="w-full"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as (typeof ATTENDANCE_STATUSES)[number])}
                  required
                >
                  {ATTENDANCE_STATUSES.map((value) => (
                    <option key={value} value={value}>{ATTENDANCE_STATUS_LABEL[value]}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            {needsTime ? (
              <Field>
                <FieldLabel htmlFor="manual-attendance-time" required>Jam masuk (WIB)</FieldLabel>
                <Input
                  id="manual-attendance-time"
                  name="time"
                  type="time"
                  defaultValue={defaultCheckInTime}
                  required
                />
                <FieldDescription>
                  Status {ATTENDANCE_STATUS_LABEL[status]} memakai jam ini sebagai waktu absen.
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="manual-attendance-note" required={status === "IZIN"}>
                Keterangan
              </FieldLabel>
              <Textarea
                id="manual-attendance-note"
                name="note"
                rows={3}
                maxLength={500}
                required={status === "IZIN"}
                placeholder={
                  status === "IZIN"
                    ? "Contoh: izin sakit, surat dokter terlampir."
                    : "Opsional. Contoh: terlambat karena ban bocor."
                }
              />
              <FieldDescription>
                {status === "IZIN"
                  ? "Wajib diisi untuk status Izin."
                  : "Bisa diisi sekarang atau dilengkapi Owner nanti."}
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <SubmitButton pendingLabel="Menyimpan...">Simpan absensi</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
