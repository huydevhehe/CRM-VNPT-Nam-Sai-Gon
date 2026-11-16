import { apiFetch } from "./client";

/** Khớp `ServiceImportRow` ở `backend/src/modules/service/service-import/parse.ts`. */
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

/** Khớp `ExistingService` ở `.../service-import/classify.ts`. */
export interface ExistingServiceRow {
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

/** Khớp `ImportCustomer` ở `.../service-import/classify.ts`. */
export interface ImportCustomerRow {
  id: string;
  name: string;
  identity_code: string | null;
  customer_code: string | null;
  am_staff: string | null;
  am_caring_staff: string | null;
}

export interface ResolvedServiceRow {
  serviceGroup: string | null;
  paymentType: string | null;
  startDate: string;
  expirationDate: string;
  staffName: string;
}

export interface ClassifiedServiceRow {
  row: ServiceImportRow;
  status: "new" | "update" | "error";
  existing?: ExistingServiceRow;
  customer?: ImportCustomerRow;
  resolved?: ResolvedServiceRow;
  notes: string[];
}

export interface ServiceImportPreviewResult {
  rows: ClassifiedServiceRow[];
  summary: {
    total: number;
    new: number;
    update: number;
    error: number;
  };
}

export async function previewServiceImport(file: File): Promise<ServiceImportPreviewResult> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<ServiceImportPreviewResult>("/services/import/preview", {
    method: "POST",
    body: formData,
  });
}

export type ServiceCommitAction = "create" | "update" | "skip";

export interface ServiceCommitDecisionInput {
  row: ServiceImportRow;
  action: ServiceCommitAction;
}

export interface CommitServiceImportInput {
  decisions: ServiceCommitDecisionInput[];
}

export interface CommitServiceImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
}

export async function commitServiceImport(
  input: CommitServiceImportInput
): Promise<CommitServiceImportResult> {
  return apiFetch<CommitServiceImportResult>("/services/import/commit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
