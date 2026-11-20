import { apiFetch } from "./client";

export type ChannelSourceKind = "online" | "partner";

export interface ChannelSource {
  id: string;
  kind: ChannelSourceKind;
  name: string;
  active: boolean;
  sortOrder: number;
  /** Số bản ghi đang dùng mục này; chỉ có khi Admin lấy kèm mục đã ẩn. */
  usageCount?: number;
}

export interface DeleteChannelSourceResult {
  deleted: boolean;
  deactivated: boolean;
  message: string;
  item?: ChannelSource;
}

export const CHANNEL_SOURCE_KIND_LABEL: Record<ChannelSourceKind, string> = {
  online: "Nguồn Online",
  partner: "Đối tác",
};

export function getChannelSources(
  options: { kind?: ChannelSourceKind; includeInactive?: boolean } = {}
): Promise<ChannelSource[]> {
  const params = new URLSearchParams();
  if (options.kind) params.set("kind", options.kind);
  if (options.includeInactive) params.set("includeInactive", "true");
  const qs = params.toString();
  return apiFetch<ChannelSource[]>(`/channel-sources${qs ? `?${qs}` : ""}`);
}

export function createChannelSource(input: { kind: ChannelSourceKind; name: string }): Promise<ChannelSource> {
  return apiFetch<ChannelSource>("/channel-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateChannelSource(
  id: string,
  input: { name?: string; active?: boolean; sortOrder?: number }
): Promise<ChannelSource> {
  return apiFetch<ChannelSource>(`/channel-sources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function reorderChannelSources(
  kind: ChannelSourceKind,
  orderedIds: string[]
): Promise<ChannelSource[]> {
  return apiFetch<ChannelSource[]>("/channel-sources/reorder", {
    method: "POST",
    body: JSON.stringify({ kind, orderedIds }),
  });
}

/** Xóa mục: nếu đã được dùng, server chỉ chuyển sang ẩn và trả `deactivated: true`. */
export function deleteChannelSource(id: string): Promise<DeleteChannelSourceResult> {
  return apiFetch<DeleteChannelSourceResult>(`/channel-sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
