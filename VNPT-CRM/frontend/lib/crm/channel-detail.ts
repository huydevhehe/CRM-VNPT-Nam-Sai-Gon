/** Kênh phát triển cần chọn thêm "Chi tiết kênh" và loại danh mục tương ứng. */
export const CHANNEL_DETAIL_KIND: Record<string, "online" | "partner" | "ctv"> = {
  Online: "online",
  "Đối tác": "partner",
  "CTV giới thiệu": "ctv",
};

export interface ChannelDetailValue {
  /** Id nguồn Online / đối tác trong danh mục kênh ("" = chưa chọn). */
  channelSourceId: string;
  /** Id cộng tác viên giới thiệu ("" = chưa chọn). */
  referredByCtvId: string;
}

export const EMPTY_CHANNEL_DETAIL: ChannelDetailValue = { channelSourceId: "", referredByCtvId: "" };

export function channelNeedsDetail(channel: string): boolean {
  return channel in CHANNEL_DETAIL_KIND;
}

const CTV_SHORT_LABEL = "CTV";

/**
 * Chuỗi hiển thị "Chi tiết kênh": `Online › Zalo Ads`, `Đối tác › ABC`, `CTV › Nguyễn Văn A`.
 * Trả "—" khi kênh cần chi tiết nhưng dữ liệu cũ chưa có; kênh không có chi tiết trả tên kênh.
 */
export function formatChannelDetail(
  channel: string,
  sourceName?: string | null,
  ctvName?: string | null
): string {
  const kind = CHANNEL_DETAIL_KIND[channel];
  if (kind === "ctv") {
    return ctvName ? `${CTV_SHORT_LABEL} › ${ctvName}` : "—";
  }
  if (kind) {
    return sourceName ? `${channel} › ${sourceName}` : "—";
  }
  return "—";
}
