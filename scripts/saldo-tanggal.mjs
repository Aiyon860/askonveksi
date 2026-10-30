import { looseName } from "./keuangan-arsip-rules.mjs";

const MONTHS = {
  januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5,
  juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agust: 8, ags: 8, agst: 8, agt: 8, agu: 8,
  september: 9, sept: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11, nop: 11, desember: 12, des: 12,
};
const STOP = new Set(["order", "orderan", "project", "jersey", "tshirt", "kaos", "kemeja", "polo", "pelunasan", "deposit", "tambahan", "ongkir"]);
const GENERIC = new Set(["undip", "kov", "hipmi", "saga", "unika", "pnm", "sipa", "baju", "rompi", "jaket", "jeep"]);
const TITLE = new Set(["kak", "pak", "ibu", "mas", "mba", "mbak", "bang", "dari", "untuk", "yang", "sama", "dengan", "via", "fee"]);

export function parseSaldoDate(raw, fallbackYear) {
  const match = String(raw ?? "").match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (!match) return null;
  const month = MONTHS[match[2].toLocaleLowerCase("id-ID")];
  const day = Number(match[1]);
  if (!month || day < 1 || day > 31) return null;
  const year = match[3] ? Number(match[3]) : fallbackYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function saldoTokens(value) {
  return looseName(String(value ?? "").replace(/\(.*?\)/g, " ")).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP.has(token));
}

export function distinctiveTokens(value) {
  const tokens = looseName(String(value ?? "")).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP.has(token) && !TITLE.has(token));
  const specific = tokens.filter((token) => token.length >= 4 && !GENERIC.has(token));
  if (specific.length) return specific;
  const short = tokens.filter((token) => token.length === 3 && !GENERIC.has(token));
  return short.length ? short : tokens.filter((token) => GENERIC.has(token));
}

