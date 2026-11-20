import type { LeadStatus } from "@/lib/crm/types/crm.types";

export const LEAD_STATUSES: LeadStatus[] = [
  "Mới tiếp nhận",
  "Đã liên hệ",
  "Đang tư vấn",
  "Chốt thành công",
  "Thất bại",
];

/** Thứ hạng bước (khớp backend): hai trạng thái cuối ngang hàng. */
const LEAD_STATUS_RANK: Record<LeadStatus, number> = {
  "Mới tiếp nhận": 0,
  "Đã liên hệ": 1,
  "Đang tư vấn": 2,
  "Chốt thành công": 3,
  "Thất bại": 3,
};

/** Lùi bước = sang thứ hạng thấp hơn hoặc bằng (khác trạng thái hiện tại). Nhân viên phải xin Admin duyệt. */
export function isBackwardMove(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  return (LEAD_STATUS_RANK[to] ?? -1) <= (LEAD_STATUS_RANK[from] ?? -1);
}
