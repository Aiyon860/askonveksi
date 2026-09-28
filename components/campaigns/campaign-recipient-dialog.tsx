"use client";

import { useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { getCampaignRecipientDialogAction, saveCampaignRecipientsAction } from "@/app/actions/campaigns";
import { RecipientPagination } from "@/components/recipient-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/crm/format";
import { paginate, RECIPIENT_PAGE_SIZE } from "@/lib/pagination";
import { CAMPAIGN_ORDER_CATEGORIES, CAMPAIGN_ORDER_CATEGORY_LABEL, type CampaignRecipientOption } from "@/lib/whatsapp/campaigns";

type RecipientFilters = {
  query: string;
  from: string;
  to: string;
  customerTypeId: string;
  orderCategory: string;
};

const EMPTY_FILTERS: RecipientFilters = { query: "", from: "", to: "", customerTypeId: "", orderCategory: "" };

export function CampaignRecipientDialog({
  campaignId,
  campaignName,
  canEdit,
  recipientCount,
}: {
  campaignId: string;
  campaignName: string;
  canEdit: boolean;
  recipientCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CampaignRecipientOption[]>([]);
  const [customerTypes, setCustomerTypes] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<RecipientFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(RECIPIENT_PAGE_SIZE);
  const [applying, startApplying] = useTransition();
  const filtersRef = useRef<RecipientFilters>(EMPTY_FILTERS);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(next: RecipientFilters, applySelection: boolean) {
    setLoading(true);
    setError(null);
    try {
      const result = await getCampaignRecipientDialogAction({ campaignId, ...next });
      setItems(result.items);
      setCustomerTypes(result.customerTypes);
      setTotal(result.total);
      setTruncated(result.truncated);
      if (applySelection) setSelected(result.selectedIds);
    } catch {
      setError("Daftar customer tidak dapat dimuat. Tutup dialog lalu buka kembali.");
    } finally {
      setLoading(false);
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) return;
    filtersRef.current = EMPTY_FILTERS;
    setFilters(EMPTY_FILTERS);
    setPage(1);
    void load(EMPTY_FILTERS, true);
  }

  function updateFilters(patch: Partial<RecipientFilters>) {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    setPage(1);
    void load(next, false);
  }

  function updateQuery(query: string) {
    const next = { ...filtersRef.current, query };
    filtersRef.current = next;
    setFilters(next);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void load(next, false), 300);
  }

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  const eligible = items.filter((item) => item.canReceive);
  const selectedVisible = eligible.filter((item) => selected.includes(item.id));
  const allSelected = eligible.length > 0 && selectedVisible.length === eligible.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;
  const selectedCount = selected.length;

  function toggleAll(checked: boolean) {
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...eligible.map((item) => item.id)])]
        : current.filter((id) => !eligible.some((item) => item.id === id)),
    );
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  }

  function apply() {
    startApplying(async () => {
      await saveCampaignRecipientsAction({ campaignId, customerIds: selected });
    });
  }

  const view = paginate(items, page, pageSize);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Pilih Customer</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pilih Customer</DialogTitle>
          <DialogDescription>
            Pilih customer penerima campaign &ldquo;{campaignName}&rdquo;. Hanya customer terpilih yang akan menerima pesan
            WhatsApp. {recipientCount} penerima tersimpan saat ini.
          </DialogDescription>
        </DialogHeader>

        {!canEdit ? (
          <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            Campaign sudah mulai dikirim, jadi daftar penerima hanya bisa dilihat.
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Cari nama customer atau perusahaan..."
              aria-label="Cari customer penerima"
              className="pl-8"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`recipient-from-${campaignId}`}>Tanggal dari</FieldLabel>
              <Input id={`recipient-from-${campaignId}`} type="date" value={filters.from} onChange={(event) => updateFilters({ from: event.target.value })} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`recipient-to-${campaignId}`}>Tanggal ke</FieldLabel>
              <Input id={`recipient-to-${campaignId}`} type="date" value={filters.to} onChange={(event) => updateFilters({ to: event.target.value })} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`recipient-type-${campaignId}`}>Kategori Customer</FieldLabel>
              <NativeSelect id={`recipient-type-${campaignId}`} value={filters.customerTypeId} onChange={(event) => updateFilters({ customerTypeId: event.target.value })} className="w-full">
                <NativeSelectOption value="">Semua kategori</NativeSelectOption>
                {customerTypes.map((type) => (
                  <NativeSelectOption key={type.id} value={type.id}>
                    {type.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`recipient-category-${campaignId}`}>Kategori Order</FieldLabel>
              <NativeSelect id={`recipient-category-${campaignId}`} value={filters.orderCategory} onChange={(event) => updateFilters({ orderCategory: event.target.value })} className="w-full">
                <NativeSelectOption value="">Semua order</NativeSelectOption>
                {CAMPAIGN_ORDER_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {CAMPAIGN_ORDER_CATEGORY_LABEL[category]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">No</TableHead>
                <TableHead>Nama Customer</TableHead>
                <TableHead>Kategori Customer</TableHead>
                <TableHead>Tanggal Terakhir Order</TableHead>
                <TableHead className="w-28">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      aria-label="Pilih semua customer pada daftar ini"
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={!canEdit || !eligible.length}
                      onCheckedChange={(checked) => toggleAll(checked)}
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
              ) : items.length ? (
                view.items.map((item, index) => (
                  <TableRow key={item.id} data-state={selected.includes(item.id) ? "selected" : undefined}>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">{view.start + index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.reason ? <span className="ml-2 text-xs font-normal text-muted-foreground">{item.reason}</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.customerTypeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.lastOrderAt ? `${formatDate(item.lastOrderAt)}${item.lastOrderKind === "PAYMENT" ? " (DP)" : ""}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        aria-label={`Pilih ${item.name}`}
                        checked={selected.includes(item.id)}
                        disabled={!canEdit || !item.canReceive}
                        onCheckedChange={(checked) => toggleOne(item.id, checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center whitespace-normal text-muted-foreground">
                    Tidak ada customer yang cocok dengan pencarian atau filter ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-3">
            <RecipientPagination
              total={items.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <p className="text-xs text-muted-foreground">
          {total} customer sesuai filter{truncated ? `, menampilkan ${items.length} pertama - persempit filter untuk melihat sisanya` : ""}.
        </p>

        <DialogFooter className="sm:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" aria-live="polite">
              {selectedCount} Customer Terpilih
            </p>
            {canEdit && selectedCount ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
                Hapus Semua Pilihan
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            {canEdit ? (
              <Button type="button" onClick={apply} disabled={applying}>
                {applying ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                {applying ? "Menyimpan..." : "Terapkan"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
