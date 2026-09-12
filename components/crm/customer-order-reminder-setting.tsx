"use client";

import { useState } from "react";

import { updateCustomerOrderReminderAction } from "@/app/actions/crm";
import { SubmitButton } from "@/components/submit-button";
import { Switch } from "@/components/ui/switch";

export function CustomerOrderReminderSetting({ customerId, version, enabled }: { customerId: string; version: number; enabled: boolean }) {
  const [checked, setChecked] = useState(enabled);
  return (
    <form action={updateCustomerOrderReminderAction} className="flex items-center justify-between gap-4">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="enabled" value={String(checked)} />
      <label htmlFor="order-reminder-enabled" className="text-sm font-medium">Reminder 6 bulanan</label>
      <div className="flex items-center gap-3">
        <Switch id="order-reminder-enabled" checked={checked} onCheckedChange={setChecked} aria-label="Aktifkan reminder order 6 bulanan" />
        <SubmitButton size="sm" variant="outline" pendingLabel="Menyimpan..." disabled={checked === enabled}>Simpan</SubmitButton>
      </div>
    </form>
  );
}
