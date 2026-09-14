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
};

export function calculateInvoiceLines(items: InvoicePricingInput[], profitPercent: string, discountPercent: string) {
  const orderProfitPercent = new Prisma.Decimal(profitPercent);
  if (orderProfitPercent.gt(100)) throw new UserFacingError("Keuntungan maksimal 100%.");
  const orderDiscountPercent = new Prisma.Decimal(discountPercent);
  if (orderDiscountPercent.gt(100)) throw new UserFacingError("Diskon maksimal 100%.");

  const calculatedItems = items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);

    const grossAmount = unitPrice.mul(item.quantity).toDecimalPlaces(2);
    const profitAmount = grossAmount.mul(orderProfitPercent).div(100).toDecimalPlaces(2);
    const amountBeforeDiscount = grossAmount.add(profitAmount);
    const discountAmount = amountBeforeDiscount.mul(orderDiscountPercent).div(100).toDecimalPlaces(2);
    const total = amountBeforeDiscount.sub(discountAmount);

    return {
      position,
      productName: item.productName,
      size: item.size,
      sleeveLength: item.sleeveLength,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      grossAmount,
      discountPercent: orderDiscountPercent,
      discountCapAmount: null,
      discountAmount,
      profitPercent: orderProfitPercent,
      profitAmount,
      total,
      subtotal: total,
      purchaseOrderSizeId: item.purchaseOrderSizeId,
    };
  });

  const summary = calculatedItems.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal.add(item.grossAmount),
      totalDiscount: acc.totalDiscount.add(item.discountAmount),
      totalProfit: acc.totalProfit.add(item.profitAmount),
      total: acc.total.add(item.total),
    }),
    {
      subtotal: new Prisma.Decimal(0),
      totalDiscount: new Prisma.Decimal(0),
      totalProfit: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  );

  return {
    items: calculatedItems,
    subtotal: summary.subtotal,
    totalDiscount: summary.totalDiscount,
    totalProfit: summary.totalProfit,
    discountPercent: orderDiscountPercent,
    total: summary.total,
  };
}
