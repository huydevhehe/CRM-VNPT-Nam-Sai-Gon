import { apiFetch, apiFetchRaw, API_BASE_URL, getToken } from "./client";
import {
  CustomerRecord,
  CustomerType,
  CustomerGroup,
  DocumentType,
} from "@/lib/crm/types/crm.types";

/**
 * Field thô (snake_case) trả về từ
 * `backend/src/modules/customer/customer.service.ts` (bảng SQLite `customers`).
 */
interface CustomerApiRow {
  id: string;
  name: string;
  identity_code?: string | null;
  type: string;
  customer_group: string;
  phone?: string | null;
  address?: string | null;
  services?: string | null;
  nearest_expiration?: string | null;
  am_staff?: string | null;
  am_caring_staff?: string | null;
  handover_batch?: string | null;
  handover_date?: string | null;
  territory_id?: string | null;
  territory_name?: string | null;
  customer_code?: string | null;
  status?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  sales_channel?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_title?: string | null;
  billing_name?: string | null;
  billing_phone?: string | null;
  billing_email?: string | null;
  note?: string | null;
  referred_by_ctv_id?: string | null;
  referred_by_ctv_name?: string | null;
  referred_by_ctv_code?: string | null;
  channel_source_id?: string | null;
  channel_source_name?: string | null;
  representative_name?: string | null;
  representative_title?: string | null;
  representative_id_number?: string | null;
  representative_id_issued_at?: string | null;
  representative_id_issued_place?: string | null;
}

function mapCustomerRow(row: CustomerApiRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    identityCode: row.identity_code || "",
    type: row.type as CustomerType,
    group: row.customer_group as CustomerGroup,
    phone: row.phone || "",
    address: row.address || "",
    services: row.services
      ? row.services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    nearestExpiration: row.nearest_expiration || "",
    amStaff: row.am_staff || "",
    amCaringStaff: row.am_caring_staff || "",
    handoverBatch: row.handover_batch || "",
    handoverDate: row.handover_date || "",
    territoryId: row.territory_id || undefined,
    territoryName: row.territory_name || undefined,
    customerCode: row.customer_code || undefined,
    status: row.status || undefined,
    teamId: row.team_id || undefined,
    teamName: row.team_name || undefined,
    salesChannel: row.sales_channel || undefined,
    contactName: row.contact_name || undefined,
    contactEmail: row.contact_email || undefined,
    contactTitle: row.contact_title || undefined,
    billingName: row.billing_name || undefined,
    billingPhone: row.billing_phone || undefined,
    billingEmail: row.billing_email || undefined,
    note: row.note || undefined,
    referredByCtvId: row.referred_by_ctv_id || undefined,
    referredByCtvName: row.referred_by_ctv_name || undefined,
    referredByCtvCode: row.referred_by_ctv_code || undefined,
    channelSourceId: row.channel_source_id || undefined,
    channelSourceName: row.channel_source_name || undefined,
    representativeName: row.representative_name || undefined,
    representativeTitle: row.representative_title || undefined,
    representativeIdNumber: row.representative_id_number || undefined,
    representativeIdIssuedAt: row.representative_id_issued_at || undefined,
    representativeIdIssuedPlace: row.representative_id_issued_place || undefined,
  };
}

export async function getCustomers(
  search?: string,
  group?: CustomerGroup
): Promise<CustomerRecord[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (group) params.set("group", group);
  const queryString = params.toString();
  const qs = queryString ? `?${queryString}` : "";
  const rows = await apiFetch<CustomerApiRow[]>(`/customers${qs}`);
  return rows.map(mapCustomerRow);
}

