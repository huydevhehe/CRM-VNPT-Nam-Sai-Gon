import { apiFetch } from "./client";
import { LeadRecord, LeadStatus } from "@/lib/crm/types/crm.types";

export type CreateLeadInput = Omit<
  LeadRecord,
  | "id"
  | "referredByCtvName"
  | "territoryId"
  | "referredByCtvId"
  | "expectedValue"
  | "channelSourceId"
  | "channelSourceName"
  | "channelSourceKind"
  | "pendingStageRequest"
> & {
  expectedValue?: number;
  territoryId?: string | null;
  referredByCtvId?: string | null;
  channelSourceId?: string | null;
};

/** Thông tin chung Admin được sửa; trường nào không gửi thì giữ nguyên. */
export interface UpdateLeadInput {
  customerName?: string;
  phone?: string;
  group?: LeadRecord["group"];
  channel?: LeadRecord["channel"];
  channelSourceId?: string | null;
  referredByCtvId?: string | null;
  expectedValue?: number;
  demandDescription?: string;
  note?: string | null;
}

export interface CtvOption {
  id: string;
  name: string;
  referralCode: string;
}

export interface LeadAssignmentInput {
  staffName?: string;
  territoryId?: string | null;
}

export type StageRequestStatus = "Chờ duyệt" | "Đã duyệt" | "Từ chối";

export interface LeadStageRequest {
  id: string;
  leadId: string;
  customerName: string;
  phone: string;
  staffName: string;
  currentStatus: LeadStatus;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  reason: string;
  requestedBy: string;
  status: StageRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string | null;
}

export function getLeads(): Promise<LeadRecord[]> {
  return apiFetch<LeadRecord[]>("/leads");
}

export function getCtvOptions(): Promise<CtvOption[]> {
  return apiFetch<CtvOption[]>("/leads/ctv-options");
}

export function createLead(data: CreateLeadInput): Promise<LeadRecord> {
  return apiFetch<LeadRecord>("/leads", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Chỉ Admin: sửa thông tin chung của Lead. */
export function updateLead(id: string, data: UpdateLeadInput): Promise<LeadRecord> {
  return apiFetch<LeadRecord>(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateLeadStatus(id: string, status: LeadStatus): Promise<LeadRecord> {
  return apiFetch<LeadRecord>(`/leads/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function assignLead(id: string, input: LeadAssignmentInput): Promise<LeadRecord> {
  return apiFetch<LeadRecord>(`/leads/${id}/assignment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Chỉ Admin: xóa cứng Lead (chặn 409 nếu Lead đã dùng để tạo đơn hàng). */
export async function deleteLead(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/leads/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function updateLeadNote(id: string, note: string): Promise<LeadRecord> {
  return apiFetch<LeadRecord>(`/leads/${id}/note`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

/** Nhân viên xin Admin duyệt quay lại bước trước. */
export function requestLeadStageChange(
  id: string,
  input: { toStatus: LeadStatus; reason: string }
): Promise<LeadStageRequest> {
  return apiFetch<LeadStageRequest>(`/leads/${id}/stage-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Chỉ Admin: danh sách yêu cầu quay lại bước. */
export function getLeadStageRequests(status?: StageRequestStatus): Promise<LeadStageRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<LeadStageRequest[]>(`/leads/stage-requests${qs}`);
}

export function decideLeadStageRequest(
  id: string,
  action: "approve" | "reject",
  note?: string
): Promise<LeadStageRequest> {
  return apiFetch<LeadStageRequest>(`/leads/stage-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ action, note }),
  });
}
