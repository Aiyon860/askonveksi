import { Database, Download, Upload } from "lucide-react";

import { MasterDataEditor, type MasterAction, type MasterItem } from "@/components/master-data-editor";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MasterDataPageProps = {
  items: MasterItem[];
  singularLabel: string;
  createDescription: string;
  createAction: MasterAction;
  bulkUpdateAction: MasterAction;
  importAction: MasterAction;
  exportHref: string;
  maxNameLength?: number;
  usageLabel?: string;
};

export function MasterDataPage({
  items,
  singularLabel,
  createDescription,
  createAction,
  bulkUpdateAction,
  importAction,
  exportHref,
  maxNameLength = 80,
  usageLabel,
}: MasterDataPageProps) {
  const importInputId = `master-import-${exportHref.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      {items.length ? (
        <MasterDataEditor
          key={items.map((item) => `${item.id}:${item.position}:${item.name}:${item.description ?? ""}`).join("|")}
          items={items}
          singularLabel={singularLabel}
          updateAction={bulkUpdateAction}
          usageLabel={usageLabel}
        />
      ) : (
        <section
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
          aria-label={`Daftar ${singularLabel.toLowerCase()}`}
        >
          <Empty className="min-h-112">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Database aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>Belum ada {singularLabel.toLowerCase()}</EmptyTitle>
              <EmptyDescription>Tambahkan data pertama melalui formulir di samping.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Excel</CardTitle>
            <CardDescription>Export semua data, atau import XLSX dengan kolom Nama dan Deskripsi.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Button variant="outline" render={<a href={exportHref} />} nativeButton={false}>
                <Download data-icon="inline-start" aria-hidden="true" />
                Export Excel
              </Button>
              <form action={importAction}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={importInputId}>File import</FieldLabel>
                    <FilePicker id={importInputId} name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" emptyLabel="Belum ada file Excel" />
                    <FieldDescription>Maksimal 1 MB. Sheet pertama saja; formula ditolak.</FieldDescription>
                  </Field>
                  <SubmitButton variant="secondary" pendingLabel="Mengimpor...">
                    <Upload data-icon="inline-start" aria-hidden="true" />
                    Import Excel
                  </SubmitButton>
                </FieldGroup>
              </form>
            </FieldGroup>
          </CardContent>
        </Card>

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
                  <Input id="master-name" name="name" required minLength={2} maxLength={maxNameLength} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="master-description">Deskripsi</FieldLabel>
                  <Textarea id="master-description" name="description" maxLength={500} rows={3} />
                </Field>

                <SubmitButton pendingLabel="Menyimpan...">Tambah {singularLabel.toLowerCase()}</SubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
