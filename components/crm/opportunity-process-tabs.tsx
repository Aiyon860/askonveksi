"use client";

import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OpportunityDetailTab } from "@/lib/crm/constants";

const TAB_LABELS: Array<[OpportunityDetailTab, string]> = [
  ["peluang", "Peluang"],
  ["po", "PO"],
  ["invoice", "Invoice"],
  ["deal", "Deal"],
  ["aktivitas", "Aktivitas"],
];

export function OpportunityProcessTabs({
  initialTab,
  status,
  children,
}: {
  initialTab: OpportunityDetailTab;
  status: Partial<Record<OpportunityDetailTab, string>>;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<OpportunityDetailTab>(initialTab);

  function selectTab(value: unknown) {
    if (typeof value !== "string" || !TAB_LABELS.some(([tab]) => tab === value)) return;
    const tab = value as OpportunityDetailTab;
    setActiveTab(tab);

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (tab !== "aktivitas") url.searchParams.delete("historyPage");
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={selectTab}>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <TabsList activateOnFocus className="min-w-max">
          {TAB_LABELS.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              <span>{label}</span>
              {status[value] ? <span className="hidden text-xs font-normal text-muted-foreground md:inline">{status[value]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

export function OpportunityProcessPanel({ value, children }: { value: OpportunityDetailTab; children: ReactNode }) {
  return <TabsContent value={value} keepMounted className="mt-6">{children}</TabsContent>;
}
