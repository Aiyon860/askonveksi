import { UserPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { createUserAction, toggleUserActiveAction } from "@/app/actions/users";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentActor } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { getUsers } from "@/lib/crm/data";
import { formatDate } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, parsePageParam } from "@/lib/pagination";

type UserSearchParams = Promise<{ page?: string | string[] }>;

export default async function UsersPage({ searchParams }: { searchParams: UserSearchParams }) {
  const page = parsePageParam((await searchParams).page);
  const [{ items: users, total, activeTotal, pageCount }, actor] = await Promise.all([getUsers(page), getCurrentActor()]);
  if (page > pageCount) redirect(pageCount > 1 ? `/admin/users?page=${pageCount}` : "/admin/users");

  return (
    <>
      <PageHeader title="Pengguna aplikasi" description="Owner membuat akun langsung dengan password sementara. Role tidak disimpan pada metadata Auth." />
      <PageMessage />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar pengguna</CardTitle>
            <CardDescription>{activeTotal} pengguna aktif dari {total} akun.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Pengguna</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Dibuat</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><p className="font-medium">{user.name}</p><p className="mt-1 text-xs text-muted-foreground">{user.email}</p></TableCell>
                    <TableCell><Badge variant="outline">{ROLE_LABEL[user.role]}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "destructive"}>{user.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      {user.mustChangePassword ? <p className="mt-1 text-xs text-muted-foreground">Wajib ganti password</p> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <form action={toggleUserActiveAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="isActive" value={String(!user.isActive)} />
                        <ConfirmSubmitButton
                          variant={user.isActive ? "destructive" : "outline"}
                          size="sm"
                          disabled={user.id === actor?.id}
                          pendingLabel="Memproses..."
                          confirmTitle={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} pengguna?`}
                          confirmDescription={user.isActive ? "Pengguna akan kehilangan akses ke aplikasi sampai diaktifkan kembali." : "Pengguna akan kembali memperoleh akses sesuai role yang dimilikinya."}
                          confirmLabel={`Ya, ${user.isActive ? "nonaktifkan" : "aktifkan"}`}
                        >
                          {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </ConfirmSubmitButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination
              pathname="/admin/users"
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={DATA_PAGE_SIZE}
              className="border-t pt-4"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tambah pengguna</CardTitle>
            <CardDescription>Akun langsung aktif dan tidak mengirim undangan email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUserAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name" required>Nama</FieldLabel>
                  <Input id="name" name="name" required minLength={2} maxLength={120} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email" required>Email</FieldLabel>
                  <Input id="email" name="email" type="email" required maxLength={320} autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role" required>Role</FieldLabel>
                  <NativeSelect id="role" name="role" required defaultValue="SALES" className="w-full">
                    <NativeSelectOption value="OWNER">Owner</NativeSelectOption>
                    <NativeSelectOption value="ADMIN">Admin</NativeSelectOption>
                    <NativeSelectOption value="SALES">Sales</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="temporaryPassword" required>Password sementara</FieldLabel>
                  <Input id="temporaryPassword" name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
                  <FieldDescription>Minimal 12 karakter dengan huruf besar, kecil, angka, dan simbol.</FieldDescription>
                </Field>
                <ConfirmSubmitButton
                  pendingLabel="Membuat akun..."
                  confirmTitle="Buat pengguna baru?"
                  confirmDescription="Akun akan langsung aktif dan memperoleh akses sesuai role yang dipilih."
                  confirmLabel="Ya, buat pengguna"
                >
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                  Buat pengguna
                </ConfirmSubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
