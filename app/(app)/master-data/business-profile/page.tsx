import Image from "next/image";

import { updateBusinessProfileAction } from "@/app/actions/master-data";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBusinessProfile } from "@/lib/master-data";

export default async function BusinessProfilePage() {
  const profile = await getBusinessProfile();
  if (!profile) return <p>Profil perusahaan belum tersedia. Jalankan migrasi database terbaru.</p>;
  return (
    <>
      <PageHeader title="Profil perusahaan" description="Identitas yang disalin ke snapshot PO dan invoice saat dokumen dikunci." />
      <PageMessage />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Identitas konveksi</CardTitle>
          <CardDescription>Perubahan hanya berlaku untuk dokumen baru atau revisi yang belum dikunci.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateBusinessProfileAction} encType="multipart/form-data">
            <input type="hidden" name="version" value={profile.version} />
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2"><FieldLabel htmlFor="business-name" required>Nama perusahaan</FieldLabel><Input id="business-name" name="name" required minLength={2} maxLength={160} defaultValue={profile.name} /></Field>
                <Field><FieldLabel htmlFor="business-phone">Telepon</FieldLabel><Input id="business-phone" name="phone" maxLength={32} defaultValue={profile.phone ?? ""} /></Field>
                <Field><FieldLabel htmlFor="business-email">Email</FieldLabel><Input id="business-email" name="email" type="email" maxLength={320} defaultValue={profile.email ?? ""} /></Field>
                <Field className="sm:col-span-2"><FieldLabel htmlFor="business-address">Alamat</FieldLabel><Textarea id="business-address" name="address" maxLength={2000} rows={4} defaultValue={profile.address ?? ""} /></Field>
              </div>
              <Field>
                <FieldLabel htmlFor="business-logo">Logo</FieldLabel>
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center">
                  <Image src={profile.logoPath ? "/api/master-data/business-profile/logo" : "/brand/askonveksi-logo.png"} alt={`Logo ${profile.name}`} width={180} height={64} className="h-14 w-auto object-contain" unoptimized={Boolean(profile.logoPath)} />
                  <Input id="business-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
                </div>
                <FieldDescription>PNG, JPG, atau WebP, maksimal 2 MB. Logo disimpan pada bucket privat.</FieldDescription>
              </Field>
              <SubmitButton pendingLabel="Menyimpan profil...">Simpan profil perusahaan</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
