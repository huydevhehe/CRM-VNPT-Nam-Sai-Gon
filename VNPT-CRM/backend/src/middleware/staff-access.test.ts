import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

const { initDatabase, query, run } = await import("../database/db.js");
const { config } = await import("../config/index.js");
const { requireAuth } = await import("./require-auth.js");
const { requireStaff } = await import("./require-role.js");
const { leadRouter } = await import("../modules/lead/lead.controller.js");
const { taskRouter } = await import("../modules/task/task.controller.js");
const { staffRouter } = await import("../modules/staff/staff.controller.js");
const { serviceRouter } = await import("../modules/service/service.controller.js");
const { contractRouter } = await import("../modules/contract/contract.controller.js");
const { territoryRouter } = await import("../modules/territory/territory.controller.js");

await initDatabase();

const AM_A = { id: "USR-VNPT-AM-01", role: "AM Bán chăm", name: "Nguyễn Thị Tình" };
const AM_B = { id: "USR-VNPT-AM-02", role: "AM", name: "Nguyễn Thị Huyền Trang" };
const ADMIN = { id: "USR-ADMIN", role: "Admin", name: "Quản trị viên" };

function tokenOf(u: { id: string; role: string; name: string }): string {
  return jwt.sign({ sub: u.id, role: u.role, name: u.name }, config.jwtSecret, { expiresIn: "1h" });
}

const app = express();
app.use(express.json());
app.use("/api/leads", requireAuth, requireStaff, leadRouter);
app.use("/api/tasks", requireAuth, requireStaff, taskRouter);
app.use("/api/staff", requireAuth, requireStaff, staffRouter);
app.use("/api/services", requireAuth, requireStaff, serviceRouter);
app.use("/api/contracts", requireAuth, requireStaff, contractRouter);
app.use("/api/territories", requireAuth, requireStaff, territoryRouter);

const server: Server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

const createdLeadIds: string[] = [];
const createdTaskIds: string[] = [];
const createdServiceIds: string[] = [];
const createdContractIds: string[] = [];

