"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  className,
  containerClassName,
  containerProps,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  containerProps?: React.ComponentProps<"div">;
}) {
  return (
    <div
      data-slot="table-container"
      // `max-height` bawaan menjaga tabel panjang tetap dapat digulir sendiri
      // (header beku) bahkan di halaman detail tanpa pembungkus viewport.
      className={cn("relative max-h-[calc(100svh-8rem)] w-full min-w-0 overflow-auto", containerClassName)}
      {...containerProps}
    >
      <table
        data-slot="table"
        // `border-separate` membuat setiap sel memiliki garisnya sendiri, sehingga
        // garis vertikal dan horizontal tetap utuh saat sel/header digulir.
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Header selalu beku di puncak area scroll tabel; latar solid agar baris
      // yang bergeser tidak tembus di belakang nama kolom. `sticky` dipasang di
      // sel header juga karena dukungan `sticky` pada elemen `<thead>` tidak
      // seragam antar browser.
      className={cn("sticky top-0 z-20 bg-muted [&_th]:sticky [&_th]:top-0 [&_th]:bg-muted [&_th]:text-muted-foreground [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        // Footer angka/total ikut beku di dasar area scroll. `sticky` dipasang
        // per sel karena `position: sticky` pada `<tfoot>` diabaikan sebagian
        // browser; latar solid supaya baris data tidak tembus di belakangnya.
        "sticky bottom-0 z-30 border-t bg-muted font-medium [&_tr>*]:sticky [&_tr>*]:bottom-0 [&_tr>*]:z-30 [&_tr>*]:bg-muted [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-highlight-surface has-aria-expanded:bg-highlight-surface data-[state=selected]:bg-highlight-surface",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 border-b border-r border-border px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-r border-border p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
