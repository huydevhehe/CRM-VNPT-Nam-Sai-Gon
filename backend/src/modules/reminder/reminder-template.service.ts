import { query, run } from "../../database/db.js";
import { sendMail, type SendMailMessage, type SendMailResult } from "../notification/email.service.js";
import { ReminderSettingsService } from "./reminder-settings.service.js";

const SETTINGS_ID = "default";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_PATTERN = /\{([^{}\r\n]{1,50})\}/g;

export const SUBJECT_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 5000;

export interface TemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "tên khách", label: "Tên khách hàng", sample: "Công ty TNHH ABC" },
  { key: "dịch vụ", label: "Tên dịch vụ", sample: "Internet cáp quang FiberVNN" },
  { key: "ngày hết hạn", label: "Ngày hết hạn (dd/mm/yyyy)", sample: "30/11/2026" },
  { key: "số ngày còn lại", label: "Số ngày còn lại", sample: "7" },
  { key: "mã thuê bao", label: "Mã thuê bao", sample: "SUB-0001" },
  { key: "AM phụ trách", label: "AM phụ trách", sample: "Nguyễn Văn A" },
];

const VARIABLE_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

export const DEFAULT_SUBJECT_TEMPLATE =
  "[VNPT NSG] Dịch vụ {dịch vụ} của {tên khách} hết hạn ngày {ngày hết hạn} (còn {số ngày còn lại} ngày)";

export const DEFAULT_BODY_TEMPLATE = [
  "Dịch vụ: {dịch vụ}",
  "Khách hàng: {tên khách}",
  "Mã thuê bao: {mã thuê bao}",
  "AM phụ trách: {AM phụ trách}",
  "Ngày hết hạn: {ngày hết hạn} (còn {số ngày còn lại} ngày)",
].join("\n");

export interface TemplateData {
  title: string;
  customerName: string;
  subscriberCode: string;
  staffName: string | null;
  expiryDate: string;
  daysBefore: number;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface ReminderTemplateView extends EmailTemplate {
  isDefault: boolean;
  defaultSubject: string;
  defaultBody: string;
  variables: TemplateVariable[];
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}

export function formatDateVn(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toValueMap(data: TemplateData): Record<string, string> {
  return {
    "tên khách": data.customerName,
    "dịch vụ": data.title,
    "ngày hết hạn": formatDateVn(data.expiryDate),
    "số ngày còn lại": String(data.daysBefore),
    "mã thuê bao": data.subscriberCode || "(không có)",
    "AM phụ trách": data.staffName || "(chưa gán)",
  };
}

export const SAMPLE_DATA: TemplateData = {
  title: "Internet cáp quang FiberVNN",
  customerName: "Công ty TNHH ABC",
  subscriberCode: "SUB-0001",
  staffName: "Nguyễn Văn A",
  expiryDate: "2026-11-30",
  daysBefore: 7,
};

/** Liệt kê (không trùng, giữ thứ tự xuất hiện) các biến `{...}` không nằm trong tập hợp lệ. */
export function findUnknownVariables(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1].trim();
    if (!VARIABLE_KEYS.has(name) && !unknown.includes(name)) {
      unknown.push(name);
    }
  }
  return unknown;
}

function substitute(
  template: string,
  values: Record<string, string>,
  escapeLiteral: (s: string) => string,
  escapeValue: (s: string) => string
): string {
  let result = "";
  let lastIndex = 0;
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    result += escapeLiteral(template.slice(lastIndex, index));
    const name = match[1].trim();
    result += VARIABLE_KEYS.has(name) ? escapeValue(values[name] ?? "") : escapeLiteral(match[0]);
    lastIndex = index + match[0].length;
  }
  result += escapeLiteral(template.slice(lastIndex));
  return result;
}

/**
 * Render mẫu với dữ liệu thật. Biến lạ giữ nguyên chữ. Giá trị chèn vào html
 * luôn được escape; nội dung mẫu coi là văn bản thuần (escape cả phần chữ cố
 * định, xuống dòng → `<br>`). Tiêu đề không chứa xuống dòng (chống header injection).
 */
