import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getAiCustomers,
  getAiOverview,
  getAiPipeline,
  getAiProducts,
  getAiTimeseries,
} from "@/lib/ai/analytics";
import { buildAiCatalog } from "@/lib/ai/catalog";
import { parseAiQuery } from "@/lib/ai/http";

/**
 * Server MCP (Model Context Protocol) untuk asisten AI.
 *
 * Setiap tool hanya membaca agregat; tidak ada tool tulis. Parameter memakai
 * parser yang sama dengan REST agar validasi dan definisi periode konsisten.
 */
const brandSchema = z
  .enum(["ASKONVEKSI", "SAGA", "ALL"])
  .default("ASKONVEKSI")
  .describe("Brand yang dianalisis. ALL untuk gabungan kedua brand.");

const presetSchema = z
  .enum(["this-month", "last-month", "7d", "30d", "this-year", "all", "today", "yesterday"])
  .optional()
  .describe("Periode siap pakai. Kosongkan untuk 30 hari terakhir (tren: tahun berjalan).");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("Tanggal awal YYYY-MM-DD. Harus dipakai bersama `to`.");

const toToSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("Tanggal akhir YYYY-MM-DD (inklusif). Harus dipakai bersama `from`.");

function queryFromArgs(args: Record<string, unknown>, defaultPreset?: string) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  return parseAiQuery(searchParams, { defaultPreset });
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
}

async function run(handler: () => Promise<unknown>) {
  try {
    return textResult(await handler());
  } catch (error) {
    console.error("[ai-mcp] tool gagal", error);
    const message = error instanceof Error ? error.message : "Permintaan gagal diproses.";
    return errorResult(message);
  }
}

export function createAiMcpServer(baseUrl: string) {
  const server = new McpServer(
    { name: "askonveksi-sales-analytics", version: "1.0.0" },
    {
      instructions:
        "Gunakan tool ini untuk menganalisis penjualan Askonveksi: omzet, pesanan, HPP, margin, produk terlaris, kota customer, sumber lead, tren bulanan, dan pipeline. Semua nilai dalam Rupiah penuh. Selalu sebutkan periode dan brand pada jawaban. Bila `quality.warnings` berisi peringatan kelengkapan data (mis. kota hanya terisi 1,6%), sampaikan keterbatasan itu sebelum menyimpulkan.",
    },
  );

  server.registerTool(
    "analytics_catalog",
    {
      title: "Katalog metrik analitik",
      description:
        "Daftar metrik yang tersedia beserta definisinya (omzet, HPP, margin, AOV, win rate), pilihan periode, brand, dan batas privasi. Panggil ini lebih dulu bila belum yakin metrik apa yang tersedia.",
      inputSchema: {},
    },
    async () => run(async () => buildAiCatalog(baseUrl)),
  );

  server.registerTool(
    "sales_overview",
    {
      title: "Ringkasan penjualan",
      description:
        "Omzet, jumlah pesanan, AOV, total pcs, HPP, laba kotor, margin, dan pertumbuhan dibanding periode sebelumnya, plus rincian per brand dan peringatan kelengkapan data.",
      inputSchema: { brand: brandSchema, preset: presetSchema, from: dateSchema, to: toToSchema },
    },
    async (args) =>
      run(async () => {
        const query = queryFromArgs(args);
        return getAiOverview({ brand: query.brand, range: query.range });
      }),
  );

  server.registerTool(
    "top_products",
    {
      title: "Produk terlaris",
      description:
        "Produk dengan omzet dan pcs terbesar (mis. Jersey, Tshirt, Kemeja) beserta harga rata-rata per pcs dan porsi omzet, serta sebaran jenis pakaian JERSEY/NON_JERSEY/AKSESORI.",
      inputSchema: {
        brand: brandSchema,
        preset: presetSchema,
        from: dateSchema,
        to: toToSchema,
        limit: z.number().int().min(1).max(50).optional().describe("Jumlah produk yang ditampilkan (default 10)."),
      },
    },
    async (args) =>
      run(async () => {
        const query = queryFromArgs(args);
        return getAiProducts({ brand: query.brand, range: query.range, limit: query.limit });
      }),
  );

  server.registerTool(
    "customer_breakdown",
    {
      title: "Sebaran customer",
      description:
        "Customer berasal dari kota mana, dari sumber lead apa, jenis customer (instansi/perusahaan/personal), siklus hidup, rasio repeat order, dan top customer dengan nama disamarkan.",
      inputSchema: { brand: brandSchema, preset: presetSchema, from: dateSchema, to: toToSchema },
    },
    async (args) =>
      run(async () => {
        const query = queryFromArgs(args);
        return getAiCustomers({ brand: query.brand, range: query.range });
      }),
  );

  server.registerTool(
    "revenue_trend",
    {
      title: "Tren omzet",
      description:
        "Deret waktu omzet, jumlah pesanan, dan pcs per hari/minggu/bulan. Cocok untuk pertanyaan musim ramai, tren naik-turun, atau perbandingan bulan.",
      inputSchema: {
        brand: brandSchema,
        preset: presetSchema,
        from: dateSchema,
        to: toToSchema,
        granularity: z
          .enum(["day", "week", "month"])
          .optional()
          .describe("Resolusi deret waktu. Default month."),
      },
    },
    async (args) =>
      run(async () => {
        const query = queryFromArgs(args, "this-year");
        return getAiTimeseries({ brand: query.brand, range: query.range, granularity: query.granularity });
      }),
  );

  server.registerTool(
    "pipeline_status",
    {
      title: "Kondisi pipeline",
      description:
        "Jumlah peluang per tahap (Lead Baru, Follow Up, Negosiasi, Deal, Lost), win rate, nilai peluang terbuka, sisa piutang dari Sales Order aktif, dan jumlah follow-up yang lewat tenggat.",
      inputSchema: { brand: brandSchema, preset: presetSchema, from: dateSchema, to: toToSchema },
    },
    async (args) =>
      run(async () => {
        const query = queryFromArgs(args);
        return getAiPipeline({ brand: query.brand, range: query.range });
      }),
  );

  return server;
}
