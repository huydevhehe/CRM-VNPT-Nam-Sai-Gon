import { apiFetch } from "./client";

export interface RetentionWarningItem {
  type: "debt" | "renewal";
  id: string;
  label: string;
  createdAt: string;
  daysUntilDeletion: number;
}

/** Danh sách bản ghi nợ/gia hạn sắp bị tự động xóa trong 30 ngày tới (quá 1 năm lưu trữ). */
export function getRetentionWarnings(): Promise<RetentionWarningItem[]> {
  return apiFetch<RetentionWarningItem[]>("/data-retention/warnings");
}
