"use client";

import { useState } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { EXPENSE_EXPORT_COLUMNS, type ExpenseExportLine } from "@/lib/finance/expense-export";
import { downloadFilename } from "@/lib/download-filename";

/**
 * Export Pengeluaran 100% di browser: tombol mengambil baris (JSON) dari route data
 * dengan filter yang sama persis dengan tabel, lalu membuat .xlsx lokal lewat ExcelJS
 * (build browser, dimuat dinamis saat diklik — tidak masuk bundle awal).
 * File hanya berisi teks/angka — tanpa gambar (R14).
 */
export function ExpenseExportButton({ params }: { params: Record<string, string | undefined> }) {
  const [pending, setPending] = useState(false);

  async function handleExport() {
    if (pending) return;
    setPending(true);
    try {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
      const response = await fetch(`/api/keuangan/pengeluaran/export?${search.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { lines: ExpenseExportLine[] };
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Pengeluaran");
      sheet.columns = EXPENSE_EXPORT_COLUMNS.map((header) => ({ header, key: header, width: 22 }));
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.getColumn("Deskripsi").alignment = { wrapText: true, vertical: "top" };
      for (const line of payload.lines) {
        const row = sheet.addRow(line.values);
        if (line.bold) row.font = { bold: true };
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadFilename("pengeluaran", "xlsx");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.add({ title: "Export belum berhasil", description: "File Excel gagal dibuat. Coba sekali lagi.", type: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={pending} title={pending ? "Menyiapkan file..." : undefined}>
      {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Download data-icon="inline-start" aria-hidden="true" />}
      {pending ? "Menyiapkan..." : "Export Excel"}
    </Button>
  );
}
