import { query, run } from "../../database/db.js";
import { SERVICE_GROUPS, type ServiceGroup } from "../../constants/org.js";
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
  /** Nhóm dịch vụ của mẫu; null là mẫu chung. */
  group: ServiceGroup | null;
  /** Mẫu chung: đang là mẫu mặc định. Mẫu nhóm: chưa có mẫu riêng, đang theo mẫu chung. */
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

/** Chuẩn hoá nhóm dịch vụ từ đầu vào; rỗng/null/undefined là mẫu chung, giá trị lạ bị từ chối. */
function parseGroup(group: unknown): ServiceGroup | null {
  if (group === undefined || group === null || group === "") return null;
  if (typeof group === "string" && (SERVICE_GROUPS as readonly string[]).includes(group)) {
    return group as ServiceGroup;
  }
  throw new TemplateValidationError(`Nhóm dịch vụ không hợp lệ. Các nhóm hợp lệ: ${SERVICE_GROUPS.join(", ")}`);
}

async function readStored(): Promise<TemplateRow> {
  await ReminderSettingsService.get(); // đảm bảo hàng cấu hình đã tồn tại
  const rows = await query<TemplateRow>(
    "SELECT email_subject_template, email_body_template FROM reminder_settings WHERE id = ?",
    [SETTINGS_ID]
  );
  return rows[0] ?? { email_subject_template: null, email_body_template: null };
}

async function readGroupStored(group: ServiceGroup): Promise<TemplateRow | null> {
  const rows = await query<TemplateRow>(
    "SELECT email_subject_template, email_body_template FROM reminder_group_templates WHERE service_group = ?",
    [group]
  );
  return rows[0] ?? null;
}

/** Mẫu nhóm: phần nào nhóm chưa có thì lấy từ mẫu chung. */
function mergeOverride(general: EmailTemplate, row: TemplateRow | null): EmailTemplate {
  return {
    subject: row?.email_subject_template?.trim() ? row.email_subject_template : general.subject,
    body: row?.email_body_template?.trim() ? row.email_body_template : general.body,
  };
}

function toView(template: EmailTemplate, group: ServiceGroup | null, general: EmailTemplate): ReminderTemplateView {
  if (group) {
    return {
      ...template,
      group,
      isDefault: template.subject === general.subject && template.body === general.body,
      defaultSubject: general.subject,
      defaultBody: general.body,
      variables: TEMPLATE_VARIABLES,
    };
  }
  return {
    ...template,
    group: null,
    isDefault: template.subject === DEFAULT_SUBJECT_TEMPLATE && template.body === DEFAULT_BODY_TEMPLATE,
    defaultSubject: DEFAULT_SUBJECT_TEMPLATE,
    defaultBody: DEFAULT_BODY_TEMPLATE,
    variables: TEMPLATE_VARIABLES,
  };
}

export const ReminderTemplateService = {
  /** Mẫu đang áp dụng: mẫu đã lưu, thiếu phần nào dùng mặc định phần đó. Có `group` thì ưu tiên mẫu riêng của nhóm. */
  async getEffective(group?: unknown): Promise<EmailTemplate> {
    const parsed = parseGroup(group);
    const row = await readStored();
    const general: EmailTemplate = {
      subject: row.email_subject_template?.trim() ? row.email_subject_template : DEFAULT_SUBJECT_TEMPLATE,
      body: row.email_body_template?.trim() ? row.email_body_template : DEFAULT_BODY_TEMPLATE,
    };
    if (!parsed) return general;
    return mergeOverride(general, await readGroupStored(parsed));
  },

  /** Mẫu chung + mẫu riêng của từng nhóm đã lưu, đọc một lần cho cả lượt gửi. */
  async getEffectiveAll(): Promise<{ general: EmailTemplate; byGroup: Map<string, EmailTemplate> }> {
    const general = await ReminderTemplateService.getEffective();
    const rows = await query<TemplateRow & { service_group: string }>(
      "SELECT service_group, email_subject_template, email_body_template FROM reminder_group_templates"
    );
    const byGroup = new Map<string, EmailTemplate>();
    for (const row of rows) {
      byGroup.set(row.service_group, mergeOverride(general, row));
    }
    return { general, byGroup };
  },

  async getView(group?: unknown): Promise<ReminderTemplateView> {
    const parsed = parseGroup(group);
    const general = await ReminderTemplateService.getEffective();
    const template = parsed ? await ReminderTemplateService.getEffective(parsed) : general;
    return toView(template, parsed, general);
  },

  async save(input: { subject?: unknown; body?: unknown }, group?: unknown): Promise<ReminderTemplateView> {
    const parsed = parseGroup(group);
    const template = validateTemplate(input);
    if (parsed) {
      await run(
        `INSERT INTO reminder_group_templates (service_group, email_subject_template, email_body_template, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (service_group) DO UPDATE SET
           email_subject_template = EXCLUDED.email_subject_template,
           email_body_template = EXCLUDED.email_body_template,
           updated_at = EXCLUDED.updated_at`,
        [parsed, template.subject, template.body, new Date().toISOString()]
      );
      return ReminderTemplateService.getView(parsed);
    }
    await readStored();
    await run(
      "UPDATE reminder_settings SET email_subject_template = ?, email_body_template = ?, updated_at = ? WHERE id = ?",
      [template.subject, template.body, new Date().toISOString(), SETTINGS_ID]
    );
    return ReminderTemplateService.getView();
  },

  /** Mẫu chung: về mặc định. Mẫu nhóm: xoá mẫu riêng, nhóm theo lại mẫu chung. */
  async reset(group?: unknown): Promise<ReminderTemplateView> {
    const parsed = parseGroup(group);
    if (parsed) {
      await run("DELETE FROM reminder_group_templates WHERE service_group = ?", [parsed]);
      return ReminderTemplateService.getView(parsed);
    }
    await readStored();
    await run(
      "UPDATE reminder_settings SET email_subject_template = NULL, email_body_template = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), SETTINGS_ID]
    );
    return ReminderTemplateService.getView();
  },

  /** Render với dữ liệu mẫu; thiếu `subject`/`body` thì dùng mẫu đã lưu (của nhóm nếu có `group`). */
  async preview(draft: { subject?: unknown; body?: unknown }, group?: unknown): Promise<RenderedEmail> {
    const template = await resolveDraft(draft, group);
    return renderEmail(template, SAMPLE_DATA);
  },

  /** Gửi thử mẫu (dữ liệu mẫu) tới 1 email qua SMTP đã lưu; không rơi về Ethereal. */
  async sendTest(
    to: unknown,
    draft: { subject?: unknown; body?: unknown },
    send: (msg: SendMailMessage) => Promise<SendMailResult> = (msg) => sendMail(msg),
    group?: unknown
  ): Promise<SendMailResult> {
    parseGroup(group);
    if (typeof to !== "string" || !EMAIL_PATTERN.test(to.trim())) {
      throw new TemplateValidationError('Địa chỉ email "Gửi thử tới" không hợp lệ');
    }
    const template = await resolveDraft(draft, group);
    const rendered = renderEmail(template, SAMPLE_DATA);
    return send({
      to: to.trim(),
      subject: `[Gửi thử] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
    });
  },
};

async function resolveDraft(draft: { subject?: unknown; body?: unknown }, group?: unknown): Promise<EmailTemplate> {
  const current = await ReminderTemplateService.getEffective(group);
  if (draft.subject === undefined && draft.body === undefined) {
    return current;
  }
  return validateTemplate({
    subject: draft.subject === undefined ? current.subject : draft.subject,
    body: draft.body === undefined ? current.body : draft.body,
  });
}
