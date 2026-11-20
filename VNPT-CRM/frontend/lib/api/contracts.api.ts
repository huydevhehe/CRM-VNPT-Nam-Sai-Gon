import { API_BASE_URL, apiFetch, getToken } from "./client";
import { ContractItemInput, ContractRecord, ContractTemplateOption } from "@/lib/crm/types/crm.types";

export type UpdateContractStatusInput = Partial<
  Pick<ContractRecord, "deploymentStatus" | "paymentStatus" | "documentStatus" | "totalValue">
>;

export type CreateContractInput = Pick<ContractRecord, "transactionCode" | "channel"> & {
  /** T9 (STT 10): nhiều dòng dịch vụ/thiết bị — server tự tính lại `totalValue` từ các dòng. */
  items: ContractItemInput[];
  /** Tương thích payload cũ (không dùng khi đã có `items`). */
  subscriberCodes?: string[];
  totalValue?: number;
  customerId: string;
  leadId?: string | null;
  territoryId?: string | null;
  amStaff?: string | null;
  serviceGroup?: string | null;
  serviceName?: string | null;
  packageName?: string | null;
  paymentMethod?: string | null;
  taxCode?: string | null;
  contractNumber?: string | null;
  signedDate?: string | null;
  termMonths?: number | null;
  prepaidMonths?: number | null;
  channelSourceId?: string | null;
  referredByCtvId?: string | null;
  /** Mẫu hợp đồng (T10, STT 11) — bắt buộc khi tạo mới. */
  contractTemplate?: string | null;
};

export type UpdateContractInfoInput = Partial<CreateContractInput>;

export function getContracts(): Promise<ContractRecord[]> {
  return apiFetch<ContractRecord[]>("/contracts");
}

