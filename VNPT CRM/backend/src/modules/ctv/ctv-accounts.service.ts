import { query, run } from "../../database/db.js";
import { ROLES, USER_STATUS } from "../../constants/org.js";
import { HttpError, AuthService, validateCtvInput, RegisterCtvInput } from "../auth/auth.service.js";

interface CtvAccountRow {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  email: string | null;
  referral_code: string | null;
  status: string | null;
  created_at: string | null;
  approved_at: string | null;
}

export interface CtvAccountDto {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  referralCode: string;
  status: string;
  createdAt: string;
  approvedAt: string;
}

// Chỉ chọn cột an toàn — không bao giờ lấy password_hash.
const SELECT_COLUMNS =
  "id, username, name, phone, email, referral_code, status, created_at, approved_at";

const VALID_STATUSES: string[] = [USER_STATUS.ACTIVE, USER_STATUS.PENDING, USER_STATUS.REJECTED];

function toDto(row: CtvAccountRow): CtvAccountDto {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    referralCode: row.referral_code ?? "",
    status: row.status ?? USER_STATUS.ACTIVE,
    createdAt: row.created_at ?? "",
    approvedAt: row.approved_at ?? "",
  };
}

export class CtvAccountsService {
  async createByAdmin(
    input: RegisterCtvInput & { mustChangePassword?: boolean },
    adminName: string
  ): Promise<CtvAccountDto> {
    const v = validateCtvInput(input);
    const authService = new AuthService();
    const { id } = await authService.insertCtvUser(v, {
      status: USER_STATUS.ACTIVE,
      mustChangePassword: input.mustChangePassword !== false,
      approvedBy: adminName,
    });
    return this.requireCtv(id);
  }
  async list(status?: string): Promise<CtvAccountDto[]> {
    const params: unknown[] = [ROLES.CTV];
    let sql = `SELECT ${SELECT_COLUMNS} FROM users WHERE role = ?`;
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        throw new HttpError(400, "Trạng thái không hợp lệ");
      }
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC, id DESC";

    const rows = await query<CtvAccountRow>(sql, params);
    return rows.map(toDto);
  }

  async approve(id: string, approvedBy: string): Promise<CtvAccountDto> {
    await this.requireCtv(id);
    await run(
      "UPDATE users SET status = ?, approved_at = ?, approved_by = ? WHERE id = ? AND role = ?",
      [USER_STATUS.ACTIVE, new Date().toISOString(), approvedBy, id, ROLES.CTV]
    );
    return this.requireCtv(id);
  }

  async reject(id: string): Promise<CtvAccountDto> {
    await this.requireCtv(id);
    await run(
      "UPDATE users SET status = ?, approved_at = NULL, approved_by = NULL WHERE id = ? AND role = ?",
      [USER_STATUS.REJECTED, id, ROLES.CTV]
    );
    return this.requireCtv(id);
  }

  /**
   * Xóa cứng tài khoản CTV — chỉ cho phép khi CTV chưa phát sinh dữ liệu
   * (Lead/Đơn hàng/Khách hàng giới thiệu, hoa hồng). Nếu đã có dữ liệu,
   * dùng cơ chế "Từ chối" (reject) sẵn có thay vì xóa.
   */
  async remove(id: string, operator: string): Promise<void> {
    const ctv = await this.requireCtv(id);

    const [leads, contracts, customers, commissions] = await Promise.all([
      query<{ n: string }>("SELECT COUNT(*) AS n FROM leads WHERE referred_by_ctv_id = ?", [id]),
      query<{ n: string }>("SELECT COUNT(*) AS n FROM contracts WHERE referred_by_ctv_id = ?", [id]),
      query<{ n: string }>("SELECT COUNT(*) AS n FROM customers WHERE referred_by_ctv_id = ?", [id]),
      query<{ n: string }>("SELECT COUNT(*) AS n FROM commissions WHERE ctv_id = ?", [id]),
    ]);
    const counts = {
      leads: Number(leads[0]?.n ?? 0),
      contracts: Number(contracts[0]?.n ?? 0),
      customers: Number(customers[0]?.n ?? 0),
      commissions: Number(commissions[0]?.n ?? 0),
    };
    const total = counts.leads + counts.contracts + counts.customers + counts.commissions;
    if (total > 0) {
      throw new HttpError(
        409,
        `CTV đã phát sinh dữ liệu (Lead ${counts.leads}, đơn hàng ${counts.contracts}, khách hàng ${counts.customers}, hoa hồng ${counts.commissions}) nên không thể xóa. Hãy dùng chức năng "Từ chối" để ngừng hoạt động tài khoản này.`
      );
    }

    await run("DELETE FROM users WHERE id = ? AND role = ?", [id, ROLES.CTV]);
    await run('INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)', [
      `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      operator,
      "Xóa tài khoản CTV",
      `Xóa tài khoản CTV ${id} (${ctv.name} - ${ctv.username})`,
    ]);
  }

  private async requireCtv(id: string): Promise<CtvAccountDto> {
    const rows = await query<CtvAccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = ? AND role = ?`,
      [id, ROLES.CTV]
    );
    if (!rows.length) {
      throw new HttpError(404, "Không tìm thấy tài khoản cộng tác viên");
    }
    return toDto(rows[0]);
  }
}
