export type PaymentTypeLabel = "Deposit" | "Termin" | "Lunas" | "DP";

type PaymentTypeSource = {
  isDeposit: boolean;
  paymentTermId: string | null;
  kind: "LUNAS" | "DP" | "DEPOSIT";
};

/**
 * Label jenis pembayaran untuk baris pemasukan Laporan.
 * Urutan prioritas: deposit PO, termin, lalu jenis jadwal pembayaran.
 */
export function paymentTypeLabel({ isDeposit, paymentTermId, kind }: PaymentTypeSource): PaymentTypeLabel {
  if (isDeposit) return "Deposit";
  if (paymentTermId) return "Termin";
  if (kind === "LUNAS") return "Lunas";
  if (kind === "DEPOSIT") return "Deposit";
  return "DP";
}
