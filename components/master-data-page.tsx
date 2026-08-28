import { Database } from "lucide-react";

import { MasterDataEditor, type MasterAction, type MasterItem } from "@/components/master-data-editor";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MasterDataPageProps = {
  items: MasterItem[];
  singularLabel: string;
  createDescription: string;
  createAction: MasterAction;
  bulkUpdateAction: MasterAction;
};

export function MasterDataPage({
  items,
  singularLabel,
  createDescription,
  createAction,
  bulkUpdateAction,
}: MasterDataPageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      {items.length ? (
        <MasterDataEditor
          key={items.map((item) => `${item.id}:${item.position}:${item.name}:${item.description ?? ""}`).join("|")}
          items={items}
          singularLabel={singularLabel}
          updateAction={bulkUpdateAction}
        />
      ) : (
        <section
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
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

              <SubmitButton pendingLabel="Menyimpan...">Tambah {singularLabel.toLowerCase()}</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
