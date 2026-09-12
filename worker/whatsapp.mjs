import "dotenv/config";

import makeWASocket, { DisconnectReason, downloadMediaMessage, getContentType, useMultiFileAuthState as loadMultiFileAuthState } from "@whiskeysockets/baileys";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
const lockConnectionString = process.env.DIRECT_URL || connectionString;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
// Advisory locks need a session-stable connection; avoid transaction poolers for this client.
const lockClient = new Client({ connectionString: lockConnectionString });
const authRoot = path.resolve(process.env.WHATSAPP_AUTH_PATH || ".data/baileys-auth");
const workerId = process.env.WHATSAPP_WORKER_ID || `worker-${process.pid}`;
const mediaBucket = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";
const sessions = new Map();
let stopping = false;
let lastTickAt = 0;
let lastAutomationAt = 0;
let ticking = false;

const DEFAULT_INVOICE_ISSUED_TEMPLATE = "Halo {{customer_name}}, invoice {{invoice_no}} dari {{business_name}} sebesar {{invoice_total}} telah diterbitkan. Batas pembayaran: {{invoice_due_date}}. Dokumen invoice terlampir. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_INVOICE_DUE_TEMPLATE = "Halo {{customer_name}}, pengingat pembayaran {{payment_label}} untuk invoice {{invoice_no}} sebesar {{payment_amount}} jatuh tempo pada {{payment_due_date}}. Mohon konfirmasi setelah pembayaran. Terima kasih.";
const DEFAULT_ORDER_REMINDER_TEMPLATE = "Halo {{customer_name}}, sudah enam bulan sejak order terakhir di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.";

const silentLogger = {
  level: "silent",
  child() { return this; },
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
};

const consoleInfo = console.info.bind(console);
const consoleWarn = console.warn.bind(console);
console.info = (...args) => {
  if (args[0] !== "Closing session:" && args[0] !== "Opening session:") consoleInfo(...args);
};
console.warn = (...args) => {
  if (args[0] !== "Session already closed") consoleWarn(...args);
};

function cleanError(error) {
  return error instanceof Error ? error.message.slice(0, 500) : "Kesalahan worker WhatsApp.";
}

function normalizeNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function directJid(value) {
  if (typeof value !== "string") return null;
  const [user, server] = value.split("@");
  if (server === "s.whatsapp.net") {
    const number = normalizeNumber(user);
    return number ? `${number}@s.whatsapp.net` : null;
  }
  return server === "lid" && /^\d+$/.test(user) ? `${user}@lid` : null;
}

function nextSendAt(reference) {
  const jakarta = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
  const parts = [jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate()];
  if (jakarta.getUTCHours() < 9) return new Date(Date.UTC(...parts, 2));
  if (jakarta.getUTCHours() >= 17) return new Date(Date.UTC(parts[0], parts[1], parts[2] + 1, 2));
  return reference;
}

function render(body, values) {
  return body.replace(/{{\s*([a-z_]+)\s*}}/g, (_, name) => values[name] || "").trim();
}

function addSixCalendarMonthsJakarta(value) {
  const local = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 6, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(local.getUTCDate(), lastDay), 2));
}

function messageText(message) {
  const content = message.message || {};
  return content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.documentMessage?.caption || null;
}

async function findCustomer(remoteJid) {
  const number = normalizeNumber(remoteJid.split("@")[0]);
  if (!number) return null;
  // ponytail: linear matching handles existing mixed phone formats; add a normalized DB column when customer volume makes this measurable.
  const customers = await prisma.customer.findMany({
    where: { whatsapp: { not: null }, archivedAt: null },
    select: { id: true, whatsapp: true, salesPicId: true },
  });
  return customers.find((customer) => normalizeNumber(customer.whatsapp) === number) || null;
}

async function directMessageJid(socket, message) {
  const primary = message.key.remoteJid;
  if (primary?.endsWith("@s.whatsapp.net")) return primary;
  if (!primary?.endsWith("@lid")) return null;
  if (message.key.remoteJidAlt?.endsWith("@s.whatsapp.net")) return message.key.remoteJidAlt;
  return await socket.signalRepository.lidMapping.getPNForLID(primary) || primary;
}

