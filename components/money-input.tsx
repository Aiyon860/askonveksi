import type { ComponentProps } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function MoneyInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon align="inline-start">Rp</InputGroupAddon>
      <InputGroupInput type="number" inputMode="decimal" {...props} />
    </InputGroup>
  );
}
