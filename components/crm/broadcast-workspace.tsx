"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Search, Send, Upload } from "lucide-react";

import { getBroadcastRecipientsAction, importBroadcastDatesAction, sendTodayFollowUpBroadcastAction } from "@/app/actions/broadcast";
import { BroadcastTable } from "@/components/crm/broadcast-table";
import { RecipientPagination } from "@/components/recipient-pagination";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { paginate, RECIPIENT_PAGE_SIZE } from "@/lib/pagination";
import type { CampaignRecipientOption } from "@/lib/whatsapp/campaigns";

type RecipientFilters = {
  query: string;
  from: string;
  to: string;
  customerTypeId: string;
  productCategoryId: string;
};

const EMPTY_FILTERS: RecipientFilters = { query: "", from: "", to: "", customerTypeId: "", productCategoryId: "" };

// Formulir server action di-reset React setelah dikirim; simpan draf agar template terakhir tidak hilang.
const MESSAGE_DRAFT_KEY = "askonveksi:follow-up-broadcast-message";

type RecipientResult = {
  items: CampaignRecipientOption[];
  total: number;
  truncated: boolean;
  customerTypes: { id: string; name: string }[];
  productCategories?: { id: string; name: string }[];
};

const LOAD_ERROR = "Daftar customer tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.";