async function issuePairingCode(socket, account, delay = 0) {
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const phoneNumber = normalizeNumber(account.phoneNumber);
  if (!phoneNumber) throw new Error("Nomor WhatsApp account tidak valid.");
  const code = await socket.requestPairingCode(phoneNumber);
  await prisma.whatsAppAccount.update({
    where: { id: account.id },
    data: { status: "PAIRING", pairingCode: code, pairingCodeExpiresAt: new Date(Date.now() + 60_000), lastError: null },
  });
}

async function connectAccount(account) {
  if (sessions.has(account.id) || stopping) return;
  const authPath = path.join(authRoot, account.id);
  await mkdir(authPath, { recursive: true });
  const { state, saveCreds } = await loadMultiFileAuthState(authPath);
  const socket = makeWASocket({ auth: state, logger: silentLogger, markOnlineOnConnect: false, syncFullHistory: false });
  sessions.set(account.id, socket);
  socket.ev.on("creds.update", saveCreds);

  if (!state.creds.registered && account.connectRequestedAt) {
    try {
      await issuePairingCode(socket, account, 3_000);
    } catch (error) {
      const detail = cleanError(error);
      console.error(`[whatsapp-worker] pairing ${account.id}: ${detail}`);
      await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { status: "ERROR", lastError: detail } });
    }
  }

  socket.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { status: "CONNECTED", connectedAt: new Date(), pairingCode: null, pairingCodeExpiresAt: null, lastError: null } });
    }
    if (connection === "close") {
      sessions.delete(account.id);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { status: loggedOut ? "LOGGED_OUT" : "DISCONNECTED", ...(loggedOut ? { sendEnabled: false } : {}), disconnectedAt: new Date(), lastError: cleanError(lastDisconnect?.error) } });
      if (!loggedOut && !stopping) setTimeout(() => void reloadAccounts(), 5_000);
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      if (message.key.fromMe || !message.key.remoteJid || !message.key.id || !message.message) continue;
      const remoteJid = await directMessageJid(socket, message);
      if (!remoteJid) continue;
      try {
        await storeInbound(account.id, message, remoteJid);
      } catch (error) {
        console.error(`[whatsapp-worker] inbound ${message.key.id}: ${cleanError(error)}`);
      }
    }
  });

  socket.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      if (!update.key.id) continue;
      const status = Number(update.update.status || 0);
      const data = status >= 4 ? { status: "READ", readAt: new Date(), deliveredAt: new Date() }
        : status >= 3 ? { status: "DELIVERED", deliveredAt: new Date() }
          : status >= 2 ? { status: "SENT", sentAt: new Date() } : null;
      if (data) await prisma.whatsAppMessage.updateMany({ where: { accountId: account.id, whatsappMessageId: update.key.id }, data });
    }
  });
}