export interface CreateCustomerInput {
  name: string;
  identityCode?: string;
  type: CustomerType;
  customerGroup: CustomerGroup;
  phone?: string;
  address?: string;
  services?: string;
  amStaff?: string;
  amCaringStaff?: string;
  handoverBatch?: string;
  territoryId?: string;
  customerCode?: string;
  status?: string;
  teamId?: string;
  salesChannel?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  billingName?: string;
  billingPhone?: string;
  billingEmail?: string;
  note?: string;
  /** Chuỗi rỗng / null khi sửa = gỡ CTV giới thiệu. */
  referredByCtvId?: string | null;
  /** Chi tiết kênh (nguồn Online/đối tác) khi salesChannel là Online/Đối tác. */
  channelSourceId?: string | null;
  /** Người đại diện pháp luật — chỉ dùng để điền mẫu hợp đồng, không bắt buộc nhập. */
  representativeName?: string;
  representativeTitle?: string;
  representativeIdNumber?: string;
  representativeIdIssuedAt?: string;
  representativeIdIssuedPlace?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CtvOption {
  id: string;
  code: string;
  name: string;
}

/** Danh sách CTV đang hoạt động để chọn "CTV giới thiệu" (mọi nhân viên gọi được). */
export function getCtvOptions(): Promise<CtvOption[]> {
  return apiFetch<CtvOption[]>("/customers/ctv-options");
}

export async function getCustomer(id: string): Promise<CustomerRecord> {
  const row = await apiFetch<CustomerApiRow>(`/customers/${encodeURIComponent(id)}`);
  return mapCustomerRow(row);
}

export async function updateCustomer(
  id: string,
  patch: UpdateCustomerInput
): Promise<CustomerRecord> {
  const row = await apiFetch<CustomerApiRow>(`/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return mapCustomerRow(row);
}

/**
 * Tạo khách hàng mới. Backend (`CustomerService.create`) trả về bản ghi
 * đầy đủ vừa tạo (bao gồm giá trị mặc định do backend áp dụng), nên chỉ
 * cần map qua `mapCustomerRow` như `getCustomers`, không tự chèn mặc định ở FE.
 */
export async function createCustomer(
  data: CreateCustomerInput
): Promise<CustomerRecord> {
  const row = await apiFetch<CustomerApiRow>("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });

  return mapCustomerRow(row);
}

/** Xóa khách hàng (chỉ Admin). Ném lỗi tiếng Việt từ server (409 nếu còn đơn hàng). */
export async function deleteCustomer(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/customers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Đổi AM bán hàng (người phát triển) — không nhận đợt giao, xem transferCaringStaff().
export function transferCustomer(id: string, newStaff: string): Promise<void> {
  return apiFetch<void>(`/customers/${encodeURIComponent(id)}/transfer`, {
    method: "PATCH",
    body: JSON.stringify({ newStaff }),
  });
}

export function transferCaringStaff(
  id: string,
  newCaringStaff: string,
  handoverBatch?: string
): Promise<void> {
  return apiFetch<void>(`/customers/${encodeURIComponent(id)}/transfer-caring`, {
    method: "PATCH",
    body: JSON.stringify({ newCaringStaff, handoverBatch: handoverBatch || undefined }),
  });
}

export interface BatchCustomerInputItem {
  identityCode?: string;
  phone?: string;
  name: string;
  type?: string;
  address?: string;
  services?: string;
}

export interface ImportCustomerBatchInput {
  /** Tùy chọn (feedback 17/11); bắt buộc chỉ khi mode = "replace". */
  territoryId?: string;
  amCaringStaff: string;
  handoverBatch: string;
  mode: "append" | "replace";
  customers: BatchCustomerInputItem[];
}

export interface ImportCustomerBatchResult {
  createdCount: number;
  updatedCount: number;
  clearedCount: number;
  totalProcessed: number;
}

export async function importCustomerBatch(
  data: ImportCustomerBatchInput
): Promise<ImportCustomerBatchResult> {
  return apiFetch<ImportCustomerBatchResult>("/customers/batches", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function importCustomerBatchExcel(
  file: File,
  params: {
    territoryId?: string;
    amCaringStaff: string;
    handoverBatch: string;
    mode: "append" | "replace";
  }
): Promise<ImportCustomerBatchResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (params.territoryId) formData.append("territoryId", params.territoryId);
  formData.append("amCaringStaff", params.amCaringStaff);
  formData.append("handoverBatch", params.handoverBatch);
  formData.append("mode", params.mode);

  const payload = await apiFetchRaw<{
    success: boolean;
    data: ImportCustomerBatchResult;
    message?: string;
  }>("/customers/batches/upload", {
    method: "POST",
    body: formData,
  });

  if (!payload || !payload.success) {
    throw new Error(payload?.message || "Import tập khách hàng thất bại");
  }

  return payload.data;
}

export interface AssignStaffBulkInput {
  customerIds: string[];
  amCaringStaff?: string;
  amStaff?: string;
}

export async function assignStaffBulk(
  input: AssignStaffBulkInput
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>("/customers/assign-staff", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface CustomerDocumentRecord {
  id: string;
  customerId: string;
  docType: DocumentType;
  originalName: string;
  mime: string | null;
  size: number | null;
  uploadedBy: string | null;
  createdAt: string | null;
}

export async function getCustomerDocuments(customerId: string): Promise<CustomerDocumentRecord[]> {
  return apiFetch<CustomerDocumentRecord[]>(`/customers/${encodeURIComponent(customerId)}/documents`);
}

export async function uploadCustomerDocument(
  customerId: string,
  docType: DocumentType,
  file: File
): Promise<CustomerDocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", docType);

  const payload = await apiFetchRaw<{
    success: boolean;
    data: CustomerDocumentRecord;
    message?: string;
  }>(`/customers/${encodeURIComponent(customerId)}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!payload || !payload.success) {
    throw new Error(payload?.message || "Tải lên giấy tờ thất bại");
  }

  return payload.data;
}

export async function deleteCustomerDocument(documentId: string): Promise<void> {
  await apiFetch<{ message: string }>(`/customers/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

/**
 * Tải file giấy tờ về máy người dùng. Route tải về cần header Authorization
 * (không phải public), nên không thể dùng thẳng `<a href>` — phải `fetch`
 * kèm token rồi tạo Blob URL tạm để trigger download.
 */
export async function downloadCustomerDocument(
  documentId: string,
  fallbackName: string
): Promise<void> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE_URL}/customers/documents/${encodeURIComponent(documentId)}/download`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );
  if (!res.ok) {
    let message = `Tải file thất bại (mã lỗi ${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // body không phải JSON (vd lỗi mạng) — giữ message mặc định.
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lấy nội dung PDF để xem trước ngay trên trang (không tải xuống). File
 * .pdf gốc trả thẳng; .doc/.docx được server đổi sang PDF qua LibreOffice.
 * Cần header Authorization nên fetch thủ công thay vì `<iframe src>` trực
 * tiếp — nơi gọi tự tạo Blob URL để gán vào `<iframe>`.
 */
export async function fetchCustomerDocumentPreviewPdf(documentId: string): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/customers/documents/${encodeURIComponent(documentId)}/view`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  } catch {
    throw new Error("Không kết nối được máy chủ. Vui lòng thử lại.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Lỗi tải file xem trước (${res.status})`);
  }
  return res.blob();
}

export interface QuoteInput {
  serviceType: string;
  packageName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatPercent?: number;
  note?: string;
  staffName?: string;
  eoNumber?: string;
}

export interface QuoteExportRecordDto {
  id: string;
  customerId: string;
  docNumber: string;
  eoNumber: string | null;
  exportedBy: string | null;
  exportedAt: string;
  serviceType: string;
  packageName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
  note: string | null;
  staffName: string | null;
  customerName?: string;
}

export interface QuotePreviewDto {
  suggestedDocNumber: string;
  missingFields: string[];
  lines: string[];
  pdfAvailable: boolean;
}

export interface ConfirmedQuoteExportDto extends QuoteExportRecordDto {
  reused: boolean;
}

/** Xem trước nội dung báo giá. KHÔNG cấp/tiêu số báo giá. */
export function getQuotePreview(
  customerId: string,
  input: QuoteInput,
  docNumber?: string
): Promise<QuotePreviewDto> {
  const query = docNumber?.trim() ? `?docNumber=${encodeURIComponent(docNumber.trim())}` : "";
  return apiFetch<QuotePreviewDto>(`/customers/${encodeURIComponent(customerId)}/quote/preview${query}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Xem trước bản in (PDF) báo giá, KHÔNG cấp số. */
export async function fetchQuotePreviewPdf(
  customerId: string,
  input: QuoteInput,
  docNumber?: string
): Promise<Blob> {
  const query = docNumber?.trim() ? `?docNumber=${encodeURIComponent(docNumber.trim())}` : "";
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/quote/preview-file${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      }
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

/** Xác nhận lấy số báo giá (điểm duy nhất tiêu số). */
export function confirmQuote(
  customerId: string,
  input: QuoteInput & { docNumber?: string; reuseLatest?: boolean }
): Promise<ConfirmedQuoteExportDto> {
  return apiFetch<ConfirmedQuoteExportDto>(`/customers/${encodeURIComponent(customerId)}/quote/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type QuoteFormat = "docx" | "pdf";

/** Tải file của một lần đã cấp số báo giá (DOCX/PDF cùng số). */
export async function downloadQuoteFile(
  customerId: string,
  exportId: string,
  format: QuoteFormat
): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/quote/file?exportId=${encodeURIComponent(exportId)}&format=${format}`,
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

export function listQuoteExports(customerId: string): Promise<QuoteExportRecordDto[]> {
  return apiFetch<QuoteExportRecordDto[]>(`/customers/${encodeURIComponent(customerId)}/quote/exports`);
}

/** Toàn bộ báo giá đã cấp số của mọi khách hàng — dùng cho trang "Báo giá". */
export function listAllQuoteExports(): Promise<QuoteExportRecordDto[]> {
  return apiFetch<QuoteExportRecordDto[]>("/customers/quote-exports");
}
