"use client";

import { useActionState, useState } from "react";
import { Check, CopyPlus, KeyRound, ShieldAlert, Trash2 } from "lucide-react";

import { createAiTokenAction, revokeAiTokenAction } from "@/app/actions/ai-access";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { initialAiTokenFormState } from "@/lib/ai/form-state";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AiAccessTokenRow = {
  id: string;
  label: string;
  tokenHint: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  expired: boolean;
  callCount: number;
};

export function AiAccessPanel({ tokens }: { tokens: AiAccessTokenRow[] }) {
  const [state, formAction, pending] = useActionState(createAiTokenAction, initialAiTokenFormState);
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!state.token) return;
    try {
      await navigator.clipboard.writeText(state.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ai-token-label" required>
              Nama token
            </FieldLabel>
            <Input
              id="ai-token-label"
              name="label"
              required
              minLength={3}
              maxLength={80}
              placeholder="Misal: ChatGPT Marketing"
              autoComplete="off"
            />
            <FieldDescription>Hanya untuk identifikasi di daftar dan log audit.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ai-token-expiry">Masa berlaku</FieldLabel>
            <NativeSelect id="ai-token-expiry" name="expiresInDays" defaultValue="90" className="w-full sm:w-56">
              <NativeSelectOption value="30">30 hari</NativeSelectOption>
              <NativeSelectOption value="90">90 hari</NativeSelectOption>
              <NativeSelectOption value="365">1 tahun</NativeSelectOption>
              <NativeSelectOption value="never">Tanpa kedaluwarsa</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldGroup>
        <Button type="submit" className="w-fit" disabled={pending}>
          <KeyRound data-icon="inline-start" aria-hidden="true" />
          {pending ? "Membuat..." : "Buat token"}
        </Button>
      </form>

      {state.message ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertTitle>{state.ok ? "Token dibuat" : "Token belum dibuat"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.token ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert aria-hidden="true" className="size-4" />
            Salin sekarang — tidak ditampilkan lagi
          </div>
          <code className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">{state.token}</code>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={copyToken}>
            {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <CopyPlus data-icon="inline-start" aria-hidden="true" />}
            {copied ? "Tersalin" : "Salin token"}
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terakhir dipakai</TableHead>
              <TableHead>Panggilan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  Belum ada token. Buat satu untuk menghubungkan asisten AI.
                </TableCell>
              </TableRow>
            ) : (
              tokens.map((token) => {
                const status = token.revokedAt ? "Dicabut" : token.expired ? "Kedaluwarsa" : "Aktif";
                return (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.label}</TableCell>
                    <TableCell className="font-mono text-xs">{token.tokenHint}••••</TableCell>
                    <TableCell>
                      <span className={status === "Aktif" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                        {status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {token.lastUsedAt ?? "Belum pernah"}
                      {token.expiresAt ? <span className="block text-xs">Berlaku s/d {token.expiresAt}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{token.callCount}</TableCell>
                    <TableCell className="text-right">
                      {token.revokedAt ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <form action={revokeAiTokenAction} className="flex justify-end">
                          <input type="hidden" name="tokenId" value={token.id} />
                          <ConfirmSubmitButton
                            variant="ghost"
                            size="sm"
                            confirmTitle="Cabut token ini?"
                            confirmDescription="Asisten AI yang memakainya akan langsung ditolak. Tindakan ini tidak bisa dibatalkan."
                            confirmLabel="Ya, cabut"
                          >
                            <Trash2 data-icon="inline-start" aria-hidden="true" />
                            Cabut
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
