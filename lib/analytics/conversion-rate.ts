export function calculateConversionRate(dealCount: number, totalLeadCount: number) {
  if (totalLeadCount <= 0) return 0;
  return dealCount / totalLeadCount;
}
