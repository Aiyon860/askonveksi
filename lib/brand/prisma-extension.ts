import { Prisma } from "@prisma/client";

import type { Brand } from "./config";
import { customerScopeFor, isBrand } from "./config";
import { resolveRequestBrandOrAll } from "./request-brand";
import { brandScopeArgs, brandScopedWhere, withBrandField } from "./scoped-args";

/**
 * Kunci penanda scope yang dititipkan pada argumen query.
 *
 * AsyncLocalStorage TIDAK bisa dipakai untuk mengarahkan ekstensi ini: Prisma
 * menjalankan handler `$allOperations` di luar konteks async pemanggil, jadi
 * `runWithBrand`/`runWithAllBrands` tidak pernah terbaca. Penanda pada `args`
 * ikut bersama query-nya sendiri sehingga aman untuk request paralel.
 */
const BRAND_SCOPE_KEY = "__brandScopeOverride";

type BrandScopeOverride = Brand | "ALL";

function withBrandScope<const T extends object>(args: T, scope: BrandScopeOverride): T {
  // Penanda yang lebih spesifik (mis. `allBrands` di dalam blok ter-scope)
  // tidak boleh ditimpa oleh scope blok.
  const existing = (args as Record<string, unknown>)[BRAND_SCOPE_KEY];
  if (existing === "ALL" || isBrand(existing)) return args;
  return { ...args, [BRAND_SCOPE_KEY]: scope } as T;
}

/** Query lintas brand yang disengaja (mis. cek kode customer unik global). */
export function allBrands<const T extends object>(args: T): T {
  return withBrandScope(args, "ALL");
}

/** Query untuk brand tertentu tanpa bergantung pada cookie/request aktif. */
export function forBrand<const T extends object>(brand: Brand, args: T): T {
  return withBrandScope(args, brand);
}

/**
 * Membungkus client Prisma yang sudah ada agar setiap query memakai brand
 * eksplisit, tanpa membuat koneksi/pool baru. Dipakai oleh cached function yang
 * berjalan di luar request (cookie tidak tersedia) dan oleh blok lintas brand.
 */
export function brandScopedClient<T extends object>(client: T, scope: Brand | "ALL"): T {
  const target = client as Record<string, unknown>;

  return new Proxy(target, {
    get(current, property, receiver) {
      const value = Reflect.get(current, property, receiver);

      if (property === "$transaction") {
        if (typeof value !== "function") return value;
        return (arg: unknown, options?: unknown) => {
          const transaction = value as (
            input: unknown,
            config?: unknown,
          ) => unknown;
          if (typeof arg === "function") {
            return transaction.call(
              current,
              (tx: object) => (arg as (tx: object) => unknown)(brandScopedClient(tx, scope)),
              options,
            );
          }
          return transaction.call(current, arg, options);
        };
      }

      if (typeof value === "function") return value.bind(current);

      // Hanya delegate model (punya findMany) yang perlu disisipi penanda.
      if (
        value &&
        typeof value === "object" &&
        typeof (value as { findMany?: unknown }).findMany === "function"
      ) {
        return new Proxy(value, {
          get(modelTarget, method, modelReceiver) {
            const operation = Reflect.get(modelTarget, method, modelReceiver);
            if (typeof operation !== "function") return operation;
            return (args?: unknown) => {
              // Argumen kosong (mis. `findMany()`) tetap harus membawa penanda;
              // tanpa itu query jatuh ke brand default request (ASKONVEKSI).
              const nextArgs = withBrandScope(brandScopeArgs(args), scope);
              return (operation as (input?: unknown) => unknown).call(modelTarget, nextArgs);
            };
          },
        });
      }

      return value;
    },
  }) as T;
}

/**
 * Model yang punya kolom `brand` sendiri.
 * Customer memakai `brandScope` karena satu customer boleh muncul di dua brand.
 */
const DIRECT_BRAND_MODELS = new Set([
  "Opportunity",
  "PurchaseOrder",
  "Invoice",
  "SalesOrder",
  "ProductionWorkOrder",
  "Expense",
  "CustomerReminder",
  "CommunicationActivity",
  "AuditEvent",
  "BusinessProfile",
  "InvoiceSettingPoint",
  "ProductCategory",
  "WhatsAppAccount",
  "WhatsAppTemplate",
  "WhatsAppConversation",
  "WhatsAppCampaign",
  "WhatsAppAutomationJob",
]);

/**
 * Model anak tidak punya kolom brand; filternya mengikuti induk.
 * Ini membuat query yang dimulai dari tabel anak (mis. paymentTransaction)
 * tetap terkurung pada brand yang sedang aktif.
 */