async function storeInbound(accountId, message, remoteJid) {
  const customer = await findCustomer(remoteJid);
  const contentType = getContentType(message.message);
  const kind = contentType === "imageMessage" ? "IMAGE" : contentType === "documentMessage" ? "DOCUMENT" : "TEXT";
  let mediaPath = null;
  let mediaMimeType = null;
  let mediaFileName = null;
  let mediaSizeBytes = null;
  if (kind !== "TEXT" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    const buffer = await downloadMediaMessage(message, "buffer", {}, { logger: silentLogger, reuploadRequest: sessions.get(accountId)?.updateMediaMessage });
    if (buffer.length <= 10 * 1024 * 1024) {
      const media = kind === "IMAGE" ? message.message.imageMessage : message.message.documentMessage;
      mediaMimeType = media?.mimetype || "application/octet-stream";
      mediaFileName = media?.fileName || `${message.key.id}.${kind === "IMAGE" ? "jpg" : "bin"}`;
      mediaPath = `${accountId}/${new Date().toISOString().slice(0, 10)}/${message.key.id}`;
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const uploaded = await supabase.storage.from(mediaBucket).upload(mediaPath, buffer, { contentType: mediaMimeType, upsert: false });
      if (uploaded.error) throw uploaded.error;
      mediaSizeBytes = buffer.length;
    }
  }
  const text = messageText(message) || (kind === "TEXT" ? "Pesan tidak didukung." : null);
  const occurredAt = new Date(Number(message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000);
  await prisma.$transaction(async (tx) => {
    const conversation = await tx.whatsAppConversation.upsert({
      where: { accountId_remoteJid: { accountId, remoteJid } },
      create: { accountId, remoteJid, customerId: customer?.id, unreadCount: 1, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
      update: { customerId: customer?.id || undefined, unreadCount: { increment: 1 }, isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: (text || `[${kind.toLowerCase()}]`).slice(0, 240) },
    });
    const stored = await tx.whatsAppMessage.upsert({
      where: { accountId_whatsappMessageId: { accountId, whatsappMessageId: message.key.id } },
      create: { accountId, conversationId: conversation.id, whatsappMessageId: message.key.id, direction: "INBOUND", kind, status: "DELIVERED", text, mediaPath, mediaMimeType, mediaFileName, mediaSizeBytes, occurredAt },
      update: {},
    });
    if (customer) {
      const authorId = customer.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
      if (authorId) await tx.communicationActivity.upsert({
        where: { whatsappMessageId: stored.id },
        create: { customerId: customer.id, authorId, kind: "COMMUNICATION", channel: "WHATSAPP", direction: "INBOUND", content: text || `[${kind.toLowerCase()}]`, occurredAt, whatsappMessageId: stored.id },
        update: {},
      });
    }
  });
}

async function reloadAccounts() {
  const accounts = await prisma.whatsAppAccount.findMany();
  for (const account of accounts) {
    if (account.disconnectRequestedAt && (!account.disconnectedAt || account.disconnectRequestedAt > account.disconnectedAt)) {
      const socket = sessions.get(account.id);
      if (socket) await socket.logout().catch(() => undefined);
      sessions.delete(account.id);
      await rm(path.join(authRoot, account.id), { recursive: true, force: true });
      await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { status: "LOGGED_OUT", sendEnabled: false, disconnectedAt: new Date(), pairingCode: null } });
      continue;
    }
    const socket = sessions.get(account.id);
    if (account.status === "PAIRING" && account.connectRequestedAt && !account.pairingCodeExpiresAt && socket) {
      try {
        await issuePairingCode(socket, account);
      } catch (error) {
        await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { status: "ERROR", lastError: cleanError(error) } });
      }
    } else if ((account.connectRequestedAt || account.status === "CONNECTED") && !socket) {
      await connectAccount(account);
    }
  }
  const ids = [...sessions.keys()];
  if (ids.length) await prisma.whatsAppAccount.updateMany({ where: { id: { in: ids } }, data: { heartbeatAt: new Date() } });
}

