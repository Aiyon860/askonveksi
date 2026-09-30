"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ComponentProps } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { caretForDigits, countDigits, formatRupiahInput, parseRupiahInput, removeDigitAt } from "@/lib/money-input-format";

// useLayoutEffect memicu warning saat SSR; pakai useEffect di server dan useLayoutEffect di klien.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type MoneyInputProps = Omit<ComponentProps<"input">, "type">;

/**
 * Input nominal rupiah: menampilkan ribuan id-ID ("1.000.000") saat mengetik,
 * sementara `<input type="hidden">` mengirim nilai mentah ("1000000") ke server.
 * Kontrak `value`/`defaultValue`/`onChange` tetap nilai mentah agar perhitungan
 * klien (mis. "Isi sisa" pada termin) tidak rusak.
 */
export function MoneyInput({
  className,
  name,
  value,
  defaultValue,
  onChange,
  required,
  min,
  max,
  disabled,
  readOnly,
  ...rest
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const [internalValue, setInternalValue] = useState(() => parseRupiahInput(String(defaultValue ?? "")));
  const [, setRevision] = useState(0);
  const controlled = value !== undefined;
  const raw = controlled ? parseRupiahInput(String(value ?? "")) : internalValue;
  const display = formatRupiahInput(raw);

  function applyChange(event: ChangeEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    const text = element.value;
    const caret = element.selectionStart ?? text.length;
    const digitsBefore = countDigits(text.slice(0, caret));
    const nativeEvent = event.nativeEvent as InputEvent;
    const inputType = typeof nativeEvent.inputType === "string" ? nativeEvent.inputType : undefined;
    const looksLikeDeletion = inputType ? inputType.startsWith("delete") : text.length < display.length;
    let nextRaw = parseRupiahInput(text);
    let nextDigits = digitsBefore;

    // Backspace/delete mengenai pemisah "." → jumlah digit tidak berubah, jadi hapus satu digit manual.
    if (looksLikeDeletion && countDigits(text) === countDigits(display)) {
      const forward = inputType === "deleteContentForward";
      const removedIndex = forward ? digitsBefore : digitsBefore - 1;
      nextRaw = removeDigitAt(nextRaw, removedIndex);
      nextDigits = forward ? digitsBefore : digitsBefore - 1;
    }

    caretRef.current = caretForDigits(formatRupiahInput(nextRaw), nextDigits);
    if (!controlled) setInternalValue(nextRaw);
    setRevision((current) => current + 1);
    onChange?.({ target: { value: nextRaw } } as ChangeEvent<HTMLInputElement>);
  }

  useIsomorphicLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;

    // min/max tidak berlaku di type="text", jadi validasi lewat setCustomValidity.
    const minimum = min === undefined || min === "" ? Number.NaN : Number(min);
    const maximum = max === undefined || max === "" ? Number.NaN : Number(max);
    const empty = raw === "";
    const belowMinimum = !empty && Number.isFinite(minimum) && Number(raw) < minimum;
    const aboveMaximum = !empty && Number.isFinite(maximum) && Number(raw) > maximum;
    element.setCustomValidity(empty ? "" : belowMinimum ? `Nilai minimal ${String(min)}.` : aboveMaximum ? `Nilai maksimal ${String(max)}.` : "");

    if (caretRef.current !== null) {
      const caret = Math.min(caretRef.current, element.value.length);
      if (element.value !== display) element.value = display;
      element.setSelectionRange(caret, caret);
      caretRef.current = null;
    }
  });

  return (
    <>
      <InputGroup className={className}>
        <InputGroupAddon align="inline-start">Rp</InputGroupAddon>
        <InputGroupInput
          {...rest}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={display}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          onChange={applyChange}
        />
      </InputGroup>
      <input type="hidden" name={name} value={raw} disabled={disabled} />
    </>
  );
}
