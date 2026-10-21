"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  correctAttendanceAction,
  deleteManualAttendanceAction,
} from "@/app/actions/attendance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
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
import { Textarea } from "@/components/ui/textarea";
import { ATTENDANCE_SOURCE_LABEL, ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUSES } from "@/lib/attendance/constants";
import type { AttendanceCorrectionTarget } from "@/lib/attendance/types";

export function CorrectionAttendanceDialog({
  target,
  defaultCheckInTime,
  returnTo,
}: {
  target: AttendanceCorrectionTarget;
  defaultCheckInTime: string;
  returnTo: string;
}) {
  const [status, setStatus] = useState<(typeof ATTENDANCE_STATUSES)[number]>(target.status);
  const needsTime = status === "HADIR" || status === "TERLAMBAT";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="xs" />}>
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Koreksi
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Koreksi absensi</DialogTitle>
          <DialogDescription>
            {target.employeeName} · {target.dateLabel} · sumber {ATTENDANCE_SOURCE_LABEL[target.source]}
          </DialogDescription>
        </DialogHeader>

        <form action={correctAttendanceAction}>
          <input type="hidden" name="attendanceId" value={target.id} />
          <input type="hidden" name="updatedAt" value={target.updatedAt} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor={`correction-status-${target.id}`} required>Status</FieldLabel>
              <NativeSelect
                id={`correction-status-${target.id}`}
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

            {needsTime ? (
              <Field>
                <FieldLabel htmlFor={`correction-time-${target.id}`} required>Jam masuk (WIB)</FieldLabel>
                <Input
                  id={`correction-time-${target.id}`}
                  name="time"
                  type="time"
                  defaultValue={target.checkInTime ?? defaultCheckInTime}
                  required
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor={`correction-note-${target.id}`} required={status === "IZIN"}>
                Keterangan
              </FieldLabel>
              <Textarea
                id={`correction-note-${target.id}`}
                name="note"
                rows={3}
                maxLength={500}
                defaultValue={target.note ?? ""}
                required={status === "IZIN"}
                placeholder={
                  status === "IZIN"
                    ? "Wajib diisi, misalnya alasan izin."
                    : "Opsional, misalnya alasan terlambat."
                }
              />
              <FieldDescription>
                Koreksi tercatat di log aktivitas. Foto absensi mandiri tetap disimpan.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <SubmitButton pendingLabel="Menyimpan...">Simpan koreksi</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteManualAttendanceButton({
  attendanceId,
  updatedAt,
  returnTo,
}: {
  attendanceId: string;
  updatedAt: string;
  returnTo: string;
}) {
  return (
    <form action={deleteManualAttendanceAction} className="inline-flex">
      <input type="hidden" name="attendanceId" value={attendanceId} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <ConfirmSubmitButton
        variant="destructive"
        size="xs"
        confirmTitle="Hapus absensi manual?"
        confirmDescription="Record manual akan dihapus. Jika tanggal tersebut hari kerja yang sudah lewat, laporan akan menampilkan Alpha otomatis."
        confirmLabel="Ya, hapus"
        pendingLabel="Menghapus..."
      >
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        Hapus
      </ConfirmSubmitButton>
    </form>
  );
}