export function createContract(data: CreateContractInput): Promise<ContractRecord> {
  return apiFetch<ContractRecord>("/contracts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateContractInfo(
  id: string,
  patch: UpdateContractInfoInput
): Promise<ContractRecord> {
  return apiFetch<ContractRecord>(`/contracts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function updateContractStatus(
  id: string,
  patch: UpdateContractStatusInput
): Promise<ContractRecord> {
  return apiFetch<ContractRecord>(`/contracts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface ContractPaymentDto {
  id: string;
  contractId: string;
  amount: number;
  paidDate: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AddPaymentInput {
  amount: number;
  paidDate?: string;
  note?: string;
}

export function getContractPayments(contractId: string): Promise<ContractPaymentDto[]> {
  return apiFetch<ContractPaymentDto[]>(`/contracts/${contractId}/payments`);
}

export function addContractPayment(
  contractId: string,
  data: AddPaymentInput
): Promise<ContractRecord> {
  return apiFetch<ContractRecord>(`/contracts/${contractId}/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteContractPayment(paymentId: string): Promise<ContractRecord> {
  return apiFetch<ContractRecord>(`/contracts/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export interface PaymentExportRecordDto {
  id: string;
  contractId: string;
  docNumber: string;
  exportedBy: string | null;
  exportedAt: string;
  transactionCode?: string;
  customerName?: string;
}

export interface PaymentRequestPreviewDto {
  /** Số kế tiếp gợi ý (chưa cấp); rỗng nếu năm nay chưa có số nào. */
  suggestedDocNumber: string;
  missingFields: string[];
  /** Các dòng chữ của văn bản đã điền dữ liệu (để xem trước). */
  lines: string[];
  /** Lần cấp số gần nhất của đơn này (nếu có). */
  latestExport: PaymentExportRecordDto | null;
  /** Máy chủ có xuất được PDF (đã cài LibreOffice) hay không. */
  pdfAvailable: boolean;
}

export interface ConfirmedPaymentExportDto extends PaymentExportRecordDto {
  /** true = dùng lại số đã cấp trước đó, không cấp số mới. */
  reused: boolean;
}

/** Xem trước văn bản đề nghị thanh toán. KHÔNG cấp/tiêu số văn bản. */
export function getPaymentRequestPreview(
  contractId: string,
  docNumber?: string
): Promise<PaymentRequestPreviewDto> {
  const query = docNumber?.trim() ? `?docNumber=${encodeURIComponent(docNumber.trim())}` : "";
  return apiFetch<PaymentRequestPreviewDto>(`/contracts/${contractId}/payment-request/preview${query}`);
}

/**
 * Xác nhận lấy số văn bản (điểm duy nhất tiêu số). Bỏ trống `docNumber` để hệ thống
 * tự cấp số kế tiếp; `reuseLatest` dùng lại số đã cấp của đơn này.
 */
export function confirmPaymentRequest(
  contractId: string,
  input: { docNumber?: string; reuseLatest?: boolean }
): Promise<ConfirmedPaymentExportDto> {
  return apiFetch<ConfirmedPaymentExportDto>(`/contracts/${contractId}/payment-request/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type PaymentRequestFormat = "docx" | "pdf";

/** Tải file của một lần đã cấp số (DOCX và PDF cùng số). Ném Error tiếng Việt khi server từ chối. */
export async function downloadPaymentRequestFile(
  contractId: string,
  exportId: string,
  format: PaymentRequestFormat
): Promise<Blob> {
  return fetchPaymentRequestBlob(
    `/contracts/${contractId}/payment-request/file?exportId=${encodeURIComponent(exportId)}&format=${format}`
  );
}

/** Bản PDF xem trước (chưa cấp số) để hiển thị trong khung xem trước. */
export async function fetchPaymentRequestPreviewPdf(contractId: string, docNumber?: string): Promise<Blob> {
  const query = docNumber?.trim() ? `?docNumber=${encodeURIComponent(docNumber.trim())}` : "";
  return fetchPaymentRequestBlob(`/contracts/${contractId}/payment-request/preview-file${query}`);
}

async function fetchPaymentRequestBlob(path: string): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Vui lòng thử lại.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Lỗi tải file (${res.status})`);
  }
  return res.blob();
}

export function listPaymentExports(): Promise<PaymentExportRecordDto[]> {
  return apiFetch<PaymentExportRecordDto[]>("/contracts/payment-requests");
}

export interface CtvCommissionGapDto {
  id: string;
  transactionCode: string;
  customerName: string;
  totalValue: number;
}

/** Báo cáo chỉ đọc: đơn Hoàn tất, kênh CTV giới thiệu nhưng thiếu CTV (Admin tự xử lý tay). */
export function getCtvCommissionGaps(): Promise<CtvCommissionGapDto[]> {
  return apiFetch<CtvCommissionGapDto[]>("/contracts/ctv-commission-gaps");
}

// --- T10 (STT 11): bộ mẫu hợp đồng bắt buộc + xuất hợp đồng + xóa đơn hàng ---

/** Danh sách mẫu hợp đồng (7 mẫu cố định) — mẫu `available=false` chưa có file, FE phải vô hiệu hóa nút xuất. */
export function getContractTemplates(): Promise<ContractTemplateOption[]> {
  return apiFetch<ContractTemplateOption[]>("/contracts/templates");
}

export interface ContractExportPreviewDto {
  templateKey: string;
  templateLabel: string;
  missingFields: string[];
  lines: string[];
}

/** Xem trước nội dung hợp đồng điền từ mẫu. Ném lỗi 501 tiếng Việt nếu mẫu chưa có file. */
export function getContractExportPreview(contractId: string): Promise<ContractExportPreviewDto> {
  return apiFetch<ContractExportPreviewDto>(`/contracts/${contractId}/contract-export/preview`);
}

export type ContractExportFormat = "docx" | "pdf";

/** Tải file hợp đồng đã điền từ mẫu (DOCX hoặc PDF). Ném Error tiếng Việt khi server từ chối (vd 501 chưa có mẫu). */
export async function downloadContractExportFile(
  contractId: string,
  format: ContractExportFormat
): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/contracts/${contractId}/contract-export/file?format=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch {
    throw new Error("Không kết nối được máy chủ. Vui lòng thử lại.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Lỗi tải file (${res.status})`);
  }
  return res.blob();
}

export interface DeleteContractResultDto {
  transactionCode: string;
  itemCount: number;
  paymentCount: number;
}

/** Xóa Đơn hàng (Admin-only, cascade). Ném lỗi 409 tiếng Việt nếu đã có hoa hồng CTV đã chi. */
export function deleteContract(contractId: string): Promise<DeleteContractResultDto> {
  return apiFetch<DeleteContractResultDto>(`/contracts/${contractId}`, {
    method: "DELETE",
  });
}
