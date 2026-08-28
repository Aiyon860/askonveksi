"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES } from "@/lib/pagination";

export type MasterItem = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  _count: { customers: number };
};

type MasterDataDraft = Omit<MasterItem, "description"> & {
  description: string;
};

export type MasterAction = (formData: FormData) => Promise<never>;

function createDraft(items: MasterItem[]): MasterDataDraft[] {
  return items.map((item) => ({ ...item, description: item.description ?? "" }));
}

function SortableMasterDataRow({
  item,
  number,
  isEditing,
  singularLabel,
  onChange,
}: {
  item: MasterDataDraft;
  number: number;
  isEditing: boolean;
  singularLabel: string;
  onChange: (id: string, field: "name" | "description", value: string) => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id, disabled: !isEditing });

  return (
    <TableRow
      ref={setNodeRef}
      data-state={isDragging ? "selected" : undefined}
      style={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <TableCell>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Geser urutan ${item.name}`}
              title="Geser urutan"
              style={{ touchAction: "none" }}
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden="true" />
            </Button>
          ) : null}
          <span className="min-w-6 text-center font-mono text-muted-foreground tabular-nums">{number}</span>
        </div>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={item.name}
            required
            minLength={2}
            maxLength={80}
            aria-label={`Nama ${singularLabel.toLowerCase()} urutan ${number}`}
            onChange={(event) => onChange(item.id, "name", event.target.value)}
          />
        ) : (
          <span className="font-medium">{item.name}</span>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        {isEditing ? (
          <Input
            value={item.description}
            maxLength={500}
            aria-label={`Deskripsi ${item.name}`}
            onChange={(event) => onChange(item.id, "description", event.target.value)}
          />
        ) : item.description ? (
          item.description
        ) : (
          <span className="text-muted-foreground">Tidak ada deskripsi</span>
        )}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">{item._count.customers}</TableCell>
    </TableRow>
  );
}

function MasterDataPagination({
  page,
  pageCount,
  pageSize,
  total,
  disabled,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (!total) return null;

  const first = disabled ? 1 : (page - 1) * pageSize + 1;
  const last = disabled ? total : Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-4 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Menampilkan <strong className="font-medium text-foreground">{first}</strong> hingga <strong className="font-medium text-foreground">{last}</strong> dari <strong className="font-medium text-foreground">{total}</strong> data
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor="master-data-page-size" className="whitespace-nowrap text-xs text-muted-foreground">
            Baris per halaman
          </label>
          <NativeSelect
            id="master-data-page-size"
            size="sm"
            value={String(pageSize)}
            disabled={disabled}
            aria-label="Jumlah baris per halaman"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {DATA_PAGE_SIZES.map((option) => (
              <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          Halaman <strong className="font-medium text-foreground">{disabled ? 1 : page}</strong> / <strong className="font-medium text-foreground">{disabled ? 1 : pageCount}</strong>
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={disabled || page <= 1}
                aria-label={page <= 1 ? "Tidak ada halaman sebelumnya" : "Ke halaman sebelumnya"}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={disabled || page >= pageCount}
                aria-label={page >= pageCount ? "Tidak ada halaman berikutnya" : "Ke halaman berikutnya"}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export function MasterDataEditor({
  items,
  singularLabel,
  updateAction,
}: {
  items: MasterItem[];
  singularLabel: string;
  updateAction: MasterAction;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(() => createDraft(items));
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DATA_PAGE_SIZE);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLocaleLowerCase("id"));
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredItems = useMemo(() => {
    if (!debouncedQuery) return draftItems;
    return draftItems.filter((item) => (
      item.name.toLocaleLowerCase("id").includes(debouncedQuery)
      || item.description.toLocaleLowerCase("id").includes(debouncedQuery)
    ));
  }, [debouncedQuery, draftItems]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = isEditing
    ? draftItems
    : filteredItems.slice((page - 1) * pageSize, page * pageSize);

  function startEditing() {
    setDraftItems(createDraft(items));
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftItems(createDraft(items));
    setIsEditing(false);
  }

  function changePageSize(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  function updateDraft(id: string, field: "name" | "description", value: string) {
    setDraftItems((currentItems) => currentItems.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function finishDragging(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraftItems((currentItems) => {
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);
      return oldIndex === -1 || newIndex === -1 ? currentItems : arrayMove(currentItems, oldIndex, newIndex);
    });
  }

  return (
    <form
      action={updateAction}
      onSubmit={(event) => {
        if (!isEditing) event.preventDefault();
      }}
    >
      {isEditing ? (
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(draftItems.map(({ id, name, description }) => ({ id, name, description })))}
        />
      ) : null}
      <section
        className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
        aria-label={`Daftar ${singularLabel.toLowerCase()}`}
      >
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
            <InputGroup data-disabled={isEditing || undefined}>
              <InputGroupInput
                type="search"
                maxLength={80}
                value={query}
                disabled={isEditing}
                placeholder="Cari nama atau deskripsi..."
                aria-label={`Cari ${singularLabel.toLowerCase()}`}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <Search aria-hidden="true" />
              </InputGroupAddon>
            </InputGroup>
            {isEditing ? (
              <p className="text-xs text-muted-foreground">
                Seret handle pada kolom nomor untuk mengatur prioritas. Simpan untuk menerapkan seluruh perubahan.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <p className="mr-1 text-xs text-muted-foreground" aria-live="polite">
              <strong className="font-medium text-foreground">{isEditing ? items.length : filteredItems.length}</strong> {debouncedQuery && !isEditing ? "data ditemukan" : "data tercatat"}
            </p>
            {isEditing ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>Batal</Button>
                <SubmitButton size="sm" pendingLabel="Menyimpan...">Simpan perubahan</SubmitButton>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={startEditing}>Edit</Button>
            )}
          </div>
        </div>

        <div className="flex min-h-112 flex-1 flex-col">
          {visibleItems.length ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={finishDragging}
              accessibility={{
                screenReaderInstructions: {
                  draggable: "Tekan spasi untuk mengambil baris. Gunakan tombol panah atas atau bawah untuk memindahkan, lalu tekan spasi lagi untuk meletakkan.",
                },
              }}
            >
              <Table className="min-w-2xl" containerClassName="min-h-0 flex-1 overflow-auto">
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="hover:bg-muted">
                    <TableHead className="w-24">No</TableHead>
                    <TableHead className="min-w-56">Nama</TableHead>
                    <TableHead className="min-w-80">Deskripsi</TableHead>
                    <TableHead className="w-32 text-center">Jumlah customer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={visibleItems} strategy={verticalListSortingStrategy}>
                    {visibleItems.map((item, index) => (
                      <SortableMasterDataRow
                        key={item.id}
                        item={item}
                        number={isEditing ? index + 1 : (page - 1) * pageSize + index + 1}
                        isEditing={isEditing}
                        singularLabel={singularLabel}
                        onChange={updateDraft}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          ) : (
            <Empty className="min-h-112">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Search aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>{singularLabel} tidak ditemukan</EmptyTitle>
                <EmptyDescription>Coba kata kunci lain atau hapus pencarian.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <MasterDataPagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={isEditing ? items.length : filteredItems.length}
          disabled={isEditing}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      </section>
    </form>
  );
}
