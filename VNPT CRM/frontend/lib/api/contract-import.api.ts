import { apiFetch } from "./client";

export type ImportLineType = "service" | "device";

/** Khớp `ContractItemInput` ở `backend/src/modules/contract/contract-items.ts`. */
export interface ImportItemInput {
  lineType: ImportLineType;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  subscriberCode?: string | null;
  quantity?: number | null;
  unitPrice: number;
  termMonths?: number | null;
  startDate?: string | null;
  note?: string | null;
}

/**
 * Khớp `ContractImportRow` ở `backend/src/modules/contract/contract-import/parse.ts`
 * (T9, STT 10/11): một đơn đã gộp từ các dòng Excel cùng `transactionCode`.
 */
export interface ContractImportRow {
  rowNumber: number;
  rowNumbers: number[];
  transactionCode: string;
  customerName: string;
  subscriberCodes: string[];
  totalValue: number | null;
  channel: string;
  amStaff: string;
  serviceGroup: string;
  serviceName: string;
  packageName: string;
  taxCode: string;
  contractNumber: string;
  signedDate: string;
  note: string;
  items: ImportItemInput[];
}

/** Khớp `ExistingContract` ở `.../contract-import/classify.ts`. */
export interface ExistingContractRow {
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

/** Khớp `ImportCustomer` ở `.../contract-import/classify.ts`. */
export interface ImportCustomerRow {
  id: string;
  name: string;
  identity_code: string | null;
}

export interface ClassifiedContractRow {
  row: ContractImportRow;
  status: "new" | "update" | "error";
  existing?: ExistingContractRow;
  customer?: ImportCustomerRow;
  notes: string[];
}

export interface ContractImportPreviewResult {
  rows: ClassifiedContractRow[];
  summary: {
    total: number;
    new: number;
    update: number;
    error: number;
  };
}

export async function previewContractImport(file: File): Promise<ContractImportPreviewResult> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<ContractImportPreviewResult>("/contracts/import/preview", {
    method: "POST",
    body: formData,
  });
}

export type ContractCommitAction = "create" | "update" | "skip";

export interface ContractCommitDecisionInput {
  row: ContractImportRow;
  action: ContractCommitAction;
}

export interface CommitContractImportInput {
  decisions: ContractCommitDecisionInput[];
}

export interface CommitContractImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
}

export async function commitContractImport(
  input: CommitContractImportInput
): Promise<CommitContractImportResult> {
  return apiFetch<CommitContractImportResult>("/contracts/import/commit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
