import { normalizeHeader, readWorkbookRows } from "../../customer/customer-import/parse.js";
import { normalizeTaxCode } from "../../../utils/tax-code.js";
import type { ContractItemInput } from "../contract-items.js";
import { expandLegacyItems } from "../contract-items.js";

export { readWorkbookRows };

export type ImportLineType = "service" | "device";

/**
 * Một DÒNG EXCEL thô đã khớp cột (T9, STT 10/11): mỗi dòng = một dịch vụ hoặc
 * một thiết bị; nhiều dòng cùng `transactionCode` được gộp thành MỘT đơn hàng
 * (xem `groupContractImportLines`). Vẫn đọc được file mẫu cũ: một dòng duy
 * nhất với nhiều mã thuê bao cách nhau dấu phẩy + "Giá trị đơn hàng" chung.
 */
export interface ContractImportLine {
  rowNumber: number;
  transactionCode: string;
  customerName: string;
  lineType: ImportLineType;
  subscriberCodes: string[];
  quantity: number | null;
  unitPrice: number | null;
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

/**
 * Một ĐƠN HÀNG đã gộp từ các dòng cùng `transactionCode`. `items` là danh sách
 * dòng dịch vụ/thiết bị (chưa validate — `normalizeContractItems` validate ở
 * bước classify/commit) để ghi vào `contract_items`.
 */
export interface ContractImportRow {
  /** Dòng Excel đại diện (dòng đầu của nhóm) — dùng để báo lỗi/hiển thị. */
  rowNumber: number;
  /** Mọi dòng Excel đã gộp vào đơn này. */
  rowNumbers: number[];
  transactionCode: string;
  customerName: string;
  /** Tổng hợp mã thuê bao của mọi dòng dịch vụ trong đơn (hiển thị/tương thích cũ). */
  subscriberCodes: string[];
  /** Tổng tiền tính từ các dòng (hoặc giá trị khai báo kiểu cũ nếu đơn không có dòng nào). */
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
  items: ContractItemInput[];
}

type StringField = Exclude<
  keyof ContractImportLine,
  "rowNumber" | "subscriberCodes" | "totalValue" | "termMonths" | "quantity" | "unitPrice" | "lineType"
>;

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
const LINE_TYPE_ALIASES = ["loai dong", "loai"];
const QUANTITY_ALIASES = ["so luong"];
const UNIT_PRICE_ALIASES = ["don gia"];

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
  lineType?: string;
  quantity?: string;
  unitPrice?: string;
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
    lineType: findHeader(headers, LINE_TYPE_ALIASES),
    quantity: findHeader(headers, QUANTITY_ALIASES),
    unitPrice: findHeader(headers, UNIT_PRICE_ALIASES),
  };
}

