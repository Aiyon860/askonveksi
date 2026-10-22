import { getCurrentActor } from "@/lib/auth/session";
import { isExportDatasetId, EXPORT_DATASETS, type ExportDatasetDefinition } from "@/lib/export/registry";
import { EXPORT_MAX_PAGE_SIZE, EXPORT_PAGE_SIZE } from "@/lib/export/types";

// Route data saja: server hanya mengirim baris JSON, tanpa merender file.
// Berkas .xlsx dibuat 100% di browser (Web Worker) agar ekspor besar tidak membebani server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pageParams(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? String(EXPORT_PAGE_SIZE), 10);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, EXPORT_MAX_PAGE_SIZE)
    : EXPORT_PAGE_SIZE;
  return { searchParams, page: { offset, limit } };
}

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "Sesi tidak valid." }, { status: 401 });

  const { dataset } = await params;
  if (!isExportDatasetId(dataset)) {
    return Response.json({ error: "Dataset export tidak dikenal." }, { status: 404 });
  }

  const definition: ExportDatasetDefinition = EXPORT_DATASETS[dataset];
  const { searchParams, page } = pageParams(request);

  try {
    const result = await definition.load({ searchParams, page });
    return Response.json(
      {
        dataset,
        title: definition.title,
        sheetName: definition.sheetName,
        subject: definition.subject,
        columns: definition.columns,
        rows: result.rows,
        total: result.total,
        // Dataset non-paged mengirim semua baris sekaligus; jangan minta halaman berikutnya.
        nextOffset: definition.paged === false || result.rows.length < page.limit ? null : page.offset + page.limit,
        meta: { filterSummary: result.filterSummary, notes: result.notes ?? [] },
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    // requireActor/requireDeveloperActor melempar UNAUTHORIZED; jangan bocorkan detail internal.
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Anda tidak berhak mengekspor data ini." }, { status: 403 });
    }
    console.error("Export dataset gagal", dataset, error);
    return Response.json({ error: "Data export gagal dimuat." }, { status: 500 });
  }
}
