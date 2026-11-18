import { apiFetch, apiFetchRaw } from "./client";

export interface ReminderSettings {
  enabled: boolean;
  runTime: string;
  daysBefore: number[];
  notifyStaff: boolean;
  notifyCustomer: boolean;
  extraCc: string;
  lastRunDate: string | null;
}

export interface UpdateReminderSettingsInput {
  enabled?: boolean;
  runTime?: string;
  daysBefore?: number[];
  notifyStaff?: boolean;
  notifyCustomer?: boolean;
  extraCc?: string;
}

export function getReminderSettings(): Promise<ReminderSettings> {
  return apiFetch<ReminderSettings>("/reminders/settings");
}

export function updateReminderSettings(
  input: UpdateReminderSettingsInput
): Promise<ReminderSettings> {
  return apiFetch<ReminderSettings>("/reminders/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export interface RunNowResult {
  sent: number;
  failed: number;
  skipped: number;
}

export function runReminderNow(): Promise<RunNowResult> {
  return apiFetch<RunNowResult>("/reminders/run-now", { method: "POST" });
}

export interface ReminderLog {
  id: string;
  source: "service" | "file";
  item_id: string;
  days_before: number;
  recipients: string | null;
  status: string;
  error: string | null;
  sent_at: string;
}

export function getReminderLogs(limit = 200): Promise<ReminderLog[]> {
  return apiFetch<ReminderLog[]>(`/reminders/logs?limit=${limit}`);
}

export interface ReminderBatchSummary {
  id: string;
  name: string;
  fileName: string | null;
  daysBefore: number[];
  enabled: boolean;
  itemCount: number;
  nearestExpiryDate: string | null;
  importedBy: string | null;
  importedAt: string | null;
}

export function getReminderBatches(): Promise<ReminderBatchSummary[]> {
  return apiFetch<ReminderBatchSummary[]>("/reminders/files");
}

export interface InspectReminderFileResult {
  sheetName: string;
  headers: string[];
  sampleRows: Record<string, unknown>[];
}

export async function inspectReminderFile(file: File): Promise<InspectReminderFileResult> {
  const formData = new FormData();
  formData.append("file", file);
  const payload = await apiFetchRaw<
    { success: true; data: InspectReminderFileResult } | { success: false; message: string }
  >("/reminders/files/inspect", { method: "POST", body: formData });
  if (!payload.success) {
    throw new Error(payload.message || "Đọc file thất bại");
  }
  return payload.data;
}

export interface ImportReminderColumns {
  expiryDate: string;
  title?: string;
  customerName?: string;
  subscriberCode?: string;
  recipientEmail?: string;
  staffName?: string;
}

export interface ImportReminderFileResult {
  batchId: string;
  imported: number;
  errors: { rowNumber: number; message: string }[];
}

export async function importReminderFile(
  file: File,
  name: string,
  daysBefore: number[],
  columns: ImportReminderColumns
): Promise<ImportReminderFileResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("daysBefore", JSON.stringify(daysBefore));
  formData.append("columns", JSON.stringify(columns));
  const payload = await apiFetchRaw<
    { success: true; data: ImportReminderFileResult } | { success: false; message: string }
  >("/reminders/files/import", { method: "POST", body: formData });
  if (!payload.success) {
    throw new Error(payload.message || "Import thất bại");
  }
  return payload.data;
}

