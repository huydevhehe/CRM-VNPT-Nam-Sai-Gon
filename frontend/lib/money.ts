/**
 * Định dạng tiền Việt Nam: dấu chấm (.) ngăn cách hàng nghìn, triệu... (vd 1.234.567).
 * Dùng chung cho hiển thị và ô nhập tiền.
 */

const MAX_MONEY_DIGITS = 13;

/** Chỉ giữ các chữ số của chuỗi (bỏ dấu chấm, phẩy, khoảng trắng, ký hiệu tiền). */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Chuẩn hóa chuỗi số nhập tay: chỉ chữ số, bỏ số 0 đứng đầu, tối đa 13 chữ số. */
export function normalizeMoneyDigits(raw: string): string {
  const digits = digitsOnly(raw).slice(0, MAX_MONEY_DIGITS);
  return digits.replace(/^0+(?=\d)/, "");
}

/** "5940000" -> "5.940.000"; chuỗi rỗng giữ nguyên rỗng. */
export function groupDigits(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Số -> "1.234.567" (làm tròn về số nguyên). Giá trị không hợp lệ -> "0". */
export function formatNumberVi(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n);
  const grouped = groupDigits(String(Math.abs(rounded)));
  return rounded < 0 ? `-${grouped}` : grouped;
}

/** Số -> "1.234.567 ₫". */
export function formatMoney(value: number | string | null | undefined): string {
  return `${formatNumberVi(value)} ₫`;
}

/** Chuỗi ô nhập tiền ("5.940.000" hoặc "5940000") -> số nguyên; rỗng -> null. */
export function parseMoneyInput(raw: string): number | null {
  const digits = normalizeMoneyDigits(raw);
  return digits ? Number(digits) : null;
}
