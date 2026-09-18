"use server";

import { z } from "zod";

import { getCustomerCommunicationHistory, getCustomerOpportunities, getCustomerSalesOrders } from "@/lib/crm/data";
import { parseDocumentDateRange } from "@/lib/crm/document-list-filters";
import { normalizeCustomerHistoryPageSize, type CustomerHistoryData } from "@/lib/crm/customer-history";
import { PIPELINE_STAGES } from "@/lib/crm/constants";
import { entityIdSchema } from "@/lib/crm/validation";

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);
const common = z.object({ customerId: entityIdSchema, query: z.string().trim().max(80).catch(""), page: pageSchema, pageSize: z.coerce.number().catch(5) });
const requestSchema = z.discriminatedUnion("kind", [
  common.extend({ kind: z.literal("communication"), filter: z.enum(["all", "COMMUNICATION", "INTERNAL_NOTE", "SYSTEM", "WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"]).catch("all") }),
  common.extend({ kind: z.literal("order"), status: z.enum(["all", "ACTIVE", "CANCELLED"]).catch("all"), from: z.string().max(10).catch(""), to: z.string().max(10).catch("") }),
  common.extend({ kind: z.literal("opportunity"), stage: z.enum(["all", ...PIPELINE_STAGES]).catch("all") }),
]);

function result(items: unknown[], total: number, pageCount: number): CustomerHistoryData {
  return { items: JSON.parse(JSON.stringify(items)), total, pageCount };
}

export async function getCustomerHistory(input: unknown): Promise<CustomerHistoryData> {
  const parsed = requestSchema.parse(input);
  const pageSize = normalizeCustomerHistoryPageSize(parsed.pageSize);

  if (parsed.kind === "communication") {
    const history = await getCustomerCommunicationHistory({ ...parsed, filter: parsed.filter, pageSize });
    return result(history.items, history.total, history.pageCount);
  }
  if (parsed.kind === "order") {
    const range = parseDocumentDateRange(parsed.from, parsed.to);
    const history = await getCustomerSalesOrders({ customerId: parsed.customerId, query: parsed.query, status: parsed.status, start: range.start, end: range.end, page: parsed.page, pageSize });
    return result(history.items, history.total, history.pageCount);
  }
  const history = await getCustomerOpportunities({ customerId: parsed.customerId, query: parsed.query, stage: parsed.stage, page: parsed.page, pageSize });
  return result(history.items, history.total, history.pageCount);
}
