import { query, run, transaction } from "../../database/db.js";

export class CustomListError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409
  ) {
    super(message);
  }
}

export interface CustomListItemDto {
  id: string;
  listId: string;
  value: string;
  active: boolean;
  sortOrder: number;
  /** Đơn giá (chưa VAT) — chỉ dùng cho danh mục kiểu bảng giá (vd Gói dịch vụ), null nếu không áp dụng. */
  price: number | null;
}

export interface CustomListDto {
  id: string;
  name: string;
  items: CustomListItemDto[];
}

interface CustomListRow {
  id: string;
  name: string;
}

interface CustomListItemRow {
  id: string;
  list_id: string;
  value: string;
  active: boolean;
  sort_order: number;
  price: number | string | null;
}

function normalizeName(value: unknown, label: string): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) {
    throw new CustomListError(`${label} không được để trống`, 400);
  }
  if (name.length > 100) {
    throw new CustomListError(`${label} tối đa 100 ký tự`, 400);
  }
  return name;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

function toItemDto(row: CustomListItemRow): CustomListItemDto {
  return {
    id: row.id,
    listId: row.list_id,
    value: row.value,
    active: row.active,
    sortOrder: Number(row.sort_order),
    price: row.price === null || row.price === undefined ? null : Number(row.price),
  };
}

function normalizePrice(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new CustomListError("Đơn giá phải là số không âm", 400);
  }
  return num;
}

export class CustomListService {
  async listAll(): Promise<CustomListDto[]> {
    const lists = await query<CustomListRow>("SELECT * FROM custom_lists ORDER BY LOWER(name)");
    const items = await query<CustomListItemRow>(
      "SELECT * FROM custom_list_items ORDER BY sort_order, LOWER(value)"
    );
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      items: items.filter((i) => i.list_id === l.id).map(toItemDto),
    }));
  }

  async getList(id: string): Promise<CustomListDto | null> {
    const rows = await query<CustomListRow>("SELECT * FROM custom_lists WHERE id = ?", [id]);
    if (!rows.length) return null;
    const items = await query<CustomListItemRow>(
      "SELECT * FROM custom_list_items WHERE list_id = ? ORDER BY sort_order, LOWER(value)",
      [id]
    );
    return { id: rows[0].id, name: rows[0].name, items: items.map(toItemDto) };
  }

  async createList(name: unknown): Promise<CustomListDto> {
    const normalized = normalizeName(name, "Tên danh mục");
    const id = `CLIST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run("INSERT INTO custom_lists (id, name, created_at) VALUES (?, ?, ?)", [
        id,
        normalized,
        new Date().toISOString(),
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CustomListError(`Danh mục "${normalized}" đã tồn tại`, 409);
      }
      throw error;
    }
    return (await this.getList(id))!;
  }

  async renameList(id: string, name: unknown): Promise<CustomListDto> {
    const existing = await this.getList(id);
    if (!existing) {
      throw new CustomListError("Không tìm thấy danh mục", 404);
    }
    const normalized = normalizeName(name, "Tên danh mục");
    try {
      await run("UPDATE custom_lists SET name = ? WHERE id = ?", [normalized, id]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CustomListError(`Danh mục "${normalized}" đã tồn tại`, 409);
      }
      throw error;
    }
    return (await this.getList(id))!;
  }

  async removeList(id: string): Promise<void> {
    const existing = await this.getList(id);
    if (!existing) {
      throw new CustomListError("Không tìm thấy danh mục", 404);
    }
    await transaction(async (tx) => {
      await tx.run("DELETE FROM custom_list_items WHERE list_id = ?", [id]);
      await tx.run("DELETE FROM custom_lists WHERE id = ?", [id]);
    });
  }

  async addItem(listId: string, value: unknown, price?: unknown): Promise<CustomListItemDto> {
    const list = await this.getList(listId);
    if (!list) {
      throw new CustomListError("Không tìm thấy danh mục", 404);
    }
    const normalized = normalizeName(value, "Giá trị");
    const normalizedPrice = normalizePrice(price);
    const max = await query<{ max: number | null }>(
      "SELECT MAX(sort_order) AS max FROM custom_list_items WHERE list_id = ?",
      [listId]
    );
    const sortOrder = Number(max[0]?.max ?? 0) + 1;
    const id = `CLITEM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run(
        "INSERT INTO custom_list_items (id, list_id, value, active, sort_order, created_at, price) VALUES (?, ?, ?, TRUE, ?, ?, ?)",
        [id, listId, normalized, sortOrder, new Date().toISOString(), normalizedPrice]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CustomListError(`"${normalized}" đã có trong danh mục`, 409);
      }
      throw error;
    }
    const rows = await query<CustomListItemRow>("SELECT * FROM custom_list_items WHERE id = ?", [id]);
    return toItemDto(rows[0]);
  }

  async updateItem(
    itemId: string,
    input: { value?: unknown; active?: unknown; price?: unknown }
  ): Promise<CustomListItemDto> {
    const rows = await query<CustomListItemRow>("SELECT * FROM custom_list_items WHERE id = ?", [itemId]);
    if (!rows.length) {
      throw new CustomListError("Không tìm thấy mục trong danh mục", 404);
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.value !== undefined) {
      sets.push("value = ?");
      params.push(normalizeName(input.value, "Giá trị"));
    }
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean") {
        throw new CustomListError("Trạng thái ẩn/hiện phải là true hoặc false", 400);
      }
      sets.push("active = ?");
      params.push(input.active);
    }
    if (input.price !== undefined) {
      sets.push("price = ?");
      params.push(normalizePrice(input.price));
    }
    if (!sets.length) {
      throw new CustomListError("Không có thông tin cần cập nhật", 400);
    }
    try {
      await run(`UPDATE custom_list_items SET ${sets.join(", ")} WHERE id = ?`, [...params, itemId]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CustomListError("Giá trị này đã có trong danh mục", 409);
      }
      throw error;
    }
    const updated = await query<CustomListItemRow>("SELECT * FROM custom_list_items WHERE id = ?", [itemId]);
    return toItemDto(updated[0]);
  }

  async removeItem(itemId: string): Promise<void> {
    const rows = await query<CustomListItemRow>("SELECT * FROM custom_list_items WHERE id = ?", [itemId]);
    if (!rows.length) {
      throw new CustomListError("Không tìm thấy mục trong danh mục", 404);
    }
    await run("DELETE FROM custom_list_items WHERE id = ?", [itemId]);
  }
}
