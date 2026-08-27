import { redirect } from "next/navigation";

import { updatePasswordAction } from "@/app/actions/auth";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getCurrentActor } from "@/lib/auth/session";

export default async function PasswordPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Amankan akun Anda</CardTitle>
          <CardDescription>
            {actor.mustChangePassword
              ? "Password sementara harus diganti sebelum Anda dapat membuka CRM."
              : "Perbarui password akun bila diperlukan."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageMessage />
          <form action={updatePasswordAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password" required>Password baru</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
                <FieldDescription>Minimal 12 karakter, dengan huruf besar, huruf kecil, angka, dan simbol.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword" required>Ulangi password baru</FieldLabel>
                <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
              </Field>
              <SubmitButton pendingLabel="Memperbarui...">Simpan password</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
