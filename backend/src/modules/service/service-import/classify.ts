import { SERVICE_GROUPS, PAYMENT_METHODS } from "../../../constants/org.js";
import { normalizeHeader } from "../../customer/customer-import/parse.js";
import { normalizeTaxCode } from "../../../utils/tax-code.js";
import { todayVn } from "../../../utils/date-vn.js";
import { addMonthsIso, normalizeDateIso, DEFAULT_TERM_MONTHS } from "../contract-service-sync.js";
import type { ServiceImportRow } from "./parse.js";

export interface ImportCustomer {
  id: string;
  name: string;
  identity_code: string | null;
  customer_code: string | null;
  am_staff: string | null;
  am_caring_staff: string | null;
}

export interface ExistingService {
  id: string;
  customer_id: string | null;
  customer_name: string;
  service_code: string;
  service_name: string;
  service_group: string | null;
  package_name: string | null;
  payment_type: string | null;
  start_date: string;
  expiration_date: string;
  staff_name: string | null;
  contract_id: string | null;
  contract_transaction_code: string | null;
}

export interface ResolvedService {
  serviceGroup: string | null;
  paymentType: string | null;
  startDate: string;
  expirationDate: string;
  staffName: string;
}

export interface ClassifiedServiceRow {
  row: ServiceImportRow;
  status: "new" | "update" | "error";
  existing?: ExistingService;
  customer?: ImportCustomer;
  resolved?: ResolvedService;
  notes: string[];
}

export const EXISTING_SERVICES_SQL = `
  SELECT s.id, s.customer_id, s.customer_name, s.service_code, s.service_name, s.service_group,
         s.package_name, s.payment_type, s.start_date, s.expiration_date, s.staff_name, s.contract_id,
         c.transaction_code AS contract_transaction_code
  FROM services s
  LEFT JOIN contracts c ON c.id = s.contract_id
  WHERE s.customer_id IS NOT NULL
  ORDER BY s.id
`;
export const IMPORT_CUSTOMERS_SQL =
  "SELECT id, name, identity_code, customer_code, am_staff, am_caring_staff FROM customers";
export const STAFF_NAMES_SQL = "SELECT name FROM staff";

export const CUSTOMER_NOT_FOUND_MESSAGE = "Không tìm thấy khách hàng trong hệ thống";
export const CUSTOMER_AMBIGUOUS_MESSAGE =
  "Có nhiều khách hàng trùng mã/MST/tên trong hệ thống, không xác định được khách hàng";

export interface CustomerIndex {
  byCode: Map<string, ImportCustomer[]>;
  byTaxCode: Map<string, ImportCustomer[]>;
  byName: Map<string, ImportCustomer[]>;
}

export interface ClassifyContext {
  customers: CustomerIndex;
  services: Map<string, ExistingService[]>;
  servicesByCode: Map<string, ExistingService[]>;
  staffByKey: Map<string, string>;
  today: string;
}

function textKey(value: string | null | undefined): string {
  return (value ?? "").normalize("NFC").trim().toLowerCase();
}

function pushTo<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

function serviceKey(customerId: string, serviceCode: string): string {
  return `${customerId}|${serviceCode.trim()}`;
}

export function buildCustomerIndex(customers: ImportCustomer[]): CustomerIndex {
  const byCode = new Map<string, ImportCustomer[]>();
  const byTaxCode = new Map<string, ImportCustomer[]>();
  const byName = new Map<string, ImportCustomer[]>();
  for (const customer of customers) {
    const code = textKey(customer.customer_code);
    if (code) pushTo(byCode, code, customer);
    const tax = normalizeTaxCode(customer.identity_code);
    if (tax) pushTo(byTaxCode, tax, customer);
    const name = textKey(customer.name);
    if (name) pushTo(byName, name, customer);
  }
  return { byCode, byTaxCode, byName };
}

export function addExistingService(
  ctx: Pick<ClassifyContext, "services" | "servicesByCode">,
  service: ExistingService
): void {
  if (!service.customer_id) return;
  pushTo(ctx.services, serviceKey(service.customer_id, service.service_code), service);
  pushTo(ctx.servicesByCode, service.service_code.trim(), service);
}

