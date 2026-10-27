import { jakartaDateKey } from "@/lib/finance/date-range";

export type ProjectGroupItem = {
  id: string;
  paidAt: string | null;
  customerId: string;
  customer: string;
  acceptedAt: string;
  products: readonly unknown[];
};

export type ProjectOrderGroup<T extends ProjectGroupItem> = {
  key: string;
  item: T;
  rowCount: number;
};

export type ProjectCustomerGroup<T extends ProjectGroupItem> = {
  key: string;
  customer: string;
  rowCount: number;
  orders: ProjectOrderGroup<T>[];
};

export type ProjectDateGroup<T extends ProjectGroupItem> = {
  key: string;
  paidAt: string | null;
  rowCount: number;
  customers: ProjectCustomerGroup<T>[];
};

function paidDateKey(item: ProjectGroupItem) {
  return item.paidAt ? jakartaDateKey(new Date(item.paidAt)) : "0000-00-00";
}

/**
 * Urutkan dan kelompokkan baris Project: tanggal → customer → order.
 * `rowCount` dipakai tabel untuk rowSpan; jumlahnya mengikuti jumlah produk.
 */
export function groupProjectRows<T extends ProjectGroupItem>(items: T[]): ProjectDateGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const dateA = paidDateKey(a);
    const dateB = paidDateKey(b);
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const customer = a.customer.localeCompare(b.customer, "id-ID");
    if (customer) return customer;
    const accepted = b.acceptedAt.localeCompare(a.acceptedAt);
    if (accepted) return accepted;
    return a.id.localeCompare(b.id);
  });

  const dates = new Map<string, ProjectDateGroup<T> & { customerMap: Map<string, ProjectCustomerGroup<T>> }>();
  for (const item of sorted) {
    const dateKey = paidDateKey(item);
    let date = dates.get(dateKey);
    if (!date) {
      date = { key: dateKey, paidAt: item.paidAt, rowCount: 0, customers: [], customerMap: new Map() };
      dates.set(dateKey, date);
    }

    const customerKey = item.customerId || item.customer;
    let customer = date.customerMap.get(customerKey);
    if (!customer) {
      customer = { key: customerKey, customer: item.customer, rowCount: 0, orders: [] };
      date.customerMap.set(customerKey, customer);
      date.customers.push(customer);
    }

    const rowCount = Math.max(1, item.products.length);
    const order = { key: item.id, item, rowCount };
    customer.orders.push(order);
    customer.rowCount += rowCount;
    date.rowCount += rowCount;
  }

  return [...dates.values()].map((date) => ({
    key: date.key,
    paidAt: date.paidAt,
    rowCount: date.rowCount,
    customers: date.customers,
  }));
}
