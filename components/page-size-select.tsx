"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function PageSizeSelect({
  pathname,
  value,
  options,
  params,
  pageSizeParam = "pageSize",
  pageParam = "page",
}: {
  pathname: string;
  value: number;
  options: readonly number[];
  params: Record<string, string | undefined>;
  pageSizeParam?: string;
  pageParam?: string;
}) {
  return (
    <form action={pathname} method="get" className="flex items-center gap-2">
      {Object.entries(params).map(([key, paramValue]) =>
        paramValue && key !== pageSizeParam && key !== pageParam ? <input key={key} type="hidden" name={key} value={paramValue} /> : null,
      )}
      <label htmlFor={pageSizeParam} className="whitespace-nowrap text-xs text-muted-foreground">
        Baris per halaman
      </label>
      <NativeSelect
        id={pageSizeParam}
        name={pageSizeParam}
        size="sm"
        defaultValue={String(value)}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Jumlah baris per halaman"
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </form>
  );
}
