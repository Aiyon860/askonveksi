/** Aturan murni: tanggal order = pembayaran pertama. Multi-baris ikut DP awal bila berbagi tanggal bayar. */

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function jakartaDay(date) {
  return dayFormat.format(date);
}

export function dayDiff(left, right) {
  return Math.round((Date.parse(left) - Date.parse(right)) / 86_400_000);
}

function normName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("id-ID");
}

/**
 * Default: tanggal masuk = firstPayDay order itu sendiri.
 * Kalau ada order nama sama yang lebih dulu, dan tanggal first-pay order belakangan
 * muncul di daftar hari bayar order lebih dulu (mis. potongan pelunasan bersama),
 * order belakangan ikut tanggal DP paling awal.
 */
export function clusterOrderMasukDates(orders, maxGapDays = 21) {
  const items = orders.map((order) => ({
    id: order.id,
    name: normName(order.name),
    firstPayDay: order.firstPayDay,
    payDays: [...new Set(order.payDays?.length ? order.payDays : [order.firstPayDay])].sort(),
  }));
  const result = new Map(items.map((item) => [item.id, item.firstPayDay]));
  const byName = new Map();
  for (const item of items) {
    const list = byName.get(item.name) ?? [];
    list.push(item);
    byName.set(item.name, list);
  }
  for (const group of byName.values()) {
    const sorted = [...group].sort((left, right) => left.firstPayDay.localeCompare(right.firstPayDay) || left.id.localeCompare(right.id));
    for (let i = 0; i < sorted.length; i += 1) {
      const later = sorted[i];
      for (let j = 0; j < i; j += 1) {
        const earlier = sorted[j];
        if (Math.abs(dayDiff(later.firstPayDay, earlier.firstPayDay)) > maxGapDays) continue;
        if (!earlier.payDays.includes(later.firstPayDay)) continue;
        result.set(later.id, result.get(earlier.id));
        break;
      }
    }
  }
  return result;
}