after(async () => {
  for (const id of createdLeadIds) await run("DELETE FROM leads WHERE id = ?", [id]);
  for (const id of createdTaskIds) await run("DELETE FROM tasks WHERE id = ?", [id]);
  for (const id of createdServiceIds) await run("DELETE FROM services WHERE id = ?", [id]);
  for (const id of createdContractIds) {
    await run("DELETE FROM payment_request_exports WHERE contract_id = ?", [id]);
    await run("DELETE FROM contract_payments WHERE contract_id = ?", [id]);
    await run("DELETE FROM contracts WHERE id = ?", [id]);
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(
  actor: { id: string; role: string; name: string } | null,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(actor ? { Authorization: `Bearer ${tokenOf(actor)}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function leadPayload(staffName: string | undefined, tag: string) {
  return {
    customerName: `KH Phân quyền ${tag}`,
    phone: "0901234567",
    group: "Lead KH mới",
    channel: "Chiến dịch",
    ...(staffName === undefined ? {} : { staffName }),
  };
}

async function adminCreateLead(staffName: string, tag: string): Promise<string> {
  const res = await call(ADMIN, "POST", "/leads", leadPayload(staffName, tag));
  assert.equal(res.status, 201);
  createdLeadIds.push(res.body.data.id);
  return res.body.data.id;
}

async function adminCreateTask(assignee: string, tag: string): Promise<string> {
  const res = await call(ADMIN, "POST", "/tasks", {
    title: `Việc phân quyền ${tag}`,
    relatedTarget: "KH test",
    assignee,
    dueDate: "2026-12-31",
  });
  assert.equal(res.status, 201);
  createdTaskIds.push(res.body.data.id);
  return res.body.data.id;
}

test("Lead: chưa đăng nhập 401; AM chỉ thấy Lead của mình, Admin thấy tất cả", async () => {
  assert.equal((await call(null, "GET", "/leads")).status, 401);

  const tag = `${Date.now()}`;
  const mine = await adminCreateLead(AM_A.name, `own-${tag}`);
  const other = await adminCreateLead(AM_B.name, `other-${tag}`);

  const amList = await call(AM_A, "GET", "/leads");
  assert.equal(amList.status, 200);
  const amIds = amList.body.data.map((l: any) => l.id);
  assert.ok(amIds.includes(mine));
  assert.ok(!amIds.includes(other));
  assert.ok(amList.body.data.every((l: any) => l.staffName === AM_A.name));

  const adminIds = (await call(ADMIN, "GET", "/leads")).body.data.map((l: any) => l.id);
  assert.ok(adminIds.includes(mine) && adminIds.includes(other));
});

test("Lead: AM chỉ đổi trạng thái/ghi chú Lead của mình, Lead người khác bị 403", async () => {
  const tag = `${Date.now()}`;
  const mine = await adminCreateLead(AM_A.name, `st-own-${tag}`);
  const other = await adminCreateLead(AM_B.name, `st-other-${tag}`);

  assert.equal((await call(AM_A, "PATCH", `/leads/${mine}/status`, { status: "Đã liên hệ" })).status, 200);
  assert.equal((await call(AM_A, "PATCH", `/leads/${mine}/note`, { note: "ghi chú" })).status, 200);

  assert.equal((await call(AM_A, "PATCH", `/leads/${other}/status`, { status: "Đã liên hệ" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/leads/${other}/note`, { note: "xâm nhập" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/leads/LEAD-KHONG-TON-TAI/note`, { note: "x" })).status, 404);

  assert.equal((await call(ADMIN, "PATCH", `/leads/${other}/status`, { status: "Đã liên hệ" })).status, 200);
});

test("Lead: giao/đổi AM chỉ Admin (AM gọi 403 kể cả Lead của mình)", async () => {
  const mine = await adminCreateLead(AM_A.name, `as-${Date.now()}`);

  const denied = await call(AM_A, "PATCH", `/leads/${mine}/assignment`, { staffName: AM_B.name });
  assert.equal(denied.status, 403);
  const stillMine = (await call(AM_A, "GET", "/leads")).body.data.find((l: any) => l.id === mine);
  assert.equal(stillMine?.staffName, AM_A.name);

  const ok = await call(ADMIN, "PATCH", `/leads/${mine}/assignment`, { staffName: AM_B.name });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.staffName, AM_B.name);
});

test("Lead: AM chỉ tạo Lead gán cho chính mình", async () => {
  const tag = `${Date.now()}`;

  const forOther = await call(AM_A, "POST", "/leads", leadPayload(AM_B.name, `c-other-${tag}`));
  assert.equal(forOther.status, 403);

  const random = await call(AM_A, "POST", "/leads", leadPayload("__RANDOM__", `c-rand-${tag}`));
  assert.equal(random.status, 403);

  const self = await call(AM_A, "POST", "/leads", leadPayload(AM_A.name, `c-self-${tag}`));
  assert.equal(self.status, 201);
  createdLeadIds.push(self.body.data.id);
  assert.equal(self.body.data.staffName, AM_A.name);

  const blank = await call(AM_A, "POST", "/leads", leadPayload(undefined, `c-blank-${tag}`));
  assert.equal(blank.status, 201);
  createdLeadIds.push(blank.body.data.id);
  assert.equal(blank.body.data.staffName, AM_A.name);

  const adminForOther = await call(ADMIN, "POST", "/leads", leadPayload(AM_B.name, `c-admin-${tag}`));
  assert.equal(adminForOther.status, 201);
  createdLeadIds.push(adminForOther.body.data.id);
});

test("Công việc: AM chỉ thấy/sửa việc giao cho mình, tạo việc chỉ cho chính mình", async () => {
  const tag = `${Date.now()}`;
  const mine = await adminCreateTask(AM_A.name, `own-${tag}`);
  const other = await adminCreateTask(AM_B.name, `other-${tag}`);

  const list = await call(AM_A, "GET", "/tasks");
  assert.equal(list.status, 200);
  const ids = list.body.data.map((t: any) => t.id);
  assert.ok(ids.includes(mine));
  assert.ok(!ids.includes(other));
  assert.ok(list.body.data.every((t: any) => t.assignee === AM_A.name));

  const adminIds = (await call(ADMIN, "GET", "/tasks")).body.data.map((t: any) => t.id);
  assert.ok(adminIds.includes(mine) && adminIds.includes(other));

  assert.equal((await call(AM_A, "PATCH", `/tasks/${mine}/status`, { status: "Đang làm" })).status, 200);
  assert.equal((await call(AM_A, "PATCH", `/tasks/${other}/status`, { status: "Đang làm" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/tasks/TASK-KHONG-TON-TAI/status`, { status: "Đang làm" })).status, 404);

  const body = (assignee?: string) => ({
    title: `Việc AM tạo ${tag}`,
    relatedTarget: "KH test",
    dueDate: "2026-12-31",
    ...(assignee === undefined ? {} : { assignee }),
  });
  assert.equal((await call(AM_A, "POST", "/tasks", body(AM_B.name))).status, 403);
  const self = await call(AM_A, "POST", "/tasks", body(AM_A.name));
  assert.equal(self.status, 201);
  createdTaskIds.push(self.body.data.id);
  const blank = await call(AM_A, "POST", "/tasks", body());
  assert.equal(blank.status, 201);
  createdTaskIds.push(blank.body.data.id);
  assert.equal(blank.body.data.assignee, AM_A.name);
});

test("Lead: xóa chỉ Admin — AM 403, Admin 200, 404 khi không tồn tại", async () => {
  const tag = `${Date.now()}`;
  const target = await adminCreateLead(AM_A.name, `del-${tag}`);

  assert.equal((await call(null, "DELETE", `/leads/${target}`)).status, 401);
  assert.equal((await call(AM_A, "DELETE", `/leads/${target}`)).status, 403);
  assert.equal((await call(ADMIN, "DELETE", "/leads/LEAD-KHONG-TON-TAI")).status, 404);

  const ok = await call(ADMIN, "DELETE", `/leads/${target}`);
  assert.equal(ok.status, 200);

  const getAfter = await call(ADMIN, "GET", "/leads");
  assert.ok(!getAfter.body.data.some((l: any) => l.id === target));
});

test("Công việc: xóa chỉ Admin — AM 403, Admin 200, 404 khi không tồn tại", async () => {
  const tag = `${Date.now()}`;
  const target = await adminCreateTask(AM_A.name, `del-${tag}`);

  assert.equal((await call(null, "DELETE", `/tasks/${target}`)).status, 401);
  assert.equal((await call(AM_A, "DELETE", `/tasks/${target}`)).status, 403);
  assert.equal((await call(ADMIN, "DELETE", "/tasks/TASK-KHONG-TON-TAI")).status, 404);

  const ok = await call(ADMIN, "DELETE", `/tasks/${target}`);
  assert.equal(ok.status, 200);
});

test("Nhân viên: AM chỉ nhận danh bạ rút gọn; Admin nhận đủ hồ sơ", async () => {
  const am = await call(AM_A, "GET", "/staff");
  assert.equal(am.status, 200);
  assert.ok(am.body.data.length > 0);
  for (const item of am.body.data) {
    assert.deepEqual(Object.keys(item).sort(), ["code", "id", "name", "role", "status"]);
  }

  const admin = await call(ADMIN, "GET", "/staff");
  assert.equal(admin.status, 200);
  assert.ok("email" in admin.body.data[0]);
  assert.ok("revenue" in admin.body.data[0]);
  assert.ok("phone" in admin.body.data[0]);
});

test("Nhân viên: AM không gọi được route ghi (403)", async () => {
  assert.equal((await call(AM_A, "POST", "/staff", { code: "X", name: "X", role: "AM", password: "12345678" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", "/staff/NV-02", { name: "Hack" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", "/staff/NV-02/password", { password: "12345678" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", "/staff/NV-02/status", { status: "Đình chỉ" })).status, 403);
  assert.equal((await call(AM_A, "GET", "/staff/NV-02/references")).status, 403);
});

test("Dịch vụ: AM chỉ thấy dịch vụ của mình, bỏ qua ?staff= của client", async () => {
  const tag = `${Date.now()}`;
  const mineId = `SRV-ACL-A-${tag}`;
  const otherId = `SRV-ACL-B-${tag}`;
  for (const [id, staff] of [
    [mineId, AM_A.name],
    [otherId, AM_B.name],
  ]) {
    await run(
      "INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, `KH ${id}`, "Dịch vụ test", `CODE-${id}`, "2026-01-01", "2026-12-31", staff]
    );
    createdServiceIds.push(id);
  }

  const forged = await call(AM_A, "GET", `/services?staff=${encodeURIComponent(AM_B.name)}`);
  assert.equal(forged.status, 200);
  assert.ok(forged.body.data.every((s: any) => s.staffName === AM_A.name));
  const ids = forged.body.data.map((s: any) => s.id);
  assert.ok(ids.includes(mineId));
  assert.ok(!ids.includes(otherId));

  const admin = await call(ADMIN, "GET", "/services");
  const adminIds = admin.body.data.map((s: any) => s.id);
  assert.ok(adminIds.includes(mineId) && adminIds.includes(otherId));
});

test("Dịch vụ: AM chỉ tạo/sửa dịch vụ cho khách và dịch vụ do mình phụ trách", async () => {
  const tag = `${Date.now()}`;
  const custMine = `CUS-ACL-A-${tag}`;
  const custOther = `CUS-ACL-B-${tag}`;
  for (const [id, am] of [
    [custMine, AM_A.name],
    [custOther, AM_B.name],
  ]) {
    await run(
      "INSERT INTO customers (id, name, type, customer_group, am_staff) VALUES (?, ?, ?, ?, ?)",
      [id, `KH ${id}`, "Doanh nghiệp", "Tự phát triển", am]
    );
  }

  const payload = (customerId: string, extra: Record<string, unknown> = {}) => ({
    customerId,
    serviceGroup: "CNTT",
    serviceName: "Dịch vụ phân quyền",
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
    ...extra,
  });

  try {
    const own = await call(AM_A, "POST", "/services", payload(custMine));
    assert.equal(own.status, 201);
    createdServiceIds.push(own.body.data.id);
    assert.equal(own.body.data.staffName, AM_A.name);

    assert.equal((await call(AM_A, "POST", "/services", payload(custOther))).status, 403);
    assert.equal((await call(AM_A, "POST", "/services", payload(custMine, { staffName: AM_B.name }))).status, 403);

    const adminSvc = await call(ADMIN, "POST", "/services", payload(custOther));
    assert.equal(adminSvc.status, 201);
    createdServiceIds.push(adminSvc.body.data.id);

    assert.equal((await call(AM_A, "PATCH", `/services/${own.body.data.id}`, { serviceName: "Đổi tên" })).status, 200);
    assert.equal((await call(AM_A, "PATCH", `/services/${own.body.data.id}`, { staffName: AM_B.name })).status, 403);
    assert.equal((await call(AM_A, "PATCH", `/services/${own.body.data.id}`, { customerId: custOther })).status, 403);
    assert.equal((await call(AM_A, "PATCH", `/services/${adminSvc.body.data.id}`, { serviceName: "Hack" })).status, 403);
    assert.equal((await call(ADMIN, "PATCH", `/services/${own.body.data.id}`, { staffName: AM_B.name })).status, 200);
  } finally {
    await run("DELETE FROM customers WHERE id IN (?, ?)", [custMine, custOther]);
  }
});

test("Đơn hàng: AM chỉ thấy và thao tác đơn do mình phụ trách", async () => {
  const tag = `${Date.now()}`;
  const mineId = `CTR-ACL-A-${tag}`;
  const otherId = `CTR-ACL-B-${tag}`;
  for (const [id, am] of [
    [mineId, AM_A.name],
    [otherId, AM_B.name],
  ]) {
    await run(
      "INSERT INTO contracts (id, transaction_code, customer_name, subscriber_codes, total_value, channel, am_staff) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, `GD-${id}`, `KH ${id}`, "[]", 1000, "Trực tiếp", am]
    );
    createdContractIds.push(id);
  }
  await run(
    "INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by) VALUES (?, ?, ?, ?)",
    [`PRE-A-${tag}`, mineId, "1", "x"]
  );
  await run(
    "INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by) VALUES (?, ?, ?, ?)",
    [`PRE-B-${tag}`, otherId, "2", "x"]
  );

  const list = await call(AM_A, "GET", "/contracts");
  assert.equal(list.status, 200);
  const ids = list.body.data.map((c: any) => c.id);
  assert.ok(ids.includes(mineId) && !ids.includes(otherId));
  const adminIds = (await call(ADMIN, "GET", "/contracts")).body.data.map((c: any) => c.id);
  assert.ok(adminIds.includes(mineId) && adminIds.includes(otherId));

  const exportsAm = await call(AM_A, "GET", "/contracts/payment-requests");
  assert.equal(exportsAm.status, 200);
  const exportContracts = exportsAm.body.data.map((e: any) => e.contractId);
  assert.ok(exportContracts.includes(mineId) && !exportContracts.includes(otherId));

  assert.equal((await call(AM_A, "GET", `/contracts/${mineId}/payments`)).status, 200);
  assert.equal((await call(AM_A, "GET", `/contracts/${otherId}/payments`)).status, 403);
  assert.equal(
    (await call(AM_A, "POST", `/contracts/${otherId}/payments`, { amount: 100, paidDate: "2026-11-01" })).status,
    403
  );
  assert.equal(
    (await call(AM_A, "PATCH", `/contracts/${otherId}/status`, { deploymentStatus: "Đang triển khai" })).status,
    403
  );
  assert.equal(
    (await call(AM_A, "PATCH", `/contracts/${mineId}/status`, { deploymentStatus: "Đang triển khai" })).status,
    200
  );
  assert.equal((await call(AM_A, "GET", `/contracts/${otherId}/payment-request/preview`)).status, 403);
  assert.equal((await call(AM_A, "GET", `/contracts/${otherId}/payment-request?docNumber=1`)).status, 403);
  assert.equal((await call(AM_A, "GET", `/contracts/nope-${tag}/payments`)).status, 404);

  assert.equal(
    (await call(ADMIN, "PATCH", `/contracts/${otherId}/status`, { deploymentStatus: "Đang triển khai" })).status,
    200
  );
  assert.equal((await call(null, "GET", "/contracts")).status, 401);
});

test("Đơn hàng: AM không tạo đơn cho AM khác, không đổi AM phụ trách", async () => {
  const tag = `${Date.now()}`;
  const custId = `CUS-ACL-C-${tag}`;
  await run("INSERT INTO customers (id, name, type, customer_group, am_staff) VALUES (?, ?, ?, ?, ?)", [
    custId,
    `KH ${custId}`,
    "Doanh nghiệp",
    "Tự phát triển",
    AM_A.name,
  ]);
  try {
    const payload = (extra: Record<string, unknown> = {}) => ({
      transactionCode: `GD-ACL-${tag}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: custId,
      subscriberCodes: ["TB1"],
      totalValue: 1000,
      channel: "Trực tiếp",
      contractTemplate: "hoa_don_dien_tu",
      ...extra,
    });

    assert.equal((await call(AM_A, "POST", "/contracts", payload({ amStaff: AM_B.name }))).status, 403);

    const own = await call(AM_A, "POST", "/contracts", payload());
    assert.equal(own.status, 201);
    createdContractIds.push(own.body.data.id);
    assert.equal(own.body.data.amStaff, AM_A.name);

    assert.equal(
      (await call(AM_A, "PATCH", `/contracts/${own.body.data.id}`, { amStaff: AM_B.name })).status,
      403
    );
    assert.equal(
      (await call(ADMIN, "PATCH", `/contracts/${own.body.data.id}`, { amStaff: AM_B.name })).status,
      200
    );
  } finally {
    await run("DELETE FROM customers WHERE id = ?", [custId]);
  }
});

test("Địa bàn: AM không ghi được số hộ, thống kê, đầu mối (403) nhưng vẫn xem được", async () => {
  const rows = await query<{ id: string }>("SELECT id FROM territories LIMIT 1");
  const id = rows[0].id;

  assert.equal((await call(AM_A, "GET", `/territories/${id}/contacts`)).status, 200);
  assert.equal((await call(AM_A, "PATCH", `/territories/${id}/households`, { householdCount: 1 })).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/territories/${id}/stats`, { revenue: 1 })).status, 403);
  assert.equal((await call(AM_A, "POST", `/territories/${id}/contacts`, { unit: "UBND", fullName: "X" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/territories/contacts/x`, { fullName: "X" })).status, 403);
  assert.equal((await call(AM_A, "DELETE", `/territories/contacts/x`)).status, 403);
});

test("Địa bàn: xóa phường chỉ Admin, 404 khi không có, 409 khi còn Lead", async () => {
  const tag = `${Date.now()}`;
  const created = await call(ADMIN, "POST", "/territories", { wardName: `Phường Test Xóa ${tag}` });
  assert.equal(created.status, 201);
  const territoryId = created.body.data.id;

  assert.equal((await call(null, "DELETE", `/territories/${territoryId}`)).status, 401);
  assert.equal((await call(AM_A, "DELETE", `/territories/${territoryId}`)).status, 403);
  assert.equal((await call(ADMIN, "DELETE", "/territories/TB-KHONG-TON-TAI")).status, 404);

  const leadRes = await call(ADMIN, "POST", "/leads", {
    ...leadPayload(AM_A.name, `territory-del-${tag}`),
    territoryId,
  });
  assert.equal(leadRes.status, 201);
  createdLeadIds.push(leadRes.body.data.id);

  const blocked = await call(ADMIN, "DELETE", `/territories/${territoryId}`);
  assert.equal(blocked.status, 409);

  await run("DELETE FROM leads WHERE id = ?", [leadRes.body.data.id]);
  createdLeadIds.splice(createdLeadIds.indexOf(leadRes.body.data.id), 1);

  const ok = await call(ADMIN, "DELETE", `/territories/${territoryId}`);
  assert.equal(ok.status, 200);
});

test("server.ts: các module chỉ Admin được mount sau requireAdmin", () => {
  const source = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  for (const prefix of ["commissions", "reports", "settings", "reminders", "ctv-accounts"]) {
    const line = source.split(/\r?\n/).find((l) => l.includes(`app.use("/api/${prefix}"`));
    assert.ok(line, `thiếu mount /api/${prefix}`);
    assert.ok(line!.includes("requireAdmin"), `/api/${prefix} phải đi qua requireAdmin`);
  }
});
