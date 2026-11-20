import { ensureColumn } from "../schema-extensions.js";
import { run } from "../db.js";

/**
 * Schema bổ sung cho T6 (chỉ thêm, chạy lặp lại không lỗi):
 * - `contracts.channel_source_id` / `customers.channel_source_id`: chi tiết kênh
 *   (dùng chung cơ chế `validateChannelDetail` với Lead — xem channel-source.service.ts).
 * - `services.invoice_portal_*`: thông tin đăng nhập hệ thống Hóa đơn điện tử
 *   (mật khẩu luôn lưu dạng mã hóa, không bao giờ plaintext).
 * - `invoice_credential_audit_logs`: nhật ký ai xem mật khẩu hóa đơn (reveal).
 */
export async function applyT6Schema(): Promise<void> {
  await ensureColumn("contracts", "channel_source_id", "TEXT");
  await ensureColumn("customers", "channel_source_id", "TEXT");

  await ensureColumn("services", "invoice_portal_url", "TEXT");
  await ensureColumn("services", "invoice_portal_username", "TEXT");
  // Mật khẩu mã hóa (AES-256-GCM, base64 "iv:tag:ciphertext"); KHÔNG BAO GIỜ lưu plaintext.
  await ensureColumn("services", "invoice_portal_password_enc", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS invoice_credential_audit_logs (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      created_at TEXT
    )
  `);
}
