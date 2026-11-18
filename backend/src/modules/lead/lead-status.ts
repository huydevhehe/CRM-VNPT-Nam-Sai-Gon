export const LEAD_STATUSES = [
  "Mới tiếp nhận",
  "Đã liên hệ",
  "Đang tư vấn",
  "Chốt thành công",
  "Thất bại",
] as const;

export type LeadStatusName = (typeof LEAD_STATUSES)[number];

/** Thứ hạng bước: hai trạng thái cuối (Chốt thành công / Thất bại) ngang hàng. */
const LEAD_STATUS_RANK: Record<string, number> = {
  "Mới tiếp nhận": 0,
  "Đã liên hệ": 1,
  "Đang tư vấn": 2,
  "Chốt thành công": 3,
  "Thất bại": 3,
};

export const BACKWARD_BLOCKED_MESSAGE = "Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt.";

export function isLeadStatus(value: unknown): value is LeadStatusName {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/**
 * Lùi bước = đổi sang thứ hạng thấp hơn hoặc bằng nhưng khác trạng thái hiện tại
 * (kể cả từ trạng thái cuối về bất kỳ bước nào, hoặc đổi qua lại giữa hai trạng thái cuối).
 * Trạng thái cũ không nằm trong danh sách (dữ liệu lạ) coi như thứ hạng -1: đi đâu cũng là tiến.
 */
export function isBackwardMove(from: string, to: string): boolean {
  if (from === to) {
    return false;
  }
  const fromRank = LEAD_STATUS_RANK[from] ?? -1;
  const toRank = LEAD_STATUS_RANK[to] ?? -1;
  return toRank <= fromRank;
}
