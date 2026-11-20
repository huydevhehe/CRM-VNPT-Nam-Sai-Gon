import { ensureColumn } from "../schema-extensions.js";

/**
 * Schema bổ sung cho T10 (STT 11 — hợp đồng bắt buộc theo bộ mẫu + xóa đơn hàng):
 * - `contracts.contract_template`: khóa mẫu hợp đồng (xem `contract-templates.ts`).
 *   Nullable cho đơn cũ (đọc/sửa bình thường); service tầng trên bắt buộc khi
 *   tạo đơn mới hoặc khi chuyển "Hoàn tất".
 */
export async function applyT10Schema(): Promise<void> {
  await ensureColumn("contracts", "contract_template", "TEXT");
}
