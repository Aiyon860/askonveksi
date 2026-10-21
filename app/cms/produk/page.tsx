import { ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { ProductCreateForm } from "@/components/cms/product-create-form";
import { ProductDeleteButton } from "@/components/cms/product-delete-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { orderedProducts } from "@/lib/cms/selectors";
import { readSiteContent } from "@/lib/cms/store";

function orderedFlat(products: ReturnType<typeof orderedProducts>) {
  const result: { product: (typeof products)[number]; depth: number }[] = [];
  const tops = products.filter((product) => !product.parentSlug);
  for (const top of tops) {
    result.push({ product: top, depth: 0 });
    for (const child of products.filter((product) => product.parentSlug === top.id)) {
      result.push({ product: child, depth: 1 });
    }
  }
  for (const orphan of products.filter((product) => product.parentSlug && !tops.some((top) => top.id === product.parentSlug))) {
    result.push({ product: orphan, depth: 0 });
  }
  return result;
}

export default async function CmsProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string; created?: string }>;
}) {
  const content = await readSiteContent();
  const params = await searchParams;
  const products = orderedFlat(orderedProducts(content));
  const childCount = new Map<string, number>();
  for (const product of content.products) {
    if (product.parentSlug) childCount.set(product.parentSlug, (childCount.get(product.parentSlug) ?? 0) + 1);
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Produk</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tambah produk baru, atur hubungan induk–anak, lalu buka editor untuk melengkapi deskripsi, galeri, dan
          pengaturannya.
        </p>
      </section>

      {params.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}
      {params.deleted ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Produk “{params.deleted}” sudah dihapus dari website.
        </p>
      ) : null}
      {params.created ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Produk berhasil dibuat. Lengkapi isinya lalu centang “Tampilkan halaman produk” saat siap tayang.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus aria-hidden="true" className="size-4" />
            Tambah produk
          </CardTitle>
          <CardDescription>Produk baru dibuat dalam keadaan belum tayang agar bisa disiapkan lebih dulu.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductCreateForm products={content.products} />
        </CardContent>
      </Card>

      <section aria-labelledby="daftar-produk" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="daftar-produk" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Daftar produk
          </h2>
          <span className="text-xs text-muted-foreground">{content.products.length} produk</span>
        </div>

        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada produk. Tambahkan produk pertama di atas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {products.map(({ product, depth }) => {
              const children = childCount.get(product.id) ?? 0;
              return (
                <article
                  key={product.id}
                  className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between ${depth ? "ml-4 border-l-2 border-l-border sm:ml-6" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                      <Badge variant={product.published ? "default" : "outline"}>{product.published ? "Tayang" : "Belum tayang"}</Badge>
                      {product.menuVisible ? <Badge variant="secondary">Di menu</Badge> : null}
                      {product.catalogVisible ? <Badge variant="secondary">Di katalog</Badge> : null}
                      {children ? <Badge variant="outline">{children} sub-produk</Badge> : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">/produk/{product.id}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Urutan menu {product.menuOrder} · urutan katalog {product.catalogOrder}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/cms/produk/${product.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                      Edit
                    </Link>
                    {product.published ? (
                      <Link
                        href={`/produk/${product.id}`}
                        target="_blank"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
                      >
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                        Lihat
                      </Link>
                    ) : null}
                    <ProductDeleteButton slug={product.id} name={product.name} disabled={children > 0} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
