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
          <form action={updateBusinessProfileAction}>
            <input type="hidden" name="version" value={profile.version} />
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2"><FieldLabel htmlFor="business-name" required>Nama perusahaan</FieldLabel><Input id="business-name" name="name" required minLength={2} maxLength={160} defaultValue={profile.name} /></Field>
                <Field><FieldLabel htmlFor="business-phone">Telepon</FieldLabel><Input id="business-phone" name="phone" maxLength={32} defaultValue={profile.phone ?? ""} /></Field>
                <Field><FieldLabel htmlFor="business-email">Email</FieldLabel><Input id="business-email" name="email" type="email" maxLength={320} defaultValue={profile.email ?? ""} /></Field>
                <Field className="sm:col-span-2"><FieldLabel htmlFor="business-address">Alamat</FieldLabel><Textarea id="business-address" name="address" maxLength={2000} rows={4} defaultValue={profile.address ?? ""} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2"><FieldLabel htmlFor="business-invoice-notes">Template catatan invoice (bisa diedit)</FieldLabel><Textarea id="business-invoice-notes" name="invoiceNotes" maxLength={2000} rows={3} defaultValue={profile.invoiceNotes ?? ""} /></Field>
              </div>
              <Field>
                <FieldLabel htmlFor="business-logo">Logo</FieldLabel>
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center">
                  <Image src={profile.logoPath ? "/api/master-data/business-profile/logo" : "/new-logo.webp"} alt={`Logo ${profile.name}`} width={1920} height={1080} className="h-14 w-auto object-contain" unoptimized={Boolean(profile.logoPath)} />
                  <Input id="business-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
                </div>
                <FieldDescription>PNG, JPG, atau WebP, maksimal 2 MB. Logo disimpan pada bucket privat.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="business-signature-image">Tanda tangan</FieldLabel>
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center">
                  {profile.signaturePath ? (
                    <Image src="/api/master-data/business-profile/signature" alt="Gambar tanda tangan" width={720} height={240} className="h-14 w-auto object-contain" unoptimized />
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada gambar tanda tangan.</p>
                  )}
                  <Input id="business-signature-image" name="signature" type="file" accept="image/png,image/jpeg,image/webp" />
                </div>
                <FieldDescription>
                  PNG, JPG, atau WebP, maksimal 2 MB. Gambar dicetak di atas nama pada PDF invoice dan kwitansi.
                  {profile.signaturePath ? (
                    <>
                      {" "}
                      <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" name="removeSignature" value="1" className="size-3.5 accent-destructive" />
                        Hapus gambar (kembali ke teks saja)
                      </label>
                    </>
                  ) : null}
                </FieldDescription>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor="business-signature-name">Nama</FieldLabel><Input id="business-signature-name" name="signatureName" maxLength={160} placeholder="cth. Tasya" defaultValue={profile.signatureName ?? ""} /></Field>
                  <Field><FieldLabel htmlFor="business-signature-title">Jabatan</FieldLabel><Input id="business-signature-title" name="signatureTitle" maxLength={120} placeholder="cth. Owner" defaultValue={profile.signatureTitle ?? ""} /></Field>
                </div>
              </Field>
              <SubmitButton pendingLabel="Menyimpan profil...">Simpan profil perusahaan</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