async function scheduleAutomations() {
  const now = new Date();
  const templates = await prisma.whatsAppTemplate.findMany({ where: { isActive: true } });
  const byType = new Map(templates.map((template) => [template.triggerType, template]));
  const business = await prisma.businessProfile.findUnique({ where: { id: "default" }, select: { name: true, invoiceReminderOffsets: true } });
  const baseValues = { business_name: business?.name || "AS Konveksi" };
  const reminderOffsets = business?.invoiceReminderOffsets || [-3, 0, 3];
  const reminderSettingsKey = reminderOffsets.join(",");

  const opportunities = await prisma.opportunity.findMany({
    where: { stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] }, nextActionAt: { lte: now }, customer: { archivedAt: null, whatsapp: { not: null }, whatsappConsentStatus: { not: "OPTED_OUT" } } },
    select: { id: true, opportunityNo: true, title: true, nextAction: true, nextActionAt: true, customerId: true, customer: { select: { name: true, companyName: true } }, salesPic: { select: { name: true } } },
    take: 200,
  });
  const nextTemplate = byType.get("NEXT_ACTION");
  if (nextTemplate) for (const item of opportunities) {
    const idempotencyKey = `next:${item.id}:${item.nextActionAt.toISOString()}`;
    await prisma.whatsAppAutomationJob.updateMany({ where: { type: "NEXT_ACTION", opportunityId: item.id, idempotencyKey: { not: idempotencyKey }, status: { in: ["QUEUED", "RETRY"] } }, data: { status: "CANCELLED", lastError: "Jadwal follow-up berubah." } });
    await createScheduledJob({ idempotencyKey, type: "NEXT_ACTION", template: nextTemplate, customerId: item.customerId, opportunityId: item.id, scheduledAt: item.nextActionAt, values: { ...baseValues, customer_name: item.customer.name, company_name: item.customer.companyName || "", sales_pic_name: item.salesPic?.name || "", opportunity_no: item.opportunityNo, opportunity_title: item.title, next_action: item.nextAction || "" } });
  }

  const reminders = await prisma.customerReminder.findMany({
    where: { type: "REACTIVATION", dueAt: { lte: now }, resolvedAt: null, customer: { archivedAt: null, whatsapp: { not: null }, whatsappConsentStatus: { not: "OPTED_OUT" }, orderReminderEnabled: true, opportunities: { none: { stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] } } } } },
    select: { id: true, type: true, dueAt: true, generation: true, customerId: true, customer: { select: { name: true, companyName: true, salesPic: { select: { name: true } } } } },
    take: 200,
  });
  for (const item of reminders) {
    const template = byType.get("REACTIVATION") || { id: null, body: DEFAULT_ORDER_REMINDER_TEMPLATE };
    if (template) {
      const idempotencyKey = `reminder:${item.id}:${item.generation}`;
      await prisma.whatsAppAutomationJob.updateMany({ where: { reminderId: item.id, idempotencyKey: { not: idempotencyKey }, status: { in: ["QUEUED", "RETRY"] } }, data: { status: "CANCELLED", lastError: "Jadwal reminder berubah." } });
      await createScheduledJob({ idempotencyKey, type: item.type, template, customerId: item.customerId, reminderId: item.id, scheduledAt: item.dueAt, values: { ...baseValues, customer_name: item.customer.name, company_name: item.customer.companyName || "", sales_pic_name: item.customer.salesPic?.name || "" } });
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: "ISSUED", opportunity: { customer: { archivedAt: null, whatsapp: { not: null }, whatsappConsentStatus: { not: "OPTED_OUT" } } } },
    select: {
      id: true,
      invoiceNo: true,
      issuedAt: true,
      dueAt: true,
      total: true,
      opportunityId: true,
      opportunity: {
        select: {
          opportunityNo: true,
          title: true,
          customerId: true,
          customer: { select: { name: true, companyName: true } },
          salesPic: { select: { name: true } },
        },
      },
      pendingPayment: { select: { id: true, kind: true, initialAmount: true, initialDueAt: true, terms: { select: { id: true, position: true, amount: true, dueAt: true } } } },
      salesOrder: { select: { status: true, payment: { select: { id: true, terms: { select: { id: true, position: true, amount: true, dueAt: true, transactions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } } } } } } },
    },
    take: 200,
  });
  for (const invoice of invoices) {
    const values = { ...baseValues, customer_name: invoice.opportunity.customer.name, company_name: invoice.opportunity.customer.companyName || "", sales_pic_name: invoice.opportunity.salesPic?.name || "", opportunity_no: invoice.opportunity.opportunityNo, opportunity_title: invoice.opportunity.title, invoice_no: invoice.invoiceNo, invoice_total: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(invoice.total)), invoice_due_date: invoice.dueAt?.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) || "" };
    const issuedTemplate = byType.get("INVOICE_ISSUED") || { id: null, body: DEFAULT_INVOICE_ISSUED_TEMPLATE };
    if (issuedTemplate && invoice.issuedAt) await createScheduledJob({ idempotencyKey: `invoice-issued:${invoice.id}`, type: "INVOICE_ISSUED", template: issuedTemplate, customerId: invoice.opportunity.customerId, opportunityId: invoice.opportunityId, invoiceId: invoice.id, scheduledAt: invoice.issuedAt, values, attachment: { type: "invoice", invoiceId: invoice.id } });
    const targets = invoice.pendingPayment
      ? [
          { key: `pending-initial:${invoice.pendingPayment.id}`, label: invoice.pendingPayment.kind === "LUNAS" ? "pelunasan" : "DP", amount: invoice.pendingPayment.initialAmount, dueAt: invoice.pendingPayment.initialDueAt },
          ...invoice.pendingPayment.terms.map((term) => ({ key: `pending-term:${term.id}`, label: `termin ${term.position + 1}`, amount: term.amount, dueAt: term.dueAt })),
        ]
      : invoice.salesOrder?.status === "ACTIVE" && invoice.salesOrder.payment
        ? invoice.salesOrder.payment.terms.filter((term) => !term.transactions.length).map((term) => ({ key: `deal-term:${term.id}`, label: `termin ${term.position + 1}`, amount: term.amount, dueAt: term.dueAt }))
        : [];
    const dueTemplate = byType.get("INVOICE_DUE") || { id: null, body: DEFAULT_INVOICE_DUE_TEMPLATE };
    for (const target of targets) for (const offset of reminderOffsets) {
      const scheduledAt = new Date(target.dueAt.getTime() + offset * 86_400_000);
      if (scheduledAt <= now) await createScheduledJob({
        idempotencyKey: `invoice-due:${invoice.id}:${target.key}:${target.dueAt.toISOString().slice(0, 10)}:${offset}:settings-${reminderSettingsKey}`,
        type: "INVOICE_DUE", template: dueTemplate, customerId: invoice.opportunity.customerId, opportunityId: invoice.opportunityId, invoiceId: invoice.id, scheduledAt,
        values: { ...values, payment_label: target.label, payment_amount: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(target.amount)), payment_due_date: target.dueAt.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) },
        metadata: { paymentTarget: target.key, dueDate: target.dueAt.toISOString().slice(0, 10), offset },
      });
    }
  }
}

