/**
 * T10 (STT 11) — bộ mẫu hợp đồng cố định theo sheet "Hợp đồng" của khách. Mỗi
 * Mã giao dịch phải gắn đúng 1 mẫu trong danh sách này. "Đề nghị thanh toán"
 * là văn bản riêng (đã có ở T2), KHÔNG nằm trong danh sách này.
 *
 * Mỗi mẫu luôn có `file` cố định (kể cả 3 mẫu ban đầu chưa có file thật) —
 * Admin upload file mẫu qua `/admin/system-settings` (xem
 * `contract-template-registry.service.ts`) sẽ ghi đè đúng file này; tên hiển
 * thị (`label`) mặc định ở đây cũng có thể bị Admin đổi tên, xem registry.
 */
export interface ContractTemplateBaseDef {
  key: string;
  label: string;
  /** Đường dẫn tương đối trong backend/templates/contracts. */
  file: string;
  /** Mẫu có bảng "Dịch vụ/Số lượng/Đơn giá/Thành tiền" lặp theo dòng (STT 10) hay không. */
  supportsItemsTable?: boolean;
  /** true nếu file .docx viết biến dạng `${ten}` (có dấu $, theo đúng sheet biến
   * ID khách đưa) thay vì `{Ten}` như 4 mẫu cũ — quyết định delimiter khi render. */
  dollarDelimiters?: boolean;
}

export const CONTRACT_TEMPLATE_DEFS: readonly ContractTemplateBaseDef[] = [
  {
    key: "fiber_mau_05",
    label: "Fiber (Mẫu 05)",
    file: "fiber-mau-05.docx",
    supportsItemsTable: false,
    dollarDelimiters: true,
  },
  {
    key: "brcd_mau_06",
    label: "Mẫu 06 (BRCĐ trả hàng tháng, ngắn hạn)",
    file: "brcd-mau-06.docx",
    supportsItemsTable: false,
    dollarDelimiters: true,
  },
  { key: "bhxh", label: "BHXH", file: "bhxh.docx", supportsItemsTable: false },
  { key: "cks_bhxh", label: "Chữ ký số + BHXH", file: "cks-bhxh.docx", supportsItemsTable: false },
  {
    key: "cks_smartca_cn_dn",
    label: "CKS SmartCA CN thuộc DN",
    file: "cks-smartca-cn-thuoc-dn.docx",
    supportsItemsTable: false,
  },
  {
    key: "cks_token_smartca_dn",
    label: "Chữ ký số TOKEN, SMARTCA DN",
    file: "cks-token-smartca-dn.docx",
    supportsItemsTable: false,
  },
  {
    key: "hoa_don_dien_tu",
    label: "Hóa đơn điện tử",
    file: "hoa-don-dien-tu.docx",
    supportsItemsTable: true,
  },
  {
    key: "combo_hoa_don_cks",
    label: "Combo (Hóa đơn + CKS)",
    file: "combo-hoa-don-cks.docx",
    supportsItemsTable: false,
  },
] as const;

export const CONTRACT_TEMPLATE_KEYS = CONTRACT_TEMPLATE_DEFS.map((t) => t.key);

/** Tra cứu định nghĩa TĨNH (key/label mặc định/file/supportsItemsTable) — dùng
 * để kiểm tra 1 key có hợp lệ hay không. Không phản ánh tên đã đổi hay file
 * đã upload — dùng `ContractTemplateRegistryService` cho việc đó. */
export function findContractTemplate(key: string | null | undefined): ContractTemplateBaseDef | undefined {
  if (!key) return undefined;
  return CONTRACT_TEMPLATE_DEFS.find((t) => t.key === key);
}

export const CONTRACT_TEMPLATE_REQUIRED_MESSAGE = "Vui lòng chọn mẫu hợp đồng";
export const CONTRACT_TEMPLATE_INVALID_MESSAGE = "Mẫu hợp đồng không hợp lệ";
export const CONTRACT_TEMPLATE_REQUIRED_BEFORE_COMPLETE_MESSAGE =
  "Đơn chưa có mẫu hợp đồng. Vui lòng chọn mẫu hợp đồng trước khi chuyển sang Hoàn tất";
