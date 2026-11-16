import { normalizeHeader, readWorkbookRows } from "../../customer/customer-import/parse.js";
import { normalizeTaxCode } from "../../../utils/tax-code.js";

export { readWorkbookRows };

export interface ContractImportRow {
  rowNumber: number;
  transactionCode: string;
  customerName: string;
  subscriberCodes: string[];
  totalValue: number | null;
  termMonths: number | null;
  channel: string;
  amStaff: string;
  serviceGroup: string;
  serviceName: string;
  packageName: string;
  taxCode: string;
  contractNumber: string;
  signedDate: string;
  note: string;
}

type StringField = Exclude<keyof ContractImportRow, "rowNumber" | "subscriberCodes" | "totalValue" | "termMonths">;

interface FieldAliasDef {
  field: StringField;
  aliases: string[];
}

const FIELD_ALIASES: FieldAliasDef[] = [
  { field: "transactionCode", aliases: ["ma giao dich", "ma gd"] },
  { field: "customerName", aliases: ["ten khach hang", "khach hang"] },
  { field: "channel", aliases: ["kenh"] },
  { field: "amStaff", aliases: ["am phu trach", "am"] },
  { field: "serviceGroup", aliases: ["nhom dich vu"] },
  { field: "serviceName", aliases: ["ten dich vu"] },
  { field: "packageName", aliases: ["goi cuoc"] },
  { field: "taxCode", aliases: ["mst", "ma so thue"] },
  { field: "contractNumber", aliases: ["so hop dong"] },
  { field: "signedDate", aliases: ["ngay ky"] },
  { field: "note", aliases: ["ghi chu"] },
];

const SUBSCRIBER_CODES_ALIASES = ["ma thue bao"];
const TOTAL_VALUE_ALIASES = ["gia tri don hang", "gia tri hop dong", "gia tri"];
const TERM_MONTHS_ALIASES = ["thoi han thang", "thoi han"];

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
    const norm = normalizeHeader(h);
    if (!norm) return false;
    return aliases.some((alias) => norm === alias || norm.startsWith(`${alias} `));
  });
}

function buildHeaderMap(headers: string[]): {
  stringFields: Partial<Record<StringField, string>>;
  subscriberCodes?: string;
  totalValue?: string;
  termMonths?: string;
} {
  const stringFields: Partial<Record<StringField, string>> = {};
  for (const { field, aliases } of FIELD_ALIASES) {
    const found = findHeader(headers, aliases);
    if (found) stringFields[field] = found;
  }
  return {
    stringFields,
    subscriberCodes: findHeader(headers, SUBSCRIBER_CODES_ALIASES),
    totalValue: findHeader(headers, TOTAL_VALUE_ALIASES),
    termMonths: findHeader(headers, TERM_MONTHS_ALIASES),
  };
}

function parseSubscriberCodes(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTotalValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isNaN(raw) ? null : raw;
  const cleaned = String(raw).trim().replace(/[.,\s]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parseTermMonths(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  return Number.isInteger(num) && num >= 1 ? num : null;
}

/**
 * Chuẩn hóa danh sách dòng thô (key = tiêu đề cột, từ `readWorkbookRows`)
 * thành `ContractImportRow[]` đã khớp cột theo bí danh tiếng Việt không dấu.
 * Hàm thuần, không gọi DB.
 */
export function parseContractSheet(rows: Record<string, unknown>[]): {
  rows: ContractImportRow[];
  errors: { rowNumber: number; message: string }[];
} {
  const headers = collectHeaders(rows);
  const headerMap = buildHeaderMap(headers);

  const result: ContractImportRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber =
      typeof raw.__rowNumber === "number" ? (raw.__rowNumber as number) : idx + 2;

    const getString = (field: StringField): string => {
      const header = headerMap.stringFields[field];
      if (!header) return "";
      const value = raw[header];
      return value === null || value === undefined ? "" : String(value).trim();
    };

    const isEmptyRow = Object.entries(raw).every(([key, value]) => {
      if (key === "__rowNumber") return true;
      return value === null || value === undefined || String(value).trim() === "";
    });
    if (isEmptyRow) return;

    const transactionCode = getString("transactionCode");
    const customerName = getString("customerName");

    if (!transactionCode) {
      errors.push({ rowNumber, message: "Thiếu mã giao dịch" });
      return;
    }
    if (!customerName) {
      errors.push({ rowNumber, message: "Thiếu tên khách hàng" });
      return;
    }

    const taxCodeRaw = getString("taxCode");

    result.push({
      rowNumber,
      transactionCode,
      customerName,
      subscriberCodes: headerMap.subscriberCodes
        ? parseSubscriberCodes(raw[headerMap.subscriberCodes])
        : [],
      totalValue: headerMap.totalValue ? parseTotalValue(raw[headerMap.totalValue]) : null,
      termMonths: headerMap.termMonths ? parseTermMonths(raw[headerMap.termMonths]) : null,
      channel: getString("channel"),
      amStaff: getString("amStaff"),
      serviceGroup: getString("serviceGroup"),
      serviceName: getString("serviceName"),
      packageName: getString("packageName"),
      taxCode: taxCodeRaw ? normalizeTaxCode(taxCodeRaw) : "",
      contractNumber: getString("contractNumber"),
      signedDate: getString("signedDate"),
      note: getString("note"),
    });
  });

  return { rows: result, errors };
}
