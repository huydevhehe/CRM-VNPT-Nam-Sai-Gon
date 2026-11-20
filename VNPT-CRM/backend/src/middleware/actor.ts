import { Request } from "express";
import { query } from "../database/db.js";
import { ROLES } from "../constants/org.js";

/** Giá trị không khớp bất kỳ nhân viên nào: dùng khi không xác định được tên người gọi. */
export const NO_MATCH_STAFF = "\u0000__NO_STAFF__\u0000";

/**
 * Lấy tên nhân viên hiện tại từ DB theo `req.user.id` (KHÔNG tin `name` ghi
 * trong JWT — token có thể được phát hành trước khi nhân viên bị đổi tên).
 * Trả `null` nếu không tìm thấy user (không nên xảy ra sau `requireAuth`,
 * nhưng vẫn xử lý để nơi gọi ép về giá trị không khớp bất kỳ nhân viên nào).
 */
export async function resolveActorName(req: Request): Promise<string | null> {
  const userId = req.user?.id;
  if (!userId) {
    return null;
  }
  const rows = await query<{ name: string | null }>("SELECT name FROM users WHERE id = ?", [userId]);
  const name = rows[0]?.name;
  return typeof name === "string" && name.trim() ? name : null;
}

/**
 * Phạm vi dữ liệu theo người gọi: `null` = Admin (không giới hạn); chuỗi = chỉ
 * được thao tác dữ liệu có chủ sở hữu trùng tên nhân viên này (không xác định
 * được tên thì trả `NO_MATCH_STAFF` để không khớp bản ghi nào).
 */
export async function resolveStaffScope(req: Request): Promise<string | null> {
  if (req.user?.role === ROLES.ADMIN) {
    return null;
  }
  return (await resolveActorName(req)) ?? NO_MATCH_STAFF;
}
