import { query, transaction } from "../../../database/db.js";
import { parseServiceSheet, readWorkbookRows } from "./parse.js";
import {
  EXISTING_SERVICES_SQL,
  IMPORT_CUSTOMERS_SQL,
  STAFF_NAMES_SQL,
  classifyServiceRows,
  type ClassifiedServiceRow,
  type ExistingService,
  type ImportCustomer,
} from "./classify.js";
import { commitServiceImportRows, type ServiceCommitInput, type ServiceCommitResult } from "./commit.js";

export const MAX_IMPORT_ROWS = 5000;

export class ServiceImportServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 = 400
  ) {
    super(message);
  }
}

export interface ServicePreviewResult {
  rows: ClassifiedServiceRow[];
  summary: {
    total: number;
    new: number;
    update: number;
    error: number;
  };
}

export class ServiceImportService {
  async preview(buffer: Buffer): Promise<ServicePreviewResult> {
    const rawRows = readWorkbookRows(buffer);
    if (rawRows.length > MAX_IMPORT_ROWS) {
      throw new ServiceImportServiceError(`File vượt quá giới hạn ${MAX_IMPORT_ROWS} dòng`);
    }

    const { rows, errors } = parseServiceSheet(rawRows);
    const [existing, customers, staff] = await Promise.all([
      query<ExistingService>(EXISTING_SERVICES_SQL),
      query<ImportCustomer>(IMPORT_CUSTOMERS_SQL),
      query<{ name: string }>(STAFF_NAMES_SQL),
    ]);

    const classified = classifyServiceRows(
      rows,
      existing,
      customers,
      staff.map((s) => s.name)
    );
    const errorRows: ClassifiedServiceRow[] = errors.map((e) => ({
      row: e.row,
      status: "error",
      notes: [e.message],
    }));

    const allRows = [...classified, ...errorRows].sort((a, b) => a.row.rowNumber - b.row.rowNumber);

    const summary = {
      total: allRows.length,
      new: allRows.filter((r) => r.status === "new").length,
      update: allRows.filter((r) => r.status === "update").length,
      error: allRows.filter((r) => r.status === "error").length,
    };

    return { rows: allRows, summary };
  }

  async commit(input: ServiceCommitInput, operator: string): Promise<ServiceCommitResult> {
    if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
      throw new ServiceImportServiceError("Danh sách quyết định không được để trống");
    }
    if (input.decisions.length > MAX_IMPORT_ROWS) {
      throw new ServiceImportServiceError(`Vượt quá giới hạn ${MAX_IMPORT_ROWS} dòng`);
    }

    return transaction(async (tx) => {
      const res = await commitServiceImportRows(tx, input);
      await tx.run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          operator,
          "Nhập dịch vụ từ Excel",
          `Tạo mới: ${res.created}, Cập nhật: ${res.updated}, Bỏ qua: ${res.skipped}, Lỗi: ${res.errors.length}`,
        ]
      );
      return res;
    });
  }
}