export function BroadcastWorkspace({ initial, defaultMessage }: { initial: RecipientResult; defaultMessage: string }) {
  const [rows, setRows] = useState(initial.items);
  const [customerTypes, setCustomerTypes] = useState(initial.customerTypes);
  const [productCategories, setProductCategories] = useState(initial.productCategories ?? []);
  const [total, setTotal] = useState(initial.total);
  const [truncated, setTruncated] = useState(initial.truncated);
  const [filters, setFilters] = useState<RecipientFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(RECIPIENT_PAGE_SIZE);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const filtersRef = useRef<RecipientFilters>(EMPTY_FILTERS);
  const initialRef = useRef(initial);
  const searchTimer = useRef<number | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (initialRef.current === initial) return;
    initialRef.current = initial;
    setRows(initial.items);
    setCustomerTypes(initial.customerTypes);
    setProductCategories(initial.productCategories ?? []);
    setTotal(initial.total);
    setTruncated(initial.truncated);
    setSelected([]);
    setError(null);
    setPage(1);
  }, [initial]);

  useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    // Dibaca setelah paint agar hasil render server (template bawaan) dan klien tidak bentrok.
    const timer = window.setTimeout(() => {
      try {
        const draft = window.localStorage.getItem(MESSAGE_DRAFT_KEY);
        if (draft) setMessage(draft);
      } catch {
        // localStorage tidak tersedia (mode privat): tetap pakai template bawaan.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateMessage(next: string) {
    setMessage(next);
    try {
      if (next.trim()) window.localStorage.setItem(MESSAGE_DRAFT_KEY, next);
      else window.localStorage.removeItem(MESSAGE_DRAFT_KEY);
    } catch {
      // Abaikan kegagalan penyimpanan draf.
    }
  }

  async function load(next: RecipientFilters) {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getBroadcastRecipientsAction(next);
      if (id !== requestId.current) return;
      setRows(result.items);
      setCustomerTypes(result.customerTypes);
      if (result.productCategories) setProductCategories(result.productCategories);
      setTotal(result.total);
      setTruncated(result.truncated);
    } catch {
      if (id !== requestId.current) return;
      setError(LOAD_ERROR);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function updateQuery(query: string) {
    const next = { ...filtersRef.current, query };
    filtersRef.current = next;
    setFilters(next);
    setPage(1);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => void load(next), 300);
  }

  function updateFilters(patch: Partial<RecipientFilters>) {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    setPage(1);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    void load(next);
  }

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  function toggleAll(checked: boolean) {
    const eligible = rows.filter((row) => row.canReceive).map((row) => row.id);
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...eligible])]
        : current.filter((id) => !eligible.includes(id)),
    );
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  }

  const table = paginate(rows, page, pageSize);

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:items-start">
      <section className="min-w-0" aria-label="Daftar penerima broadcast">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Penerima broadcast</CardTitle>
              <CardDescription>
                {total} customer aktif{truncated ? `, menampilkan ${rows.length} pertama` : ""}. Centang customer yang
                akan menerima broadcast Repeat Order lewat WhatsApp.
              </CardDescription>
            </div>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
                <FileSpreadsheet data-icon="inline-start" aria-hidden="true" />
                Import Tanggal Excel
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Tanggal Order Excel</DialogTitle>
                  <DialogDescription>
                    Unggah file Excel (.xlsx) berisi data customer dan tanggal order historis untuk broadcast. Tanpa rincian item atau detail order.
                  </DialogDescription>
                </DialogHeader>
                <form action={importBroadcastDatesAction} className="flex flex-col gap-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="broadcast-excel-file" required>File Excel (.xlsx)</FieldLabel>
                      <Input
                        id="broadcast-excel-file"
                        name="file"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        required
                      />
                      <FieldDescription>
                        Kolom yang didukung: Nama Customer, WhatsApp, Tanggal Order (YYYY-MM-DD atau DD/MM/YYYY).
                      </FieldDescription>
                    </Field>
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary underline-offset-4 hover:underline"
                        nativeButton={false}
                        render={<a href="/api/crm/broadcast-date-template" download="template-import-tanggal-broadcast.xlsx" />}
                      >
                        Unduh format template Excel
                      </Button>
                    </div>
                    <SubmitButton pendingLabel="Mengimpor tanggal...">
                      <Upload data-icon="inline-start" aria-hidden="true" />
                      Mulai Import Tanggal
                    </SubmitButton>
                  </FieldGroup>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={filters.query}
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder="Cari nama customer atau perusahaan..."
                  aria-label="Cari penerima broadcast"
                  className="pl-8"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="broadcast-from">Tanggal dari</FieldLabel>
                  <Input
                    id="broadcast-from"
                    type="date"
                    value={filters.from}
                    onChange={(event) => updateFilters({ from: event.target.value })}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="broadcast-to">Tanggal ke</FieldLabel>
                  <Input
                    id="broadcast-to"
                    type="date"
                    value={filters.to}
                    onChange={(event) => updateFilters({ to: event.target.value })}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="broadcast-type">Kategori Customer</FieldLabel>
                  <NativeSelect
                    id="broadcast-type"
                    value={filters.customerTypeId}
                    onChange={(event) => updateFilters({ customerTypeId: event.target.value })}
                    className="w-full"
                  >
                    <NativeSelectOption value="">Semua kategori</NativeSelectOption>
                    {customerTypes.map((type) => (
                      <NativeSelectOption key={type.id} value={type.id}>
                        {type.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="broadcast-category">Kategori Order</FieldLabel>
                  <NativeSelect
                    id="broadcast-category"
                    value={filters.productCategoryId}
                    onChange={(event) => updateFilters({ productCategoryId: event.target.value })}
                    className="w-full"
                  >
                    <NativeSelectOption value="">Semua order</NativeSelectOption>
                    {productCategories.map((category) => (
                      <NativeSelectOption key={category.id} value={category.id}>
                        {category.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <BroadcastTable
              rows={table.items}
              allRows={rows}
              loading={loading}
              selected={selected}
              startIndex={table.start}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              footer={
                <RecipientPagination
                  total={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={changePageSize}
                />
              }
            />
          </CardContent>
        </Card>
      </section>

      <aside className="min-w-0 self-start xl:sticky xl:top-6">
        <Card>
          <CardHeader>
            <CardTitle>Follow Up Hari Ini</CardTitle>
            <CardDescription>
              Kirim broadcast Repeat Order lewat WhatsApp ke customer terpilih. Customer berstatus arsip, tanpa nomor
              WhatsApp valid, atau menolak pesan otomatis dilewati.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={sendTodayFollowUpBroadcastAction} className="flex flex-col gap-4">
              {selected.map((id) => (
                <input key={id} type="hidden" name="customerIds" value={id} />
              ))}

              <Field className="gap-1.5">
                <FieldLabel htmlFor="broadcast-message">Pesan</FieldLabel>
                <Textarea
                  id="broadcast-message"
                  name="message"
                  value={message}
                  onChange={(event) => updateMessage(event.target.value)}
                  rows={8}
                  maxLength={4000}
                  placeholder="Kosongkan untuk memakai template Follow Up bawaan."
                />
                <FieldDescription>
                  Variabel yang tersedia: {"{{customer_name}}"}, {"{{company_name}}"}, {"{{business_name}}"}, dan{" "}
                  {"{{sales_pic_name}}"}. Template terakhir yang Anda tulis disimpan di perangkat ini.
                </FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="broadcast-image">Gambar pamflet/poster (opsional)</FieldLabel>
                <ImagePicker id="broadcast-image" name="image" emptyLabel="Tanpa gambar" />
                <FieldDescription>
                  JPG, PNG, atau WebP maksimal 10 MB. Gambar dipakai untuk pengiriman ini lalu dihapus dari sistem,
                  sehingga riwayat Kotak Masuk hanya menyimpan nama file.
                </FieldDescription>
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {selected.length ? `${selected.length} customer terpilih` : "Belum ada customer dipilih"}
                </p>
                {selected.length ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
                    Hapus semua pilihan
                  </Button>
                ) : null}
              </div>

              <SubmitButton pendingLabel="Mengirim...">
                <Send data-icon="inline-start" aria-hidden="true" />
                Kirim Pesan
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
