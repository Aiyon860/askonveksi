import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { whatsappMessagesKey, whatsappMessagesLoading } from "../lib/whatsapp/browser.ts";
import { conversationVisibility } from "../lib/whatsapp/visibility.ts";

const routeSource = await readFile(new URL("../app/api/whatsapp/conversations/[id]/messages/route.ts", import.meta.url), "utf8");
const dataSource = await readFile(new URL("../lib/whatsapp/data.ts", import.meta.url), "utf8");
const inboxSource = await readFile(new URL("../components/whatsapp-inbox.tsx", import.meta.url), "utf8");

test("akses Sales dibatasi ke conversation customer miliknya", () => {
  assert.deepEqual(conversationVisibility({ id: "sales-a", role: "SALES" }), {
    customer: { is: { salesPicId: "sales-a" } },
  });
  assert.deepEqual(conversationVisibility({ id: "owner-a", role: "OWNER" }), {});
  assert.match(routeSource, /if \(!actor\).*status: 401/);
  assert.match(routeSource, /canAccessWhatsAppInbox\(actor\.role\).*status: 403/);
  assert.match(routeSource, /getWhatsAppConversationMessages\(actor, parsed\.data\)/);
});

test("endpoint hanya mengirim field bubble dan melarang cache HTTP", () => {
  assert.match(routeSource, /Cache-Control": "private, no-store"/);
  assert.match(routeSource, /occurredAt: message\.occurredAt\.toISOString\(\)/);
  assert.match(routeSource, /hasMedia: Boolean\(message\.mediaPath\)/);
  assert.doesNotMatch(routeSource, /remoteJid: message|^\s*mediaPath: message|payload: message|authState:/m);
});

test("query mengambil 200 pesan terbaru lalu membaliknya menjadi kronologis", () => {
  const querySource = dataSource.slice(dataSource.indexOf("export async function getWhatsAppConversationMessages"), dataSource.indexOf("export async function getWhatsAppAccounts"));
  assert.match(querySource, /occurredAt: "desc"/);
  assert.match(querySource, /id: "desc"/);
  assert.match(querySource, /take: 200/);
  assert.match(querySource, /messages\.reverse\(\)/);
});

test("cache dan loading dipisahkan berdasarkan conversation", () => {
  assert.notEqual(whatsappMessagesKey("conversation-a"), whatsappMessagesKey("conversation-b"));
  assert.equal(whatsappMessagesKey(null), null);
  assert.equal(whatsappMessagesLoading(undefined, undefined), true);
  assert.equal(whatsappMessagesLoading([{ id: "message-a" }], undefined), false);
  assert.equal(whatsappMessagesLoading(undefined, new Error("gagal")), false);
  assert.match(inboxSource, /keepPreviousData: false/);
  assert.match(inboxSource, /provider: \(\) => cache/);
});
