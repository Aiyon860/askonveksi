"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AttendanceLocationView } from "@/lib/attendance/types";

export function AttendancePhotoDialog({
  photoUrl,
  employeeName,
  dateLabel,
  timeLabel,
  location,
}: {
  photoUrl: string;
  employeeName: string;
  dateLabel: string;
  timeLabel: string | null;
  location: AttendanceLocationView | null;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-12 overflow-hidden p-0"
            aria-label={`Lihat foto absensi ${employeeName} ${dateLabel}`}
          />
        }
      >
        <Image
          src={photoUrl}
          alt={`Foto absensi ${employeeName}`}
          width={48}
          height={48}
          unoptimized
          className="size-12 rounded-md border object-cover"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Foto absensi {employeeName}</DialogTitle>
          <DialogDescription>
            {dateLabel}{timeLabel ? ` · ${timeLabel} WIB` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border bg-muted/30">
          <Image
            src={photoUrl}
            alt={`Foto absensi ${employeeName} ukuran penuh`}
            width={960}
            height={1280}
            unoptimized
            className="max-h-[70svh] w-full object-contain"
          />
        </div>
        {location ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              {location.accuracyMeters !== null ? ` · ±${location.accuracyMeters} m` : ""}
            </span>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={location.mapUrl} target="_blank" rel="noreferrer noopener" />}
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              Buka peta
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Lokasi tidak tersedia saat absen.</p>
        )}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceLocationDialog({
  employeeName,
  dateLabel,
  location,
}: {
  employeeName: string;
  dateLabel: string;
  location: AttendanceLocationView | null;
}) {
  if (!location) {
    return <span className="text-sm text-muted-foreground">Tidak tersedia</span>;
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="link" size="sm" className="h-auto p-0 text-left" />}
      >
        <MapPin data-icon="inline-start" aria-hidden="true" />
        Lihat lokasi
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lokasi absensi {employeeName}</DialogTitle>
          <DialogDescription>{dateLabel}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Koordinat</dt>
            <dd className="font-medium tabular-nums">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Akurasi</dt>
            <dd className="font-medium">{location.accuracyMeters !== null ? `±${location.accuracyMeters} m` : "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Dicatat</dt>
            <dd className="font-medium">{location.recordedAt ?? "-"}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Lokasi hanya bukti pendukung. Tidak ada validasi radius kantor.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={location.mapUrl} target="_blank" rel="noreferrer noopener" />}
          >
            <ExternalLink data-icon="inline-start" aria-hidden="true" />
            Buka Google Maps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
