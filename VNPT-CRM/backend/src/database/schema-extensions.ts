import { query, run } from "./db.js";
import { LEAD_GROUP_RENAMES } from "../constants/org.js";
import { syncServicesFromContract } from "../modules/service/contract-service-sync.js";
import { applyLeadChannelSchema } from "./ext/t1.js";
import { applyContractQuickEditSchema } from "./ext/contract-quick-edit.js";
import { applyReminderEmailSchema } from "./ext/reminder-email.js";
import { applyT6Schema } from "./ext/t6.js";
import { applyT8Schema } from "./ext/t8.js";
import { applyT10Schema } from "./ext/t10.js";

const IDENTIFIER_PATTERN = /^[a-z_]+$/;

function assertIdentifier(value: string, kind: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${kind} identifier: ${value}`);
  }
}

// Thêm cột nếu chưa có (Postgres: ADD COLUMN IF NOT EXISTS).
export async function ensureColumn(table: string, column: string, ddlType: string): Promise<void> {
  assertIdentifier(table, "table");
  assertIdentifier(column, "column");
  await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${ddlType}`);
}

// Chạy trước seed: chỉ thêm cột/bảng/index, không đụng dữ liệu.
export async function applySchemaExtensions(): Promise<void> {
  await ensureColumn("users", "phone", "TEXT");
  await ensureColumn("users", "referral_code", "TEXT");
  await ensureColumn("users", "approved_at", "TEXT");
  await ensureColumn("users", "approved_by", "TEXT");
  await ensureColumn("users", "created_at", "TEXT");
  await ensureColumn("users", "must_change_password", "BOOLEAN DEFAULT FALSE");
  await run("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_referral_code ON users(referral_code)");

  await ensureColumn("renewals", "expiry_date", "TEXT");
  await ensureColumn("renewals", "renewed_at", "TEXT");

  await ensureColumn("customers", "handover_batch", "TEXT");
  await ensureColumn("customers", "handover_date", "TEXT");
  await ensureColumn("customers", "territory_id", "TEXT");
  await ensureColumn("customers", "customer_code", "TEXT");
  await ensureColumn("customers", "status", "TEXT");
  await ensureColumn("customers", "team_id", "TEXT");
  await ensureColumn("customers", "sales_channel", "TEXT");
  await ensureColumn("customers", "contact_name", "TEXT");
  await ensureColumn("customers", "contact_email", "TEXT");
  await ensureColumn("customers", "billing_name", "TEXT");
  await ensureColumn("customers", "billing_phone", "TEXT");
  await ensureColumn("customers", "billing_email", "TEXT");
  await ensureColumn("customers", "note", "TEXT");
  await ensureColumn("customers", "referred_by_ctv_id", "TEXT");
  // Người đại diện pháp luật — chỉ dùng để điền mẫu hợp đồng, không bắt buộc nhập.
  await ensureColumn("customers", "representative_name", "TEXT");
  await ensureColumn("customers", "representative_title", "TEXT");
  await ensureColumn("customers", "representative_id_number", "TEXT");
  await ensureColumn("customers", "representative_id_issued_at", "TEXT");
  await ensureColumn("customers", "representative_id_issued_place", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS customer_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      note TEXT,
      created_at TEXT
    )
  `);
  await run(
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_teams_name ON customer_teams(LOWER(name))"
  );

  await run(`
    CREATE TABLE IF NOT EXISTS customer_documents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      uploaded_by TEXT,
      created_at TEXT
    )
  `);

  await ensureColumn("leads", "territory_id", "TEXT");
  await ensureColumn("leads", "referred_by_ctv_id", "TEXT");
  await ensureColumn("leads", "note", "TEXT");
  await ensureColumn("leads", "email", "TEXT"); // không bắt buộc nhập

  await ensureColumn("contracts", "territory_id", "TEXT");
  await ensureColumn("contracts", "referred_by_ctv_id", "TEXT");
  await ensureColumn("contracts", "lead_id", "TEXT");
  await ensureColumn("contracts", "am_staff", "TEXT");
  await ensureColumn("contracts", "service_group", "TEXT");
  await ensureColumn("contracts", "service_name", "TEXT");
  await ensureColumn("contracts", "package_name", "TEXT");
  await ensureColumn("contracts", "payment_method", "TEXT");
  await ensureColumn("contracts", "customer_id", "TEXT");
  await ensureColumn("contracts", "tax_code", "TEXT");
  await ensureColumn("contracts", "contract_number", "TEXT");
  await ensureColumn("contracts", "signed_date", "TEXT");
  await ensureColumn("contracts", "collected_amount", "REAL DEFAULT 0");
  await ensureColumn("contracts", "term_months", "INTEGER");

  await ensureColumn("commissions", "contract_id", "TEXT");
  await ensureColumn("commissions", "ctv_id", "TEXT");
  await ensureColumn("commissions", "note", "TEXT");
  await ensureColumn("commissions", "customer_paid_override", "REAL");
  await ensureColumn("commissions", "paid_out_amount", "REAL DEFAULT 0");
  await ensureColumn("commissions", "paid_out_date", "TEXT");
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_commissions_contract_ctv ON commissions(contract_id, ctv_id)
     WHERE contract_id IS NOT NULL AND ctv_id IS NOT NULL`
  );
  // Hoa hồng nội bộ (đơn không có CTV, ghi nhận cho AM bán hàng) — idempotent
  // theo contract_id (chỉ 1 dòng nội bộ / đơn), ctv_id luôn NULL ở loại này.
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_commissions_contract_internal ON commissions(contract_id)
     WHERE contract_id IS NOT NULL AND ctv_id IS NULL AND type = 'Hoa hồng nội bộ'`
  );

  await ensureColumn("staff", "hrm_code", "TEXT");
  await ensureColumn("staff", "staff_type", "TEXT");
  await ensureColumn("staff", "phone", "TEXT");
  await ensureColumn("staff", "birth_date", "TEXT");
  await ensureColumn("staff", "personal_email", "TEXT");
  await ensureColumn("staff", "short_name", "TEXT");
  await ensureColumn("staff", "note", "TEXT");
  await ensureColumn("staff", "status_reason", "TEXT");
  await ensureColumn("staff", "status_changed_at", "TEXT");
  await ensureColumn("staff", "status_changed_by", "TEXT");
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_hrm_code
    ON staff(hrm_code)
    WHERE hrm_code IS NOT NULL AND hrm_code <> ''
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ward_officials (
      id TEXT PRIMARY KEY,
      territory_id TEXT NOT NULL,
      unit TEXT NOT NULL,
      position TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quarters (
      id TEXT PRIMARY KEY,
      territory_id TEXT NOT NULL,
      name TEXT NOT NULL,
      head_name TEXT,
      secretary_name TEXT,
      mttq_name TEXT,
      household_count INTEGER DEFAULT 0,
      population INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS contract_payments (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_date TEXT NOT NULL,
      note TEXT,
      created_by TEXT,
      created_at TEXT
    )
  `);

  await ensureColumn("system_settings", "payment_beneficiary", "TEXT DEFAULT 'VNPT thành phố Hồ Chí Minh'");
  await ensureColumn("system_settings", "payment_account_no", "TEXT DEFAULT '1058561111'");
  await ensureColumn("system_settings", "payment_bank_name", "TEXT DEFAULT 'TMCP Ngoại Thương Việt Nam – CN TP.HCM. (VietcomBank)'");
  await ensureColumn("system_settings", "payment_signer_name", "TEXT DEFAULT 'Lê Văn Thuần'");

  await ensureColumn("system_settings", "smtp_mode", "TEXT DEFAULT 'domain'");
  await ensureColumn("system_settings", "smtp_from_name", "TEXT DEFAULT 'VNPT Nam Sài Gòn'");
  await ensureColumn("system_settings", "smtp_from_email", "TEXT DEFAULT ''");

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_settings (
      id TEXT PRIMARY KEY,
      enabled BOOLEAN DEFAULT FALSE,
      run_time TEXT DEFAULT '08:00',
      days_before TEXT DEFAULT '[30,7,1]',
      notify_staff BOOLEAN DEFAULT TRUE,
      notify_customer BOOLEAN DEFAULT FALSE,
      extra_cc TEXT DEFAULT '',
      last_run_date TEXT,
      updated_at TEXT
    )
  `);
  await ensureColumn("reminder_settings", "email_subject_template", "TEXT");
  await ensureColumn("reminder_settings", "email_body_template", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_group_templates (
      service_group TEXT PRIMARY KEY,
      email_subject_template TEXT,
      email_body_template TEXT,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      item_id TEXT NOT NULL,
      days_before INTEGER NOT NULL,
      recipients TEXT,
      status TEXT NOT NULL,
      error TEXT,
      sent_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_reminder_logs_once
    ON reminder_logs(source, item_id, days_before)
    WHERE status = 'sent'
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_name TEXT,
      days_before TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      imported_by TEXT,
      imported_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      title TEXT,
      customer_name TEXT,
      subscriber_code TEXT,
      expiry_date TEXT NOT NULL,
      recipient_email TEXT,
      staff_name TEXT,
      extra TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS kpi_formulas (
      kpi_key TEXT PRIMARY KEY,
      segments TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS kpi_targets (
      id TEXT PRIMARY KEY,
      staff_name TEXT NOT NULL,
      month TEXT NOT NULL,
      kpi_key TEXT NOT NULL,
      target_rate REAL NOT NULL,
      updated_by TEXT,
      updated_at TEXT
    )
  `);
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_kpi_targets_staff_month_key ON kpi_targets(staff_name, month, kpi_key)`
  );

  await run(`
    CREATE TABLE IF NOT EXISTS payment_request_exports (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      doc_number TEXT NOT NULL,
      exported_by TEXT,
      exported_at TEXT
    )
  `);
  await ensureColumn("payment_request_exports", "eo_number", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS quote_exports (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      doc_number TEXT NOT NULL,
      service_type TEXT,
      package_name TEXT,
      unit TEXT,
      quantity REAL,
      unit_price REAL,
      vat_percent REAL,
      note TEXT,
      staff_name TEXT,
      exported_by TEXT,
      exported_at TEXT
    )
  `);
  await run("CREATE INDEX IF NOT EXISTS ix_quote_exports_customer ON quote_exports(customer_id)");
  await ensureColumn("quote_exports", "eo_number", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS custom_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS custom_list_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES custom_lists(id),
      value TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      UNIQUE (list_id, value)
    )
  `);
  await run("CREATE INDEX IF NOT EXISTS ix_custom_list_items_list ON custom_list_items(list_id)");
  // Đơn giá (chưa VAT) — chỉ dùng cho danh mục kiểu bảng giá (vd Gói dịch vụ Internet/Fiber
  // dùng để chọn nhanh khi lập Báo giá), null với các danh mục khác (vd Kênh bán).
  await ensureColumn("custom_list_items", "price", "REAL");

  // Sổ văn bản - Tờ trình: nội dung soạn ngoài CRM, hệ thống chỉ đăng ký/cấp số
  // thủ công (nhập tay) để tránh trùng số trong năm.
  await run(`
    CREATE TABLE IF NOT EXISTS memo_registry (
      id TEXT PRIMARY KEY,
      year TEXT NOT NULL,
      doc_number TEXT NOT NULL,
      note TEXT,
      registered_by TEXT,
      registered_at TEXT,
      UNIQUE (year, doc_number)
    )
  `);

  // Lưu ngày chạy gần nhất của job tự động xóa công nợ/gia hạn quá 1 năm lưu
  // trữ (data-retention) — 1 dòng duy nhất (id = 'default'), tránh chạy lại
  // nhiều lần trong cùng 1 ngày.
  await run(`
    CREATE TABLE IF NOT EXISTS retention_state (
      id TEXT PRIMARY KEY,
      last_run_date TEXT,
      last_deleted_debts INTEGER DEFAULT 0,
      last_deleted_renewals INTEGER DEFAULT 0
    )
  `);

  // Admin đổi tên hiển thị của mẫu hợp đồng (7 mẫu cố định) — chỉ lưu phần
  // ghi đè, danh sách key/file gốc vẫn định nghĩa tĩnh trong contract-templates.ts.
  await run(`
    CREATE TABLE IF NOT EXISTS contract_template_overrides (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  await applyContractQuickEditSchema();

  await ensureColumn("services", "customer_id", "TEXT");
  await ensureColumn("services", "service_group", "TEXT");
  await ensureColumn("services", "package_name", "TEXT");
  await ensureColumn("services", "payment_type", "TEXT");
  await ensureColumn("services", "contract_id", "TEXT");
  await run("CREATE INDEX IF NOT EXISTS ix_services_contract_id ON services(contract_id)");

  // Bảng đánh dấu migration một-lần, do file này sở hữu. Dùng để tránh
  // backfillRelations() chạy lại mỗi lần khởi động server và điền lại giá trị
  // territory_id mà admin đã chủ động gỡ (PATCH /leads/:id/assignment với
  // territoryId: null).
  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations_state (
      key TEXT PRIMARY KEY,
      applied_at TEXT
    )
  `);

  await runMigrationOnce("lead_group_rename_v1", async () => {
    for (const [oldName, newName] of Object.entries(LEAD_GROUP_RENAMES)) {
      await run("UPDATE leads SET group_name = ? WHERE group_name = ?", [newName, oldName]);
    }
  });

  // Dữ liệu hoa hồng cũ (seed COM-01..04) không có contract_id, chỉ "mồ côi"
  // join tạm qua transaction_code -> gắn lại contract_id thật 1 lần duy nhất.
  // Dòng nào không khớp đúng 1 đơn hàng thì ghi vào audit_logs để Admin tự xử lý tay.
  await runMigrationOnce("commission_relink_orphans_v1", async () => {
    await relinkOrphanCommissions();
  });

  // Danh mục tùy biến "Gói dịch vụ Internet/Fiber" (đơn giá chưa VAT) — dữ
  // liệu khởi tạo lấy từ bảng giá Internet thật khách gửi, dùng để chọn nhanh
  // khi lập Báo giá thay vì gõ tay. Chỉ tạo 1 lần; Admin có thể sửa/xóa sau đó
  // qua /admin/custom-lists, migration không tự chạy lại ghi đè.
  await runMigrationOnce("quote_service_catalog_internet_fiber_v1", async () => {
    const existing = await query<{ id: string }>("SELECT id FROM custom_lists WHERE name = ?", [
      "Gói dịch vụ Internet/Fiber",
    ]);
    if (existing.length) return;

    const listId = `CLIST-SEED-${Date.now()}`;
    await run("INSERT INTO custom_lists (id, name, created_at) VALUES (?, ?, ?)", [
      listId,
      "Gói dịch vụ Internet/Fiber",
      new Date().toISOString(),
    ]);

    const packages: [string, number][] = [
      ["Fiber Xtra 2", 500000],
      ["Fiber Xtra 3", 1600000],
      ["Fiber Xtra 4", 5000000],
      ["Fiber Xtra 5", 8000000],
      ["Fiber Xtra 6", 15000000],
      ["Fiber Eco 1", 320000],
      ["Fiber Eco 2", 380000],
      ["Fiber Eco 3", 780000],
      ["Fiber Eco 4", 1000000],
      ["Fiber 4", 2000000],
      ["Fiber Eco 5", 3200000],
      ["Fiber 5", 5000000],
      ["Fiber S1", 380000],
      ["Fiber S2", 600000],
      ["Fiber S3", 740000],
      ["Fiber 6", 9000000],
      ["Fiber Vip 6", 12000000],
      ["Fiber 7", 16000000],
      ["Fiber Vip 7", 20000000],
      ["Fiber 8", 25000000],
      ["Fiber Vip 8", 30000000],
      ["Fiber Vip 9", 55000000],
    ];
    for (let i = 0; i < packages.length; i++) {
      const [name, price] = packages[i];
      await run(
        `INSERT INTO custom_list_items (id, list_id, value, active, sort_order, created_at, price)
         VALUES (?, ?, ?, TRUE, ?, ?, ?)`,
        [`CLITEM-SEED-${Date.now()}-${i}`, listId, name, i + 1, new Date().toISOString(), price]
      );
    }
  });

  await applyLeadChannelSchema();
  await applyReminderEmailSchema();
  await applyT6Schema();
  await applyT8Schema();
  await applyT10Schema();
}

/**
 * Gắn lại contract_id cho các dòng hoa hồng "mồ côi" (contract_id NULL) bằng
 * cách khớp transaction_code với đúng 1 đơn hàng. Dòng nào không khớp đúng 1
 * đơn (0 hoặc nhiều hơn 1) thì bỏ qua, không đoán — ghi vào audit_logs để
 * Admin tự xử lý tay. Export riêng (không chỉ gọi qua runMigrationOnce) để
 * test trực tiếp được, không phụ thuộc trạng thái "đã chạy 1 lần".
 */
export async function relinkOrphanCommissions(): Promise<{ relinked: number; unmatchedCount: number }> {
  const orphans = await query<{ id: string; transaction_code: string; recipient_name: string }>(
    "SELECT id, transaction_code, recipient_name FROM commissions WHERE contract_id IS NULL"
  );

  let relinked = 0;
  const unmatched: string[] = [];
  for (const row of orphans) {
    const matches = await query<{ id: string }>(
      "SELECT id FROM contracts WHERE transaction_code = ?",
      [row.transaction_code]
    );
    if (matches.length === 1) {
      await run("UPDATE commissions SET contract_id = ? WHERE id = ?", [matches[0].id, row.id]);
      relinked += 1;
    } else {
      unmatched.push(`${row.id} (${row.recipient_name}, mã GD: ${row.transaction_code})`);
    }
  }

  if (relinked > 0 || unmatched.length > 0) {
    await run(
      'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
      [
        `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        "Hệ thống (migration)",
        "Gắn lại hoa hồng mồ côi theo mã giao dịch",
        `Đã gắn lại ${relinked} dòng hoa hồng vào đúng đơn hàng.` +
          (unmatched.length
            ? ` Còn ${unmatched.length} dòng không tự gắn được (không khớp đúng 1 đơn hàng), cần xử lý tay: ${unmatched.join("; ")}`
            : ""),
      ]
    );
  }

  return { relinked, unmatchedCount: unmatched.length };
}

