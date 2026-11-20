import { apiFetch } from "./client";
import { CtvAccountRecord } from "@/lib/crm/types/crm.types";

export function getCtvAccounts(status?: CtvAccountRecord["status"]): Promise<CtvAccountRecord[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<CtvAccountRecord[]>(`/ctv-accounts${qs}`);
}

export function approveCtvAccount(id: string): Promise<CtvAccountRecord> {
  return apiFetch<CtvAccountRecord>(`/ctv-accounts/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
  });
}

export function rejectCtvAccount(id: string): Promise<CtvAccountRecord> {
  return apiFetch<CtvAccountRecord>(`/ctv-accounts/${encodeURIComponent(id)}/reject`, {
    method: "PATCH",
  });
}

export interface CreateCtvAccountInput {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  mustChangePassword?: boolean;
}

export function createCtvAccount(input: CreateCtvAccountInput): Promise<CtvAccountRecord> {
  return apiFetch<CtvAccountRecord>("/ctv-accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Chỉ xóa được khi CTV chưa phát sinh Lead/đơn hàng/khách hàng/hoa hồng (409 nếu đã có). */
export async function deleteCtvAccount(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/ctv-accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
