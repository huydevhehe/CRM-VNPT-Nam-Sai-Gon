import { query, type TransactionClient } from "../../database/db.js";
import { HttpError } from "../auth/auth.service.js";
import { normalizeWardName } from "../territory/ward-name.js";

/**
 * Quan hệ nhân viên - phường:
 * - Nguồn chính là `territories.staff_name` (một phường có một nhân viên phụ trách,
 *   một nhân viên có thể phụ trách nhiều phường). Trang Địa bàn đọc cột này.
 * - `staff.territory` là chuỗi tóm tắt (tên các phường, ngăn cách ", "), giữ lại để
 *   hiển thị/tương thích dữ liệu cũ.
 */

export interface WardRow {
  id: string;
  ward_name: string;
  staff_name: string | null;
}

const MAX_WARDS_PER_STAFF = 100;

/** Tách chuỗi `staff.territory` cũ (có thể là 1 hoặc nhiều phường) thành danh sách tên. */
export function splitLegacyTerritory(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Kiểm tra danh sách id phường gửi lên, trả về các dòng phường (đã khử trùng, giữ thứ tự gửi). */
export async function resolveWards(input: unknown): Promise<WardRow[]> {
  if (!Array.isArray(input)) {
    throw new HttpError(400, "Danh sách phường phụ trách không hợp lệ");
  }
  const ids: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string" || !raw.trim()) {
      throw new HttpError(400, "Danh sách phường phụ trách không hợp lệ");
    }
    const id = raw.trim();
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_WARDS_PER_STAFF) {
    throw new HttpError(400, `Một nhân viên phụ trách tối đa ${MAX_WARDS_PER_STAFF} phường`);
  }
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await query<WardRow>(
    `SELECT id, ward_name, staff_name FROM territories WHERE id IN (${placeholders})`,
    ids
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new HttpError(400, "Có phường không tồn tại trong danh mục địa bàn");
  }
  return ids.map((id) => byId.get(id)!);
}

/** Chuỗi tóm tắt lưu vào `staff.territory`. */
export function summarizeWards(wards: WardRow[]): string {
  return [...wards]
    .map((w) => w.ward_name)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .join(", ");
}

/**
 * Đặt danh sách phường của nhân viên `staffName` đúng bằng `wards`:
 * - phường đang giao cho nhân viên nhưng không còn trong danh sách → bỏ phụ trách (NULL);
 * - phường trong danh sách → gán cho nhân viên (nếu đang của người khác thì chuyển sang).
 * Ghi audit log khi có thay đổi. Phải gọi trong transaction của người gọi.
 */
export async function syncStaffTerritories(
  tx: TransactionClient,
  staffName: string,
  wards: WardRow[],
  actor: string
): Promise<void> {
  const name = staffName.trim();
  const wantedIds = new Set(wards.map((w) => w.id));

  const held = await tx.query<{ id: string; ward_name: string }>(
    "SELECT id, ward_name FROM territories WHERE TRIM(staff_name) = ?",
    [name]
  );
  const released = held.filter((h) => !wantedIds.has(h.id));
  for (const w of released) {
    await tx.run("UPDATE territories SET staff_name = NULL WHERE id = ?", [w.id]);
  }

  const added: string[] = [];
  const taken: string[] = [];
  const lostByOwner = new Map<string, string[]>();
  for (const w of wards) {
    const current = (w.staff_name ?? "").trim();
    if (current === name) continue;
    // Đọc lại trong transaction để tránh dựa vào dữ liệu đã cũ.
    const fresh = await tx.query<{ staff_name: string | null }>(
      "SELECT staff_name FROM territories WHERE id = ?",
      [w.id]
    );
    const freshOwner = (fresh[0]?.staff_name ?? "").trim();
    if (freshOwner === name) continue;
    await tx.run("UPDATE territories SET staff_name = ? WHERE id = ?", [name, w.id]);
    added.push(w.ward_name);
    if (freshOwner) {
      taken.push(`${w.ward_name} (từ ${freshOwner})`);
      lostByOwner.set(freshOwner, [...(lostByOwner.get(freshOwner) ?? []), w.ward_name]);
    }
  }

  // Nhân viên bị chuyển phường đi: bỏ tên phường đó khỏi chuỗi tóm tắt trong hồ sơ.
  for (const [owner, lost] of lostByOwner) {
    const lostKeys = new Set(lost.map(normalizeWardName));
    const rows = await tx.query<{ id: string; territory: string | null }>(
      "SELECT id, territory FROM staff WHERE TRIM(name) = ?",
      [owner]
    );
    for (const row of rows) {
      const remaining = splitLegacyTerritory(row.territory).filter((t) => !lostKeys.has(normalizeWardName(t)));
      await tx.run("UPDATE staff SET territory = ? WHERE id = ?", [remaining.join(", "), row.id]);
    }
  }

  if (released.length === 0 && added.length === 0) return;

  const parts: string[] = [];
  if (added.length) parts.push(`gán ${added.join(", ")}`);
  if (taken.length) parts.push(`chuyển từ nhân viên khác: ${taken.join("; ")}`);
  if (released.length) parts.push(`bỏ ${released.map((r) => r.ward_name).join(", ")}`);
  await tx.run(
    'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
    [
      `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor,
      "Cập nhật phường phụ trách",
      `Nhân viên ${name}: ${parts.join("; ")}`,
    ]
  );
}

/** Map tên nhân viên (đã trim) → danh sách tên phường đang phụ trách (theo `territories.staff_name`). */
export async function getWardNamesByStaff(): Promise<Map<string, string[]>> {
  const rows = await query<{ staff_name: string | null; ward_name: string }>(
    "SELECT staff_name, ward_name FROM territories WHERE staff_name IS NOT NULL AND TRIM(staff_name) <> '' ORDER BY ward_name ASC"
  );
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const key = (r.staff_name ?? "").trim();
    const list = map.get(key) ?? [];
    list.push(r.ward_name);
    map.set(key, list);
  }
  return map;
}

export interface StaffWardDto {
  id: string;
  wardName: string;
  householdCount: number;
  quarterCount: number;
  /** "assigned": gán ở danh mục địa bàn. "profile": chỉ có trong hồ sơ nhân viên, phường chưa gán cho ai. */
  source: "assigned" | "profile";
}

/** Tất cả phường của một nhân viên: phường gán ở địa bàn + phường ghi trong hồ sơ cũ mà chưa ai phụ trách. */
export async function listStaffWards(
  staffName: string,
  legacyTerritoryText: string | null | undefined
): Promise<StaffWardDto[]> {
  const name = staffName.trim();
  const rows = await query<{
    id: string;
    ward_name: string;
    staff_name: string | null;
    household_count: number | string | null;
    quarter_count: number | string | null;
  }>("SELECT id, ward_name, staff_name, household_count, quarter_count FROM territories ORDER BY ward_name ASC");

  const legacy = new Set(splitLegacyTerritory(legacyTerritoryText).map(normalizeWardName));
  const result: StaffWardDto[] = [];
  for (const r of rows) {
    const owner = (r.staff_name ?? "").trim();
    let source: StaffWardDto["source"] | null = null;
    if (owner === name) source = "assigned";
    else if (!owner && legacy.has(normalizeWardName(r.ward_name))) source = "profile";
    if (!source) continue;
    result.push({
      id: r.id,
      wardName: r.ward_name,
      householdCount: Number(r.household_count ?? 0),
      quarterCount: Number(r.quarter_count ?? 0),
      source,
    });
  }
  return result;
}
