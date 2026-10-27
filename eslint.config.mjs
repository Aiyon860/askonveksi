import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundle vendor yang dihasilkan scripts/sync-export-vendor.mjs (bukan kode aplikasi):
    "public/vendor/**",
    // Skrip vendor milik AI-agent skills (pihak ketiga, bukan kode aplikasi):
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".gemini/**",
    ".github/skills/**",
    ".opencode/**",
    // Artefak video/komposisi dari skill brag (bukan kode aplikasi, berisi bundle vendor):
    "brag-output/**",
  ]),
]);

export default eslintConfig;
