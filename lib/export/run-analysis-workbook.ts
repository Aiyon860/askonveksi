import { runWorkbookExport } from "@/lib/export/run-finance-workbook";
import type { AnalysisWorkbookScope } from "@/lib/export/workbook-types";
import type { ExportProgress, ExportRunResult } from "@/lib/export/run-export";

/** Export laporan analisis multi-sheet (dashboard, analytics, kanal akuisisi). */
export async function runAnalysisWorkbookExport({
  scope,
  params,
  onProgress,
  signal,
}: {
  scope: AnalysisWorkbookScope;
  params: Record<string, string | undefined>;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<ExportRunResult> {
  return runWorkbookExport({
    endpoint: "/api/export/analysis-workbook",
    scope,
    params,
    onProgress,
    signal,
  });
}
