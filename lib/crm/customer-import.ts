export type ImportCustomerMatch = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  customerTypeId: string;
  leadSourceId: string | null;
  salesPicId: string | null;
};

type ImportCustomerRow = {
  customerNo: string;
  name: string;
  whatsapp: string;
  email: string;
  instagram: string;
};

function uniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function importCustomerLookupKeys(rows: ImportCustomerRow[]) {
  return {
    customerNos: uniqueValues(rows.map((row) => normalizeImportText(row.customerNo))),
    names: uniqueValues(rows.map((row) => row.name.trim()).filter(Boolean)),
    whatsapps: uniqueValues(rows.flatMap((row) => [row.whatsapp.trim(), normalizePhone(row.whatsapp)])),
    emails: uniqueValues(rows.map((row) => normalizeImportText(row.email))),
    instagrams: uniqueValues(rows.map((row) => normalizeImportText(row.instagram))),
  };
}

type CustomerIndexes = {
  byCustomerNo: Map<string, ImportCustomerMatch[]>;
  byName: Map<string, ImportCustomerMatch[]>;
  byWhatsapp: Map<string, ImportCustomerMatch[]>;
  byEmail: Map<string, ImportCustomerMatch[]>;
  byInstagram: Map<string, ImportCustomerMatch[]>;
};

export function normalizeImportText(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("id-ID") ?? "";
  return normalized || null;
}

export function normalizePhone(value: string | null | undefined) {
  let digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("8")) digits = `0${digits}`;
  return digits;
}

function add(map: Map<string, ImportCustomerMatch[]>, key: string | null, customer: ImportCustomerMatch) {
  if (!key) return;
  const matches = map.get(key) ?? [];
  if (!matches.some((match) => match.id === customer.id)) {
    map.set(key, [...matches, customer]);
  }
}

function remove(map: Map<string, ImportCustomerMatch[]>, key: string | null, customerId: string) {
  if (!key) return;
  const next = (map.get(key) ?? []).filter((match) => match.id !== customerId);
  if (next.length) {
    map.set(key, next);
  } else {
    map.delete(key);
  }
}

function addToIndexes(indexes: CustomerIndexes, customer: ImportCustomerMatch) {
  add(indexes.byCustomerNo, normalizeImportText(customer.customerNo), customer);
  add(indexes.byName, normalizeImportText(customer.name), customer);
  add(indexes.byWhatsapp, normalizePhone(customer.whatsapp), customer);
  add(indexes.byEmail, normalizeImportText(customer.email), customer);
  add(indexes.byInstagram, normalizeImportText(customer.instagram), customer);
}

function removeFromIndexes(indexes: CustomerIndexes, customer: ImportCustomerMatch) {
  remove(indexes.byCustomerNo, normalizeImportText(customer.customerNo), customer.id);
  remove(indexes.byName, normalizeImportText(customer.name), customer.id);
  remove(indexes.byWhatsapp, normalizePhone(customer.whatsapp), customer.id);
  remove(indexes.byEmail, normalizeImportText(customer.email), customer.id);
  remove(indexes.byInstagram, normalizeImportText(customer.instagram), customer.id);
}

export function indexCustomers(customers: ImportCustomerMatch[]) {
  const indexes: CustomerIndexes = {
    byCustomerNo: new Map(),
    byName: new Map(),
    byWhatsapp: new Map(),
    byEmail: new Map(),
    byInstagram: new Map(),
  };

  for (const customer of customers) addToIndexes(indexes, customer);

  return indexes;
}

export function upsertImportCustomerIndex(indexes: ReturnType<typeof indexCustomers>, current: ImportCustomerMatch | null, next: ImportCustomerMatch) {
  if (current) removeFromIndexes(indexes, current);
  addToIndexes(indexes, next);
}

function firstMatch(candidates: ImportCustomerMatch[] | undefined) {
  return candidates?.[0] ?? null;
}

export function findImportCustomer(row: ImportCustomerRow, indexes: ReturnType<typeof indexCustomers>) {
  const customerNo = normalizeImportText(row.customerNo);
  if (customerNo) {
    const match = firstMatch(indexes.byCustomerNo.get(customerNo));
    if (match) return match;
  }

  const whatsapp = normalizePhone(row.whatsapp);
  if (whatsapp) {
    const match = firstMatch(indexes.byWhatsapp.get(whatsapp));
    if (match) return match;
  }

  const email = normalizeImportText(row.email);
  if (email) {
    const match = firstMatch(indexes.byEmail.get(email));
    if (match) return match;
  }

  const instagram = normalizeImportText(row.instagram);
  if (instagram) {
    const match = firstMatch(indexes.byInstagram.get(instagram));
    if (match) return match;
  }

  const name = normalizeImportText(row.name);
  if (name) {
    return firstMatch(indexes.byName.get(name));
  }

  return null;
}
