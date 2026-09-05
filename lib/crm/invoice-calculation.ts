import { Prisma } from "@prisma/client";

import { UserFacingError } from "@/lib/actions/response";

export type InvoicePricingInput = {
  purchaseOrderSizeId: string;
  productName: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG";
  description: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  discountCapAmount?: string;
  taxRate: string;
};

export function calculateInvoiceLines(items: InvoicePricingInput[]) {
  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const discountPercent = new Prisma.Decimal(item.discountPercent);
    const discountCapAmount = item.discountCapAmount ? new Prisma.Decimal(item.discountCapAmount) : null;
    const taxRate = new Prisma.Decimal(item.taxRate);
    if (discountPercent.gt(100)) throw new UserFacingError("Diskon per item maksimal 100%.");
    if (taxRate.gt(100)) throw new UserFacingError("Pajak per item maksimal 100%.");

    const grossAmount = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const percentageDiscount = grossAmount.mul(discountPercent).div(100).toDecimalPlaces(2);
    const discountAmount = discountCapAmount && percentageDiscount.gt(discountCapAmount)
      ? discountCapAmount
      : percentageDiscount;
    const taxableAmount = grossAmount.sub(discountAmount);
    const taxAmount = taxableAmount.mul(taxRate).div(100).toDecimalPlaces(2);
    const total = taxableAmount.add(taxAmount).toDecimalPlaces(2);

    return {
      position,
      productName: item.productName,
      size: item.size,
      sleeveLength: item.sleeveLength,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      grossAmount,
      discountPercent,
      discountCapAmount,
      discountAmount,
      taxRate,
      taxAmount,
      total,
      subtotal: total,
      purchaseOrderSizeId: item.purchaseOrderSizeId,
    };
  });

  return calculatedItems.reduce(
    (summary, item) => ({
      items: [...summary.items, item],
      subtotal: summary.subtotal.add(item.grossAmount),
      totalDiscount: summary.totalDiscount.add(item.discountAmount),
      totalTax: summary.totalTax.add(item.taxAmount),
      total: summary.total.add(item.total),
    }),
    {
      items: [] as typeof calculatedItems,
      subtotal: new Prisma.Decimal(0),
      totalDiscount: new Prisma.Decimal(0),
      totalTax: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  );
}
