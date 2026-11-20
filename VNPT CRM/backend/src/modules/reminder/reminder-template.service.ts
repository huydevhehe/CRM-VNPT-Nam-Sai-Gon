import { query, run } from "../../database/db.js";
import { SERVICE_GROUPS, type ServiceGroup } from "../../constants/org.js";
import { sendMail, type SendMailMessage, type SendMailResult } from "../notification/email.service.js";
import { ReminderSettingsService } from "./reminder-settings.service.js";
import { escapeHtmlText, htmlToText, looksLikeHtml, sanitizeEmailHtml, stripTags, textToHtml } from "./html-sanitizer.js";

const SETTINGS_ID = "default";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_PATTERN = /\{([^{}\r\n]{1,50})\}/g;
/** Biến trong HTML có thể bị chen thẻ định dạng, vd `{tên <b>khách</b>}`. */
const HTML_PLACEHOLDER_PATTERN = /\{((?:[^{}\r\n<>]|<[^>]*>){1,200})\}/g;

export const SUBJECT_MAX_LENGTH = 200;
/** Giới hạn độ dài phần chữ (đã bỏ thẻ định dạng) của nội dung. */
export const BODY_MAX_LENGTH = 5000;
/** Giới hạn độ dài HTML đã lưu (gồm cả thẻ định dạng). */
export const BODY_HTML_MAX_LENGTH = 20000;
export const SIGNATURE_MAX_LENGTH = 2000;
export const SIGNATURE_HTML_MAX_LENGTH = 10000;

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

/** Nội dung mặc định dạng văn bản thuần (bản gốc trước khi có trình soạn thảo định dạng). */
export const DEFAULT_BODY_TEXT = [
  "Dịch vụ: {dịch vụ}",
  "Khách hàng: {tên khách}",
  "Mã thuê bao: {mã thuê bao}",
  "AM phụ trách: {AM phụ trách}",
  "Ngày hết hạn: {ngày hết hạn} (còn {số ngày còn lại} ngày)",
].join("\n");

/** Nội dung mặc định ở dạng HTML (nội dung mẫu luôn được xử lý như HTML). */
export const DEFAULT_BODY_TEMPLATE = textToHtml(DEFAULT_BODY_TEXT);

/** Chữ ký mẫu để người dùng tham khảo; thông tin thật do khách cung cấp sau. */
export const SAMPLE_SIGNATURE_HTML =
  "<p><strong>[Chữ ký mẫu - thay bằng thông tin thật]</strong></p>" +
  "<p>VNPT Nam Sài Gòn<br>Điện thoại: 028 0000 0000<br>Email: lienhe@example.com</p>";

export interface TemplateData {
  title: string;
  customerName: string;
  subscriberCode: string;
  staffName: string | null;
  expiryDate: string;
  daysBefore: number;
}