const TERRITORY_BACKFILL_KEY = "territory_backfill_v1";

async function isMigrationApplied(key: string): Promise<boolean> {
  const rows = await query<{ key: string }>(
    "SELECT key FROM schema_migrations_state WHERE key = ?",
    [key]
  );
  return rows.length > 0;
}

async function markMigrationApplied(key: string): Promise<void> {
  await run("INSERT INTO schema_migrations_state (key, applied_at) VALUES (?, ?)", [
    key,
    new Date().toISOString(),
  ]);
}

/**
 * Chạy một hàm migration duy nhất một lần dựa trên key.
 * Trả về true nếu lần này có chạy fn, false nếu key đã được áp dụng trước đó.
 * Chỉ đánh dấu thành công nếu fn chạy không ném lỗi.
 */
export async function runMigrationOnce(
  key: string,
  fn: () => Promise<void>
): Promise<boolean> {
  if (await isMigrationApplied(key)) {
    return false;
  }
  await fn();
  await markMigrationApplied(key);
  return true;
}

// Chạy sau seed: chỉ điền các giá trị còn NULL, không ghi đè dữ liệu đã gán tay.
// Chỉ chạy MỘT LẦN (đánh dấu bằng schema_migrations_state) để một giá trị
// NULL mà admin chủ động gán (gỡ phường) không bị điền lại ở lần khởi động
// server sau.
export async function backfillRelations(): Promise<void> {
  await runMigrationOnce(TERRITORY_BACKFILL_KEY, async () => {
    await run(`
      UPDATE leads
      SET territory_id = (
        SELECT t.id
        FROM staff s
        JOIN territories t ON t.ward_name = s.territory
        WHERE s.name = leads.staff_name
        LIMIT 1
      )
      WHERE territory_id IS NULL
    `);

    await run(`
      UPDATE contracts
      SET territory_id = (
        SELECT l.territory_id
        FROM leads l
        WHERE l.customer_name = contracts.customer_name
          AND l.territory_id IS NOT NULL
        ORDER BY l.id
        LIMIT 1
      )
      WHERE territory_id IS NULL
    `);
  });

  await runMigrationOnce("contracts_am_staff_backfill_v1", async () => {
    await run(`
      UPDATE contracts
      SET am_staff = (
        SELECT l.staff_name
        FROM leads l
        WHERE l.id = contracts.lead_id
        LIMIT 1
      )
      WHERE lead_id IS NOT NULL AND am_staff IS NULL
    `);
  });

  await runMigrationOnce("contract_payments_backfill_v1", async () => {
    const paidContracts = await query<{
      id: string;
      total_value: number;
      updated_at: string;
      created_at: string;
    }>(
      `SELECT c.id, c.total_value, c.updated_at, c.created_at
       FROM contracts c
       LEFT JOIN contract_payments p ON p.contract_id = c.id
       WHERE c.payment_status = 'Đã thanh toán' AND p.id IS NULL`
    );

    for (const c of paidContracts) {
      const paymentId = `PAY-BF-${c.id}`;
      const rawDate: any = c.updated_at || c.created_at || new Date().toISOString();
      const dateStr = (rawDate instanceof Date ? rawDate.toISOString() : String(rawDate)).slice(0, 10);
      const nowStr = new Date().toISOString();
      await run(
        `INSERT INTO contract_payments (id, contract_id, amount, paid_date, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, c.id, c.total_value, dateStr, "Backfill thanh toán tự động", "System Backfill", nowStr]
      );
      await run("UPDATE contracts SET collected_amount = ? WHERE id = ?", [c.total_value, c.id]);
    }
  });

  // Dịch vụ cũ (seed) chỉ có customer_name, không có customer_id. Chỉ gán khi
  // ĐÚNG 1 khách có name trùng khớp chính xác — tên trùng 0 hoặc >1 khách thì
  // để NULL, không gán bừa (Review Focus #5, dot-07.md).
  await runMigrationOnce("services_customer_id_backfill_v1", backfillServiceCustomerIds);

  // Đơn hàng cũ chưa có dịch vụ: sinh "Dịch vụ - Mã thuê bao" cho đơn đã có khách.
  await runMigrationOnce("services_from_contracts_v1", backfillServicesFromContracts);

  // T8 (STT 10): tách mỗi đơn cũ (chưa có contract_items) thành các dòng
  // contract_items theo subscriber_codes hiện có, đánh dấu legacy = TRUE.
  await runMigrationOnce("contract_items_from_legacy_v1", backfillContractItemsFromLegacy);

  // Dữ liệu nợ cước cũ bị nhập/import với nhiều định dạng tháng khác nhau
  // (vd "11/2026" thay vì "2026-11") khiến bảng công nợ bị tách nhóm theo
  // tháng sai. Chuẩn hóa về đúng YYYY-MM 1 lần duy nhất; import mới đã được
  // chặn validate ở DebtService.importExcel().
  await runMigrationOnce("debts_month_format_normalize_v1", async () => {
    const rows = await query<{ id: string; month: string }>(
      "SELECT id, month FROM debts WHERE month !~ '^\\d{4}-\\d{2}$'"
    );
    for (const row of rows) {
      const slashMatch = /^(\d{1,2})\/(\d{4})$/.exec((row.month || "").trim());
      if (slashMatch) {
        const normalized = `${slashMatch[2]}-${slashMatch[1].padStart(2, "0")}`;
        await run("UPDATE debts SET month = ? WHERE id = ?", [normalized, row.id]);
      }
    }
  });
}

/**
 * Logic thật của migration một-lần `services_from_contracts_v1`, tách riêng để
 * test gọi lại được. Idempotent: đồng bộ theo `contract_id` / (khách + mã thuê bao)
 * nên chạy lại không tạo trùng. Đơn chưa có khách hoặc không có mã thuê bao bị bỏ qua.
 */
export async function backfillServicesFromContracts(): Promise<void> {
  const contracts = await query<{ id: string }>(
    `SELECT id FROM contracts
     WHERE customer_id IS NOT NULL AND customer_id <> ''
       AND subscriber_codes IS NOT NULL AND subscriber_codes NOT IN ('', '[]')
     ORDER BY created_at ASC, id ASC`
  );
  for (const c of contracts) {
    await syncServicesFromContract(c.id);
  }
}

/**
 * Logic thật của migration một-lần `services_customer_id_backfill_v1`, tách
 * riêng (không gói trong `runMigrationOnce`) để test gọi lại được nhiều lần
 * mà không bị khoá bởi `schema_migrations_state` (migration đã tự chạy một
 * lần khi `initDatabase()` khởi động, trước khi test tạo thêm dữ liệu).
 */
export async function backfillServiceCustomerIds(): Promise<void> {
  await run(`
    UPDATE services s
    SET customer_id = (
      SELECT c.id FROM customers c WHERE c.name = s.customer_name
    )
    WHERE s.customer_id IS NULL
      AND (SELECT COUNT(*) FROM customers c2 WHERE c2.name = s.customer_name) = 1
  `);
}

function parseLegacySubscriberCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const code = String(item ?? "").trim();
    if (code) seen.add(code);
  }
  return Array.from(seen);
}

/**
 * Logic thật của migration một-lần `contract_items_from_legacy_v1` (T8, STT 10),
 * tách riêng để test gọi lại được nhiều lần mà không nhân đôi dữ liệu: mỗi đơn
 * được kiểm tra riêng (bỏ qua nếu đã có contract_items), nên an toàn khi gọi
 * lại nhiều lần (không phụ thuộc vào cờ `schema_migrations_state`).
 *
 * Mỗi đơn cũ có N mã thuê bao -> tạo N dòng `service`, chia đều `total_value`
 * (phần dư cộng vào dòng đầu). Đơn không có mã (subscriber_codes = "[]") ->
 * 1 dòng `service` không mã, CHỈ dùng cho dữ liệu migrate (`legacy = TRUE`),
 * ghi chú "Tách tự động từ đơn cũ".
 */
export async function backfillContractItemsFromLegacy(): Promise<void> {
  const contracts = await query<{
    id: string;
    subscriber_codes: string | null;
    total_value: number | string | null;
    service_group: string | null;
    service_name: string | null;
    package_name: string | null;
    term_months: number | null;
  }>(
    `SELECT c.id, c.subscriber_codes, c.total_value, c.service_group, c.service_name,
            c.package_name, c.term_months
     FROM contracts c
     WHERE NOT EXISTS (SELECT 1 FROM contract_items ci WHERE ci.contract_id = c.id)`
  );

  for (const c of contracts) {
    const codes = parseLegacySubscriberCodes(c.subscriber_codes);
    const total = Math.round(Number(c.total_value) || 0);
    const nowIso = new Date().toISOString();
    const note = "Tách tự động từ đơn cũ";

    const rows =
      codes.length === 0
        ? [{ subscriberCode: null as string | null, unitPrice: total }]
        : codes.map((code, idx) => {
            const n = codes.length;
            const base = Math.floor(total / n);
            const remainder = total - base * n;
            return { subscriberCode: code, unitPrice: base + (idx === 0 ? remainder : 0) };
          });

    let lineNo = 1;
    for (const row of rows) {
      const id = `CI-LEG-${c.id}-${lineNo}`;
      await run(
        `INSERT INTO contract_items (
          id, contract_id, line_no, line_type, service_group, service_name, package_name,
          subscriber_code, quantity, unit_price, amount, term_months, start_date, note, legacy, created_at
        ) VALUES (?, ?, ?, 'service', ?, ?, ?, ?, 1, ?, ?, ?, NULL, ?, TRUE, ?)`,
        [
          id,
          c.id,
          lineNo,
          c.service_group ?? null,
          c.service_name ?? null,
          c.package_name ?? null,
          row.subscriberCode,
          row.unitPrice,
          row.unitPrice,
          c.term_months ?? null,
          note,
          nowIso,
        ]
      );
      lineNo++;
    }
  }
}
