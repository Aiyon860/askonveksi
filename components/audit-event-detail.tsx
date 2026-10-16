"use client";

import type { AppRole } from "@prisma/client";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit/labels";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { formatDate } from "@/lib/crm/format";

export type AuditEventDetail = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changedFields: string[];
  metadata: unknown;
  createdAt: Date | string;
  actor: { name: string; email: string; role: AppRole };
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

export function AuditEventDetailDialog({ event }: { event: AuditEventDetail }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Eye data-icon="inline-start" aria-hidden="true" />
        Lihat
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{auditActionLabel(event.action)}</DialogTitle>
          <DialogDescription>
            {auditEntityLabel(event.entityType)} · {formatDate(event.createdAt, true)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <Section title="Pelaku">
            <p className="font-medium">
              {event.actor.name} <span className="font-normal text-muted-foreground">({ROLE_LABEL[event.actor.role]})</span>
            </p>
            <p className="text-xs text-muted-foreground">{event.actor.email}</p>
          </Section>
          <Section title="Field yang berubah">
            {event.changedFields.length ? (
              <div className="flex flex-wrap gap-1.5">
                {event.changedFields.map((field) => (
                  <Badge key={field} variant="outline" className="font-mono text-xs font-normal">
                    {field}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </Section>
          <Section title="Metadata">
            {event.metadata === null || event.metadata === undefined ? (
              <p className="text-muted-foreground">-</p>
            ) : (
              <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{JSON.stringify(event.metadata, null, 2)}</pre>
            )}
          </Section>
          <Section title="Detail teknis">
            <dl className="grid gap-1 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Kode aksi</dt>
                <dd className="font-mono break-all">{event.action}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Tipe entitas</dt>
                <dd className="font-mono break-all">{event.entityType}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">ID entitas</dt>
                <dd className="font-mono break-all">{event.entityId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">ID log</dt>
                <dd className="font-mono break-all">{event.id}</dd>
              </div>
            </dl>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
