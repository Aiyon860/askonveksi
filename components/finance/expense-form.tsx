"use client";

import { Pencil, Plus } from "lucide-react";

import { createExpenseAction, updateExpenseAction } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/file-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/finance/expense-categories";
import { EXPENSE_METHOD_LABEL, EXPENSE_METHODS, type ExpenseMethod } from "@/lib/finance/expense-methods";

type Expense = { id: string; purpose: string; spentAt: Date; amount: string; category: ExpenseCategory; paymentMethod: ExpenseMethod; proofPath?: string | null };

export function ExpenseForm({ expense }: { expense?: Expense }) {
  const editing = Boolean(expense);
  return <Dialog><DialogTrigger render={<Button variant={editing ? "outline" : "default"} size={editing ? "sm" : "default"} />}><>{editing ? <Pencil data-icon="inline-start" aria-hidden="true" /> : <Plus data-icon="inline-start" aria-hidden="true" />}{editing ? "Edit" : "Pengeluaran"}</></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Edit pengeluaran" : "Tambah pengeluaran"}</DialogTitle><DialogDescription>Catat biaya yang benar-benar digunakan. Pembuat tercatat otomatis dari akun login.</DialogDescription></DialogHeader><form action={editing ? updateExpenseAction : createExpenseAction}><input type="hidden" name="id" value={expense?.id} /><FieldGroup><Field><FieldLabel htmlFor="expense-purpose" required>Digunakan untuk apa</FieldLabel><Input id="expense-purpose" name="purpose" required minLength={2} maxLength={500} defaultValue={expense?.purpose ?? ""} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="expense-spent-at" required>Tanggal digunakan</FieldLabel><Input id="expense-spent-at" name="spentAt" type="date" required defaultValue={expense ? expense.spentAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} /></Field><Field><FieldLabel htmlFor="expense-amount" required>Nominal</FieldLabel><Input id="expense-amount" name="amount" type="number" min="1" step="0.01" required defaultValue={expense?.amount ?? ""} /></Field></div><Field><FieldLabel htmlFor="expense-category" required>Kategori</FieldLabel><NativeSelect id="expense-category" name="category" required defaultValue={expense?.category ?? ""} className="w-full"><NativeSelectOption value="" disabled>Pilih kategori</NativeSelectOption>{EXPENSE_CATEGORIES.map((category) => <NativeSelectOption key={category} value={category}>{EXPENSE_CATEGORY_LABEL[category]}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="expense-method" required>Metode pembayaran</FieldLabel><NativeSelect id="expense-method" name="paymentMethod" required defaultValue={expense?.paymentMethod ?? ""} className="w-full"><NativeSelectOption value="" disabled>Pilih metode</NativeSelectOption>{EXPENSE_METHODS.map((method) => <NativeSelectOption key={method} value={method}>{EXPENSE_METHOD_LABEL[method]}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel required={!editing || !expense?.proofPath}>Bukti pengeluaran</FieldLabel><FilePicker suppliedId="expense-proof" required={!editing || !expense?.proofPath} /><p className="text-xs text-muted-foreground">PDF, JPEG, PNG, atau WebP, maksimal 5 MB.</p></Field><SubmitButton pendingLabel="Menyimpan...">{editing ? "Simpan perubahan" : "Simpan pengeluaran"}</SubmitButton></FieldGroup></form></DialogContent></Dialog>;
}
