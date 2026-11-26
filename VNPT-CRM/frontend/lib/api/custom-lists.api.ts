import { apiFetch } from "./client";

export interface CustomListItem {
  id: string;
  listId: string;
  value: string;
  active: boolean;
  sortOrder: number;
}

export interface CustomList {
  id: string;
  name: string;
  items: CustomListItem[];
}

export function getCustomLists(): Promise<CustomList[]> {
  return apiFetch<CustomList[]>("/custom-lists");
}

export function createCustomList(name: string): Promise<CustomList> {
  return apiFetch<CustomList>("/custom-lists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameCustomList(id: string, name: string): Promise<CustomList> {
  return apiFetch<CustomList>(`/custom-lists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteCustomList(id: string): Promise<void> {
  await apiFetch<void>(`/custom-lists/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function addCustomListItem(listId: string, value: string): Promise<CustomListItem> {
  return apiFetch<CustomListItem>(`/custom-lists/${encodeURIComponent(listId)}/items`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export function updateCustomListItem(
  itemId: string,
  input: { value?: string; active?: boolean }
): Promise<CustomListItem> {
  return apiFetch<CustomListItem>(`/custom-lists/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteCustomListItem(itemId: string): Promise<void> {
  await apiFetch<void>(`/custom-lists/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}
