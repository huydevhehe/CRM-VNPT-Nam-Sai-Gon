import { normalizeHeader, readWorkbookRows } from "../../customer/customer-import/parse.js";
import { normalizeTaxCode } from "../../../utils/tax-code.js";
import { parseExcelDate } from "../../../utils/excel-date.js";

export { readWorkbookRows };

export interface ServiceImportRow {
  rowNumber: number;
  customerCode: string;
  taxCode: string;
  customerName: string;
  serviceCode: string;
  serviceName: string;
  serviceGroup: string;
  packageName: string;
  paymentType: string;
  startDate: string;
  endDate: string;
  termMonths: number | null;
  amStaff: string;
}

type StringField = Exclude<keyof ServiceImportRow, "rowNumber" | "termMonths">;

const FIELD_ALIASES: { field: StringField; aliases: string[] }[] = [
  { field: "customerCode", aliases: ["ma khach hang", "ma kh"] },
  { field: "taxCode", aliases: ["mst", "ma so thue", "cccd", "cmnd"] },
  { field: "customerName", aliases: ["ten khach hang", "ten kh", "khach hang"] },
  { field: "serviceCode", aliases: ["ma thue bao", "so thue bao"] },
  { field: "serviceName", aliases: ["ten dich vu", "dich vu"] },
  { field: "serviceGroup", aliases: ["nhom dich vu"] },
  { field: "packageName", aliases: ["goi cuoc"] },
  { field: "paymentType", aliases: ["hinh thuc thanh toan"] },
  { field: "startDate", aliases: ["ngay bat dau"] },
  { field: "endDate", aliases: ["ngay ket thuc", "ngay het han"] },
  { field: "amStaff", aliases: ["am phu trach", "am"] },
];

const TERM_MONTHS_ALIASES = ["thoi han thang", "thoi han"];

export const MAX_TERM_MONTHS = 600;

function normalizeColumn(h: string): string {
  return normalizeHeader(h).replace(/[/()]/g, " ").replace(/\s+/g, " ").trim();
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== "__rowNumber") set.add(key);
    }
  }
  return Array.from(set);
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  return headers.find((h) => {
    const norm = normalizeColumn(h);
    if (!norm) return false;
    return aliases.some((alias) => norm === alias || norm.startsWith(`${alias} `));
  });
}

function cellToDate(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string" && !raw.trim()) return "";
  return parseExcelDate(raw) ?? String(raw).trim();
}

/**
 * Chuẩn hóa danh sách dòng thô (key = tiêu đề cột, từ `readWorkbookRows`)
 * thành `ServiceImportRow[]` đã khớp cột theo bí danh tiếng Việt không dấu.
 * Ngày được đổi về `YYYY-MM-DD` nếu nhận diện được (số serial Excel, `DD/MM/YYYY`);
 * giá trị không nhận diện được giữ nguyên để bước phân loại báo lỗi. Hàm thuần, không gọi DB.
 */
export function parseServiceSheet(rows: Record<string, unknown>[]): {
  rows: ServiceImportRow[];
  errors: { rowNumber: number; message: string; row: ServiceImportRow }[];
} {
  const headers = collectHeaders(rows);
  const stringHeaders: Partial<Record<StringField, string>> = {};
  for (const { field, aliases } of FIELD_ALIASES) {
    const found = findHeader(headers, aliases);
    if (found) stringHeaders[field] = found;
  }
  const termHeader = findHeader(headers, TERM_MONTHS_ALIASES);

  const result: ServiceImportRow[] = [];
  const errors: { rowNumber: number; message: string; row: ServiceImportRow }[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = typeof raw.__rowNumber === "number" ? (raw.__rowNumber as number) : idx + 2;

    const isEmptyRow = Object.entries(raw).every(([key, value]) => {
      if (key === "__rowNumber") return true;
      return value === null || value === undefined || String(value).trim() === "";
    });
    if (isEmptyRow) return;

    const getString = (field: StringField): string => {
      const header = stringHeaders[field];
      if (!header) return "";
      const value = raw[header];
      return value === null || value === undefined ? "" : String(value).trim();
    };
    const getDate = (field: "startDate" | "endDate"): string => {
      const header = stringHeaders[field];
      return header ? cellToDate(raw[header]) : "";
    };

    const taxCodeRaw = getString("taxCode");
    const termRaw = termHeader ? raw[termHeader] : "";
    const termText = termRaw === null || termRaw === undefined ? "" : String(termRaw).trim();
    const termNumber = termText ? Number(termText.replace(",", ".")) : null;
    const termValid = termNumber !== null && Number.isInteger(termNumber) && termNumber >= 1 && termNumber <= MAX_TERM_MONTHS;

    const row: ServiceImportRow = {
      rowNumber,
      customerCode: getString("customerCode"),
      taxCode: taxCodeRaw ? normalizeTaxCode(taxCodeRaw) : "",
      customerName: getString("customerName"),
      serviceCode: getString("serviceCode"),
      serviceName: getString("serviceName"),
      serviceGroup: getString("serviceGroup"),
      packageName: getString("packageName"),
      paymentType: getString("paymentType"),
      startDate: getDate("startDate"),
      endDate: getDate("endDate"),
      termMonths: termValid ? termNumber : null,
      amStaff: getString("amStaff"),
    };

    if (!row.serviceCode) {
      errors.push({ rowNumber, message: "Thiếu mã thuê bao", row });
      return;
    }
    if (!row.serviceName) {
      errors.push({ rowNumber, message: "Thiếu tên dịch vụ", row });
      return;
    }
    if (termText && !termValid) {
      errors.push({
        rowNumber,
        message: `Thời hạn (tháng) không hợp lệ (số nguyên từ 1 đến ${MAX_TERM_MONTHS})`,
        row,
      });
      return;
    }

    result.push(row);
  });

  return { rows: result, errors };
}