/** `body` là HTML (đã làm sạch). Nội dung văn bản thuần (mẫu cũ) cũng được chấp nhận và tự đổi sang HTML. */
export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailSignature {
  enabled: boolean;
  html: string;
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

export interface ReminderSignatureView extends EmailSignature {
  /** Chữ ký mẫu để chèn tham khảo. */
  sampleHtml: string;
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
  return escapeHtmlText(value);
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

/** Tiêu đề: văn bản thuần, một dòng. */
function substituteSubject(template: string, values: Record<string, string>): string {
  const singleLine = (s: string) => s.replace(/[\r\n]+/g, " ");
  let result = "";
  let lastIndex = 0;
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    result += singleLine(template.slice(lastIndex, index));
    const name = match[1].trim();
    result += singleLine(VARIABLE_KEYS.has(name) ? (values[name] ?? "") : match[0]);
    lastIndex = index + match[0].length;
  }
  result += singleLine(template.slice(lastIndex));
  return result;
}

/** HTML: thay biến (giá trị luôn được escape); biến lạ giữ nguyên chữ. */
function substituteHtml(html: string, values: Record<string, string>): string {
  return html.replace(HTML_PLACEHOLDER_PATTERN, (whole, inner: string) => {
    const name = stripTags(inner).trim();
    return VARIABLE_KEYS.has(name) ? escapeHtmlText(values[name] ?? "") : whole;
  });
}

/** Nội dung mẫu (HTML hoặc văn bản thuần của mẫu cũ) → HTML đã làm sạch. */
export function bodyToHtml(body: string): string {
  const normalized = body.replace(/\r\n?/g, "\n");
  return sanitizeEmailHtml(looksLikeHtml(normalized) ? normalized : textToHtml(normalized));
}

const PARAGRAPH_STYLE = "margin:0 0 10px 0";

/** Thêm style cho email client (không phụ thuộc CSS mặc định của từng client). */
function styleForEmail(html: string): string {
  return html
    .replace(/<p><\/p>/g, `<p style="${PARAGRAPH_STYLE}"><br></p>`)
    .replace(/<p>/g, `<p style="${PARAGRAPH_STYLE}">`)
    .replace(/<ul>/g, `<ul style="${PARAGRAPH_STYLE};padding-left:24px">`)
    .replace(/<ol>/g, `<ol style="${PARAGRAPH_STYLE};padding-left:24px">`);
}

/**
 * Render mẫu với dữ liệu thật. Biến lạ giữ nguyên chữ. Nội dung được làm sạch
 * lại ở đây (kể cả mẫu đã lưu), giá trị chèn vào html luôn được escape.
 * Tiêu đề không chứa xuống dòng (chống header injection). Có chữ ký bật thì
 * chèn vào cuối cả bản HTML lẫn bản text.
 */
export function renderEmail(template: EmailTemplate, data: TemplateData, signature?: EmailSignature | null): RenderedEmail {
  const values = toValueMap(data);
  const subject = substituteSubject(template.subject, values).trim();

  const bodyHtml = substituteHtml(bodyToHtml(template.body), values);
  const signatureHtml =
    signature?.enabled && signature.html.trim() ? substituteHtml(bodyToHtml(signature.html), values) : "";

  let text = htmlToText(bodyHtml);
  let html = styleForEmail(bodyHtml);
  if (signatureHtml) {
    text += `\n\n--\n${htmlToText(signatureHtml)}`;
    html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0">${styleForEmail(signatureHtml)}</div>`;
  }
  html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">${html}</div>`;
  return { subject, text, html };
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

/** Kiểm tra + làm sạch một đoạn HTML nội dung/chữ ký; trả về HTML sạch và thêm lỗi (tiếng Việt) vào `errors`. */
function checkRichText(
  raw: string,
  label: string,
  limits: { text: number; html: number },
  errors: string[],
  { allowEmpty }: { allowEmpty: boolean }
): string {
  const html = bodyToHtml(normalizeNewlines(raw)).trim();
  const text = htmlToText(html);
  if (!allowEmpty && !text.trim()) {
    errors.push(`${label} không được để trống`);
  }
  if (text.length > limits.text) {
    errors.push(`${label} tối đa ${limits.text} ký tự`);
  } else if (html.length > limits.html) {
    errors.push(`${label} quá dài (nhiều định dạng), hãy rút gọn`);
  }
  const unknown = findUnknownVariables(text);
  if (unknown.length > 0) {
    errors.push(`${label} chứa biến không hợp lệ: ${unknown.map((u) => `{${u}}`).join(", ")}`);
  }
  return html;
}

function throwValidation(errors: string[]): never {
  const validKeys = TEMPLATE_VARIABLES.map((v) => `{${v.key}}`).join(", ");
  const hasUnknown = errors.some((e) => e.includes("biến không hợp lệ"));
  throw new TemplateValidationError(errors.join("; ") + (hasUnknown ? `. Các biến hợp lệ: ${validKeys}` : ""));
}

/** Validate + chuẩn hoá mẫu (nội dung được làm sạch thành HTML); ném `TemplateValidationError` (tiếng Việt) khi không hợp lệ. */
export function validateTemplate(input: { subject?: unknown; body?: unknown }): EmailTemplate {
  const errors: string[] = [];

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
    body = checkRichText(input.body, "Nội dung", { text: BODY_MAX_LENGTH, html: BODY_HTML_MAX_LENGTH }, errors, {
      allowEmpty: false,
    });
  }

  if (errors.length > 0) throwValidation(errors);
  return { subject, body };
}

/** Validate + chuẩn hoá chữ ký; `html` rỗng được phép (chưa có chữ ký). */
export function validateSignature(input: { enabled?: unknown; html?: unknown }): EmailSignature {
  const errors: string[] = [];
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    errors.push("enabled phải là true/false");
  }
  let html = "";
  if (input.html !== undefined) {
    if (typeof input.html !== "string") {
      errors.push("Chữ ký phải là chuỗi HTML");
    } else {
      html = checkRichText(input.html, "Chữ ký", { text: SIGNATURE_MAX_LENGTH, html: SIGNATURE_HTML_MAX_LENGTH }, errors, {
        allowEmpty: true,
      });
      if (!htmlToText(html).trim()) html = "";
    }
  }
  if (errors.length > 0) throwValidation(errors);
  return { enabled: input.enabled === true, html };
}

