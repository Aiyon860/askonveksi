import { AccessDeniedPanel, accessDeniedContent } from "@/components/access-denied";

/**
 * Halaman 403 tingkat akar (mis. ditolak sebelum shell aplikasi dirender).
 * Tetap memakai status 403 dari Next, bukan error bawaan.
 */
export default async function ForbiddenPage() {
  const { description, homePath, homeLabel } = await accessDeniedContent();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <AccessDeniedPanel description={description} homePath={homePath} homeLabel={homeLabel} />
    </main>
  );
}
