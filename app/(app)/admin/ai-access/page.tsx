import { AiAccessPanel, type AiAccessTokenRow } from "@/components/admin/ai-access-panel";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requirePageActor } from "@/lib/auth/session";
import { aiBaseUrl } from "@/lib/ai/catalog";
import { formatDate } from "@/lib/crm/format";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Server component: waktu acuan diambil lewat helper agar aturan purity render tetap lolos. */
function isTokenExpired(expiresAt: Date | null) {
  return expiresAt ? expiresAt.getTime() <= new Date().getTime() : false;
}

export default async function AiAccessPage() {
  await requirePageActor(USER_ADMIN_ROLES);

  const prisma = getPrismaClient();
  const [tokens, origin] = await Promise.all([
    prisma.aiApiToken.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        label: true,
        tokenHint: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        _count: { select: { events: true } },
      },
    }),
    Promise.resolve(aiBaseUrl()),
  ]);

  const rows: AiAccessTokenRow[] = tokens.map((token) => ({
    id: token.id,
    label: token.label,
    tokenHint: token.tokenHint,
    createdAt: formatDate(token.createdAt),
    lastUsedAt: token.lastUsedAt ? formatDate(token.lastUsedAt) : null,
    expiresAt: token.expiresAt ? formatDate(token.expiresAt) : null,
    revokedAt: token.revokedAt ? formatDate(token.revokedAt) : null,
    expired: isTokenExpired(token.expiresAt),
    callCount: token._count.events,
  }));

  return (
    <main className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Akses AI"
        description="Token baca-saja agar ChatGPT, Claude, atau Gemini bisa menganalisis data penjualan. Tidak ada akses tulis dan tidak ada data pribadi customer."
      />
      <PageMessage />

      <Card>
        <CardHeader>
          <CardTitle>Buat token</CardTitle>
          <CardDescription>
            Token hanya ditampilkan sekali. Setiap panggilan dicatat di log audit beserta nama token, waktu, dan durasinya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiAccessPanel tokens={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cara menyambungkan</CardTitle>
          <CardDescription>Ganti &lt;token&gt; dengan token yang baru dibuat.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="font-medium">REST (coba dulu di terminal)</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>{`curl "${origin}/api/ai/overview?preset=this-month" \\\n  -H "Authorization: Bearer <token>"`}</code>
            </pre>
          </div>
          <div>
            <p className="font-medium">MCP (ChatGPT, Claude, Gemini, Cursor)</p>
            <p className="text-muted-foreground">
              URL server: <code className="rounded bg-muted px-1 py-0.5 text-xs">{origin}/api/mcp</code> — Streamable HTTP.
              Cursor/Gemini: header <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer &lt;token&gt;</code>.
              Claude/ChatGPT connector: tambah URL saja, lalu tempel token di halaman izin OAuth.
            </p>
          </div>
          <div>
            <p className="font-medium">Katalog metrik</p>
            <p className="text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{origin}/api/ai</code> berisi daftar metrik, definisi, dan batas
              privasi yang bisa dibaca asisten AI.
            </p>
          </div>
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-muted-foreground">
            Data kota dan sumber lead masih sangat sedikit terisi, jadi jawaban AI untuk pertanyaan seperti “customer paling banyak dari
            kota mana” akan menyertakan peringatan keterbatasan data. Lengkapi isian tersebut agar analisisnya berguna.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
