"use client";

import type { AppRole } from "@prisma/client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { toggleUserActiveAction, updateUserAction } from "@/app/actions/users";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ROLE_LABEL } from "@/lib/crm/constants";

const USER_ROLES = ["OWNER", "ADMIN", "SALES", "PRODUCTION", "QC"] as const satisfies readonly AppRole[];

export type EditableUserRow = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
  updatedAt: string;
};

function UserEditActions({ name, onCancel }: { name: string; onCancel: () => void }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
        Batal
      </Button>
      <Button type="submit" size="sm" disabled={pending} aria-label={`Simpan perubahan ${name}`}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}

export function UsersTableBody({
  users,
  actorId,
  numberOffset,
  returnTo,
}: {
  users: EditableUserRow[];
  actorId?: string;
  numberOffset: number;
  returnTo: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <TableBody>
      {users.map((user, index) => {
        const isEditing = editingId === user.id;
        const isSelf = actorId === user.id;
        const editFormId = `edit-user-${user.id}`;

        return (
          <TableRow key={user.id} data-state={isEditing ? "selected" : undefined}>
            <TableCell className="text-center font-mono text-muted-foreground tabular-nums">
              {numberOffset + index + 1}
            </TableCell>
            <TableCell className="font-medium">
              {isEditing ? (
                <Field>
                  <FieldLabel htmlFor={`${editFormId}-name`} className="sr-only">Nama pengguna</FieldLabel>
                  <Input
                    id={`${editFormId}-name`}
                    form={editFormId}
                    name="name"
                    defaultValue={user.name}
                    required
                    minLength={2}
                    maxLength={120}
                    pattern="(?=(?:.*\S){2,}).*"
                    title="Nama minimal 2 karakter selain spasi."
                    autoFocus
                  />
                </Field>
              ) : (
                <span className="block max-w-56 truncate" title={user.name}>{user.name}</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {isEditing ? (
                <Field data-disabled={isSelf || undefined}>
                  <FieldLabel htmlFor={`${editFormId}-email`} className="sr-only">Email pengguna</FieldLabel>
                  <Input
                    id={`${editFormId}-email`}
                    form={editFormId}
                    name={isSelf ? undefined : "email"}
                    type="email"
                    defaultValue={user.email}
                    required
                    maxLength={320}
                    disabled={isSelf}
                    title={isSelf ? "Email akun sendiri tidak dapat diubah dari halaman ini." : undefined}
                    autoComplete="off"
                  />
                  {isSelf ? <input form={editFormId} type="hidden" name="email" value={user.email} /> : null}
                </Field>
              ) : (
                <span className="block max-w-64 truncate" title={user.email}>{user.email}</span>
              )}
            </TableCell>
            <TableCell>
              {isEditing ? (
                <Field data-disabled={isSelf || undefined}>
                  <FieldLabel htmlFor={`${editFormId}-role`} className="sr-only">Role pengguna</FieldLabel>
                  <NativeSelect
                    id={`${editFormId}-role`}
                    form={editFormId}
                    name={isSelf ? undefined : "role"}
                    defaultValue={user.role}
                    disabled={isSelf}
                    title={isSelf ? "Role akun sendiri tidak dapat diubah." : undefined}
                    className="w-full min-w-28"
                  >
                    {USER_ROLES.map((role) => (
                      <NativeSelectOption key={role} value={role}>{ROLE_LABEL[role]}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {isSelf ? <input form={editFormId} type="hidden" name="role" value={user.role} /> : null}
                </Field>
              ) : (
                <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={user.isActive ? "success" : "destructive"}>
                {user.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
              {user.mustChangePassword ? <p className="mt-1 text-xs text-muted-foreground">Wajib ganti password</p> : null}
            </TableCell>
            <TableCell>
              {isEditing ? (
                <form id={editFormId} action={updateUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="updatedAt" value={user.updatedAt} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <UserEditActions name={user.name} onCancel={() => setEditingId(null)} />
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={editingId !== null}
                    aria-label={`Edit pengguna ${user.name}`}
                    onClick={() => setEditingId(user.id)}
                  >
                    Edit
                  </Button>
                  <form action={toggleUserActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value={String(!user.isActive)} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <ConfirmSubmitButton
                      variant={user.isActive ? "destructive" : "outline"}
                      size="sm"
                      disabled={isSelf || editingId !== null}
                      pendingLabel="Memproses..."
                      confirmTitle={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} pengguna?`}
                      confirmDescription={user.isActive ? "Pengguna akan kehilangan akses ke aplikasi sampai diaktifkan kembali." : "Pengguna akan kembali memperoleh akses sesuai role yang dimilikinya."}
                      confirmLabel={`Ya, ${user.isActive ? "nonaktifkan" : "aktifkan"}`}
                    >
                      {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
}
