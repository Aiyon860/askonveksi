"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function PageSizeSelect({
  pathname,
  value,
  options,
  params,
}: {
  pathname: string;
  value: number;
  options: readonly number[];
  params: Record<string, string | undefined>;
}) {
  return (
    <form action={pathname} method="get" className="flex items-center gap-2">
      {Object.entries(params).map(([key, paramValue]) =>
        paramValue ? <input key={key} type="hidden" name={key} value={paramValue} /> : null,
      )}
      <label htmlFor="page-size" className="whitespace-nowrap text-xs text-muted-foreground">
        Baris per halaman
      </label>
      <NativeSelect
        id="page-size"
        name="pageSize"
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
