import { apiFetch } from "./client";

export type DocumentRegistryType = "bao-gia" | "de-nghi-thanh-toan" | "to-trinh";

export interface DocumentRegistryEntry {
  type: DocumentRegistryType;
  displayNumber: string;
  docNumber: string;
  issuedAt: string;
  issuedBy: string | null;
  note: string | null;
}

export function getDocumentRegistry(year?: string): Promise<DocumentRegistryEntry[]> {
  const query = year ? `?year=${encodeURIComponent(year)}` : "";
  return apiFetch<DocumentRegistryEntry[]>(`/document-registry${query}`);
}

export interface MemoRegistryEntry {
  id: string;
  year: string;
  docNumber: string;
  note: string | null;
  registeredBy: string | null;
  registeredAt: string;
}

export function registerMemoNumber(input: { docNumber: string; note?: string }): Promise<MemoRegistryEntry> {
  return apiFetch<MemoRegistryEntry>("/document-registry/memos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
