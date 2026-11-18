import { query } from "../../database/db.js";
import { getRolePermissions, type RolePermission } from "../../constants/permissions.js";
import { todayVn } from "../../utils/date-vn.js";
import { HttpError } from "../auth/auth.service.js";
import { listStaffWards, type StaffWardDto } from "./staff-territory.service.js";

export type StaffCustomerRole = "Bán hàng" | "CSKH" | "Bán hàng + CSKH";

export interface StaffOverviewCustomer {
  id: string;
  code: string | null;
  name: string;
  customerGroup: string | null;
  relation: StaffCustomerRole;
  teamName: string | null;
  activeServices: number;
}

export interface StaffOverviewDto {
  staff: {
    id: string;
    code: string;
    name: string;
    role: string;
    status: string;
    territory: string;
    email: string;
    phone: string | null;
    staffType: string | null;
  };
  permissions: RolePermission[];
  customers: StaffOverviewCustomer[];
  /** Tất cả phường nhân viên đang phụ trách (một nhân viên có thể phụ trách nhiều phường). */
  territories: StaffWardDto[];
  stats: { customers: number; leads: number; orders: number; openTasks: number };
}

interface StaffBasicRow {
  id: string;
  code: string;
  name: string;
  role: string;
  status: string;
  territory: string | null;
  email: string | null;
  phone: string | null;
  staff_type: string | null;
}

interface CustomerRow {
  id: string;
  customer_code: string | null;
  name: string;
  customer_group: string | null;
  am_staff: string | null;
  am_caring_staff: string | null;
  team_name: string | null;
  active_services: number | string | null;
}

async function countWhere(sql: string, params: unknown[]): Promise<number> {
  const rows = await query<{ count: number | string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

function relationOf(row: CustomerRow, name: string): StaffCustomerRole {
  const sales = (row.am_staff ?? "").trim() === name;
  const caring = (row.am_caring_staff ?? "").trim() === name;
  if (sales && caring) return "Bán hàng + CSKH";
  return sales ? "Bán hàng" : "CSKH";
}

export async function getStaffOverview(id: string): Promise<StaffOverviewDto> {
  const staffRows = await query<StaffBasicRow>(
    "SELECT id, code, name, role, status, territory, email, phone, staff_type FROM staff WHERE id = ?",
    [id]
  );
  const staff = staffRows[0];
  if (!staff) {
    throw new HttpError(404, "Không tìm thấy Nhân viên");
  }
  const name = staff.name.trim();

  const customerRows = await query<CustomerRow>(
    `SELECT c.id, c.customer_code, c.name, c.customer_group, c.am_staff, c.am_caring_staff,
            ct.name AS team_name,
            (SELECT COUNT(*) FROM services s WHERE s.customer_id = c.id AND s.expiration_date >= ?) AS active_services
     FROM customers c
     LEFT JOIN customer_teams ct ON ct.id = c.team_id
     WHERE TRIM(c.am_staff) = ? OR TRIM(c.am_caring_staff) = ?
     ORDER BY c.name ASC`,
    [todayVn(), name, name]
  );

  const customers: StaffOverviewCustomer[] = customerRows.map((row) => ({
    id: row.id,
    code: row.customer_code ?? null,
    name: row.name,
    customerGroup: row.customer_group ?? null,
    relation: relationOf(row, name),
    teamName: row.team_name ?? null,
    activeServices: Number(row.active_services ?? 0),
  }));

  const territories = await listStaffWards(name, staff.territory);

  const [leads, orders, openTasks] = await Promise.all([
    countWhere("SELECT COUNT(*) AS count FROM leads WHERE TRIM(staff_name) = ?", [name]),
    countWhere("SELECT COUNT(*) AS count FROM contracts WHERE TRIM(am_staff) = ?", [name]),
    countWhere("SELECT COUNT(*) AS count FROM tasks WHERE TRIM(assignee) = ? AND status <> 'Hoàn tất'", [name]),
  ]);

  return {
    staff: {
      id: staff.id,
      code: staff.code,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      territory: staff.territory ?? "",
      email: staff.email ?? "",
      phone: staff.phone ?? null,
      staffType: staff.staff_type ?? null,
    },
    permissions: getRolePermissions(staff.role),
    customers,
    territories,
    stats: { customers: customers.length, leads, orders, openTasks },
  };
}