export function sharesSaldoName(label, customer) {
  const labelTokens = saldoTokens(label);
  const customerTokens = saldoTokens(customer);
  const blob = looseName(label).replace(/\s+/g, "");
  const shared = customerTokens.filter((token) => labelTokens.includes(token) || (token.length >= 4 && blob.includes(token)));
  if (shared.some((token) => token.length >= 4)) return true;
  return shared.length > 0 && customerTokens.every((token) => token.length < 4);
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthWindow(month) {
  return new Set([shiftMonth(month, -1), month, shiftMonth(month, 1)]);
}

function subsets(items, target) {
  const found = [];
  const walk = (index, sum, chosen) => {
    if (found.length > 1) return;
    if (sum === target) {
      found.push([...chosen]);
      return;
    }
    if (sum > target || index >= items.length) return;
    chosen.push(items[index]);
    walk(index + 1, sum + items[index].amount, chosen);
    chosen.pop();
    walk(index + 1, sum, chosen);
  };
  walk(0, 0, []);
  return found;
}

function seriesNo(value) {
  const text = looseName(value);
  const ke = text.match(/\bke\s*(\d+)\b/);
  if (ke) return ke[1];
  const orderan = text.match(/\borderan\s*(\d+)\b/);
  return orderan ? orderan[1] : null;
}

function sameSeries(orderName, label) {
  const left = seriesNo(orderName);
  const right = seriesNo(label);
  return !left || !right || left === right;
}

function fitLines(rows, cap) {
  const usable = rows.filter((row) => row.amount <= Math.round(cap * 1.15));
  const sorted = [...usable].sort((left, right) => left.date.localeCompare(right.date) || left.amount - right.amount);
  const chosen = [];
  let total = 0;
  for (const row of sorted) {
    if (total >= cap) break;
    const room = cap - total;
    row.used = true;
    if (row.amount <= room) {
      chosen.push(row);
      total += row.amount;
    } else {
      chosen.push({ date: row.date, amount: room, label: row.label });
      total = cap;
    }
  }
  return chosen;
}

export function assignSaldoPayments(orders, inflows, roster = []) {
  const pool = inflows.map((row) => ({ ...row, used: false }));
  const pending = orders.map((order) => ({ ...order, done: false }));
  const matched = [];
  const claim = (order, rows, mode) => {
    for (const row of rows) row.used = true;
    order.done = true;
    matched.push({
      id: order.id,
      mode,
      payments: rows.map((row) => ({ date: row.date, amount: row.amount, label: row.label })).sort((left, right) => left.date.localeCompare(right.date) || left.amount - right.amount),
    });
  };
  const squash = (value) => value.replace(/(.)\1+/g, "$1");
  const coveredBy = (token, names) => [...names].some((name) => {
    if (name === token || squash(name) === squash(token)) return true;
    if (name.length < 4) return false;
    const gap = Math.abs(token.length - name.length);
    return gap >= 2 && (token.includes(name) || name.includes(token));
  });
  const inWindow = (row, order) => {
    if (!monthWindow(order.month).has(row.date.slice(0, 7))) return false;
    const lineMonth = row.date.slice(0, 7);
    if (lineMonth >= order.month) return true;
    const own = new Set(distinctiveTokens(order.name));
    return !pending.some((other) => other !== order && !other.done && other.month === lineMonth && distinctiveTokens(other.name).some((token) => own.has(token)));
  };
  const candidatesFor = (order) => pool.filter((row) => !row.used && inWindow(row, order) && sharesSaldoName(row.label, order.name));
  for (let guard = 0; guard < pending.length + 2; guard += 1) {
    let moved = false;
    for (const order of pending.filter((item) => !item.done).sort((left, right) => right.name.length - left.name.length)) {
      const candidates = candidatesFor(order);
      if (!candidates.length || candidates.length > 18) continue;
      const hits = subsets(candidates, order.paid);
      if (hits.length !== 1) continue;
      claim(order, hits[0], "exact");
      moved = true;
    }
    if (!moved) break;
  }
  const namedLines = (order) => {
    const own = new Set(distinctiveTokens(order.name));
    return pool.filter((row) => {
      if (row.used || !inWindow(row, order)) return false;
      const label = distinctiveTokens(row.label);
      return label.length > 0 && label.every((token) => coveredBy(token, own));
    });
  };
  const strongMatch = (row, name) => saldoTokens(name).some((token) => token.length >= 4 && saldoTokens(row.label).some((label) => coveredBy(label, [token])));
  for (const order of pending) {
    if (order.done) continue;
    const candidates = namedLines(order).filter((row) => sameSeries(order.name, row.label) && strongMatch(row, order.name));
    const sum = candidates.reduce((total, row) => total + row.amount, 0);
    if (!candidates.length || sum <= 0 || sum >= order.paid) continue;
    const shared = pending.some((other) => !other.done && other !== order && candidates.some((row) => strongMatch(row, other.name)));
    if (shared) continue;
    claim(order, candidates, "partial");
  }
  for (const order of pending) {
    if (order.done || distinctiveTokens(order.name).length === 0) continue;
    const rows = namedLines(order).filter((row) => sameSeries(order.name, row.label) && pending.filter((other) => !other.done && sameSeries(other.name, row.label) && namedLines(other).includes(row)).length === 1);
    const sum = rows.reduce((total, row) => total + row.amount, 0);
    const cap = order.invoice ?? order.paid;
    if (!rows.length || sum <= 0) continue;
    const fitted = sum <= cap ? rows : fitLines(rows, cap);
    if (!fitted.length) continue;
    const fittedSum = fitted.reduce((total, row) => total + row.amount, 0);
    claim(order, fitted, fittedSum === cap ? "exact" : "partial");
  }
  const open = pending.filter((order) => !order.done);
  const parent = open.map((_, index) => index);
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  for (let i = 0; i < open.length; i += 1) {
    const left = new Set(distinctiveTokens(open[i].name));
    const leftSeries = seriesNo(open[i].name);
    for (let j = i + 1; j < open.length; j += 1) {
      if (open[i].month !== open[j].month) continue;
      const rightSeries = seriesNo(open[j].name);
      if (leftSeries && rightSeries && leftSeries !== rightSeries) continue;
      if (distinctiveTokens(open[j].name).some((token) => left.has(token))) parent[find(j)] = find(i);
    }
  }
  const groups = new Map();
  open.forEach((order, index) => {
    const key = find(index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });
  for (const group of [...groups.values()].sort((left, right) => Math.max(...right.map((order) => order.name.length)) - Math.max(...left.map((order) => order.name.length)))) {
    const own = new Set(group.flatMap((order) => distinctiveTokens(order.name)));
    const rivalTokens = (row) => {
      const fromRoster = roster.flatMap((entry) => {
        const name = typeof entry === "string" ? entry : entry.name;
        const month = typeof entry === "string" ? null : entry.month;
        if (month && !monthWindow(month).has(row.date.slice(0, 7))) return [];
        return distinctiveTokens(name);
      });
      const fromPending = pending
        .filter((order) => !group.includes(order) && monthWindow(order.month).has(row.date.slice(0, 7)))
        .flatMap((order) => distinctiveTokens(order.name));
      return [...fromRoster, ...fromPending].filter((token) => !own.has(token));
    };
    const rows = pool.filter((row) => {
      if (row.used || !group.some((order) => inWindow(row, order) && sameSeries(order.name, row.label))) return false;
      const label = distinctiveTokens(row.label);
      const ownScore = label.filter((token) => coveredBy(token, own)).length;
      const rivalScore = label.filter((token) => coveredBy(token, rivalTokens(row))).length;
      return ownScore > 0 && ownScore > rivalScore;
    });
    const cap = group.reduce((sum, order) => sum + (order.invoice ?? order.paid), 0);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    if (!rows.length || total <= 0) continue;
    const chosen = total <= cap ? rows : fitLines(rows, cap);
    if (!chosen.length) continue;
    const lines = [...chosen].sort((left, right) => left.date.localeCompare(right.date) || left.amount - right.amount);
    for (const row of lines) row.used = true;
    let index = 0;
    let left = lines[0].amount;
    for (const order of [...group].sort((a, b) => (b.invoice ?? b.paid) - (a.invoice ?? a.paid))) {
      let need = order.invoice ?? order.paid;
      const slices = [];
      while (need > 0 && index < lines.length) {
        const take = Math.min(need, left);
        if (take > 0) slices.push({ date: lines[index].date, amount: take, label: lines[index].label });
        need -= take;
        left -= take;
        if (left === 0) {
          index += 1;
          left = lines[index]?.amount ?? 0;
        }
      }
      if (slices.length) claim(order, slices, need === 0 ? "exact" : "partial");
    }
  }
  for (const order of pending.filter((item) => !item.done)) {
    const own = new Set(distinctiveTokens(order.name));
    const cap = order.invoice ?? order.paid;
    const hits = pool.filter((row) => {
      if (row.used || row.amount !== cap) return false;
      const label = distinctiveTokens(row.label);
      const ownScore = label.filter((token) => coveredBy(token, own)).length;
      if (!ownScore) return false;
      const rivals = [
        ...roster.flatMap((entry) => distinctiveTokens(typeof entry === "string" ? entry : entry.name)),
        ...pending.filter((other) => other !== order).flatMap((other) => distinctiveTokens(other.name)),
      ].filter((token) => !own.has(token));
      const rivalScore = label.filter((token) => coveredBy(token, rivals)).length;
      return ownScore > rivalScore;
    });
    if (hits.length !== 1) continue;
    claim(order, hits, "exact");
  }
  return { matched, unmatched: pending.filter((order) => !order.done).map((order) => order.id) };
}
