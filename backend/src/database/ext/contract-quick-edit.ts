import { run } from "../db.js";

/**
 * Cột/bảng bổ sung cho đợt "Đơn hàng: sửa nhanh + xuất đề nghị thanh toán".
 * Chỉ thêm (additive), chạy lặp lại không lỗi.
 */
export async function applyContractQuickEditSchema(): Promise<void> {
  // Số tháng trả trước (3, 6, 12, 18, 24) khi hình thức thanh toán là "Trả trước".
  await run("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS prepaid_months INTEGER");

  // Tra cứu nhanh số văn bản theo đơn (xem lại số đã cấp) và theo số (chống trùng).
  await run(
    "CREATE INDEX IF NOT EXISTS ix_payment_request_exports_contract ON payment_request_exports(contract_id)"
  );
}
