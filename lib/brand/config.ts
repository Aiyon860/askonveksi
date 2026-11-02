import type { AppRole } from "@prisma/client";

/**
 * Dua brand dalam satu instalasi. Nilai ini dipakai di database (enum Brand),
 * cookie, dan atribut `<html data-brand>` untuk tema.
 */
export const BRANDS = ["ASKONVEKSI", "SAGA"] as const;
export type Brand = (typeof BRANDS)[number];

export const DEFAULT_BRAND: Brand = "ASKONVEKSI";

/** Cookie brand aktif. Nilainya ditandatangani server agar tidak bisa dipalsukan. */
export const BRAND_COOKIE = "askonveksi_brand";

/**
 * Role yang boleh melihat sakelar brand. Developer selalu lolos (aturan proyek),
 * Owner dan Keuangan diperlakukan setara Owner.
 */
export const BRAND_SWITCH_ROLES = ["DEVELOPER", "OWNER", "KEUANGAN"] as const satisfies readonly AppRole[];

export function canSwitchBrand(role: AppRole) {
  return (BRAND_SWITCH_ROLES as readonly AppRole[]).includes(role);
}

export function isBrand(value: unknown): value is Brand {
  return value === "ASKONVEKSI" || value === "SAGA";
}

/** Kode pendek untuk nomor dokumen: INV-AS-..., INV-SG-... */
export function brandCode(brand: Brand) {
  return brand === "SAGA" ? "SG" : "AS";
}

export function brandLabel(brand: Brand) {
  return brand === "SAGA" ? "SAGA" : "Askonveksi";
}

/** Nilai atribut `data-brand` untuk tema CSS. */
export function brandDataAttribute(brand: Brand) {
  return brand === "SAGA" ? "saga" : "askonveksi";
}

export function brandLongLabel(brand: Brand) {
  return brand === "SAGA" ? "SAGA" : "AS Konveksi";
}

type BrandTheme = {
  /** Logo statis untuk sakelar dan chrome saat profil belum punya logo. */
  logoSrc: string;
  logoAlt: string;
  /** Warna representatif untuk titik indikator dan pratinjau tema. */
  accent: string;
};

export const BRAND_THEME: Record<Brand, BrandTheme> = {
  ASKONVEKSI: {
    logoSrc: "/brand/askonveksi-logo.png",
    logoAlt: "Askonveksi",
    accent: "oklch(0.47 0.19 258)",
  },
  SAGA: {
    logoSrc: "/brand/saga.jpeg",
    logoAlt: "SAGA",
    accent: "oklch(0.47 0.09 143)",
  },
};

/**
 * Nilai `brandScope` yang boleh tampil untuk sebuah brand.
 * Customer `BOTH` sengaja muncul di kedua brand.
 */
export function customerScopeFor(brand: Brand): Array<Brand | "BOTH"> {
  return brand === "SAGA" ? ["SAGA", "BOTH"] : ["ASKONVEKSI", "BOTH"];
}
