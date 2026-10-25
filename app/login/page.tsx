import Image from "next/image";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getCurrentActor } from "@/lib/auth/session";
import { landingPathForRole } from "@/lib/auth/landing-path";
import { getSiteLogo } from "@/lib/site-logo";

export default async function LoginPage() {
  const actor = await getCurrentActor();
  if (actor) redirect(landingPathForRole(actor.role));
  const logo = await getSiteLogo();

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md" size="lg">
        <CardHeader className="items-center text-center">
          <Image src={logo.src} alt={logo.name} width={1920} height={1080} priority unoptimized={logo.unoptimized} className="mx-auto mb-2 h-12 w-auto object-contain" />
          <CardTitle className="text-xl">Masuk ke ruang kerja</CardTitle>
          <CardDescription>Kelola pipeline, customer, penawaran, dan Sales Order dari satu tempat.</CardDescription>
        </CardHeader>
        <CardContent>
          <PageMessage />
          <form action={loginAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email" required>Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} placeholder="nama@askonveksi.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password" required>Password</FieldLabel>
                <PasswordInput id="password" name="password" autoComplete="current-password" required maxLength={128} />
              </Field>
              <SubmitButton size="lg" className="w-full" pendingLabel="Memeriksa akun...">Masuk</SubmitButton>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t text-xs text-muted-foreground">© 2026 ASKONVEKSI</CardFooter>
      </Card>
    </main>
  );
}
