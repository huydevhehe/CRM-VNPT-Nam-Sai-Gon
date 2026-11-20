import { run } from "../db.js";

/**
 * Schema cho nhắc hết hạn Email (chỉ thêm, chạy lặp lại không lỗi):
 * - `reminder_settings.email_body_format` / `reminder_group_templates.email_body_format`:
 *   NULL hoặc 'text' = mẫu cũ dạng văn bản thuần (hiển thị đổi xuống dòng → <br>), 'html' = đã lưu HTML.
 * - Chữ ký email: `reminder_settings.signature_enabled`, `signature_html`.
 * - Bảng `reminder_group_settings`: cấu hình nhắc riêng theo nhóm dịch vụ
 *   (có dòng = dùng ngày của nhóm, không có = theo cấu hình chung; `channels` chừa chỗ cho kênh khác).
 */
export async function applyReminderEmailSchema(): Promise<void> {
  await run("ALTER TABLE reminder_settings ADD COLUMN IF NOT EXISTS email_body_format TEXT");
  await run("ALTER TABLE reminder_settings ADD COLUMN IF NOT EXISTS signature_enabled BOOLEAN DEFAULT FALSE");
  await run("ALTER TABLE reminder_settings ADD COLUMN IF NOT EXISTS signature_html TEXT");
  await run("ALTER TABLE reminder_group_templates ADD COLUMN IF NOT EXISTS email_body_format TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS reminder_group_settings (
      service_group TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      days_before TEXT NOT NULL,
      channels TEXT NOT NULL DEFAULT '["email"]',
      updated_at TEXT
    )
  `);
}
