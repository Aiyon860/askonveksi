"use server";

import type { AppRole } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { CMS_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { CMS_CACHE_TAG, CmsValidationError, readSiteContent, saveSiteContent } from "@/lib/cms/store";
import type { CmsProduct, CmsSiteContent } from "@/lib/cms/types";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CmsProductActionState = { error: string | null };

export async function createProductAction(
  _previous: CmsProductActionState,
  formData: FormData,
): Promise<CmsProductActionState> {
  let slug = "";
  try {
    const actor = await requireActor(CMS_ROLES);
    const content = await readSiteContent();

    slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const parentSlug = String(formData.get("parentSlug") ?? "").trim() || null;

    if (!SLUG.test(slug)) {
      return { error: "Slug hanya boleh huruf kecil, angka, dan tanda hubung. Contoh: kaos-panjang." };
    }
    if (content.products.some((product) => product.id === slug)) {
      return { error: "Slug tersebut sudah dipakai produk lain." };
    }
    if (!name) return { error: "Nama produk wajib diisi." };
    if (parentSlug) {
      const parent = content.products.find((product) => product.id === parentSlug);
      if (!parent) return { error: "Induk produk tidak ditemukan." };
      if (parent.parentSlug) return { error: "Produk hanya boleh satu tingkat di bawah induk." };
    }

    const product: CmsProduct = {
      id: slug,
      name,
      tagline: "",
      description: "",
      parentSlug,
      menuVisible: false,
      menuOrder: 999,
      catalogVisible: false,
      catalogOrder: 999,
      cardImage: null,
      gallery: [],
      features: [],
      useCases: [],
      seoTitle: name,
      seoDescription: "",
      published: false,
    };

    const next: CmsSiteContent = { ...content, products: [...content.products, product] };
    await saveSiteContent(next, content.version, { id: actor.id, name: actor.name });
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
  } catch (error) {
    if (error instanceof CmsValidationError) return { error: error.message };
    console.error("[cms] gagal menambah produk:", error);
    return { error: "Produk gagal ditambahkan. Coba lagi." };
  }

  redirect(`/cms/produk/${slug}?created=1`);
}

export async function deleteProductAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const destination = await deleteProduct(slug);
  redirect(destination);
}

async function deleteProduct(slug: string) {
  try {
    const actor = await requireActor(CMS_ROLES);
    const content = await readSiteContent();
    const product = content.products.find((item) => item.id === slug);
    if (!product) return "/cms/produk?error=Produk tidak ditemukan.";

    const children = content.products.filter((item) => item.parentSlug === slug);
    if (children.length) {
      return `/cms/produk?error=Produk masih memiliki ${children.length} sub-produk. Pindahkan sub-produk terlebih dahulu.`;
    }

    const next: CmsSiteContent = {
      ...content,
      products: content.products.filter((item) => item.id !== slug),
    };
    await saveSiteContent(next, content.version, { id: actor.id, name: actor.name });
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
    return `/cms/produk?deleted=${encodeURIComponent(product.name)}`;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return "/cms/produk?error=Sesi%20Anda%20sudah%20berubah.%20Masuk%20kembali.";
    }
    console.error("[cms] gagal menghapus produk:", error);
    return "/cms/produk?error=Produk gagal dihapus. Coba lagi.";
  }
}

export type { AppRole };