function parseSubscriberCodes(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMoney(raw: unknown): number | null {
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

function parseQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isInteger(num) && num >= 1 ? num : null;
}

function parseLineType(raw: unknown): ImportLineType {
  const norm = normalizeHeader(String(raw ?? ""));
  if (!norm) return "service";
  if (norm.includes("thiet bi") || norm.includes("device")) return "device";
  return "service";
}

/**
 * Chuẩn hóa danh sách dòng Excel thô (key = tiêu đề cột, từ `readWorkbookRows`)
 * thành `ContractImportLine[]` — mỗi dòng Excel một phần tử, CHƯA gộp theo mã
 * giao dịch (xem `groupContractImportLines`). Hàm thuần, không gọi DB.
 */
export function parseContractSheet(rows: Record<string, unknown>[]): {
  lines: ContractImportLine[];
  errors: { rowNumber: number; message: string }[];
} {
  const headers = collectHeaders(rows);
  const headerMap = buildHeaderMap(headers);

  const result: ContractImportLine[] = [];
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
      lineType: headerMap.lineType ? parseLineType(raw[headerMap.lineType]) : "service",
      subscriberCodes: headerMap.subscriberCodes
        ? parseSubscriberCodes(raw[headerMap.subscriberCodes])
        : [],
      quantity: headerMap.quantity ? parseQuantity(raw[headerMap.quantity]) : null,
      unitPrice: headerMap.unitPrice ? parseMoney(raw[headerMap.unitPrice]) : null,
      totalValue: headerMap.totalValue ? parseMoney(raw[headerMap.totalValue]) : null,
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

  return { lines: result, errors };
}

function firstNonEmpty(lines: ContractImportLine[], field: StringField): string {
  for (const line of lines) {
    const value = (line[field] as string) || "";
    if (value.trim()) return value.trim();
  }
  return "";
}

/** Dòng Excel có thông tin để trở thành một dòng dịch vụ/thiết bị (không phải dòng chỉ sửa thông tin chung). */
function lineContributesItem(line: ContractImportLine): boolean {
  return line.subscriberCodes.length > 0 || line.unitPrice !== null || line.lineType === "device";
}

/**
 * Chuẩn hóa các dòng Excel của MỘT đơn thành danh sách `ContractItemInput`
 * (chưa qua `normalizeContractItems`). Hàm thuần, không gọi DB.
 * - Kiểu mới: mỗi dòng Excel góp đúng 1 dòng dịch vụ/thiết bị.
 * - Kiểu cũ (tương thích): đúng 1 dòng Excel, nhiều mã thuê bao cách nhau dấu
 *   phẩy, không khai "Loại dòng"/"Đơn giá" riêng -> chia đều "Giá trị đơn hàng".
 * - Dòng Excel không có thông tin dịch vụ/thiết bị (chỉ sửa thông tin chung,
 *   dùng khi cập nhật) -> không góp dòng nào.
 */
export function buildImportItems(lines: ContractImportLine[]): ContractItemInput[] {
  const contributing = lines.filter(lineContributesItem);
  if (contributing.length === 0) return [];

  const legacySingleRow =
    contributing.length === 1 &&
    contributing[0].lineType === "service" &&
    contributing[0].unitPrice === null &&
    contributing[0].subscriberCodes.length > 1;

  if (legacySingleRow) {
    const line = contributing[0];
    const expanded = expandLegacyItems({
      subscriberCodes: line.subscriberCodes,
      totalValue: line.totalValue ?? 0,
      serviceGroup: line.serviceGroup || null,
      serviceName: line.serviceName || null,
      packageName: line.packageName || null,
      termMonths: line.termMonths,
    });
    return expanded.map((it) => ({
      lineType: "service",
      serviceGroup: it.serviceGroup,
      serviceName: it.serviceName,
      packageName: it.packageName,
      subscriberCode: it.subscriberCode,
      quantity: 1,
      unitPrice: it.unitPrice,
      termMonths: it.termMonths,
      startDate: it.startDate,
      note: it.note,
    }));
  }

  return contributing.map((line) => {
    const isDevice = line.lineType === "device";
    const code = isDevice ? null : line.subscriberCodes[0] ?? "";
    // Đúng 1 dòng dịch vụ kiểu cũ (1 mã, không khai "Đơn giá" riêng) -> dùng cả "Giá trị đơn hàng" làm đơn giá.
    const unitPrice =
      line.unitPrice !== null ? line.unitPrice : contributing.length === 1 ? line.totalValue ?? 0 : 0;
    return {
      lineType: line.lineType,
      serviceGroup: line.serviceGroup || null,
      serviceName: line.serviceName || null,
      packageName: line.packageName || null,
      subscriberCode: code,
      quantity: isDevice ? line.quantity ?? 1 : 1,
      unitPrice,
      termMonths: line.termMonths,
      startDate: null,
      note: line.note || null,
    } satisfies ContractItemInput;
  });
}

/**
 * Gộp các dòng Excel (`ContractImportLine`) theo `transactionCode` thành các
 * đơn hàng (`ContractImportRow`) — STT 10/11: "một mã GD có thể có nhiều dịch
 * vụ/gói cước... mỗi dịch vụ 1 mã thuê bao, có thể mua thêm thiết bị". Hàm
 * thuần, không gọi DB; thứ tự đơn giữ theo lần xuất hiện đầu tiên trong file.
 */
export function groupContractImportLines(lines: ContractImportLine[]): ContractImportRow[] {
  const order: string[] = [];
  const byCode = new Map<string, ContractImportLine[]>();

  for (const line of lines) {
    const code = line.transactionCode.trim();
    if (!byCode.has(code)) {
      byCode.set(code, []);
      order.push(code);
    }
    byCode.get(code)!.push(line);
  }

  return order.map((code) => {
    const groupLines = byCode.get(code)!;
    const first = groupLines[0];
    const items = buildImportItems(groupLines);
    const totalValue = items.length
      ? items.reduce((sum, it) => sum + Number(it.unitPrice) * Number(it.quantity ?? 1), 0)
      : first.totalValue ?? null;

    return {
      rowNumber: first.rowNumber,
      rowNumbers: groupLines.map((l) => l.rowNumber),
      transactionCode: code,
      customerName: first.customerName,
      subscriberCodes: items
        .filter((i) => i.subscriberCode)
        .map((i) => String(i.subscriberCode)),
      totalValue,
      termMonths: first.termMonths,
      channel: firstNonEmpty(groupLines, "channel"),
      amStaff: firstNonEmpty(groupLines, "amStaff"),
      serviceGroup: firstNonEmpty(groupLines, "serviceGroup"),
      serviceName: firstNonEmpty(groupLines, "serviceName"),
      packageName: firstNonEmpty(groupLines, "packageName"),
      taxCode: firstNonEmpty(groupLines, "taxCode"),
      contractNumber: firstNonEmpty(groupLines, "contractNumber"),
      signedDate: firstNonEmpty(groupLines, "signedDate"),
      note: groupLines.map((l) => l.note).filter(Boolean).join("; "),
      items,
    };
  });
}
