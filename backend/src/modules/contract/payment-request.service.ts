import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { query, run, transaction } from "../../database/db.js";
import { ContractRow } from "./contract.service.js";
import { numberToVietnameseWords } from "../../utils/vn-number-words.js";
import { SettingsService } from "../settings/settings.service.js";

export interface PaymentRequestData {
  SoVanBan: string;
  Ngay: string;
  Thang: string;
  Nam: string;
  TenDichVu: string;
  TenKhachHang: string;
  MaSoThue: string;
  SoHopDong: string;
  GoiCuoc: string;
  MaTB: string;
  HinhThucThanhToan: string;
  GiaTriHopDong: string;
  SoTienBangChu: string;
  MaGD: string;
  DonViThuHuong: string;
  SoTaiKhoan: string;
  NganHang: string;
  TenVietTatAM: string;
  TenAM: string;
  SdtAM: string;
  EmailAM: string;
  NguoiKy: string;
  missingFields: string[];
}

export interface PaymentExportRecord {
  id: string;
  contractId: string;
  docNumber: string;
  exportedBy: string | null;
  exportedAt: string;
  transactionCode?: string;
  customerName?: string;
}

export interface ConfirmExportInput {
  /** Bỏ trống = hệ thống tự cấp số kế tiếp tại thời điểm xác nhận. */
  docNumber?: string | null;
  exportedBy: string;
  /** Đơn đã có số văn bản thì dùng lại số đó, không cấp số mới. */
  reuseLatest?: boolean;
}

export interface ConfirmExportResult {
  record: PaymentExportRecord;
  reused: boolean;
}

export interface PaymentRequestPreview {
  suggestedDocNumber: string;
  missingFields: string[];
  lines: string[];
  latestExport: PaymentExportRecord | null;
}

export class PaymentRequestInputError extends Error {}
export class PaymentRequestConflictError extends Error {}
export class PaymentRequestNotFoundError extends Error {}

const DOC_NUMBER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}./-]{0,19}$/u;
const DOC_NUMBER_INVALID_MESSAGE =
  "Số văn bản không hợp lệ (tối đa 20 ký tự gồm chữ, số, dấu chấm, gạch ngang hoặc gạch chéo)";

interface ExportRow {
  id: string;
  contract_id: string;
  doc_number: string;
  exported_by: string | null;
  exported_at: string;
  transaction_code?: string | null;
  customer_name?: string | null;
}

function toExportRecord(r: ExportRow): PaymentExportRecord {
  return {
    id: r.id,
    contractId: r.contract_id,
    docNumber: r.doc_number,
    exportedBy: r.exported_by,
    exportedAt: r.exported_at,
    transactionCode: r.transaction_code || undefined,
    customerName: r.customer_name || undefined,
  };
}