export function renderEmail(template: EmailTemplate, data: TemplateData): RenderedEmail {
  const values = toValueMap(data);
  const identity = (s: string) => s;
  const singleLine = (s: string) => s.replace(/[\r\n]+/g, " ");

  const subject = substitute(template.subject, values, singleLine, singleLine).trim();
  const text = substitute(template.body, values, identity, identity);
  const htmlInner = substitute(template.body, values, escapeHtml, escapeHtml).replace(/\r?\n/g, "<br>");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">${htmlInner}</div>`;
  return { subject, text, html };
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

/** Validate + chuẩn hoá mẫu; ném `TemplateValidationError` (tiếng Việt) khi không hợp lệ. */
export function validateTemplate(input: { subject?: unknown; body?: unknown }): EmailTemplate {
  const errors: string[] = [];
  const validKeys = TEMPLATE_VARIABLES.map((v) => `{${v.key}}`).join(", ");

  let subject = "";
  if (typeof input.subject !== "string" || !input.subject.trim()) {
    errors.push("Tiêu đề không được để trống");
  } else {
    subject = input.subject.trim();
    if (/[\r\n]/.test(subject)) {
      errors.push("Tiêu đề chỉ được viết trên một dòng");
    }
    if (subject.length > SUBJECT_MAX_LENGTH) {
      errors.push(`Tiêu đề tối đa ${SUBJECT_MAX_LENGTH} ký tự`);
    }
    const unknown = findUnknownVariables(subject);
    if (unknown.length > 0) {
      errors.push(`Tiêu đề chứa biến không hợp lệ: ${unknown.map((u) => `{${u}}`).join(", ")}`);
    }
  }

  let body = "";
  if (typeof input.body !== "string" || !input.body.trim()) {
    errors.push("Nội dung không được để trống");
  } else {
    body = normalizeNewlines(input.body).trim();
    if (body.length > BODY_MAX_LENGTH) {
      errors.push(`Nội dung tối đa ${BODY_MAX_LENGTH} ký tự`);
    }
    const unknown = findUnknownVariables(body);
    if (unknown.length > 0) {
      errors.push(`Nội dung chứa biến không hợp lệ: ${unknown.map((u) => `{${u}}`).join(", ")}`);
    }
  }

  if (errors.length > 0) {
    const hasUnknown = errors.some((e) => e.includes("biến không hợp lệ"));
    throw new TemplateValidationError(errors.join("; ") + (hasUnknown ? `. Các biến hợp lệ: ${validKeys}` : ""));
  }
  return { subject, body };
}

interface TemplateRow {
  email_subject_template: string | null;
  email_body_template: string | null;
}

async function readStored(): Promise<TemplateRow> {
  await ReminderSettingsService.get(); // đảm bảo hàng cấu hình đã tồn tại
  const rows = await query<TemplateRow>(
    "SELECT email_subject_template, email_body_template FROM reminder_settings WHERE id = ?",
    [SETTINGS_ID]
  );
  return rows[0] ?? { email_subject_template: null, email_body_template: null };
}

function toView(template: EmailTemplate): ReminderTemplateView {
  return {
    ...template,
    isDefault: template.subject === DEFAULT_SUBJECT_TEMPLATE && template.body === DEFAULT_BODY_TEMPLATE,
    defaultSubject: DEFAULT_SUBJECT_TEMPLATE,
    defaultBody: DEFAULT_BODY_TEMPLATE,
    variables: TEMPLATE_VARIABLES,
  };
}

export const ReminderTemplateService = {
  /** Mẫu đang áp dụng: mẫu đã lưu, thiếu phần nào dùng mặc định phần đó. */
  async getEffective(): Promise<EmailTemplate> {
    const row = await readStored();
    return {
      subject: row.email_subject_template?.trim() ? row.email_subject_template : DEFAULT_SUBJECT_TEMPLATE,
      body: row.email_body_template?.trim() ? row.email_body_template : DEFAULT_BODY_TEMPLATE,
    };
  },

  async getView(): Promise<ReminderTemplateView> {
    return toView(await ReminderTemplateService.getEffective());
  },

  async save(input: { subject?: unknown; body?: unknown }): Promise<ReminderTemplateView> {
    const template = validateTemplate(input);
    await readStored();
    await run(
      "UPDATE reminder_settings SET email_subject_template = ?, email_body_template = ?, updated_at = ? WHERE id = ?",
      [template.subject, template.body, new Date().toISOString(), SETTINGS_ID]
    );
    return ReminderTemplateService.getView();
  },

  async reset(): Promise<ReminderTemplateView> {
    await readStored();
    await run(
      "UPDATE reminder_settings SET email_subject_template = NULL, email_body_template = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), SETTINGS_ID]
    );
    return ReminderTemplateService.getView();
  },

  /** Render với dữ liệu mẫu; thiếu `subject`/`body` thì dùng mẫu đã lưu. */
  async preview(draft: { subject?: unknown; body?: unknown }): Promise<RenderedEmail> {
    const template = await resolveDraft(draft);
    return renderEmail(template, SAMPLE_DATA);
  },

  /** Gửi thử mẫu (dữ liệu mẫu) tới 1 email qua SMTP đã lưu; không rơi về Ethereal. */
  async sendTest(
    to: unknown,
    draft: { subject?: unknown; body?: unknown },
    send: (msg: SendMailMessage) => Promise<SendMailResult> = (msg) => sendMail(msg)
  ): Promise<SendMailResult> {
    if (typeof to !== "string" || !EMAIL_PATTERN.test(to.trim())) {
      throw new TemplateValidationError('Địa chỉ email "Gửi thử tới" không hợp lệ');
    }
    const template = await resolveDraft(draft);
    const rendered = renderEmail(template, SAMPLE_DATA);
    return send({
      to: to.trim(),
      subject: `[Gửi thử] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
    });
  },
};

async function resolveDraft(draft: { subject?: unknown; body?: unknown }): Promise<EmailTemplate> {
  if (draft.subject === undefined && draft.body === undefined) {
    return ReminderTemplateService.getEffective();
  }
  const current = await ReminderTemplateService.getEffective();
  return validateTemplate({
    subject: draft.subject === undefined ? current.subject : draft.subject,
    body: draft.body === undefined ? current.body : draft.body,
  });
}
