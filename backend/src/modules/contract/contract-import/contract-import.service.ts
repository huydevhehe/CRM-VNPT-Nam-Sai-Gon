import { query, transaction } from "../../../database/db.js";
import { groupContractImportLines, parseContractSheet, readWorkbookRows } from "./parse.js";
import {
  classifyContractRows,
  type ClassifiedContractRow,
  type ExistingContract,
  type ImportCustomer,
} from "./classify.js";
import { commitContractImportRows, type ContractCommitInput, type ContractCommitResult } from "./commit.js";

export const MAX_IMPORT_ROWS = 5000;

export class ContractImportServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 = 400
  ) {
    super(message);
  }
}

export interface ContractPreviewResult {
  rows: ClassifiedContractRow[];
  summary: {
    total: number;
    new: number;
    update: number;
    error: number;
  };
}

async function loadExistingContracts(): Promise<ExistingContract[]> {
  return query<ExistingContract>(
    `SELECT id, transaction_code, customer_name, subscriber_codes, total_value, channel,
            am_staff, service_group, service_name, package_name, tax_code, contract_number, signed_date,
            customer_id
     FROM contracts`
  );
}

async function loadCustomers(): Promise<ImportCustomer[]> {
  return query<ImportCustomer>("SELECT id, name, identity_code FROM customers");
}

export class ContractImportService {
  async preview(buffer: Buffer): Promise<ContractPreviewResult> {
    const rawRows = readWorkbookRows(buffer);
    if (rawRows.length > MAX_IMPORT_ROWS) {
      throw new ContractImportServiceError(`File vượt quá giới hạn ${MAX_IMPORT_ROWS} dòng`);
    }

    const { lines, errors } = parseContractSheet(rawRows);
    const rows = groupContractImportLines(lines);
    const [existing, customers] = await Promise.all([loadExistingContracts(), loadCustomers()]);

    const classified = classifyContractRows(rows, existing, customers);

    const errorRows: ClassifiedContractRow[] = errors.map((e) => ({
      row: {
        rowNumber: e.rowNumber,
        rowNumbers: [e.rowNumber],
        transactionCode: "",
        customerName: "",
        subscriberCodes: [],
        totalValue: null,
        termMonths: null,
        channel: "",
        amStaff: "",
        serviceGroup: "",
        serviceName: "",
        packageName: "",
        taxCode: "",
        contractNumber: "",
        signedDate: "",
        note: "",
        items: [],
      },
      status: "error",
      notes: [e.message],
    }));

    const allRows = [...classified, ...errorRows].sort((a, b) => a.row.rowNumber - b.row.rowNumber);

    const summary = {
      total: allRows.length,
      new: classified.filter((r) => r.status === "new").length,
      update: classified.filter((r) => r.status === "update").length,
      error: allRows.filter((r) => r.status === "error").length,
    };

    return { rows: allRows, summary };
  }

  async commit(input: ContractCommitInput, operator: string): Promise<ContractCommitResult> {
    if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
      throw new ContractImportServiceError("Danh sách quyết định không được để trống");
    }

    const result = await transaction(async (tx) => {
      const res = await commitContractImportRows(tx, input);
      await tx.run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          operator,
          "Nhập hợp đồng từ Excel",
          `Tạo mới: ${res.created}, Cập nhật: ${res.updated}, Bỏ qua: ${res.skipped}, Lỗi: ${res.errors.length}`,
        ]
      );
      return res;
    });

    return result;
  }
}