async function createScheduledJob({ template, values, attachment, metadata, ...data }) {
  const body = data.type === "INVOICE_ISSUED" && !values.invoice_due_date
    ? template.body.replace(/\s*Batas pembayaran:\s*{{\s*invoice_due_date\s*}}\s*\.\s*/i, " ")
    : template.body;
  const text = render(body, values).replace(/\s{2,}/g, " ");
  if (!text) return;
  const scheduledAt = nextSendAt(data.scheduledAt);
  const payload = { text, attachment: attachment || null, metadata: metadata || null };
  const updated = await prisma.whatsAppAutomationJob.updateMany({
    where: { idempotencyKey: data.idempotencyKey, status: { in: ["QUEUED", "RETRY"] } },
    data: { templateId: template.id || null, scheduledAt, nextAttemptAt: null, payload },
  });
  if (!updated.count) await prisma.whatsAppAutomationJob.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    create: { ...data, templateId: template.id || null, scheduledAt, payload },
    update: {},
  });
}

async function claimJob() {
  const rows = await prisma.$queryRaw`
    WITH candidate AS (
      SELECT "id" FROM "WhatsAppAutomationJob"
      WHERE ("status" = 'QUEUED' OR ("status" = 'RETRY' AND COALESCE("nextAttemptAt", "scheduledAt") <= NOW()) OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < NOW()))
        AND "scheduledAt" <= NOW()
      ORDER BY "scheduledAt", "id"
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE "WhatsAppAutomationJob" job SET "status" = 'PROCESSING', "leaseOwner" = ${workerId}, "leaseExpiresAt" = NOW() + INTERVAL '2 minutes', "attempts" = "attempts" + 1, "updatedAt" = NOW()
    FROM candidate WHERE job."id" = candidate."id" RETURNING job."id"
  `;
  return rows[0]?.id || null;
}

