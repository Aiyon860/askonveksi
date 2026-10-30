/** Aturan murni impor arsip keuangan. Tidak membuka database dan tidak membaca Excel. */

export const APRIL_INVOICE = 354_745_000;
export const FAIZ_LATSITARDANUS = 116_820_000;
export const FAIZ_LATSITARDANUS_AW = 149_860_000;
export const APRIL_IMPORTED = APRIL_INVOICE - FAIZ_LATSITARDANUS - FAIZ_LATSITARDANUS_AW;
export const HANGRY_INVOICE = 2_304_000;
export const MEI_2026 = 133_617_000;
export const JUNI_2026 = 108_126_000;
export const AGUSTUS_2026 = 216_794_000;
export const MAS_BAH_INVOICE = 215_000;
export const MAS_BAH_HPP = 149_500;
export const MAS_BAH_LABA = 65_500;
export const GIBRAN_SEP_EXTRA_HPP = 300_000;
export const SEPTEMBER_MURNI = 47_585_494;
export const ARCHIVE_PAYMENT_NOTE =
  "Pelunasan tidak ada di arsip. Dicatat lunas pada tanggal 1 bulan laporan supaya tidak masuk piutang berjalan.";

export const HELD_PHONES = new Set([
  "0812345678982",
  "0812334455666",
  "081234567788",
  "0447859450348",
  "01234789886",
  "085723456742",
  "082265309044",
  "081318499009",
  "081225184048",
  "088227326136",
  "087794533745",
  "089518628314",
  "085141220140",
]);

export function normName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID");
}

export function decideSkip(order) {
  const name = normName(order.name);
  if (!name) return "tanpa-nama";
  if (!order.invoice) return "tanpa-invoice";
  if (order.month < "2025-04") return "hold-pra-april-2025";
  if (order.month === "2025-09") return "tidak-ada-september-2025";
  if (order.month === "2025-04" && /faiz/.test(name) && (/latsitardanus/.test(name) || /tactical/.test(name))) return "tanya-1";
  if (order.month === "2025-04" && /revin/.test(name)) return "tanya-1";
  if (order.month === "2025-11" && name.includes("hangry")) return "tanya-4";
  return null;
}

export function decidePayment(order) {
  const invoice = Math.round(order.invoice);
  const hasFigure = order.dp != null || order.sisa != null || order.lunas != null;
  if (!hasFigure) {
    return { mode: "arsip-lunas", kind: "LUNAS", paid: invoice, outstanding: 0, paidOn: `${order.month}-01`, note: ARCHIVE_PAYMENT_NOTE };
  }
  if (order.sisa != null) {
    const outstanding = Math.max(0, Math.round(order.sisa));
    const paid = Math.max(0, invoice - outstanding);
    return { mode: "laporan", kind: outstanding === 0 ? "LUNAS" : "DP", paid, outstanding, paidOn: `${order.month}-01`, note: null };
  }
  const paid = Math.min(invoice, Math.max(0, Math.round((order.dp ?? 0) + (order.lunas ?? 0))));
  const outstanding = invoice - paid;
  return { mode: "laporan", kind: outstanding === 0 ? "LUNAS" : "DP", paid, outstanding, paidOn: `${order.month}-01`, note: null };
}

export function applyConfirmedAdjustments(order) {
  const name = normName(order.name);
  const next = { ...order, buckets: { ...order.buckets }, laba: order.invoice - order.hpp };
  if (order.month === "2026-08" && name.includes("mas bah")) {
    next.hpp = MAS_BAH_HPP;
    next.laba = MAS_BAH_LABA;
    const drift = MAS_BAH_HPP - sumBuckets(next.buckets);
    next.buckets.lainnya = (next.buckets.lainnya ?? 0) + drift;
  }
  if (order.month === "2026-09" && name === "gibran") {
    next.hpp += GIBRAN_SEP_EXTRA_HPP;
    next.laba = next.invoice - next.hpp;
    next.buckets.lainnya = (next.buckets.lainnya ?? 0) + GIBRAN_SEP_EXTRA_HPP;
  }
  next.buckets = balanceBuckets(next.buckets, next.hpp);
  next.hpp = sumBuckets(next.buckets);
  next.laba = next.invoice - next.hpp;
  return next;
}

const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"];

export function sumBuckets(buckets) {
  return HPP_KEYS.reduce((total, key) => total + (buckets?.[key] ?? 0), 0);
}

