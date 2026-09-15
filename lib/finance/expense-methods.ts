export const EXPENSE_METHODS = ["QRIS", "TUNAI", "BANK_A", "BANK_B", "PRIBADI"] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];
export const EXPENSE_METHOD_LABEL: Record<ExpenseMethod, string> = { QRIS: "QRIS", TUNAI: "Tunai", BANK_A: "Bank A", BANK_B: "Bank B", PRIBADI: "Pribadi" };
