import { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

export type InvoicePricingInput = {
  purchaseOrderSizeId: string;
  productName: string;
  size: string;
  sleeveLength: "PENDEK" | "PANJANG";
  description: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
};

export function calculateInvoiceLines(items: InvoicePricingInput[], taxRate: string) {
  const orderTaxRate = new Prisma.Decimal(taxRate);
  if (orderTaxRate.gt(100)) throw new UserFacingError("Pajak maksimal 100%.");

  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const discountPercent = new Prisma.Decimal(item.discountPercent);
    if (discountPercent.gt(100)) throw new UserFacingError("Diskon per item maksimal 100%.");

    const grossAmount = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const discountAmount = grossAmount.mul(discountPercent).div(100).toDecimalPlaces(2);
    const taxableAmount = grossAmount.sub(discountAmount);

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
      discountCapAmount: null,
      discountAmount,
      taxRate: orderTaxRate,
      taxAmount: new Prisma.Decimal(0),
      total: taxableAmount,
      subtotal: taxableAmount,
      purchaseOrderSizeId: item.purchaseOrderSizeId,
    };
  });

  const summary = calculatedItems.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal.add(item.grossAmount),
      totalDiscount: acc.totalDiscount.add(item.discountAmount),
      taxableAmount: acc.taxableAmount.add(item.total),
    }),
    {
      subtotal: new Prisma.Decimal(0),
      totalDiscount: new Prisma.Decimal(0),
      taxableAmount: new Prisma.Decimal(0),
    },
  );

  const totalTax = summary.taxableAmount.mul(orderTaxRate).div(100).toDecimalPlaces(2);
  const total = summary.taxableAmount.add(totalTax).toDecimalPlaces(2);

  return {
    // DB CHECK InvoiceItem_charges_valid requires item subtotal = total (line total incl. tax).
    items: calculatedItems.map((item) => {
      const taxAmount = item.total.mul(orderTaxRate).div(100).toDecimalPlaces(2);
      const total = item.total.add(item.total.mul(orderTaxRate).div(100)).toDecimalPlaces(2);
      return { ...item, taxAmount, total, subtotal: total };
    }),
    subtotal: summary.subtotal,
    totalDiscount: summary.totalDiscount,
    totalTax,
    total,
  };
}
