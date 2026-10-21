import { CalendarDays, Trash2 } from "lucide-react";

import {
  createAttendanceHolidayAction,
  deleteAttendanceHolidayAction,
} from "@/app/actions/attendance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAttendanceDate, utcDateToDateKey } from "@/lib/attendance/time";

type Holiday = {
  id: string;
  date: Date;
  name: string;
};

export function AttendanceHolidayManager({ holidays }: { holidays: Holiday[] }) {
  return (
    <div className="flex flex-col gap-5">
      <form action={createAttendanceHolidayAction}>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor="holiday-date" required>Tanggal</FieldLabel>
              <Input id="holiday-date" name="date" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="holiday-name" required>Nama hari libur</FieldLabel>
              <Input
                id="holiday-name"
                name="name"
                maxLength={120}
                placeholder="Contoh: Idul Fitri, cuti bersama"
                required
              />
            </Field>
            <SubmitButton pendingLabel="Menambah...">Tambah</SubmitButton>
          </div>
        </FieldGroup>
      </form>

      {holidays.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada hari libur. Alpha otomatis akan dihitung pada hari kerja biasa.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                    {formatAttendanceDate(utcDateToDateKey(holiday.date))}
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">{holiday.name}</TableCell>
                <TableCell className="text-right">
                  <form action={deleteAttendanceHolidayAction} className="inline-flex">
                    <input type="hidden" name="holidayId" value={holiday.id} />
                    <ConfirmSubmitButton
                      variant="destructive"
                      size="xs"
                      confirmTitle="Hapus hari libur?"
                      confirmDescription={`${holiday.name} akan dihapus. Tanggal ini kembali dihitung sebagai hari kerja bila termasuk hari kerja.`}
                      confirmLabel="Ya, hapus"
                      pendingLabel="Menghapus..."
                    >
                      <Trash2 data-icon="inline-start" aria-hidden="true" />
                      Hapus
                    </ConfirmSubmitButton>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