async function automationSourceIsValid(job) {
  if (job.type === "MANUAL") return true;
  if (job.type === "NEXT_ACTION") {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: job.opportunityId || "" }, select: { stage: true, nextActionAt: true, customer: { select: { archivedAt: true, whatsappConsentStatus: true } } } });
    return Boolean(opportunity?.nextActionAt && !opportunity.customer.archivedAt && opportunity.customer.whatsappConsentStatus !== "OPTED_OUT" && ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"].includes(opportunity.stage) && job.idempotencyKey === `next:${job.opportunityId}:${opportunity.nextActionAt.toISOString()}`);
  }
  if (job.type === "REPEAT_ORDER") return false;
  if (job.type === "REACTIVATION") {
    const reminder = await prisma.customerReminder.findUnique({ where: { id: job.reminderId || "" }, select: { type: true, generation: true, resolvedAt: true, customer: { select: { archivedAt: true, whatsappConsentStatus: true, orderReminderEnabled: true, opportunities: { where: { stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] } }, select: { id: true }, take: 1 } } } } });
    return Boolean(reminder && !reminder.resolvedAt && reminder.type === "REACTIVATION" && !reminder.customer.archivedAt && reminder.customer.whatsappConsentStatus !== "OPTED_OUT" && reminder.customer.orderReminderEnabled && !reminder.customer.opportunities.length && job.idempotencyKey === `reminder:${job.reminderId}:${reminder.generation}`);
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: job.invoiceId || "" }, select: {
    status: true,
    opportunity: { select: { customer: { select: { archivedAt: true, whatsappConsentStatus: true } } } },
    pendingPayment: { select: { id: true, initialDueAt: true, terms: { select: { id: true, dueAt: true } } } },
    salesOrder: { select: { status: true, payment: { select: { terms: { select: { id: true, dueAt: true, transactions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } } } } } } },
  } });
  if (!invoice || invoice.status !== "ISSUED") return false;
  if (invoice.opportunity.customer.archivedAt || invoice.opportunity.customer.whatsappConsentStatus === "OPTED_OUT") return false;
  if (job.type === "INVOICE_ISSUED") return true;
  const settings = await prisma.businessProfile.findUnique({ where: { id: "default" }, select: { invoiceReminderOffsets: true } });
  if (!settings || !settings.invoiceReminderOffsets.includes(job.payload?.metadata?.offset)) return false;
  const key = job.payload?.metadata?.paymentTarget;
  const dueDate = job.payload?.metadata?.dueDate;
  if (typeof key !== "string" || typeof dueDate !== "string") return false;
  if (invoice.pendingPayment && key === `pending-initial:${invoice.pendingPayment.id}`) return invoice.pendingPayment.initialDueAt.toISOString().slice(0, 10) === dueDate;
  if (key.startsWith("pending-term:")) return Boolean(invoice.pendingPayment?.terms.some((term) => key === `pending-term:${term.id}` && term.dueAt.toISOString().slice(0, 10) === dueDate));
  if (key.startsWith("deal-term:") && invoice.salesOrder?.status === "ACTIVE") return Boolean(invoice.salesOrder.payment?.terms.some((term) => key === `deal-term:${term.id}` && !term.transactions.length && term.dueAt.toISOString().slice(0, 10) === dueDate));
  return false;
}

