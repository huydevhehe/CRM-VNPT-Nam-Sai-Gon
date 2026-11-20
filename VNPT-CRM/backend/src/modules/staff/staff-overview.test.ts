import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

const { initDatabase, run } = await import("../../database/db.js");
const { applySchemaExtensions } = await import("../../database/schema-extensions.js");
const { config } = await import("../../config/index.js");
const { requireAuth } = await import("../../middleware/require-auth.js");
const { requireStaff } = await import("../../middleware/require-role.js");
const { staffRouter } = await import("./staff.controller.js");
const { StaffService } = await import("./staff.service.js");
const { PERMISSION_MODULES } = await import("../../constants/permissions.js");

await initDatabase();
await applySchemaExtensions();

const ADMIN = { id: "USR-ADMIN", role: "Admin", name: "Quản trị viên" };
const AM = { id: "USR-VNPT-AM-01", role: "AM Bán chăm", name: "Nguyễn Thị Tình" };

const app = express();
app.use(express.json());
app.use("/api/staff", requireAuth, requireStaff, staffRouter);
const server: Server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

const suffix = `${Date.now()}`;
const CTV = { id: `USR-CTV-OV-${suffix}`, role: "CTV", name: `CTV Overview ${suffix}` };
const staffIds: string[] = [];
const userIds: string[] = [CTV.id];
const customerIds: string[] = [];
const teamIds: string[] = [];
const serviceIds: string[] = [];
const leadIds: string[] = [];
const contractIds: string[] = [];
const taskIds: string[] = [];

