/**
 * T10 (STT 11) — bộ mẫu hợp đồng cố định theo sheet "Hợp đồng" của khách. Mỗi
 * Mã giao dịch phải gắn đúng 1 mẫu trong danh sách này. 3 mẫu CHƯA có file
 * docx mẫu (Fiber Mẫu 05, BHXH, Chữ ký số + BHXH) -> `available: false`, FE
 * hiển thị "Chưa có mẫu" và vô hiệu hóa nút xuất, KHÔNG tự bịa nội dung.
 * "Đề nghị thanh toán" là văn bản riêng (đã có ở T2), KHÔNG nằm trong danh
 * sách này.
 */
export interface ContractTemplateDef {
  key: string;
  label: string;
  available: boolean;
  /** Đường dẫn tương đối trong backend/templates/contracts, chỉ có khi available. */
  file?: string;
  /** Mẫu có bảng "Dịch vụ/Số lượng/Đơn giá/Thành tiền" lặp theo dòng (STT 10) hay không. */
  supportsItemsTable?: boolean;
}

export const CONTRACT_TEMPLATES: readonly ContractTemplateDef[] = [
  { key: "fiber_mau_05", label: "Fiber (Mẫu 05)", available: false },
  { key: "bhxh", label: "BHXH", available: false },
  { key: "cks_bhxh", label: "Chữ ký số + BHXH", available: false },
  {
    key: "cks_smartca_cn_dn",
    label: "CKS SmartCA CN thuộc DN",
    available: true,
    file: "cks-smartca-cn-thuoc-dn.docx",
    supportsItemsTable: false,
  },
  {
    key: "cks_token_smartca_dn",
    label: "Chữ ký số TOKEN, SMARTCA DN",
    available: true,
    file: "cks-token-smartca-dn.docx",
    supportsItemsTable: false,
  },
  {
    key: "hoa_don_dien_tu",
    label: "Hóa đơn điện tử",
    available: true,
    file: "hoa-don-dien-tu.docx",
    supportsItemsTable: true,
  },
  {
    key: "combo_hoa_don_cks",
    label: "Combo (Hóa đơn + CKS)",
    available: true,
    file: "combo-hoa-don-cks.docx",
    supportsItemsTable: false,
  },
] as const;

export const CONTRACT_TEMPLATE_KEYS = CONTRACT_TEMPLATES.map((t) => t.key);

export function findContractTemplate(key: string | null | undefined): ContractTemplateDef | undefined {
  if (!key) return undefined;
  return CONTRACT_TEMPLATES.find((t) => t.key === key);
}

export const CONTRACT_TEMPLATE_REQUIRED_MESSAGE = "Vui lòng chọn mẫu hợp đồng";
export const CONTRACT_TEMPLATE_INVALID_MESSAGE = "Mẫu hợp đồng không hợp lệ";
export const CONTRACT_TEMPLATE_REQUIRED_BEFORE_COMPLETE_MESSAGE =
  "Đơn chưa có mẫu hợp đồng. Vui lòng chọn mẫu hợp đồng trước khi chuyển sang Hoàn tất";