export function buildClassifyContext(
  existing: ExistingService[],
  customers: ImportCustomer[],
  staffNames: string[],
  today: string = todayVn()
): ClassifyContext {
  const ctx: ClassifyContext = {
    customers: buildCustomerIndex(customers),
    services: new Map(),
    servicesByCode: new Map(),
    staffByKey: new Map(),
    today,
  };
  for (const service of existing) addExistingService(ctx, service);
  for (const name of staffNames) {
    const key = textKey(name);
    if (key && !ctx.staffByKey.has(key)) ctx.staffByKey.set(key, name);
  }
  return ctx;
}

type CustomerMatch =
  | { customer: ImportCustomer }
  | { customer?: undefined; reason: "not_found" | "ambiguous" };

/**
 * Khớp khách cho một dòng import: ưu tiên Mã khách hàng, sau đó MST/CCCD (đã
 * chuẩn hóa), cuối cùng là tên đúng nguyên văn (không phân biệt hoa/thường).
 * Một tiêu chí khớp nhiều khách -> `ambiguous` (không đoán).
 */
export function matchCustomer(row: ServiceImportRow, index: CustomerIndex): CustomerMatch {
  const attempts: [Map<string, ImportCustomer[]>, string][] = [
    [index.byCode, textKey(row.customerCode)],
    [index.byTaxCode, normalizeTaxCode(row.taxCode)],
    [index.byName, textKey(row.customerName)],
  ];
  for (const [map, key] of attempts) {
    if (!key) continue;
    const found = map.get(key);
    if (found?.length === 1) return { customer: found[0] };
    if (found && found.length > 1) return { reason: "ambiguous" };
  }
  return { reason: "not_found" };
}

function canonicalValue(list: readonly string[], value: string): string | null {
  const key = normalizeHeader(value);
  return list.find((item) => normalizeHeader(item) === key) ?? null;
}

type DatesResult = { startDate: string; expirationDate: string } | { error: string };

/**
 * Tính ngày bắt đầu/kết thúc của dịch vụ. Dòng mới: thiếu bắt đầu thì lấy hôm
 * nay (hoặc ngày kết thúc nếu đã qua), thiếu kết thúc thì bắt đầu + thời hạn
 * (mặc định 12 tháng). Dòng cập nhật: file không có ngày/thời hạn thì giữ nguyên
 * ngày hiện có; thiếu bắt đầu thì giữ ngày bắt đầu hiện có.
 */
