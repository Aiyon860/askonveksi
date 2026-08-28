"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export function DebouncedSearchInput({
  initialValue,
  pathname,
  params = {},
  placeholder,
  ariaLabel,
  className,
  delay = 300,
  maxLength = 80,
}: {
  initialValue: string;
  pathname: string;
  params?: Record<string, string | undefined>;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  delay?: number;
  maxLength?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const normalizedValue = value.trim().slice(0, maxLength);
    if (normalizedValue === initialValue) return;

    const timeout = window.setTimeout(() => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, paramValue]) => {
        if (paramValue && key !== "page") searchParams.set(key, paramValue);
      });

      if (normalizedValue) searchParams.set("q", normalizedValue);
      else searchParams.delete("q");

      const query = searchParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [delay, initialValue, maxLength, params, pathname, router, value]);

  return (
    <div className={cn("w-full", className)}>
      <InputGroup>
        <InputGroupInput
          type="search"
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(event) => setValue(event.target.value)}
        />
        <InputGroupAddon align="inline-start">
          <Search aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
