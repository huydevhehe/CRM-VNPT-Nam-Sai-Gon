import { query, run, transaction } from "../../database/db.js";
import { ROLES, USER_STATUS } from "../../constants/org.js";

export class ChannelSourceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
  }
}

export const CHANNEL_SOURCE_KINDS = ["online", "partner"] as const;
export type ChannelSourceKind = (typeof CHANNEL_SOURCE_KINDS)[number];

/** Kênh phát triển cần chọn thêm chi tiết từ danh mục `channel_sources`. */
export const CHANNEL_KIND_BY_CHANNEL: Record<string, ChannelSourceKind> = {
  Online: "online",
  "Đối tác": "partner",
};
export const CTV_CHANNEL = "CTV giới thiệu";

const KIND_LABEL: Record<ChannelSourceKind, string> = {
  online: "nguồn Online",
  partner: "đối tác",
};

export interface ChannelSourceDto {
  id: string;
  kind: ChannelSourceKind;
  name: string;
  active: boolean;
  sortOrder: number;
  /** Số bản ghi (Lead, Đơn hàng, Khách hàng) đang dùng; chỉ có khi Admin xem cả mục đã ẩn. */
  usageCount?: number;
}

interface ChannelSourceRow {
  id: string;
  kind: ChannelSourceKind;
  name: string;
  active: boolean;
  sort_order: number;
}

function toDto(row: ChannelSourceRow, usageCount?: number): ChannelSourceDto {
  const dto: ChannelSourceDto = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    active: row.active,
    sortOrder: Number(row.sort_order),
  };
  if (usageCount !== undefined) {
    dto.usageCount = usageCount;
  }
  return dto;
}

function assertKind(kind: unknown): ChannelSourceKind {
  if (!(CHANNEL_SOURCE_KINDS as readonly unknown[]).includes(kind)) {
    throw new ChannelSourceError("Loại danh mục không hợp lệ (online hoặc partner)", 400);
  }
  return kind as ChannelSourceKind;
}

function normalizeName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) {
    throw new ChannelSourceError("Tên không được để trống", 400);
  }
  if (name.length > 100) {
    throw new ChannelSourceError("Tên tối đa 100 ký tự", 400);
  }
  return name;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

/** Các bảng có cột `channel_source_id` (Lead hiện có; Đơn hàng/Khách hàng được bổ sung sau). */
const USAGE_TABLES = ["leads", "contracts", "customers"] as const;

