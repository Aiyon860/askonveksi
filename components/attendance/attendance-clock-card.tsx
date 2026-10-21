"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, MapPin, RefreshCw, TriangleAlert } from "lucide-react";

import { clockInAction } from "@/app/actions/attendance";
import { AttendanceLocationDialog, AttendancePhotoDialog } from "@/components/attendance/attendance-detail-dialogs";
import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ATTENDANCE_SOURCE_LABEL } from "@/lib/attendance/constants";
import { formatAttendanceDateShort } from "@/lib/attendance/time";
import {
  INITIAL_CLOCK_IN_STATE,
  type AttendanceLocationInput,
  type AttendanceTodayRecordView,
  type ClockInState,
} from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

type CameraLocationStatus = "loading" | "ready" | "unavailable";

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.";
    }
    if (error.name === "NotFoundError") {
      return "Kamera tidak ditemukan. Gunakan perangkat dengan kamera untuk absen.";
    }
    if (error.name === "NotReadableError") {
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    }
  }
  return "Kamera tidak dapat dibuka. Pastikan situs diakses lewat HTTPS dan izin kamera diberikan.";
}

function formatAccuracy(accuracy: number | null) {
  return accuracy !== null ? `±${accuracy} m` : "akurasi tidak tersedia";
}

export function AttendanceClockCard({
  dateLabel,
  timeLabel,
  checkInTime,
  lateToleranceMinutes,
  isWorkday,
  holidayName,
  lateWindow,
  record,
}: {
  dateLabel: string;
  timeLabel: string;
  checkInTime: string;
  lateToleranceMinutes: number;
  isWorkday: boolean;
  holidayName: string | null;
  lateWindow: boolean;
  record: AttendanceTodayRecordView | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function closeDialog() {
    setOpen(false);
    router.refresh();
  }

  if (record) {
    const recordCardClassName = record.status === "HADIR"
      ? "border-success/30"
      : record.status === "TERLAMBAT"
        ? "border-warning/30"
        : "border-border";

    return (
      <Card className={cn("gap-0 overflow-hidden py-0", recordCardClassName)}>
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{dateLabel}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  Jam server {timeLabel} WIB
                </p>
              </div>
              <AttendanceStatusBadge status={record.status} />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Jam masuk</p>
              <div className="mt-1 flex items-end gap-2">
                <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                  {record.checkInTime ?? "—"}
                </p>
                {record.checkInTime ? (
                  <span className="pb-1 text-sm text-muted-foreground">WIB</span>
                ) : null}
              </div>
              <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground text-pretty">
                Absensi hari ini sudah tercatat dan tidak dapat diubah dari halaman ini.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                {record.source === "SELF" ? "Absen mandiri" : `Dicatat ${ATTENDANCE_SOURCE_LABEL[record.source]}`}
              </span>
              {record.corrected ? <span aria-hidden="true">·</span> : null}
              {record.corrected ? <span>Dikoreksi</span> : null}
            </div>

            {record.note ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Keterangan</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{record.note}</p>
              </div>
            ) : null}
          </div>

          <aside
            aria-label="Bukti absensi"
            className="flex flex-col gap-4 border-t bg-muted/20 p-5 sm:p-6 xl:border-l xl:border-t-0"
          >
            <div>
              <h3 className="text-sm font-medium">Bukti absensi</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Bukti yang tersimpan saat absensi dicatat.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
              {record.photoUrl ? (
                <AttendancePhotoDialog
                  photoUrl={record.photoUrl}
                  employeeName="Anda"
                  dateLabel={dateLabel}
                  timeLabel={record.checkInTime}
                  location={record.location}
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-md border border-dashed text-muted-foreground">
                  <Camera className="size-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {record.photoUrl ? "Foto absensi tersimpan" : "Foto tidak tersedia"}
                </p>
                {record.location ? (
                  <AttendanceLocationDialog employeeName="Anda" dateLabel={dateLabel} location={record.location} />
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Lokasi tidak tersedia.</p>
                )}
              </div>
            </div>

            {record.status === "TERLAMBAT" && !record.note ? (
              <p className="text-sm text-muted-foreground">
                Keterangan terlambat akan diisi Owner.
              </p>
            ) : null}

            <p className="mt-auto text-xs text-muted-foreground">
              Lokasi hanya bukti pendukung, bukan validasi radius kantor.
            </p>
          </aside>
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden border-highlight/25 py-0">
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
        <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{dateLabel}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                Jam server {timeLabel} WIB
              </p>
            </div>
            <AttendanceStatusBadge status="BELUM_ABSEN" />
          </div>

          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-balance">
              Belum absen hari ini
            </h2>
            <p
              className={cn(
                "mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground text-pretty",
                lateWindow && "font-medium text-warning-surface-foreground",
              )}
            >
              {lateWindow
                ? "Batas toleransi sudah lewat. Absen sekarang akan tercatat Terlambat."
                : "Ambil foto langsung dari kamera. Tidak ada unggah dari galeri."}
            </p>
          </div>

          {holidayName ? (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Hari ini libur: {holidayName}</AlertTitle>
              <AlertDescription>Absen tetap bisa dilakukan bila Anda masuk kerja.</AlertDescription>
            </Alert>
          ) : !isWorkday ? (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Hari ini bukan hari kerja</AlertTitle>
              <AlertDescription>Absen tetap bisa dilakukan bila Anda masuk kerja.</AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-auto">
            <Button
              size="lg"
              className="h-12 w-full px-5 text-base sm:w-auto"
              onClick={() => setOpen(true)}
            >
              <Camera data-icon="inline-start" aria-hidden="true" />
              Absen sekarang
            </Button>
          </div>
        </div>

        <aside
          aria-label="Ketentuan absensi hari ini"
          className="flex flex-col justify-between gap-5 border-t bg-highlight-surface/30 p-5 sm:p-6 xl:border-l xl:border-t-0"
        >
          <div>
            <h3 className="text-sm font-medium">Ketentuan hari ini</h3>
            <dl className="mt-3 grid gap-0">
              <div className="flex items-start justify-between gap-4 border-b py-3">
                <dt className="text-sm text-muted-foreground">Jam masuk</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums">{checkInTime} WIB</dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b py-3">
                <dt className="text-sm text-muted-foreground">Toleransi</dt>
                <dd className="text-sm font-medium">{lateToleranceMinutes} menit</dd>
              </div>
              <div className="flex items-start justify-between gap-4 pt-3">
                <dt className="text-sm text-muted-foreground">Status hari</dt>
                <dd className="max-w-[16rem] text-right text-sm font-medium">
                  {holidayName ?? (!isWorkday ? "Bukan hari kerja" : "Hari kerja")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-card/70 p-3 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Lokasi dicatat sebagai bukti pendukung. Jika GPS tidak tersedia, absen tetap dapat dikirim.
            </p>
          </div>
        </aside>
      </div>

      {open ? <ClockInDialog onClose={closeDialog} /> : null}
    </Card>
  );
}

function ClockInDialog({ onClose }: { onClose: () => void }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [location, setLocation] = useState<AttendanceLocationInput | null>(null);
  const [locationStatus, setLocationStatus] = useState<CameraLocationStatus>("loading");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cameraSessionRef = useRef(0);

  const [state, formAction, pending] = useActionState<ClockInState, FormData>(
    async (previous, formData) => {
      if (!photo) return { ok: false, message: "Ambil foto terlebih dahulu." };
      formData.set("photo", photo, "absen-kamera.jpg");
      return clockInAction(previous, formData);
    },
    INITIAL_CLOCK_IN_STATE,
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Video unmounts while the preview is shown. Saat retake, stream bisa selesai
  // lebih dulu daripada elemen <video>; callback ref memasang stream yang sudah
  // ada begitu elemen muncul, sehingga preview kamera tidak hitam.
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node || !streamRef.current) return;
    node.srcObject = streamRef.current;
    void node.play().then(
      () => setCameraReady(true),
      () => {
        node.srcObject = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraReady(false);
        setCameraError("Kamera tidak dapat diputar. Coba lagi.");
      },
    );
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    const session = cameraSessionRef.current + 1;
    cameraSessionRef.current = session;
    stopCamera();
    await Promise.resolve();
    if (session !== cameraSessionRef.current) return;
    setCameraError(null);
    setCameraReady(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("MEDIA_DEVICES_UNAVAILABLE");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") throw error;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (session !== cameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch (error) {
          stream.getTracks().forEach((track) => track.stop());
          if (streamRef.current === stream) streamRef.current = null;
          throw error;
        }
        if (session === cameraSessionRef.current) setCameraReady(true);
      }
    } catch (error) {
      if (session === cameraSessionRef.current) setCameraError(cameraErrorMessage(error));
    }
  }, [stopCamera]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cameraSessionRef.current += 1;
      stopCamera();
      revokePreview();
    };
  }, [revokePreview, startCamera, stopCamera]);

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setLocationStatus("unavailable"));
      return;
    }

    let active = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
        });
        setLocationStatus("ready");
      },
      () => {
        if (!active) return;
        setLocation(null);
        setLocationStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );

    return () => {
      active = false;
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Kamera belum siap. Tunggu sebentar lalu coba ambil foto lagi.");
      return;
    }

    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Foto tidak dapat diambil. Coba muat ulang halaman.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Foto tidak dapat diambil. Coba lagi.");
          return;
        }
        revokePreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPhoto(blob);
        setPreviewUrl(url);
        setCameraReady(false);
        stopCamera();
      },
      "image/jpeg",
      0.88,
    );
  }

  function retakePhoto() {
    revokePreview();
    setPhoto(null);
    setPreviewUrl(null);
    void startCamera();
  }

  const success = state.ok && state.status;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton={!pending}
      >
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                Absensi berhasil
              </DialogTitle>
              <DialogDescription>{state.dateKey ? `Tanggal ${formatAttendanceDateShort(state.dateKey)}` : "Absensi tersimpan."}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 rounded-lg border border-success/25 bg-success-surface p-6 text-center">
              <AttendanceStatusBadge status={state.status!} />
              <p className="text-2xl font-semibold tabular-nums">{state.time} WIB</p>
              <p className="text-sm text-success-surface-foreground">{state.message}</p>
              {state.status === "TERLAMBAT" ? (
                <p className="text-sm text-success-surface-foreground">
                  Keterangan terlambat dapat diisi Owner kapan saja.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Selesai</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Ambil foto absensi</DialogTitle>
              <DialogDescription>
                Foto diambil langsung dari kamera. Tidak ada unggah dari galeri.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="grid gap-4">
              <input type="hidden" name="latitude" value={location?.latitude ?? ""} />
              <input type="hidden" name="longitude" value={location?.longitude ?? ""} />
              <input type="hidden" name="accuracyMeters" value={location?.accuracyMeters ?? ""} />

              <div className="relative overflow-hidden rounded-lg border bg-black">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Pratinjau foto absensi"
                    width={720}
                    height={960}
                    unoptimized
                    className="max-h-[52svh] w-full object-contain"
                  />
                ) : (
                  <video
                    ref={attachVideo}
                    aria-label="Pratinjau kamera"
                    autoPlay
                    muted
                    playsInline
                    className="max-h-[52svh] w-full -scale-x-100 object-cover"
                  />
                )}
                {!cameraReady && !previewUrl && !cameraError ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      Menyiapkan kamera...
                    </span>
                  </div>
                ) : null}
              </div>
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              {cameraError ? (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Kamera bermasalah</AlertTitle>
                  <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
              ) : null}

              {state.message && !state.ok ? (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Absensi belum tersimpan</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {locationStatus === "loading"
                    ? "Mengambil lokasi..."
                    : locationStatus === "ready" && location
                      ? `Lokasi tercatat (${formatAccuracy(location.accuracyMeters)}).`
                      : "Lokasi tidak tersedia. Absen tetap dapat dikirim."}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {previewUrl ? (
                  <Button type="button" variant="outline" onClick={retakePhoto} disabled={pending}>
                    <RefreshCw data-icon="inline-start" aria-hidden="true" />
                    Ambil ulang
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={capturePhoto} disabled={!cameraReady || pending}>
                    <Camera data-icon="inline-start" aria-hidden="true" />
                    Ambil foto
                  </Button>
                )}
                {cameraError && !previewUrl ? (
                  <Button type="button" variant="ghost" onClick={() => void startCamera()} disabled={pending}>
                    Coba kamera lagi
                  </Button>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                  Batal
                </Button>
                <Button type="submit" disabled={!photo || pending || state.ok}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {pending ? "Menyimpan..." : "Kirim absensi"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
