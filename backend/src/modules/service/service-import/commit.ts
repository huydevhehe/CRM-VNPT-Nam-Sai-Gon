import type { TransactionClient } from "../../../database/pg-adapter.js";
import { refreshCustomerSummary } from "../service.service.js";
import {
  EXISTING_SERVICES_SQL,
  IMPORT_CUSTOMERS_SQL,
  STAFF_NAMES_SQL,
  addExistingService,
  buildClassifyContext,
  classifyServiceRow,
  type ExistingService,
  type ImportCustomer,
  type ResolvedService,
} from "./classify.js";
import { MAX_TERM_MONTHS, type ServiceImportRow } from "./parse.js";

export type ServiceCommitAction = "create" | "update" | "skip";

export interface ServiceCommitDecision {
  row: ServiceImportRow;
  action: ServiceCommitAction;
}

export interface ServiceCommitInput {
  decisions: ServiceCommitDecision[];
}

export interface ServiceCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function sanitizeRow(raw: Partial<Record<keyof ServiceImportRow, unknown>>): ServiceImportRow {
  const term = Number(raw.termMonths);
  return {
    rowNumber: Number.isFinite(Number(raw.rowNumber)) ? Number(raw.rowNumber) : 0,
    customerCode: text(raw.customerCode),
    taxCode: text(raw.taxCode),
    customerName: text(raw.customerName),
    serviceCode: text(raw.serviceCode),
    serviceName: text(raw.serviceName),
    serviceGroup: text(raw.serviceGroup),
    packageName: text(raw.packageName),
    paymentType: text(raw.paymentType),
    startDate: text(raw.startDate),
    endDate: text(raw.endDate),
    termMonths:
      raw.termMonths !== null && raw.termMonths !== "" && Number.isInteger(term) && term >= 1 && term <= MAX_TERM_MONTHS
        ? term
        : null,
    amStaff: text(raw.amStaff),
  };
}

async function insertService(
  tx: TransactionClient,
  row: ServiceImportRow,
  customer: ImportCustomer,
  resolved: ResolvedService
): Promise<ExistingService> {
  const id = `SRV-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const packageName = row.packageName || null;

  await tx.run(
    `INSERT INTO services (
      id, customer_name, service_name, service_code, start_date, expiration_date, staff_name,
      customer_id, service_group, package_name, payment_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      customer.name,
      row.serviceName,
      row.serviceCode,
      resolved.startDate,
      resolved.expirationDate,
      resolved.staffName,
      customer.id,
      resolved.serviceGroup,
      packageName,
      resolved.paymentType,
    ]
  );

  return {
    id,
    customer_id: customer.id,
    customer_name: customer.name,
    service_code: row.serviceCode,
    service_name: row.serviceName,
    service_group: resolved.serviceGroup,
    package_name: packageName,
    payment_type: resolved.paymentType,
    start_date: resolved.startDate,
    expiration_date: resolved.expirationDate,
    staff_name: resolved.staffName,
    contract_id: null,
    contract_transaction_code: null,
  };
}

/**
 * `update`: ghi đè tên dịch vụ, ngày, AM, nhóm và hình thức thanh toán đã tính
 * sẵn (cột file để trống thì `resolved` đã giữ giá trị hiện có); gói cước chỉ
 * ghi khi file có giá trị.
 */
async function applyUpdate(
  tx: TransactionClient,
  target: ExistingService,
  row: ServiceImportRow,
  customer: ImportCustomer,
  resolved: ResolvedService
): Promise<void> {
  const next = {
    customer_name: customer.name,
    service_name: row.serviceName,
    start_date: resolved.startDate,
    expiration_date: resolved.expirationDate,
    staff_name: resolved.staffName,
    service_group: resolved.serviceGroup,
    package_name: row.packageName || target.package_name,
    payment_type: resolved.paymentType,
  };

  await tx.run(
    `UPDATE services SET
       customer_name = ?, service_name = ?, start_date = ?, expiration_date = ?, staff_name = ?,
       service_group = ?, package_name = ?, payment_type = ?
     WHERE id = ?`,
    [
      next.customer_name,
      next.service_name,
      next.start_date,
      next.expiration_date,
      next.staff_name,
      next.service_group,
      next.package_name,
      next.payment_type,
      target.id,
    ]
  );
  Object.assign(target, next);
}

/**
 * Ghi dữ liệu import dịch vụ theo quyết định admin (preview -> commit). Server
 * không tin kết quả preview: mỗi dòng được khớp khách và phân loại lại với DB
 * hiện tại. Dòng trùng khách + mã thuê bao trong cùng file được xử lý theo thứ
 * tự dòng, dòng sau ghi đè dòng trước. Chạy trong transaction của nơi gọi.
 */
export async function commitServiceImportRows(
  tx: TransactionClient,
  input: ServiceCommitInput
): Promise<ServiceCommitResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { rowNumber: number; message: string }[] = [];
  const affectedCustomers = new Set<string>();
  const createdIds = new Set<string>();

  const [existing, customers, staff] = await Promise.all([
    tx.query<ExistingService>(EXISTING_SERVICES_SQL),
    tx.query<ImportCustomer>(IMPORT_CUSTOMERS_SQL),
    tx.query<{ name: string }>(STAFF_NAMES_SQL),
  ]);
  const ctx = buildClassifyContext(
    existing,
    customers,
    staff.map((s) => s.name)
  );

  const decisions = input.decisions
    .map((d) => ({ row: sanitizeRow(d?.row ?? {}), action: d?.action as string }))
    .sort((a, b) => a.row.rowNumber - b.row.rowNumber);

  for (const { row, action } of decisions) {
    if (action === "skip") {
      skipped++;
      continue;
    }
    if (action !== "create" && action !== "update") {
      errors.push({ rowNumber: row.rowNumber, message: `Hành động không hợp lệ: ${action}` });
      continue;
    }

    const classified = classifyServiceRow(row, ctx);
    if (classified.status === "error" || !classified.customer || !classified.resolved) {
      errors.push({ rowNumber: row.rowNumber, message: classified.notes[0] });
      continue;
    }
    const { customer, resolved, existing: target } = classified;

    if (action === "create") {
      if (target && !createdIds.has(target.id)) {
        errors.push({
          rowNumber: row.rowNumber,
          message: "Khách hàng đã có mã thuê bao này, vui lòng chọn Cập nhật",
        });
        continue;
      }
      if (target) {
        await applyUpdate(tx, target, row, customer, resolved);
        updated++;
      } else {
        const inserted = await insertService(tx, row, customer, resolved);
        addExistingService(ctx, inserted);
        createdIds.add(inserted.id);
        created++;
      }
    } else {
      if (!target) {
        errors.push({
          rowNumber: row.rowNumber,
          message: "Không tìm thấy dịch vụ để cập nhật (khách hàng chưa có mã thuê bao này)",
        });
        continue;
      }
      await applyUpdate(tx, target, row, customer, resolved);
      updated++;
    }
    affectedCustomers.add(customer.id);
  }

  for (const customerId of affectedCustomers) {
    await refreshCustomerSummary(customerId, tx);
  }

  return { created, updated, skipped, errors };
}