export function balanceBuckets(buckets, hpp) {
  const next = Object.fromEntries(HPP_KEYS.map((key) => [key, Math.max(0, Math.round(buckets?.[key] ?? 0))]));
  let drift = Math.max(0, Math.round(hpp)) - sumBuckets(next);
  if (drift > 0) next.lainnya += drift;
  for (const key of [...HPP_KEYS].reverse()) {
    if (drift >= 0) break;
    const take = Math.min(next[key], -drift);
    next[key] -= take;
    drift += take;
  }
  return next;
}

export function monthGuards(orders, existingAugustInvoice) {
  const counted = orders.filter((order) => !order.skip || order.skip === "sudah-ada");
  const added = orders.filter((order) => !order.skip);
  const sum = (month) => counted.filter((order) => order.month === month).reduce((total, order) => total + order.invoice, 0);
  const raw = (month) => orders.filter((order) => order.month === month).reduce((total, order) => total + order.invoice, 0);
  const checks = [
    ["April yang masuk 88.065.000", sum("2025-04") === APRIL_IMPORTED],
    ["November dikurangi Hangry", sum("2025-11") === raw("2025-11") - HANGRY_INVOICE],
    ["Mei 2026 133.617.000", sum("2026-05") === MEI_2026],
    ["Juni 2026 108.126.000", sum("2026-06") === JUNI_2026],
    ["Agustus 2026 tertutup 216.794.000", existingAugustInvoice + added.filter((order) => order.month === "2026-08").reduce((total, order) => total + order.invoice, 0) === AGUSTUS_2026],
    ["Tidak ada September 2025", !orders.some((order) => order.month === "2025-09")],
    ["Tidak ada order sebelum April 2025", !counted.some((order) => order.month < "2025-04")],
    ["Mas Bah laba 65.500", counted.some((order) => order.month === "2026-08" && normName(order.name).includes("mas bah") && order.laba === MAS_BAH_LABA)],
    ["Gibran September laba 4.805.318", counted.some((order) => order.month === "2026-09" && normName(order.name) === "gibran" && order.laba === 4_805_318)],
  ];
  return checks.map(([label, ok]) => ({ label, ok }));
}

export function looseName(value) {
  return normName(value).replace(/\b(kak|kaka|saga|pt|cv|bu|ibu|pak|mas)\b/g, " ").replace(/\s+/g, " ").trim();
}

export function namesClose(left, right) {
  const a = looseName(left);
  const b = looseName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function importKey(month, name, invoice) {
  return `${month}|${normName(name)}|${Math.round(invoice)}`;
}

export function alreadyImported(order, existing) {
  if (existing.keys.has(importKey(order.month, order.name, order.invoice))) return true;
  const close = existing.rows.filter((row) => row.month === order.month && row.total === Math.round(order.invoice) && namesClose(row.name, order.name));
  return close.length === 1;
}

/** Satu baris sheet sama dengan satu invoice yang sudah ada. Nominal yang beda pada nama yang sama disesuaikan, bukan digandakan. */
export function partitionArchive(orders, existingRows) {
  const open = orders.filter((order) => !order.skip);
  const remaining = existingRows.map((row) => ({ ...row, used: false }));
  const taken = new Set();
  const claim = (order, predicate) => {
    if (taken.has(order)) return null;
    const hits = remaining.filter((row) => !row.used && predicate(row));
    if (hits.length !== 1) return null;
    hits[0].used = true;
    taken.add(order);
    return hits[0];
  };
  for (const order of open) claim(order, (row) => row.month === order.month && row.total === Math.round(order.invoice) && normName(row.name) === normName(order.name));
  for (const order of open) claim(order, (row) => row.month === order.month && row.total === Math.round(order.invoice) && namesClose(row.name, order.name));
  const revisions = [];
  const fresh = [];
  for (const order of open) {
    if (taken.has(order)) continue;
    const hits = remaining.filter((row) => !row.used && row.month === order.month && normName(row.name) === normName(order.name));
    if (hits.length === 1) {
      hits[0].used = true;
      revisions.push({ order, previousTotal: hits[0].total, invoiceId: hits[0].invoiceId ?? null });
      continue;
    }
    fresh.push(order);
  }
  return { fresh, revisions, skipped: taken.size };
}

export function phoneAllowed(phone) {
  if (!phone) return false;
  return !HELD_PHONES.has(phone);
}