export function resolveServiceDates(
  row: ServiceImportRow,
  existing: ExistingService | undefined,
  today: string
): DatesResult {
  const fileStart = row.startDate.trim() ? normalizeDateIso(row.startDate) : null;
  const fileEnd = row.endDate.trim() ? normalizeDateIso(row.endDate) : null;
  if (row.startDate.trim() && !fileStart) {
    return { error: "Ngày bắt đầu không hợp lệ (dùng YYYY-MM-DD hoặc DD/MM/YYYY)" };
  }
  if (row.endDate.trim() && !fileEnd) {
    return { error: "Ngày kết thúc không hợp lệ (dùng YYYY-MM-DD hoặc DD/MM/YYYY)" };
  }
  if (fileStart && fileEnd && fileEnd < fileStart) {
    return { error: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu" };
  }

  let startDate: string;
  let expirationDate: string;
  if (existing) {
    startDate = fileStart ?? existing.start_date;
    expirationDate =
      fileEnd ??
      (fileStart || row.termMonths !== null
        ? addMonthsIso(startDate, row.termMonths ?? DEFAULT_TERM_MONTHS)
        : existing.expiration_date);
  } else {
    startDate = fileStart ?? (fileEnd && fileEnd < today ? fileEnd : today);
    expirationDate = fileEnd ?? addMonthsIso(startDate, row.termMonths ?? DEFAULT_TERM_MONTHS);
  }
  if (expirationDate < startDate) {
    return { error: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu" };
  }
  return { startDate, expirationDate };
}

/**
 * Phân loại một dòng import dịch vụ theo (khách hàng + mã thuê bao): khách chưa
 * có mã đó -> `new`; đã có dòng nhập tay cùng mã -> `update`; mã thuộc dịch vụ
 * sinh từ đơn hàng hoặc dữ liệu không hợp lệ -> `error`. Hàm thuần theo `ctx`.
 */
export function classifyServiceRow(row: ServiceImportRow, ctx: ClassifyContext): ClassifiedServiceRow {
  const fail = (message: string, customer?: ImportCustomer): ClassifiedServiceRow => ({
    row,
    status: "error",
    customer,
    notes: [message],
  });

  const match = matchCustomer(row, ctx.customers);
  if (!match.customer) {
    return fail(match.reason === "ambiguous" ? CUSTOMER_AMBIGUOUS_MESSAGE : CUSTOMER_NOT_FOUND_MESSAGE);
  }
  const customer = match.customer;

  if (!row.serviceCode.trim()) return fail("Thiếu mã thuê bao", customer);
  if (!row.serviceName.trim()) return fail("Thiếu tên dịch vụ", customer);

  let serviceGroup: string | null = null;
  if (row.serviceGroup.trim()) {
    serviceGroup = canonicalValue(SERVICE_GROUPS, row.serviceGroup);
    if (!serviceGroup) {
      return fail(`Nhóm dịch vụ không hợp lệ (chọn: ${SERVICE_GROUPS.join(", ")})`, customer);
    }
  }
  let paymentType: string | null = null;
  if (row.paymentType.trim()) {
    paymentType = canonicalValue(PAYMENT_METHODS, row.paymentType);
    if (!paymentType) {
      return fail(`Hình thức thanh toán không hợp lệ (chọn: ${PAYMENT_METHODS.join(", ")})`, customer);
    }
  }

  let staffFromFile: string | null = null;
  if (row.amStaff.trim()) {
    staffFromFile = ctx.staffByKey.get(textKey(row.amStaff)) ?? null;
    if (!staffFromFile) {
      return fail(`AM phụ trách "${row.amStaff.trim()}" không tồn tại trong hệ thống`, customer);
    }
  }

  const sameCode = ctx.services.get(serviceKey(customer.id, row.serviceCode)) ?? [];
  const linked = sameCode.find((s) => s.contract_id);
  if (linked) {
    return fail(
      `Mã thuê bao thuộc đơn hàng ${linked.contract_transaction_code || linked.contract_id}, vui lòng chỉnh ở đơn hàng`,
      customer
    );
  }
  const existing = sameCode[0];

  const dates = resolveServiceDates(row, existing, ctx.today);
  if ("error" in dates) return fail(dates.error, customer);

  const defaultStaff = customer.am_staff?.trim() || customer.am_caring_staff?.trim() || "";
  const staffName = staffFromFile ?? (existing?.staff_name?.trim() ? existing.staff_name : defaultStaff);

  const notes: string[] = [];
  if (!existing) {
    const other = (ctx.servicesByCode.get(row.serviceCode.trim()) ?? []).find(
      (s) => s.customer_id !== customer.id
    );
    if (other) {
      notes.push(`Mã thuê bao này đang gắn với khách hàng khác: ${other.customer_name}`);
    }
  }

  return {
    row,
    status: existing ? "update" : "new",
    existing,
    customer,
    resolved: {
      serviceGroup: serviceGroup ?? existing?.service_group ?? null,
      paymentType: paymentType ?? existing?.payment_type ?? null,
      startDate: dates.startDate,
      expirationDate: dates.expirationDate,
      staffName,
    },
    notes,
  };
}

export function classifyServiceRows(
  rows: ServiceImportRow[],
  existing: ExistingService[],
  customers: ImportCustomer[],
  staffNames: string[],
  today?: string
): ClassifiedServiceRow[] {
  const ctx = buildClassifyContext(existing, customers, staffNames, today);
  const classified = rows.map((row) => classifyServiceRow(row, ctx));

  const byKey = new Map<string, number[]>();
  for (const item of classified) {
    if (item.status === "error" || !item.customer) continue;
    pushTo(byKey, serviceKey(item.customer.id, item.row.serviceCode), item.row.rowNumber);
  }
  for (const item of classified) {
    if (item.status === "error" || !item.customer) continue;
    const rowNumbers = byKey.get(serviceKey(item.customer.id, item.row.serviceCode)) ?? [];
    const others = rowNumbers.filter((n) => n !== item.row.rowNumber);
    if (others.length === 0) continue;
    const isLast = item.row.rowNumber === Math.max(...rowNumbers);
    item.notes.push(
      `Trùng khách hàng + mã thuê bao với dòng ${others.join(", ")} trong cùng file` +
        (isLast ? ", dòng này được ưu tiên" : ", dòng sau được ưu tiên")
    );
  }
  return classified;
}
