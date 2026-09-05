import { configureLegacyProductionAction } from "@/app/actions/production";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type LegacyOrder = { id: string; salesOrderNo: string; snapshotCustomerName: string; quantity: number; deadline: string | null; opportunity: { title: string; productName: string | null } };

export function LegacyProductionSetup({ orders }: { orders: LegacyOrder[] }) {
  if (!orders.length) return null;
  return (
    <section aria-labelledby="legacy-production-title" className="rounded-xl border bg-warning/5 p-4">
      <h2 id="legacy-production-title" className="font-semibold">Perlu disiapkan</h2>
      <p className="mt-1 text-sm text-muted-foreground">{orders.length} Sales Order aktif dibuat sebelum modul Produksi tersedia.</p>
      <div className="mt-4 flex flex-col gap-2">
        {orders.map((order) => (
          <details key={order.id} className="rounded-lg border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">{order.salesOrderNo} · {order.snapshotCustomerName}</summary>
            <form action={configureLegacyProductionAction} className="mt-4">
              <input type="hidden" name="salesOrderId" value={order.id} />
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field><FieldLabel htmlFor={`legacy-product-${order.id}`} required>Produk</FieldLabel><Input id={`legacy-product-${order.id}`} name="productionProductName" required defaultValue={order.opportunity.productName ?? order.opportunity.title} /></Field>
                  <Field><FieldLabel htmlFor={`legacy-route-${order.id}`} required>Jalur</FieldLabel><NativeSelect id={`legacy-route-${order.id}`} name="productionRoute" className="w-full"><NativeSelectOption value="JERSEY">Jersey</NativeSelectOption><NativeSelectOption value="NON_JERSEY">Non-Jersey</NativeSelectOption></NativeSelect></Field>
                  <Field><FieldLabel htmlFor={`legacy-deadline-${order.id}`} required>Deadline</FieldLabel><Input id={`legacy-deadline-${order.id}`} name="productionDeadline" type="date" required defaultValue={order.deadline?.slice(0, 10) ?? ""} /></Field>
                </div>
                <Button type="submit" className="w-fit">Buat Work Order · {order.quantity} pcs</Button>
              </FieldGroup>
            </form>
          </details>
        ))}
      </div>
    </section>
  );
}
