"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Minus, Plus, Redo2, RotateCcw, Save, Send, Trash2, Type, Undo2, Upload } from "lucide-react";
import { Arrow as KonvaArrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";

import { overwriteProductionDesignAction, resetProductionDesignAction, saveProductionDesignAction, sendProductionDesignAction } from "@/app/actions/production";
import type { AnnotationPoint, DesignAnnotation, DesignArrow, DesignText } from "@/lib/production/design-annotations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const RED = "#dc2626";
const WIDTH = 960;
const HEIGHT = 640;
const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;
const SELECTION_COLOR = "#3b82f6";
// Panah hanya dibuat saat klik ditahan lalu ditarik; klik biasa (tanpa tarikan) tidak membuat apa pun.
const MIN_ARROW_LENGTH = 12;
const copy = (notes: DesignAnnotation[]) => notes.map((note) => ({ ...note }));

type InlineEditor = { id: string; value: string };
type DragKind = "target" | "text" | "arrowStart" | "arrowEnd";

export function DesignAnnotationEditor({ workOrderId, taskId, attachmentId, attachmentName, imageToken, savedAnnotations, readOnly = false }: { workOrderId: string; taskId: string; attachmentId: string; attachmentName: string; imageToken: string; savedAnnotations: DesignAnnotation[]; readOnly?: boolean }) {
  const stage = useRef<Konva.Stage>(null);
  const selectionOutline = useRef<Konva.Rect>(null);
  const calloutNodes = useRef(new Map<string, Konva.Group>());
  const input = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const contextAction = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const notesRef = useRef(copy(savedAnnotations));
  const editorRef = useRef<InlineEditor | null>(null);
  const drawing = useRef<{ startX: number; startY: number } | null>(null);
  const draftRef = useRef<DesignArrow | null>(null);
  const justDrew = useRef(false);
  const pointerButton = useRef<number | null>(null);
  const drag = useRef<{ id: string; kind: DragKind; x: number; y: number; pointerX: number; pointerY: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [notes, setNotes] = useState(() => copy(savedAnnotations));
  const [draft, setDraftState] = useState<DesignArrow | null>(null);
  const [history, setHistory] = useState<DesignAnnotation[][]>([]);
  const [future, setFuture] = useState<DesignAnnotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(22);
  const [zoom, setZoom] = useState(100);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [hasVerticalScroll, setHasVerticalScroll] = useState(false);
  const [editor, setEditorState] = useState<InlineEditor | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [canvasActive, setCanvasActive] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingVersion, startSavingVersion] = useTransition();
  const [isResetting, startResetting] = useTransition();
  const [isSending, startSending] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const isBusy = isSavingVersion || isResetting || isSending || isUploading;
  const src = `/api/desain/${taskId}/attachments/${attachmentId}?inline=1${readOnly ? "" : "&original=1"}&v=${encodeURIComponent(imageToken)}`;
  const scale = zoom / 100;
  const editorId = editor?.id;

  const syncSelectionOutline = useCallback((id = selectedId) => {
    const outline = selectionOutline.current;
    const node = id ? calloutNodes.current.get(id) : undefined;
    const layer = node?.getLayer();
    if (!outline || !node || !layer || editorRef.current?.id === id) {
      outline?.hide();
      outline?.getLayer()?.batchDraw();
      return;
    }
    const childBounds = node.getChildren((child) => child.isVisible()).map((child) => {
      const bounds = child.getClientRect({ relativeTo: layer, skipShadow: true });
      if (child.getClassName() === "Text") bounds.width = Math.min(bounds.width, (child as Konva.Text).getTextWidth());
      return bounds;
    });
    if (!childBounds.length) {
      outline.hide();
      layer.batchDraw();
      return;
    }
    const left = Math.min(...childBounds.map((bounds) => bounds.x));
    const top = Math.min(...childBounds.map((bounds) => bounds.y));
    const bounds = {
      x: left,
      y: top,
      width: Math.max(...childBounds.map((bounds) => bounds.x + bounds.width)) - left,
      height: Math.max(...childBounds.map((bounds) => bounds.y + bounds.height)) - top,
    };
    const padding = 6 / scale;
    outline.setAttrs({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      strokeWidth: 2 / scale,
      visible: true,
    });
    outline.moveToTop();
    layer.batchDraw();
  }, [scale, selectedId]);

  useEffect(() => {
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.onerror = () => setError("Gambar desain tidak dapat dimuat.");
    next.src = src;
  }, [src]);

  // Server adalah sumber kebenaran: mengganti desain menghapus anotasi lama yang
  // menyesuaikan gambar sebelumnya, jadi anotasi lokal ikut disinkronkan.
  useEffect(() => {
    const next = copy(savedAnnotations);
    const previous = notesRef.current;
    if (JSON.stringify(next) === JSON.stringify(previous)) return;
    const sameSet = next.length === previous.length && next.map((note) => note.id).sort().join() === previous.map((note) => note.id).sort().join();
    notesRef.current = next;
    setNotes(next);
    // Riwayat undo hanya dibuang kalau daftar anotasinya berubah, misalnya setelah
    // desain diganti; perubahan teks dari server tetap bisa di-undo.
    if (sameSet) return;
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setContextMenu(null);
  }, [savedAnnotations]);

  useEffect(() => {
    if (editorId) window.requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
  }, [editorId]);

  useEffect(() => {
    if (contextMenu) window.requestAnimationFrame(() => contextAction.current?.focus());
  }, [contextMenu]);

  useEffect(() => {
    syncSelectionOutline();
  }, [editorId, notes, syncSelectionOutline]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      setHasHorizontalScroll(element.scrollWidth > element.clientWidth);
      setHasVerticalScroll(element.scrollHeight > element.clientHeight);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    update();
    return () => observer.disconnect();
  }, [image, zoom]);

  function setEditor(next: InlineEditor | null) {
    editorRef.current = next;
    setEditorState(next);
  }

  function setDraft(next: DesignArrow | null) {
    draftRef.current = next;
    setDraftState(next);
  }

  function change(next: DesignAnnotation[]) {
    const previous = copy(notesRef.current);
    const nextNotes = copy(next);
    setHistory((current) => [...current, previous].slice(-50));
    setFuture([]);
    notesRef.current = nextNotes;
    setNotes(nextNotes);
  }

  function undo() {
    setHistory((current) => {
      const previous = current.at(-1);
      if (!previous) return current;
      setFuture((next) => [copy(notesRef.current), ...next].slice(0, 50));
      const previousNotes = copy(previous);
      notesRef.current = previousNotes;
      setNotes(previousNotes);
      setSelectedId((id) => id && previousNotes.some((note) => note.id === id) ? id : null);
      return current.slice(0, -1);
    });
  }

  function redo() {
    setFuture((current) => {
      const next = current[0];
      if (!next) return current;
      setHistory((previous) => [...previous, copy(notesRef.current)].slice(-50));
      const nextNotes = copy(next);
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      setSelectedId((id) => id && nextNotes.some((note) => note.id === id) ? id : null);
      return current.slice(1);
    });
  }

  function remove(id = selectedId) {
    if (!id) return;
    change(notesRef.current.filter((note) => note.id !== id));
    setSelectedId(null);
    setContextMenu(null);
  }

  function focusCanvas() {
    window.requestAnimationFrame(() => stage.current?.container().focus());
  }

  function point() {
    const position = stage.current?.getPointerPosition();
    return position ? { x: position.x / scale, y: position.y / scale } : null;
  }

  function selectNote(note: DesignAnnotation) {
    setSelectedId(note.id);
    setFontSize(note.fontSize);
  }

  function editNote(note: DesignAnnotation) {
    selectNote(note);
    setContextMenu(null);
    setEditor({ id: note.id, value: note.text });
  }

  function openContextMenu(note: DesignAnnotation, event: { preventDefault(): void; clientX: number; clientY: number }) {
    pointerButton.current = 2;
    event.preventDefault();
    commitInline();
    setCanvasActive(true);
    selectNote(note);
    setContextMenu({ id: note.id, left: Math.min(event.clientX, window.innerWidth - 220), top: Math.min(event.clientY, window.innerHeight - 48) });
  }

  function commitInline() {
    const current = editorRef.current;
    if (!current) return;
    setEditor(null);
    const text = current.value.trim().toUpperCase();
    const original = notesRef.current.find((note) => note.id === current.id);
    if (!original) return focusCanvas();
    // Teks kosong pada anotasi teks berdiri sendiri → anotasi dibuang agar tidak tertinggal tak terlihat.
    if (!text && original.type === "text") {
      change(notesRef.current.filter((note) => note.id !== current.id));
      setSelectedId(null);
      return focusCanvas();
    }
    if (text && original.text !== text) change(notesRef.current.map((note) => note.id === current.id ? { ...note, text } : note));
    focusCanvas();
  }

  function cancelInline() {
    const current = editorRef.current;
    setEditor(null);
    const pending = current ? notesRef.current.find((note) => note.id === current.id) : undefined;
    if (pending?.type === "text" && !pending.text) {
      change(notesRef.current.filter((note) => note.id !== pending.id));
      setSelectedId(null);
    }
    focusCanvas();
  }

  // Teks berdiri sendiri: tanpa garis atau panah penunjuk, bisa digeser bebas di kanvas.
  function addTextNote() {
    if (readOnly || editorRef.current) return;
    if (notesRef.current.length >= 50) {
      setError("Maksimal 50 keterangan dalam satu desain.");
      return;
    }
    setError(null);
    setCanvasActive(true);
    setContextMenu(null);
    const note: DesignText = {
      id: crypto.randomUUID(),
      type: "text",
      textX: Math.max(0, Math.min(WIDTH - 120, imageX + imageWidth / 2 - 60)),
      textY: Math.max(0, Math.min(HEIGHT - 20, imageY + imageHeight / 2)),
      text: "",
      fontSize,
    };
    change([...notesRef.current, note]);
    setSelectedId(note.id);
    setEditor({ id: note.id, value: "" });
  }

  function beginDrag(id: string, kind: DragKind, x: number, y: number) {
    const position = point();
    const note = notesRef.current.find((item) => item.id === id);
    if (note) selectNote(note);
    setContextMenu(null);
    if (position) drag.current = { id, kind, x, y, pointerX: position.x, pointerY: position.y };
  }

  function moveDrag(node: Konva.Node) {
    const current = drag.current;
    const position = point();
    if (!current || !position) return;
    node.position({ x: Math.max(0, Math.min(WIDTH, current.x + position.x - current.pointerX)), y: Math.max(0, Math.min(HEIGHT, current.y + position.y - current.pointerY)) });
    syncSelectionOutline(current.id);
  }

  function endDrag() {
    const current = drag.current;
    const position = point();
    drag.current = null;
    if (!current || !position) return;
    const x = Math.max(0, Math.min(WIDTH, current.x + position.x - current.pointerX));
    const y = Math.max(0, Math.min(HEIGHT, current.y + position.y - current.pointerY));
    change(notesRef.current.map((note) => {
      if (note.id !== current.id) return note;
      if (current.kind === "target" && note.type === "callout") return { ...note, targetX: x, targetY: y };
      if (current.kind === "text") return { ...note, textX: x, textY: y };
      if (note.type === "arrow") {
        const [x1, y1, x2, y2] = note.points;
        return current.kind === "arrowStart"
          ? { ...note, points: [x, y, x2, y2] as AnnotationPoint }
          : { ...note, points: [x1, y1, x, y] as AnnotationPoint };
      }
      return note;
    }));
  }

  function startDrawing() {
    if (readOnly || editorRef.current) return;
    // Klik pada elemen anotasi tidak boleh menimpa (cancelBubble sudah dijaga di masing-masing elemen).
    const position = point();
    if (!position || !isInsideImage(position.x, position.y)) return;
    if (notesRef.current.length >= 50) {
      setError("Maksimal 50 keterangan dalam satu desain.");
      return;
    }
    setError(null);
    setCanvasActive(true);
    setContextMenu(null);
    setSelectedId(null);
    drawing.current = { startX: position.x, startY: position.y };
    setDraft({
      id: crypto.randomUUID(),
      type: "arrow",
      points: [position.x, position.y, position.x, position.y],
      textX: Math.max(0, position.x),
      textY: Math.max(0, position.y - 18),
      text: "",
      fontSize,
    });
  }

  function moveDrawing() {
    const current = draftRef.current;
    if (!current) return;
    const position = point();
    if (!position) return;
    setDraft({ ...current, points: [current.points[0], current.points[1], position.x, position.y] });
  }

  function finishDrawing() {
    const current = draftRef.current;
    const started = drawing.current;
    drawing.current = null;
    setDraft(null);
    if (!current || !started) return;
    const [x1, y1] = current.points;
    const x2 = current.points[2];
    const y2 = current.points[3];
    // Tarikan terlalu pendek (klik biasa) → tidak ada anotasi yang dibuat.
    if (Math.hypot(x2 - x1, y2 - y1) < MIN_ARROW_LENGTH) return;
    const note: DesignArrow = {
      ...current,
      points: [x1, y1, x2, y2],
      textX: Math.max(0, Math.min(WIDTH - 120, (x1 + x2) / 2)),
      textY: Math.max(0, Math.min(HEIGHT - 20, Math.min(y1, y2) - 18)),
    };
    change([...notesRef.current, note]);
    setSelectedId(note.id);
    justDrew.current = true;
    focusCanvas();
  }

  function updateFontSize(value: number) {
    const next = Math.max(12, Math.min(48, value || 22));
    setFontSize(next);
    if (selectedId) change(notesRef.current.map((note) => note.id === selectedId ? { ...note, fontSize: next } : note));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && contextMenu) { setContextMenu(null); return; }
      if (!canvasActive || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) { event.preventDefault(); remove(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const fit = image ? Math.min(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight) : 1;
  const imageWidth = image ? image.naturalWidth * fit : WIDTH;
  const imageHeight = image ? image.naturalHeight * fit : HEIGHT;
  const imageX = (WIDTH - imageWidth) / 2;
  const imageY = (HEIGHT - imageHeight) / 2;
  const isInsideImage = (x: number, y: number) => x >= imageX && x <= imageX + imageWidth && y >= imageY && y <= imageY + imageHeight;
  const activeEditorNote = notes.find((note) => note.id === editor?.id);
  const visibleNotes: DesignAnnotation[] = readOnly ? [] : draft ? [...notes, draft] : notes;

  function save() {
    commitInline();
    const annotations = copy(notesRef.current);
    if (!stage.current || !annotations.length) return setError("Tambahkan minimal satu keterangan.");
    setError(null);
    window.requestAnimationFrame(() => {
      const currentStage = stage.current;
      if (!currentStage) return setError("Gambar desain belum dapat dibuat.");
      const outline = selectionOutline.current;
      const showOutlineAgain = outline?.visible() ?? false;
      outline?.hide();
      const canvas = currentStage.toCanvas({ pixelRatio: 1 / scale });
      if (showOutlineAgain) outline?.show();
      outline?.getLayer()?.batchDraw();
      canvas.toBlob((blob) => {
        if (!blob) return setError("Gambar desain belum dapat dibuat.");
        const formData = new FormData();
        formData.set("workOrderId", workOrderId); formData.set("attachmentId", attachmentId); formData.set("annotations", JSON.stringify(annotations));
        formData.set("design", new File([blob], attachmentName.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }));
        startSavingVersion(async () => { await saveProductionDesignAction(formData); });
      }, "image/png");
    });
  }

  function send() {
    const formData = new FormData();
    formData.set("workOrderId", workOrderId);
    formData.set("attachmentId", attachmentId);
    startSending(async () => { await sendProductionDesignAction(formData); });
  }

  function reset() {
    const formData = new FormData();
    formData.set("workOrderId", workOrderId);
    formData.set("attachmentId", attachmentId);
    startResetting(async () => { await resetProductionDesignAction(formData); });
  }

  function upload() {
    const file = uploadInput.current?.files?.[0];
    if (uploadInput.current) uploadInput.current.value = "";
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("workOrderId", workOrderId);
    formData.set("attachmentId", attachmentId);
    formData.set("design", file);
    startUploading(async () => { await overwriteProductionDesignAction(formData); });
  }

  return <Card>
    <CardHeader><CardTitle>{readOnly ? "Desain final" : "Anotasi"}: {attachmentName}</CardTitle><CardDescription id={`annotation-help-${attachmentId}`}>{readOnly ? "Desain sudah masuk Produksi dan hanya dapat dilihat." : "Klik dan tahan lalu tarik di atas gambar untuk membuat panah (klik biasa tidak membuat apa pun). Seret dua titik ujung untuk mengubah arah panah, klik dua kali elemen untuk memunculkan teksnya lalu seret teks itu untuk melepaskannya dari panah. Tombol Tambah teks membuat keterangan teks tanpa panah yang bisa digeser bebas di kanvas, dan klik kanan menghapus keterangan."}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-4">
      {!readOnly ? <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`font-size-${attachmentId}`}>Ukuran teks<Input id={`font-size-${attachmentId}`} className="w-14" type="number" min={12} max={48} value={fontSize} onChange={(event) => updateFontSize(Number(event.currentTarget.value))} /></label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={undo} disabled={isBusy || !history.length}><Undo2 data-icon="inline-start" />Undo</Button>
          <Button type="button" variant="outline" onClick={redo} disabled={isBusy || !future.length}><Redo2 data-icon="inline-start" />Redo</Button>
          <Button type="button" variant="outline" onClick={addTextNote} disabled={isBusy || !image}><Type data-icon="inline-start" />Tambah teks</Button>
          <Button type="button" variant="outline" onClick={() => uploadInput.current?.click()} disabled={isBusy}>{isUploading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}{isUploading ? "Mengunggah..." : "Upload Desain"}</Button>
          <Button type="button" variant="outline" onClick={reset} disabled={isBusy}>{isResetting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}{isResetting ? "Mereset..." : "Reset perubahan"}</Button>
          <input ref={uploadInput} type="file" accept=".png,.psd,image/png,image/vnd.adobe.photoshop" className="sr-only" aria-label="Pilih file desain pengganti" onChange={upload} />
        </div>
      </div> : null}
      <div className="relative">
        <div ref={viewport} className="h-[70vh] min-h-[28rem] overflow-auto rounded-md border bg-muted/30" onClick={(event) => { if (event.target instanceof Element && event.target.closest("[data-annotation-stage]")) return; setSelectedId(null); setContextMenu(null); }}>
          <div className="flex min-h-[28rem] min-w-full items-center justify-center p-8">
            <div className="relative shrink-0" data-annotation-stage style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
              <Stage ref={stage} width={WIDTH * scale} height={HEIGHT * scale} scaleX={scale} scaleY={scale} tabIndex={readOnly ? -1 : 0} aria-label={readOnly ? "Gambar desain final" : "Kanvas anotasi desain"} aria-describedby={`annotation-help-${attachmentId}`} className={cn("max-w-none bg-white", readOnly ? "cursor-default" : "cursor-crosshair focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")} onMouseDown={readOnly ? undefined : (event) => { pointerButton.current = event.evt.button; if (event.evt.button !== 0) return; if (editorRef.current) { commitInline(); return; } startDrawing(); }} onMouseMove={readOnly ? undefined : moveDrawing} onMouseUp={readOnly ? undefined : finishDrawing} onMouseLeave={readOnly ? undefined : finishDrawing} onClick={readOnly ? undefined : (event) => { if (event.evt.button !== 0 || pointerButton.current !== 0) return; if (justDrew.current) { justDrew.current = false; return; } if (editorRef.current) { commitInline(); return; } if (selectedId) { setSelectedId(null); return; } }} onContextMenu={readOnly ? undefined : (event) => { pointerButton.current = 2; event.evt.preventDefault(); event.cancelBubble = true; }} onBlur={() => setCanvasActive(false)}>
                <Layer>
                  {image ? <KonvaImage image={image} x={imageX} y={imageY} width={imageWidth} height={imageHeight} /> : null}
                  {visibleNotes.map((note) => <Group ref={(node) => { if (node) calloutNodes.current.set(note.id, node); else calloutNodes.current.delete(note.id); }} key={note.id} cursor="pointer" onMouseDown={(event) => { event.cancelBubble = true; pointerButton.current = event.evt.button; }} onClick={(event) => { event.cancelBubble = true; if (event.evt.button !== 0 || pointerButton.current !== 0) return; setCanvasActive(true); setContextMenu(null); if (selectedId === note.id) editNote(note); else selectNote(note); }} onDblClick={readOnly ? undefined : (event) => { event.cancelBubble = true; editNote(note); }} onContextMenu={readOnly ? undefined : (event) => { event.cancelBubble = true; openContextMenu(note, event.evt); }}>
                    {note.type === "callout" ? (
                      <>
                        <Line points={[note.targetX, note.targetY, note.textX - 24, note.targetY, note.textX - 24, note.textY + note.fontSize / 2, note.textX - 8, note.textY + note.fontSize / 2]} stroke={RED} strokeWidth={3} lineJoin="miter" lineCap="square" />
                        <Circle x={note.targetX} y={note.targetY} radius={6} fill={RED} draggable onDragStart={() => beginDrag(note.id, "target", note.targetX, note.targetY)} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />
                        {editor?.id === note.id ? null : <Text x={note.textX} y={note.textY} text={note.text} fill={RED} fontStyle="bold" fontSize={note.fontSize} width={250} wrap="word" draggable onDragStart={() => beginDrag(note.id, "text", note.textX, note.textY)} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />}
                      </>
                    ) : note.type === "text" ? (
                      <>{editor?.id === note.id ? null : <Text x={note.textX} y={note.textY} text={note.text} fill={RED} fontStyle="bold" fontSize={note.fontSize} width={250} wrap="word" draggable onDragStart={() => beginDrag(note.id, "text", note.textX, note.textY)} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />}</>
                    ) : (
                      <>
                        <KonvaArrow points={note.points} stroke={RED} fill={RED} strokeWidth={3} pointerLength={12} pointerWidth={12} lineJoin="miter" hitStrokeWidth={12} />
                        {!readOnly && selectedId === note.id ? (
                          <>
                            <Circle x={note.points[0]} y={note.points[1]} radius={7} fill={SELECTION_COLOR} stroke="#ffffff" strokeWidth={1.5} draggable onDragStart={() => beginDrag(note.id, "arrowStart", note.points[0], note.points[1])} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />
                            <Circle x={note.points[2]} y={note.points[3]} radius={7} fill={SELECTION_COLOR} stroke="#ffffff" strokeWidth={1.5} draggable onDragStart={() => beginDrag(note.id, "arrowEnd", note.points[2], note.points[3])} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />
                          </>
                        ) : null}
                        {editor?.id === note.id || !note.text ? null : <Text x={note.textX} y={note.textY} text={note.text} fill={RED} fontStyle="bold" fontSize={note.fontSize} width={250} wrap="word" draggable onDragStart={() => beginDrag(note.id, "text", note.textX, note.textY)} onDragMove={(event) => moveDrag(event.target)} onDragEnd={endDrag} />}
                      </>
                    )}
                  </Group>)}
                  {!readOnly ? <Rect ref={selectionOutline} visible={false} listening={false} stroke={SELECTION_COLOR} /> : null}
                </Layer>
              </Stage>
              <div aria-hidden="true" className="pointer-events-none absolute border-2 border-foreground/70" style={{ left: imageX * scale, top: imageY * scale, width: imageWidth * scale, height: imageHeight * scale }} />
              {!readOnly && activeEditorNote && editor ? <Input ref={input} value={editor.value} onChange={(event) => setEditor({ ...editor, value: event.currentTarget.value.toUpperCase() })} onBlur={commitInline} onContextMenu={(event) => openContextMenu(activeEditorNote, event)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitInline(); } if (event.key === "Escape") { event.preventDefault(); cancelInline(); } }} maxLength={120} aria-label="Keterangan anotasi" className="absolute border-destructive bg-background font-bold text-destructive shadow-md" style={{ left: activeEditorNote.textX * scale, top: activeEditorNote.textY * scale, width: Math.max(140, 250 * scale), height: Math.max(32, (activeEditorNote.fontSize + 14) * scale), fontSize: Math.max(12, activeEditorNote.fontSize * scale) }} /> : null}
            </div>
          </div>
        </div>
        <div className={cn("absolute flex items-center gap-1.5 rounded-md border bg-background/95 p-1 shadow-sm", hasHorizontalScroll ? "bottom-8" : "bottom-3", hasVerticalScroll ? "right-6" : "right-3")} aria-label="Kontrol zoom">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))} disabled={zoom === MIN_ZOOM} aria-label="Perkecil zoom"><Minus /></Button>
          <output className="min-w-14 text-center text-sm font-medium tabular-nums" aria-live="polite">{zoom}%</output>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))} disabled={zoom === MAX_ZOOM} aria-label="Perbesar zoom"><Plus /></Button>
        </div>
      </div>

      {!readOnly ? <div className="mt-2 flex flex-wrap gap-2"><Button type="button" onClick={save} disabled={isBusy || !image}>{isSavingVersion ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}{isSavingVersion ? "Menyimpan..." : "Simpan versi"}</Button><Button type="button" variant="secondary" onClick={() => setConfirming(true)} disabled={isBusy || !savedAnnotations.length}><Send data-icon="inline-start" />Masukkan ke Produksi</Button></div> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </CardContent>
    {!readOnly && contextMenu ? <button ref={contextAction} type="button" role="menuitem" className="fixed z-50 flex h-9 items-center gap-1.5 rounded-md border border-border bg-popover px-2.5 text-sm font-medium text-destructive shadow-md outline-none focus-visible:border-destructive/40 focus-visible:ring-3 focus-visible:ring-destructive/20" style={{ left: contextMenu.left, top: contextMenu.top }} onBlur={() => setContextMenu(null)} onClick={() => remove(contextMenu.id)}><Trash2 />Hapus keterangan</button> : null}
    {!readOnly ? <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Masukkan ke Produksi?</DialogTitle><DialogDescription>Versi desain terakhir akan dikonfirmasi dan Work Order muncul di kanban Produksi.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirming(false)} disabled={isSending}>Batal</Button><Button onClick={send} disabled={isBusy}>{isSending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}{isSending ? "Memasukkan..." : "Konfirmasi masuk Produksi"}</Button></DialogFooter></DialogContent></Dialog> : null}
  </Card>;
}