/** Số lớn nhất dạng số trong các số văn bản của một năm. */
function maxNumericDocNumber(rows: { doc_number: string }[]): number {
  let max = 0;
  for (const r of rows) {
    const parsed = parseInt(r.doc_number, 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return max;
}

function xmlUnescape(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Lấy các dòng chữ của file DOCX đã render (dùng cho khung xem trước). */
export function extractDocxLines(docx: Buffer): string[] {
  const zip = new PizZip(docx);
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  // Hộp văn bản (textbox) được lưu hai lần (Choice + Fallback): bỏ bản Fallback để khỏi lặp dòng.
  const cleaned = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");
  const lines: string[] = [];
  for (const para of cleaned.split("</w:p>")) {
    let text = "";
    const tokenRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(para))) {
      if (m[1] !== undefined) text += xmlUnescape(m[1]);
      else text += m[0] === "<w:tab/>" ? "    " : " ";
    }
    const line = text.trim();
    // Bỏ dòng rỗng và ký tự lẻ (do hình vẽ/đường kẻ trong mẫu để lại).
    if (line.length > 1) lines.push(line);
  }
  return lines;
}

export const ORDER_WITHOUT_CUSTOMER_MESSAGE =
  "Đơn hàng chưa gắn khách hàng. Vui lòng cập nhật khách hàng cho đơn trước khi xuất Đề nghị thanh toán";

export class PaymentRequestBlockedError extends Error {}

/** "Trả trước 12 tháng" khi có số tháng; đơn cũ chưa có số tháng giữ nguyên "Trả trước". */
export function formatPaymentMethod(method: string | null, prepaidMonths?: number | null): string {
  const base = method || "Trả trước";
  return base === "Trả trước" && prepaidMonths ? `Trả trước ${prepaidMonths} tháng` : base;
}

function deriveShortName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

export class PaymentRequestService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.resolve(process.cwd(), "templates/de-nghi-thanh-toan.docx");
  }

  async suggestNextDocNumber(year: number): Promise<string> {
    const yearStr = `${year}`;
    const rows = await query<{ doc_number: string }>(
      `SELECT doc_number FROM payment_request_exports WHERE exported_at LIKE ?`,
      [`${yearStr}%`]
    );

    const maxNum = maxNumericDocNumber(rows);
    return maxNum > 0 ? String(maxNum + 1) : "";
  }

  async buildData(
    contractId: string,
    docNumber: string,
    now: Date = new Date()
  ): Promise<PaymentRequestData> {
    const contractRows = await query<ContractRow>("SELECT * FROM contracts WHERE id = ?", [contractId]);
    if (!contractRows.length) {
      throw new Error("Không tìm thấy Đơn hàng");
    }
    const contract = contractRows[0];

    if (!contract.customer_id) {
      throw new PaymentRequestBlockedError(ORDER_WITHOUT_CUSTOMER_MESSAGE);
    }
    const custRows = await query<{ identity_code: string | null; name: string }>(
      "SELECT identity_code, name FROM customers WHERE id = ?",
      [contract.customer_id]
    );
    if (!custRows.length) {
      throw new PaymentRequestBlockedError(ORDER_WITHOUT_CUSTOMER_MESSAGE);
    }

    const missingFields: string[] = [];

    // Customer info
    let taxCode = contract.tax_code || "";
    let customerName = contract.customer_name || "";
    if (!taxCode && custRows[0].identity_code) taxCode = custRows[0].identity_code;
    if (!customerName) customerName = custRows[0].name;
    if (!taxCode) missingFields.push("Mã số thuế");
    if (!customerName) missingFields.push("Tên khách hàng");

    // AM info
    let amName = contract.am_staff || "";
    let amPhone = "";
    let amEmail = "";
    let amHrm = "";
    let amShort = "";

    if (amName) {
      const staffRows = await query<{
        phone: string | null;
        email: string | null;
        hrm_code: string | null;
        short_name: string | null;
      }>("SELECT phone, email, hrm_code, short_name FROM staff WHERE name = ?", [amName]);
      if (staffRows.length) {
        amPhone = staffRows[0].phone || "";
        amEmail = staffRows[0].email || "";
        amHrm = staffRows[0].hrm_code || "";
        amShort = staffRows[0].short_name || "";
      }
    } else {
      missingFields.push("AM tiếp thị");
    }

    if (!amShort) {
      amShort = deriveShortName(amName);
    }

    if (!contract.package_name) {
      missingFields.push("Gói cước");
    }

    // Subscriber codes
    let subscriberCodes: string[] = [];
    try {
      subscriberCodes = JSON.parse(contract.subscriber_codes);
      if (!Array.isArray(subscriberCodes)) subscriberCodes = [];
    } catch {
      subscriberCodes = [];
    }
    const maTbStr = subscriberCodes.join(", ");

    // Contract number
    let soHopDong = contract.contract_number || "";
    if (!soHopDong) {
      let datePart = "";
      if (contract.signed_date) {
        datePart = contract.signed_date.replace(/-/g, "");
      } else {
        const d = new Date(contract.created_at || now);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        datePart = `${yyyy}${mm}${dd}`;
      }
      soHopDong = `${datePart}/${taxCode}/VNPT.NSG/${amHrm}`;
    }

    // Bank & Signer settings
    const config = await SettingsService.getPaymentConfig();

    // Date
    const ngay = String(now.getDate()).padStart(2, "0");
    const thang = String(now.getMonth() + 1).padStart(2, "0");
    const nam = String(now.getFullYear());

    // Amount
    const giaTri = Number(contract.total_value || 0);
    const giaTriHopDongStr = `${giaTri.toLocaleString("vi-VN")} đồng`;
    const soTienBangChu = numberToVietnameseWords(giaTri);

    return {
      SoVanBan: docNumber,
      Ngay: ngay,
      Thang: thang,
      Nam: nam,
      TenDichVu: contract.service_name || "Dịch vụ Viễn thông - CNTT",
      TenKhachHang: customerName,
      MaSoThue: taxCode,
      SoHopDong: soHopDong,
      GoiCuoc: contract.package_name || "",
      MaTB: maTbStr,
      HinhThucThanhToan: formatPaymentMethod(contract.payment_method, contract.prepaid_months),
      GiaTriHopDong: giaTriHopDongStr,
      SoTienBangChu: soTienBangChu,
      MaGD: contract.transaction_code,
      DonViThuHuong: config.paymentBeneficiary,
      SoTaiKhoan: config.paymentAccountNo,
      NganHang: config.paymentBankName,
      TenVietTatAM: amShort,
      TenAM: amName,
      SdtAM: amPhone,
      EmailAM: amEmail,
      NguoiKy: config.paymentSignerName,
      missingFields,
    };
  }

  render(data: PaymentRequestData): Buffer {
    if (!fs.existsSync(this.templatePath)) {
      throw new Error(`Không tìm thấy file mẫu Word tại: ${this.templatePath}`);
    }
    const content = fs.readFileSync(this.templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    doc.render(data);
    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  }

  /** Dữ liệu xem trước: KHÔNG ghi gì vào DB, không tiêu số văn bản. */
  async buildPreview(contractId: string, docNumber?: string): Promise<PaymentRequestPreview> {
    const suggestedDocNumber = await this.suggestNextDocNumber(new Date().getFullYear());
    const shown = docNumber?.trim() || suggestedDocNumber || "…";
    const data = await this.buildData(contractId, shown);
    const lines = extractDocxLines(this.render(data));
    const latestExport = await this.latestExportForContract(contractId);
    return { suggestedDocNumber, missingFields: data.missingFields, lines, latestExport };
  }

  async latestExportForContract(contractId: string): Promise<PaymentExportRecord | null> {
    const rows = await query<ExportRow>(
      `SELECT * FROM payment_request_exports WHERE contract_id = ?
       ORDER BY exported_at DESC, id DESC LIMIT 1`,
      [contractId]
    );
    return rows.length ? toExportRecord(rows[0]) : null;
  }

  async getExport(exportId: string, contractId: string): Promise<PaymentExportRecord> {
    const rows = await query<ExportRow>(
      "SELECT * FROM payment_request_exports WHERE id = ? AND contract_id = ?",
      [exportId, contractId]
    );
    if (!rows.length) {
      throw new PaymentRequestNotFoundError("Không tìm thấy lần cấp số văn bản của đơn hàng này");
    }
    return toExportRecord(rows[0]);
  }

  /** Dựng dữ liệu để tải lại file của một lần đã cấp số: dùng đúng số và ngày của lần đó. */
  async buildDataForExport(record: PaymentExportRecord): Promise<PaymentRequestData> {
    return this.buildData(record.contractId, record.docNumber, new Date(record.exportedAt));
  }

  /**
   * Xác nhận lấy số văn bản — điểm DUY NHẤT tiêu số. Chạy trong transaction có khóa
   * để hai người xác nhận gần nhau nhận hai số liên tiếp, không trùng, không hụt.
   */
  async confirmExport(contractId: string, input: ConfirmExportInput): Promise<ConfirmExportResult> {
    // Kiểm tra đơn xuất được (tồn tại, đã gắn khách) trước khi cấp số.
    await this.buildData(contractId, "0");

    const manual = input.docNumber?.trim() || "";
    if (manual && !DOC_NUMBER_PATTERN.test(manual)) {
      throw new PaymentRequestInputError(DOC_NUMBER_INVALID_MESSAGE);
    }

    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('payment_request_doc_number'))");

      if (input.reuseLatest) {
        const latest = await tx.query<ExportRow>(
          `SELECT * FROM payment_request_exports WHERE contract_id = ?
           ORDER BY exported_at DESC, id DESC LIMIT 1`,
          [contractId]
        );
        if (latest.length) return { record: toExportRecord(latest[0]), reused: true };
      }

      const now = new Date();
      const yearPrefix = `${now.toISOString().slice(0, 4)}%`;
      const yearRows = await tx.query<{ doc_number: string }>(
        "SELECT doc_number FROM payment_request_exports WHERE exported_at LIKE ?",
        [yearPrefix]
      );
      const nextNumber = String(maxNumericDocNumber(yearRows) + 1);

      let docNumber = nextNumber;
      if (manual) {
        const dup = await tx.query<ExportRow>(
          `SELECT e.*, c.transaction_code, c.customer_name
           FROM payment_request_exports e LEFT JOIN contracts c ON c.id = e.contract_id
           WHERE e.exported_at LIKE ? AND e.doc_number = ?
           ORDER BY e.exported_at DESC LIMIT 1`,
          [yearPrefix, manual]
        );
        if (dup.length) {
          if (dup[0].contract_id === contractId) {
            return { record: toExportRecord(dup[0]), reused: true };
          }
          throw new PaymentRequestConflictError(
            `Số văn bản ${manual} đã được cấp cho đơn ${dup[0].transaction_code ?? dup[0].contract_id}. ` +
              `Hãy để hệ thống tự cấp số (số kế tiếp là ${nextNumber}) hoặc nhập số khác.`
          );
        }
        docNumber = manual;
      }

      const id = `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const exportedAt = now.toISOString();
      await tx.run(
        `INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by, exported_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, contractId, docNumber, input.exportedBy, exportedAt]
      );
      await tx.run('INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)', [
        `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        input.exportedBy,
        "Cấp số văn bản đề nghị thanh toán",
        `Số ${docNumber} cho đơn ${contractId}`,
      ]);

      return {
        record: { id, contractId, docNumber, exportedBy: input.exportedBy, exportedAt },
        reused: false,
      };
    });
  }

  async recordExport(
    contractId: string,
    docNumber: string,
    exportedBy: string
  ): Promise<void> {
    const id = `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by, exported_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, contractId, docNumber, exportedBy, new Date().toISOString()]
    );
  }

  async listExports(scope: string | null = null): Promise<PaymentExportRecord[]> {
    const rows = await query<ExportRow>(
      `SELECT e.*, c.transaction_code, c.customer_name
       FROM payment_request_exports e
       LEFT JOIN contracts c ON c.id = e.contract_id
       ${scope === null ? "" : "WHERE c.am_staff = ?"}
       ORDER BY e.exported_at DESC`,
      scope === null ? [] : [scope]
    );

    return rows.map(toExportRecord);
  }
}
