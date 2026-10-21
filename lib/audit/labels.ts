/**
 * Label bahasa Indonesia untuk log aktivitas (tabel AuditEvent).
 *
 * Registry ini sengaja eksplisit supaya frasa enak dibaca ("Pindah tahap peluang",
 * bukan "Opportunity stage changed"). Aksi baru yang belum dipetakan tetap tampil
 * lewat fallback yang merapikan kode aksi — halaman tidak pernah menampilkan kosong.
 */

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // Peluang & customer
  OPPORTUNITY_CREATED: "Buat peluang",
  OPPORTUNITY_UPDATED: "Ubah peluang",
  OPPORTUNITY_STAGE_CHANGED: "Pindah tahap peluang",
  FOLLOW_UP_RECORDED: "Catat hasil follow up",
  FOLLOW_UP_BROADCAST_QUEUED: "Antre broadcast follow up",
  CUSTOMER_CREATED: "Buat customer",
  CUSTOMER_UPDATED: "Ubah customer",
  CUSTOMER_ARCHIVED: "Arsipkan customer",
  CUSTOMER_RESTORED: "Pulihkan customer",
  NOTE_ADDED: "Tambah catatan",
  COMMUNICATION_ACTIVITY_ADDED: "Tambah riwayat komunikasi",
  DEAL_ORDER_CREATED: "Buat order dari deal",
  // Purchase Order
  PURCHASE_ORDER_DRAFT_CREATED: "Buat draft PO",
  PURCHASE_ORDER_DRAFT_UPDATED: "Ubah draft PO",
  PURCHASE_ORDER_DRAFT_CANCELLED: "Batalkan draft PO",
  PURCHASE_ORDER_AGREED: "Setujui PO",
  PURCHASE_ORDER_CANCELLED: "Batalkan PO",
  PURCHASE_ORDER_REVISION_CREATED: "Buat revisi PO",
  PURCHASE_ORDER_DESIGN_SENT: "Kirim desain PO",
  PURCHASE_ORDER_DEPOSIT_RECORDED: "Catat deposit PO",
  PURCHASE_ORDER_DEPOSIT_UPDATED: "Ubah deposit PO",
  PURCHASE_ORDER_CUSTOMER_CONFIRMED: "Konfirmasi PO oleh customer",
  // Invoice & pembayaran
  INVOICE_DRAFT_CREATED: "Buat draft invoice",
  INVOICE_DRAFT_UPDATED: "Ubah draft invoice",
  INVOICE_ISSUED: "Terbitkan invoice",
  INVOICE_CANCELLED: "Batalkan invoice",
  INVOICE_REVISION_CREATED: "Buat revisi invoice",
  INVOICE_REMINDER_SETTINGS_UPDATED: "Ubah pengingat invoice",
  INVOICE_SETTING_POINT_CREATED: "Buat poin pengaturan invoice",
  INVOICE_SETTING_POINT_UPDATED: "Ubah poin pengaturan invoice",
  INVOICE_SETTING_POINT_DELETED: "Hapus poin pengaturan invoice",
  PAYMENT_RECORDED: "Catat pembayaran",
  PAYMENT_UPDATED: "Ubah pembayaran",
  PAYMENT_VOIDED: "Batalkan pembayaran",
  PAYMENT_SCHEDULED: "Jadwalkan pembayaran",
  // Sales Order
  SALES_ORDER_CREATED: "Buat Sales Order",
  SALES_ORDER_CANCELLED: "Batalkan Sales Order",
  SALES_ORDER_HPP_UPDATED: "Ubah HPP Sales Order",
  // Produksi
  PRODUCTION_WORK_ORDER_CREATED: "Buat work order",
  PRODUCTION_WORK_ORDER_CANCELLED: "Batalkan work order",
  PRODUCTION_WORKFLOW_UPDATED: "Ubah alur produksi",
  PRODUCTION_NOTE_ADDED: "Tambah catatan produksi",
  PRODUCTION_OBSTACLE_UPDATED: "Ubah kendala produksi",
  PRODUCTION_PIC_ASSIGNED: "Tugaskan PIC produksi",
  PRODUCTION_REOPENED: "Buka ulang work order",
  STAGE_MOVED: "Pindah tahap produksi",
  STAGE_REVERTED: "Kembalikan tahap produksi",
  STAGE_SKIPPED: "Lewati tahap produksi",
  SAMPLE_REJECTED: "Tolak sampel",
  QC_REJECTED: "Tolak QC",
  PRODUCTION_DESIGN_SENT: "Kirim desain ke produksi",
  PRODUCTION_DESIGN_REPLACED: "Ganti desain produksi",
  PRODUCTION_DESIGN_RESET: "Reset desain produksi",
  PRODUCTION_DESIGN_VERSION_SAVED: "Simpan versi desain",
  PRODUCTION_DESIGN_ANNOTATED: "Beri anotasi desain",
  // Desain
  DESIGN_REVISION_UPLOADED: "Unggah revisi desain",
  DESIGN_REVISION_APPROVED: "Setujui revisi desain",
  DESIGN_REVISION_REJECTED: "Tolak revisi desain",
  // Keuangan
  EXPENSE_CREATED: "Buat pengeluaran",
  EXPENSE_UPDATED: "Ubah pengeluaran",
  EXPENSE_DELETED: "Hapus pengeluaran",
  EXPENSE_RESTORED: "Pulihkan pengeluaran",
  EXPENSE_REIMBURSED: "Tandai pengeluaran sudah diganti",
  // Absensi
  ATTENDANCE_CLOCKED_IN: "Absen masuk",
  ATTENDANCE_MANUAL_RECORDED: "Catat absensi manual",
  ATTENDANCE_CORRECTED: "Koreksi absensi",
  ATTENDANCE_MANUAL_DELETED: "Hapus absensi manual",
  ATTENDANCE_SETTINGS_UPDATED: "Ubah pengaturan absensi",
  ATTENDANCE_HOLIDAY_CREATED: "Tambah hari libur",
  ATTENDANCE_HOLIDAY_UPDATED: "Ubah hari libur",
  ATTENDANCE_HOLIDAY_DELETED: "Hapus hari libur",
  // Campaign promo & WhatsApp
  CAMPAIGN_CREATED: "Buat campaign promo",
  CAMPAIGN_UPDATED: "Ubah campaign promo",
  CAMPAIGN_DELETED: "Hapus campaign promo",
  CAMPAIGN_PAUSED: "Jeda campaign promo",
  CAMPAIGN_RESUMED: "Lanjutkan campaign promo",
  CAMPAIGN_SKIPPED: "Lewati campaign promo",
  CAMPAIGN_RECIPIENTS_UPDATED: "Ubah penerima campaign",
  CAMPAIGN_TEST_QUEUED: "Antre test campaign",
  // Pengaturan
  BUSINESS_PROFILE_UPDATED: "Ubah profil perusahaan",
  ORDER_REMINDER_SETTING_UPDATED: "Ubah pengingat order",
  REPEAT_ORDER_SETTINGS_UPDATED: "Ubah pengaturan repeat order",
  REPEAT_ORDER_TEST_FORCED: "Paksa test repeat order",
  // Data master
  CUSTOMER_TYPE_CREATED: "Buat jenis customer",
  CUSTOMER_TYPE_UPDATED: "Ubah jenis customer",
  CUSTOMER_TYPE_DELETED: "Hapus jenis customer",
  LEAD_SOURCE_CREATED: "Buat sumber lead",
  LEAD_SOURCE_UPDATED: "Ubah sumber lead",
  LEAD_SOURCE_DELETED: "Hapus sumber lead",
  GARMENT_SIZE_CREATED: "Buat ukuran pakaian",
  GARMENT_SIZE_UPDATED: "Ubah ukuran pakaian",
  GARMENT_SIZE_DELETED: "Hapus ukuran pakaian",
  PRODUCT_CATEGORY_CREATED: "Buat kategori produk",
  PRODUCT_CATEGORY_UPDATED: "Ubah kategori produk",
  PRODUCT_CATEGORY_DELETED: "Hapus kategori produk",
  PAYMENT_METHOD_CREATED: "Buat metode pembayaran",
  PAYMENT_METHOD_UPDATED: "Ubah metode pembayaran",
  PAYMENT_METHOD_DELETED: "Hapus metode pembayaran",
  // Akun & akses
  USER_CREATED: "Buat pengguna",
  USER_UPDATED: "Ubah pengguna",
  USER_ACTIVATED: "Aktifkan pengguna",
  USER_DEACTIVATED: "Nonaktifkan pengguna",
  PASSWORD_CHANGED: "Ubah kata sandi",
  OWNER_BOOTSTRAPPED: "Buat akun owner",
  DEVELOPER_PROVISIONED: "Buat akun developer",
  TESTING_DATA_RESET: "Reset data testing",
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  AppUser: "Pengguna",
  Attendance: "Absensi",
  AttendanceHoliday: "Hari libur absensi",
  AttendanceSetting: "Pengaturan absensi",
  BusinessProfile: "Profil perusahaan",
  CRMNote: "Catatan CRM",
  Customer: "Customer",
  CustomerType: "Jenis customer",
  DesignRevision: "Revisi desain",
  Expense: "Pengeluaran",
  GarmentSize: "Ukuran pakaian",
  Invoice: "Invoice",
  InvoiceSettingPoint: "Poin pengaturan invoice",
  LeadSource: "Sumber lead",
  Opportunity: "Peluang",
  PaymentMethod: "Metode pembayaran",
  PaymentTransaction: "Transaksi pembayaran",
  ProductCategory: "Kategori produk",
  ProductionWorkOrder: "Work order produksi",
  PurchaseOrder: "Purchase Order",
  SalesOrder: "Sales Order",
  System: "Sistem",
  WhatsAppBroadcast: "Broadcast WhatsApp",
  WhatsAppCampaign: "Campaign promo",
  WhatsAppCampaignTest: "Test campaign",
};

/** "PURCHASE_ORDER_UPDATED" → "Purchase order updated" (cadangan untuk kode baru). */
function prettifyCode(value: string) {
  const words = value
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : value;
}

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? prettifyCode(action);
}

export function auditEntityLabel(entityType: string) {
  return AUDIT_ENTITY_LABEL[entityType] ?? prettifyCode(entityType);
}
