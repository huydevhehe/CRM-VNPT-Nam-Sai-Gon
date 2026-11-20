import { ensureColumn } from "../schema-extensions.js";
import { run } from "../db.js";

/**
 * Schema bổ sung cho T8 (đơn hàng nhiều dòng dịch vụ/thiết bị — STT 10):
 * - `contract_items`: mỗi dòng của một đơn hàng (`contract_id`). `line_type`
 *   'service' luôn có `subscriber_code` (trừ dòng được tách tự động từ dữ liệu
 *   cũ, đánh dấu `legacy = TRUE`); 'device' (vd TOKEN) không có mã thuê bao.
 *   `amount` luôn do server tính = quantity * unit_price.
 * - Các cột tóm tắt cũ trên `contracts` (subscriber_codes, service_name,
 *   package_name, total_value) được GIỮ NGUYÊN, chỉ được coi là bản tóm tắt
 *   suy ra từ `contract_items` để báo cáo/dashboard/KPI/hoa hồng/đề nghị
 *   thanh toán đang đọc trực tiếp các cột đó không bị vỡ (không cần sửa).
 */
export async function applyT8Schema(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS contract_items (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      line_no INTEGER NOT NULL DEFAULT 1,
      line_type TEXT NOT NULL,
      service_group TEXT,
      service_name TEXT,
      package_name TEXT,
      subscriber_code TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      term_months INTEGER,
      start_date TEXT,
      note TEXT,
      legacy BOOLEAN DEFAULT FALSE,
      created_at TEXT
    )
  `);
  await run("CREATE INDEX IF NOT EXISTS ix_contract_items_contract_id ON contract_items(contract_id)");
  // Mã thuê bao không được trùng trong cùng một đơn (chỉ áp dụng cho dòng dịch vụ có mã).
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_contract_items_contract_subscriber
    ON contract_items(contract_id, subscriber_code)
    WHERE line_type = 'service' AND subscriber_code IS NOT NULL AND subscriber_code <> ''
  `);

  // services sinh từ một dòng cụ thể của đơn (để xóa dòng -> xóa đúng dịch vụ tương ứng).
  await ensureColumn("services", "contract_item_id", "TEXT");
}
