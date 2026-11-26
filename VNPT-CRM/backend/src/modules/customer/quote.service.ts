import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { query, transaction } from "../../database/db.js";

export interface CreateQuoteInput {
  serviceType: string;
  packageName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatPercent?: number;
  note?: string;
  staffName?: string;
}

export interface QuoteData {
  soBaoGia: string;
  loaiHinhDichVu: string;
  tenDoanhNghiepA: string;
  diaChiA: string;
  maSoThueA: string;
  tenLead: string;
  soDienThoaiLead: string;
  emailLead: string;
  hoTenNhanVien: string;
  soDienThoaiNhanVien: string;
  emailVNPTNhanVien: string;
  tenNhanVien: string;
  goiCuocDichVu: string;
  donViTinhDichVu: string;
  soLuongDichVu: string;
  donGiaDichVu: string;
  thanhTienDichVu: string;
  tongThanhTienChuaVAT: string;
  thueVAT: string;
  soTienThueVAT: string;
  tongThanhTienSauVAT: string;
  luuYKhacBaoGia: string;
  missingFields: string[];
}

export interface QuoteExportRecord {
  id: string;
  customerId: string;
  docNumber: string;
  exportedBy: string | null;
  exportedAt: string;
  serviceType: string;
  packageName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
  note: string | null;
  staffName: string | null;
  customerName?: string;
}

export interface ConfirmQuoteExportInput extends CreateQuoteInput {
  docNumber?: string | null;
  exportedBy: string;
  reuseLatest?: boolean;
}

export interface ConfirmQuoteExportResult {
  record: QuoteExportRecord;
  reused: boolean;
}

export interface QuotePreview {
  suggestedDocNumber: string;
  missingFields: string[];
  lines: string[];
}

export class QuoteInputError extends Error {}
export class QuoteConflictError extends Error {}
export class QuoteNotFoundError extends Error {}
export class QuoteBlockedError extends Error {}

const DOC_NUMBER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}./-]{0,19}$/u;
const DOC_NUMBER_INVALID_MESSAGE =
  "Số văn bản không hợp lệ (tối đa 20 ký tự gồm chữ, số, dấu chấm, gạch ngang hoặc gạch chéo)";

export const CUSTOMER_NOT_FOUND_MESSAGE = "Không tìm thấy Khách hàng để lập báo giá";

interface QuoteExportRow {
  id: string;
  customer_id: string;
  doc_number: string;
  exported_by: string | null;
  exported_at: string;
  service_type: string | null;
  package_name: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_percent: number | null;
  note: string | null;
  staff_name: string | null;
  customer_name?: string | null;
}

function toExportRecord(r: QuoteExportRow): QuoteExportRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    docNumber: r.doc_number,
    exportedBy: r.exported_by,
    exportedAt: r.exported_at,
    serviceType: r.service_type || "",
    packageName: r.package_name || "",
    unit: r.unit || "",
    quantity: Number(r.quantity || 0),
    unitPrice: Number(r.unit_price || 0),
    vatPercent: Number(r.vat_percent ?? 10),
    note: r.note,
    staffName: r.staff_name,
    customerName: r.customer_name || undefined,
  };
}

