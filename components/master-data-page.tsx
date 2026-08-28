import { Database } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type MasterItem = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  isActive: boolean;
  _count: { customers: number };
};

type MasterAction = (formData: FormData) => Promise<never>;

export function MasterDataPage({
  items,
  singularLabel,
  createDescription,
  createAction,
  updateAction,
  toggleAction,
}: {
  items: MasterItem[];
  singularLabel: string;
  createDescription: string;
  createAction: MasterAction;
  updateAction: MasterAction;
  toggleAction: MasterAction;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section
        className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
        aria-label={`Daftar ${singularLabel.toLowerCase()}`}
      >
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-medium">Daftar {singularLabel.toLowerCase()}</h2>
            <p className="text-xs text-muted-foreground">Urutan lebih kecil ditampilkan lebih dahulu pada formulir customer.</p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">{items.length}</strong> data tercatat
          </p>
        </div>

        {items.length ? (
          <div className="flex min-h-112 flex-1 flex-col">
            <Table className="min-w-4xl" containerClassName="min-h-0 flex-1 overflow-auto">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow className="hover:bg-muted">
                  <TableHead className="w-16 text-center">No</TableHead>
                  <TableHead className="w-20">Urutan</TableHead>
                  <TableHead className="min-w-48">Nama</TableHead>
                  <TableHead className="min-w-64">Deskripsi</TableHead>
                  <TableHead>Dipakai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const updateFormId = `update-${item.id}`;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-center font-mono text-muted-foreground tabular-nums">{index + 1}</TableCell>
                      <TableCell><Input form={updateFormId} name="position" type="number" min={0} max={10000} defaultValue={item.position} aria-label={`Urutan ${item.name}`} /></TableCell>
                      <TableCell><Input form={updateFormId} name="name" required minLength={2} maxLength={80} defaultValue={item.name} aria-label={`Nama ${singularLabel.toLowerCase()}`} /></TableCell>
                      <TableCell><Input form={updateFormId} name="description" maxLength={500} defaultValue={item.description ?? ""} aria-label={`Deskripsi ${item.name}`} /></TableCell>
                      <TableCell className="text-center font-mono tabular-nums">{item._count.customers}</TableCell>
                      <TableCell><Badge variant={item.isActive ? "success" : "destructive"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <form id={updateFormId} action={updateAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <SubmitButton variant="outline" size="sm" pendingLabel="Menyimpan...">Simpan</SubmitButton>
                          </form>
                          <form action={toggleAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="isActive" value={String(!item.isActive)} />
                            <ConfirmSubmitButton
                              variant={item.isActive ? "destructive" : "outline"}
                              size="sm"
                              pendingLabel="Memproses..."
                              confirmTitle={`${item.isActive ? "Nonaktifkan" : "Aktifkan"} ${singularLabel.toLowerCase()}?`}
                              confirmDescription={item.isActive ? "Pilihan ini tidak tersedia untuk customer baru. Data lama tetap terhubung." : "Pilihan ini kembali tersedia pada formulir customer."}
                              confirmLabel={`Ya, ${item.isActive ? "nonaktifkan" : "aktifkan"}`}
                            >
                              {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="min-h-112">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Database aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>Belum ada {singularLabel.toLowerCase()}</EmptyTitle>
              <EmptyDescription>Tambahkan data pertama melalui formulir di samping.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Tambah {singularLabel.toLowerCase()}</CardTitle>
          <CardDescription>{createDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="master-name" required>Nama</FieldLabel>
                <Input id="master-name" name="name" required minLength={2} maxLength={80} />
              </Field>
              <Field>
                <FieldLabel htmlFor="master-description">Deskripsi</FieldLabel>
                <Textarea id="master-description" name="description" maxLength={500} rows={3} />
              </Field>
              <Field>
                <FieldLabel htmlFor="master-position" required>Urutan</FieldLabel>
                <Input id="master-position" name="position" type="number" min={0} max={10000} defaultValue={0} required />
              </Field>
              <SubmitButton pendingLabel="Menyimpan...">Tambah {singularLabel.toLowerCase()}</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
