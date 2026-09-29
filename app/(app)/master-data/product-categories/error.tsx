"use client";

import { MasterDataError } from "@/components/master-data-error";

export default function Error({ reset }: { reset: () => void }) {
  return <MasterDataError reset={reset} />;
}