async function tablesWithSourceColumn(): Promise<string[]> {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
     WHERE column_name = 'channel_source_id' AND table_schema = current_schema()
       AND table_name = ANY(?)`,
    [USAGE_TABLES as unknown as string[]]
  );
  return rows.map((r) => r.table_name);
}

async function usageCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of await tablesWithSourceColumn()) {
    const rows = await query<{ channel_source_id: string; total: string }>(
      `SELECT channel_source_id, COUNT(*) AS total FROM ${table}
       WHERE channel_source_id IS NOT NULL GROUP BY channel_source_id`
    );
    for (const r of rows) {
      counts.set(r.channel_source_id, (counts.get(r.channel_source_id) ?? 0) + Number(r.total));
    }
  }
  return counts;
}

export interface ChannelDetailInput {
  channel: string;
  channelSourceId?: string | null;
  referredByCtvId?: string | null;
}

export interface ChannelDetailResult {
  channelSourceId: string | null;
  referredByCtvId: string | null;
}

/**
 * Kiểm tra "Chi tiết kênh" theo kênh phát triển (dùng chung cho Lead; Đơn hàng/Khách hàng
 * sẽ dùng lại):
 * - Online -> bắt buộc chọn nguồn Online; Đối tác -> bắt buộc chọn đối tác
 * - CTV giới thiệu -> bắt buộc chọn CTV đang hoạt động
 * - Kênh khác -> không có chi tiết
 * `keepInactiveSourceId`: cho phép giữ nguyên một nguồn đã bị ẩn (khi chỉ sửa trường khác).
 */
export async function validateChannelDetail(
  input: ChannelDetailInput,
  options: { keepInactiveSourceId?: string | null; keepCtvId?: string | null } = {}
): Promise<ChannelDetailResult> {
  const sourceId = input.channelSourceId ? String(input.channelSourceId) : null;
  const ctvId = input.referredByCtvId ? String(input.referredByCtvId) : null;
  const requiredKind = CHANNEL_KIND_BY_CHANNEL[input.channel];

  if (requiredKind) {
    if (ctvId) {
      throw new ChannelSourceError("Chỉ kênh CTV giới thiệu mới gắn Cộng tác viên", 400);
    }
    if (!sourceId) {
      throw new ChannelSourceError(
        requiredKind === "online"
          ? "Kênh Online phải chọn nguồn Online"
          : "Kênh Đối tác phải chọn đối tác",
        400
      );
    }
    const rows = await query<ChannelSourceRow>("SELECT * FROM channel_sources WHERE id = ?", [sourceId]);
    if (!rows.length) {
      throw new ChannelSourceError("Chi tiết kênh không tồn tại", 400);
    }
    if (rows[0].kind !== requiredKind) {
      throw new ChannelSourceError(
        `Chi tiết kênh không đúng loại: kênh ${input.channel} chỉ nhận ${KIND_LABEL[requiredKind]}`,
        400
      );
    }
    if (!rows[0].active && options.keepInactiveSourceId !== sourceId) {
      throw new ChannelSourceError("Chi tiết kênh này đã bị ẩn, vui lòng chọn mục khác", 400);
    }
    return { channelSourceId: sourceId, referredByCtvId: null };
  }

  if (sourceId) {
    throw new ChannelSourceError(`Kênh ${input.channel} không có chi tiết nguồn/đối tác`, 400);
  }

  if (input.channel === CTV_CHANNEL) {
    if (!ctvId) {
      throw new ChannelSourceError("Kênh CTV giới thiệu phải chọn Cộng tác viên", 400);
    }
    const ctv = await query<{ id: string; status: string | null }>(
      "SELECT id, status FROM users WHERE id = ? AND role = ?",
      [ctvId, ROLES.CTV]
    );
    if (!ctv.length) {
      throw new ChannelSourceError("Cộng tác viên không tồn tại hoặc chưa được duyệt", 400);
    }
    if (ctv[0].status !== USER_STATUS.ACTIVE && options.keepCtvId !== ctvId) {
      throw new ChannelSourceError("Cộng tác viên không tồn tại hoặc chưa được duyệt", 400);
    }
    return { channelSourceId: null, referredByCtvId: ctvId };
  }

  if (ctvId) {
    throw new ChannelSourceError("Chỉ kênh CTV giới thiệu mới gắn Cộng tác viên", 400);
  }
  return { channelSourceId: null, referredByCtvId: null };
}

export class ChannelSourceService {
  async list(options: { kind?: unknown; includeInactive?: boolean } = {}): Promise<ChannelSourceDto[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (options.kind !== undefined && options.kind !== "") {
      where.push("kind = ?");
      params.push(assertKind(options.kind));
    }
    if (!options.includeInactive) {
      where.push("active = TRUE");
    }
    const rows = await query<ChannelSourceRow>(
      `SELECT * FROM channel_sources ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY kind, sort_order, LOWER(name)`,
      params
    );
    if (!options.includeInactive) {
      return rows.map((r) => toDto(r));
    }
    const counts = await usageCounts();
    return rows.map((r) => toDto(r, counts.get(r.id) ?? 0));
  }

  async getById(id: string): Promise<ChannelSourceDto | null> {
    const rows = await query<ChannelSourceRow>("SELECT * FROM channel_sources WHERE id = ?", [id]);
    return rows.length ? toDto(rows[0]) : null;
  }

  async create(input: { kind?: unknown; name?: unknown }): Promise<ChannelSourceDto> {
    const kind = assertKind(input.kind);
    const name = normalizeName(input.name);
    const max = await query<{ max: number | null }>(
      "SELECT MAX(sort_order) AS max FROM channel_sources WHERE kind = ?",
      [kind]
    );
    const sortOrder = Number(max[0]?.max ?? 0) + 1;
    const id = `CHS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run(
        "INSERT INTO channel_sources (id, kind, name, active, sort_order, created_at) VALUES (?, ?, ?, TRUE, ?, ?)",
        [id, kind, name, sortOrder, new Date().toISOString()]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ChannelSourceError(`"${name}" đã có trong danh mục`, 409);
      }
      throw error;
    }
    return (await this.getById(id))!;
  }

  async update(
    id: string,
    input: { name?: unknown; active?: unknown; sortOrder?: unknown }
  ): Promise<ChannelSourceDto> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new ChannelSourceError("Không tìm thấy mục trong danh mục kênh", 404);
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push("name = ?");
      params.push(normalizeName(input.name));
    }
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean") {
        throw new ChannelSourceError("Trạng thái ẩn/hiện phải là true hoặc false", 400);
      }
      sets.push("active = ?");
      params.push(input.active);
    }
    if (input.sortOrder !== undefined) {
      const n = Number(input.sortOrder);
      if (!Number.isInteger(n) || n < 0 || n > 100000) {
        throw new ChannelSourceError("Thứ tự phải là số nguyên không âm", 400);
      }
      sets.push("sort_order = ?");
      params.push(n);
    }
    if (!sets.length) {
      throw new ChannelSourceError("Không có thông tin cần cập nhật", 400);
    }
    try {
      await run(`UPDATE channel_sources SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ChannelSourceError("Tên này đã có trong danh mục", 409);
      }
      throw error;
    }
    return (await this.getById(id))!;
  }

  /** Sắp xếp lại một loại danh mục theo đúng thứ tự `orderedIds` (trong một transaction). */
  async reorder(kindInput: unknown, orderedIds: unknown): Promise<ChannelSourceDto[]> {
    const kind = assertKind(kindInput);
    if (!Array.isArray(orderedIds) || !orderedIds.length || orderedIds.some((v) => typeof v !== "string")) {
      throw new ChannelSourceError("Danh sách thứ tự không hợp lệ", 400);
    }
    const ids = orderedIds as string[];
    if (new Set(ids).size !== ids.length) {
      throw new ChannelSourceError("Danh sách thứ tự có mục bị trùng", 400);
    }
    const rows = await query<{ id: string }>("SELECT id FROM channel_sources WHERE kind = ?", [kind]);
    const known = new Set(rows.map((r) => r.id));
    if (ids.some((id) => !known.has(id))) {
      throw new ChannelSourceError("Có mục không thuộc loại danh mục này", 400);
    }
    await transaction(async (tx) => {
      for (let i = 0; i < ids.length; i += 1) {
        await tx.run("UPDATE channel_sources SET sort_order = ? WHERE id = ?", [i + 1, ids[i]]);
      }
    });
    return this.list({ kind, includeInactive: true });
  }

  /** Đã được dùng thì chỉ ẩn (active=false); chưa dùng thì xóa hẳn. */
  async remove(id: string): Promise<{ deleted: boolean; deactivated: boolean; message: string; item?: ChannelSourceDto }> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new ChannelSourceError("Không tìm thấy mục trong danh mục kênh", 404);
    }
    const used = (await usageCounts()).get(id) ?? 0;
    if (used > 0) {
      await run("UPDATE channel_sources SET active = FALSE WHERE id = ?", [id]);
      return {
        deleted: false,
        deactivated: true,
        message: `"${existing.name}" đã được dùng ở ${used} bản ghi nên không xóa hẳn, chỉ chuyển sang ẩn.`,
        item: (await this.getById(id))!,
      };
    }
    await run("DELETE FROM channel_sources WHERE id = ?", [id]);
    return { deleted: true, deactivated: false, message: `Đã xóa "${existing.name}".` };
  }
}