async function processOneJob() {
  const id = await claimJob();
  if (!id) return false;
  const job = await prisma.whatsAppAutomationJob.findUnique({
    where: { id },
    include: { customer: true, message: { include: { conversation: { select: { remoteJid: true } } } } },
  });
  if (!job) return true;
  if (!await automationSourceIsValid(job)) {
    await prisma.$transaction([
      prisma.whatsAppAutomationJob.update({ where: { id }, data: { status: "CANCELLED", leaseOwner: null, leaseExpiresAt: null, lastError: "Sumber automasi sudah berubah atau selesai." } }),
      prisma.whatsAppMessage.updateMany({ where: { automationJobId: id, status: { in: ["QUEUED", "SENDING"] } }, data: { status: "CANCELLED" } }),
    ]);
    return true;
  }
  if (job.message?.status === "SENDING") {
    const error = "Status pengiriman ambigu setelah worker restart; periksa WhatsApp sebelum mengulang manual.";
    await prisma.$transaction([
      prisma.whatsAppAutomationJob.update({ where: { id }, data: { status: "FAILED", leaseOwner: null, leaseExpiresAt: null, lastError: error } }),
      prisma.whatsAppMessage.update({ where: { id: job.message.id }, data: { status: "FAILED", failedAt: new Date(), errorMessage: error } }),
    ]);
    return true;
  }
  let sendStarted = false;
  try {
    if (job.customer.archivedAt) throw new Error("Customer tidak tersedia.");
    const account = job.accountId
      ? await prisma.whatsAppAccount.findUnique({ where: { id: job.accountId } })
      : await prisma.whatsAppAccount.findFirst({ where: { sendEnabled: true, status: "CONNECTED" } });
    const socket = account && sessions.get(account.id);
    if (!account || account.status !== "CONNECTED" || !account.sendEnabled || !socket) throw new Error("Nomor WhatsApp aktif sedang offline.");
    const payload = job.payload;
    const customerNumber = normalizeNumber(job.customer.whatsapp);
    const remoteJid = (job.type === "MANUAL" ? directJid(job.message?.conversation.remoteJid) || directJid(payload.remoteJid) : null)
      || (customerNumber ? `${customerNumber}@s.whatsapp.net` : null);
    if (!remoteJid) throw new Error("Nomor WhatsApp customer tidak valid.");
    const text = String(payload.text || "").trim();
    const activityContent = text || `[${String(payload.attachment?.kind || payload.attachment?.type || "pesan").toLowerCase()}]`;
    let content = { text };
    if (payload.attachment?.type === "invoice") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const secret = process.env.WHATSAPP_WORKER_SECRET;
      if (!appUrl || !secret) throw new Error("Konfigurasi URL/secret invoice worker belum tersedia.");
      const response = await fetch(`${appUrl}/api/crm/invoice/${payload.attachment.invoiceId}/pdf`, { headers: { authorization: `Bearer ${secret}` } });
      if (!response.ok) throw new Error("PDF invoice gagal diambil.");
      content = { document: Buffer.from(await response.arrayBuffer()), mimetype: "application/pdf", fileName: `invoice-${job.invoiceId}.pdf`, caption: text };
    } else if (payload.attachment?.path) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Konfigurasi Storage worker belum tersedia.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const downloaded = await supabase.storage.from(mediaBucket).download(payload.attachment.path);
      if (downloaded.error) throw downloaded.error;
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      content = payload.attachment.kind === "IMAGE"
        ? { image: buffer, mimetype: payload.attachment.mimeType, caption: text }
        : { document: buffer, mimetype: payload.attachment.mimeType, fileName: payload.attachment.fileName, caption: text };
    }
    const preparedAt = new Date();
    const conversation = await prisma.whatsAppConversation.upsert({ where: { accountId_remoteJid: { accountId: account.id, remoteJid } }, create: { accountId: account.id, remoteJid, customerId: job.customerId }, update: { customerId: job.customerId } });
    const preparedMessage = job.message
      ? await prisma.whatsAppMessage.update({ where: { id: job.message.id }, data: { accountId: account.id, conversationId: conversation.id, status: "SENDING", errorMessage: null, failedAt: null } })
      : await prisma.whatsAppMessage.create({ data: { accountId: account.id, conversationId: conversation.id, direction: "OUTBOUND", status: "SENDING", kind: payload.attachment ? "DOCUMENT" : "TEXT", text, mediaFileName: payload.attachment?.type === "invoice" ? `invoice-${job.invoiceId}.pdf` : payload.attachment?.fileName ?? null, mediaMimeType: payload.attachment?.type === "invoice" ? "application/pdf" : payload.attachment?.mimeType ?? null, automationJobId: job.id, occurredAt: preparedAt } });
    await prisma.whatsAppAutomationJob.update({ where: { id: job.id }, data: { accountId: account.id } });
    sendStarted = true;
    const sent = await socket.sendMessage(remoteJid, content);
    consoleInfo(`[whatsapp-worker] job ${job.id} sent to ${remoteJid}`);
    const occurredAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({ where: { id: conversation.id }, data: { isResolved: false, lastMessageAt: occurredAt, lastMessagePreview: activityContent.slice(0, 240) } });
      const message = await tx.whatsAppMessage.update({ where: { id: preparedMessage.id }, data: { whatsappMessageId: sent.key.id, status: "SENT", sentAt: occurredAt, occurredAt } });
      const authorId = message.sentById || job.customer.salesPicId || (await tx.appUser.findFirst({ where: { role: "OWNER", isActive: true }, select: { id: true } }))?.id;
      if (authorId) await tx.communicationActivity.upsert({ where: { whatsappMessageId: message.id }, create: { customerId: job.customerId, opportunityId: job.opportunityId, authorId, kind: "COMMUNICATION", channel: "WHATSAPP", direction: "OUTBOUND", content: activityContent, occurredAt, whatsappMessageId: message.id }, update: {} });
      await tx.whatsAppAutomationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", accountId: account.id, completedAt: occurredAt, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      if (job.type === "REACTIVATION" && job.reminderId) {
        const reminder = await tx.customerReminder.findUnique({ where: { id: job.reminderId }, select: { dueAt: true, generation: true } });
        if (reminder) {
          let dueAt = reminder.dueAt;
          do dueAt = addSixCalendarMonthsJakarta(dueAt); while (dueAt <= occurredAt);
          await tx.customerReminder.updateMany({ where: { id: job.reminderId, generation: reminder.generation, resolvedAt: null }, data: { dueAt, generation: { increment: 1 } } });
        }
      }
    });
  } catch (error) {
    const detail = cleanError(error);
    const message = sendStarted ? `Status pengiriman ambigu: ${detail}` : detail;
    const offline = message.includes("sedang offline");
    const permanent = message.includes("tidak dapat menerima") || message.includes("tidak valid") || message.includes("Konfigurasi");
    const retry = !sendStarted && (offline || (!permanent && job.attempts < 5));
    console.error(`[whatsapp-worker] job ${job.id}: ${message}`);
    await prisma.whatsAppAutomationJob.update({ where: { id: job.id }, data: { status: retry ? "RETRY" : "FAILED", attempts: offline ? { decrement: 1 } : undefined, nextAttemptAt: retry ? new Date(Date.now() + (offline ? 5 : Math.min(30, 2 ** job.attempts)) * 60_000) : null, leaseOwner: null, leaseExpiresAt: null, lastError: message } });
    await prisma.whatsAppMessage.updateMany({ where: { automationJobId: job.id }, data: { status: retry ? "QUEUED" : "FAILED", errorMessage: message, failedAt: retry ? null : new Date() } });
  }
  return true;
}

