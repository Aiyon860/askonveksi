export type FinanceWorkbookScope = "laporan" | "pemasukan" | "pengeluaran";

/** Laporan analisis multi-sheet untuk arsip owner. */
export type AnalysisWorkbookScope = "dashboard" | "analytics" | "lead-sources";

export type WorkbookFormula = {
  formula: string;
  result?: string | number | null;
};

export type WorkbookCellValue = string | number | null | WorkbookFormula;

export type WorkbookCell = {
  value?: WorkbookCellValue;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  vertical?: "top" | "middle" | "bottom";
  wrap?: boolean;
  border?: "thin" | "medium";
  numFmt?: string;
};

export type WorkbookRow = {
  cells: WorkbookCell[];
  height?: number;
};

export type WorkbookColumn = {
  width: number;
};

export type WorkbookSheet = {
  name: string;
  columns: WorkbookColumn[];
  rows: WorkbookRow[];
  merges?: string[];
  freeze?: { row: number; column: number };
  autoFilter?: { fromRow: number; toRow: number; fromColumn: number; toColumn: number };
  pageSetup?: {
    orientation?: "landscape" | "portrait";
    fitToPage?: boolean;
    fitToWidth?: number;
    fitToHeight?: number;
    paperSize?: number;
    margins?: { left?: number; right?: number; top?: number; bottom?: number; header?: number; footer?: number };
    printTitlesRow?: string;
  };
  properties?: { defaultRowHeight?: number };
};

export type WorkbookSpec = {
  sheets: WorkbookSheet[];
};

export type WorkbookPayload = {
  spec: WorkbookSpec;
  subject: string;
  rowCount: number;
  periodLabel: string;
};
