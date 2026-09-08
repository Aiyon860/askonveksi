"use client";

import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function FinanceError() {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Keuangan tidak dapat dimuat</AlertTitle>
      <AlertDescription>Muat ulang halaman atau masuk dengan akun Owner/Admin.</AlertDescription>
    </Alert>
  );
}
