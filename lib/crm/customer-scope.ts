import "server-only";

import type { Prisma } from "@prisma/client";

import type { Brand } from "@/lib/brand/config";
import { allBrands } from "@/lib/brand/prisma-extension";
import { resolveRequestBrand } from "@/lib/brand/request-brand";

/**
 * Satu orang bisa menjadi pelanggan ASKONVEKSI dan SAGA sekaligus. Saat
 * customer baru dibuat dengan WhatsApp atau email yang sudah terdaftar di
 * brand lain, kedua catatan ditandai `BOTH` supaya riwayatnya terlihat utuh
 * di kedua brand tanpa menggandakan identitas.
 *
 * Mengembalikan `"BOTH"` bila penggabungan terjadi, atau `null` bila customer
 * baru cukup menjadi milik brand aktif (perilaku default ekstensi Prisma).
 */
export async function mergeCustomerAcrossBrands(
  tx: Prisma.TransactionClient,
  input: { whatsapp?: string | null; email?: string | null },
  brandOverride?: Brand,
): Promise<"BOTH" | null> {
  const whatsapp = input.whatsapp?.trim();
  const email = input.email?.trim().toLowerCase();
  const identity: Prisma.CustomerWhereInput[] = [];
  if (whatsapp) identity.push({ whatsapp });
  if (email) identity.push({ email: { equals: email, mode: "insensitive" } });
  if (!identity.length) return null;

  const brand = brandOverride ?? await resolveRequestBrand();
  const otherBrand: Brand = brand === "SAGA" ? "ASKONVEKSI" : "SAGA";
  const candidateScopes: Array<Brand | "BOTH"> = [otherBrand, "BOTH"];

  // Query lintas brand disengaja: justru inilah inti penggabungan.
  const matches = await tx.customer.findMany(
    allBrands({
      where: {
        OR: identity,
        archivedAt: null,
        brandScope: { in: candidateScopes },
      },
      select: { id: true, brandScope: true },
      take: 20,
    }),
  );
  if (!matches.length) return null;

  const pending = matches.filter((match) => match.brandScope !== "BOTH").map((match) => match.id);
  if (pending.length) {
    await tx.customer.updateMany(
      allBrands({
        where: { id: { in: pending } },
        data: { brandScope: "BOTH" },
      }),
    );
  }
  return "BOTH";
}
