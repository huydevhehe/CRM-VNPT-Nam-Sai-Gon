import { apiFetch, API_BASE_URL, getToken } from "./client";

export const SMTP_MODES = ["normal", "domain"] as const;
export type SmtpMode = (typeof SMTP_MODES)[number];

export interface SystemSettings {
  smtpMode: SmtpMode;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassSet: boolean;
  smtpFromName: string;
  smtpFromEmail: string;
  zaloOaId: string;
  zaloOaTokenSet: boolean;
  paymentBeneficiary?: string;
  paymentAccountNo?: string;
  paymentBankName?: string;
  paymentSignerName?: string;
}

export interface UpdateSystemSettingsInput {
  smtpMode?: SmtpMode;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  zaloOaId?: string;
  zaloOaToken?: string;
  paymentBeneficiary?: string;
  paymentAccountNo?: string;
  paymentBankName?: string;
  paymentSignerName?: string;
}

export interface SmtpOverrideInput {
  smtpMode?: SmtpMode;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
}

export interface SendTestEmailResult {
  sent: boolean;
  previewUrl?: string;
  error?: string;
}

export function getSystemSettings(): Promise<SystemSettings> {
  return apiFetch<SystemSettings>("/settings");
}

export function updateSystemSettings(
  data: UpdateSystemSettingsInput
): Promise<SystemSettings> {
  return apiFetch<SystemSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function sendTestEmail(
  to: string,
  override?: SmtpOverrideInput
): Promise<SendTestEmailResult> {
  return apiFetch<SendTestEmailResult>("/settings/smtp/test", {
    method: "POST",
    body: JSON.stringify({ to, override }),
  });
}

export type TemplateKey = "payment-request" | "quote";

export interface TemplateInfo {
  key: TemplateKey;
  fileName: string;
  exists: boolean;
  updatedAt: string | null;
}

export function listTemplates(): Promise<TemplateInfo[]> {
  return apiFetch<TemplateInfo[]>("/settings/templates");
}

export function uploadTemplate(key: TemplateKey, file: File): Promise<TemplateInfo> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<TemplateInfo>(`/settings/templates/${key}`, {
    method: "POST",
    body: formData,
  });
}

export async function downloadTemplate(key: TemplateKey): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/settings/templates/${key}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Vui lòng thử lại.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Lỗi tải file mẫu (${res.status})`);
  }
  return res.blob();
}
