import type { TransactionClient } from "../../../database/pg-adapter.js";
import {
  buildCustomerIndex,
  classifyContractRows,
  customerMatchMessage,
  matchCustomer,
  type ExistingContract,
  type ImportCustomer,
} from "./classify.js";
import type { ContractImportRow } from "./parse.js";

export type ContractCommitAction = "create" | "update" | "skip";

export interface ContractCommitDecision {
  row: ContractImportRow;
  action: ContractCommitAction;
}

export interface ContractCommitInput {
  decisions: ContractCommitDecision[];
}

export interface ContractCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
}

const EXISTING_SELECT = `
  SELECT id, transaction_code, customer_name, subscriber_codes, total_value, channel,
         am_staff, service_group, service_name, package_name, tax_code, contract_number, signed_date,
         customer_id
  FROM contracts
`;

function nonEmpty(value: string | undefined | null): string {
  return value && value.trim() ? value.trim() : "";
}

async function insertContractFromRow(
  tx: TransactionClient,
  row: ContractImportRow,
  customer: ImportCustomer
): Promise<ExistingContract> {
  const id = `HD-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = nonEmpty(row.channel) || "Import Excel";
  const taxCode = nonEmpty(row.taxCode) || nonEmpty(customer.identity_code) || null;

  await tx.run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue,
      am_staff, service_group, service_name, package_name,
      tax_code, contract_number, signed_date, collected_amount, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      row.transactionCode,
      customer.name,
      JSON.stringify(row.subscriberCodes),
      row.totalValue ?? 0,
      channel,
      "Chưa triển khai",
      "Chưa thanh toán",
      "Soạn thảo",
      0,
      row.amStaff || null,
      row.serviceGroup || null,
      row.serviceName || null,
      row.packageName || null,
      taxCode,
      row.contractNumber || null,
      row.signedDate || null,
      0,
      customer.id,
    ]
  );

  return {
    id,
    transaction_code: row.transactionCode,
    customer_name: customer.name,
    subscriber_codes: JSON.stringify(row.subscriberCodes),
    total_value: row.totalValue ?? 0,
    channel,
    am_staff: row.amStaff || null,
    service_group: row.serviceGroup || null,
    service_name: row.serviceName || null,
    package_name: row.packageName || null,
    tax_code: taxCode,
    contract_number: row.contractNumber || null,
    signed_date: row.signedDate || null,
    customer_id: customer.id,
  };
}

/**
 * `update`: chỉ ghi đè các trường KHÁC RỖNG trong dòng Excel, giữ nguyên các
 * cột không có trong file (cùng quy tắc `use_new` bên customer-import).
 * Khớp được khách -> gán khách (tên khách lấy từ hệ thống); không khớp thì giữ
 * nguyên khách và tên khách hiện có của đơn.
 */
async function applyUpdate(
  tx: TransactionClient,
  target: ExistingContract,
  row: ContractImportRow,
  customer: ImportCustomer | undefined
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const addIfNonEmpty = (column: string, value: string) => {
    const v = nonEmpty(value);
    if (v) {
      sets.push(`${column} = ?`);
      params.push(v);
    }
  };

  if (customer) {
    sets.push("customer_id = ?", "customer_name = ?");
    params.push(customer.id, customer.name);
  }
  if (row.subscriberCodes.length > 0) {
    sets.push("subscriber_codes = ?");
    params.push(JSON.stringify(row.subscriberCodes));
  }
  if (row.totalValue !== null) {
    sets.push("total_value = ?");
    params.push(row.totalValue);
  }
  addIfNonEmpty("channel", row.channel);
  addIfNonEmpty("am_staff", row.amStaff);
  addIfNonEmpty("service_group", row.serviceGroup);
  addIfNonEmpty("service_name", row.serviceName);
  addIfNonEmpty("package_name", row.packageName);
  if (nonEmpty(row.taxCode)) {
    addIfNonEmpty("tax_code", row.taxCode);
  } else if (customer && !nonEmpty(target.tax_code)) {
    addIfNonEmpty("tax_code", customer.identity_code ?? "");
  }
  addIfNonEmpty("contract_number", row.contractNumber);
  addIfNonEmpty("signed_date", row.signedDate);

  if (sets.length === 0) return;
  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(target.id);
  await tx.run(`UPDATE contracts SET ${sets.join(", ")} WHERE id = ?`, params);
}

/**
 * Ghi dữ liệu import hợp đồng theo quyết định admin (preview -> commit).
 * Server không tin kết quả preview: `create` được phân loại lại với DB hiện
 * tại trước khi ghi, để tránh tạo trùng `transaction_code` (UNIQUE), và khách
 * hàng được khớp lại từ DB (dòng tạo mới bắt buộc khớp được khách).
 */
export async function commitContractImportRows(
  tx: TransactionClient,
  input: ContractCommitInput
): Promise<ContractCommitResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { rowNumber: number; message: string }[] = [];

  const liveExisting = await tx.query<ExistingContract>(EXISTING_SELECT);
  const customerIndex = buildCustomerIndex(
    await tx.query<ImportCustomer>("SELECT id, name, identity_code FROM customers")
  );

  for (const decision of input.decisions) {
    const { row, action } = decision;

    if (action === "skip") {
      skipped++;
      continue;
    }

    if (action === "create") {
      const [reclassified] = classifyContractRows([row], liveExisting);
      if (reclassified.existing) {
        errors.push({
          rowNumber: row.rowNumber,
          message: "Mã giao dịch đã tồn tại, vui lòng chọn Cập nhật",
        });
        continue;
      }

      const match = matchCustomer(row, customerIndex);
      if (!match.customer) {
        errors.push({ rowNumber: row.rowNumber, message: customerMatchMessage(match) });
        continue;
      }

      const newContract = await insertContractFromRow(tx, row, match.customer);
      liveExisting.push(newContract);
      created++;
      continue;
    }

    if (action === "update") {
      const target = liveExisting.find(
        (c) => c.transaction_code.trim() === row.transactionCode.trim()
      );
      if (!target) {
        errors.push({
          rowNumber: row.rowNumber,
          message: "Không tìm thấy hợp đồng để cập nhật (mã giao dịch không tồn tại)",
        });
        continue;
      }

      const match = matchCustomer(row, customerIndex);
      if (!match.customer && !target.customer_id) {
        errors.push({ rowNumber: row.rowNumber, message: customerMatchMessage(match) });
        continue;
      }

      await applyUpdate(tx, target, row, match.customer);
      if (match.customer) target.customer_id = match.customer.id;
      updated++;
      continue;
    }

    errors.push({ rowNumber: row.rowNumber, message: `Hành động không hợp lệ: ${action}` });
  }

  return { created, updated, skipped, errors };
}
