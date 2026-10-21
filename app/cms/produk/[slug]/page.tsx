import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsEditor } from "@/components/cms/cms-editor";
import { productEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export default async function CmsProductEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await readSiteContent();
  const index = content.products.findIndex((product) => product.id === slug);
  if (index === -1) notFound();

  return (
    <main className="flex flex-col gap-4">
      <Link href="/cms/produk" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Kembali ke daftar produk
      </Link>
      <CmsEditor page={productEditor(content, index)} initialContent={content} productId={slug} />
    </main>
  );
}
