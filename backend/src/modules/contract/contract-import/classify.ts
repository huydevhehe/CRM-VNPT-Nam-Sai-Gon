import { normalizeTaxCode } from "../../../utils/tax-code.js";
import type { ContractImportRow } from "./parse.js";

export interface ExistingContract {
  id: string;
  transaction_code: string;
  customer_name: string;
  subscriber_codes: string;
  total_value: number;
  channel: string;
  am_staff: string | null;
  service_group: string | null;
  service_name: string | null;
  package_name: string | null;
  tax_code: string | null;
  contract_number: string | null;
  signed_date: string | null;
  customer_id: string | null;
}

export interface ImportCustomer {
  id: string;
  name: string;
  identity_code: string | null;
}

export interface ClassifiedContractRow {
  row: ContractImportRow;
  status: "new" | "update" | "error";
  existing?: ExistingContract;
  customer?: ImportCustomer;
  notes: string[];
}

export const CUSTOMER_NOT_FOUND_MESSAGE = "Không tìm thấy khách hàng trong hệ thống (MST/tên)";
export const CUSTOMER_AMBIGUOUS_MESSAGE =
  "Có nhiều khách hàng trùng MST/tên trong hệ thống, không xác định được khách hàng";

export type CustomerMatch =
  | { customer: ImportCustomer }
  | { customer?: undefined; reason: "not_found" | "ambiguous" };

export interface CustomerIndex {
  byTaxCode: Map<string, ImportCustomer[]>;
  byName: Map<string, ImportCustomer[]>;
}

function nameKey(name: string): string {
  return name.normalize("NFC").trim().toLowerCase();
}

function pushTo(map: Map<string, ImportCustomer[]>, key: string, customer: ImportCustomer): void {
  const list = map.get(key);
  if (list) list.push(customer);
  else map.set(key, [customer]);
}

export function buildCustomerIndex(customers: ImportCustomer[]): CustomerIndex {
  const byTaxCode = new Map<string, ImportCustomer[]>();
  const byName = new Map<string, ImportCustomer[]>();
  for (const customer of customers) {
    const tax = normalizeTaxCode(customer.identity_code);
    if (tax) pushTo(byTaxCode, tax, customer);
    const name = nameKey(customer.name ?? "");
    if (name) pushTo(byName, name, customer);
  }
  return { byTaxCode, byName };
}

/**
 * Tìm khách hàng trong hệ thống cho một dòng import: ưu tiên MST
 * (`customers.identity_code`, đã chuẩn hóa), sau đó tên khách đúng nguyên văn
 * (không phân biệt hoa/thường). Trùng nhiều khách -> `ambiguous` (không đoán).
 */
export function matchCustomer(row: ContractImportRow, index: CustomerIndex): CustomerMatch {
  const tax = normalizeTaxCode(row.taxCode);
  if (tax) {
    const found = index.byTaxCode.get(tax);
    if (found?.length === 1) return { customer: found[0] };
    if (found && found.length > 1) return { reason: "ambiguous" };
  }

  const name = nameKey(row.customerName ?? "");
  if (name) {
    const found = index.byName.get(name);
    if (found?.length === 1) return { customer: found[0] };
    if (found && found.length > 1) return { reason: "ambiguous" };
  }

  return { reason: "not_found" };
}

export function customerMatchMessage(match: CustomerMatch): string {
  return match.customer
    ? ""
    : match.reason === "ambiguous"
      ? CUSTOMER_AMBIGUOUS_MESSAGE
      : CUSTOMER_NOT_FOUND_MESSAGE;
}

/**
 * Phân loại dòng import hợp đồng theo `transaction_code` (khóa UNIQUE): trùng
 * mã với DB -> `update`, không trùng -> `new`. Dòng `new` bắt buộc khớp được
 * khách hàng; dòng `update` chỉ lỗi khi không khớp được khách mà đơn hiện có
 * cũng chưa gắn khách. Hàm thuần, không gọi DB.
 */
export function classifyContractRows(
  rows: ContractImportRow[],
  existing: ExistingContract[],
  customers: ImportCustomer[] = []
): ClassifiedContractRow[] {
  const customerIndex = buildCustomerIndex(customers);
  const existingByCode = new Map<string, ExistingContract>();
  for (const c of existing) {
    existingByCode.set(c.transaction_code.trim(), c);
  }

  const codeToFirstRowNumber = new Map<string, number>();
  for (const row of rows) {
    const code = row.transactionCode.trim();
    if (!code) continue;
    if (!codeToFirstRowNumber.has(code)) {
      codeToFirstRowNumber.set(code, row.rowNumber);
    }
  }

  return rows.map((row) => {
    const code = row.transactionCode.trim();
    const existingMatch = existingByCode.get(code);
    const notes: string[] = [];

    const firstRowNumber = codeToFirstRowNumber.get(code);
    if (firstRowNumber !== undefined && firstRowNumber !== row.rowNumber) {
      notes.push(`Trùng mã giao dịch với dòng ${firstRowNumber} trong cùng file`);
    }

    const match = matchCustomer(row, customerIndex);
    const needsCustomer = !existingMatch || !existingMatch.customer_id;
    if (!match.customer && needsCustomer) {
      return {
        row,
        status: "error",
        existing: existingMatch,
        notes: [customerMatchMessage(match), ...notes],
      };
    }

    return {
      row,
      status: existingMatch ? "update" : "new",
      existing: existingMatch,
      customer: match.customer,
      notes,
    };
  });
}