/** Số lớn nhất dạng số trong các số báo giá của một năm. */
function maxNumericDocNumber(rows: { doc_number: string }[]): number {
  let max = 0;
  for (const r of rows) {
    const parsed = parseInt(r.doc_number, 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return max;
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

export class QuoteService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.resolve(process.cwd(), "templates/bao-gia.docx");
  }

  async suggestNextDocNumber(year: number): Promise<string> {
    const yearStr = `${year}`;
    const rows = await query<{ doc_number: string }>(
      `SELECT doc_number FROM quote_exports WHERE exported_at LIKE ?`,
      [`${yearStr}%`]
    );
    const maxNum = maxNumericDocNumber(rows);
    return maxNum > 0 ? String(maxNum + 1) : "";
  }

  async buildData(customerId: string, docNumber: string, input: CreateQuoteInput): Promise<QuoteData> {
    const custRows = await query<{
      name: string;
      identity_code: string | null;
      address: string | null;
      phone: string | null;
      contact_name: string | null;
      contact_email: string | null;
      am_staff: string | null;
    }>(
      "SELECT name, identity_code, address, phone, contact_name, contact_email, am_staff FROM customers WHERE id = ?",
      [customerId]
    );
    if (!custRows.length) {
      throw new QuoteBlockedError(CUSTOMER_NOT_FOUND_MESSAGE);
    }
    const customer = custRows[0];

    const missingFields: string[] = [];
    if (!customer.name) missingFields.push("Tên doanh nghiệp");
    if (!customer.address) missingFields.push("Địa chỉ");
    if (!customer.identity_code) missingFields.push("Mã số thuế");

    const staffNameInput = input.staffName?.trim() || customer.am_staff || "";
    let staffPhone = "";
    let staffEmail = "";
    if (staffNameInput) {
      const staffRows = await query<{ phone: string | null; email: string | null }>(
        "SELECT phone, email FROM staff WHERE name = ?",
        [staffNameInput]
      );
      if (staffRows.length) {
        staffPhone = staffRows[0].phone || "";
        staffEmail = staffRows[0].email || "";
      }
    } else {
      missingFields.push("Nhân viên lập báo giá");
    }

    if (!input.serviceType) missingFields.push("Loại hình dịch vụ");
    if (!input.packageName) missingFields.push("Gói cước / nội dung");
    if (!input.quantity) missingFields.push("Số lượng");
    if (!input.unitPrice) missingFields.push("Đơn giá");

    const quantity = Number(input.quantity || 0);
    const unitPrice = Number(input.unitPrice || 0);
    const vatPercent = input.vatPercent ?? 10;
    const thanhTien = quantity * unitPrice;
    const soTienThueVAT = thanhTien * (vatPercent / 100);
    const tongSauVAT = thanhTien + soTienThueVAT;

    return {
      soBaoGia: docNumber,
      loaiHinhDichVu: input.serviceType || "",
      tenDoanhNghiepA: customer.name || "",
      diaChiA: customer.address || "",
      maSoThueA: customer.identity_code || "",
      tenLead: customer.contact_name || customer.name || "",
      soDienThoaiLead: customer.phone || "",
      emailLead: customer.contact_email || "",
      hoTenNhanVien: staffNameInput,
      soDienThoaiNhanVien: staffPhone,
      emailVNPTNhanVien: staffEmail,
      tenNhanVien: staffNameInput,
      goiCuocDichVu: input.packageName || "",
      donViTinhDichVu: input.unit || "",
      soLuongDichVu: String(quantity),
      donGiaDichVu: formatMoney(unitPrice),
      thanhTienDichVu: formatMoney(thanhTien),
      tongThanhTienChuaVAT: formatMoney(thanhTien),
      thueVAT: String(vatPercent),
      soTienThueVAT: formatMoney(soTienThueVAT),
      tongThanhTienSauVAT: formatMoney(tongSauVAT),
      luuYKhacBaoGia: input.note || "",
      missingFields,
    };
  }

  render(data: QuoteData): Buffer {
    if (!fs.existsSync(this.templatePath)) {
      throw new Error(`Không tìm thấy file mẫu Word tại: ${this.templatePath}`);
    }
    const content = fs.readFileSync(this.templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      delimiters: { start: "${", end: "}" },
    });

    doc.render(data);
    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  }

  async buildPreview(customerId: string, input: CreateQuoteInput, docNumber?: string): Promise<QuotePreview> {
    const suggestedDocNumber = await this.suggestNextDocNumber(new Date().getFullYear());
    const shown = docNumber?.trim() || suggestedDocNumber || "…";
    const data = await this.buildData(customerId, shown, input);
    const { extractDocxLines } = await import("../contract/payment-request.service.js");
    const lines = extractDocxLines(this.render(data));
    return { suggestedDocNumber, missingFields: data.missingFields, lines };
  }

  async getExport(exportId: string, customerId: string): Promise<QuoteExportRecord> {
    const rows = await query<QuoteExportRow>(
      "SELECT * FROM quote_exports WHERE id = ? AND customer_id = ?",
      [exportId, customerId]
    );
    if (!rows.length) {
      throw new QuoteNotFoundError("Không tìm thấy lần cấp số báo giá này");
    }
    return toExportRecord(rows[0]);
  }

  async buildDataForExport(record: QuoteExportRecord): Promise<QuoteData> {
    return this.buildData(record.customerId, record.docNumber, {
      serviceType: record.serviceType,
      packageName: record.packageName,
      unit: record.unit,
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      vatPercent: record.vatPercent,
      note: record.note || undefined,
      staffName: record.staffName || undefined,
    });
  }

  /**
   * Xác nhận lấy số báo giá — điểm DUY NHẤT tiêu số. Chạy trong transaction có khóa
   * để hai người xác nhận gần nhau nhận hai số liên tiếp, không trùng, không hụt.
   */
  async confirmExport(customerId: string, input: ConfirmQuoteExportInput): Promise<ConfirmQuoteExportResult> {
    // Kiểm tra khách hàng tồn tại trước khi cấp số.
    await this.buildData(customerId, "0", input);

    const manual = input.docNumber?.trim() || "";
    if (manual && !DOC_NUMBER_PATTERN.test(manual)) {
      throw new QuoteInputError(DOC_NUMBER_INVALID_MESSAGE);
    }

    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('quote_doc_number'))");

      if (input.reuseLatest) {
        const latest = await tx.query<QuoteExportRow>(
          `SELECT * FROM quote_exports WHERE customer_id = ?
           ORDER BY exported_at DESC, id DESC LIMIT 1`,
          [customerId]
        );
        if (latest.length) return { record: toExportRecord(latest[0]), reused: true };
      }

      const now = new Date();
      const yearPrefix = `${now.toISOString().slice(0, 4)}%`;
      const yearRows = await tx.query<{ doc_number: string }>(
        "SELECT doc_number FROM quote_exports WHERE exported_at LIKE ?",
        [yearPrefix]
      );
      const nextNumber = String(maxNumericDocNumber(yearRows) + 1);

      let docNumber = nextNumber;
      if (manual) {
        const dup = await tx.query<QuoteExportRow>(
          `SELECT * FROM quote_exports WHERE exported_at LIKE ? AND doc_number = ?
           ORDER BY exported_at DESC LIMIT 1`,
          [yearPrefix, manual]
        );
        if (dup.length) {
          if (dup[0].customer_id === customerId) {
            return { record: toExportRecord(dup[0]), reused: true };
          }
          throw new QuoteConflictError(
            `Số báo giá ${manual} đã được cấp cho khách hàng khác. ` +
              `Hãy để hệ thống tự cấp số (số kế tiếp là ${nextNumber}) hoặc nhập số khác.`
          );
        }
        docNumber = manual;
      }

      const id = `QUO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const exportedAt = now.toISOString();
      const vatPercent = input.vatPercent ?? 10;
      await tx.run(
        `INSERT INTO quote_exports (
          id, customer_id, doc_number, service_type, package_name, unit, quantity, unit_price,
          vat_percent, note, staff_name, exported_by, exported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          customerId,
          docNumber,
          input.serviceType,
          input.packageName,
          input.unit,
          input.quantity,
          input.unitPrice,
          vatPercent,
          input.note || null,
          input.staffName || null,
          input.exportedBy,
          exportedAt,
        ]
      );

      return {
        record: {
          id,
          customerId,
          docNumber,
          exportedBy: input.exportedBy,
          exportedAt,
          serviceType: input.serviceType,
          packageName: input.packageName,
          unit: input.unit,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          vatPercent,
          note: input.note || null,
          staffName: input.staffName || null,
        },
        reused: false,
      };
    });
  }

  async listExports(customerId?: string): Promise<QuoteExportRecord[]> {
    const rows = await query<QuoteExportRow>(
      `SELECT q.*, c.name as customer_name FROM quote_exports q
       LEFT JOIN customers c ON c.id = q.customer_id
       ${customerId ? "WHERE q.customer_id = ?" : ""}
       ORDER BY q.exported_at DESC`,
      customerId ? [customerId] : []
    );
    return rows.map(toExportRecord);
  }
}
