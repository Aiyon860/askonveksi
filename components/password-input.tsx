"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export function PasswordInput({ disabled, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = isVisible ? "Sembunyikan password" : "Tampilkan password";

  return (
    <InputGroup className="overflow-hidden bg-background" data-disabled={disabled || undefined}>
      <InputGroupInput className="pr-10" {...props} disabled={disabled} type={isVisible ? "text" : "password"} />
      <InputGroupAddon align="inline-end" className="absolute inset-y-0 right-0">
        <InputGroupButton
          type="button"
          size="icon-xs"
          disabled={disabled}
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          title={toggleLabel}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