export function updateReminderBatch(
  batchId: string,
  patch: { enabled?: boolean; daysBefore?: number[]; name?: string }
): Promise<void> {
  return apiFetch<void>(`/reminders/files/${batchId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteReminderBatch(batchId: string): Promise<void> {
  return apiFetch<void>(`/reminders/files/${batchId}`, { method: "DELETE" });
}

export interface ReminderTemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export const REMINDER_TEMPLATE_GROUPS = ["BRCĐ", "CNTT", "Di động"] as const;
export type ReminderTemplateGroup = (typeof REMINDER_TEMPLATE_GROUPS)[number];

export interface ReminderTemplate {
  subject: string;
  body: string;
  /** Nhóm dịch vụ của mẫu; null là mẫu chung. */
  group: ReminderTemplateGroup | null;
  /** Mẫu chung: đang là mặc định. Mẫu nhóm: chưa có mẫu riêng, đang theo mẫu chung. */
  isDefault: boolean;
  defaultSubject: string;
  defaultBody: string;
  variables: ReminderTemplateVariable[];
}

export interface ReminderTemplatePreview {
  subject: string;
  text: string;
  html: string;
}

export interface ReminderTemplateDraft {
  subject: string;
  /** Nội dung dạng HTML (mẫu cũ dạng văn bản thuần cũng được chấp nhận). */
  body: string;
  /** Chữ ký đang soạn (chưa lưu) để xem trước/gửi thử; bỏ trống thì dùng chữ ký đã lưu. */
  signature?: { enabled: boolean; html: string };
}

/** `group` bỏ trống/null là mẫu chung. */
export function reminderTemplatePath(suffix: string, group?: ReminderTemplateGroup | null): string {
  const query = group ? `?group=${encodeURIComponent(group)}` : "";
  return `/reminders/template${suffix}${query}`;
}

export function getReminderTemplate(group?: ReminderTemplateGroup | null): Promise<ReminderTemplate> {
  return apiFetch<ReminderTemplate>(reminderTemplatePath("", group));
}

export function saveReminderTemplate(
  draft: ReminderTemplateDraft,
  group?: ReminderTemplateGroup | null
): Promise<ReminderTemplate> {
  return apiFetch<ReminderTemplate>(reminderTemplatePath("", group), {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export function previewReminderTemplate(
  draft: ReminderTemplateDraft,
  group?: ReminderTemplateGroup | null
): Promise<ReminderTemplatePreview> {
  return apiFetch<ReminderTemplatePreview>(reminderTemplatePath("/preview", group), {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function resetReminderTemplate(group?: ReminderTemplateGroup | null): Promise<ReminderTemplate> {
  return apiFetch<ReminderTemplate>(reminderTemplatePath("/reset", group), { method: "POST" });
}

export function sendReminderTemplateTest(
  to: string,
  draft: ReminderTemplateDraft,
  group?: ReminderTemplateGroup | null
): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>(reminderTemplatePath("/test", group), {
    method: "POST",
    body: JSON.stringify({ to, ...draft }),
  });
}

export interface ReminderSignature {
  enabled: boolean;
  /** Chữ ký dạng HTML. */
  html: string;
  /** Chữ ký mẫu để tham khảo (rõ ràng là mẫu, thay bằng thông tin thật). */
  sampleHtml: string;
  variables: ReminderTemplateVariable[];
}

export function getReminderSignature(): Promise<ReminderSignature> {
  return apiFetch<ReminderSignature>("/reminders/signature");
}

export function saveReminderSignature(input: { enabled?: boolean; html?: string }): Promise<ReminderSignature> {
  return apiFetch<ReminderSignature>("/reminders/signature", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export interface ReminderGroupSetting {
  group: ReminderTemplateGroup;
  /** true: nhóm có cấu hình riêng; false: đang dùng cấu hình chung. */
  custom: boolean;
  /** Bật/tắt nhắc cho nhóm (nhóm dùng chung luôn bật). */
  enabled: boolean;
  /** Các mốc ngày đang áp dụng cho nhóm (riêng hoặc chung), giảm dần. */
  daysBefore: number[];
  channels: string[];
}

export interface ReminderGroupSettingsOverview {
  /** Các mốc ngày của cấu hình chung. */
  general: number[];
  groups: ReminderGroupSetting[];
}

export function getReminderGroupSettings(): Promise<ReminderGroupSettingsOverview> {
  return apiFetch<ReminderGroupSettingsOverview>("/reminders/groups");
}

export function saveReminderGroupSetting(
  group: ReminderTemplateGroup,
  input: { enabled?: boolean; daysBefore?: number[] }
): Promise<ReminderGroupSetting> {
  return apiFetch<ReminderGroupSetting>(`/reminders/groups/${encodeURIComponent(group)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** "Dùng cấu hình chung": bỏ cấu hình riêng của nhóm. */
export function resetReminderGroupSetting(group: ReminderTemplateGroup): Promise<ReminderGroupSetting> {
  return apiFetch<ReminderGroupSetting>(`/reminders/groups/${encodeURIComponent(group)}`, { method: "DELETE" });
}

/** Chuẩn hoá danh sách ngày nhắc như backend: nguyên 0–365, bỏ trùng, giảm dần. */
export function normalizeDaysInput(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => b - a);
}