async function tick() {
  if (stopping || ticking) return;
  ticking = true;
  try {
    await reloadAccounts();
    if (Date.now() - lastAutomationAt >= 60_000) {
      await scheduleAutomations();
      lastAutomationAt = Date.now();
    }
    for (let index = 0; index < 10; index += 1) {
      if (!await processOneJob()) break;
    }
  } catch (error) {
    console.error(`[whatsapp-worker] ${cleanError(error)}`);
  } finally {
    lastTickAt = Date.now();
    ticking = false;
  }
}

async function shutdown() {
  stopping = true;
  const accountIds = [...sessions.keys()];
  sessions.clear();
  healthServer.close();
  if (accountIds.length) await prisma.whatsAppAccount.updateMany({
    where: { id: { in: accountIds }, status: { in: ["CONNECTED", "PAIRING"] } },
    data: { status: "DISCONNECTED", disconnectedAt: new Date() },
  });
  await prisma.$disconnect();
  await lockClient.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
await lockClient.connect();
const [{ locked }] = (await lockClient.query("SELECT pg_try_advisory_lock(871662024) AS locked")).rows;
if (!locked) throw new Error("Worker WhatsApp lain masih aktif untuk database ini.");
await mkdir(authRoot, { recursive: true });
const healthPort = Number(process.env.WHATSAPP_HEALTH_PORT || 3001);
const healthServer = createServer((request, response) => {
  const healthy = request.url === "/health" && Date.now() - lastTickAt < 120_000;
  response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: healthy ? "ok" : "starting" }));
});
healthServer.listen(healthPort, "0.0.0.0");
await tick();
setInterval(() => void tick(), 2_000);
