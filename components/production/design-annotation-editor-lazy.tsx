"use client";

import dynamic from "next/dynamic";

import { Card, CardContent } from "@/components/ui/card";

// Editor kanvas hanya dirender di browser (ssr: false): Konva tidak punya
// nilai SSR (tidak ada canvas di server) dan prerender server justru
// memicu "Konva has no node with the type ..." dari react-konva.
export const DesignAnnotationEditor = dynamic(
  () => import("@/components/production/design-annotation-editor").then((m) => m.DesignAnnotationEditor),
  {
    ssr: false,
    loading: () => <Card><CardContent className="p-6 text-sm text-muted-foreground">Memuat kanvas anotasi…</CardContent></Card>,
  },
);
