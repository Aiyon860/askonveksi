"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Clock, GripVertical, UserRound } from "lucide-react";
import type { ProductionStage } from "@prisma/client";

import { moveProductionOptimisticAction, updateProductionObstacleAction } from "@/app/actions/production";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import type { getProductionBoard } from "@/lib/production/data";
import {
  boardColumnLabel,
  boardStagesForGroup,
  nextProductionStage,
  PRODUCTION_BOARD_GROUP_LABEL,
  RETUR_COLUMN,
  stageLabelForGroup,
  type ProductionBoardColumn,
  type ProductionBoardGroup,
} from "@/lib/production/workflow";
import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/production/stage-theme";
import { cn } from "@/lib/utils";

type BoardItem = Awaited<ReturnType<typeof getProductionBoard>>["items"][number];
type PendingMove = { item: BoardItem; targetStage: ProductionStage; decision: "ADVANCE" | "SKIP" | "SAMPLE_REJECT" | "TO_RETUR" | "RELEASE_RETUR" | "REVERT" };
type RecentMove = { id: string; stage: ProductionBoardColumn };

const DROP_ANIMATION = { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
// Dipakai ulang tiap render kartu dan tiap polling 60 detik.
const DATE_FORMAT = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

function stageOptions(item: BoardItem, canReturCompleted: boolean) {
  // Mundur langsung ke tahap tujuan (alasan wajib, tanpa parkir Retur);
  // maju/lewati/lingkaran sampel seperti semula. Drop ke kolom Retur tetap TO_RETUR.
  if (item.status === "COMPLETED") {
    return canReturCompleted
      ? item.stageSequence.filter((stage) => stage !== "SELESAI").map((targetStage) => ({ item, targetStage, decision: "TO_RETUR" as const }))
      : [];
  }
  const currentIndex = item.stageSequence.indexOf(item.currentStage);
  const next = nextProductionStage(item.stageSequence, item.currentStage);
  const options: PendingMove[] = next ? [{ item, targetStage: next, decision: "ADVANCE" }] : [];
  // Lompat tahap: Non-Jersey bebas; Jersey hanya kartu ber-badge Retur atau Wajib QC
  // (kartu biasa tetap maju satu persatu). Batas Wajib QC difilter di bawah.
  const canSkip = item.route === "NON_JERSEY" || Boolean(item.qcReverted) || Boolean(item.repairReason);
  if (canSkip && next) {
    const nextIndex = item.stageSequence.indexOf(next);
    options.push(...item.stageSequence.slice(nextIndex + 1).map((targetStage) => ({ item, targetStage, decision: "SKIP" as const })));
  }
  if (item.currentStage === "PERSETUJUAN_SAMPEL") options.push({ item, targetStage: "TEST_PRINT", decision: "SAMPLE_REJECT" });
  options.push(...item.stageSequence.slice(0, Math.max(0, currentIndex)).map((targetStage) => ({ item, targetStage, decision: "TO_RETUR" as const })));
  // Gerbang QC: kartu berperingatan "Wajib QC" hanya boleh mendarat di QC atau sebelumnya.
  const qcIndex = item.stageSequence.indexOf("QC");
  if (item.qcReverted && qcIndex >= 0) {
    return options.filter((option) => item.stageSequence.indexOf(option.targetStage) <= qcIndex);
  }
  return options;
}

function revertOption(option: PendingMove): PendingMove {
  // Seret mundur = pindah langsung ke tahap tujuan dengan alasan, tanpa parkir Retur.
  // Drop langsung ke kolom Retur tetap memakai TO_RETUR (parkir + alasan wajib).
  return option.decision === "TO_RETUR" ? { ...option, decision: "REVERT" } : option;
}

/** Kartu sedang berparkir di kolom Retur sampai Admin menyeretnya keluar. */
function isReturParked(item: BoardItem) {
  return item.status === "ACTIVE" && item.needsRepair;
}

/**
 * Kartu membawa pil Retur (badge merah, belum Selesai) atau Wajib QC —
 * selalu diurutkan paling atas di kolom tahapnya.
 */
function isHighlightedCard(item: BoardItem) {
  return Boolean(item.qcReverted) || (Boolean(item.repairReason) && item.currentStage !== "SELESAI");
}

/**
 * Kolom kartu: mengikuti pratinjau dialog, dikunci di kolom tujuan selama
 * penyimpanan (data segar yang mendarat di tengah save tidak boleh
 * mengembalikan kartu ke kolom lama), lalu parkir di Retur / kolom tahapnya.
 */
function itemColumn(item: BoardItem, preview: PendingMove | null, saving: RecentMove | null): ProductionBoardColumn {
  if (preview?.item.id === item.id) return preview.decision === "TO_RETUR" ? RETUR_COLUMN : preview.targetStage;
  if (saving?.id === item.id) return saving.stage;
  return isReturParked(item) ? RETUR_COLUMN : item.currentStage;
}

function moveTitle(move: PendingMove, group: ProductionBoardGroup) {
  if (move.decision === "TO_RETUR") return "Masuk Retur";
  if (move.decision === "REVERT") return `Mundur ke ${stageLabelForGroup(move.targetStage, group)}`;
  if (move.decision === "RELEASE_RETUR") return "Keluar dari Retur";
  return "Perbarui tahap produksi";
}

export function ProductionBoard({ group, items, canManage, onRefresh }: { group: ProductionBoardGroup; items: BoardItem[]; canManage: boolean; onRefresh?: () => Promise<unknown> }) {
  // Satu sumber kebenaran dari server: hanya tim Produksi (DEVELOPER/OWNER/ADMIN_PO) yang boleh
  // mengubah papan — memindahkan tahap, mengedit kendala, dan menarik kartu Selesai ke Retur.
  const canReturCompleted = canManage;
  const router = useRouter();
  const [boardItems, moveOptimistically] = useOptimistic(items, (current, move: { id: string; targetStage: ProductionStage; needsRepair?: boolean; repairReason?: string; qcReverted?: boolean; obstacle?: string | null; obstacleUpdatedAt?: string | null }) => current.map((item) => item.id === move.id ? {
    ...item,
    currentStage: move.targetStage,
    ...(move.needsRepair !== undefined ? { needsRepair: move.needsRepair } : {}),
    ...(move.repairReason !== undefined ? { repairReason: move.repairReason } : {}),
    ...(move.qcReverted !== undefined ? { qcReverted: move.qcReverted } : {}),
    ...(move.obstacle !== undefined ? { obstacle: move.obstacle } : {}),
    ...(move.obstacleUpdatedAt !== undefined ? { obstacleUpdatedAt: move.obstacleUpdatedAt } : {}),
  } : item));
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [previewMove, setPreviewMove] = useState<PendingMove | null>(null);
  // Kunci kolom selama save: optimistis `useOptimistic` gugur saat data
  // mendarat di tengah transisi yang lambat (polling SWR, atau revalidasi yang
  // ter-dedupe ke request lama hingga membawa data basi). Kunci hanya dilepas
  // saat data yang masuk sudah mencerminkan hasil save.
  const [savingMove, setSavingMove] = useState<RecentMove | null>(null);
  // Kunci dianggap lepas saat data yang masuk sudah mencerminkan hasil save
  // (dihitung saat render agar tak perlu setState sinkron di dalam effect).
  const savingSettled = (() => {
    if (!savingMove) return true;
    const current = items.find((item) => item.id === savingMove.id);
    if (!current) return true;
    return savingMove.stage === RETUR_COLUMN
      ? current.needsRepair === true
      : current.needsRepair === false && current.currentStage === savingMove.stage;
  })();
  const activeSavingMove = savingSettled ? null : savingMove;
  useEffect(() => {
    if (!savingMove) return;
    // Pengaman: bila data tak kunjung mengonfirmasi (mis. fetch gagal terus),
    // lepas kunci agar kartu tidak terjebak di kolom tujuan.
    const timeout = window.setTimeout(() => setSavingMove(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [savingMove]);
  // DEBUG sementara: lacak kunci kolom vs data yang masuk saat saving.
  useEffect(() => {
    if (!savingMove) return;
    const current = items.find((item) => item.id === savingMove.id);
    console.log("[board-save] data masuk saat kunci aktif", {
      t: Date.now(),
      id: savingMove.id.slice(0, 8),
      serverNeedsRepair: current?.needsRepair ?? null,
      serverStage: current?.currentStage ?? null,
      lockStage: savingMove.stage,
      settled: savingSettled,
      shownColumn: current ? itemColumn(current, previewMove, activeSavingMove) : null,
    });
  }, [items, savingMove, savingSettled, activeSavingMove, previewMove]);
  // Drop ke kolom Retur pasti masuk Retur: dialog langsung isi alasan.
  const [isMoving, startMoving] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recentMove, setRecentMove] = useState<RecentMove | null>(null);
  // Petunjuk gulir horizontal pada kanban: panah muncul hanya saat masih ada
  // kolom di arah tersebut.
  const boardRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const reducedMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  // G1: kolom ikut sequence grup (Aksesori 5 stage) + stage legacy kartu lama + kolom Retur.
  const columns = boardStagesForGroup(group, boardItems.map((item) => item.currentStage));
  const activeItem = activeId ? boardItems.find((item) => item.id === activeId) ?? null : null;

  useEffect(() => {
    if (!recentMove) return;
    const timeout = window.setTimeout(() => setRecentMove(null), 240);
    return () => window.clearTimeout(timeout);
  }, [recentMove]);

  useEffect(() => {
    const element = boardRef.current;
    if (!element) return;
    const update = () => {
      const maxScroll = element.scrollWidth - element.clientWidth;
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(element.scrollLeft < maxScroll - 4);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollBoard(direction: -1 | 1) {
    const element = boardRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(320, element.clientWidth * 0.8), behavior: "smooth" });
  }

  function runMove(item: BoardItem, move: PendingMove, note?: string) {
    const formData = new FormData();
    formData.set("workOrderId", item.id);
    formData.set("version", String(item.version));
    formData.set("targetStage", move.targetStage);
    formData.set("decision", move.decision);
    if (note && note.trim()) formData.set("note", note.trim());
    // Kunci kolom dipasang sebagai update URGENT sinkron (di luar transisi):
    // update di dalam callback async startTransition terbukti bisa tidak pernah
    // ter-commit (terlihat di log: lockStage macet di nilai save sebelumnya),
    // sehingga kartu jatuh ke kolom awal selama saving.
    const lockStage = move.decision === "TO_RETUR" ? RETUR_COLUMN : move.targetStage;
    console.log("[board-save] mulai", { t: Date.now(), id: item.id.slice(0, 8), decision: move.decision, targetStage: move.targetStage });
    setRecentMove({ id: item.id, stage: lockStage });
    setSavingMove({ id: item.id, stage: lockStage });
    startMoving(async () => {
      moveOptimistically({
        id: item.id,
        targetStage: move.targetStage,
        // Masuk Retur langsung parkir di kolom Retur; keluar Retur/melewati
        // proses melepas kartu dari kolom Retur. Badge Retur tetap menempel.
        needsRepair: move.decision === "TO_RETUR" ? true : item.needsRepair ? false : undefined,
        repairReason: move.decision === "TO_RETUR" ? note?.trim() : undefined,
        // Peringatan Wajib QC: menyala saat REVERT dari kolom QC, lepas saat mendarat di QC.
        qcReverted: move.targetStage === "QC" ? false : move.decision === "REVERT" && item.currentStage === "QC" ? true : undefined,
        // Alasan Mundur langsung menimpa Text Area Kendala kartu (tanggal jejak ikut terisi).
        obstacle: move.decision === "REVERT" ? note?.trim().slice(0, 2000) ?? null : undefined,
        obstacleUpdatedAt: move.decision === "REVERT" ? new Date().toISOString() : undefined,
      });
      setPreviewMove(null);
      const result = await moveProductionOptimisticAction(formData);
      console.log("[board-save] aksi selesai", { t: Date.now(), id: item.id.slice(0, 8), ok: result.ok });
      if (!result.ok) {
        setRecentMove(null);
        setSavingMove(null);
        toast.add({ title: "Progres tidak berubah", description: result.message, type: "error" });
        return;
      }
      const description = move.decision === "RELEASE_RETUR"
        ? `${item.workOrderNo} keluar dari kolom Retur, kembali ke ${stageLabelForGroup(move.targetStage, group)}.`
        : move.decision === "TO_RETUR"
          ? `${item.workOrderNo} masuk Retur dan parkir di kolom Retur (kembali ke ${stageLabelForGroup(move.targetStage, group)}).`
          : move.decision === "REVERT"
            ? `${item.workOrderNo} mundur ke ${stageLabelForGroup(move.targetStage, group)}; alasan disimpan ke Kendala.`
            : `${item.workOrderNo} dipindahkan ke ${stageLabelForGroup(move.targetStage, group)}.`;
      toast.add({ title: "Progres disimpan", description, type: "success" });
      // Tunggu data server terbaru dulu supaya kartu tidak kembali ke kolom lama
      // sebelum refresh selesai (transisi tetap pending selama menunggu).
      // Kunci kolom TIDAK dilepas di sini: dilepas oleh effect saat data yang
      // masuk sudah mencerminkan hasil save (aman dari data basi ter-dedupe).
      await onRefresh?.();
      console.log("[board-save] revalidasi SWR selesai", { t: Date.now(), id: item.id.slice(0, 8) });
      router.refresh();
    });
  }

  function handleDragStart(event: DragStartEvent) {
    if (!canManage) return;
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canManage) return;
    setActiveId(null);
    if (!event.over) return;
    const item = boardItems.find((candidate) => candidate.id === event.active.id);
    if (!item) return;
    // Kolom Retur: tujuan drop untuk masuk Retur (alasan wajib di dialog).
    if (event.over.id === RETUR_COLUMN) {
      // Kartu yang sudah parkir tidak perlu diparkir ulang; seret ke kolom tahap untuk keluar.
      if (isReturParked(item)) return;
      const returOptions = stageOptions(item, canReturCompleted).filter((option) => option.decision === "TO_RETUR");
      if (!returOptions.length) return;
      const fallback = returOptions[returOptions.length - 1];
      setPreviewMove(fallback);
      setPendingMove(fallback);
      return;
    }
    const targetStage = event.over.id as ProductionStage;
    // Keluar dari Retur: drop ke kolom tahapnya sendiri, langsung tanpa dialog.
    if (isReturParked(item) && targetStage === item.currentStage) {
      runMove(item, { item, targetStage, decision: "RELEASE_RETUR" });
      return;
    }
    const options = stageOptions(item, canReturCompleted);
    const forward = options.find((option) => option.targetStage === targetStage && (option.decision === "ADVANCE" || option.decision === "SKIP"));
    if (forward) {
      runMove(item, forward);
      return;
    }
    const backward = options.find((option) => option.targetStage === targetStage);
    if (backward) {
      // Mundur langsung: isi alasan lalu pindah ke tujuan tanpa lewat Retur.
      const direct = revertOption(backward);
      setPreviewMove(direct);
      setPendingMove(direct);
    }
  }

  function closeMoveDialog() {
    setPendingMove(null);
    setPreviewMove(null);
  }

  function confirmMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove) return;
    // Tujuan sudah pasti dari kolom drop; dialog hanya meminta alasan.
    const formData = new FormData(event.currentTarget);
    const note = String(formData.get("note") ?? "");
    const move: PendingMove = { ...pendingMove };
    closeMoveDialog();
    runMove(move.item, move, note);
  }

  return (
    <>
      <div className="relative">
        {isMoving ? <div className="fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm animate-in fade-in-0 slide-in-from-top-2 items-center gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg" role="status"><Spinner /> Menyimpan progres...</div> : null}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable: "Tekan spasi untuk mengambil kartu. Gunakan tombol panah untuk memilih tahap tujuan, lalu tekan spasi lagi untuk meletakkan." } }}
        >
        {/* Saat drag, scroll-snap dimatikan: snap selalu menarik posisi scroll kembali
            dan melawan auto-scroll dnd-kit, sehingga board tidak maju dan tampak berkedip. */}
        <div ref={boardRef} className={cn("grid auto-cols-[20rem] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3", !activeItem && "snap-x snap-proximity")} aria-label={`Kanban produksi ${PRODUCTION_BOARD_GROUP_LABEL[group]}`}>
          {columns.map((stage) => {
            const isReturColumn = stage === RETUR_COLUMN;
            // Kolom Retur adalah rumah kartu Retur sampai Admin menyeretnya keluar;
            // kolom tahap hanya menampilkan kartu yang tidak parkir di Retur.
            // Kolom Retur dibiarkan urutan server (terbaru di atas — semua kartunya
            // memegang pil Retur); kolom tahap: kartu merah (Retur/Wajib QC) di atas
            // kartu polos, urutan asli di dalam kelompok dijaga oleh sort stabil.
            const stageItems = boardItems.filter((item) => itemColumn(item, previewMove, activeSavingMove) === stage);
            if (!isReturColumn) stageItems.sort((a, b) => Number(isHighlightedCard(b)) - Number(isHighlightedCard(a)));
            return (
              <ProductionStageColumn
                key={stage}
                stage={stage}
                dragging={Boolean(activeItem)}
                canDrop={Boolean(canManage && activeItem && (isReturColumn
                  ? !isReturParked(activeItem) && stageOptions(activeItem, canReturCompleted).some((option) => option.decision === "TO_RETUR")
                  : stageOptions(activeItem, canReturCompleted).some((option) => option.targetStage === stage) || (isReturParked(activeItem) && activeItem.currentStage === stage)))}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2">
                  <h2 id={`production-stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{boardColumnLabel(stage, group)}</h2>
                  <span key={stageItems.length} className="animate-in fade-in-0 duration-150 font-mono text-xs tabular-nums text-muted-foreground">{stageItems.length}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                  <div className="flex flex-col gap-2">
                  {stageItems.length ? stageItems.map((item) => {
                    const options = stageOptions(item, canReturCompleted);
                    const draggable = canManage && !isMoving && !previewMove && (item.status === "ACTIVE" || (item.status === "COMPLETED" && canReturCompleted)) && options.length > 0;
                    const overdue = item.status === "ACTIVE" && new Date(item.deadline).getTime() < new Date().setHours(0, 0, 0, 0);
                    return (
                      <DraggableProductionCard
                        key={item.id}
                        item={item}
                        draggable={draggable}
                        entering={recentMove?.id === item.id && recentMove.stage === stage}
                        previewing={previewMove?.item.id === item.id}
                        savingLocked={savingMove?.id === item.id}
                      >
                        {(drag) => <ProductionCardView
                          item={item}
                          overdue={overdue}
                          canManage={canManage}
                          draggable={drag.draggable}
                          dragHandle={drag.draggable ? (
                            // Area geser selebar kartu; tinggi sekitar seperempat
                            // kartu agar jauh lebih mudah dibidik daripada ikon kecil.
                            <div
                              ref={drag.setActivatorNodeRef}
                              {...drag.attributes}
                              {...drag.listeners}
                              aria-label={`Geser kartu ${item.workOrderNo}`}
                              className="mt-1 flex min-h-14 touch-none cursor-grab select-none items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
                            >
                              <GripVertical aria-hidden="true" className="size-4" />
                              Geser kartu
                            </div>
                          ) : null}
                        />}</DraggableProductionCard>
                    );
                  }) : isReturColumn ? (
                    <Empty className="min-h-32 p-4"><EmptyHeader><EmptyTitle className="text-sm">Belum ada retur</EmptyTitle><EmptyDescription>Seret kartu ke sini untuk masuk Retur. Semua Work Order retur berkumpul di kolom ini sampai dipindahkan.</EmptyDescription></EmptyHeader></Empty>
                  ) : (
                    <Empty className="min-h-32 p-4"><EmptyHeader><EmptyTitle className="text-sm">Belum ada pekerjaan</EmptyTitle><EmptyDescription>Work Order pada tahap ini akan muncul di sini.</EmptyDescription></EmptyHeader></Empty>
                  )}
                  </div>
                </div>
              </ProductionStageColumn>
            );
          })}
        </div>
        {canScrollLeft || canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between">
            {canScrollLeft ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Geser kanban ke kiri"
                onClick={() => scrollBoard(-1)}
                className="pointer-events-auto -ml-2 rounded-full border bg-background/60 opacity-80 shadow-md backdrop-blur-sm hover:bg-background/90 hover:opacity-100"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            ) : <span aria-hidden="true" />}
            {canScrollRight ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Geser kanban ke kanan"
                onClick={() => scrollBoard(1)}
                className="pointer-events-auto -mr-2 rounded-full border bg-background/60 opacity-80 shadow-md backdrop-blur-sm hover:bg-background/90 hover:opacity-100"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : <span aria-hidden="true" />}
          </div>
        ) : null}
        <DragOverlay dropAnimation={reducedMotion ? null : DROP_ANIMATION}>{activeItem ? <ProductionDragPreview item={activeItem} /> : null}</DragOverlay>
        </DndContext>
      </div>

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => { if (!open) closeMoveDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingMove ? moveTitle(pendingMove, group) : "Perbarui tahap produksi"}</DialogTitle>
            <DialogDescription>{pendingMove ? `${pendingMove.item.workOrderNo} · ${pendingMove.item.productName}${pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT" ? ` · kembali ke ${stageLabelForGroup(pendingMove.targetStage, group)}` : ""}` : "Pilih perubahan tahap."}</DialogDescription>
          </DialogHeader>
          {pendingMove ? (
            <form onSubmit={confirmMove}>
              <input type="hidden" name="workOrderId" value={pendingMove.item.id} />
              <input type="hidden" name="version" value={pendingMove.item.version} />
              <FieldGroup>
                <Field><FieldLabel htmlFor="productionMoveNote">{pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT" ? "Alasan (wajib)" : "Kendala"}</FieldLabel><Textarea id="productionMoveNote" name="note" maxLength={2000} rows={3} required={pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT"} minLength={pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT" ? 3 : undefined} placeholder={pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT" ? "Wajib diisi, mis. Jahitan lengan tidak rata." : "Opsional. Tuliskan kendala bila ada."} /><p className="text-xs text-muted-foreground">{pendingMove.decision === "TO_RETUR" || pendingMove.decision === "REVERT" ? "Alasan wajib minimal 3 karakter." : "Kendala boleh dikosongkan."}</p></Field>
                <Button type="submit" disabled={isMoving}>Simpan progres</Button>
              </FieldGroup>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductionObstacle({ item, canManage }: { item: BoardItem; canManage: boolean }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const obstacleValue = item.obstacle ?? "";
  const obstacleUpdatedAt = item.obstacleUpdatedAt;
  const [value, setValue] = useState(obstacleValue);
  const [syncedObstacle, setSyncedObstacle] = useState(obstacleValue);
  const [pending, startPending] = useTransition();

  if (syncedObstacle !== obstacleValue) {
    setSyncedObstacle(obstacleValue);
    setValue(obstacleValue);
  }

  function save() {
    if (!canManage) return;
    const formData = new FormData();
    formData.set("workOrderId", item.id);
    formData.set("obstacle", value);
    startPending(async () => {
      const result = await updateProductionObstacleAction(formData);
      if (!result.ok) {
        toast.add({ title: "Kendala belum tersimpan", description: result.message, type: "error" });
        return;
      }
      setIsEditing(false);
      toast.add({ title: "Kendala disimpan", description: `${item.workOrderNo} diperbarui.`, type: "success" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium">Kendala</p>
        {obstacleUpdatedAt ? <p className="text-xs text-muted-foreground tabular-nums">{DATE_TIME_FORMAT.format(new Date(obstacleUpdatedAt))}</p> : null}
      </div>
      <Textarea
        value={value}
        readOnly={!canManage || !isEditing}
        rows={2}
        maxLength={2000}
        placeholder={isEditing ? "Tuliskan kendala produksi..." : "Belum ada kendala"}
        aria-label={`Kendala ${item.workOrderNo}`}
        onChange={(event) => setValue(event.currentTarget.value)}
        className={cn("text-xs", (!canManage || !isEditing) && "resize-none bg-muted/40")}
      />
      {!canManage ? (
        <p className="text-xs text-muted-foreground">Hanya dapat dilihat oleh tim Produksi.</p>
      ) : isEditing ? (
        <Button type="button" size="sm" className="w-full" disabled={pending} onClick={save}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? "Menyimpan..." : "Simpan"}</Button>
      ) : (
        <Button type="button" size="sm" variant="outline" className="w-full" disabled={pending} onClick={() => setIsEditing(true)}>{item.obstacle ? "Edit Kendala" : "Tambahkan Kendala"}</Button>
      )}
    </div>
  );
}

function ProductionStageColumn({ stage, dragging, canDrop, children }: { stage: ProductionBoardColumn; dragging: boolean; canDrop: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage, disabled: !canDrop });
  return <section ref={setNodeRef} aria-labelledby={`production-stage-${stage}`} className={cn("flex h-[clamp(24rem,calc(100svh-14rem),44rem)] flex-col overflow-hidden rounded-lg border p-2", !dragging && "snap-start", STAGE_SURFACE_CLASS[stage], isOver && "bg-primary/5 ring-2 ring-primary/20")}>{children}</section>;
}

function ProductionCardView({ item, overdue, canManage, draggable, dragHandle }: { item: BoardItem; overdue: boolean; canManage: boolean; draggable: boolean; dragHandle?: React.ReactNode }) {
  // Badge Retur menempel permanen di kartu; warna merah hanya sampai kartu masuk Selesai.
  const retur = Boolean(item.repairReason);
  const hot = retur && item.currentStage !== "SELESAI";
  // Peringatan Wajib QC: berdiri sendiri dari Retur; merah sampai kartu masuk QC lagi.
  const qcWarn = Boolean(item.qcReverted);
  return <Card size="sm" className={cn(draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default", (hot || qcWarn) && "border-destructive/70 bg-destructive/10")}>
    <CardHeader>
      <CardTitle><Link href={`/produksi/${item.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{item.productName}</Link></CardTitle>
      <CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="font-mono">{item.workOrderNo}</Badge>
        <Badge variant="secondary">{item.quantity} pcs</Badge>
        {retur ? <Badge variant="destructive" className="sticky top-0 z-10 font-bold">Retur</Badge> : null}
        {qcWarn ? <Badge variant="destructive" className="sticky top-0 z-10 font-bold">Wajib QC</Badge> : null}
        {overdue ? <Badge variant="warning">Terlambat</Badge> : null}
        {item.route === "JERSEY" && item.sampleRevision > 1 ? <Badge variant="warning">Revisi sampel {item.sampleRevision}</Badge> : null}
      </div>
      {retur ? <p className={cn("line-clamp-2 text-xs leading-5", hot ? "text-destructive" : "text-muted-foreground")}><AlertTriangle aria-hidden="true" className="mr-1 inline size-3.5" />{item.repairReason}</p> : null}
      <dl className="grid gap-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-3"><dt>Sales Order</dt><dd className="font-mono text-foreground">{item.salesOrder.salesOrderNo}</dd></div>
        <div className="flex items-center justify-between gap-3">
          <dt>Deadline produksi</dt>
          <dd className={cn("flex items-center gap-2", overdue && "font-medium text-destructive")}><CalendarClock aria-hidden="true" className="size-3.5" />{DATE_FORMAT.format(new Date(item.deadline))}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Masuk Pada</dt>
          <dd className="flex items-center gap-2"><Clock aria-hidden="true" className="size-3.5" />{item.stageEnteredAt ? DATE_TIME_FORMAT.format(new Date(item.stageEnteredAt)) : "-"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>PIC</dt>
          <dd className="flex items-center gap-2"><UserRound aria-hidden="true" className="size-3.5" />{item.assignee?.name ?? "Belum ditentukan"}</dd>
        </div>
      </dl>
      <ProductionObstacle item={item} canManage={canManage} />
      {dragHandle}
    </CardContent>
  </Card>;
}

function DraggableProductionCard({ item, draggable, entering, previewing, savingLocked, children }: { item: BoardItem; draggable: boolean; entering: boolean; previewing: boolean; savingLocked?: boolean; children: (drag: Pick<ReturnType<typeof useDraggable>, "attributes" | "listeners" | "setActivatorNodeRef"> & { draggable: boolean }) => React.ReactNode }) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } = useDraggable({ id: item.id, disabled: !draggable });
  // DEBUG sementara: ring biru = kartu sedang dikunci di kolom tujuan selama saving.
  return <div ref={setNodeRef} className={cn(isDragging && "opacity-35", previewing && "opacity-50", entering && "animate-in fade-in-0 slide-in-from-left-2 duration-200", savingLocked && "rounded-xl ring-2 ring-blue-500")}>{children({ attributes, listeners, setActivatorNodeRef, draggable })}</div>;
}

function ProductionDragPreview({ item }: { item: BoardItem }) {
  const retur = Boolean(item.repairReason);
  const hot = retur && item.currentStage !== "SELESAI";
  const qcWarn = Boolean(item.qcReverted);
  return <Card size="sm" className={cn("w-[20rem] scale-[1.02] shadow-lg", (hot || qcWarn) && "border-destructive/70 bg-destructive/10")}><CardHeader><CardTitle>{item.productName}</CardTitle><CardDescription>{item.salesOrder.snapshotCustomerName}</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2"><Badge variant="outline" className="font-mono">{item.workOrderNo}</Badge><Badge variant="secondary">{item.quantity} pcs</Badge>{retur ? <Badge variant="destructive" className="font-bold">Retur</Badge> : null}{qcWarn ? <Badge variant="destructive" className="font-bold">Wajib QC</Badge> : null}</div></CardContent></Card>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
