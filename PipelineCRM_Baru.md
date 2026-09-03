# New session - 2026-09-01T13:55:23.963Z

**Session ID:** ses_fa2bf2f44ffeCGTWQ7tPtiCMvS
**Created:** 9/1/2026, 8:55:23 PM
**Updated:** 9/1/2026, 9:23:17 PM

---

## User

cek projek Konveksi ini bagian Pipeline CRM. akan ada banyak perubahan yaitu kanbannya akan diubah menjadi Lead Baru, Follow Up, Negosiasi, Deal, Lost. card kanbannya itu akan berisi Data Customer untuk bagian Lead Baru saja karena Negosiasi, Deal, Lost itu akan berisi data Purchase Ordernya. jadi niat saya Lead Baru teks judul warna biru akan diisi nama customer dan itu akan digunakan terus-menerus hingga Lost sedangkan bawahnya yang teks abu-abu persis itu berisi Purchase Ordernya yaitu apa saja permintaan customer seperti Kemeja 30pcs. nah ketika Nama Customer warna biru di klik akan menampilkan detail dari Purchase Order seperti ukuran, desain, warna, bahan, dan lain-lain yang seharusnya ada. namun ketika Lead Baru dia kan belum memesan jadi hanya Nama Customer biru dengan bawahnya masih kosong. Purchase Order abu-abu akan muncul ketika proses Negosiasi selesai. nah jika Negosisasi terbengkalai atau terlalu lama didiamkan maka card kanban bisa dipindah ke Follow Up jika langsung selesai setuju maka masuk ke Deal untuk DP Customer lalu jika menolak maka Lost dan bisa juga Follow Up tanpa ada data Purchase Ordernya ketika saat Lead Baru dia menghilang. lalu saya berpikir di dalam detail ketika menekan teks biru akan menampilkan Purchase Order dan juga Invoice/Penawaran harga karena di bagian Negosiasi kan, jika setuju maka Deal jika tidak bisa Follow Up jika masih gagal bisa Lost. Bagaimana menurut anda? bagaimana saran anda?

---

## Assistant (Plan · Big Pickle · 91.8s)

_Thinking:_

Saya perlu memahami struktur proyek Konveksi ini terlebih dahulu. Saya akan mencari tahu bagian pipeline CRM dan strukturnya.

**Tool: task**

**Input:**
```json
{
  "description": "Explore CRM pipeline structure",
  "prompt": "Explore the codebase to understand the CRM pipeline implementation. Look for:\n1. The main CRM pipeline page/route (likely under src/app or app directory)\n2. Kanban board components - find where columns/cards are defined\n3. Prisma schema - find the database models related to CRM, customers, purchase orders\n4. Any existing types/interfaces for the pipeline stages\n5. Components directory structure\n\nReturn:\n- File paths for all relevant files\n- The current kanban columns/stages\n- The database schema for CRM-related tables\n- How the kanban cards currently display data\n- The component hierarchy for the pipeline page\n\nBe thorough - check src/app, app, src/components, prisma/schema.prisma, and any related directories.",
  "subagent_type": "explore"
}
```

**Output:**
```
<task id="ses_fa2bf1aadffeAvMIkfM1qCPVRb" state="completed">
<task_result>
Here is a comprehensive report of the CRM pipeline implementation.

---

## 1. Main CRM Pipeline Page/Route

**Primary Pipeline Page:**
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/page.tsx` -- The main Kanban pipeline page at route `/crm`

**Other CRM Routes:**
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/follow-up/page.tsx` -- Follow-up center at `/crm/follow-up`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/page.tsx` -- Customer list at `/crm/pelanggan`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/[id]/page.tsx` -- Customer detail at `/crm/pelanggan/:id`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/peluang/[id]/page.tsx` -- Opportunity detail at `/crm/peluang/:id`

**Server Actions:**
- `/home/mandf/SobatTi/Konveksi/app/actions/crm.ts` -- All CRM mutations (createLeadAction, moveOpportunityStageAction, createQuotationDraftAction, acceptQuotationAndDealAction, etc.)

**API Routes:**
- `/home/mandf/SobatTi/Konveksi/app/api/crm/quotation/[id]/pdf/route.ts` -- Quotation PDF generation
- `/home/mandf/SobatTi/Konveksi/app/api/crm/quotation/[id]/acceptance-proof/route.ts` -- Acceptance proof image serving

---

## 2. Kanban Board Components

**Core Kanban Files:**
- `/home/mandf/SobatTi/Konveksi/components/crm/pipeline-board.tsx` -- The main Kanban board (client component, 267 lines)
- `/home/mandf/SobatTi/Konveksi/components/crm/pipeline-summary.tsx` -- Summary stats bar above the board (server component)
- `/home/mandf/SobatTi/Konveksi/components/crm/stage-theme.ts` -- Visual theme mapping for each stage (surface/text/summary CSS classes)
- `/home/mandf/SobatTi/Konveksi/components/status-badge.tsx` -- OpportunityStatusBadge, QuotationStatusBadge, SalesOrderStatusBadge, CustomerActivityBadge

---

## 3. Current Kanban Columns/Stages

Defined in `/home/mandf/SobatTi/Konveksi/lib/crm/constants.ts` as `PIPELINE_STAGES` and the Prisma enum `OpportunityStage`:

| # | Stage Enum Value | Label (Indonesian) | Theme Color |
|---|---|---|---|
| 1 | `LEAD_BARU` | Lead Baru | `info` (blue) |
| 2 | `DIHUBUNGI` | Dihubungi | `info` (blue) |
| 3 | `KEBUTUHAN_TERGALI` | Kebutuhan Tergali | `highlight` |
| 4 | `PENAWARAN` | Penawaran | `highlight` |
| 5 | `FOLLOW_UP` | Follow Up | `warning` |
| 6 | `NEGOSIASI` | Negosiasi | `warning` |
| 7 | `DEAL` | Deal | `success` (green) |
| 8 | `LOST` | Lost | `destructive` (red) |

Open stages (non-terminal): `LEAD_BARU`, `DIHUBUNGI`, `KEBUTUHAN_TERGALI`, `PENAWARAN`, `FOLLOW_UP`, `NEGOSIASI` (defined in `OPEN_STAGES` constant).

---

## 4. Prisma Schema -- CRM-Related Tables

**Full schema at:** `/home/mandf/SobatTi/Konveksi/prisma/schema.prisma`

**CRM-specific models (with key relationships):**

- **`Customer`** -- Core customer entity (id, customerNo, name, companyName, whatsapp, email, instagram, address, city, notes, customerTypeId, leadSourceId, salesPicId, archivedAt, version)
- **`Opportunity`** -- A sales opportunity/peluang (id, opportunityNo, customerId, title, stage [OpportunityStage], leadSourceId, salesPicId, productName, needPurpose, designStatus, specification, customerBudget, leadScore, estimatedQuantity, estimatedValue, deadline, lastContactedAt, nextAction, nextActionAt, publicSubmissionKey, cancelReason, version)
- **`CustomerType`** -- Lookup table for customer classification
- **`LeadSource`** -- Lookup table for lead sources
- **`Quotation`** -- Quotation with revision tracking (id, quotationNo, opportunityId, revision, status [QuotationStatus], snapshot fields, discountType, discountValue, subtotal, total, issuedAt, acceptedAt, acceptanceReference, acceptanceProof fields)
- **`QuotationItem`** -- Line items for quotations (position, description, quantity, unitPrice, subtotal)
- **`SalesOrder`** -- Immutable order created upon quotation acceptance (id, salesOrderNo, opportunityId, quotationId, status [SalesOrderStatus], snapshot fields, totals, cancelledAt, cancelReason)
- **`SalesOrderItem`** -- Line items for sales orders
- **`CommunicationActivity`** -- Communication timeline entries (customerId, opportunityId, authorId, kind, channel, direction, systemEvent, content, metadata, occurredAt)
- **`CustomerReminder`** -- Repeat order and reactivation reminders (customerId, sourceSalesOrderId, type, dueAt, resolvedAt)
- **`AuditEvent`** -- Audit trail for all mutations
- **`AppUser`** -- Users with role (OWNER/ADMIN/SALES) and sales PIC assignments
- **`SequenceCounter`** -- Auto-incrementing number sequences for CUS-XXXXXX, OPP-XXXXXX, QT-YYYY-XXXXX, SALES-ORDER-YYYY-XXXXX

**Key enums:**
- `OpportunityStage`: LEAD_BARU, DIHUBUNGI, KEBUTUHAN_TERGALI, PENAWARAN, FOLLOW_UP, NEGOSIASI, DEAL, LOST
- `DesignStatus`: SUDAH_ADA, BELUM_ADA, PERLU_DIBANTU
- `DiscountType`: NONE, NOMINAL, PERCENTAGE
- `QuotationStatus`: DRAFT, ISSUED, ACCEPTED, SUPERSEDED
- `SalesOrderStatus`: ACTIVE, CANCELLED
- `CommunicationChannel`: WHATSAPP, INSTAGRAM, PHONE, EMAIL, MEETING, OTHER
- `CommunicationDirection`: INBOUND, OUTBOUND
- `CommunicationActivityKind`: COMMUNICATION, INTERNAL_NOTE, SYSTEM
- `CommunicationSystemEvent`: STAGE_CHANGED, QUOTATION_ISSUED, DEAL_ORDER_CREATED, SALES_ORDER_CANCELLED

---

## 5. How Kanban Cards Display Data

Each card in `pipeline-board.tsx` renders a `PipelineOpportunity` (type defined in `/home/mandf/SobatTi/Konveksi/lib/crm/data.ts`):

**Card structure (from top to bottom):**
1. **CardHeader:**
   - `CardTitle`: Opportunity title (linked to `/crm/peluang/:id`)
   - `CardDescription`: Customer name
   - `CardAction`: GripVertical drag handle icon

2. **CardContent:**
   - **Badge row**: `OpportunityStatusBadge` (colored by stage), lead classification (HOT/WARM/COLD) + score, opportunity number (monospace)
   - **Key-value details**:
     - `Estimasi` -- estimated value formatted as IDR currency
     - `Next action` -- text + datetime (if set), with CalendarClock icon
     - `PIC` -- sales person name (if assigned)
     - Activity count -- with NotebookText icon
   - **"Ubah status" button** -- triggers the stage-change dialog

**Optimistic UI**: Cards use `useOptimistic` for instant stage transitions during drag-and-drop. A `useTransition` wraps the server action call.

**Drag-and-drop**: Native HTML5 DnD with a cloned drag image. Cards are `draggable` unless the stage is `DEAL`. The `handleDrop` extracts the opportunity ID from `dataTransfer` and opens a confirmation dialog.

**Stage-move confirmation dialog:**
- For non-DEAL/non-LOST moves: shows a NativeSelect with all stages (DEAL disabled), plus optional cancel reason for LOST
- For DEAL: shows a message that deal must be created through the quotation flow, with a link to the opportunity detail page

---

## 6. Component Hierarchy for the Pipeline Page

```
app/(app)/crm/page.tsx  [Server Component - CRMPage]
  |
  +-- PageHeader  [title: "Pipeline CRM", description, action: NewLeadForm]
  |     +-- NewLeadForm  [Client Component - dialog for creating new leads]
  |           +-- CustomerFields  [existing/new customer selection]
  |           +-- OpportunityFields  [opportunity details form]
  |
  +-- PageMessage  [flash messages]
  |
  +-- PipelineSummary  [Server Component - stage count summary bar]
  |     +-- Renders total count + per-stage counts using PIPELINE_STAGES iteration
  |     +-- Uses STAGE_SUMMARY_CLASS and STAGE_TEXT_CLASS for coloring
  |
  +-- Alert (conditional)  [if truncated > 500 opportunities]
  |
  +-- PipelineBoard  [Client Component - the Kanban board]
        +-- Error Alert (if moveError)
        +-- In-progress spinner overlay
        +-- Horizontal scrollable grid of columns:
        |     For each stage in PIPELINE_STAGES:
        |       +-- <section> (column with drop zone)
        |       |     +-- Stage header (label + count)
        |       |     +-- Cards list:
        |       |           +-- Card (per opportunity)
        |       |           |     +-- CardHeader (title link, customer name, grip icon)
        |       |           |     +-- CardContent
        |       |           |           +-- Badge row (stage badge, lead score, opp number)
        |       |           |           +-- Detail list (estimated value, next action, PIC, activity count)
        |       |           |           +-- "Ubah status" button
        |       |           +-- Empty state (if no items)
        |
        +-- Dialog (stage change confirmation)
              +-- Form or DEAL redirect link
```

---

## 7. All CRM-Related File Paths

### Routes / Pages
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/page.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/loading.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/follow-up/page.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/follow-up/loading.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/follow-up/error.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/page.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/loading.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/[id]/page.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/pelanggan/[id]/loading.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/peluang/[id]/page.tsx`
- `/home/mandf/SobatTi/Konveksi/app/(app)/crm/peluang/[id]/loading.tsx`

### Server Actions
- `/home/mandf/SobatTi/Konveksi/app/actions/crm.ts`

### API Routes
- `/home/mandf/SobatTi/Konveksi/app/api/crm/quotation/[id]/pdf/route.ts`
- `/home/mandf/SobatTi/Konveksi/app/api/crm/quotation/[id]/acceptance-proof/route.ts`

### Components (CRM-specific)
- `/home/mandf/SobatTi/Konveksi/components/crm/pipeline-board.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/pipeline-summary.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/stage-theme.ts`
- `/home/mandf/SobatTi/Konveksi/components/crm/new-lead-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/opportunity-fields.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/opportunity-stage-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/customer-fields.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/new-customer-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/edit-customer-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/quotation-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/communication-entry-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/communication-history.tsx`
- `/home/mandf/SobatTi/Konveksi/components/crm/follow-up-result-form.tsx`
- `/home/mandf/SobatTi/Konveksi/components/status-badge.tsx`

### Shared Components (used by CRM)
- `/home/mandf/SobatTi/Konveksi/components/page-header.tsx`
- `/home/mandf/SobatTi/Konveksi/components/page-message.tsx`
- `/home/mandf/SobatTi/Konveksi/components/data-pagination.tsx`
- `/home/mandf/SobatTi/Konveksi/components/debounced-search-input.tsx`
- `/home/mandf/SobatTi/Konveksi/components/submit-button.tsx`
- `/home/mandf/SobatTi/Konveksi/components/confirm-submit-button.tsx`
- `/home/mandf/SobatTi/Konveksi/components/loading-skeletons.tsx`

### Library (CRM business logic)
- `/home/mandf/SobatTi/Konveksi/lib/crm/constants.ts` -- PIPELINE_STAGES, STAGE_LABEL, OPEN_STAGES, leadClassification, all label maps
- `/home/mandf/SobatTi/Konveksi/lib/crm/data.ts` -- All data fetching functions (getPipelineData, getCustomers, getCustomerDetail, getOpportunityDetail, getFollowUpData, getSalesDashboardData, etc.) and PipelineOpportunity type
- `/home/mandf/SobatTi/Konveksi/lib/crm/validation.ts` -- Zod schemas for all CRM forms
- `/home/mandf/SobatTi/Konveksi/lib/crm/format.ts` -- formatCurrency, formatDate, whatsappHref, toDateTimeLocalValue
- `/home/mandf/SobatTi/Konveksi/lib/crm/numbers.ts` -- Sequence number generators (CUS-XXXXXX, OPP-XXXXXX, etc.)
- `/home/mandf/SobatTi/Konveksi/lib/crm/reminder-types.ts` -- CustomerActivityStatus type and activityStatusFromSchedule
- `/home/mandf/SobatTi/Konveksi/lib/crm/reminder-data.ts` -- Repeat order draft data
- `/home/mandf/SobatTi/Konveksi/lib/crm/reminders.ts` -- Reminder scheduling logic
- `/home/mandf/SobatTi/Konveksi/lib/crm/quotation-pdf.ts` -- Quotation PDF generation

### Database
- `/home/mandf/SobatTi/Konveksi/prisma/schema.prisma` -- Full Prisma schema (390 lines)
- `/home/mandf/SobatTi/Konveksi/prisma/migrations/20260827000000_crm_v1/migration.sql` -- CRM v1 migration
- `/home/mandf/SobatTi/Konveksi/prisma/migrations/20260831000000_crm_v1_gap/migration.sql` -- CRM v1 gap migration
</task_result>
</task>
```

---

## Assistant (Plan · Big Pickle · 4.9s)

_Thinking:_

Great, now I have a comprehensive understanding of the current CRM pipeline structure. Let me analyze the user's proposal and provide feedback.

Current state:
- 8 stages: Lead Baru, Dihubungi, Kebutuhan Tergali, Penawaran, Follow Up, Negosiasi, Deal, Lost
- Cards show: Opportunity title, customer name, status badge, lead score, estimated value, next action, PIC, activity count

User's proposed changes:
1. Simplify stages to 5: Lead Baru, Follow Up, Negosiasi, Deal, Lost
2. Card redesign:
   - Lead Baru: Blue text (customer name) + gray text below (PO items like "Kemeja 30pcs")
   - Negosiasi, Deal, Lost: Show PO data
   - Follow Up: Can have or not have PO data
3. Customer name (blue text) is persistent throughout all stages until Lost
4. Clicking customer name shows PO detail (size, design, color, material, etc.)
5. In Lead Baru: only customer name, PO area is empty
6. PO appears after negotiation is complete
7. Detail view shows PO + Invoice/price quotation

Let me think about this more carefully and provide a well-structured analysis.

The user's proposal is actually quite well thought out. Let me analyze the implications:

**Stage Simplification (8 → 5 stages)**
- Removes: Dihubungi, Kebutuhan Tergali, Penawaran
- The idea is that these sub-stages get folded into the main stages
- This is a significant simplification that makes sense for a konveksi business

**Card Redesign**
- The card becomes more focused on the customer name as the primary identifier
- PO details (items requested) become secondary information
- This is cleaner and more intuitive

**Detail View**
- Clicking the customer name opens a detail panel showing PO + Quotation
- This creates a natural flow: Lead Baru (name only) → Negosiasi (PO + Quotation) → Deal (PO + Order)