after(async () => {
  for (const id of taskIds) await run("DELETE FROM tasks WHERE id = ?", [id]);
  for (const id of contractIds) await run("DELETE FROM contracts WHERE id = ?", [id]);
  for (const id of leadIds) await run("DELETE FROM leads WHERE id = ?", [id]);
  for (const id of serviceIds) await run("DELETE FROM services WHERE id = ?", [id]);
  for (const id of customerIds) await run("DELETE FROM customers WHERE id = ?", [id]);
  for (const id of teamIds) await run("DELETE FROM customer_teams WHERE id = ?", [id]);
  for (const id of staffIds) await run("DELETE FROM staff WHERE id = ?", [id]);
  for (const id of userIds) await run("DELETE FROM users WHERE id = ?", [id]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

await run("INSERT INTO users (id, username, name, role, status) VALUES (?, ?, ?, ?, ?)", [
  CTV.id,
  `ctv-ov-${suffix}`,
  CTV.name,
  "CTV",
  "Đang hoạt động",
]);

function tokenOf(u: { id: string; role: string; name: string }): string {
  return jwt.sign({ sub: u.id, role: u.role, name: u.name }, config.jwtSecret, { expiresIn: "1h" });
}

async function call(actor: { id: string; role: string; name: string } | null, path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: actor ? { Authorization: `Bearer ${tokenOf(actor)}` } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function createStaff(role: string, tag: string) {
  const code = `NV-OV-${tag}-${suffix}`;
  const created = await new StaffService().create({
    code,
    name: `Nhân viên Overview ${tag} ${suffix}`,
    role,
    password: "Password@12345",
  });
  staffIds.push(created.id);
  userIds.push(`USR-${code}`);
  return created;
}

async function insertCustomer(
  tag: string,
  amStaff: string | null,
  amCaring: string | null,
  extra: { code?: string; teamId?: string } = {}
) {
  const id = `CUST-OV-${tag}-${suffix}`;
  await run(
    `INSERT INTO customers (id, name, type, customer_group, customer_code, am_staff, am_caring_staff, team_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, `KH Overview ${tag}`, "Doanh nghiệp", "Tự phát triển", extra.code ?? null, amStaff, amCaring, extra.teamId ?? null]
  );
  customerIds.push(id);
  return id;
}

test("GET /staff/permissions: chưa đăng nhập 401, AM và CTV bị 403", async () => {
  assert.equal((await call(null, "/staff/permissions")).status, 401);
  assert.equal((await call(AM, "/staff/permissions")).status, 403);
  assert.equal((await call(CTV, "/staff/permissions")).status, 403);
});

test("GET /staff/permissions: Admin nhận ma trận 3 vai trò thật, không có Viewer", async () => {
  const res = await call(ADMIN, "/staff/permissions");
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.deepEqual(
    data.roles.map((r: any) => r.role),
    ["Admin", "AM", "AM Bán chăm"]
  );
  assert.deepEqual(data.levels, ["Toàn quyền", "Chỉ dữ liệu của mình", "Chỉ xem", "Không có quyền"]);
  assert.equal(data.modules.length, PERMISSION_MODULES.length);
  for (const m of data.modules) {
    assert.equal(m.access.Admin, "Toàn quyền");
    assert.ok(data.levels.includes(m.access.AM));
    assert.equal(m.access["AM Bán chăm"], m.access.AM);
  }
  const byKey = new Map<string, any>(data.modules.map((m: any) => [m.key, m]));
  for (const key of ["commissions", "reports", "reminders", "ctv", "staff", "data_transfer", "system_settings"]) {
    assert.equal(byKey.get(key).access.AM, "Không có quyền", key);
  }
  for (const key of ["leads", "orders", "services", "payment_requests", "tasks"]) {
    assert.equal(byKey.get(key).access.AM, "Chỉ dữ liệu của mình", key);
  }
  assert.equal(byKey.get("customers").access.AM, "Chỉ xem");
  assert.ok(!JSON.stringify(data).includes("Viewer"));
});

test("GET /staff/:id/overview: chưa đăng nhập 401, AM và CTV bị 403, không có nhân viên 404", async () => {
  const target = await createStaff("AM", "auth");
  assert.equal((await call(null, `/staff/${target.id}/overview`)).status, 401);
  assert.equal((await call(AM, `/staff/${target.id}/overview`)).status, 403);
  assert.equal((await call(CTV, `/staff/${target.id}/overview`)).status, 403);

  const missing = await call(ADMIN, "/staff/STAFF-KHONG-TON-TAI/overview");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, "Không tìm thấy Nhân viên");
});

test("GET /staff/:id/overview: đếm khách theo cả AM bán hàng lẫn CSKH, kèm số liệu tổng", async () => {
  const target = await createStaff("AM", "main");
  const other = await createStaff("AM Bán chăm", "other");
  const name = target.name;

  const teamId = `TEAM-OV-${suffix}`;
  await run("INSERT INTO customer_teams (id, name) VALUES (?, ?)", [teamId, `Team Overview ${suffix}`]);
  teamIds.push(teamId);

  const salesOnly = await insertCustomer("sales", name, other.name, { code: `KH-OV-S-${suffix}`, teamId });
  const caringOnly = await insertCustomer("caring", other.name, name);
  const both = await insertCustomer("both", name, name);
  await insertCustomer("foreign", other.name, other.name);

  const addService = async (tag: string, customerId: string, expiration: string) => {
    const id = `SVC-OV-${tag}-${suffix}`;
    await run(
      `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, "KH Overview", "Internet", `SC-${tag}-${suffix}`, "2024-01-01", expiration, name, customerId]
    );
    serviceIds.push(id);
  };
  await addService("a", salesOnly, "2999-12-31");
  await addService("b", salesOnly, "2999-12-31");
  await addService("c", salesOnly, "2000-01-01");

  for (const tag of ["l1", "l2"]) {
    const id = `LEAD-OV-${tag}-${suffix}`;
    await run(
      "INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name) VALUES (?, ?, ?, ?, ?, ?)",
      [id, `Lead ${tag}`, "0901234567", "Lead KH mới", "Online", name]
    );
    leadIds.push(id);
  }

  const contractId = `CTR-OV-${suffix}`;
  await run(
    "INSERT INTO contracts (id, transaction_code, customer_name, subscriber_codes, channel, am_staff) VALUES (?, ?, ?, ?, ?, ?)",
    [contractId, `GD-OV-${suffix}`, "KH Overview", "SUB1", "Trực tiếp", name]
  );
  contractIds.push(contractId);

  for (const [tag, status] of [
    ["open", "Mới"],
    ["doing", "Đang làm"],
    ["done", "Hoàn tất"],
  ] as const) {
    const id = `TASK-OV-${tag}-${suffix}`;
    await run(
      "INSERT INTO tasks (id, title, related_target, assignee, due_date, status) VALUES (?, ?, ?, ?, ?, ?)",
      [id, `Việc ${tag}`, "KH", name, "2026-12-31", status]
    );
    taskIds.push(id);
  }

  const res = await call(ADMIN, `/staff/${target.id}/overview`);
  assert.equal(res.status, 200);
  const data = res.body.data;

  assert.equal(data.staff.id, target.id);
  assert.equal(data.staff.name, name);
  assert.equal(data.staff.role, "AM");
  assert.equal(data.staff.status, "Đang hoạt động");

  assert.deepEqual(data.stats, { customers: 3, leads: 2, orders: 1, openTasks: 2 });

  const byId = new Map<string, any>(data.customers.map((c: any) => [c.id, c]));
  assert.equal(data.customers.length, 3);
  assert.equal(byId.get(salesOnly).relation, "Bán hàng");
  assert.equal(byId.get(salesOnly).code, `KH-OV-S-${suffix}`);
  assert.equal(byId.get(salesOnly).teamName, `Team Overview ${suffix}`);
  assert.equal(byId.get(salesOnly).customerGroup, "Tự phát triển");
  assert.equal(byId.get(salesOnly).activeServices, 2);
  assert.equal(byId.get(caringOnly).relation, "CSKH");
  assert.equal(byId.get(caringOnly).teamName, null);
  assert.equal(byId.get(caringOnly).activeServices, 0);
  assert.equal(byId.get(both).relation, "Bán hàng + CSKH");

  const permissions: Array<{ key: string; level: string }> = data.permissions;
  assert.equal(permissions.length, PERMISSION_MODULES.length);
  assert.equal(permissions.find((p) => p.key === "commissions")?.level, "Không có quyền");
  assert.equal(permissions.find((p) => p.key === "customers")?.level, "Chỉ xem");

  assert.ok(!/password/i.test(JSON.stringify(res.body)), "Không được lộ trường mật khẩu");
});

test("GET /staff/:id/overview: nhân viên Admin có Toàn quyền, chưa có khách thì danh sách rỗng", async () => {
  const admin = await createStaff("Admin", "adm");
  const res = await call(ADMIN, `/staff/${admin.id}/overview`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.customers, []);
  assert.deepEqual(res.body.data.stats, { customers: 0, leads: 0, orders: 0, openTasks: 0 });
  assert.ok(res.body.data.permissions.every((p: any) => p.level === "Toàn quyền"));
});

test("Route mới không làm hỏng GET /staff cho Admin", async () => {
  const res = await call(ADMIN, "/staff");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});
