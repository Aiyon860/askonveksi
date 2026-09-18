"use client";

import { useState, useTransition } from "react";

import { toggleCampaignAction } from "@/app/actions/campaigns";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

type CampaignEnabledSwitchProps = {
  campaignId: string;
  version: number;
  status: "SCHEDULED" | "PROCESSING" | "PAUSED" | "SKIPPED" | "COMPLETED" | "CANCELLED";
};

export function CampaignEnabledSwitch({ campaignId, version, status }: CampaignEnabledSwitchProps) {
  const enabled = status === "SCHEDULED" || status === "PROCESSING";
  const canToggle = enabled || status === "PAUSED";
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function onCheckedChange(next: boolean) {
    if (pending || !canToggle) return;
    setChecked(next);
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("version", String(version));
    formData.set("enabled", String(next));
    startTransition(async () => {
      await toggleCampaignAction(formData);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {pending ? <Spinner className="text-muted-foreground" data-icon="inline-start" /> : null}
      <Switch checked={checked} disabled={!canToggle || pending} onCheckedChange={onCheckedChange} aria-label={enabled ? "Jeda campaign" : "Aktifkan campaign"} />
    </div>
  );
}
