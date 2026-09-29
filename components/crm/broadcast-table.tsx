"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/crm/format";
import type { CampaignRecipientOption } from "@/lib/whatsapp/campaigns";

export function BroadcastTable({
  rows,
  allRows,
  loading,
  selected,
  startIndex,
  onToggleOne,
  onToggleAll,
  footer,
}: {
  rows: CampaignRecipientOption[];
  allRows: CampaignRecipientOption[];
  loading: boolean;
  selected: string[];
  startIndex: number;
  onToggleOne: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  footer?: React.ReactNode;
}) {
  const eligible = allRows.filter((row) => row.canReceive);
  const selectedInScope = eligible.filter((row) => selected.includes(row.id));
  const allSelected = eligible.length > 0 && selectedInScope.length === eligible.length;
  const someSelected = selectedInScope.length > 0 && !allSelected;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14">No</TableHead>
            <TableHead>Nama Customer</TableHead>
            <TableHead>Kategori Customer</TableHead>
            <TableHead>Tanggal Terakhir Order</TableHead>
            <TableHead className="w-28">
              <span className="flex items-center gap-2">
                <Checkbox
                  aria-label="Pilih semua customer yang bisa menerima broadcast"
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={loading || !eligible.length}
                  onCheckedChange={(checked) => onToggleAll(checked)}
                />
                Pilih
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-32 text-center whitespace-normal text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Spinner aria-hidden="true" />
                  Memuat customer...
                </span>
              </TableCell>
            </TableRow>
          ) : rows.length ? (
            rows.map((row, index) => (
              <TableRow key={row.id} data-state={selected.includes(row.id) ? "selected" : undefined}>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {row.name}
                  {row.reason ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{row.reason}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.customerTypeName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.lastOrderAt
                    ? `${formatDate(row.lastOrderAt)}${row.lastOrderKind === "PAYMENT" ? " (DP)" : ""}`
                    : "-"}
                </TableCell>
                <TableCell>
                  <Checkbox
                    aria-label={`Pilih ${row.name}`}
                    checked={selected.includes(row.id)}
                    disabled={!row.canReceive}
                    onCheckedChange={(checked) => onToggleOne(row.id, checked)}
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-24 text-center whitespace-normal text-muted-foreground">
                Tidak ada customer yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </div>
  );
}
