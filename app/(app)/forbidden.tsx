import { AccessDeniedPanel, accessDeniedContent } from "@/components/access-denied";

/**
 * Halaman 403 untuk area aplikasi (ditolak oleh guard layout `(app)` atau
 * guard halaman). Next memberi status HTTP 403 dan tag noindex otomatis.
 */
export default async function ForbiddenPage() {
  const { description, homePath, homeLabel } = await accessDeniedContent();

  return (
    <main className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <AccessDeniedPanel description={description} homePath={homePath} homeLabel={homeLabel} />
    </main>
  );
}