interface TemplateRow {
  email_subject_template: string | null;
  email_body_template: string | null;
  email_body_format?: string | null;
}

/** Chuẩn hoá nội dung đã lưu: mẫu cũ (format NULL/'text') là văn bản thuần → HTML. */
function storedBodyToHtml(row: TemplateRow): string {
  const stored = row.email_body_template ?? "";
  return row.email_body_format === "html" ? stored : textToHtml(stored);
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
    "SELECT email_subject_template, email_body_template, email_body_format FROM reminder_settings WHERE id = ?",
    [SETTINGS_ID]
  );
  return rows[0] ?? { email_subject_template: null, email_body_template: null, email_body_format: null };
}

async function readGroupStored(group: ServiceGroup): Promise<TemplateRow | null> {
  const rows = await query<TemplateRow>(
    "SELECT email_subject_template, email_body_template, email_body_format FROM reminder_group_templates WHERE service_group = ?",
    [group]
  );
  return rows[0] ?? null;
}

/** Mẫu nhóm: phần nào nhóm chưa có thì lấy từ mẫu chung. */
function mergeOverride(general: EmailTemplate, row: TemplateRow | null): EmailTemplate {
  return {
    subject: row?.email_subject_template?.trim() ? row.email_subject_template : general.subject,
    body: row?.email_body_template?.trim() ? storedBodyToHtml(row) : general.body,
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
      body: row.email_body_template?.trim() ? storedBodyToHtml(row) : DEFAULT_BODY_TEMPLATE,
    };
    if (!parsed) return general;
    return mergeOverride(general, await readGroupStored(parsed));
  },

  /** Mẫu chung + mẫu riêng của từng nhóm đã lưu, đọc một lần cho cả lượt gửi. */
  async getEffectiveAll(): Promise<{ general: EmailTemplate; byGroup: Map<string, EmailTemplate> }> {
    const general = await ReminderTemplateService.getEffective();
    const rows = await query<TemplateRow & { service_group: string }>(
      "SELECT service_group, email_subject_template, email_body_template, email_body_format FROM reminder_group_templates"
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
        `INSERT INTO reminder_group_templates (service_group, email_subject_template, email_body_template, email_body_format, updated_at)
         VALUES (?, ?, ?, 'html', ?)
         ON CONFLICT (service_group) DO UPDATE SET
           email_subject_template = EXCLUDED.email_subject_template,
           email_body_template = EXCLUDED.email_body_template,
           email_body_format = EXCLUDED.email_body_format,
           updated_at = EXCLUDED.updated_at`,
        [parsed, template.subject, template.body, new Date().toISOString()]
      );
      return ReminderTemplateService.getView(parsed);
    }
    await readStored();
    await run(
      "UPDATE reminder_settings SET email_subject_template = ?, email_body_template = ?, email_body_format = 'html', updated_at = ? WHERE id = ?",
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
      "UPDATE reminder_settings SET email_subject_template = NULL, email_body_template = NULL, email_body_format = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), SETTINGS_ID]
    );
    return ReminderTemplateService.getView();
  },

  /** Render với dữ liệu mẫu; thiếu `subject`/`body` thì dùng mẫu đã lưu (của nhóm nếu có `group`). Chữ ký đang bật được chèn vào cuối. */
  async preview(
    draft: { subject?: unknown; body?: unknown; signature?: unknown },
    group?: unknown
  ): Promise<RenderedEmail> {
    const template = await resolveDraft(draft, group);
    const signature = await resolveSignatureDraft(draft.signature);
    return renderEmail(template, SAMPLE_DATA, signature);
  },

  /** Gửi thử mẫu (dữ liệu mẫu) tới 1 email qua SMTP đã lưu; không rơi về Ethereal. */
  async sendTest(
    to: unknown,
    draft: { subject?: unknown; body?: unknown; signature?: unknown },
    send: (msg: SendMailMessage) => Promise<SendMailResult> = (msg) => sendMail(msg),
    group?: unknown
  ): Promise<SendMailResult> {
    parseGroup(group);
    if (typeof to !== "string" || !EMAIL_PATTERN.test(to.trim())) {
      throw new TemplateValidationError('Địa chỉ email "Gửi thử tới" không hợp lệ');
    }
    const template = await resolveDraft(draft, group);
    const signature = await resolveSignatureDraft(draft.signature);
    const rendered = renderEmail(template, SAMPLE_DATA, signature);
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

/** Bản nháp chữ ký (`{enabled, html}`) nếu có, ngược lại chữ ký đã lưu. */
async function resolveSignatureDraft(draft: unknown): Promise<EmailSignature> {
  const stored = await ReminderSignatureService.getEffective();
  if (draft === undefined || draft === null) return stored;
  if (typeof draft !== "object") {
    throw new TemplateValidationError("Chữ ký không hợp lệ");
  }
  const { enabled, html } = draft as { enabled?: unknown; html?: unknown };
  return validateSignature({
    enabled: enabled === undefined ? stored.enabled : enabled,
    html: html === undefined ? stored.html : html,
  });
}

interface SignatureRow {
  signature_enabled: boolean | null;
  signature_html: string | null;
}

export const ReminderSignatureService = {
  /** Chữ ký đã lưu; chưa cấu hình thì tắt và rỗng. */
  async getEffective(): Promise<EmailSignature> {
    await ReminderSettingsService.get();
    const rows = await query<SignatureRow>(
      "SELECT signature_enabled, signature_html FROM reminder_settings WHERE id = ?",
      [SETTINGS_ID]
    );
    const row = rows[0];
    return { enabled: Boolean(row?.signature_enabled), html: row?.signature_html ?? "" };
  },

  async getView(): Promise<ReminderSignatureView> {
    return { ...(await ReminderSignatureService.getEffective()), sampleHtml: SAMPLE_SIGNATURE_HTML, variables: TEMPLATE_VARIABLES };
  },

  /** Lưu chữ ký; chỉ truyền `enabled` thì giữ nguyên nội dung và ngược lại. Bật mà chưa có nội dung bị từ chối. */
  async save(input: { enabled?: unknown; html?: unknown }): Promise<ReminderSignatureView> {
    const stored = await ReminderSignatureService.getEffective();
    const next = validateSignature({
      enabled: input.enabled === undefined ? stored.enabled : input.enabled,
      html: input.html === undefined ? stored.html : input.html,
    });
    if (next.enabled && !next.html) {
      throw new TemplateValidationError("Hãy nhập nội dung chữ ký trước khi bật chèn chữ ký");
    }
    await run("UPDATE reminder_settings SET signature_enabled = ?, signature_html = ?, updated_at = ? WHERE id = ?", [
      next.enabled,
      next.html,
      new Date().toISOString(),
      SETTINGS_ID,
    ]);
    return ReminderSignatureService.getView();
  },
};