Let me read the key files to understand the current implementation better before providing my analysis.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/pipeline-board.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/pipeline-board.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import Link from "next/link";
4: import { useRouter } from "next/navigation";
5: import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
6: import { CalendarClock, GripVertical, NotebookText, PackageCheck } from "lucide-react";
7: import type { OpportunityStage } from "@prisma/client";
8: 
9: import { moveOpportunityStageOptimisticAction } from "@/app/actions/crm";
10: import { STAGE_SURFACE_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
11: import { OpportunityStatusBadge } from "@/components/status-badge";
12: import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
13: import { Button } from "@/components/ui/button";
14: import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
15: import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
16: import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
17: import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
18: import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
19: import { Spinner } from "@/components/ui/spinner";
20: import { Textarea } from "@/components/ui/textarea";
21: import { leadClassification, PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
22: import type { PipelineOpportunity } from "@/lib/crm/data";
23: import { formatCurrency, formatDate } from "@/lib/crm/format";
24: import { cn } from "@/lib/utils";
25: 
26: type PendingMove = { opportunity: PipelineOpportunity; stage: OpportunityStage };
27: 
28: export function PipelineBoard({ opportunities }: { opportunities: PipelineOpportunity[] }) {
29:   const router = useRouter();
30:   const [boardOpportunities, moveOptimistically] = useOptimistic(
31:     opportunities,
32:     (current, move: { opportunityId: string; stage: OpportunityStage }) =>
33:       current.map((item) => item.id === move.opportunityId ? { ...item, stage: move.stage } : item),
34:   );
35:   const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
36:   const [moveError, setMoveError] = useState<string | null>(null);
37:   const [isMoving, startMoving] = useTransition();
38:   const dragImageRef = useRef<HTMLElement | null>(null);
39: 
40:   function removeDragImage() {
41:     dragImageRef.current?.remove();
42:     dragImageRef.current = null;
43:   }
44: 
45:   useEffect(() => removeDragImage, []);
46: 
47:   function requestMove(opportunity: PipelineOpportunity, stage: OpportunityStage) {
48:     if (opportunity.stage === stage) return;
49:     setPendingMove({ opportunity, stage });
50:   }
51: 
52:   function handleDrop(event: React.DragEvent, stage: OpportunityStage) {
53:     event.preventDefault();
54:     const id = event.dataTransfer.getData("text/opportunity-id");
55:     const opportunity = boardOpportunities.find((item) => item.id === id);
56:     if (opportunity) requestMove(opportunity, stage);
57:   }
58: 
59:   function confirmMove(event: React.FormEvent<HTMLFormElement>) {
60:     event.preventDefault();
61:     if (!pendingMove) return;
62: 
63:     const data = new FormData(event.currentTarget);
64:     const { opportunity, stage } = pendingMove;
65:     setMoveError(null);
66:     setPendingMove(null);
67: 
68:     startMoving(async () => {
69:       moveOptimistically({ opportunityId: opportunity.id, stage });
70:       const result = await moveOpportunityStageOptimisticAction(data);
71:       if (!result.ok) {
72:         setMoveError(result.message);
73:         return;
74:       }
75:       router.refresh();
76:     });
77:   }
78: 
79:   return (
80:     <>
81:       <div className="relative">
82:         {moveError ? (
83:           <Alert variant="destructive" className="mb-3">
84:             <AlertTitle>Status dikembalikan</AlertTitle>
85:             <AlertDescription>{moveError}</AlertDescription>
86:           </Alert>
87:         ) : null}
88:         {isMoving ? (
89:           <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs shadow-sm" role="status">
90:             <Spinner /> Memindahkan status...
91:           </div>
92:         ) : null}
93:         <div className="grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3">
94:           {PIPELINE_STAGES.map((stage) => {
95:             const items = boardOpportunities.filter((opportunity) => opportunity.stage === stage);
96:             return (
97:               <section
98:                 key={stage}
99:                 aria-labelledby={`stage-${stage}`}
100:                 onDragOver={(event) => event.preventDefault()}
101:                 onDrop={(event) => handleDrop(event, stage)}
102:                 className={cn("min-h-[24rem] rounded-xl border p-2", STAGE_SURFACE_CLASS[stage])}
103:               >
104:                 <div className="flex items-center justify-between gap-3 px-2 py-2">
105:                   <h2 id={`stage-${stage}`} className={cn("text-sm font-semibold", STAGE_TEXT_CLASS[stage])}>{STAGE_LABEL[stage]}</h2>
106:                   <span className="font-mono text-xs tabular-nums text-muted-foreground">{items.length}</span>
107:                 </div>
108:                 <div className="flex flex-col gap-2">
109:                   {items.length ? items.map((opportunity) => (
110:                     <Card
111:                       key={opportunity.id}
112:                       size="sm"
113:                       draggable={!isMoving && opportunity.stage !== "DEAL"}
114:                       onDragStart={(event) => {
115:                         event.dataTransfer.effectAllowed = "move";
116:                         event.dataTransfer.setData("text/opportunity-id", opportunity.id);
117: 
118:                         removeDragImage();
119: 
120:                         const card = event.currentTarget;
121:                         const bounds = card.getBoundingClientRect();
122:                         const computedStyle = window.getComputedStyle(card);
123:                         const dragImage = card.cloneNode(true) as HTMLElement;
124: 
125:                         Object.assign(dragImage.style, {
126:                           position: "fixed",
127:                           top: "0",
128:                           left: "-10000px",
129:                           width: `${bounds.width}px`,
130:                           height: `${bounds.height}px`,
131:                           boxSizing: "border-box",
132:                           margin: "0",
133:                           backgroundColor: computedStyle.backgroundColor,
134:                           borderRadius: computedStyle.borderRadius,
135:                           overflow: "hidden",
136:                           boxShadow: "none",
137:                           outline: "none",
138:                           filter: "none",
139:                           pointerEvents: "none",
140:                         });
141:                         dragImage.setAttribute("aria-hidden", "true");
142:                         dragImage.inert = true;
143:                         document.body.appendChild(dragImage);
144:                         dragImageRef.current = dragImage;
145: 
146:                         event.dataTransfer.setDragImage(
147:                           dragImage,
148:                           event.clientX - bounds.left,
149:                           event.clientY - bounds.top,
150:                         );
151:                       }}
152:                       onDragEnd={removeDragImage}
153:                       className={cn("cursor-default", opportunity.stage !== "DEAL" && "cursor-grab active:cursor-grabbing")}
154:                     >
155:                       <CardHeader>
156:                         <CardTitle>
157:                           <Link href={`/crm/peluang/${opportunity.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
158:                             {opportunity.title}
159:                           </Link>
160:                         </CardTitle>
161:                         <CardDescription>{opportunity.customer.name}</CardDescription>
162:                         <CardAction>
163:                           <GripVertical aria-label="Geser kartu" className="size-4 text-muted-foreground" />
164:                         </CardAction>
165:                       </CardHeader>
166:                       <CardContent>
167:                         <div className="flex flex-wrap items-center gap-2">
168:                           <OpportunityStatusBadge stage={opportunity.stage} />
169:                           <span className="text-xs font-medium">{leadClassification(opportunity.leadScore)} · {opportunity.leadScore}</span>
170:                           <span className="font-mono text-xs text-muted-foreground">{opportunity.opportunityNo}</span>
171:                         </div>
172:                         <dl className="grid gap-2 text-xs text-muted-foreground">
173:                           <div className="flex items-center justify-between gap-3">
174:                             <dt>Estimasi</dt>
175:                             <dd className="font-mono text-foreground">{formatCurrency(opportunity.estimatedValue)}</dd>
176:                           </div>
177:                           {opportunity.nextActionAt ? (
178:                             <div className="flex items-start gap-2">
179:                               <CalendarClock aria-hidden="true" className="size-3.5" />
180:                               <dd>{opportunity.nextAction} · {formatDate(opportunity.nextActionAt, true)}</dd>
181:                             </div>
182:                           ) : null}
183:                           {opportunity.salesPic ? <div className="flex justify-between gap-3"><dt>PIC</dt><dd>{opportunity.salesPic.name}</dd></div> : null}
184:                           <div className="flex items-center gap-2">
185:                             <NotebookText aria-hidden="true" className="size-3.5" />
186:                             <dd>{opportunity.activityCount} aktivitas</dd>
187:                           </div>
188:                         </dl>
189:                         <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPendingMove({ opportunity, stage: opportunity.stage })}>
190:                           Ubah status
191:                         </Button>
192:                       </CardContent>
193:                     </Card>
194:                   )) : (
195:                     <Empty className="min-h-32 p-4">
196:                       <EmptyHeader>
197:                         <EmptyTitle className="text-sm">Belum ada peluang</EmptyTitle>
198:                         <EmptyDescription>Tarik kartu ke kolom ini atau gunakan menu status.</EmptyDescription>
199:                       </EmptyHeader>
200:                     </Empty>
201:                   )}
202:                 </div>
203:               </section>
204:             );
205:           })}
206:         </div>
207:       </div>
208: 
209:       <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(null)}>
210:         <DialogContent>
211:           <DialogHeader>
212:             <DialogTitle>Konfirmasi perubahan status</DialogTitle>
213:             <DialogDescription>
214:               {pendingMove ? `${pendingMove.opportunity.opportunityNo} · ${pendingMove.opportunity.title}` : "Pilih status tujuan."}
215:             </DialogDescription>
216:           </DialogHeader>
217:           {pendingMove ? (
218:             pendingMove.stage === "DEAL" ? (
219:               <div className="flex flex-col gap-4">
220:                 <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
221:                   Deal harus dibuat dari quotation terbit agar snapshot dan Sales Order tercatat atomik.
222:                 </div>
223:                 <Button
224:                   render={<Link href={`/crm/peluang/${pendingMove.opportunity.id}`} />}
225:                   nativeButton={false}
226:                   onClick={() => router.prefetch(`/crm/peluang/${pendingMove.opportunity.id}`)}
227:                 >
228:                   <PackageCheck data-icon="inline-start" aria-hidden="true" />
229:                   Buka detail &amp; quotation
230:                 </Button>
231:               </div>
232:             ) : (
233:               <form onSubmit={confirmMove}>
234:                 <input type="hidden" name="opportunityId" value={pendingMove.opportunity.id} />
235:                 <input type="hidden" name="version" value={pendingMove.opportunity.version} />
236:                 <FieldGroup>
237:                   <Field>
238:                     <FieldLabel htmlFor="stage" required>Status tujuan</FieldLabel>
239:                     <NativeSelect
240:                       id="stage"
241:                       name="stage"
242:                       required
243:                       value={pendingMove.stage}
244:                       onChange={(event) => setPendingMove({ ...pendingMove, stage: event.target.value as OpportunityStage })}
245:                       className="w-full"
246:                     >
247:                       {PIPELINE_STAGES.map((stage) => (
248:                         <NativeSelectOption key={stage} value={stage} disabled={stage === "DEAL"}>{STAGE_LABEL[stage]}{stage === "DEAL" ? " · melalui quotation" : ""}</NativeSelectOption>
249:                       ))}
250:                     </NativeSelect>
251:                   </Field>
252:                   {pendingMove.stage === "LOST" ? (
253:                     <Field>
254:                       <FieldLabel htmlFor="cancelReason" required>Alasan lost</FieldLabel>
255:                       <Textarea id="cancelReason" name="cancelReason" required minLength={2} maxLength={1000} rows={4} defaultValue={pendingMove.opportunity.cancelReason ?? ""} />
256:                     </Field>
257:                   ) : null}
258:                   <Button type="submit">Konfirmasi pindah status</Button>
259:                 </FieldGroup>
260:               </form>
261:             )
262:           ) : null}
263:         </DialogContent>
264:       </Dialog>
265:     </>
266:   );
267: }

(End of file - total 267 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/lib/crm/constants.ts"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/lib/crm/constants.ts</path>
<type>file</type>
<content>
1: import type { OpportunityStage } from "@prisma/client";
2: 
3: export const PIPELINE_STAGES = [
4:   "LEAD_BARU",
5:   "DIHUBUNGI",
6:   "KEBUTUHAN_TERGALI",
7:   "PENAWARAN",
8:   "FOLLOW_UP",
9:   "NEGOSIASI",
10:   "DEAL",
11:   "LOST",
12: ] as const satisfies readonly OpportunityStage[];
13: 
14: export const STAGE_LABEL: Record<OpportunityStage, string> = {
15:   LEAD_BARU: "Lead Baru",
16:   DIHUBUNGI: "Dihubungi",
17:   KEBUTUHAN_TERGALI: "Kebutuhan Tergali",
18:   PENAWARAN: "Penawaran",
19:   FOLLOW_UP: "Follow Up",
20:   NEGOSIASI: "Negosiasi",
21:   DEAL: "Deal",
22:   LOST: "Lost",
23: };
24: 
25: export const OPEN_STAGES: OpportunityStage[] = [
26:   "LEAD_BARU",
27:   "DIHUBUNGI",
28:   "KEBUTUHAN_TERGALI",
29:   "PENAWARAN",
30:   "FOLLOW_UP",
31:   "NEGOSIASI",
32: ];
33: 
34: export const DESIGN_STATUS_LABEL = {
35:   SUDAH_ADA: "Sudah ada",
36:   BELUM_ADA: "Belum ada",
37:   PERLU_DIBANTU: "Perlu dibantu",
38: } as const;
39: 
40: export function leadClassification(score: number) {
41:   if (score >= 80) return "HOT" as const;
42:   if (score >= 50) return "WARM" as const;
43:   return "COLD" as const;
44: }
45: 
46: export const ROLE_LABEL = {
47:   OWNER: "Owner",
48:   ADMIN: "Admin",
49:   SALES: "Sales",
50: } as const;
51: 
52: export const QUOTATION_STATUS_LABEL = {
53:   DRAFT: "Draft",
54:   ISSUED: "Terbit",
55:   ACCEPTED: "Diterima",
56:   SUPERSEDED: "Digantikan",
57: } as const;
58: 
59: export const SALES_ORDER_STATUS_LABEL = {
60:   ACTIVE: "Aktif",
61:   CANCELLED: "Dibatalkan",
62: } as const;
63: 
64: export const COMMUNICATION_CHANNEL_LABEL = {
65:   WHATSAPP: "WhatsApp",
66:   INSTAGRAM: "Instagram",
67:   PHONE: "Telepon",
68:   EMAIL: "Email",
69:   MEETING: "Pertemuan",
70:   OTHER: "Lainnya",
71: } as const;
72: 
73: export const COMMUNICATION_DIRECTION_LABEL = {
74:   INBOUND: "Masuk",
75:   OUTBOUND: "Keluar",
76: } as const;
77: 
78: export const COMMUNICATION_SYSTEM_EVENT_LABEL = {
79:   STAGE_CHANGED: "Perubahan status",
80:   QUOTATION_ISSUED: "Quotation terbit",
81:   DEAL_ORDER_CREATED: "Deal dan Sales Order",
82:   SALES_ORDER_CANCELLED: "Sales Order dibatalkan",
83: } as const;

(End of file - total 83 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/lib/crm/data.ts"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/lib/crm/data.ts</path>
<type>file</type>
<content>
1: import "server-only";
2: 
3: import { Prisma, type AppRole, type OpportunityStage } from "@prisma/client";
4: 
5: import {
6:   analyticsPeriodLabel,
7:   getAnalyticsPeriodBounds,
8:   type AnalyticsPeriod,
9: } from "@/lib/analytics/report-period";
10: import { calculateConversionRate } from "@/lib/analytics/conversion-rate";
11: import {
12:   finalizeSalesPerformanceRows,
13:   type SalesPerformanceRow,
14: } from "@/lib/analytics/sales-performance";
15: import { ANALYTICS_ROLES, USER_ADMIN_ROLES } from "@/lib/auth/permissions";
16: import { requireActor } from "@/lib/auth/session";
17: import { OPEN_STAGES } from "@/lib/crm/constants";
18: import { getPrismaClient } from "@/lib/prisma";
19: 
20: export type PipelineOpportunity = {
21:   id: string;
22:   opportunityNo: string;
23:   title: string;
24:   stage: OpportunityStage;
25:   version: number;
26:   estimatedQuantity: number | null;
27:   estimatedValue: string | null;
28:   deadline: string | null;
29:   leadScore: number;
30:   productName: string | null;
31:   nextAction: string | null;
32:   nextActionAt: string | null;
33:   cancelReason: string | null;
34:   updatedAt: string;
35:   customer: {
36:     id: string;
37:     customerNo: string;
38:     name: string;
39:     companyName: string | null;
40:   };
41:   activityCount: number;
42:   salesPic: { id: string; name: string } | null;
43: };
44: 
45: const opportunitySummarySelect = {
46:   id: true,
47:   opportunityNo: true,
48:   title: true,
49:   stage: true,
50:   version: true,
51:   estimatedQuantity: true,
52:   estimatedValue: true,
53:   deadline: true,
54:   leadScore: true,
55:   productName: true,
56:   nextAction: true,
57:   nextActionAt: true,
58:   cancelReason: true,
59:   updatedAt: true,
60:   customer: {
61:     select: {
62:       id: true,
63:       customerNo: true,
64:       name: true,
65:       companyName: true,
66:     },
67:   },
68:   salesPic: { select: { id: true, name: true } },
69:   _count: { select: { communicationActivities: true } },
70: } satisfies Prisma.OpportunitySelect;
71: 
72: export async function getPipelineData() {
73:   await requireActor();
74:   const prisma = getPrismaClient();
75:   const [rows, total] = await Promise.all([
76:     prisma.opportunity.findMany({
77:       where: { customer: { archivedAt: null } },
78:       select: opportunitySummarySelect,
79:       orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
80:       take: 500,
81:     }),
82:     prisma.opportunity.count({ where: { customer: { archivedAt: null } } }),
83:   ]);
84: 
85:   const opportunities: PipelineOpportunity[] = rows.map((row) => ({
86:     id: row.id,
87:     opportunityNo: row.opportunityNo,
88:     title: row.title,
89:     stage: row.stage,
90:     version: row.version,
91:     estimatedQuantity: row.estimatedQuantity,
92:     estimatedValue: row.estimatedValue?.toString() ?? null,
93:     deadline: row.deadline?.toISOString() ?? null,
94:     leadScore: row.leadScore,
95:     productName: row.productName,
96:     nextAction: row.nextAction,
97:     nextActionAt: row.nextActionAt?.toISOString() ?? null,
98:     cancelReason: row.cancelReason,
99:     updatedAt: row.updatedAt.toISOString(),
100:     customer: row.customer,
101:     activityCount: row._count.communicationActivities,
102:     salesPic: row.salesPic,
103:   }));
104: 
105:   return { opportunities, total, truncated: total > rows.length };
106: }
107: 
108: export async function getCustomerOptions() {
109:   await requireActor();
110:   return getPrismaClient().customer.findMany({
111:     where: { archivedAt: null },
112:     select: { id: true, customerNo: true, name: true, companyName: true },
113:     orderBy: [{ name: "asc" }, { id: "asc" }],
114:     take: 500,
115:   });
116: }
117: 
118: export type CustomerSort = "customerNo" | "name" | "opportunities" | "updatedAt";
119: export type SortDirection = "asc" | "desc";
120: export type CustomerSegment = "all" | "repeat" | "inactive" | "archived";
121: 
122: export async function getCustomers({
123:   query,
124:   segment,
125:   page,
126:   pageSize,
127:   sort,
128:   direction,
129: }: {
130:   query: string;
131:   segment: CustomerSegment;
132:   page: number;
133:   pageSize: number;
134:   sort: CustomerSort;
135:   direction: SortDirection;
136: }) {
137:   const actor = await requireActor();
138:   const normalizedQuery = query.trim().slice(0, 80);
139:   const reference = new Date();
140:   const segmentWhere = segment === "archived"
141:     ? { archivedAt: { not: null } }
142:     : segment === "repeat"
143:       ? {
144:           archivedAt: null,
145:           opportunities: { none: { stage: { in: OPEN_STAGES } } },
146:           reminders: {
147:             some: { type: "REPEAT_ORDER" as const, resolvedAt: null, dueAt: { lte: reference } },
148:           },
149:           AND: [{
150:             reminders: {
151:               some: { type: "REACTIVATION" as const, resolvedAt: null, dueAt: { gt: reference } },
152:             },
153:           }],
154:           ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
155:         }
156:       : segment === "inactive"
157:         ? {
158:             archivedAt: null,
159:             opportunities: { none: { stage: { in: OPEN_STAGES } } },
160:             reminders: {
161:               some: { type: "REACTIVATION" as const, resolvedAt: null, dueAt: { lte: reference } },
162:             },
163:             ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
164:           }
165:         : { archivedAt: null };
166:   const where = {
167:     ...segmentWhere,
168:     ...(normalizedQuery
169:       ? {
170:           OR: [
171:             { name: { contains: normalizedQuery, mode: "insensitive" as const } },
172:             { companyName: { contains: normalizedQuery, mode: "insensitive" as const } },
173:             { customerNo: { contains: normalizedQuery, mode: "insensitive" as const } },
174:             { whatsapp: { contains: normalizedQuery, mode: "insensitive" as const } },
175:             { email: { contains: normalizedQuery, mode: "insensitive" as const } },
176:             { instagram: { contains: normalizedQuery, mode: "insensitive" as const } },
177:             { city: { contains: normalizedQuery, mode: "insensitive" as const } },
178:             { customerType: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
179:             { leadSource: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
180:             { salesPic: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
181:           ],
182:         }
183:       : {}),
184:   } satisfies Prisma.CustomerWhereInput;
185:   const prisma = getPrismaClient();
186:   const orderBy = (
187:     sort === "opportunities"
188:       ? [{ opportunities: { _count: direction } }, { id: "asc" as const }]
189:       : [{ [sort]: direction }, { id: "asc" as const }]
190:   ) satisfies Prisma.CustomerOrderByWithRelationInput[];
191: 
192:   const [items, total] = await Promise.all([
193:     prisma.customer.findMany({
194:       where,
195:       select: {
196:         id: true,
197:         customerNo: true,
198:         version: true,
199:         name: true,
200:         companyName: true,
201:         whatsapp: true,
202:         email: true,
203:         instagram: true,
204:         address: true,
205:         city: true,
206:         notes: true,
207:         customerTypeId: true,
208:         leadSourceId: true,
209:         salesPicId: true,
210:         customerType: { select: { name: true } },
211:         leadSource: { select: { name: true } },
212:         salesPic: { select: { id: true, name: true, isActive: true } },
213:         archivedAt: true,
214:         updatedAt: true,
215:         _count: { select: { opportunities: true } },
216:         opportunities: {
217:           select: { updatedAt: true, stage: true },
218:           orderBy: { updatedAt: "desc" },
219:           take: 1,
220:         },
221:         reminders: {
222:           where: { resolvedAt: null },
223:           select: {
224:             type: true,
225:             dueAt: true,
226:             sourceSalesOrder: {
227:               select: { id: true, salesOrderNo: true, acceptedAt: true },
228:             },
229:           },
230:           orderBy: { dueAt: "asc" },
231:         },
232:       },
233:       orderBy,
234:       skip: (page - 1) * pageSize,
235:       take: pageSize,
236:     }),
237:     prisma.customer.count({ where }),
238:   ]);
239:   const customerIds = items.map((item) => item.id);
240:   const openOpportunities = customerIds.length
241:     ? await prisma.opportunity.findMany({
242:         where: { customerId: { in: customerIds }, stage: { in: OPEN_STAGES } },
243:         select: { customerId: true },
244:         distinct: ["customerId"],
245:       })
246:     : [];
247:   const openCustomerIds = new Set(openOpportunities.map((item) => item.customerId));
248:   return {
249:     items: items.map((item) => ({ ...item, hasOpenOpportunity: openCustomerIds.has(item.id) })),
250:     total,
251:     pageCount: Math.max(1, Math.ceil(total / pageSize)),
252:   };
253: }
254: 
255: export async function getCustomerDetail(customerId: string) {
256:   await requireActor();
257:   return getPrismaClient().customer.findUnique({
258:     where: { id: customerId },
259:     select: {
260:       id: true,
261:       customerNo: true,
262:       name: true,
263:       companyName: true,
264:       whatsapp: true,
265:       email: true,
266:       instagram: true,
267:       address: true,
268:       city: true,
269:       notes: true,
270:       customerTypeId: true,
271:       leadSourceId: true,
272:       salesPicId: true,
273:       customerType: { select: { id: true, name: true } },
274:       leadSource: { select: { id: true, name: true } },
275:       salesPic: { select: { id: true, name: true, isActive: true } },
276:       archivedAt: true,
277:       version: true,
278:       updatedAt: true,
279:       opportunities: {
280:         select: {
281:           id: true,
282:           opportunityNo: true,
283:           title: true,
284:           stage: true,
285:           estimatedValue: true,
286:           deadline: true,
287:           updatedAt: true,
288:           salesOrders: {
289:             select: {
290:               id: true,
291:               salesOrderNo: true,
292:               total: true,
293:               status: true,
294:               acceptedAt: true,
295:               items: {
296:                 select: { id: true, description: true, quantity: true, position: true },
297:                 orderBy: { position: "asc" },
298:               },
299:             },
300:             orderBy: { acceptedAt: "desc" },
301:           },
302:         },
303:         orderBy: { updatedAt: "desc" },
304:       },
305:       reminders: {
306:         where: { resolvedAt: null },
307:         select: {
308:           id: true,
309:           type: true,
310:           dueAt: true,
311:           sourceSalesOrder: {
312:             select: { id: true, salesOrderNo: true, acceptedAt: true, total: true },
313:           },
314:         },
315:         orderBy: { dueAt: "asc" },
316:       },
317:     },
318:   });
319: }
320: 
321: export async function getOpportunityDetail(opportunityId: string) {
322:   await requireActor();
323:   return getPrismaClient().opportunity.findUnique({
324:     where: { id: opportunityId },
325:     select: {
326:       id: true,
327:       opportunityNo: true,
328:       title: true,
329:       stage: true,
330:       leadSourceId: true,
331:       salesPicId: true,
332:       productName: true,
333:       needPurpose: true,
334:       designStatus: true,
335:       specification: true,
336:       customerBudget: true,
337:       leadScore: true,
338:       estimatedQuantity: true,
339:       estimatedValue: true,
340:       deadline: true,
341:       lastContactedAt: true,
342:       nextAction: true,
343:       nextActionAt: true,
344:       cancelReason: true,
345:       version: true,
346:       createdAt: true,
347:       updatedAt: true,
348:       customer: {
349:         select: {
350:           id: true,
351:           customerNo: true,
352:           name: true,
353:           companyName: true,
354:           whatsapp: true,
355:           email: true,
356:           instagram: true,
357:           address: true,
358:           archivedAt: true,
359:         },
360:       },
361:       leadSource: { select: { id: true, name: true } },
362:       salesPic: { select: { id: true, name: true, isActive: true } },
363:       quotations: {
364:         select: {
365:           id: true,
366:           quotationNo: true,
367:           revision: true,
368:           status: true,
369:           discountType: true,
370:           discountValue: true,
371:           subtotal: true,
372:           total: true,
373:           issuedAt: true,
374:           acceptedAt: true,
375:           acceptanceReference: true,
376:           acceptanceProofPath: true,
377:           acceptanceProofName: true,
378:           acceptanceProofType: true,
379:           version: true,
380:           createdAt: true,
381:           items: {
382:             select: { id: true, position: true, description: true, quantity: true, unitPrice: true, subtotal: true },
383:             orderBy: { position: "asc" },
384:           },
385:           salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
386:         },
387:         orderBy: { revision: "desc" },
388:       },
389:       salesOrders: {
390:         select: { id: true, salesOrderNo: true, status: true, total: true, createdAt: true, cancelReason: true },
391:         orderBy: { createdAt: "desc" },
392:       },
393:     },
394:   });
395: }
396: 
397: export const COMMUNICATION_PAGE_SIZE = 25;
398: 
399: const communicationActivitySelect = {
400:   id: true,
401:   kind: true,
402:   channel: true,
403:   direction: true,
404:   systemEvent: true,
405:   content: true,
406:   metadata: true,
407:   occurredAt: true,
408:   createdAt: true,
409:   author: { select: { name: true, role: true } },
410:   opportunity: { select: { id: true, opportunityNo: true, title: true } },
411: } satisfies Prisma.CommunicationActivitySelect;
412: 
413: export type CommunicationTimelineItem = Prisma.CommunicationActivityGetPayload<{
414:   select: typeof communicationActivitySelect;
415: }>;
416: 
417: export async function getCommunicationTimeline({
418:   customerId,
419:   opportunityId,
420:   page,
421: }: {
422:   customerId?: string;
423:   opportunityId?: string;
424:   page: number;
425: }) {
426:   await requireActor();
427:   if (!customerId && !opportunityId) throw new Error("Timeline membutuhkan customer atau peluang.");
428:   const safePage = Number.isInteger(page) && page > 0 ? page : 1;
429:   const where = {
430:     ...(customerId ? { customerId } : {}),
431:     ...(opportunityId ? { opportunityId } : {}),
432:   } satisfies Prisma.CommunicationActivityWhereInput;
433:   const prisma = getPrismaClient();
434:   const [items, total] = await Promise.all([
435:     prisma.communicationActivity.findMany({
436:       where,
437:       select: communicationActivitySelect,
438:       orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
439:       skip: (safePage - 1) * COMMUNICATION_PAGE_SIZE,
440:       take: COMMUNICATION_PAGE_SIZE,
441:     }),
442:     prisma.communicationActivity.count({ where }),
443:   ]);
444: 
445:   return {
446:     items,
447:     total,
448:     page: safePage,
449:     pageCount: Math.max(1, Math.ceil(total / COMMUNICATION_PAGE_SIZE)),
450:   };
451: }
452: 
453: type FollowUpBucket = "overdue" | "today" | "tomorrow" | "upcoming";
454: 
455: function jakartaDayBounds(reference = new Date()) {
456:   const shifted = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
457:   const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 7 * 60 * 60 * 1000);
458:   const tomorrow = new Date(start.getTime() + 24 * 60 * 60 * 1000);
459:   const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
460:   return { start, tomorrow, dayAfterTomorrow };
461: }
462: 
463: export async function getFollowUpData({ bucket, picId }: { bucket: FollowUpBucket; picId?: string }) {
464:   const actor = await requireActor();
465:   const { start, tomorrow, dayAfterTomorrow } = jakartaDayBounds();
466:   const timeWhere = bucket === "overdue"
467:     ? { lt: start }
468:     : bucket === "today"
469:       ? { gte: start, lt: tomorrow }
470:       : bucket === "tomorrow"
471:         ? { gte: tomorrow, lt: dayAfterTomorrow }
472:         : { gte: dayAfterTomorrow };
473:   const selectedPicId = picId === "all" ? undefined : picId || (actor.role === "SALES" ? actor.id : undefined);
474:   const baseWhere = {
475:     stage: { in: ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"] as OpportunityStage[] },
476:     nextActionAt: { not: null },
477:     customer: { archivedAt: null },
478:     ...(selectedPicId ? { salesPicId: selectedPicId } : {}),
479:   } satisfies Prisma.OpportunityWhereInput;
480:   const prisma = getPrismaClient();
481:   const [items, overdue, today, tomorrowCount, upcoming, salesUsers] = await Promise.all([
482:     prisma.opportunity.findMany({
483:       where: { ...baseWhere, nextActionAt: timeWhere },
484:       select: {
485:         id: true,
486:         opportunityNo: true,
487:         title: true,
488:         stage: true,
489:         version: true,
490:         leadScore: true,
491:         nextAction: true,
492:         nextActionAt: true,
493:         lastContactedAt: true,
494:         cancelReason: true,
495:         customer: { select: { name: true, companyName: true, whatsapp: true } },
496:         salesPic: { select: { id: true, name: true } },
497:       },
498:       orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
499:       take: 200,
500:     }),
501:     prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { lt: start } } }),
502:     prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: start, lt: tomorrow } } }),
503:     prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: tomorrow, lt: dayAfterTomorrow } } }),
504:     prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: dayAfterTomorrow } } }),
505:     prisma.appUser.findMany({ where: { role: "SALES", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
506:   ]);
507:   return { items, counts: { overdue, today, tomorrow: tomorrowCount, upcoming }, salesUsers, selectedPicId };
508: }
509: 
510: export async function getFollowUpBadgeCount() {
511:   const actor = await requireActor();
512:   const { tomorrow } = jakartaDayBounds();
513:   return getPrismaClient().opportunity.count({
514:     where: {
515:       stage: { in: ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"] },
516:       nextActionAt: { lt: tomorrow },
517:       customer: { archivedAt: null },
518:       ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
519:     },
520:   });
521: }
522: 
523: export async function getSalesDashboardData() {
524:   await requireActor();
525:   const prisma = getPrismaClient();
526:   const { start, tomorrow } = jakartaDayBounds();
527:   const shifted = new Date(start.getTime() + 7 * 60 * 60 * 1000);
528:   const monthStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
529:   const nextMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - 7 * 60 * 60 * 1000);
530:   const openStages: OpportunityStage[] = ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"];
531:   const [stageGroups, potential, dealRevenue, overdue, dueToday, hotLeads, urgentActions] = await Promise.all([
532:     prisma.opportunity.groupBy({ by: ["stage"], where: { customer: { archivedAt: null } }, orderBy: { stage: "asc" }, _count: true }),
533:     prisma.opportunity.aggregate({ where: { stage: { in: openStages }, customer: { archivedAt: null } }, _sum: { estimatedValue: true } }),
534:     prisma.salesOrder.aggregate({ where: { status: "ACTIVE", acceptedAt: { gte: monthStart, lt: nextMonth } }, _sum: { total: true } }),
535:     prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { lt: start }, customer: { archivedAt: null } } }),
536:     prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { gte: start, lt: tomorrow }, customer: { archivedAt: null } } }),
537:     prisma.opportunity.findMany({
538:       where: { stage: { in: openStages }, leadScore: { gte: 80 }, customer: { archivedAt: null } },
539:       select: { id: true, opportunityNo: true, title: true, leadScore: true, estimatedValue: true, customer: { select: { name: true } } },
540:       orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
541:       take: 5,
542:     }),
543:     prisma.opportunity.findMany({
544:       where: { stage: { in: openStages }, nextActionAt: { not: null }, customer: { archivedAt: null } },
545:       select: { id: true, title: true, nextAction: true, nextActionAt: true, customer: { select: { name: true } } },
546:       orderBy: { nextActionAt: "asc" },
547:       take: 5,
548:     }),
549:   ]);
550:   const stageCounts = Object.fromEntries(
551:     stageGroups.map((group) => [group.stage, group._count]),
552:   ) as Partial<Record<OpportunityStage, number>>;
553:   const totalLeadCount = Object.values(stageCounts).reduce(
554:     (total, count) => total + count,
555:     0,
556:   );
557:   const dealCount = stageCounts.DEAL ?? 0;
558: 
559:   return {
560:     stageCounts,
561:     totalLeadCount,
562:     dealCount,
563:     conversionRate: calculateConversionRate(dealCount, totalLeadCount),
564:     potentialValue: potential._sum.estimatedValue?.toString() ?? "0",
565:     dealRevenue: dealRevenue._sum.total?.toString() ?? "0",
566:     overdue,
567:     dueToday,
568:     hotLeads: hotLeads.map((item) => ({ ...item, estimatedValue: item.estimatedValue?.toString() ?? null })),
569:     urgentActions,
570:   };
571: }
572: 
573: type LeadSourceRevenueQueryRow = {
574:   sourceId: string | null;
575:   sourceName: string;
576:   leadCount: number;
577:   dealCount: number;
578:   revenue: string;
579: };
580: 
581: export async function getLeadSourceRevenueData(period: AnalyticsPeriod) {
582:   await requireActor(ANALYTICS_ROLES);
583:   const bounds = getAnalyticsPeriodBounds(period);
584:   const leadDateCondition = bounds
585:     ? Prisma.sql`WHERE o."createdAt" >= ${bounds.start} AND o."createdAt" < ${bounds.end}`
586:     : Prisma.empty;
587:   const orderDateCondition = bounds
588:     ? Prisma.sql`AND so."acceptedAt" >= ${bounds.start} AND so."acceptedAt" < ${bounds.end}`
589:     : Prisma.empty;
590: 
591:   const rows = await getPrismaClient().$queryRaw<LeadSourceRevenueQueryRow[]>(Prisma.sql`
592:     WITH lead_totals AS (
593:       SELECT
594:         o."leadSourceId",
595:         COUNT(*)::int AS "leadCount"
596:       FROM "Opportunity" o
597:       ${leadDateCondition}
598:       GROUP BY o."leadSourceId"
599:     ),
600:     deal_totals AS (
601:       SELECT
602:         o."leadSourceId",
603:         COUNT(DISTINCT so."opportunityId")::int AS "dealCount",
604:         COALESCE(SUM(so."total"), 0) AS revenue
605:       FROM "SalesOrder" so
606:       INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
607:       WHERE so."status" = 'ACTIVE'
608:       ${orderDateCondition}
609:       GROUP BY o."leadSourceId"
610:     ),
611:     source_rows AS (
612:       SELECT ls.id AS "sourceId", ls.name AS "sourceName"
613:       FROM "LeadSource" ls
614:       UNION ALL
615:       SELECT NULL::text AS "sourceId", 'Belum ditentukan' AS "sourceName"
616:       WHERE EXISTS (SELECT 1 FROM lead_totals WHERE "leadSourceId" IS NULL)
617:          OR EXISTS (SELECT 1 FROM deal_totals WHERE "leadSourceId" IS NULL)
618:     )
619:     SELECT
620:       sr."sourceId",
621:       sr."sourceName",
622:       COALESCE(lt."leadCount", 0)::int AS "leadCount",
623:       COALESCE(dt."dealCount", 0)::int AS "dealCount",
624:       COALESCE(dt.revenue, 0)::text AS revenue
625:     FROM source_rows sr
626:     LEFT JOIN lead_totals lt ON lt."leadSourceId" IS NOT DISTINCT FROM sr."sourceId"
627:     LEFT JOIN deal_totals dt ON dt."leadSourceId" IS NOT DISTINCT FROM sr."sourceId"
628:     ORDER BY COALESCE(dt.revenue, 0) DESC, COALESCE(lt."leadCount", 0) DESC, sr."sourceName" ASC
629:   `);
630: 
631:   const totals = rows.reduce(
632:     (result, row) => ({
633:       leadCount: result.leadCount + row.leadCount,
634:       dealCount: result.dealCount + row.dealCount,
635:       revenue: result.revenue.plus(row.revenue),
636:     }),
637:     { leadCount: 0, dealCount: 0, revenue: new Prisma.Decimal(0) },
638:   );
639: 
640:   return {
641:     period,
642:     periodLabel: analyticsPeriodLabel(period),
643:     rows,
644:     totals: {
645:       leadCount: totals.leadCount,
646:       dealCount: totals.dealCount,
647:       revenue: totals.revenue.toString(),
648:     },
649:   };
650: }
651: 
652: export async function getSalesPerformanceData(period: AnalyticsPeriod) {
653:   await requireActor(ANALYTICS_ROLES);
654:   const bounds = getAnalyticsPeriodBounds(period);
655:   const leadDateCondition = bounds
656:     ? Prisma.sql`WHERE o."createdAt" >= ${bounds.start} AND o."createdAt" < ${bounds.end}`
657:     : Prisma.empty;
658:   const followUpDateCondition = bounds
659:     ? Prisma.sql`AND ae."createdAt" >= ${bounds.start} AND ae."createdAt" < ${bounds.end}`
660:     : Prisma.empty;
661:   const quotationDateCondition = bounds
662:     ? Prisma.sql`AND q."issuedAt" >= ${bounds.start} AND q."issuedAt" < ${bounds.end}`
663:     : Prisma.empty;
664:   const orderDateCondition = bounds
665:     ? Prisma.sql`AND so."acceptedAt" >= ${bounds.start} AND so."acceptedAt" < ${bounds.end}`
666:     : Prisma.empty;
667: 
668:   const rawRows = await getPrismaClient().$queryRaw<SalesPerformanceRow[]>(Prisma.sql`
669:     WITH lead_totals AS (
670:       SELECT
671:         o."salesPicId",
672:         COUNT(*)::int AS "leadCount"
673:       FROM "Opportunity" o
674:       ${leadDateCondition}
675:       GROUP BY o."salesPicId"
676:     ),
677:     follow_up_totals AS (
678:       SELECT
679:         o."salesPicId",
680:         COUNT(*)::int AS "followUpCount"
681:       FROM "AuditEvent" ae
682:       INNER JOIN "Opportunity" o
683:         ON ae."entityType" = 'Opportunity'
684:        AND ae."entityId" = o.id
685:       WHERE ae.action = 'FOLLOW_UP_RECORDED'
686:       ${followUpDateCondition}
687:       GROUP BY o."salesPicId"
688:     ),
689:     quotation_totals AS (
690:       SELECT
691:         o."salesPicId",
692:         COUNT(DISTINCT q."opportunityId")::int AS "quotationCount"
693:       FROM "Quotation" q
694:       INNER JOIN "Opportunity" o ON o.id = q."opportunityId"
695:       WHERE q."issuedAt" IS NOT NULL
696:       ${quotationDateCondition}
697:       GROUP BY o."salesPicId"
698:     ),
699:     deal_totals AS (
700:       SELECT
701:         o."salesPicId",
702:         COUNT(DISTINCT so."opportunityId")::int AS "dealCount",
703:         COALESCE(SUM(so.total), 0) AS revenue
704:       FROM "SalesOrder" so
705:       INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
706:       WHERE so.status = 'ACTIVE'
707:       ${orderDateCondition}
708:       GROUP BY o."salesPicId"
709:     ),
710:     sales_rows AS (
711:       SELECT
712:         u.id AS "salesId",
713:         u.name AS "salesName",
714:         u."isActive"
715:       FROM "AppUser" u
716:       WHERE u.role = 'SALES'
717: 
718:       UNION ALL
719: 
720:       SELECT
721:         NULL::text AS "salesId",
722:         'Belum ada PIC' AS "salesName",
723:         NULL::boolean AS "isActive"
724:       WHERE EXISTS (SELECT 1 FROM lead_totals WHERE "salesPicId" IS NULL)
725:          OR EXISTS (SELECT 1 FROM follow_up_totals WHERE "salesPicId" IS NULL)
726:          OR EXISTS (SELECT 1 FROM quotation_totals WHERE "salesPicId" IS NULL)
727:          OR EXISTS (SELECT 1 FROM deal_totals WHERE "salesPicId" IS NULL)
728:     )
729:     SELECT
730:       sr."salesId",
731:       sr."salesName",
732:       sr."isActive",
733:       COALESCE(lt."leadCount", 0)::int AS "leadCount",
734:       COALESCE(ft."followUpCount", 0)::int AS "followUpCount",
735:       COALESCE(qt."quotationCount", 0)::int AS "quotationCount",
736:       COALESCE(dt."dealCount", 0)::int AS "dealCount",
737:       COALESCE(dt.revenue, 0)::text AS revenue
738:     FROM sales_rows sr
739:     LEFT JOIN lead_totals lt
740:       ON lt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
741:     LEFT JOIN follow_up_totals ft
742:       ON ft."salesPicId" IS NOT DISTINCT FROM sr."salesId"
743:     LEFT JOIN quotation_totals qt
744:       ON qt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
745:     LEFT JOIN deal_totals dt
746:       ON dt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
747:   `);
748: 
749:   return {
750:     period,
751:     periodLabel: analyticsPeriodLabel(period),
752:     ...finalizeSalesPerformanceRows(rawRows),
753:   };
754: }
755: 
756: export async function getSalesOrderDetail(salesOrderId: string) {
757:   await requireActor();
758:   return getPrismaClient().salesOrder.findUnique({
759:     where: { id: salesOrderId },
760:     select: {
761:       id: true,
762:       salesOrderNo: true,
763:       quotationNo: true,
764:       status: true,
765:       snapshotCustomerName: true,
766:       snapshotCompanyName: true,
767:       snapshotWhatsapp: true,
768:       snapshotEmail: true,
769:       snapshotInstagram: true,
770:       snapshotAddress: true,
771:       discountType: true,
772:       discountValue: true,
773:       subtotal: true,
774:       total: true,
775:       acceptedAt: true,
776:       createdAt: true,
777:       cancelledAt: true,
778:       cancelReason: true,
779:       opportunity: { select: { id: true, opportunityNo: true, title: true, stage: true } },
780:       quotation: {
781:         select: {
782:           id: true,
783:           revision: true,
784:           status: true,
785:           acceptanceReference: true,
786:           acceptanceProofPath: true,
787:           acceptanceProofName: true,
788:         },
789:       },
790:       createdBy: { select: { name: true } },
791:       cancelledBy: { select: { name: true } },
792:       items: {
793:         select: { id: true, position: true, description: true, quantity: true, unitPrice: true, subtotal: true },
794:         orderBy: { position: "asc" },
795:       },
796:     },
797:   });
798: }
799: 
800: export type UserStatusFilter = "active" | "all" | "inactive";
801: export type UserSort = "createdAt" | "email" | "isActive" | "name" | "role";
802: 
803: export async function getUsers({
804:   query,
805:   role,
806:   status,
807:   page,
808:   pageSize,
809:   sort,
810:   direction,
811: }: {
812:   query: string;
813:   role: AppRole | "all";
814:   status: UserStatusFilter;
815:   page: number;
816:   pageSize: number;
817:   sort: UserSort;
818:   direction: SortDirection;
819: }) {
820:   await requireActor(USER_ADMIN_ROLES);
821:   const normalizedQuery = query.trim().slice(0, 120);
822:   const where = {
823:     ...(normalizedQuery
824:       ? {
825:           OR: [
826:             { name: { contains: normalizedQuery, mode: "insensitive" as const } },
827:             { email: { contains: normalizedQuery, mode: "insensitive" as const } },
828:           ],
829:         }
830:       : {}),
831:     ...(role === "all" ? {} : { role }),
832:     ...(status === "all" ? {} : { isActive: status === "active" }),
833:   } satisfies Prisma.AppUserWhereInput;
834:   const orderBy = [{ [sort]: direction }, { id: "asc" as const }] satisfies Prisma.AppUserOrderByWithRelationInput[];
835:   const prisma = getPrismaClient();
836:   const [items, total, activeTotal, allTotal] = await Promise.all([
837:     prisma.appUser.findMany({
838:       where,
839:       select: {
840:         id: true,
841:         authUserId: true,
842:         email: true,
843:         name: true,
844:         role: true,
845:         isActive: true,
846:         mustChangePassword: true,
847:         createdAt: true,
848:         updatedAt: true,
849:       },
850:       orderBy,
851:       skip: (page - 1) * pageSize,
852:       take: pageSize,
853:     }),
854:     prisma.appUser.count({ where }),
855:     prisma.appUser.count({ where: { isActive: true } }),
856:     prisma.appUser.count(),
857:   ]);
858:   return { items, total, activeTotal, allTotal, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
859: }

(End of file - total 859 lines)
</content>
```

---

## Assistant (Plan · Big Pickle · 2.6s)

_Thinking:_

Now I have a good understanding of the codebase. Let me also check the Prisma schema for the Opportunity model and the new-lead-form to understand how the title is currently set.

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/prisma/schema.prisma"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/prisma/schema.prisma</path>
<type>file</type>
<content>
1: generator client {
2:   provider = "prisma-client-js"
3: }
4: 
5: datasource db {
6:   provider = "postgresql"
7: }
8: 
9: enum AppRole {
10:   OWNER
11:   ADMIN
12:   SALES
13: }
14: 
15: enum OpportunityStage {
16:   LEAD_BARU
17:   DIHUBUNGI
18:   KEBUTUHAN_TERGALI
19:   PENAWARAN
20:   FOLLOW_UP
21:   NEGOSIASI
22:   DEAL
23:   LOST
24: }
25: 
26: enum DesignStatus {
27:   SUDAH_ADA
28:   BELUM_ADA
29:   PERLU_DIBANTU
30: }
31: 
32: enum DiscountType {
33:   NONE
34:   NOMINAL
35:   PERCENTAGE
36: }
37: 
38: enum QuotationStatus {
39:   DRAFT
40:   ISSUED
41:   ACCEPTED
42:   SUPERSEDED
43: }
44: 
45: enum SalesOrderStatus {
46:   ACTIVE
47:   CANCELLED
48: }
49: 
50: enum CustomerReminderType {
51:   REPEAT_ORDER
52:   REACTIVATION
53: }
54: 
55: enum CommunicationActivityKind {
56:   COMMUNICATION
57:   INTERNAL_NOTE
58:   SYSTEM
59: }
60: 
61: enum CommunicationChannel {
62:   WHATSAPP
63:   INSTAGRAM
64:   PHONE
65:   EMAIL
66:   MEETING
67:   OTHER
68: }
69: 
70: enum CommunicationDirection {
71:   INBOUND
72:   OUTBOUND
73: }
74: 
75: enum CommunicationSystemEvent {
76:   STAGE_CHANGED
77:   QUOTATION_ISSUED
78:   DEAL_ORDER_CREATED
79:   SALES_ORDER_CANCELLED
80: }
81: 
82: model AppUser {
83:   id                       String                    @id @default(cuid())
84:   authUserId               String                    @unique @db.Uuid
85:   email                    String                    @unique @db.VarChar(320)
86:   name                     String                    @db.VarChar(120)
87:   role                     AppRole
88:   isActive                 Boolean                   @default(true)
89:   mustChangePassword       Boolean                   @default(true)
90:   communicationActivities  CommunicationActivity[]
91:   customerReminderReceipts CustomerReminderReceipt[]
92:   quotations               Quotation[]               @relation("QuotationCreatedBy")
93:   salesOrders              SalesOrder[]              @relation("SalesOrderCreatedBy")
94:   cancelledOrders          SalesOrder[]              @relation("SalesOrderCancelledBy")
95:   auditEvents              AuditEvent[]
96:   assignedCustomers        Customer[]                @relation("CustomerSalesPic")
97:   assignedOpportunities    Opportunity[]             @relation("OpportunitySalesPic")
98:   createdAt                DateTime                  @default(now()) @db.Timestamptz(3)
99:   updatedAt                DateTime                  @updatedAt @db.Timestamptz(3)
100: 
101:   @@index([role, isActive])
102: }
103: 
104: model CustomerType {
105:   id          String     @id @default(cuid())
106:   name        String     @unique @db.VarChar(80)
107:   description String?    @db.VarChar(500)
108:   position    Int        @default(0)
109:   isActive    Boolean    @default(true)
110:   customers   Customer[]
111:   createdAt   DateTime   @default(now()) @db.Timestamptz(3)
112:   updatedAt   DateTime   @updatedAt @db.Timestamptz(3)
113: 
114:   @@index([isActive, position, name])
115: }
116: 
117: model LeadSource {
118:   id            String        @id @default(cuid())
119:   name          String        @unique @db.VarChar(80)
120:   description   String?       @db.VarChar(500)
121:   position      Int           @default(0)
122:   isActive      Boolean       @default(true)
123:   customers     Customer[]
124:   opportunities Opportunity[]
125:   createdAt     DateTime      @default(now()) @db.Timestamptz(3)
126:   updatedAt     DateTime      @updatedAt @db.Timestamptz(3)
127: 
128:   @@index([isActive, position, name])
129: }
130: 
131: model Customer {
132:   id                      String                  @id @default(cuid())
133:   customerNo              String                  @unique @db.VarChar(24)
134:   name                    String                  @db.VarChar(160)
135:   companyName             String?                 @db.VarChar(160)
136:   whatsapp                String?                 @db.VarChar(32)
137:   email                   String?                 @db.VarChar(320)
138:   instagram               String?                 @db.VarChar(80)
139:   address                 String?                 @db.Text
140:   city                    String?                 @db.VarChar(120)
141:   notes                   String?                 @db.Text
142:   customerTypeId          String
143:   leadSourceId            String?
144:   salesPicId              String?
145:   archivedAt              DateTime?               @db.Timestamptz(3)
146:   version                 Int                     @default(1)
147:   customerType            CustomerType            @relation(fields: [customerTypeId], references: [id], onDelete: Restrict)
148:   leadSource              LeadSource?             @relation(fields: [leadSourceId], references: [id], onDelete: SetNull)
149:   salesPic                AppUser?                @relation("CustomerSalesPic", fields: [salesPicId], references: [id], onDelete: SetNull)
150:   opportunities           Opportunity[]
151:   communicationActivities CommunicationActivity[]
152:   reminders               CustomerReminder[]
153:   createdAt               DateTime                @default(now()) @db.Timestamptz(3)
154:   updatedAt               DateTime                @updatedAt @db.Timestamptz(3)
155: 
156:   @@index([archivedAt, updatedAt])
157:   @@index([name])
158:   @@index([companyName])
159:   @@index([customerTypeId, archivedAt])
160:   @@index([leadSourceId])
161:   @@index([salesPicId])
162:   @@index([city])
163: }
164: 
165: model Opportunity {
166:   id                      String                  @id @default(cuid())
167:   opportunityNo           String                  @unique @db.VarChar(24)
168:   customerId              String
169:   title                   String                  @db.VarChar(180)
170:   stage                   OpportunityStage        @default(LEAD_BARU)
171:   leadSourceId            String?
172:   salesPicId              String?
173:   productName             String?                 @db.VarChar(120)
174:   needPurpose             String?                 @db.VarChar(500)
175:   designStatus            DesignStatus?
176:   specification           String?                 @db.Text
177:   customerBudget          Decimal?                @db.Decimal(18, 2)
178:   leadScore               Int                     @default(0)
179:   estimatedQuantity       Int?
180:   estimatedValue          Decimal?                @db.Decimal(18, 2)
181:   deadline                DateTime?               @db.Date
182:   lastContactedAt         DateTime?               @db.Timestamptz(3)
183:   nextAction              String?                 @db.VarChar(500)
184:   nextActionAt            DateTime?               @db.Timestamptz(3)
185:   publicSubmissionKey     String?                 @unique @db.Uuid
186:   cancelReason            String?                 @db.Text
187:   version                 Int                     @default(1)
188:   customer                Customer                @relation(fields: [customerId], references: [id], onDelete: Restrict)
189:   leadSource              LeadSource?             @relation(fields: [leadSourceId], references: [id], onDelete: SetNull)
190:   salesPic                AppUser?                @relation("OpportunitySalesPic", fields: [salesPicId], references: [id], onDelete: SetNull)
191:   communicationActivities CommunicationActivity[]
192:   quotations              Quotation[]
193:   salesOrders             SalesOrder[]
194:   createdAt               DateTime                @default(now()) @db.Timestamptz(3)
195:   updatedAt               DateTime                @updatedAt @db.Timestamptz(3)
196: 
197:   @@index([customerId, updatedAt])
198:   @@index([stage, updatedAt])
199:   @@index([salesPicId, stage])
200:   @@index([salesPicId, nextActionAt])
201:   @@index([leadSourceId, createdAt])
202:   @@index([leadScore, stage])
203: }
204: 
205: model PublicRateLimitBucket {
206:   key         String   @id @db.VarChar(64)
207:   windowStart DateTime @db.Timestamptz(3)
208:   count       Int      @default(1)
209:   updatedAt   DateTime @updatedAt @db.Timestamptz(3)
210: 
211:   @@index([updatedAt])
212: }
213: 
214: model CommunicationActivity {
215:   id                 String                    @id @default(cuid())
216:   customerId         String
217:   opportunityId      String?
218:   authorId           String
219:   kind               CommunicationActivityKind
220:   channel            CommunicationChannel?
221:   direction          CommunicationDirection?
222:   systemEvent        CommunicationSystemEvent?
223:   content            String                    @db.Text
224:   metadata           Json?
225:   occurredAt         DateTime                  @db.Timestamptz(3)
226:   sourceAuditEventId String?                   @unique
227:   customer           Customer                  @relation(fields: [customerId], references: [id], onDelete: Restrict)
228:   opportunity        Opportunity?              @relation(fields: [opportunityId], references: [id], onDelete: Restrict)
229:   author             AppUser                   @relation(fields: [authorId], references: [id], onDelete: Restrict)
230:   sourceAuditEvent   AuditEvent?               @relation("CommunicationActivityAuditEvent", fields: [sourceAuditEventId], references: [id], onDelete: Restrict)
231:   createdAt          DateTime                  @default(now()) @db.Timestamptz(3)
232: 
233:   @@index([customerId, occurredAt, id])
234:   @@index([opportunityId, occurredAt, id])
235:   @@index([authorId, occurredAt])
236: }
237: 
238: model Quotation {
239:   id                   String          @id @default(cuid())
240:   quotationNo          String          @unique @db.VarChar(28)
241:   opportunityId        String
242:   revision             Int
243:   status               QuotationStatus @default(DRAFT)
244:   snapshotCustomerName String          @db.VarChar(160)
245:   snapshotCompanyName  String?         @db.VarChar(160)
246:   snapshotWhatsapp     String?         @db.VarChar(32)
247:   snapshotEmail        String?         @db.VarChar(320)
248:   snapshotInstagram    String?         @db.VarChar(80)
249:   snapshotAddress      String?         @db.Text
250:   discountType         DiscountType    @default(NONE)
251:   discountValue        Decimal         @default(0) @db.Decimal(18, 2)
252:   subtotal             Decimal         @db.Decimal(18, 2)
253:   total                Decimal         @db.Decimal(18, 2)
254:   issuedAt             DateTime?       @db.Timestamptz(3)
255:   acceptedAt           DateTime?       @db.Timestamptz(3)
256:   acceptanceReference  String?         @db.Text
257:   acceptanceProofPath  String?         @db.VarChar(500)
258:   acceptanceProofName  String?         @db.VarChar(255)
259:   acceptanceProofType  String?         @db.VarChar(64)
260:   version              Int             @default(1)
261:   createdById          String
262:   opportunity          Opportunity     @relation(fields: [opportunityId], references: [id], onDelete: Restrict)
263:   createdBy            AppUser         @relation("QuotationCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
264:   items                QuotationItem[]
265:   salesOrder           SalesOrder?
266:   createdAt            DateTime        @default(now()) @db.Timestamptz(3)
267:   updatedAt            DateTime        @updatedAt @db.Timestamptz(3)
268: 
269:   @@unique([opportunityId, revision])
270:   @@index([opportunityId, status])
271:   @@index([createdById, createdAt])
272: }
273: 
274: model QuotationItem {
275:   id          String    @id @default(cuid())
276:   quotationId String
277:   position    Int
278:   description String    @db.VarChar(240)
279:   quantity    Int
280:   unitPrice   Decimal   @db.Decimal(18, 2)
281:   subtotal    Decimal   @db.Decimal(18, 2)
282:   quotation   Quotation @relation(fields: [quotationId], references: [id], onDelete: Restrict)
283:   createdAt   DateTime  @default(now()) @db.Timestamptz(3)
284: 
285:   @@unique([quotationId, position])
286:   @@index([quotationId])
287: }
288: 
289: model SalesOrder {
290:   id                   String             @id @default(cuid())
291:   salesOrderNo         String             @unique @db.VarChar(28)
292:   opportunityId        String
293:   quotationId          String             @unique
294:   quotationNo          String             @db.VarChar(28)
295:   status               SalesOrderStatus   @default(ACTIVE)
296:   snapshotCustomerName String             @db.VarChar(160)
297:   snapshotCompanyName  String?            @db.VarChar(160)
298:   snapshotWhatsapp     String?            @db.VarChar(32)
299:   snapshotEmail        String?            @db.VarChar(320)
300:   snapshotInstagram    String?            @db.VarChar(80)
301:   snapshotAddress      String?            @db.Text
302:   discountType         DiscountType
303:   discountValue        Decimal            @db.Decimal(18, 2)
304:   subtotal             Decimal            @db.Decimal(18, 2)
305:   total                Decimal            @db.Decimal(18, 2)
306:   acceptedAt           DateTime           @db.Timestamptz(3)
307:   createdById          String
308:   cancelledAt          DateTime?          @db.Timestamptz(3)
309:   cancelReason         String?            @db.Text
310:   cancelledById        String?
311:   opportunity          Opportunity        @relation(fields: [opportunityId], references: [id], onDelete: Restrict)
312:   quotation            Quotation          @relation(fields: [quotationId], references: [id], onDelete: Restrict)
313:   createdBy            AppUser            @relation("SalesOrderCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
314:   cancelledBy          AppUser?           @relation("SalesOrderCancelledBy", fields: [cancelledById], references: [id], onDelete: Restrict)
315:   items                SalesOrderItem[]
316:   customerReminders    CustomerReminder[] @relation("CustomerReminderSourceOrder")
317:   createdAt            DateTime           @default(now()) @db.Timestamptz(3)
318: 
319:   @@index([opportunityId, status])
320:   @@index([createdById, createdAt])
321:   @@index([status, createdAt])
322: }
323: 
324: model SalesOrderItem {
325:   id           String     @id @default(cuid())
326:   salesOrderId String
327:   position     Int
328:   description  String     @db.VarChar(240)
329:   quantity     Int
330:   unitPrice    Decimal    @db.Decimal(18, 2)
331:   subtotal     Decimal    @db.Decimal(18, 2)
332:   salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Restrict)
333: 
334:   @@unique([salesOrderId, position])
335:   @@index([salesOrderId])
336: }
337: 
338: model CustomerReminder {
339:   id                 String                    @id @default(cuid())
340:   customerId         String
341:   sourceSalesOrderId String
342:   type               CustomerReminderType
343:   dueAt              DateTime                  @db.Timestamptz(3)
344:   resolvedAt         DateTime?                 @db.Timestamptz(3)
345:   generation         Int                       @default(1)
346:   customer           Customer                  @relation(fields: [customerId], references: [id], onDelete: Restrict)
347:   sourceSalesOrder   SalesOrder                @relation("CustomerReminderSourceOrder", fields: [sourceSalesOrderId], references: [id], onDelete: Restrict)
348:   receipts           CustomerReminderReceipt[]
349:   createdAt          DateTime                  @default(now()) @db.Timestamptz(3)
350:   updatedAt          DateTime                  @updatedAt @db.Timestamptz(3)
351: 
352:   @@unique([sourceSalesOrderId, type])
353:   @@index([resolvedAt, dueAt])
354:   @@index([customerId, resolvedAt, dueAt])
355: }
356: 
357: model CustomerReminderReceipt {
358:   id         String           @id @default(cuid())
359:   reminderId String
360:   actorId    String
361:   readAt     DateTime         @default(now()) @db.Timestamptz(3)
362:   reminder   CustomerReminder @relation(fields: [reminderId], references: [id], onDelete: Restrict)
363:   actor      AppUser          @relation(fields: [actorId], references: [id], onDelete: Restrict)
364: 
365:   @@unique([reminderId, actorId])
366:   @@index([actorId, readAt])
367: }
368: 
369: model AuditEvent {
370:   id                    String                 @id @default(cuid())
371:   actorId               String
372:   entityType            String                 @db.VarChar(64)
373:   entityId              String
374:   action                String                 @db.VarChar(80)
375:   changedFields         String[]
376:   metadata              Json?
377:   actor                 AppUser                @relation(fields: [actorId], references: [id], onDelete: Restrict)
378:   communicationActivity CommunicationActivity? @relation("CommunicationActivityAuditEvent")
379:   createdAt             DateTime               @default(now()) @db.Timestamptz(3)
380: 
381:   @@index([entityType, entityId, createdAt])
382:   @@index([actorId, createdAt])
383:   @@index([createdAt])
384: }
385: 
386: model SequenceCounter {
387:   key       String   @id @db.VarChar(64)
388:   value     Int
389:   updatedAt DateTime @updatedAt @db.Timestamptz(3)
390: }

(End of file - total 390 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/new-lead-form.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/new-lead-form.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState } from "react";
4: import { Plus } from "lucide-react";
5: 
6: import { createLeadAction } from "@/app/actions/crm";
7: import { CustomerFields, type CustomerFormOption } from "@/components/crm/customer-fields";
8: import { OpportunityFields } from "@/components/crm/opportunity-fields";
9: import { SubmitButton } from "@/components/submit-button";
10: import { Button } from "@/components/ui/button";
11: import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
12: import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
13: import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
14: 
15: type CustomerOption = {
16:   id: string;
17:   customerNo: string;
18:   name: string;
19:   companyName: string | null;
20: };
21: 
22: export function NewLeadForm({ customers, customerTypes, leadSources, salesUsers }: { customers: CustomerOption[]; customerTypes: CustomerFormOption[]; leadSources: CustomerFormOption[]; salesUsers: CustomerFormOption[] }) {
23:   const [customerMode, setCustomerMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
24: 
25:   return (
26:     <Dialog>
27:       <DialogTrigger render={<Button />}><Plus data-icon="inline-start" aria-hidden="true" />Lead baru</DialogTrigger>
28:       <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
29:         <DialogHeader>
30:           <DialogTitle>Tambah lead baru</DialogTitle>
31:           <DialogDescription>Simpan customer dan kebutuhan awal dalam satu alur kerja.</DialogDescription>
32:         </DialogHeader>
33:         <form action={createLeadAction}>
34:           <FieldGroup>
35:             <FieldSet>
36:               <FieldLegend>Customer</FieldLegend>
37:               <Field>
38:                 <FieldLabel htmlFor="customerMode" required>Gunakan data customer</FieldLabel>
39:                 <NativeSelect id="customerMode" name="customerMode" required value={customerMode} onChange={(event) => setCustomerMode(event.target.value as "existing" | "new")}>
40:                   {customers.length ? <NativeSelectOption value="existing">Customer tersimpan</NativeSelectOption> : null}
41:                   <NativeSelectOption value="new">Customer baru</NativeSelectOption>
42:                 </NativeSelect>
43:               </Field>
44:               {customerMode === "existing" ? (
45:                 <Field>
46:                   <FieldLabel htmlFor="customerId" required>Customer</FieldLabel>
47:                   <NativeSelect id="customerId" name="customerId" required defaultValue="">
48:                     <NativeSelectOption value="" disabled>Pilih customer</NativeSelectOption>
49:                     {customers.map((customer) => <NativeSelectOption key={customer.id} value={customer.id}>{customer.name}{customer.companyName ? ` · ${customer.companyName}` : ""} ({customer.customerNo})</NativeSelectOption>)}
50:                   </NativeSelect>
51:                 </Field>
52:               ) : <CustomerFields idPrefix="lead-customer" customerTypes={customerTypes} leadSources={leadSources} salesUsers={salesUsers} />}
53:             </FieldSet>
54:             <OpportunityFields idPrefix="new-lead" leadSources={leadSources} salesUsers={salesUsers} />
55:             <SubmitButton pendingLabel="Membuat lead...">Simpan lead</SubmitButton>
56:           </FieldGroup>
57:         </form>
58:       </DialogContent>
59:     </Dialog>
60:   );
61: }

(End of file - total 61 lines)
</content>
```

---

## Assistant (Plan · Big Pickle · 16.4s)

Let me look at the opportunity detail page and follow-up form to understand the current flow better.



**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/app/(app)/crm/peluang/[id]/page.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/app/(app)/crm/peluang/[id]/page.tsx</path>
<type>file</type>
<content>
1: import Link from "next/link";
2: import { notFound, redirect } from "next/navigation";
3: import { ArrowLeft, FileCheck2, FileDown, ImageIcon, Save } from "lucide-react";
4: 
5: import {
6:   acceptQuotationAndDealAction,
7:   createQuotationRevisionAction,
8:   issueQuotationAction,
9:   updateOpportunityAction,
10: } from "@/app/actions/crm";
11: import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
12: import { CommunicationEntryForm } from "@/components/crm/communication-entry-form";
13: import { CommunicationHistory } from "@/components/crm/communication-history";
14: import { OpportunityStageForm } from "@/components/crm/opportunity-stage-form";
15: import { OpportunityFields } from "@/components/crm/opportunity-fields";
16: import { QuotationForm } from "@/components/crm/quotation-form";
17: import { PageHeader } from "@/components/page-header";
18: import { PageMessage } from "@/components/page-message";
19: import { OpportunityStatusBadge, QuotationStatusBadge, SalesOrderStatusBadge } from "@/components/status-badge";
20: import { SubmitButton } from "@/components/submit-button";
21: import { Button } from "@/components/ui/button";
22: import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
23: import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
24: import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
25: import { Input } from "@/components/ui/input";
26: import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
27: import { Textarea } from "@/components/ui/textarea";
28: import { getCommunicationTimeline, getOpportunityDetail } from "@/lib/crm/data";
29: import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/crm/format";
30: import { getCustomerFormOptions } from "@/lib/master-data";
31: import { parsePageParam } from "@/lib/pagination";
32: 
33: export default async function OpportunityDetailPage({
34:   params,
35:   searchParams,
36: }: {
37:   params: Promise<{ id: string }>;
38:   searchParams: Promise<{ historyPage?: string | string[] }>;
39: }) {
40:   const { id } = await params;
41:   const historyPage = parsePageParam((await searchParams).historyPage);
42:   const [opportunity, formOptions, communicationHistory] = await Promise.all([
43:     getOpportunityDetail(id),
44:     getCustomerFormOptions(),
45:     getCommunicationTimeline({ opportunityId: id, page: historyPage }),
46:   ]);
47:   if (!opportunity) notFound();
48:   if (historyPage > communicationHistory.pageCount) redirect(`/crm/peluang/${id}?historyPage=${communicationHistory.pageCount}#communication-history`);
49:   const draft = opportunity.quotations.find((quotation) => quotation.status === "DRAFT");
50:   const canManageQuotation = opportunity.stage === "PENAWARAN" || opportunity.stage === "NEGOSIASI";
51: 
52:   return (
53:     <>
54:       <Button variant="ghost" size="sm" render={<Link href="/crm" />} nativeButton={false} className="w-fit">
55:         <ArrowLeft data-icon="inline-start" aria-hidden="true" />
56:         Kembali ke pipeline
57:       </Button>
58:       <PageHeader
59:         title={opportunity.title}
60:         description={`${opportunity.opportunityNo} · ${opportunity.customer.name} · Diperbarui ${formatDate(opportunity.updatedAt, true)}`}
61:         action={<OpportunityStatusBadge stage={opportunity.stage} />}
62:       />
63:       <PageMessage />
64: 
65:       <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
66:         <div className="flex min-w-0 flex-col gap-6">
67:           <Card>
68:             <CardHeader>
69:               <CardTitle>Kualifikasi dan next action</CardTitle>
70:               <CardDescription>Lengkapi kebutuhan, penugasan, skor, dan tindakan berikutnya untuk peluang ini.</CardDescription>
71:             </CardHeader>
72:             <CardContent>
73:               <form action={updateOpportunityAction}>
74:                 <input type="hidden" name="opportunityId" value={opportunity.id} />
75:                 <input type="hidden" name="version" value={opportunity.version} />
76:                 <OpportunityFields idPrefix="opportunity" leadSources={formOptions.leadSources} salesUsers={formOptions.salesUsers} values={opportunity} />
77:                 <div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
78:                   <p className="text-sm text-muted-foreground">Simpan setelah mengubah kebutuhan, penugasan, atau next action.</p>
79:                   <SubmitButton className="w-full sm:w-auto" size="lg" pendingLabel="Memperbarui...">
80:                     <Save data-icon="inline-start" aria-hidden="true" />
81:                     Simpan kualifikasi
82:                   </SubmitButton>
83:                 </div>
84:               </form>
85:             </CardContent>
86:           </Card>
87: 
88:           <Card>
89:             <CardHeader>
90:               <CardTitle>Penawaran</CardTitle>
91:               <CardDescription>Draft dapat diedit. Setelah terbit, perubahan harga dibuat sebagai revisi baru.</CardDescription>
92:             </CardHeader>
93:             <CardContent>
94:               {opportunity.quotations.length ? (
95:                 <div className="flex flex-col gap-6">
96:                   {opportunity.quotations.map((quotation) => (
97:                     <section key={quotation.id} aria-labelledby={`quotation-${quotation.id}`} className="rounded-lg border border-info/20 bg-info/5 p-4">
98:                       <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
99:                         <div>
100:                           <h3 id={`quotation-${quotation.id}`} className="font-medium">{quotation.quotationNo} · Revisi {quotation.revision}</h3>
101:                           <p className="mt-1 text-xs text-muted-foreground">Dibuat {formatDate(quotation.createdAt, true)}</p>
102:                         </div>
103:                         <QuotationStatusBadge status={quotation.status} />
104:                       </div>
105: 
106:                       {quotation.status === "DRAFT" ? (
107:                         <QuotationForm
108:                           opportunityId={opportunity.id}
109:                           draft={{
110:                             id: quotation.id,
111:                             version: quotation.version,
112:                             discountType: quotation.discountType,
113:                             discountValue: quotation.discountValue.toString(),
114:                             items: quotation.items.map((item) => ({
115:                               description: item.description,
116:                               quantity: item.quantity,
117:                               unitPrice: item.unitPrice.toString(),
118:                             })),
119:                           }}
120:                         />
121:                       ) : (
122:                         <QuotationSnapshot quotation={quotation} />
123:                       )}
124: 
125:                       <div className="mt-4 flex flex-wrap gap-2">
126:                         <Button variant="outline" render={<Link href={`/api/crm/quotation/${quotation.id}/pdf`} />} nativeButton={false}>
127:                           <FileDown data-icon="inline-start" aria-hidden="true" />
128:                           Unduh PDF
129:                         </Button>
130:                         {quotation.status === "DRAFT" ? (
131:                           <form action={issueQuotationAction}>
132:                             <input type="hidden" name="quotationId" value={quotation.id} />
133:                             <input type="hidden" name="version" value={quotation.version} />
134:                             <ConfirmSubmitButton
135:                               pendingLabel="Menerbitkan..."
136:                               confirmTitle="Terbitkan dan kunci quotation?"
137:                               confirmDescription="Draft tidak dapat diedit lagi setelah diterbitkan. Perubahan berikutnya harus dibuat sebagai revisi baru."
138:                               confirmLabel="Ya, terbitkan"
139:                             >
140:                               Terbitkan &amp; kunci
141:                             </ConfirmSubmitButton>
142:                           </form>
143:                         ) : null}
144:                         {(quotation.status === "ISSUED" || quotation.status === "ACCEPTED") && canManageQuotation ? (
145:                           <form action={createQuotationRevisionAction}>
146:                             <input type="hidden" name="quotationId" value={quotation.id} />
147:                             <ConfirmSubmitButton
148:                               variant="outline"
149:                               pendingLabel="Membuat revisi..."
150:                               confirmTitle="Buat revisi quotation?"
151:                               confirmDescription="Quotation terbit ini akan digantikan dan draft revisi baru akan dibuat dari snapshot yang sama."
152:                               confirmLabel="Ya, buat revisi"
153:                             >
154:                               Buat revisi
155:                             </ConfirmSubmitButton>
156:                           </form>
157:                         ) : null}
158:                         {quotation.salesOrder ? (
159:                           <Button variant="outline" render={<Link href={`/sales-orders/${quotation.salesOrder.id}`} />} nativeButton={false}>
160:                             Lihat {quotation.salesOrder.salesOrderNo}
161:                           </Button>
162:                         ) : null}
163:                       </div>
164: 
165:                       {quotation.status === "ISSUED" ? (
166:                         <form action={acceptQuotationAndDealAction} className="mt-4 rounded-lg border border-success/20 bg-success/5 p-4">
167:                           <input type="hidden" name="quotationId" value={quotation.id} />
168:                           <input type="hidden" name="version" value={quotation.version} />
169:                           <FieldGroup>
170:                             <div>
171:                               <p className="text-sm font-medium">Diterima &amp; Deal</p>
172:                               <p className="mt-1 text-xs leading-5 text-muted-foreground">Catat bukti persetujuan dari WhatsApp/Instagram. Aksi ini membuat Sales Order immutable.</p>
173:                             </div>
174:                             <Field>
175:                               <FieldLabel htmlFor={`acceptedAt-${quotation.id}`} required>Waktu diterima</FieldLabel>
176:                               <Input id={`acceptedAt-${quotation.id}`} name="acceptedAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(new Date())} />
177:                             </Field>
178:                             <Field>
179:                               <FieldLabel htmlFor={`acceptanceReference-${quotation.id}`} required>Referensi / catatan persetujuan</FieldLabel>
180:                               <Textarea id={`acceptanceReference-${quotation.id}`} name="acceptanceReference" required minLength={3} maxLength={2000} rows={3} placeholder="Contoh: Disetujui Ibu Rina via WA, 27 Agustus 14:20" />
181:                             </Field>
182:                             <Field>
183:                               <FieldLabel htmlFor={`acceptanceProof-${quotation.id}`}>Bukti gambar persetujuan</FieldLabel>
184:                               <Input id={`acceptanceProof-${quotation.id}`} name="acceptanceProof" type="file" accept="image/jpeg,image/png,image/webp" />
185:                               <p className="text-xs leading-5 text-muted-foreground">Opsional. Unggah screenshot chat JPG, PNG, atau WebP maksimal 5 MB.</p>
186:                             </Field>
187:                             <ConfirmSubmitButton
188:                               pendingLabel="Membentuk Sales Order..."
189:                               confirmTitle="Terima quotation dan buat Sales Order?"
190:                               confirmDescription="Quotation akan dikunci sebagai Diterima, peluang menjadi Deal, dan Sales Order immutable akan dibuat."
191:                               confirmLabel="Ya, terima dan buat Sales Order"
192:                             >
193:                               <FileCheck2 data-icon="inline-start" aria-hidden="true" />
194:                               Diterima &amp; Deal
195:                             </ConfirmSubmitButton>
196:                           </FieldGroup>
197:                         </form>
198:                       ) : null}
199:                     </section>
200:                   ))}
201:                 </div>
202:               ) : canManageQuotation ? (
203:                 <QuotationForm opportunityId={opportunity.id} />
204:               ) : (
205:                 <Empty className="p-8">
206:                   <EmptyHeader>
207:                     <EmptyMedia variant="icon"><FileCheck2 aria-hidden="true" /></EmptyMedia>
208:                     <EmptyTitle>Belum ada quotation</EmptyTitle>
209:                     <EmptyDescription>Pindahkan peluang ke Penawaran untuk mulai menyusun harga.</EmptyDescription>
210:                   </EmptyHeader>
211:                 </Empty>
212:               )}
213:               {canManageQuotation && opportunity.quotations.length > 0 && !draft ? (
214:                 <p className="mt-4 text-xs text-muted-foreground">Gunakan “Buat revisi” pada quotation terbit/diterima untuk melanjutkan negosiasi.</p>
215:               ) : null}
216:             </CardContent>
217:           </Card>
218: 
219:           <CommunicationHistory
220:             items={communicationHistory.items}
221:             total={communicationHistory.total}
222:             page={communicationHistory.page}
223:             pageCount={communicationHistory.pageCount}
224:             pathname={`/crm/peluang/${opportunity.id}`}
225:             form={!opportunity.customer.archivedAt ? (
226:               <CommunicationEntryForm
227:                 context="opportunity"
228:                 customerId={opportunity.customer.id}
229:                 opportunityId={opportunity.id}
230:                 initialOccurredAt={toDateTimeLocalValue(new Date())}
231:               />
232:             ) : undefined}
233:           />
234:         </div>
235: 
236:         <aside className="flex flex-col gap-6 rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/6 p-3 sm:p-4">
237:           <Card>
238:             <CardHeader>
239:               <CardTitle>Status pipeline</CardTitle>
240:               <CardDescription>Tentukan langkah kerja berikutnya.</CardDescription>
241:             </CardHeader>
242:             <CardContent>
243:               <OpportunityStageForm
244:                 opportunityId={opportunity.id}
245:                 version={opportunity.version}
246:                 initialStage={opportunity.stage}
247:                 cancelReason={opportunity.cancelReason}
248:               />
249:             </CardContent>
250:           </Card>
251: 
252:           <Card size="sm">
253:             <CardHeader>
254:               <CardTitle>Customer</CardTitle>
255:               <CardDescription>{opportunity.customer.customerNo}</CardDescription>
256:               <CardAction>
257:                 <Button variant="link" size="sm" render={<Link href={`/crm/pelanggan/${opportunity.customer.id}`} />} nativeButton={false}>Buka profil</Button>
258:               </CardAction>
259:             </CardHeader>
260:             <CardContent>
261:               <p className="font-medium">{opportunity.customer.name}</p>
262:               {opportunity.customer.companyName ? <p className="text-sm text-muted-foreground">{opportunity.customer.companyName}</p> : null}
263:               <dl className="grid gap-2 text-sm text-muted-foreground">
264:                 <div><dt className="sr-only">WhatsApp</dt><dd>{opportunity.customer.whatsapp ?? "-"}</dd></div>
265:                 <div><dt className="sr-only">Email</dt><dd>{opportunity.customer.email ?? "-"}</dd></div>
266:                 <div><dt className="sr-only">Instagram</dt><dd>{opportunity.customer.instagram ? `@${opportunity.customer.instagram}` : "-"}</dd></div>
267:               </dl>
268:             </CardContent>
269:           </Card>
270: 
271:           {opportunity.salesOrders.length ? (
272:             <Card size="sm">
273:               <CardHeader>
274:                 <CardTitle>Sales Order</CardTitle>
275:                 <CardDescription>Riwayat output Deal.</CardDescription>
276:               </CardHeader>
277:               <CardContent>
278:                 {opportunity.salesOrders.map((order) => (
279:                   <div key={order.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
280:                     <div>
281:                       <Link href={`/sales-orders/${order.id}`} className="font-mono text-sm underline-offset-4 hover:underline">{order.salesOrderNo}</Link>
282:                       <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(order.total)}</p>
283:                     </div>
284:                     <SalesOrderStatusBadge status={order.status} />
285:                   </div>
286:                 ))}
287:               </CardContent>
288:             </Card>
289:           ) : null}
290:         </aside>
291:       </div>
292:     </>
293:   );
294: }
295: 
296: function QuotationSnapshot({ quotation }: { quotation: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>["quotations"][number] }) {
297:   return (
298:     <div className="flex flex-col gap-4">
299:       <Table>
300:         <TableHeader>
301:           <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow>
302:         </TableHeader>
303:         <TableBody>
304:           {quotation.items.map((item) => (
305:             <TableRow key={item.id}>
306:               <TableCell>{item.description}</TableCell>
307:               <TableCell className="text-right font-mono">{item.quantity}</TableCell>
308:               <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
309:               <TableCell className="text-right font-mono">{formatCurrency(item.subtotal)}</TableCell>
310:             </TableRow>
311:           ))}
312:         </TableBody>
313:       </Table>
314:       <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
315:         <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatCurrency(quotation.subtotal)}</dd></div>
316:         <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Diskon</dt><dd className="font-mono">{quotation.discountType === "PERCENTAGE" ? `${quotation.discountValue.toString()}%` : formatCurrency(quotation.discountValue)}</dd></div>
317:         <div className="flex justify-between gap-4 border-t border-info/20 pt-2 font-medium text-info"><dt>Total</dt><dd className="font-mono">{formatCurrency(quotation.total)}</dd></div>
318:       </dl>
319:       {quotation.acceptedAt ? (
320:         <div className="rounded-md bg-success/10 p-3 text-sm text-success">
321:           <p className="font-medium">Diterima {formatDate(quotation.acceptedAt, true)}</p>
322:           <p className="mt-1 whitespace-pre-wrap">{quotation.acceptanceReference}</p>
323:           {quotation.acceptanceProofPath ? (
324:             <Button
325:               className="mt-3"
326:               size="sm"
327:               variant="outline"
328:               render={<Link href={`/api/crm/quotation/${quotation.id}/acceptance-proof`} target="_blank" rel="noreferrer" />}
329:               nativeButton={false}
330:             >
331:               <ImageIcon data-icon="inline-start" aria-hidden="true" />
332:               Lihat bukti gambar
333:             </Button>
334:           ) : null}
335:         </div>
336:       ) : null}
337:     </div>
338:   );
339: }

(End of file - total 339 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/app/actions/crm.ts"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/app/actions/crm.ts</path>
<type>file</type>
<content>
1: "use server";
2: 
3: import { Prisma, type CommunicationSystemEvent } from "@prisma/client";
4: import { randomUUID } from "node:crypto";
5: import { revalidatePath } from "next/cache";
6: 
7: import { flashMessagePath, messageForError, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
8: import { ARCHIVE_ROLES, REVERSE_DEAL_ROLES } from "@/lib/auth/permissions";
9: import { requireActor, type Actor } from "@/lib/auth/session";
10: import { OPEN_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
11: import { nextCustomerNo, nextOpportunityNo, nextQuotationNo, nextSalesOrderNo } from "@/lib/crm/numbers";
12: import {
13:   rearmCustomerRemindersAfterLost,
14:   restoreCustomerRemindersAfterCancellation,
15:   scheduleCustomerReminders,
16: } from "@/lib/crm/reminders";
17: import {
18:   acceptQuotationSchema,
19:   ACCEPTANCE_PROOF_MAX_BYTES,
20:   ACCEPTANCE_PROOF_TYPES,
21:   addCommunicationActivitySchema,
22:   archiveCustomerSchema,
23:   createCustomerSchema,
24:   createOpportunitySchema,
25:   entityIdSchema,
26:   firstValidationMessage,
27:   moveOpportunitySchema,
28:   opportunityFieldsSchema,
29:   quotationDraftSchema,
30:   quotationIdSchema,
31:   recordFollowUpResultSchema,
32:   reverseSalesOrderSchema,
33:   updateCustomerSchema,
34:   updateOpportunitySchema,
35: } from "@/lib/crm/validation";
36: import { getPrismaClient } from "@/lib/prisma";
37: import { createAdminClient } from "@/lib/supabase/admin";
38: 
39: type Tx = Prisma.TransactionClient;
40: const ACCEPTANCE_PROOF_BUCKET = "quotation-acceptance-proofs";
41: 
42: function revalidateCustomerReminders() {
43:   revalidatePath("/notifications");
44:   revalidatePath("/", "layout");
45: }
46: 
47: function formValue(formData: FormData, key: string) {
48:   return formData.get(key);
49: }
50: 
51: function optionalDate(value?: string) {
52:   if (!value) return null;
53:   const date = new Date(`${value}T00:00:00.000Z`);
54:   if (Number.isNaN(date.getTime())) throw new UserFacingError("Tanggal tidak valid.");
55:   return date;
56: }
57: 
58: function jakartaDateTime(value?: string) {
59:   if (!value) return null;
60:   const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}:00+07:00`;
61:   const date = new Date(zoned);
62:   if (Number.isNaN(date.getTime())) throw new UserFacingError("Tanggal dan waktu tidak valid.");
63:   return date;
64: }
65: 
66: async function validatedAcceptanceProof(value: FormDataEntryValue | null, quotationId: string) {
67:   if (!(value instanceof File) || value.size === 0) return null;
68:   if (value.size > ACCEPTANCE_PROOF_MAX_BYTES) throw new UserFacingError("Bukti gambar maksimal 5 MB.");
69:   if (!ACCEPTANCE_PROOF_TYPES.includes(value.type as (typeof ACCEPTANCE_PROOF_TYPES)[number])) {
70:     throw new UserFacingError("Bukti gambar harus berformat JPG, PNG, atau WebP.");
71:   }
72: 
73:   const bytes = new Uint8Array(await value.arrayBuffer());
74:   const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
75:   const isPng = bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
76:   const isWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
77:   if (!(isJpeg || isPng || isWebp)) throw new UserFacingError("Isi file tidak sesuai dengan format gambar yang dipilih.");
78: 
79:   const extension = value.type === "image/png" ? "png" : value.type === "image/webp" ? "webp" : "jpg";
80:   return {
81:     bytes,
82:     contentType: value.type,
83:     originalName: value.name.slice(0, 255),
84:     path: `${quotationId}/${randomUUID()}.${extension}`,
85:   };
86: }
87: 
88: async function audit(
89:   tx: Tx,
90:   actor: Actor,
91:   entityType: string,
92:   entityId: string,
93:   action: string,
94:   changedFields: string[],
95:   metadata?: Prisma.InputJsonValue,
96: ) {
97:   return tx.auditEvent.create({
98:     data: { actorId: actor.id, entityType, entityId, action, changedFields, metadata },
99:     select: { id: true },
100:   });
101: }
102: 
103: async function addSystemActivity(
104:   tx: Tx,
105:   actor: Actor,
106:   data: {
107:     customerId: string;
108:     opportunityId: string;
109:     systemEvent: CommunicationSystemEvent;
110:     content: string;
111:     occurredAt?: Date;
112:     metadata?: Prisma.InputJsonValue;
113:     sourceAuditEventId: string;
114:   },
115: ) {
116:   await tx.communicationActivity.create({
117:     data: {
118:       customerId: data.customerId,
119:       opportunityId: data.opportunityId,
120:       authorId: actor.id,
121:       kind: "SYSTEM",
122:       systemEvent: data.systemEvent,
123:       content: data.content,
124:       occurredAt: data.occurredAt ?? new Date(),
125:       metadata: data.metadata,
126:       sourceAuditEventId: data.sourceAuditEventId,
127:     },
128:   });
129: }
130: 
131: function customerFields(formData: FormData) {
132:   return {
133:     name: formValue(formData, "name"),
134:     companyName: formValue(formData, "companyName"),
135:     whatsapp: formValue(formData, "whatsapp"),
136:     email: formValue(formData, "email"),
137:     instagram: formValue(formData, "instagram"),
138:     address: formValue(formData, "address"),
139:     city: formValue(formData, "city"),
140:     notes: formValue(formData, "notes"),
141:     customerTypeId: formValue(formData, "customerTypeId"),
142:     leadSourceId: formValue(formData, "leadSourceId"),
143:     salesPicId: formValue(formData, "salesPicId"),
144:   };
145: }
146: 
147: function quotationInput(formData: FormData) {
148:   const descriptions = formData.getAll("itemDescription");
149:   const quantities = formData.getAll("itemQuantity");
150:   const unitPrices = formData.getAll("itemUnitPrice");
151:   const length = Math.max(descriptions.length, quantities.length, unitPrices.length);
152:   const items = Array.from({ length }, (_, index) => ({
153:     description: descriptions[index],
154:     quantity: quantities[index],
155:     unitPrice: unitPrices[index],
156:   }));
157: 
158:   return {
159:     opportunityId: formValue(formData, "opportunityId"),
160:     quotationId: formValue(formData, "quotationId") || undefined,
161:     version: formValue(formData, "version") || undefined,
162:     discountType: formValue(formData, "discountType"),
163:     discountValue: formValue(formData, "discountValue"),
164:     items,
165:   };
166: }
167: 
168: function opportunityInput(formData: FormData) {
169:   return {
170:     title: formValue(formData, "title"),
171:     leadSourceId: formData.has("opportunityLeadSourceId")
172:       ? formValue(formData, "opportunityLeadSourceId")
173:       : formValue(formData, "leadSourceId"),
174:     salesPicId: formData.has("opportunitySalesPicId")
175:       ? formValue(formData, "opportunitySalesPicId")
176:       : formValue(formData, "salesPicId"),
177:     productName: formValue(formData, "productName"),
178:     needPurpose: formValue(formData, "needPurpose"),
179:     designStatus: formValue(formData, "designStatus"),
180:     specification: formValue(formData, "specification"),
181:     customerBudget: formValue(formData, "customerBudget"),
182:     leadScore: formValue(formData, "leadScore") || "0",
183:     estimatedQuantity: formValue(formData, "estimatedQuantity"),
184:     estimatedValue: formValue(formData, "estimatedValue"),
185:     deadline: formValue(formData, "deadline"),
186:     nextAction: formValue(formData, "nextAction"),
187:     nextActionAt: formValue(formData, "nextActionAt"),
188:   };
189: }
190: 
191: function calculateQuotation(data: {
192:   discountType: "NONE" | "NOMINAL" | "PERCENTAGE";
193:   discountValue: string;
194:   items: Array<{ description: string; quantity: number; unitPrice: string }>;
195: }) {
196:   const items = data.items.map((item, position) => {
197:     const unitPrice = new Prisma.Decimal(item.unitPrice);
198:     return {
199:       position,
200:       description: item.description,
201:       quantity: item.quantity,
202:       unitPrice,
203:       subtotal: unitPrice.mul(item.quantity),
204:     };
205:   });
206:   const subtotal = items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
207:   const discountValue = data.discountType === "NONE" ? new Prisma.Decimal(0) : new Prisma.Decimal(data.discountValue);
208: 
209:   if (data.discountType === "PERCENTAGE" && discountValue.gt(100)) {
210:     throw new UserFacingError("Diskon persentase maksimal 100%.");
211:   }
212: 
213:   const discountAmount =
214:     data.discountType === "PERCENTAGE"
215:       ? subtotal.mul(discountValue).div(100)
216:       : data.discountType === "NOMINAL"
217:         ? discountValue
218:         : new Prisma.Decimal(0);
219: 
220:   if (discountAmount.gt(subtotal)) throw new UserFacingError("Diskon tidak boleh melebihi subtotal.");
221: 
222:   return { items, subtotal, discountValue, total: subtotal.sub(discountAmount) };
223: }
224: 
225: export async function createCustomerAction(formData: FormData) {
226:   return runRedirectingAction("/crm/pelanggan", async () => {
227:     const actor = await requireActor();
228:     const parsed = createCustomerSchema.safeParse(customerFields(formData));
229:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
230: 
231:     await getPrismaClient().$transaction(
232:       async (tx) => {
233:         const [customerType, leadSource, salesPic] = await Promise.all([
234:           tx.customerType.findUnique({ where: { id: parsed.data.customerTypeId }, select: { id: true } }),
235:           parsed.data.leadSourceId ? tx.leadSource.findUnique({ where: { id: parsed.data.leadSourceId }, select: { id: true } }) : null,
236:           parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
237:         ]);
238:         if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
239:         if (parsed.data.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
240:         if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
241:         const created = await tx.customer.create({
242:           data: { ...parsed.data, email: parsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
243:           select: { id: true },
244:         });
245:         await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
246:           "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
247:         ]);
248:         return created;
249:       },
250:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
251:     );
252: 
253:     revalidatePath("/crm");
254:     revalidatePath("/crm/pelanggan");
255:     return flashMessagePath("/crm/pelanggan", "notice", "Customer berhasil dibuat.");
256:   });
257: }
258: 
259: export async function updateCustomerAction(formData: FormData) {
260:   return runRedirectingAction("/crm/pelanggan", async () => {
261:     const actor = await requireActor();
262:     const parsed = updateCustomerSchema.safeParse({
263:       ...customerFields(formData),
264:       customerId: formValue(formData, "customerId"),
265:       version: formValue(formData, "version"),
266:     });
267:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
268: 
269:     const { customerId, version, ...fields } = parsed.data;
270:     const result = await getPrismaClient().$transaction(async (tx) => {
271:       const current = await tx.customer.findUnique({ where: { id: customerId }, select: { customerTypeId: true, leadSourceId: true, salesPicId: true } });
272:       if (!current) throw new UserFacingError("Customer tidak ditemukan.");
273:       const [customerType, leadSource, salesPic] = await Promise.all([
274:         tx.customerType.findUnique({ where: { id: fields.customerTypeId }, select: { id: true } }),
275:         fields.leadSourceId ? tx.leadSource.findUnique({ where: { id: fields.leadSourceId }, select: { id: true } }) : null,
276:         fields.salesPicId ? tx.appUser.findFirst({ where: { id: fields.salesPicId, role: "SALES", OR: [{ isActive: true }, { id: current.salesPicId ?? "" }] }, select: { id: true } }) : null,
277:       ]);
278:       if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
279:       if (fields.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
280:       if (fields.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
281:       const updated = await tx.customer.updateMany({
282:         where: { id: customerId, version, archivedAt: null },
283:         data: { ...fields, email: fields.email?.toLowerCase(), version: { increment: 1 } },
284:       });
285:       if (updated.count !== 1) throw new UserFacingError("Customer sudah berubah atau telah diarsipkan. Muat ulang halaman.");
286:       await audit(tx, actor, "Customer", customerId, "CUSTOMER_UPDATED", [
287:         "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
288:       ]);
289:       return updated;
290:     });
291:     if (!result.count) throw new UserFacingError("Customer tidak dapat diperbarui.");
292: 
293:     revalidatePath("/crm/pelanggan");
294:     revalidatePath(`/crm/pelanggan/${customerId}`);
295:     revalidateCustomerReminders();
296:     return flashMessagePath("/crm/pelanggan", "notice", "Data customer diperbarui.");
297:   });
298: }
299: 
300: export async function archiveCustomerAction(formData: FormData) {
301:   return runRedirectingAction("/crm/pelanggan", async () => {
302:     const actor = await requireActor(ARCHIVE_ROLES);
303:     const parsed = archiveCustomerSchema.safeParse({
304:       customerId: formValue(formData, "customerId"),
305:       version: formValue(formData, "version"),
306:     });
307:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
308: 
309:     const prisma = getPrismaClient();
310:     await prisma.$transaction(
311:       async (tx) => {
312:         const customer = await tx.customer.findUnique({
313:           where: { id: parsed.data.customerId },
314:           select: {
315:             archivedAt: true,
316:             opportunities: {
317:               where: {
318:                 OR: [
319:                   { stage: { in: OPEN_STAGES } },
320:                   { salesOrders: { some: { status: "ACTIVE" } } },
321:                 ],
322:               },
323:               select: { id: true },
324:               take: 1,
325:             },
326:           },
327:         });
328:         if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak ditemukan atau sudah diarsipkan.");
329:         if (customer.opportunities.length > 0) {
330:           throw new UserFacingError("Customer masih memiliki peluang terbuka atau Sales Order aktif.");
331:         }
332: 
333:         const updated = await tx.customer.updateMany({
334:           where: { id: parsed.data.customerId, version: parsed.data.version, archivedAt: null },
335:           data: { archivedAt: new Date(), version: { increment: 1 } },
336:         });
337:         if (updated.count !== 1) throw new UserFacingError("Data customer sudah berubah. Muat ulang halaman.");
338:         await audit(tx, actor, "Customer", parsed.data.customerId, "CUSTOMER_ARCHIVED", ["archivedAt"]);
339:       },
340:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
341:     );
342: 
343:     revalidatePath("/crm");
344:     revalidatePath("/crm/pelanggan");
345:     revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
346:     revalidateCustomerReminders();
347:     return flashMessagePath("/crm/pelanggan", "notice", "Customer diarsipkan.");
348:   });
349: }
350: 
351: export async function restoreCustomerAction(formData: FormData) {
352:   return runRedirectingAction("/crm/pelanggan?segment=archived", async () => {
353:     const actor = await requireActor(ARCHIVE_ROLES);
354:     const parsed = archiveCustomerSchema.safeParse({
355:       customerId: formValue(formData, "customerId"),
356:       version: formValue(formData, "version"),
357:     });
358:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
359: 
360:     await getPrismaClient().$transaction(async (tx) => {
361:       const updated = await tx.customer.updateMany({
362:         where: {
363:           id: parsed.data.customerId,
364:           version: parsed.data.version,
365:           archivedAt: { not: null },
366:         },
367:         data: { archivedAt: null, version: { increment: 1 } },
368:       });
369:       if (updated.count !== 1) {
370:         throw new UserFacingError("Customer sudah aktif, tidak ditemukan, atau datanya telah berubah. Muat ulang halaman.");
371:       }
372:       await audit(tx, actor, "Customer", parsed.data.customerId, "CUSTOMER_RESTORED", ["archivedAt"]);
373:     });
374: 
375:     revalidatePath("/crm");
376:     revalidatePath("/crm/pelanggan");
377:     revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
378:     revalidateCustomerReminders();
379:     return flashMessagePath("/crm/pelanggan?segment=archived", "notice", "Customer diaktifkan kembali.");
380:   });
381: }
382: 
383: export async function createOpportunityAction(formData: FormData) {
384:   return runRedirectingAction("/crm", async () => {
385:     const actor = await requireActor();
386:     const parsed = createOpportunitySchema.safeParse({
387:       customerId: formValue(formData, "customerId"),
388:       ...opportunityInput(formData),
389:     });
390:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
391: 
392:     const prisma = getPrismaClient();
393:     const opportunity = await prisma.$transaction(
394:       async (tx) => {
395:         const customer = await tx.customer.findFirst({
396:           where: { id: parsed.data.customerId, archivedAt: null },
397:           select: { id: true, leadSourceId: true, salesPicId: true },
398:         });
399:         if (!customer) throw new UserFacingError("Customer aktif tidak ditemukan.");
400: 
401:         const leadSourceId = parsed.data.leadSourceId ?? customer.leadSourceId;
402:         const salesPicId = parsed.data.salesPicId ?? customer.salesPicId;
403:         const [leadSource, salesPic] = await Promise.all([
404:           leadSourceId ? tx.leadSource.findFirst({ where: { id: leadSourceId, isActive: true }, select: { id: true } }) : null,
405:           salesPicId ? tx.appUser.findFirst({ where: { id: salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
406:         ]);
407:         if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
408:         if (salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
409: 
410:         const created = await tx.opportunity.create({
411:           data: {
412:             opportunityNo: await nextOpportunityNo(tx),
413:             customerId: customer.id,
414:             title: parsed.data.title,
415:             leadSourceId,
416:             salesPicId,
417:             productName: parsed.data.productName,
418:             needPurpose: parsed.data.needPurpose,
419:             designStatus: parsed.data.designStatus,
420:             specification: parsed.data.specification,
421:             customerBudget: parsed.data.customerBudget ? new Prisma.Decimal(parsed.data.customerBudget) : null,
422:             leadScore: parsed.data.leadScore,
423:             estimatedQuantity: parsed.data.estimatedQuantity,
424:             estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
425:             deadline: optionalDate(parsed.data.deadline),
426:             nextAction: parsed.data.nextAction,
427:             nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
428:           },
429:           select: { id: true },
430:         });
431:         await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
432:           "customerId", "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus",
433:           "specification", "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline",
434:           "nextAction", "nextActionAt", "stage",
435:         ], { stage: "LEAD_BARU" });
436:         return created;
437:       },
438:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
439:     );
440: 
441:     revalidatePath("/crm");
442:     revalidatePath("/crm/pelanggan");
443:     revalidateCustomerReminders();
444:     return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
445:   });
446: }
447: 
448: export async function createLeadAction(formData: FormData) {
449:   return runRedirectingAction("/crm", async () => {
450:     const actor = await requireActor();
451:     const customerMode = formValue(formData, "customerMode");
452:     if (customerMode !== "existing" && customerMode !== "new") throw new UserFacingError("Pilih jenis customer untuk lead.");
453:     const opportunityParsed = opportunityFieldsSchema.safeParse(opportunityInput(formData));
454:     if (!opportunityParsed.success) throw new UserFacingError(firstValidationMessage(opportunityParsed.error));
455:     const customerIdParsed = entityIdSchema.safeParse(formValue(formData, "customerId"));
456:     const customerParsed = customerMode === "new" ? createCustomerSchema.safeParse(customerFields(formData)) : null;
457:     if (customerMode === "existing" && !customerIdParsed.success) throw new UserFacingError("Pilih customer tersimpan.");
458:     if (customerParsed && !customerParsed.success) throw new UserFacingError(firstValidationMessage(customerParsed.error));
459: 
460:     const opportunity = await getPrismaClient().$transaction(async (tx) => {
461:       let customer: { id: string; leadSourceId: string | null; salesPicId: string | null };
462:       if (customerMode === "new" && customerParsed?.success) {
463:         const [customerType, customerLeadSource, customerSalesPic] = await Promise.all([
464:           tx.customerType.findUnique({ where: { id: customerParsed.data.customerTypeId }, select: { id: true } }),
465:           customerParsed.data.leadSourceId ? tx.leadSource.findFirst({ where: { id: customerParsed.data.leadSourceId, isActive: true }, select: { id: true } }) : null,
466:           customerParsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: customerParsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
467:         ]);
468:         if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
469:         if (customerParsed.data.leadSourceId && !customerLeadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
470:         if (customerParsed.data.salesPicId && !customerSalesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
471:         customer = await tx.customer.create({
472:           data: { ...customerParsed.data, email: customerParsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
473:           select: { id: true, leadSourceId: true, salesPicId: true },
474:         });
475:         await audit(tx, actor, "Customer", customer.id, "CUSTOMER_CREATED", [
476:           "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
477:         ]);
478:       } else {
479:         customer = await tx.customer.findFirstOrThrow({
480:           where: { id: customerIdParsed.success ? customerIdParsed.data : "", archivedAt: null },
481:           select: { id: true, leadSourceId: true, salesPicId: true },
482:         }).catch(() => { throw new UserFacingError("Customer aktif tidak ditemukan."); });
483:       }
484: 
485:       const leadSourceId = opportunityParsed.data.leadSourceId ?? customer.leadSourceId;
486:       const salesPicId = opportunityParsed.data.salesPicId ?? customer.salesPicId;
487:       const [leadSource, salesPic] = await Promise.all([
488:         leadSourceId ? tx.leadSource.findFirst({ where: { id: leadSourceId, isActive: true }, select: { id: true } }) : null,
489:         salesPicId ? tx.appUser.findFirst({ where: { id: salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
490:       ]);
491:       if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
492:       if (salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
493: 
494:       const created = await tx.opportunity.create({
495:         data: {
496:           opportunityNo: await nextOpportunityNo(tx),
497:           customerId: customer.id,
498:           title: opportunityParsed.data.title,
499:           leadSourceId,
500:           salesPicId,
501:           productName: opportunityParsed.data.productName,
502:           needPurpose: opportunityParsed.data.needPurpose,
503:           designStatus: opportunityParsed.data.designStatus,
504:           specification: opportunityParsed.data.specification,
505:           customerBudget: opportunityParsed.data.customerBudget ? new Prisma.Decimal(opportunityParsed.data.customerBudget) : null,
506:           leadScore: opportunityParsed.data.leadScore,
507:           estimatedQuantity: opportunityParsed.data.estimatedQuantity,
508:           estimatedValue: opportunityParsed.data.estimatedValue ? new Prisma.Decimal(opportunityParsed.data.estimatedValue) : null,
509:           deadline: optionalDate(opportunityParsed.data.deadline),
510:           nextAction: opportunityParsed.data.nextAction,
511:           nextActionAt: jakartaDateTime(opportunityParsed.data.nextActionAt),
512:         },
513:         select: { id: true },
514:       });
515:       await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
516:         "customerId", "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus",
517:         "specification", "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline", "nextAction", "nextActionAt", "stage",
518:       ], { stage: "LEAD_BARU" });
519:       return created;
520:     }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
521: 
522:     revalidatePath("/crm");
523:     revalidatePath("/crm/pelanggan");
524:     revalidatePath("/dashboard");
525:     revalidateCustomerReminders();
526:     return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
527:   });
528: }
529: 
530: export async function updateOpportunityAction(formData: FormData) {
531:   return runRedirectingAction("/crm", async () => {
532:     const actor = await requireActor();
533:     const parsed = updateOpportunitySchema.safeParse({
534:       opportunityId: formValue(formData, "opportunityId"),
535:       version: formValue(formData, "version"),
536:       ...opportunityInput(formData),
537:     });
538:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
539: 
540:     const result = await getPrismaClient().$transaction(async (tx) => {
541:       const [leadSource, salesPic] = await Promise.all([
542:         parsed.data.leadSourceId ? tx.leadSource.findFirst({ where: { id: parsed.data.leadSourceId, isActive: true }, select: { id: true } }) : null,
543:         parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
544:       ]);
545:       if (parsed.data.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
546:       if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
547:       const updated = await tx.opportunity.updateMany({
548:         where: { id: parsed.data.opportunityId, version: parsed.data.version },
549:         data: {
550:           title: parsed.data.title,
551:           leadSourceId: parsed.data.leadSourceId ?? null,
552:           salesPicId: parsed.data.salesPicId ?? null,
553:           productName: parsed.data.productName ?? null,
554:           needPurpose: parsed.data.needPurpose ?? null,
555:           designStatus: parsed.data.designStatus ?? null,
556:           specification: parsed.data.specification ?? null,
557:           customerBudget: parsed.data.customerBudget ? new Prisma.Decimal(parsed.data.customerBudget) : null,
558:           leadScore: parsed.data.leadScore,
559:           estimatedQuantity: parsed.data.estimatedQuantity,
560:           estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
561:           deadline: optionalDate(parsed.data.deadline),
562:           nextAction: parsed.data.nextAction ?? null,
563:           nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
564:           version: { increment: 1 },
565:         },
566:       });
567:       if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
568:       await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_UPDATED", [
569:         "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus", "specification",
570:         "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline", "nextAction", "nextActionAt",
571:       ]);
572:       return updated;
573:     });
574:     if (!result.count) throw new UserFacingError("Peluang tidak dapat diperbarui.");
575: 
576:     revalidatePath("/crm");
577:     revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
578:     return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Peluang diperbarui.");
579:   });
580: }
581: 
582: async function moveOpportunityStage(formData: FormData) {
583:   const actor = await requireActor();
584:   const parsed = moveOpportunitySchema.safeParse({
585:     opportunityId: formValue(formData, "opportunityId"),
586:     version: formValue(formData, "version"),
587:     stage: formValue(formData, "stage"),
588:     cancelReason: formValue(formData, "cancelReason"),
589:   });
590:   if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
591: 
592:   const customerId = await getPrismaClient().$transaction(async (tx) => {
593:     const current = await tx.opportunity.findUnique({
594:       where: { id: parsed.data.opportunityId },
595:       select: { stage: true, customerId: true },
596:     });
597:     if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
598:     if (current.stage === "DEAL") throw new UserFacingError("Deal hanya dapat dibalik melalui Sales Order oleh Owner/Admin.");
599: 
600:     const updated = await tx.opportunity.updateMany({
601:       where: { id: parsed.data.opportunityId, version: parsed.data.version, stage: { not: "DEAL" } },
602:       data: {
603:         stage: parsed.data.stage,
604:         nextAction: parsed.data.stage === "LOST" ? null : undefined,
605:         nextActionAt: parsed.data.stage === "LOST" ? null : undefined,
606:         cancelReason: parsed.data.stage === "LOST" ? parsed.data.cancelReason : null,
607:         version: { increment: 1 },
608:       },
609:     });
610:     if (updated.count !== 1) throw new UserFacingError("Status sudah berubah. Muat ulang board.");
611:     const auditEvent = await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_STAGE_CHANGED", [
612:       "stage", "nextAction", "nextActionAt", "cancelReason",
613:     ], { from: current.stage, to: parsed.data.stage });
614:     await addSystemActivity(tx, actor, {
615:       customerId: current.customerId,
616:       opportunityId: parsed.data.opportunityId,
617:       systemEvent: "STAGE_CHANGED",
618:       content: parsed.data.stage === "LOST" && parsed.data.cancelReason
619:         ? `Status peluang berubah dari ${STAGE_LABEL[current.stage]} menjadi Lost. Alasan: ${parsed.data.cancelReason}`
620:         : `Status peluang berubah dari ${STAGE_LABEL[current.stage]} menjadi ${STAGE_LABEL[parsed.data.stage]}.`,
621:       metadata: {
622:         from: current.stage,
623:         to: parsed.data.stage,
624:         ...(parsed.data.cancelReason ? { cancelReason: parsed.data.cancelReason } : {}),
625:       },
626:       sourceAuditEventId: auditEvent.id,
627:     });
628:     if (parsed.data.stage === "LOST") {
629:       await rearmCustomerRemindersAfterLost(tx, current.customerId);
630:     }
631:     return current.customerId;
632:   });
633: 
634:   revalidatePath("/crm");
635:   revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
636:   revalidatePath(`/crm/pelanggan/${customerId}`);
637:   revalidateCustomerReminders();
638:   return { ...parsed.data, customerId };
639: }
640: 
641: export async function moveOpportunityStageAction(formData: FormData) {
642:   return runRedirectingAction("/crm", async () => {
643:     await moveOpportunityStage(formData);
644:     return flashMessagePath("/crm", "notice", "Status peluang diperbarui.");
645:   });
646: }
647: 
648: export async function moveOpportunityStageOptimisticAction(formData: FormData) {
649:   try {
650:     const moved = await moveOpportunityStage(formData);
651:     return { ok: true as const, opportunityId: moved.opportunityId, version: moved.version + 1 };
652:   } catch (error) {
653:     return { ok: false as const, message: messageForError(error) };
654:   }
655: }
656: 
657: export async function addCommunicationActivityAction(formData: FormData) {
658:   return runRedirectingAction("/crm", async () => {
659:     const actor = await requireActor();
660:     const parsed = addCommunicationActivitySchema.safeParse({
661:       context: formValue(formData, "context"),
662:       customerId: formValue(formData, "customerId"),
663:       opportunityId: formValue(formData, "opportunityId"),
664:       channel: formValue(formData, "channel"),
665:       direction: formValue(formData, "direction"),
666:       occurredAt: formValue(formData, "occurredAt"),
667:       content: formValue(formData, "content"),
668:     });
669:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
670:     const occurredAt = jakartaDateTime(parsed.data.occurredAt);
671:     if (!occurredAt || occurredAt > new Date()) throw new UserFacingError("Waktu aktivitas tidak boleh berada di masa depan.");
672: 
673:     await getPrismaClient().$transaction(async (tx) => {
674:       const customer = await tx.customer.findUnique({
675:         where: { id: parsed.data.customerId },
676:         select: { id: true, archivedAt: true },
677:       });
678:       if (!customer) throw new UserFacingError("Customer tidak ditemukan.");
679:       if (customer.archivedAt) throw new UserFacingError("Pulihkan customer sebelum mencatat aktivitas baru.");
680:       if (parsed.data.opportunityId) {
681:         const opportunity = await tx.opportunity.findFirst({
682:           where: { id: parsed.data.opportunityId, customerId: customer.id },
683:           select: { id: true },
684:         });
685:         if (!opportunity) throw new UserFacingError("Peluang tidak terhubung ke customer ini.");
686:       }
687: 
688:       const activity = await tx.communicationActivity.create({
689:         data: {
690:           customerId: customer.id,
691:           opportunityId: parsed.data.opportunityId,
692:           authorId: actor.id,
693:           kind: parsed.data.channel === "INTERNAL_NOTE" ? "INTERNAL_NOTE" : "COMMUNICATION",
694:           channel: parsed.data.channel === "INTERNAL_NOTE" ? null : parsed.data.channel,
695:           direction: parsed.data.channel === "INTERNAL_NOTE" ? null : parsed.data.direction,
696:           content: parsed.data.content,
697:           occurredAt,
698:         },
699:         select: { id: true },
700:       });
701:       await audit(tx, actor, "CommunicationActivity", activity.id, "COMMUNICATION_ACTIVITY_ADDED", [
702:         "kind", "channel", "direction", "content", "occurredAt",
703:       ], { customerId: customer.id, opportunityId: parsed.data.opportunityId ?? null });
704:     });
705: 
706:     revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
707:     if (parsed.data.opportunityId) revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
708:     const destination = parsed.data.context === "opportunity" && parsed.data.opportunityId
709:       ? `/crm/peluang/${parsed.data.opportunityId}`
710:       : `/crm/pelanggan/${parsed.data.customerId}`;
711:     return flashMessagePath(destination, "notice", "Aktivitas komunikasi ditambahkan.");
712:   });
713: }
714: 
715: export async function recordFollowUpResultAction(formData: FormData) {
716:   return runRedirectingAction("/crm/follow-up", async () => {
717:     const actor = await requireActor();
718:     const parsed = recordFollowUpResultSchema.safeParse({
719:       opportunityId: formValue(formData, "opportunityId"),
720:       version: formValue(formData, "version"),
721:       content: formValue(formData, "content"),
722:       contactedAt: formValue(formData, "contactedAt"),
723:       channel: formValue(formData, "channel"),
724:       direction: formValue(formData, "direction"),
725:       nextAction: formValue(formData, "nextAction"),
726:       nextActionAt: formValue(formData, "nextActionAt"),
727:       stage: formValue(formData, "stage"),
728:       cancelReason: formValue(formData, "cancelReason"),
729:     });
730:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
731: 
732:     const contactedAt = jakartaDateTime(parsed.data.contactedAt);
733:     if (!contactedAt || contactedAt > new Date()) throw new UserFacingError("Waktu kontak tidak boleh berada di masa depan.");
734:     const nextActionAt = parsed.data.stage === "LOST" ? null : jakartaDateTime(parsed.data.nextActionAt);
735:     if (nextActionAt && nextActionAt <= contactedAt) throw new UserFacingError("Jadwal berikutnya harus setelah waktu kontak.");
736: 
737:     const customerId = await getPrismaClient().$transaction(async (tx) => {
738:       const current = await tx.opportunity.findUnique({
739:         where: { id: parsed.data.opportunityId },
740:         select: { customerId: true, customer: { select: { archivedAt: true } } },
741:       });
742:       if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
743:       if (current.customer.archivedAt) throw new UserFacingError("Pulihkan customer sebelum mencatat follow-up.");
744: 
745:       const updated = await tx.opportunity.updateMany({
746:         where: { id: parsed.data.opportunityId, version: parsed.data.version, stage: { notIn: ["DEAL", "LOST"] } },
747:         data: {
748:           stage: parsed.data.stage,
749:           lastContactedAt: contactedAt,
750:           nextAction: parsed.data.stage === "LOST" ? null : parsed.data.nextAction,
751:           nextActionAt,
752:           cancelReason: parsed.data.stage === "LOST" ? parsed.data.cancelReason : null,
753:           version: { increment: 1 },
754:         },
755:       });
756:       if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah atau telah ditutup. Muat ulang halaman.");
757:       const activity = await tx.communicationActivity.create({
758:         data: {
759:           customerId: current.customerId,
760:           opportunityId: parsed.data.opportunityId,
761:           authorId: actor.id,
762:           kind: "COMMUNICATION",
763:           channel: parsed.data.channel,
764:           direction: parsed.data.direction,
765:           content: parsed.data.content,
766:           occurredAt: contactedAt,
767:           metadata: {
768:             stage: parsed.data.stage,
769:             ...(parsed.data.nextAction ? { nextAction: parsed.data.nextAction } : {}),
770:             ...(nextActionAt ? { nextActionAt: nextActionAt.toISOString() } : {}),
771:             ...(parsed.data.cancelReason ? { cancelReason: parsed.data.cancelReason } : {}),
772:           },
773:         },
774:         select: { id: true },
775:       });
776:       await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "FOLLOW_UP_RECORDED", [
777:         "lastContactedAt", "nextAction", "nextActionAt", "stage", "cancelReason", "communicationActivityId",
778:       ], { communicationActivityId: activity.id });
779:       if (parsed.data.stage === "LOST") {
780:         await rearmCustomerRemindersAfterLost(tx, current.customerId);
781:       }
782:       return current.customerId;
783:     });
784: 
785:     revalidatePath("/crm");
786:     revalidatePath("/crm/follow-up");
787:     revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
788:     revalidatePath(`/crm/pelanggan/${customerId}`);
789:     revalidateCustomerReminders();
790:     return flashMessagePath("/crm/follow-up", "notice", "Hasil follow-up dan langkah berikutnya tersimpan.");
791:   });
792: }
793: 
794: export async function createQuotationDraftAction(formData: FormData) {
795:   return runRedirectingAction("/crm", async () => {
796:     const actor = await requireActor();
797:     const parsed = quotationDraftSchema.safeParse(quotationInput(formData));
798:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
799:     const calculated = calculateQuotation(parsed.data);
800: 
801:     const quotation = await getPrismaClient().$transaction(
802:       async (tx) => {
803:         const opportunity = await tx.opportunity.findUnique({
804:           where: { id: parsed.data.opportunityId },
805:           select: {
806:             id: true,
807:             stage: true,
808:             customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, archivedAt: true } },
809:             quotations: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
810:             _count: { select: { quotations: true } },
811:           },
812:         });
813:         if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
814:         if (!(opportunity.stage === "PENAWARAN" || opportunity.stage === "NEGOSIASI")) throw new UserFacingError("Quotation hanya dapat dibuat pada stage Penawaran atau Negosiasi.");
815:         if (opportunity.quotations.length) throw new UserFacingError("Peluang ini masih memiliki quotation draft.");
816:         if (opportunity._count.quotations > 0) throw new UserFacingError("Gunakan aksi buat revisi dari quotation sebelumnya.");
817: 
818:         const created = await tx.quotation.create({
819:           data: {
820:             quotationNo: await nextQuotationNo(tx),
821:             opportunityId: opportunity.id,
822:             revision: 1,
823:             snapshotCustomerName: opportunity.customer.name,
824:             snapshotCompanyName: opportunity.customer.companyName,
825:             snapshotWhatsapp: opportunity.customer.whatsapp,
826:             snapshotEmail: opportunity.customer.email,
827:             snapshotInstagram: opportunity.customer.instagram,
828:             snapshotAddress: opportunity.customer.address,
829:             discountType: parsed.data.discountType,
830:             discountValue: calculated.discountValue,
831:             subtotal: calculated.subtotal,
832:             total: calculated.total,
833:             createdById: actor.id,
834:             items: { create: calculated.items },
835:           },
836:           select: { id: true },
837:         });
838:         await audit(tx, actor, "Quotation", created.id, "QUOTATION_DRAFT_CREATED", [
839:           "items", "discountType", "discountValue", "subtotal", "total",
840:         ], { opportunityId: opportunity.id });
841:         return created;
842:       },
843:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
844:     );
845: 
846:     revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
847:     return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", `Draft quotation ${quotation.id ? "berhasil dibuat" : "dibuat"}.`);
848:   });
849: }
850: 
851: export async function updateQuotationDraftAction(formData: FormData) {
852:   return runRedirectingAction("/crm", async () => {
853:     const actor = await requireActor();
854:     const parsed = quotationDraftSchema.safeParse(quotationInput(formData));
855:     if (!parsed.success || !parsed.data.quotationId || !parsed.data.version) {
856:       throw new UserFacingError(parsed.success ? "Identitas quotation tidak lengkap." : firstValidationMessage(parsed.error));
857:     }
858:     const quotationId = parsed.data.quotationId;
859:     const calculated = calculateQuotation(parsed.data);
860: 
861:     await getPrismaClient().$transaction(
862:       async (tx) => {
863:         const updated = await tx.quotation.updateMany({
864:           where: { id: quotationId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
865:           data: {
866:             discountType: parsed.data.discountType,
867:             discountValue: calculated.discountValue,
868:             subtotal: calculated.subtotal,
869:             total: calculated.total,
870:             version: { increment: 1 },
871:           },
872:         });
873:         if (updated.count !== 1) throw new UserFacingError("Draft sudah berubah atau tidak lagi dapat diedit.");
874:         await tx.quotationItem.deleteMany({ where: { quotationId } });
875:         await tx.quotationItem.createMany({
876:           data: calculated.items.map((item) => ({ ...item, quotationId })),
877:         });
878:         await audit(tx, actor, "Quotation", quotationId, "QUOTATION_DRAFT_UPDATED", [
879:           "items", "discountType", "discountValue", "subtotal", "total",
880:         ]);
881:       },
882:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
883:     );
884: 
885:     revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
886:     return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Draft quotation diperbarui.");
887:   });
888: }
889: 
890: export async function issueQuotationAction(formData: FormData) {
891:   return runRedirectingAction("/crm", async () => {
892:     const actor = await requireActor();
893:     const parsed = quotationIdSchema.safeParse({ quotationId: formValue(formData, "quotationId"), version: formValue(formData, "version") });
894:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
895: 
896:     const issuedQuotation = await getPrismaClient().$transaction(async (tx) => {
897:       const quotation = await tx.quotation.findUnique({
898:         where: { id: parsed.data.quotationId },
899:         select: {
900:           opportunityId: true,
901:           quotationNo: true,
902:           revision: true,
903:           status: true,
904:           items: { select: { id: true }, take: 1 },
905:           opportunity: {
906:             select: {
907:               stage: true,
908:               customerId: true,
909:               customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true } },
910:             },
911:           },
912:         },
913:       });
914:       if (!quotation || quotation.status !== "DRAFT") throw new UserFacingError("Quotation draft tidak ditemukan.");
915:       if (!(quotation.opportunity.stage === "PENAWARAN" || quotation.opportunity.stage === "NEGOSIASI")) throw new UserFacingError("Quotation hanya dapat diterbitkan pada stage Penawaran atau Negosiasi.");
916:       if (!quotation.items.length) throw new UserFacingError("Quotation belum memiliki item.");
917: 
918:       const issuedAt = new Date();
919:       const updated = await tx.quotation.updateMany({
920:         where: { id: parsed.data.quotationId, status: "DRAFT", version: parsed.data.version },
921:         data: {
922:           status: "ISSUED",
923:           issuedAt,
924:           snapshotCustomerName: quotation.opportunity.customer.name,
925:           snapshotCompanyName: quotation.opportunity.customer.companyName,
926:           snapshotWhatsapp: quotation.opportunity.customer.whatsapp,
927:           snapshotEmail: quotation.opportunity.customer.email,
928:           snapshotInstagram: quotation.opportunity.customer.instagram,
929:           snapshotAddress: quotation.opportunity.customer.address,
930:           version: { increment: 1 },
931:         },
932:       });
933:       if (updated.count !== 1) throw new UserFacingError("Quotation sudah berubah. Muat ulang halaman.");
934:       const auditEvent = await audit(tx, actor, "Quotation", parsed.data.quotationId, "QUOTATION_ISSUED", ["status", "issuedAt", "snapshot"]);
935:       await addSystemActivity(tx, actor, {
936:         customerId: quotation.opportunity.customerId,
937:         opportunityId: quotation.opportunityId,
938:         systemEvent: "QUOTATION_ISSUED",
939:         content: `Quotation ${quotation.quotationNo} diterbitkan.`,
940:         occurredAt: issuedAt,
941:         metadata: {
942:           quotationId: parsed.data.quotationId,
943:           quotationNo: quotation.quotationNo,
944:           revision: quotation.revision,
945:         },
946:         sourceAuditEventId: auditEvent.id,
947:       });
948:       return { opportunityId: quotation.opportunityId, customerId: quotation.opportunity.customerId };
949:     });
950: 
951:     revalidatePath(`/crm/peluang/${issuedQuotation.opportunityId}`);
952:     revalidatePath(`/crm/pelanggan/${issuedQuotation.customerId}`);
953:     return flashMessagePath(`/crm/peluang/${issuedQuotation.opportunityId}`, "notice", "Quotation diterbitkan dan dikunci.");
954:   });
955: }
956: 
957: export async function createQuotationRevisionAction(formData: FormData) {
958:   return runRedirectingAction("/crm", async () => {
959:     const actor = await requireActor();
960:     const quotationId = entityIdSchema.safeParse(formValue(formData, "quotationId"));
961:     if (!quotationId.success) throw new UserFacingError(firstValidationMessage(quotationId.error));
962: 
963:     const opportunityId = await getPrismaClient().$transaction(
964:       async (tx) => {
965:         const source = await tx.quotation.findUnique({
966:           where: { id: quotationId.data },
967:           select: {
968:             id: true,
969:             opportunityId: true,
970:             status: true,
971:             snapshotCustomerName: true,
972:             snapshotCompanyName: true,
973:             snapshotWhatsapp: true,
974:             snapshotEmail: true,
975:             snapshotInstagram: true,
976:             snapshotAddress: true,
977:             discountType: true,
978:             discountValue: true,
979:             subtotal: true,
980:             total: true,
981:             opportunity: { select: { stage: true } },
982:             items: { select: { position: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
983:           },
984:         });
985:         if (!source || !(["ISSUED", "ACCEPTED"] as const).includes(source.status as "ISSUED" | "ACCEPTED")) {
986:           throw new UserFacingError("Revisi hanya dapat dibuat dari quotation terbit atau diterima.");
987:         }
988:         if (!(source.opportunity.stage === "PENAWARAN" || source.opportunity.stage === "NEGOSIASI")) {
989:           throw new UserFacingError("Revisi hanya dapat dibuat pada stage Penawaran atau Negosiasi.");
990:         }
991:         const existingDraft = await tx.quotation.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
992:         if (existingDraft) throw new UserFacingError("Selesaikan draft yang sedang aktif sebelum membuat revisi.");
993: 
994:         if (source.status === "ISSUED") {
995:           const superseded = await tx.quotation.updateMany({ where: { id: source.id, status: "ISSUED" }, data: { status: "SUPERSEDED", version: { increment: 1 } } });
996:           if (superseded.count !== 1) throw new UserFacingError("Status quotation sudah berubah.");
997:         }
998:         const aggregate = await tx.quotation.aggregate({ where: { opportunityId: source.opportunityId }, _max: { revision: true } });
999:         const created = await tx.quotation.create({
1000:           data: {
1001:             quotationNo: await nextQuotationNo(tx),
1002:             opportunityId: source.opportunityId,
1003:             revision: (aggregate._max.revision ?? 0) + 1,
1004:             snapshotCustomerName: source.snapshotCustomerName,
1005:             snapshotCompanyName: source.snapshotCompanyName,
1006:             snapshotWhatsapp: source.snapshotWhatsapp,
1007:             snapshotEmail: source.snapshotEmail,
1008:             snapshotInstagram: source.snapshotInstagram,
1009:             snapshotAddress: source.snapshotAddress,
1010:             discountType: source.discountType,
1011:             discountValue: source.discountValue,
1012:             subtotal: source.subtotal,
1013:             total: source.total,
1014:             createdById: actor.id,
1015:             items: { create: source.items },
1016:           },
1017:           select: { id: true },
1018:         });
1019:         await audit(tx, actor, "Quotation", created.id, "QUOTATION_REVISION_CREATED", ["revision", "items"], { sourceQuotationId: source.id });
1020:         return source.opportunityId;
1021:       },
1022:       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
1023:     );
1024: 
1025:     revalidatePath(`/crm/peluang/${opportunityId}`);
1026:     return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Draft revisi quotation dibuat.");
1027:   });
1028: }
1029: 
1030: export async function acceptQuotationAndDealAction(formData: FormData) {
1031:   return runRedirectingAction("/crm", async () => {
1032:     const actor = await requireActor();
1033:     const parsed = acceptQuotationSchema.safeParse({
1034:       quotationId: formValue(formData, "quotationId"),
1035:       version: formValue(formData, "version"),
1036:       acceptedAt: formValue(formData, "acceptedAt"),
1037:       acceptanceReference: formValue(formData, "acceptanceReference"),
1038:     });
1039:     if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
1040:     const acceptedAt = jakartaDateTime(parsed.data.acceptedAt);
1041:     if (!acceptedAt) throw new UserFacingError("Tanggal penerimaan wajib diisi.");
1042:     if (acceptedAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal penerimaan tidak boleh berada di masa depan.");
1043: 
1044:     const proof = await validatedAcceptanceProof(formValue(formData, "acceptanceProof"), parsed.data.quotationId);
1045:     if (proof) {
1046:       const { error } = await createAdminClient().storage.from(ACCEPTANCE_PROOF_BUCKET).upload(proof.path, proof.bytes, {
1047:         contentType: proof.contentType,
1048:         upsert: false,
1049:       });
1050:       if (error) throw new UserFacingError("Bukti gambar belum dapat disimpan. Pastikan migrasi Storage sudah diterapkan.");
1051:     }
1052: 
1053:     let salesOrder: { id: string; salesOrderNo: string; customerId: string; opportunityId: string };
1054:     try {

(Output capped at 50 KB. Showing lines 1-1054. Use offset=1055 to continue.)
</content>
```

---

## Assistant (Plan · Big Pickle · 10.3s)

I have a good understanding of the codebase now. Let me look at the follow-up form and the stage-theme, plus the opportunity-stage-form to complete my picture.



**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/opportunity-stage-form.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/opportunity-stage-form.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState } from "react";
4: import type { OpportunityStage } from "@prisma/client";
5: 
6: import { moveOpportunityStageAction } from "@/app/actions/crm";
7: import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
8: import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
9: import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
10: import { Textarea } from "@/components/ui/textarea";
11: import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
12: 
13: export function OpportunityStageForm({
14:   opportunityId,
15:   version,
16:   initialStage,
17:   cancelReason,
18: }: {
19:   opportunityId: string;
20:   version: number;
21:   initialStage: OpportunityStage;
22:   cancelReason: string | null;
23: }) {
24:   const fallbackStage = initialStage === "DEAL" ? "PENAWARAN" : initialStage;
25:   const [stage, setStage] = useState<OpportunityStage>(fallbackStage);
26: 
27:   if (initialStage === "DEAL") {
28:     return <p className="text-sm leading-6 text-muted-foreground">Deal dikunci oleh Sales Order. Owner/Admin dapat membaliknya dari halaman Sales Order.</p>;
29:   }
30: 
31:   return (
32:     <form action={moveOpportunityStageAction}>
33:       <input type="hidden" name="opportunityId" value={opportunityId} />
34:       <input type="hidden" name="version" value={version} />
35:       <FieldGroup>
36:         <Field>
37:           <FieldLabel htmlFor="detail-stage" required>Status</FieldLabel>
38:           <NativeSelect id="detail-stage" name="stage" required value={stage} onChange={(event) => setStage(event.target.value as OpportunityStage)} className="w-full">
39:             {PIPELINE_STAGES.map((option) => (
40:               <NativeSelectOption key={option} value={option} disabled={option === "DEAL"}>
41:                 {STAGE_LABEL[option]}{option === "DEAL" ? " · melalui quotation" : ""}
42:               </NativeSelectOption>
43:             ))}
44:           </NativeSelect>
45:         </Field>
46:         {stage === "LOST" ? (
47:           <Field>
48:             <FieldLabel htmlFor="detail-cancelReason" required>Alasan lost</FieldLabel>
49:             <Textarea id="detail-cancelReason" name="cancelReason" required maxLength={1000} rows={4} defaultValue={cancelReason ?? ""} />
50:           </Field>
51:         ) : null}
52:         <FieldDescription>Deal hanya dapat dipilih melalui aksi “Diterima &amp; Deal”.</FieldDescription>
53:         <ConfirmSubmitButton
54:           pendingLabel="Memindahkan..."
55:           confirmTitle="Ubah status peluang?"
56:           confirmDescription={`Status akan dipindahkan ke ${STAGE_LABEL[stage]}. Perubahan ini dicatat dalam audit log.`}
57:           confirmLabel="Ya, ubah status"
58:         >
59:           Simpan status
60:         </ConfirmSubmitButton>
61:       </FieldGroup>
62:     </form>
63:   );
64: }

(End of file - total 64 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/stage-theme.ts"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/stage-theme.ts</path>
<type>file</type>
<content>
1: import type { OpportunityStage } from "@prisma/client";
2: 
3: export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
4:   LEAD_BARU: "border-info/20 bg-info/5",
5:   DIHUBUNGI: "border-info/20 bg-info/5",
6:   KEBUTUHAN_TERGALI: "border-highlight/20 bg-highlight/5",
7:   PENAWARAN: "border-highlight/20 bg-highlight/5",
8:   FOLLOW_UP: "border-warning/20 bg-warning/5",
9:   NEGOSIASI: "border-warning/20 bg-warning/5",
10:   DEAL: "border-success/20 bg-success/5",
11:   LOST: "border-destructive/20 bg-destructive/5",
12: };
13: 
14: export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
15:   LEAD_BARU: "text-info",
16:   DIHUBUNGI: "text-info",
17:   KEBUTUHAN_TERGALI: "text-highlight",
18:   PENAWARAN: "text-highlight",
19:   FOLLOW_UP: "text-warning",
20:   NEGOSIASI: "text-warning",
21:   DEAL: "text-success",
22:   LOST: "text-destructive",
23: };
24: 
25: export const STAGE_SUMMARY_CLASS: Record<OpportunityStage, string> = {
26:   LEAD_BARU: "bg-info/5",
27:   DIHUBUNGI: "bg-info/5",
28:   KEBUTUHAN_TERGALI: "bg-highlight/5",
29:   PENAWARAN: "bg-highlight/5",
30:   FOLLOW_UP: "bg-warning/5",
31:   NEGOSIASI: "bg-warning/5",
32:   DEAL: "bg-success/5",
33:   LOST: "bg-destructive/5",
34: };

(End of file - total 34 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/opportunity-fields.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/opportunity-fields.tsx</path>
<type>file</type>
<content>
1: import { DESIGN_STATUS_LABEL } from "@/lib/crm/constants";
2: import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
3: import { Input } from "@/components/ui/input";
4: import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
5: import { Textarea } from "@/components/ui/textarea";
6: import type { CustomerFormOption } from "@/components/crm/customer-fields";
7: import { toDateTimeLocalValue } from "@/lib/crm/format";
8: 
9: type Values = {
10:   title: string;
11:   leadSourceId: string | null;
12:   salesPicId: string | null;
13:   productName: string | null;
14:   needPurpose: string | null;
15:   designStatus: keyof typeof DESIGN_STATUS_LABEL | null;
16:   specification: string | null;
17:   customerBudget: { toString(): string } | string | null;
18:   leadScore: number;
19:   estimatedQuantity: number | null;
20:   estimatedValue: { toString(): string } | string | null;
21:   deadline: Date | null;
22:   nextAction: string | null;
23:   nextActionAt: Date | null;
24: };
25: 
26: export function OpportunityFields({ idPrefix, leadSources, salesUsers, values }: { idPrefix: string; leadSources: CustomerFormOption[]; salesUsers: CustomerFormOption[]; values?: Values }) {
27:   return (
28:     <FieldGroup>
29:       <FieldSet>
30:         <FieldLegend>Data kebutuhan</FieldLegend>
31:         <div className="grid gap-4 sm:grid-cols-2">
32:           <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idPrefix}-title`} required>Judul peluang</FieldLabel><Input id={`${idPrefix}-title`} name="title" required minLength={3} maxLength={180} defaultValue={values?.title ?? ""} placeholder="Contoh: Seragam panitia 150 pcs" /></Field>
33:           <Field><FieldLabel htmlFor={`${idPrefix}-productName`}>Produk</FieldLabel><Input id={`${idPrefix}-productName`} name="productName" maxLength={120} defaultValue={values?.productName ?? ""} placeholder="Jersey, PDH, kaos, atau lainnya" /></Field>
34:           <Field><FieldLabel htmlFor={`${idPrefix}-needPurpose`}>Untuk kebutuhan</FieldLabel><Input id={`${idPrefix}-needPurpose`} name="needPurpose" maxLength={500} defaultValue={values?.needPurpose ?? ""} placeholder="Event, perusahaan, komunitas, sekolah" /></Field>
35:           <Field><FieldLabel htmlFor={`${idPrefix}-estimatedQuantity`}>Estimasi jumlah</FieldLabel><Input id={`${idPrefix}-estimatedQuantity`} name="estimatedQuantity" type="number" min={1} step={1} defaultValue={values?.estimatedQuantity ?? ""} /></Field>
36:           <Field><FieldLabel htmlFor={`${idPrefix}-deadline`}>Deadline</FieldLabel><Input id={`${idPrefix}-deadline`} name="deadline" type="date" defaultValue={values?.deadline?.toISOString().slice(0, 10) ?? ""} /></Field>
37:           <Field><FieldLabel htmlFor={`${idPrefix}-customerBudget`}>Budget customer</FieldLabel><Input id={`${idPrefix}-customerBudget`} name="customerBudget" type="number" min={0} step={1} inputMode="numeric" defaultValue={values?.customerBudget?.toString() ?? ""} /></Field>
38:           <Field><FieldLabel htmlFor={`${idPrefix}-estimatedValue`}>Estimasi nilai</FieldLabel><Input id={`${idPrefix}-estimatedValue`} name="estimatedValue" type="number" min={0} step={1} inputMode="numeric" defaultValue={values?.estimatedValue?.toString() ?? ""} /></Field>
39:           <Field><FieldLabel htmlFor={`${idPrefix}-designStatus`}>Status desain</FieldLabel><NativeSelect id={`${idPrefix}-designStatus`} name="designStatus" defaultValue={values?.designStatus ?? ""}><NativeSelectOption value="">Belum ditanyakan</NativeSelectOption>{Object.entries(DESIGN_STATUS_LABEL).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></Field>
40:           <Field><FieldLabel htmlFor={`${idPrefix}-leadScore`} required>Lead score</FieldLabel><Input id={`${idPrefix}-leadScore`} name="leadScore" type="number" min={0} max={100} step={1} required defaultValue={values?.leadScore ?? 0} /><FieldDescription>Hot 80-100, Warm 50-79, Cold 0-49.</FieldDescription></Field>
41:           <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idPrefix}-specification`}>Spesifikasi</FieldLabel><Textarea id={`${idPrefix}-specification`} name="specification" maxLength={2000} rows={3} defaultValue={values?.specification ?? ""} placeholder="Bahan, warna, ukuran, sablon, bordir, atau detail lain." /></Field>
42:         </div>
43:       </FieldSet>
44:       <FieldSet>
45:         <FieldLegend>Penugasan</FieldLegend>
46:         <div className="grid gap-4 sm:grid-cols-2">
47:           <Field><FieldLabel htmlFor={`${idPrefix}-opportunityLeadSourceId`}>Sumber lead</FieldLabel><NativeSelect id={`${idPrefix}-opportunityLeadSourceId`} name="opportunityLeadSourceId" defaultValue={values?.leadSourceId ?? ""}><NativeSelectOption value="">{values ? "Belum ditentukan" : "Ikuti profil customer"}</NativeSelectOption>{leadSources.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
48:           <Field><FieldLabel htmlFor={`${idPrefix}-opportunitySalesPicId`}>Sales/PIC</FieldLabel><NativeSelect id={`${idPrefix}-opportunitySalesPicId`} name="opportunitySalesPicId" defaultValue={values?.salesPicId ?? ""}><NativeSelectOption value="">{values ? "Belum ditugaskan" : "Ikuti profil customer"}</NativeSelectOption>{salesUsers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
49:         </div>
50:       </FieldSet>
51:       <FieldSet>
52:         <FieldLegend>Next action</FieldLegend>
53:         <div className="grid gap-4 sm:grid-cols-2">
54:           <Field><FieldLabel htmlFor={`${idPrefix}-nextAction`}>Tindakan berikutnya</FieldLabel><Input id={`${idPrefix}-nextAction`} name="nextAction" maxLength={500} defaultValue={values?.nextAction ?? ""} placeholder="Contoh: Hubungi untuk menggali kebutuhan" /></Field>
55:           <Field><FieldLabel htmlFor={`${idPrefix}-nextActionAt`}>Jadwal</FieldLabel><Input id={`${idPrefix}-nextActionAt`} name="nextActionAt" type="datetime-local" defaultValue={toDateTimeLocalValue(values?.nextActionAt)} /></Field>
56:         </div>
57:         <FieldDescription>Isi tindakan dan jadwal bersamaan agar muncul di Follow-up Center.</FieldDescription>
58:       </FieldSet>
59:     </FieldGroup>
60:   );
61: }

(End of file - total 61 lines)
</content>
```

---

## Assistant (Plan · Big Pickle · 7.7s)

I now have a comprehensive understanding of the codebase. Let me also check the Git history / migration to understand the current state, and check the `prisma-client-api` skill since we'll be dealing with schema changes. Let me review the current customer data model and think about the schema implications.

Let me load the relevant skills before presenting a plan since this involves UI + Prisma + schema changes.



**Tool: skill**

**Input:**
```json
{
  "name": "prisma-client-api"
}
```

**Output:**
```
<skill_content name="prisma-client-api">
# Skill: prisma-client-api

# Prisma Client API Reference

Complete API reference for Prisma Client. This skill provides guidance on model queries, filtering, relations, and client methods for current Prisma projects.

## When to Apply

Reference this skill when:
- Writing database queries with Prisma Client
- Performing CRUD operations (create, read, update, delete)
- Filtering and sorting data
- Working with relations
- Using transactions
- Configuring client options

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Client Construction | HIGH | `constructor` |
| 2 | Model Queries | CRITICAL | `model-queries` |
| 3 | Query Shape | HIGH | `query-options` |
| 4 | Filtering | HIGH | `filters` |
| 5 | Relations | HIGH | `relations` |
| 6 | Transactions | CRITICAL | `transactions` |
| 7 | Raw SQL | CRITICAL | `raw-queries` |
| 8 | Client Methods | MEDIUM | `client-methods` |

## Quick Reference

- `constructor` - `PrismaClient` setup, adapter wiring, logging, and SQL commenter plugins
- `model-queries` - CRUD operations and bulk operations
- `query-options` - `select`, `include`, `omit`, sort, pagination
- `filters` - scalar and logical filter operators
- `relations` - relation reads and nested writes
- `transactions` - array and interactive transaction patterns
- `raw-queries` - `$queryRaw` and `$executeRaw` safety
- `client-methods` - lifecycle methods, extensions, and `satisfies` patterns for `prisma-client`

## Client Instantiation

```typescript
import { PrismaClient } from '../generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })
```

## Model Query Methods

| Method | Description |
|--------|-------------|
| `findUnique()` | Find one record by unique field |
| `findUniqueOrThrow()` | Find one or throw error |
| `findFirst()` | Find first matching record |
| `findFirstOrThrow()` | Find first or throw error |
| `findMany()` | Find multiple records |
| `create()` | Create a new record |
| `createMany()` | Create multiple records |
| `createManyAndReturn()` | Create multiple and return them |
| `update()` | Update one record |
| `updateMany()` | Update multiple records |
| `updateManyAndReturn()` | Update multiple and return them |
| `upsert()` | Update or create record |
| `delete()` | Delete one record |
| `deleteMany()` | Delete multiple records |
| `count()` | Count matching records |
| `aggregate()` | Aggregate values (sum, avg, etc.) |
| `groupBy()` | Group and aggregate |

## Query Options

| Option | Description |
|--------|-------------|
| `where` | Filter conditions |
| `select` | Fields to include |
| `include` | Relations to load |
| `omit` | Fields to exclude |
| `orderBy` | Sort order |
| `take` | Limit results |
| `skip` | Skip results (pagination) |
| `cursor` | Cursor-based pagination |
| `distinct` | Unique values only |

## Client Methods

| Method | Description |
|--------|-------------|
| `$connect()` | Explicitly connect to database |
| `$disconnect()` | Disconnect from database |
| `$transaction()` | Execute transaction |
| `$queryRaw()` | Execute raw SQL query |
| `$executeRaw()` | Execute raw SQL command |
| `$on()` | Subscribe to events |
| `$extends()` | Add extensions |

## Quick Examples

### Find records

```typescript
// Find by unique field
const user = await prisma.user.findUnique({
  where: { email: 'alice@prisma.io' }
})

// Find with filter
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 10
})
```

### Create records

```typescript
const user = await prisma.user.create({
  data: {
    email: 'alice@prisma.io',
    name: 'Alice',
    posts: {
      create: { title: 'Hello World' }
    }
  },
  include: { posts: true }
})
```

### Update records

```typescript
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Alice Smith' }
})
```

### Delete records

```typescript
await prisma.user.delete({
  where: { id: 1 }
})
```

### Transactions

```typescript
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'alice@prisma.io' } }),
  prisma.post.create({ data: { title: 'Hello', authorId: 1 } })
])
```

## Rule Files

Detailed API documentation:

```
references/constructor.md        - PrismaClient constructor options
references/model-queries.md      - CRUD operations
references/query-options.md      - select, include, omit, where, orderBy
references/filters.md            - Filter conditions and operators
references/relations.md          - Relation queries and nested operations
references/transactions.md       - Transaction API
references/raw-queries.md        - $queryRaw, $executeRaw
references/client-methods.md     - $connect, $disconnect, $on, $extends
```

## Filter Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `not` | Not equal |
| `in` | In array |
| `notIn` | Not in array |
| `lt`, `lte` | Less than |
| `gt`, `gte` | Greater than |
| `contains` | String contains |
| `startsWith` | String starts with |
| `endsWith` | String ends with |
| `mode` | Case sensitivity |

## Relation Filters

| Operator | Description |
|----------|-------------|
| `some` | At least one related record matches |
| `every` | All related records match |
| `none` | No related records match |
| `is` | Related record matches (1-to-1) |
| `isNot` | Related record doesn't match |

## Resources

- [Prisma Client API Reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
- [CRUD Operations](https://www.prisma.io/docs/orm/prisma-client/queries/crud)
- [Filtering and Sorting](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting)

## How to Use

Pick the category from the table above, then open the matching reference file for implementation details and examples.

Base directory for this skill: /home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/raw-queries.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/filters.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/constructor.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/query-options.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/model-queries.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/transactions.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/client-methods.md</file>
<file>/home/mandf/SobatTi/Konveksi/.agents/skills/prisma-client-api/references/relations.md</file>
</skill_files>
</skill_content>
```

**Tool: skill**

**Input:**
```json
{
  "name": "impeccable"
}
```

**Output:**
```
<skill_content name="impeccable">
# Skill: impeccable

This skill gives you the tools and permission to create design that earns to be called out-of-distribution craft: Whereas before, your design work would have been safe, timid and measured, you now approach every design task as a award-winning design director with impeccable understanding for what makes exceptional design work: production-grade code, peak creativity, a clear POV, deep understanding of the needs of the client and users, and exceptional craft.

Core principles:
- Go all out. No hedging, no shortcuts. The deliverable must be complete (except assets the user must provide).
- Dream big and bold. Distinct, beautiful, outstanding and highly inspiring work.
- Verify in bounded passes, not a loop, and the ceiling covers the whole cycle: screenshots, defect scans, micro-edits, and rebuilds alike. Build fully, inspect once with a batched round (desktop and mobile together on the web; the shipped device classes on a native platform), fix everything it shows in one batch, confirm with at most one more round, and stop polishing. Open-ended self-QA burns the user's money doing worse what the finish handoffs do better.

## Setup

1. Run `node <skill-base-dir>/scripts/context.mjs` once per session, where `<skill-base-dir>` is the loaded base directory the runtime reports for this skill; keep cwd at the user's project. That base directory resolves every `node .opencode/skills/impeccable/scripts/...` command in this skill and its references, and `.opencode/skills/impeccable/scripts` is the fallback only when the runtime reports no base directory. Pass a named source file or route as `--target <path>`. It loads PRODUCT.md, DESIGN.md, the matching surface brief, and native-platform guidance when applicable; follow its directives and do not rerun it.
2. Before acting, load the one playbook that owns the request: the Commands table's reference for an explicit or clearly implied sub-command, or [reference/new-work.md](reference/new-work.md) for a new surface or replacement visual world. Then inspect the target and at least one representative source of incumbent visual truth (tokens, theme, CSS, component, or asset) before editing.
3. After analysis and direction are resolved, load [reference/craft-floor.md](reference/craft-floor.md) immediately before editing UI. It carries the quality floor, the absolute bans, and the reflexes no detector catches. Do not load it for planning-only work.

## How to design

- **The brief wins.** Honor pinned aesthetics, eras, materials, fonts, and palettes even when they conflict with a saturated-pattern warning. Redirecting a clear brief toward your taste is failure.
- **Refinement preserves; redesign replaces.** Refinement keeps the incumbent identity, behavior, copy, and everything outside scope. Ask before replacing factual copy or adding claims. Redesign keeps product truth, content, function, native affordances, and constraints, but treats the old look as evidence and anti-reference; choose a replacement world in new-work and replace DESIGN.md. Never split the difference into polish on the discarded look.
- **Visual authority is evidence, not a filename.** Missing DESIGN.md alone does not make a project greenfield; new-work decides whether to preserve, expand, or replace the incumbent world.

## Modes

The mode names what the visitor's success looks like on this surface.

- **Persuade:** the visitor decides and acts; design is the product. Landing pages, marketing, campaigns, pricing. Earn attention and action. Ship real imagery when the brief needs it; follow the committed world, not category habit.
- **Operate:** the visitor completes a task. App UI, dashboards, editors, admin, settings, tools. Scanability, consistency, native expectations, and the real usage scene outrank expression. Brand lives in precise details.
- **Read:** the visitor understands something. Docs, articles, guides, help, changelogs. Structure for comprehension, then make the reading experience worth staying in.
- **Experience:** the visitor is inside the work itself. Portfolios, galleries, showcases. Let the artifact lead from the first viewport; the interface recedes.

Choose the mode from the requested surface, not the product, and persist it only in that surface brief. A tool's landing page is still Persuade; a fashion house's documentation is still Read; a docs index is Read, not Persuade. See [new-work.md](reference/new-work.md) for new surfaces and [operate.md](reference/operate.md) for deeper Operate/Read guidance.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `craft [feature]` | Build | Deprecated alias for an ordinary new-work request | [reference/craft.md](reference/craft.md) |
| `shape [feature]` | Build | Plan UX/UI before writing code | [reference/shape.md](reference/shape.md) |
| `init` | Build | Capture durable product context in PRODUCT.md | [reference/init.md](reference/init.md) |
| `document` | Build | Generate DESIGN.md from existing project code | [reference/document.md](reference/document.md) |
| `extract [target]` | Build | Pull reusable tokens and components into design system | [reference/extract.md](reference/extract.md) |
| `critique [target]` | Evaluate | UX design review with heuristic scoring | [reference/critique.md](reference/critique.md) |
| `audit [target]` | Evaluate | Technical quality checks (a11y, perf, responsive) | [reference/audit.md](reference/audit.md) · native: [reference/audit.native.md](reference/audit.native.md) |
| `polish [target]` | Refine | Final quality pass before shipping | [reference/polish.md](reference/polish.md) |
| `bolder [target]` | Refine | Amplify safe or bland designs | [reference/bolder.md](reference/bolder.md) |
| `quieter [target]` | Refine | Tone down aggressive or overstimulating designs | [reference/quieter.md](reference/quieter.md) |
| `distill [target]` | Refine | Strip to essence, remove complexity | [reference/distill.md](reference/distill.md) |
| `harden [target]` | Refine | Production-ready: errors, i18n, edge cases | [reference/harden.md](reference/harden.md) |
| `onboard [target]` | Refine | Design first-run flows, empty states, activation | [reference/onboard.md](reference/onboard.md) |
| `animate [target]` | Enhance | Add purposeful animations and motion | [reference/animate.md](reference/animate.md) |
| `colorize [target]` | Enhance | Add strategic color to monochromatic UIs | [reference/colorize.md](reference/colorize.md) |
| `typeset [target]` | Enhance | Improve typography hierarchy and fonts | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | Enhance | Fix spacing, rhythm, and visual hierarchy | [reference/layout.md](reference/layout.md) |
| `delight [target]` | Enhance | Add personality and memorable touches | [reference/delight.md](reference/delight.md) |
| `overdrive [target]` | Enhance | Push past conventional limits | [reference/overdrive.md](reference/overdrive.md) |
| `clarify [target]` | Fix | Improve UX copy, labels, and error messages | [reference/clarify.md](reference/clarify.md) |
| `adapt [target]` | Fix | Adapt for different devices and screen sizes | [reference/adapt.md](reference/adapt.md) · native: [reference/adapt.native.md](reference/adapt.native.md) |
| `optimize [target]` | Fix | Diagnose and fix UI performance | [reference/optimize.md](reference/optimize.md) |
| `live` | Iterate | Visual variant mode: pick elements in the browser, generate alternatives | [reference/live.md](reference/live.md) |

Routing:

- **No argument:** read [routing.md](reference/routing.md) and present its context-aware menu; never auto-run a command.
- **Explicit or clearly implied command:** load its reference (native variant on native platforms) and follow it. Ask once if two commands fit.
- **Otherwise:** treat the request as general design work. Missing PRODUCT.md routes a new surface or replacement world through init, then new-work; a narrow refinement of existing code proceeds on the incumbent implementation as context.mjs directs, offering init afterward rather than blocking on it.
- `teach` aliases `init`. `craft` is a deprecated alias for ordinary new-work and adds nothing. `shape` owns task discovery, then enters new-work only for visual-world and surface-concept decisions.

After init writes PRODUCT.md, resume without rerunning `context.mjs`; init loads the native platform reference itself when the platform it recorded is `ios`, `android`, or `adaptive`.

**Pin / Unpin:** `node .opencode/skills/impeccable/scripts/pin.mjs <pin|unpin> <command>` creates or removes a standalone `/<command>` shortcut. Report the script's result concisely; relay stderr verbatim on error.

**Hooks:** `/impeccable hooks <on|off|status|ignore-rule|ignore-file|ignore-value|reset>` manages the design detector hook for this project (auto-runs the detector after UI file edits and surfaces findings). Load [reference/hooks.md](reference/hooks.md) when the user invokes it with any argument.

**Doctor:** `/impeccable doctor` reports and repairs drift between this project's Impeccable artifacts (PRODUCT.md, DESIGN.md and its sidecar, config, surface briefs, the hook) and what this version reads. Load [reference/doctor.md](reference/doctor.md) when the user invokes it, or when they ask what is out of date, stale, or needs refreshing. A `CONTEXT_STALE` directive in Setup's output is the cheap subset of the same report; act on it there per its own instructions rather than running doctor unasked.

**Never repair drift as a side effect of a design task.** A `CONTEXT_STALE` finding is reported, not acted on, unless the user asks. The one exception is a finding marked `auto`, which the next write to that file performs anyway.

Base directory for this skill: /home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/serve-question.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/context-signals.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/live-poll.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/hook-before-edit.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/doctor.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/hook.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/embed-prompt.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/live-discard-manual-edits.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/live-commit-manual-edits.mjs</file>
<file>/home/mandf/SobatTi/Konveksi/.opencode/skills/impeccable/scripts/live-inject.mjs</file>
</skill_files>
</skill_content>
```

---

## Assistant (Plan · Big Pickle · 565.4s)

I have a thorough understanding now. Let me analyze the user's request carefully.

## Understanding the user's vision

The user wants to **simplify the CRM pipeline** significantly:

**New kanban columns (only 5):**
1. **Lead Baru** (New Lead)
2. **Follow Up**
3. **Negosiasi**
4. **Deal**
5. **Lost**

This is a big reduction from the current 8 stages (LEAD_BARU, DIHUBUNGI, KEBUTUHAN_TERGALI, PENAWARAN, FOLLOW_UP, NEGOSIASI, DEAL, LOST).

**Card redesign:**
- **Lead Baru column:** Card shows **Customer Name** (blue text) at top, with empty gray content below. This is the "Lead Baru" because customer hasn't ordered yet.
- **Negosiasi, Deal, Lost columns:** Same customer name (blue) at top, but the gray text below now shows the **Purchase Order** (the customer's requests like "Kemeja 30 pcs").

**Workflow:**
- Clicking blue customer name → shows detail of the Purchase Order (size, design, color, material, etc.), plus Invoice/Quotation & price offer in Negosiasi.
- Purchase Order (gray) appears once **Negosiasi finishes**.
- If Negosiasi is dragged/stalled too long → can move back to **Follow Up**.
- If Negosiasi directly agreed → moves to **Deal** (for DP/payment).
- If rejected → **Lost**.
- Also **Follow Up without Purchase Order** if the lead "disappears" from Lead Baru.

Now let me think about how this maps to the existing schema and what questions need answering.

The existing schema has:
- `Opportunity` (peluang) with `stage`, `title`, `specification`, `productName`, `needPurpose`, `designStatus`, `customerBudget`, `estimatedQuantity`, `estimatedValue`, `deadline`, etc.
- `Customer` with contact info
- `Quotation` / `QuotationItem` (the "Invoice/Penawaran harga")
- `SalesOrder` / `SalesOrderItem` (the confirmed Purchase Order)

The user is describing a **Purchase Order** concept which doesn't currently exist as a first-class entity. Currently, customer request details (size, design, color, material) live in `Opportunity.specification`, and quotation items live in `QuotationItem`.

There are several ambiguities I need to clarify before planning. Let me think about what crucial decisions/uncertainties exist.

Let me ask clarifying questions rather than assume. Given the AGENTS.md mandates a mature plan + grill-me, but I'm in plan mode. Let me focus on the key ambiguities.

Key ambiguities:

1. **"Purchase Order" data model** — Currently there's `Quotation` (the price offer/Invoice) and `SalesOrder` (created on acceptance). The user wants a "Purchase Order" (PO) that appears in Negosiasi/Deal/Lost cards showing "request contents like Kemeja 30pcs". Where does this PO come from? 
   - Option A: The PO is the `Quotation` (or its items) that gets created during Negosiasi. Because in Negotiation you build the quotation (price offer). The gray PO text = quotation items (description + qty).
   - Option B: A separate new `PurchaseOrder` entity that must be created.

2. **The 3 "dropped" stages** (DIHUBUNGI, KEBUTUHAN_TERGALI, PENAWARAN) — do we merge them away? The user says only 5 columns. But the current flow has these intermediate stages and quotation logic locked to PENAWARAN/NEGOSIASI. This is a big refactor.

3. **Relationship between customer name (blue) and PO (gray)** — is one Opportunity = one customer + one PO? Currently one Customer can have multiple Opportunities. The card seems to be per-opportunity still.

4. **"Detail" on blue click** — should it navigate to the existing `/crm/peluang/:id` detail page (which we'd restyle to show PO + quotation), or open a modal/drawer? The user says "menampilkan detail dari Purchase Order" and also Invoice/Penawaran harga.

5. **What is "Follow Up tanpa Purchase Order ketika saat Lead Baru dia menghilang"** — leads that vanish from Lead Baru can be moved to Follow Up with no PO.

Let me present the analyzed plan and ask targeted clarifying questions. I should use the `question` tool to gather decisions.

Given this is a large undertaking with many ambiguities, let me ask the most critical questions first.

Let me formulate the key questions. I'll present my understanding/suggestion and ask several decisions.



**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "question": "Sumber dari 'Purchase Order' (teks abu-abu 'Kemeja 30pcs') yang muncul di kolom Negosiasi/Deal/Lost itu berasal dari mana? Ini menentukan desain database.",
      "header": "Sumber PO",
      "options": [
        {
          "label": "Dari Quotation (Recommended)",
          "description": "PO isi = item-item quotation (deskripsi+qty) yang dibuat saat Negosiasi. Uang/harga tetap lewat Quotation. Tidak perlu entitas baru."
        },
        {
          "label": "Entitas PurchaseOrder baru",
          "description": "Buat model PurchaseOrder terpisah dengan field ukuran/desain/warna/bahan dll, terhubung ke Opportunity. Lebih besar tetapi lebih eksplisit."
        },
        {
          "label": "Dari field spesifikasi Opportunity",
          "description": "PO isi diambil dari kolom specification/estimatedQuantity Opportunity yang sudah ada."
        }
      ]
    },
    {
      "question": "5 kolom baru (Lead Baru, Follow Up, Negosiasi, Deal, Lost) menggantikan 8 stage. Bagaimana menangani 3 stage yang 'hilang' (Dihubungi, Kebutuhan Tergali, Penawaran)?",
      "header": "Stage lama",
      "options": [
        {
          "label": "Hapus total, data dimigrasi (Recommended)",
          "description": "Drop 3 stage tersebut dari enum. Data yang ada di stage lama dipindah ke kolom terdekat (mis. Dihubungi→Follow Up, Penawaran→Negosiasi)."
        },
        {
          "label": "Simpan di enum tapi tak tampil",
          "description": "Biarkan enum lama agar data ada, hanya kolom board yang direstruktur jadi 5. Opsi status tetap 5 di UI."
        }
      ]
    },
    {
      "question": "Saat teks biru (nama customer) diklik, detail yang ditampilkan seperti apa?",
      "header": "Detail card",
      "options": [
        {
          "label": "Halaman detail peluang di-restyle (Recommended)",
          "description": "Manfaatkan halaman /crm/peluang/:id yang sudah ada, restyle agar menampilkan PO (ukuran/desain/warna/bahan) + Quotation/Invoice. URL bisa dibagikan."
        },
        {
          "label": "Modal/drawer di board",
          "description": "Buka detail sebagai panel samping/dialog di halaman pipeline, tanpa pindah halaman."
        }
      ]
    },
    {
      "question": "Apakah relasi antara Nama Customer (biru) dan PO (abu-abu) tetap satu 'peluang' (Opportunity), atau bisa satu customer punya beberapa kard?",
      "header": "Relasi card",
      "options": [
        {
          "label": "Tetap per-Opportunity (Recommended)",
          "description": "Satu card = satu Opportunity yang sudah punya customer. Nama customer biru + data PO yang terkait. Konsisten dengan struktur sekarang."
        },
        {
          "label": "Satu card = satu customer",
          "description": "Digabung per customer, semua peluang/PO customer ditampung dalam satu card. Perlu perubahan struktur besar."
        }
      ]
    },
    {
      "question": "Kapan 'Purchase Order' (teks abu-abu) mulai muncul? Anda bilang 'muncul ketika proses Negosiasi selesai' tapi kartu Negosiasi berisi PO. Mohon klarifikasi kondisi ini.",
      "header": "Muncul PO",
      "options": [
        {
          "label": "PO ada saat masuk Negosiasi",
          "description": "Begitu peluang masuk kolom Negosiasi, PO (item permintaan) sudah tampil di teks abu-abu. Lead Baru/Follow Up kosong tanpa PO."
        },
        {
          "label": "PO muncul setelah quotation dibuat",
          "description": "PO tampil hanya jika sudah ada quotation item. Negosiasi yang belum buat quotation = bawahnya kosong."
        },
        {
          "label": "PO ditambahkan manual per-negosiasi",
          "description": "Ada aksi khusus 'tambah PO' saat negosiasi, lalu tampil di teks abu-abu."
        }
      ]
    }
  ]
}
```

**Output:**
```
User has answered your questions: "Sumber dari 'Purchase Order' (teks abu-abu 'Kemeja 30pcs') yang muncul di kolom Negosiasi/Deal/Lost itu berasal dari mana? Ini menentukan desain database."="jadi gini, untuk fiturnya sebenarnya ada banyak perubahan, client itu memahami bahwa PurchaseOrder akan berisi seluruh data permintaan customer, untuk Quotation kan penawaran harga nah sepemahaman client itu quotation sama dengan invoice, jadi kita mengikuti pemahaman client saja. untuk data PO itu input manual dari Admin jadi pakai fitur saja", "5 kolom baru (Lead Baru, Follow Up, Negosiasi, Deal, Lost) menggantikan 8 stage. Bagaimana menangani 3 stage yang 'hilang' (Dihubungi, Kebutuhan Tergali, Penawaran)?"="Hapus total, data dimigrasi (Recommended)", "Saat teks biru (nama customer) diklik, detail yang ditampilkan seperti apa?"="isinya itu detail PO dan Invoice(penawaran) sesuai jawaban pertanyaan Sumber PO sebelumnya", "Apakah relasi antara Nama Customer (biru) dan PO (abu-abu) tetap satu 'peluang' (Opportunity), atau bisa satu customer punya beberapa kard?"="satu customer bisa beberapa card karena bisa order lebih dari satu", "Kapan 'Purchase Order' (teks abu-abu) mulai muncul? Anda bilang 'muncul ketika proses Negosiasi selesai' tapi kartu Negosiasi berisi PO. Mohon klarifikasi kondisi ini."="PO ditambahkan manual per-negosiasi". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · Big Pickle · 726.1s)

The user has answered. Let me digest:

1. **Sumber PO:** Input manual. PO is a separate entity that the (client) sees as containing all the customer's request data. Quotation = Invoice = price offer (penawaran harga). So we need a **PurchaseOrder entity** that is manually entered, plus use the existing Quotation as "Invoice/penawaran". PO data is input manually.
2. **Stage:** Hapus total, data dimigrasi → enum reduced to 5 stages.
3. **Detail:** Detail PO dan Invoice (penawaran) — shown in a detail view (they didn't pick modal vs page explicitly, they re-stated "isinya detail PO dan Invoice"). Given ambiguity between "Halaman detail peluang di-restyle" vs "Modal", they just said the content. I'll go with restyle of existing detail page but need to confirm PO editing location.
4. **Relasi:** Satu customer bisa beberapa card (bisa order lebih dari satu). So multiple Opportunities per customer, each may have its own PO. This matches current structure (Opportunity per card).
5. **PO muncul:** PO ditambahkan manual per-negosiasi — PO is manually added per negotiation.

So the design: A new `PurchaseOrder` model associated with an `Opportunity`. PO contains the customer's request items (ukuran/desain/warna/bahan etc). It appears on the card gray text when entered during the negotiation. Quotation remains as the Invoice/price offer.

Let me ask a few more clarifying questions to nail down the data model for PO and the flow, then form the plan.

Key remaining questions:
- PO data model: what fields? Items (like quotation items but with size/design/color/material) presumably. Single PO per opportunity or multiple? 
- Where is PO entered (which screen/stage)?
- Flow: how does Deal get created now — currently via "accept quotation". Does the deal still require the quotation acceptance? The user says Negosiasi → Deal for DP Customer. And PO is manual. So does hitting Deal require a PO? Probably yes (PO exists → deal).
- The "Follow Up tanpa PO ketika Lead Baru menghilang" - a lead that "disappears"/stalls can be moved to Follow Up. Confirmed by the drag model.

Let me ask more focused questions about the PO model and the Deal/quotation flow.



**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "header": "Struktur PO",
      "options": [
        {
          "description": "PurchaseOrder punya judul total (mis. 'Pesanan Kemeja') + daftar item, tiap item punya deskripsi, jumlah, dan detail ukuran/desain/warna/bahan. Mirip QuotationItem tapi dengan field spesifikasi item.",
          "label": "PO utama + item (Recommended)"
        },
        {
          "description": "Satu kolom catatan panjang berisi semua detail (ukuran, desain, warna, bahan) dalam teks bebas.",
          "label": "Satu kolom spec bebas"
        },
        {
          "description": "PO punya banyak kolom fix: ukuran, desain, warna, bahan, jumlah sebagai field terpisah.",
          "label": "Kolom fix terpisah"
        }
      ],
      "question": "Bagaimana struktur data PurchaseOrder? Client ingin detail seperti ukuran, desain, warna, bahan dalam PO."
    },
    {
      "header": "Jumlah PO",
      "options": [
        {
          "description": "Satu peluang punya satu PO aktif yang bisa direvisi (pakai revisi/no versi). Sederhana dan selaras dengan satu card di kolom.",
          "label": "Satu PO per peluang, bisa revisi (Recommended)"
        },
        {
          "description": "Satu peluang bisa punya beberapa PO terpisah sekaligus aktif.",
          "label": "Banyak PO per peluang"
        }
      ],
      "question": "Berapa PurchaseOrder per peluang/card?"
    },
    {
      "header": "Alur Deal",
      "options": [
        {
          "description": "Tetap lewat Quotation/Invoice: saat negosiasi selesai setuju, terima quotation maka jadi Deal (buat SalesOrder). Deal tetap wajib lewat quotation agar harga & invoice tercatat.",
          "label": "Deal lewat quotation (Recommended)"
        },
        {
          "description": "Deal cukup dipindah manual ke kolom Deal tanpa wajib quotation/invoice. Quotation opsional.",
          "label": "Deal manual tanpa quotation"
        },
        {
          "description": "Deal terjadi saat PO dibuat/disetujui, quotation menyusul sebagai invoice.",
          "label": "Deal dari PO"
        }
      ],
      "question": "Bagaimana transisi Negosiasi → Deal? Sebelumnya Deal wajib lewat 'Terima quotation'. Dengan adanya PO manual, apakah tetap lewat quotation?"
    },
    {
      "header": "Lokasi entry PO",
      "options": [
        {
          "description": "PO diinput di halaman detail peluang (yang sama menampilkan PO + Invoice saat nama customer diklik).",
          "label": "Di halaman detail peluang (Recommended)"
        },
        {
          "description": "Ada form langsung di modal detail saat klik nama customer di board.",
          "label": "Di modal board"
        },
        {
          "description": "Kedua-duanya: bisa dari detail maupun inisiasi saat masuk Negosiasi.",
          "label": "Keduanya"
        }
      ],
      "question": "Di mana Admin menginput PurchaseOrder?"
    },
    {
      "header": "Kolom tersisa",
      "options": [
        {
          "description": "Ini kolom status untuk peluang yang 'hilang' dari Lead Baru tanpa PO — hanya nama customer, tanpa data PO. Deal/Lost tetap butuh PO.",
          "label": "Follow Up boleh tanpa PO"
        },
        {
          "description": "Semua kolom kecuali Lead Baru wajib punya PO. Follow Up juga harus diisi PO jika mau dipindah.",
          "label": "Semua kolom wajib PO"
        }
      ],
      "question": "Anda menyebut 'Follow Up tanpa data PurchaseOrder ketika saat Lead Baru dia menghilang'. Jadi kolom Follow Up boleh berisi card tanpa PO, kan?"
    }
  ]
}
```

**Output:**
```
User has answered your questions: "Bagaimana struktur data PurchaseOrder? Client ingin detail seperti ukuran, desain, warna, bahan dalam PO."="Kolom fix terpisah", "Berapa PurchaseOrder per peluang/card?"="Satu PO per peluang, bisa revisi (Recommended)", "Bagaimana transisi Negosiasi → Deal? Sebelumnya Deal wajib lewat 'Terima quotation'. Dengan adanya PO manual, apakah tetap lewat quotation?"="Deal lewat quotation (Recommended)", "Di mana Admin menginput PurchaseOrder?"="input data PO ketika cardnya masuk ke Negosiasi otomatis Admin bisa menginputkan data PO", "Anda menyebut 'Follow Up tanpa data PurchaseOrder ketika saat Lead Baru dia menghilang'. Jadi kolom Follow Up boleh berisi card tanpa PO, kan?"="Follow Up boleh tanpa PO". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · Big Pickle · 10.4s)

Let me digest the answers:

1. **Struktur PO:** Kolom fix terpisah — PO punya field fix terpisah: ukuran, desain, warna, bahan, jumlah (dll).
2. **Jumlah PO:** Satu PO per peluang, bisa revisi.
3. **Deal:** Deal lewat quotation (tetap wajib quotation untuk jadi Deal, buat SalesOrder).
4. **Lokasi entry:** "input data PO ketika cardnya masuk ke Negosiasi otomatis Admin bisa menginputkan data PO" — so when a card is moved into Negosiasi, the Admin is prompted/able to input PO data. This suggests an in-flow entry at the point of entering Negosiasi, likely on the detail page or a modal.
5. **Follow Up:** Boleh tanpa PO.

Now I have a clearer picture. There's still a tension: the user chose "input PO ketika card masuk Negosiasi otomatis Admin bisa menginputkan" for location, but the structure answer said "Kolom fix terpisah: ukuran, desain, warna, bahan, jumlah". And one PO per opportunity, revisable.

Also one thing to reconcile: detail (blue click) should show "detail PO dan Invoice (penawaran)". And the opportunity detail page already shows Quotation (Invoice). So we add a PO section to the detail page.

Let me reconcile the "input PO ketika masuk Negosiasi" with the model. I think the cleanest design:

- PurchaseOrder model with fixed separate columns: `ukuran` (size), `desain`, `warna`, `bahan`, `jumlah` (quantity), plus maybe `catatan` and `revision`. One PO per opportunity (unique opportunityId), revisable. When a card enters Negosiasi, the system opens PO entry (a form on the detail page, or auto-set stage and show prompt).
- The quotation remains as Invoice/penawaran.
- Detail page shows PO + Quotation.

Now, regarding the card display: "Kemeja 30pcs" is the gray text derived from PO. With fixed columns, the gray text would show a summary like "Kemeja · 30 pcs" (product/desc + quantity). Where does the "Kemeja 30pcs" text come from given fixed columns? Need a product/name + quantity. Let me think — the fixed columns answer conflicts slightly with needing a "Kemeja 30pcs" summary line. The PO will have columns ukuran/desain/warna/bahan/jumlah. The "Kemeja" part is probably the product name held on the Opportunity (productName) or a PO productName field. The gray summary line = productName + jumlah.

Let me not over-ask. I have enough to form a plan, and I can present reasonable assumptions that the user can correct. Let me check the migrations and validation files to understand conventions, then write the plan.

Let me check the migration files and validation to understand the existing patterns for adding models and the follow-up form for the flow.



**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/lib/crm/validation.ts"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/lib/crm/validation.ts</path>
<type>file</type>
<content>
1: import { z } from "zod";
2: 
3: const optionalText = (max: number) =>
4:   z.preprocess(
5:     (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
6:     z.string().trim().max(max).optional(),
7:   );
8: 
9: const optionalPositiveInteger = z.preprocess(
10:   (value) => (value === "" || value === null ? undefined : Number(value)),
11:   z.number().int().positive().max(10_000_000).optional(),
12: );
13: 
14: const optionalMoney = (label: string) => optionalText(20).refine(
15:   (value) => !value || /^\d{1,16}(?:\.\d{1,2})?$/.test(value),
16:   `${label} tidak valid.`,
17: );
18: 
19: const requiredVersion = z.preprocess(
20:   (value) => Number(value),
21:   z.number().int().positive(),
22: );
23: 
24: export const entityIdSchema = z.string().trim().min(10).max(40);
25: 
26: const optionalEntityId = z.preprocess(
27:   (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
28:   entityIdSchema.optional(),
29: );
30: 
31: export const customerFieldsSchema = z
32:   .object({
33:     name: z.string().trim().min(2, "Nama customer minimal 2 karakter.").max(160),
34:     companyName: optionalText(160),
35:     whatsapp: optionalText(32),
36:     email: z.preprocess(
37:       (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
38:       z.email("Format email tidak valid.").trim().max(320).optional(),
39:     ),
40:     instagram: optionalText(80),
41:     address: optionalText(2000),
42:     city: optionalText(120),
43:     notes: optionalText(4000),
44:     customerTypeId: entityIdSchema,
45:     leadSourceId: optionalEntityId,
46:     salesPicId: optionalEntityId,
47:   })
48:   .refine((value) => Boolean(value.whatsapp || value.email || value.instagram), {
49:     message: "Isi minimal satu kontak: WhatsApp, email, atau Instagram.",
50:   });
51: 
52: export const createCustomerSchema = customerFieldsSchema;
53: 
54: export const updateCustomerSchema = customerFieldsSchema.and(
55:   z.object({
56:     customerId: entityIdSchema,
57:     version: requiredVersion,
58:   }),
59: );
60: 
61: export const archiveCustomerSchema = z.object({
62:   customerId: entityIdSchema,
63:   version: requiredVersion,
64: });
65: 
66: export const masterDataFieldsSchema = z.object({
67:   name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
68:   description: optionalText(500),
69:   position: z.coerce.number().int().min(0).max(10_000),
70: });
71: 
72: export const sortableMasterDataFieldsSchema = masterDataFieldsSchema.omit({ position: true });
73: 
74: export const bulkUpdateMasterDataSchema = z
75:   .array(sortableMasterDataFieldsSchema.extend({ id: entityIdSchema }))
76:   .min(1, "Minimal satu data harus tersedia.")
77:   .max(1_000, "Terlalu banyak data untuk diperbarui sekaligus.");
78: 
79: export const opportunityFieldsSchema = z.object({
80:   title: z.string().trim().min(3, "Judul peluang minimal 3 karakter.").max(180),
81:   leadSourceId: optionalEntityId,
82:   salesPicId: optionalEntityId,
83:   productName: optionalText(120),
84:   needPurpose: optionalText(500),
85:   designStatus: z.preprocess(
86:     (value) => (value === null || value === "" ? undefined : value),
87:     z.enum(["SUDAH_ADA", "BELUM_ADA", "PERLU_DIBANTU"]).optional(),
88:   ),
89:   specification: optionalText(2000),
90:   customerBudget: optionalMoney("Budget customer"),
91:   leadScore: z.coerce.number().int().min(0, "Skor minimal 0.").max(100, "Skor maksimal 100."),
92:   estimatedQuantity: optionalPositiveInteger,
93:   estimatedValue: optionalMoney("Estimasi nilai"),
94:   deadline: optionalText(10),
95:   nextAction: optionalText(500),
96:   nextActionAt: optionalText(32),
97: }).superRefine((value, context) => {
98:   if (Boolean(value.nextAction) !== Boolean(value.nextActionAt)) {
99:     context.addIssue({
100:       code: "custom",
101:       path: value.nextAction ? ["nextActionAt"] : ["nextAction"],
102:       message: "Next action dan jadwal harus diisi bersamaan.",
103:     });
104:   }
105: });
106: 
107: export const createOpportunitySchema = opportunityFieldsSchema.and(z.object({
108:   customerId: entityIdSchema,
109: }));
110: 
111: export const updateOpportunitySchema = opportunityFieldsSchema.and(z.object({
112:   opportunityId: entityIdSchema,
113:   version: requiredVersion,
114: }));
115: 
116: export const moveOpportunitySchema = z
117:   .object({
118:     opportunityId: entityIdSchema,
119:     version: requiredVersion,
120:     stage: z.enum(["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI", "LOST"]),
121:     cancelReason: optionalText(1000),
122:   })
123:   .superRefine((value, context) => {
124:     if (value.stage === "LOST" && !value.cancelReason) {
125:       context.addIssue({ code: "custom", path: ["cancelReason"], message: "Alasan lost wajib diisi." });
126:     }
127:   });
128: 
129: export const recordFollowUpResultSchema = z.object({
130:   opportunityId: entityIdSchema,
131:   version: requiredVersion,
132:   content: z.string().trim().min(2, "Hasil follow-up terlalu pendek.").max(4000),
133:   contactedAt: z.string().trim().min(1, "Waktu kontak wajib diisi."),
134:   channel: z.enum(["WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"]),
135:   direction: z.enum(["INBOUND", "OUTBOUND"]),
136:   nextAction: optionalText(500),
137:   nextActionAt: optionalText(32),
138:   stage: z.enum(["DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI", "LOST"]),
139:   cancelReason: optionalText(1000),
140: }).superRefine((value, context) => {
141:   if (value.stage === "LOST") {
142:     if (!value.cancelReason) context.addIssue({ code: "custom", path: ["cancelReason"], message: "Alasan lost wajib diisi." });
143:     return;
144:   }
145:   if (!value.nextAction || !value.nextActionAt) {
146:     context.addIssue({ code: "custom", path: ["nextAction"], message: "Opportunity terbuka wajib memiliki next action dan jadwal." });
147:   }
148: });
149: 
150: export const publicLeadSchema = z.object({
151:   submissionKey: z.uuid(),
152:   name: z.string().trim().min(2).max(160),
153:   whatsapp: z.string().trim().min(8).max(32),
154:   productName: z.string().trim().min(2).max(120),
155:   estimatedQuantity: optionalPositiveInteger,
156:   deadline: optionalText(10),
157:   city: optionalText(120),
158:   website: optionalText(200),
159: });
160: 
161: export const addCommunicationActivitySchema = z
162:   .object({
163:     context: z.enum(["customer", "opportunity"]),
164:     customerId: entityIdSchema,
165:     opportunityId: optionalEntityId,
166:     channel: z.enum(["INTERNAL_NOTE", "WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"]),
167:     direction: z.preprocess(
168:       (value) => (value === null || value === "" ? undefined : value),
169:       z.enum(["INBOUND", "OUTBOUND"]).optional(),
170:     ),
171:     occurredAt: z.string().trim().min(1, "Waktu aktivitas wajib diisi."),
172:     content: z.string().trim().min(2, "Ringkasan terlalu pendek.").max(4000),
173:   })
174:   .superRefine((value, context) => {
175:     if (value.context === "opportunity" && !value.opportunityId) {
176:       context.addIssue({ code: "custom", path: ["opportunityId"], message: "Peluang wajib tersedia." });
177:     }
178:     if (value.channel === "INTERNAL_NOTE" && value.direction) {
179:       context.addIssue({ code: "custom", path: ["direction"], message: "Catatan internal tidak memiliki arah komunikasi." });
180:     }
181:     if (value.channel !== "INTERNAL_NOTE" && !value.direction) {
182:       context.addIssue({ code: "custom", path: ["direction"], message: "Arah komunikasi wajib dipilih." });
183:     }
184:   });
185: 
186: export const quotationItemSchema = z.object({
187:   description: z.string().trim().min(2).max(240),
188:   quantity: z.coerce.number().int().positive().max(10_000_000),
189:   unitPrice: z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/, "Harga satuan tidak valid."),
190: });
191: 
192: export const quotationDraftSchema = z.object({
193:   opportunityId: entityIdSchema,
194:   quotationId: entityIdSchema.optional(),
195:   version: requiredVersion.optional(),
196:   discountType: z.enum(["NONE", "NOMINAL", "PERCENTAGE"]),
197:   discountValue: z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/),
198:   items: z.array(quotationItemSchema).min(1, "Minimal satu item penawaran.").max(50),
199: });
200: 
201: export const quotationIdSchema = z.object({
202:   quotationId: entityIdSchema,
203:   version: requiredVersion,
204: });
205: 
206: export const acceptQuotationSchema = quotationIdSchema.extend({
207:   acceptedAt: z.string().trim().min(1, "Tanggal penerimaan wajib diisi."),
208:   acceptanceReference: z.string().trim().min(3, "Referensi penerimaan wajib diisi.").max(2000),
209: });
210: 
211: export const ACCEPTANCE_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
212: export const ACCEPTANCE_PROOF_MAX_BYTES = 5 * 1024 * 1024;
213: 
214: export const reverseSalesOrderSchema = z.object({
215:   salesOrderId: entityIdSchema,
216:   cancelReason: z.string().trim().min(5, "Alasan pembatalan minimal 5 karakter.").max(2000),
217: });
218: 
219: export const loginSchema = z.object({
220:   email: z.email("Email tidak valid.").trim().max(320),
221:   password: z.string().min(1).max(128),
222: });
223: 
224: export const strongPasswordSchema = z
225:   .string()
226:   .min(12, "Password minimal 12 karakter.")
227:   .max(128)
228:   .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
229:   .regex(/[A-Z]/, "Password harus memiliki huruf besar.")
230:   .regex(/[0-9]/, "Password harus memiliki angka.")
231:   .regex(/[^A-Za-z0-9]/, "Password harus memiliki simbol.");
232: 
233: export const updatePasswordSchema = z
234:   .object({
235:     password: strongPasswordSchema,
236:     confirmPassword: z.string(),
237:   })
238:   .refine((value) => value.password === value.confirmPassword, {
239:     path: ["confirmPassword"],
240:     message: "Konfirmasi password tidak sama.",
241:   });
242: 
243: export const createUserSchema = z.object({
244:   name: z.string().trim().min(2).max(120),
245:   email: z.email("Email tidak valid.").trim().max(320),
246:   role: z.enum(["OWNER", "ADMIN", "SALES"]),
247:   temporaryPassword: strongPasswordSchema,
248: });
249: 
250: export const updateUserSchema = z.object({
251:   userId: entityIdSchema,
252:   updatedAt: z.string().datetime(),
253:   name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
254:   email: z.email("Email tidak valid.").trim().max(320),
255:   role: z.enum(["OWNER", "ADMIN", "SALES"]),
256: });
257: 
258: export const toggleUserSchema = z.object({
259:   userId: entityIdSchema,
260:   isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
261: });
262: 
263: export function firstValidationMessage(error: z.ZodError) {
264:   return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
265: }

(End of file - total 265 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/follow-up-result-form.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/follow-up-result-form.tsx</path>
<type>file</type>
<content>
1: "use client";
2: 
3: import { useState } from "react";
4: import type { OpportunityStage } from "@prisma/client";
5: import { NotebookPen } from "lucide-react";
6: 
7: import { recordFollowUpResultAction } from "@/app/actions/crm";
8: import { SubmitButton } from "@/components/submit-button";
9: import { Button } from "@/components/ui/button";
10: import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
11: import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
12: import { Input } from "@/components/ui/input";
13: import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
14: import { Textarea } from "@/components/ui/textarea";
15: import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
16: import { toDateTimeLocalValue } from "@/lib/crm/format";
17: 
18: type FollowUpItem = {
19:   id: string;
20:   version: number;
21:   title: string;
22:   stage: OpportunityStage;
23:   nextAction: string | null;
24:   nextActionAt: Date | null;
25:   cancelReason: string | null;
26: };
27: 
28: export function FollowUpResultForm({ opportunity }: { opportunity: FollowUpItem }) {
29:   const fallbackStage = opportunity.stage === "LEAD_BARU" ? "DIHUBUNGI" : opportunity.stage;
30:   const [stage, setStage] = useState<OpportunityStage>(fallbackStage);
31:   const closesOpportunity = stage === "LOST";
32: 
33:   return (
34:     <Dialog>
35:       <DialogTrigger render={<Button size="sm" />}>
36:         <NotebookPen data-icon="inline-start" aria-hidden="true" />
37:         Catat hasil
38:       </DialogTrigger>
39:       <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
40:         <DialogHeader>
41:           <DialogTitle>Catat hasil follow-up</DialogTitle>
42:           <DialogDescription>{opportunity.title}. Simpan hasil kontak dan langkah kerja berikutnya.</DialogDescription>
43:         </DialogHeader>
44:         <form action={recordFollowUpResultAction}>
45:           <input type="hidden" name="opportunityId" value={opportunity.id} />
46:           <input type="hidden" name="version" value={opportunity.version} />
47:           <FieldGroup>
48:             <div className="grid gap-4 sm:grid-cols-3">
49:               <Field>
50:                 <FieldLabel htmlFor={`channel-${opportunity.id}`} required>Kanal</FieldLabel>
51:                 <NativeSelect id={`channel-${opportunity.id}`} name="channel" defaultValue="WHATSAPP" required className="w-full">
52:                   <NativeSelectOption value="WHATSAPP">WhatsApp</NativeSelectOption>
53:                   <NativeSelectOption value="INSTAGRAM">Instagram</NativeSelectOption>
54:                   <NativeSelectOption value="PHONE">Telepon</NativeSelectOption>
55:                   <NativeSelectOption value="EMAIL">Email</NativeSelectOption>
56:                   <NativeSelectOption value="MEETING">Pertemuan</NativeSelectOption>
57:                   <NativeSelectOption value="OTHER">Lainnya</NativeSelectOption>
58:                 </NativeSelect>
59:               </Field>
60:               <Field>
61:                 <FieldLabel htmlFor={`direction-${opportunity.id}`} required>Arah</FieldLabel>
62:                 <NativeSelect id={`direction-${opportunity.id}`} name="direction" defaultValue="OUTBOUND" required className="w-full">
63:                   <NativeSelectOption value="OUTBOUND">Keluar</NativeSelectOption>
64:                   <NativeSelectOption value="INBOUND">Masuk</NativeSelectOption>
65:                 </NativeSelect>
66:               </Field>
67:               <Field>
68:                 <FieldLabel htmlFor={`contactedAt-${opportunity.id}`} required>Waktu kontak</FieldLabel>
69:                 <Input
70:                   id={`contactedAt-${opportunity.id}`}
71:                   name="contactedAt"
72:                   type="datetime-local"
73:                   required
74:                   defaultValue={toDateTimeLocalValue(new Date())}
75:                   max={toDateTimeLocalValue(new Date())}
76:                 />
77:               </Field>
78:             </div>
79:             <Field>
80:               <FieldLabel htmlFor={`content-${opportunity.id}`} required>Hasil follow-up</FieldLabel>
81:               <Textarea id={`content-${opportunity.id}`} name="content" required minLength={2} maxLength={4000} rows={4} placeholder="Ringkas respons customer dan keputusan yang diambil." />
82:             </Field>
83:             <Field>
84:               <FieldLabel htmlFor={`stage-${opportunity.id}`} required>Status setelah follow-up</FieldLabel>
85:               <NativeSelect id={`stage-${opportunity.id}`} name="stage" required value={stage} onChange={(event) => setStage(event.target.value as OpportunityStage)}>
86:                 {PIPELINE_STAGES.filter((item) => item !== "LEAD_BARU" && item !== "DEAL").map((item) => (
87:                   <NativeSelectOption key={item} value={item}>{STAGE_LABEL[item]}</NativeSelectOption>
88:                 ))}
89:               </NativeSelect>
90:             </Field>
91:             {closesOpportunity ? (
92:               <Field>
93:                 <FieldLabel htmlFor={`cancelReason-${opportunity.id}`} required>Alasan lost</FieldLabel>
94:                 <Textarea id={`cancelReason-${opportunity.id}`} name="cancelReason" required minLength={2} maxLength={1000} rows={3} defaultValue={opportunity.cancelReason ?? ""} />
95:               </Field>
96:             ) : (
97:               <>
98:                 <Field>
99:                   <FieldLabel htmlFor={`nextAction-${opportunity.id}`} required>Next action</FieldLabel>
100:                   <Input id={`nextAction-${opportunity.id}`} name="nextAction" required maxLength={500} defaultValue={opportunity.nextAction ?? ""} placeholder="Contoh: Kirim revisi harga" />
101:                 </Field>
102:                 <Field>
103:                   <FieldLabel htmlFor={`nextActionAt-${opportunity.id}`} required>Jadwal berikutnya</FieldLabel>
104:                   <Input id={`nextActionAt-${opportunity.id}`} name="nextActionAt" type="datetime-local" required defaultValue={toDateTimeLocalValue(opportunity.nextActionAt)} />
105:                   <FieldDescription>Harus setelah waktu kontak yang dicatat.</FieldDescription>
106:                 </Field>
107:               </>
108:             )}
109:             <SubmitButton pendingLabel="Menyimpan hasil...">Simpan hasil follow-up</SubmitButton>
110:           </FieldGroup>
111:         </form>
112:       </DialogContent>
113:     </Dialog>
114:   );
115: }

(End of file - total 115 lines)
</content>
```

---

## Assistant (Plan · Big Pickle · 3.5s)

I now have a thorough understanding of the entire CRM system. Let me check the migration and pipeline-summary to complete the picture of all files affected, plus check `getPipelineData` usage across dashboard.



**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/components/crm/pipeline-summary.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/components/crm/pipeline-summary.tsx</path>
<type>file</type>
<content>
1: import { STAGE_SUMMARY_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
2: import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
3: import type { PipelineOpportunity } from "@/lib/crm/data";
4: import { cn } from "@/lib/utils";
5: 
6: export function PipelineSummary({
7:   opportunities,
8:   total,
9: }: {
10:   opportunities: PipelineOpportunity[];
11:   total: number;
12: }) {
13:   return (
14:     <section aria-label="Ringkasan pipeline" className="grid gap-3">
15:       <dl className="rounded-xl border border-primary/15 bg-primary/5 p-4">
16:         <div className="flex items-center justify-between gap-4">
17:           <dt className="text-sm font-medium text-muted-foreground">Total peluang</dt>
18:           <dd className="font-mono text-2xl font-semibold tabular-nums text-primary">{total}</dd>
19:         </div>
20:       </dl>
21: 
22:       <dl className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 xl:grid-cols-8 xl:auto-cols-auto xl:grid-flow-row xl:overflow-visible">
23:         {PIPELINE_STAGES.map((stage) => (
24:           <div key={stage} className={cn("rounded-xl border p-4", STAGE_SUMMARY_CLASS[stage])}>
25:             <dt className="text-xs text-muted-foreground">{STAGE_LABEL[stage]}</dt>
26:             <dd className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", STAGE_TEXT_CLASS[stage])}>
27:               {opportunities.filter((opportunity) => opportunity.stage === stage).length}
28:             </dd>
29:           </div>
30:         ))}
31:       </dl>
32:     </section>
33:   );
34: }

(End of file - total 34 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/home/mandf/SobatTi/Konveksi/app/(app)/crm/page.tsx"
}
```

**Output:**
```
<path>/home/mandf/SobatTi/Konveksi/app/(app)/crm/page.tsx</path>
<type>file</type>
<content>
1: import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
2: import { NewLeadForm } from "@/components/crm/new-lead-form";
3: import { PipelineBoard } from "@/components/crm/pipeline-board";
4: import { PipelineSummary } from "@/components/crm/pipeline-summary";
5: import { PageHeader } from "@/components/page-header";
6: import { PageMessage } from "@/components/page-message";
7: import { getCustomerOptions, getPipelineData } from "@/lib/crm/data";
8: import { getCustomerFormOptions } from "@/lib/master-data";
9: 
10: export default async function CRMPage() {
11:   const [{ opportunities, total, truncated }, customers, formOptions] = await Promise.all([
12:     getPipelineData(),
13:     getCustomerOptions(),
14:     getCustomerFormOptions(),
15:   ]);
16: 
17:   return (
18:     <>
19:       <PageHeader
20:         title="Pipeline CRM"
21:         description="Gerakkan setiap peluang berdasarkan langkah berikutnya. Deal hanya selesai setelah quotation diterima dan Sales Order terbentuk."
22:         action={<NewLeadForm customers={customers} {...formOptions} />}
23:       />
24:       <PageMessage />
25: 
26:       <PipelineSummary opportunities={opportunities} total={total} />
27: 
28:       {truncated ? (
29:         <Alert>
30:           <AlertTitle>Board menampilkan 500 peluang terbaru</AlertTitle>
31:           <AlertDescription>Gunakan halaman customer untuk menelusuri data lama.</AlertDescription>
32:         </Alert>
33:       ) : null}
34: 
35:       <PipelineBoard opportunities={opportunities} />
36:     </>
37:   );
38: }

(End of file - total 38 lines)
</content>
```

---

## Assistant (Plan · Big Pickle · 6.5s)

I now have a complete picture of all files that need to change. Let me compile the plan.

## Summary of the design

**5 columns:** Lead Baru, Follow Up, Negosiasi, Deal, Lost. This reduces the `OpportunityStage` enum from 8 → 5 (`LEAD_BARU`, `FOLLOW_UP`, `NEGOSIASI`, `DEAL`, `LOST`). DIHUBUNGI, KEBUTUHAN_TERGALI, PENAWARAN are dropped and data migrated.

**Card:** Nama Customer (blue, links to detail) + gray text below = PO summary (like "Kemeja 30pcs"). Lead Baru/Follow Up (no PO) → gray empty.

**New `PurchaseOrder` model:** one per opportunity (unique opportunityId), revisable, with fixed separate columns: ukuran, desain, warna, bahan, jumlah, plus product name and notes. Manually input by Admin — prompted automatically when card enters Negosiasi. PO summary in gray text = product + jumlah.

**Deal:** still via quotation acceptance (Invoice/penawaran harga) → creates SalesOrder.

**Detail (blue click):** shows PO detail (fixed columns) + Quotation/Invoice.

Now let me write the plan. I'll present it clearly and concisely, with file-level breakdown, migration strategy, and verification. I'll note the ambiguities I'm resolving with sensible assumptions and flag any remaining decisions for the user.

Let me present the plan in Indonesian since the user is communicating in Indonesian.



**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Present the CRM pipeline redesign plan to user",
      "status": "in_progress",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Present the CRM pipeline redesign plan to user",
    "status": "in_progress",
    "priority": "high"
  }
]
```

---

## Assistant (Plan · Big Pickle · 212.0s)

Berikut analisis dan rencana saya untuk proyek Konveksi (bagian Pipeline CRM), berdasarkan pemahaman Anda dan jawaban-jawaban tadi.

## Pemahaman desain (dari jawaban Anda)

- **5 kolom:** Lead Baru → Follow Up → Negosiasi → Deal → Lost
- **Card:** Nama Customer (biru, diklik → detail) + teks abu-abu di bawah = ringkasan PO ("Kemeja 30pcs"). Lead Baru/Follow Up tanpa PO → abu-abu kosong.
- **PO = input manual Admin,** berisi data permintaan customer (ukuran, desain, warna, bahan, jumlah). Muncul otomatis saat card masuk Negosiasi.
- **Quotation = Invoice/penawaran harga** (tetap seperti sekarang).
- **Deal** tetap lewat terima quotation → SalesOrder.
- **1 customer bisa beberapa card** (beberapa peluang).
- **Follow Up boleh tanpa PO** (lead yang "menghilang" dari Lead Baru).

---

## Rencana Implementasi

### 1. Database — skema baru

**A. Kurangi enum `OpportunityStage` 8 → 5** (di `prisma/schema.prisma`):
- Hapus `DIHUBUNGI`, `KEBUTUHAN_TERGALI`, `PENAWARAN`
- Sisa: `LEAD_BARU`, `FOLLOW_UP`, `NEGOSIASI`, `DEAL`, `LOST`

**B. Buat model `PurchaseOrder` baru** (1 per peluang, bisa revisi), kolom fix terpisah:
```
model PurchaseOrder {
  id            String  @id @default(cuid())
  opportunityId String  @unique       // satu PO per peluang
  revision      Int
  productName   String  @db.VarChar(120)   // "Kemeja"
  quantity      Int                         // "30"
  ukuran        String? @db.VarChar(120)    // S/M/L/XL ...
  desain        String? @db.Text
  warna         String? @db.VarChar(120)
  bahan         String? @db.VarChar(120)
  catatan       String? @db.Text
  version       Int     @default(1)
  opportunity   Opportunity @relation(...)
  createdAt/updatedAt
}
```
- `estimatedQuantity`/`specification`/`productName` lama di Opportunity jadi berbayang oleh PO, tapi tidak dihapus agar tidak merusak data historis (opsional: hanya tampilkan PO).

**C. Migrasi data** dari 3 stage lama:
- `DIHUBUNGI` → `FOLLOW_UP`
- `KEBUTUHAN_TERGALI` → `NEGOSIASI`
- `PENAWARAN` → `NEGOSIASI`
- (Jika sudah punya draft quotation di stage lama, aman karena Negosiasi tetap boleh quotation.)

### 2. Konstanta & tema (`lib/crm/constants.ts`, `components/crm/stage-theme.ts`, `pipeline-summary.tsx`)
- `PIPELINE_STAGES`, `STAGE_LABEL`, `OPEN_STAGES` → 5 kolom, urutan baru.
- `STAGE_SURFACE/TEXT/SUMMARY_CLASS` → 5 kolom.
- `PipelineSummary` grid `xl:grid-cols-8` → `xl:grid-cols-5`.

### 3. Data layer (`lib/crm/data.ts`)
- `PipelineOpportunity` tambah `purchaseOrder` (ringkasan: `productName`, `quantity`) untuk isi teks abu-abu.
- `getPipelineData` sertakan `purchaseOrder` dalam `select`.
- `getOpportunityDetail` sertakan `purchaseOrder` untuk detail PO + quotation.

### 4. Server Action baru (`app/actions/crm.ts`) + validasi (`lib/crm/validation.ts`)
- `createPurchaseOrderAction` / `updatePurchaseOrderAction` (input manual, satu per peluang, revisi).
- `moveOpportunitySchema` / `recordFollowUpResultSchema` → ubah daftar stage jadi 5.

### 5. Board / card (`components/crm/pipeline-board.tsx`)
- **Nama customer biru** jadi `CardTitle` link → `/crm/peluang/:id`.
- Teks abu-abu ringkasan PO di bawahnya:
  - `LEAD_BARU`/`FOLLOW_UP` tanpa PO → kosong / "Belum ada pesanan".
  - `NEGOSIASI`/`DEAL`/`LOST` → "Kemeja · 30 pcs".
- Dialog move: daftar stage jadi 5; DEAL tetap nonaktif (lewat quotation), LOST wajib alasan.
- Alur otomatis: saat card dipindah ke `NEGOSIASI`, tampilkan prompt "isi PO".

### 6. Halaman detail (`app/(app)/crm/peluang/[id]/page.tsx`)
- Restyle: Nama customer biru → menampilkan **Detail PO** (ukuran/desain/warna/bahan/jumlah) + **Invoice/Quotation** (yang sudah ada).
- Form input PO muncul/mudah diakses saat stage Negosiasi.

### 7. Files yang terdampak
- `prisma/schema.prisma` + migration baru
- `lib/crm/constants.ts`, `lib/crm/data.ts`, `lib/crm/validation.ts`, `lib/crm/reminders.ts` (cuma filter stage)
- `app/actions/crm.ts`, `components/crm/pipeline-board.tsx`, `pipeline-summary.tsx`, `stage-theme.ts`, `opportunity-stage-form.tsx`, `follow-up-result-form.tsx`, `new-lead-form.tsx`
- `app/(app)/crm/page.tsx`, `follow-up/page.tsx`
- Dashboard & analytics yang refer `OPEN_STAGES` / enum lama (perlu audit: `lib/crm/reminder-types.ts`, `lib/analytics/*`, `getSalesDashboardData`, `getFollowUpData`, dll.)

---

Sebelum saya kunci rencana, ada beberapa keputusan yang masih saya pegang dengan asumsi — mohon konfirmasi:



**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "header": "Ringkasan abu-abu",
      "options": [
        {
          "description": "Field fix terpisah tetap penghasil detail, tapi ada field 'nama produk' + 'jumlah' yang membentuk teks ringkas untuk card (mis. 'Kemeja · 30 pcs').",
          "label": "Tambah field produk+jumlah (Recommended)"
        },
        {
          "description": "Teks abu-abu card hanya menampilkan isi field ukuran atau catatan pendek field yang sudah ada.",
          "label": "Pakai field yang sudah ada"
        }
      ],
      "question": "Karena PO memakai 'kolom fix terpisah' (ukuran/desain/warna/bahan/jumlah), dari mana asal teks abu-abu ringkas 'Kemeja 30pcs' di card?"
    },
    {
      "header": "Kewajiban PO",
      "options": [
        {
          "description": "Masuk Negosiasi boleh dulu, lalu diingatkan mengisi PO. Menuju Deal wajib sudah ada PO + quotation diterima.",
          "label": "Wajib saat menuju Deal (Recommended)"
        },
        {
          "description": "Card tidak bisa masuk Negosiasi sebelum PO diisi.",
          "label": "Wajib sebelum masuk Negosiasi"
        }
      ],
      "question": "Kapan PO wajib ada? Anda bilang 'input otomatis saat masuk Negosiasi' tapi ada kartu Negosiasi yang awalnya kosong. Kapankah PO benar-benar wajib?"
    },
    {
      "header": "Detail link",
      "options": [
        {
          "description": "Teks biru mengarah ke halaman /crm/peluang/:id yang di-restyle. URL bisa dibagikan, konsisten dengan sistem.",
          "label": "Halaman detail baru (Recommended)"
        },
        {
          "description": "Teks biru membuka panel/dialog detail langsung di board tanpa pindah halaman.",
          "label": "Modal/panel di board"
        }
      ],
      "question": "Anda belum memilih eksplisit antara halaman detail vs modal untuk klik teks biru. Mana yang Anda inginkan?"
    }
  ]
}
```

**Output:**
```
User has answered your questions: "Karena PO memakai 'kolom fix terpisah' (ukuran/desain/warna/bahan/jumlah), dari mana asal teks abu-abu ringkas 'Kemeja 30pcs' di card?"="jadi urutannya card masuk ke Negosiasi lalu Admin mengisi data PO jika sudah terisi otomatis teks abu-abu muncul. untuk datanya kemungkinan jenis pakaian, ukuran(bisa beberapa), total(semua ukuran dijumlah)", "Kapan PO wajib ada? Anda bilang 'input otomatis saat masuk Negosiasi' tapi ada kartu Negosiasi yang awalnya kosong. Kapankah PO benar-benar wajib?"="Wajib saat menuju Deal (Recommended)", "Anda belum memilih eksplisit antara halaman detail vs modal untuk klik teks biru. Mana yang Anda inginkan?"="Halaman detail baru (Recommended)". You can now continue with the user's answers in mind.
```

---

## Assistant (Plan · Big Pickle · 16.2s)

Saya sudah punya semua yang diperlukan. Jawaban terakhir sangat membantu:

## Ringkasan keputusan final yang terkunci

1. **Teks abu-abu card:** Muncul otomatis setelah PO diisi saat Negosiasi. Data = **jenis pakaian** (product), **ukuran** (bisa beberapa), **total** (semua ukuran dijumlah). Contoh: "Kemeja 30 pcs".
2. **PO wajib** saat menuju Deal (bukan wajib saat masuk Negosiasi — boleh dulu kosong, diberi pengingat isi).
3. **Klik teks biru → halaman detail baru** (`/crm/peluang/:id` di-restyle).

Data model PO akhir:
```
PurchaseOrder {
  id, opportunityId (unique), revision
  productName    // jenis pakaian: "Kemeja"
  items[]        // daftar ukuran dengan jumlah masing-masing
  // dan tetap menyisipkan desain/warna/bahan sebagai kolom fix pada tingkat order
}
```

Karena pelanggan Anda menyebut "ukuran (bisa beberapa) + total dijumlah", model PO perlu **dua level**:
- **Header PO:** `productName`, dan kolom fix tingkat order: `desain`, `warna`, `bahan`, `catatan`.
- **Line item ukuran:** tabel `PurchaseOrderSize` (`ukuran`, `jumlah`) → `quantity`/total = jumlah semua baris. Teks abu-abu = `productName` + `sum(jumlah)`.

Saya akan koreksi rencana saya dengan ini dan menyajikan plan final yang siap dieksekusi. Mari saya selesaikan penyusunan plan final.

## PLAN FINAL — Pipeline CRM (Konveksi)

**Tujuan:** 5 kolom kanban (Lead Baru, Follow Up, Negosiasi, Deal, Lost). Card = Nama Customer (biru) + ringkasan PO (abu-abu, hasil input manual Admin saat Negosiasi). Deal via terima quotation → SalesOrder. Klik biru → halaman detail yang menampilkan PO + Invoice.

### A. Prisma (`prisma/schema.prisma`) + migration
1. Kurangi `OpportunityStage` → `LEAD_BARU | FOLLOW_UP | NEGOSIASI | DEAL | LOST`
2. Model baru:
   ```
   model PurchaseOrder {
     id            String @id
     opportunityId String @unique
     revision      Int
     productName   String              // "Kemeja"
     desain        String?             // kolom fix
     warna         String?
     bahan         String?
     catatan       String?
     version       Int @default(1)
     opportunity   Opportunity @relation
     sizes         PurchaseOrderSize[]
     createdAt/updatedAt
   }
   model PurchaseOrderSize {
     id            String @id
     purchaseOrderId String
     ukuran        String            // S/M/L/XL ...
     quantity      Int               // 12
     @@unique([purchaseOrderId, ukuran])
   }
   ```
3. Migration: UPDATE stage lama → baru (`DIHUBUNGI`→`FOLLOW_UP`, `KEBUTUHAN_TERGALI`→`NEGOSIASI`, `PENAWARAN`→`NEGOSIASI`), drop 3 enum value, buat tabel PO.

### B. Konstanta/tema (`constants.ts`, `stage-theme.ts`, `pipeline-summary.tsx`)
- 5 stage, urutan baru; grid summary → 5 kolom.

### C. Data layer (`lib/crm/data.ts`)
- `PipelineOpportunity` tambah `purchaseOrder { productName, sizes }` (untuk teks abu-abu & total).
- `getPipelineData` include PO+sizes; `getOpportunityDetail` include PO+sizes+quotation.

### D. Actions + validasi (`app/actions/crm.ts`, `validation.ts`)
- `create/updatePurchaseOrderAction` (manual; create jika belum, revisi jika ada).
- Update `moveOpportunitySchema`, `recordFollowUpResultSchema`, stage list jadi 5.
- Logika: pindah ke `DEAL` tetap via quotation (`acceptQuotationAndDealAction`) — pastikan PO ada saat ini (validasi di action).

### E. Board (`pipeline-board.tsx`)
- CardTitle = link biru nama customer → detail; CardDescription = ringkasan PO ("Kemeja · 30 pcs") atau "Belum ada pesanan" (Lead/Follow Up kosong).
- Dialog move: 5 stage; DEAL disabled (via quotation, wajib PO); LOST wajib alasan.

### F. Halaman detail (`peluang/[id]/page.tsx`)
- Restyle: seksi **Detail PO** (product, ukuran×jumlah table, desain/warna/bahan/catatan) + seksi **Invoice/Quotation** (sudah ada).
- Form input/isi PO, ditampilkan/mudah saat stage Negosiasi; peringatan "isi PO sebelum Deal".

### G. Audit dependencies & dashboard
- Periksa semua referensi `OPEN_STAGES`, `DIHUBUNGI`, dsb: `lib/crm/reminders.ts`, `lib/crm/reminder-types.ts`, `lib/analytics/*`, `getFollowUpData`, `getSalesDashboardData`, dashboard pages — sesuaikan stage list.

### H. Verifikasi
- `prisma migrate dev`, `npx prisma generate`, `tsc`/lint.
- Manual: cek board 5 kolom, pindah card, input PO munculkan abu-abu, deal via quotation.

---

Rencana ini siap. Karena mode plan aktif, saya **belum** mengeksekusi perubahan apa pun. Beri tahu saya jika Anda ingin saya mulai menerapkan (keluar dari plan mode), atau jika ada bagian yang ingin disesuaikan dulu.

---