const RELATION_BRAND_SCOPES: Record<string, (brand: Brand) => Record<string, unknown>> = {
  PurchaseOrderDeposit: (brand) => ({ purchaseOrder: { brand } }),
  DesignTask: (brand) => ({ purchaseOrder: { brand } }),
  DesignRevision: (brand) => ({ designTask: { purchaseOrder: { brand } } }),
  DesignAttachment: (brand) => ({ designRevision: { designTask: { purchaseOrder: { brand } } } }),
  PurchaseOrderItem: (brand) => ({ purchaseOrder: { brand } }),
  PurchaseOrderItemDesign: (brand) => ({ item: { purchaseOrder: { brand } } }),
  PurchaseOrderSize: (brand) => ({ purchaseOrder: { brand } }),
  PurchaseOrderRosterEntry: (brand) => ({ purchaseOrder: { brand } }),
  PurchaseOrderAttachment: (brand) => ({ purchaseOrder: { brand } }),
  InvoiceItem: (brand) => ({ invoice: { brand } }),
  InvoiceItemAddon: (brand) => ({ invoiceItem: { invoice: { brand } } }),
  InvoiceAddon: (brand) => ({ invoice: { brand } }),
  SalesOrderItem: (brand) => ({ salesOrder: { brand } }),
  SalesOrderCost: (brand) => ({ salesOrder: { brand } }),
  SalesOrderProductCost: (brand) => ({ salesOrder: { brand } }),
  ProductionStep: (brand) => ({ workOrder: { brand } }),
  ProductionActivity: (brand) => ({ workOrder: { brand } }),
  DealPayment: (brand) => ({ salesOrder: { brand } }),
  PendingDealPayment: (brand) => ({ invoice: { brand } }),
  PendingPaymentTerm: (brand) => ({ pendingPayment: { invoice: { brand } } }),
  PaymentTerm: (brand) => ({ payment: { salesOrder: { brand } } }),
  PaymentTransaction: (brand) => ({ payment: { salesOrder: { brand } } }),
  CustomerReminderReceipt: (brand) => ({ reminder: { brand } }),
  WhatsAppMessage: (brand) => ({ conversation: { brand } }),
  WhatsAppCampaignRecipient: (brand) => ({ campaign: { brand } }),
};

function scopeFor(model: string, brand: Brand): Record<string, unknown> | null {
  if (model === "Customer") return { brandScope: { in: customerScopeFor(brand) } };
  if (DIRECT_BRAND_MODELS.has(model)) return { brand };
  const relation = RELATION_BRAND_SCOPES[model];
  return relation ? relation(brand) : null;
}

function omitBrandScopeKey(args: Record<string, unknown>) {
  const rest = { ...args };
  delete rest[BRAND_SCOPE_KEY];
  return rest;
}

/**
 * Semua query Prisma otomatis dibatasi ke brand aktif. Ini satu-satunya
 * pengaman lintas 50+ file data/aksi tanpa harus menambahkan `where: { brand }`
 * di ratusan tempat. Query mentah (`$queryRaw`) tetap wajib menambahkan filter
 * brand sendiri.
 */
export const brandScopeExtension = Prisma.defineExtension({
  name: "brand-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Cast ke string agar TypeScript tidak mempersempit tipe union `model`
        // (dan `query`) menjadi never setelah pengecekan berikut.
        const modelName = model as string | undefined;
        const rawArgs = brandScopeArgs(args);
        const override = rawArgs[BRAND_SCOPE_KEY];
        const hasOverride = override === "ALL" || isBrand(override);
        // Buang penanda sebelum query diteruskan ke Prisma.
        const cleanArgs = hasOverride ? omitBrandScopeKey(rawArgs) : rawArgs;

        // Tabel tanpa kolom brand (mis. AppUser, absensi) tidak perlu membaca
        // cookie/header sama sekali.
        const isScoped = Boolean(modelName) && (
          modelName === "Customer" ||
          DIRECT_BRAND_MODELS.has(modelName!) ||
          modelName! in RELATION_BRAND_SCOPES
        );
        if (!isScoped) return query(cleanArgs);
        if (override === "ALL") return query(cleanArgs);

        const context = isBrand(override) ? override : await resolveRequestBrandOrAll();
        if (context === "ALL") return query(cleanArgs);

        const brand = context;
        const scope = scopeFor(modelName!, brand);
        if (!scope) return query(cleanArgs);
        const brandField = modelName === "Customer" ? "brandScope" : "brand";

        const nextArgs = { ...cleanArgs };

        const scopedWhere = brandScopedWhere(operation, nextArgs.where, scope);
        if (scopedWhere !== undefined) nextArgs.where = scopedWhere;

        if (operation === "create") {
          if (modelName === "Customer" || DIRECT_BRAND_MODELS.has(modelName!)) {
            nextArgs.data = withBrandField((nextArgs.data ?? {}) as Record<string, unknown>, brand, brandField);
          }
        }

        if (operation === "createMany") {
          if (modelName === "Customer" || DIRECT_BRAND_MODELS.has(modelName!)) {
            const data = nextArgs.data;
            nextArgs.data = Array.isArray(data)
              ? data.map((item) => withBrandField(item as Record<string, unknown>, brand, brandField))
              : withBrandField((data ?? {}) as Record<string, unknown>, brand, brandField);
          }
        }

        if (operation === "upsert") {
          if (modelName === "Customer" || DIRECT_BRAND_MODELS.has(modelName!)) {
            nextArgs.create = withBrandField((nextArgs.create ?? {}) as Record<string, unknown>, brand, brandField);
          }
        }

        return query(nextArgs);
      },
    },
  },
});
