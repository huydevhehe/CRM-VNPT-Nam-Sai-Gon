import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

const { initDatabase, query, run } = await import("../../database/db.js");
const { applySchemaExtensions } = await import("../../database/schema-extensions.js");
const { config } = await import("../../config/index.js");
const { requireAuth } = await import("../../middleware/require-auth.js");
const { requireStaff } = await import("../../middleware/require-role.js");
const { staffRouter } = await import("./staff.controller.js");
const { StaffService } = await import("./staff.service.js");

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
const staffIds: string[] = [];
const userIds: string[] = [];
const wardIds: string[] = [];
const service = new StaffService();

after(async () => {
  for (const id of wardIds) await run("DELETE FROM territories WHERE id = ?", [id]);
  for (const id of staffIds) await run("DELETE FROM staff WHERE id = ?", [id]);
  for (const id of userIds) await run("DELETE FROM users WHERE id = ?", [id]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function tokenOf(u: { id: string; role: string; name: string }): string {
  return jwt.sign({ sub: u.id, role: u.role, name: u.name }, config.jwtSecret, { expiresIn: "1h" });
}

async function call(
  actor: { id: string; role: string; name: string } | null,
  method: string,
  path: string,
  body?: unknown
) {
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

async function makeWard(tag: string, staffName: string | null = null, households = 0) {
  const id = `TB-T3-${tag}-${suffix}`;
  await run("INSERT INTO territories (id, ward_name, household_count, staff_name) VALUES (?, ?, ?, ?)", [
    id,
    `Phường T3 ${tag} ${suffix}`,
    households,
    staffName,
  ]);
  wardIds.push(id);
  return { id, name: `Phường T3 ${tag} ${suffix}` };
}

async function makeStaff(tag: string, extra: Record<string, unknown> = {}) {
  const code = `NV-T3-${tag}-${suffix}`;
  const created = await service.create({
    code,
    name: `Nhân viên T3 ${tag} ${suffix}`,
    role: "AM",
    password: "Password@12345",
    ...extra,
  } as any);
  staffIds.push(created.id);
  userIds.push(`USR-${code}`);
  return created;
}

async function wardOwner(id: string): Promise<string | null> {
  const rows = await query<{ staff_name: string | null }>("SELECT staff_name FROM territories WHERE id = ?", [id]);
  return rows[0]?.staff_name ?? null;
}

test("overview trả đủ nhiều phường của một nhân viên, kèm số hộ và khu phố", async () => {
  const staff = await makeStaff("multi");
  const w1 = await makeWard("A", staff.name, 120);
  const w2 = await makeWard("B", staff.name, 340);
  await makeWard("C", "Người khác");

  const res = await call(ADMIN, "GET", `/staff/${staff.id}/overview`);
  assert.equal(res.status, 200);
  const territories = res.body.data.territories as any[];
  assert.equal(territories.length, 2);
  assert.deepEqual(territories.map((t) => t.id).sort(), [w1.id, w2.id].sort());
  const byId = new Map(territories.map((t) => [t.id, t]));
  assert.equal(byId.get(w1.id).wardName, w1.name);
  assert.equal(byId.get(w1.id).householdCount, 120);
  assert.equal(byId.get(w2.id).householdCount, 340);
  assert.ok(territories.every((t) => t.source === "assigned"));
});

test("overview: nhân viên chưa có phường → danh sách rỗng", async () => {
  const staff = await makeStaff("none");
  const res = await call(ADMIN, "GET", `/staff/${staff.id}/overview`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.territories, []);
});

test("overview: phường chỉ ghi trong hồ sơ cũ và chưa ai phụ trách hiện với source=profile", async () => {
  const ward = await makeWard("PRF");
  const staff = await makeStaff("profile", { territory: ward.name });
  const res = await call(ADMIN, "GET", `/staff/${staff.id}/overview`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.territories.length, 1);
  assert.equal(res.body.data.territories[0].id, ward.id);
  assert.equal(res.body.data.territories[0].source, "profile");
});

test("overview: phường ghi trong hồ sơ nhưng đã giao cho người khác thì không tính", async () => {
  const ward = await makeWard("TAKEN", "Nhân viên Khác");
  const staff = await makeStaff("profile2", { territory: ward.name });
  const res = await call(ADMIN, "GET", `/staff/${staff.id}/overview`);
  assert.deepEqual(res.body.data.territories, []);
});

test("overview vẫn Admin-only: 401 và 403", async () => {
  const staff = await makeStaff("auth");
  assert.equal((await call(null, "GET", `/staff/${staff.id}/overview`)).status, 401);
  assert.equal((await call(AM, "GET", `/staff/${staff.id}/overview`)).status, 403);
});

test("tạo nhân viên với territoryIds: gán nhiều phường và lưu tóm tắt vào staff.territory", async () => {
  const w1 = await makeWard("C1");
  const w2 = await makeWard("C2");
  const res = await call(ADMIN, "POST", "/staff", {
    code: `NV-T3-CR-${suffix}`,
    name: `Nhân viên T3 CR ${suffix}`,
    role: "AM",
    password: "Password@12345",
    territoryIds: [w1.id, w2.id, w1.id],
  });
  assert.equal(res.status, 201);
  staffIds.push(res.body.data.id);
  userIds.push(`USR-NV-T3-CR-${suffix}`);
  const name = res.body.data.name;
  assert.equal(await wardOwner(w1.id), name);
  assert.equal(await wardOwner(w2.id), name);
  assert.equal(res.body.data.territory, [w1.name, w2.name].sort((a, b) => a.localeCompare(b, "vi")).join(", "));
});

test("PATCH territoryIds: thay thế danh sách, phường bỏ ra thì hết phụ trách", async () => {
  const staff = await makeStaff("patch");
  const w1 = await makeWard("P1");
  const w2 = await makeWard("P2");
  const w3 = await makeWard("P3");

  let res = await call(ADMIN, "PATCH", `/staff/${staff.id}`, { territoryIds: [w1.id, w2.id] });
  assert.equal(res.status, 200);
  assert.equal(await wardOwner(w1.id), staff.name);
  assert.equal(await wardOwner(w2.id), staff.name);

  res = await call(ADMIN, "PATCH", `/staff/${staff.id}`, { territoryIds: [w2.id, w3.id] });
  assert.equal(res.status, 200);
  assert.equal(await wardOwner(w1.id), null);
  assert.equal(await wardOwner(w2.id), staff.name);
  assert.equal(await wardOwner(w3.id), staff.name);
  assert.equal(res.body.data.territory, [w2.name, w3.name].sort((a, b) => a.localeCompare(b, "vi")).join(", "));

  res = await call(ADMIN, "PATCH", `/staff/${staff.id}`, { territoryIds: [] });
  assert.equal(res.status, 200);
  assert.equal(await wardOwner(w2.id), null);
  assert.equal(await wardOwner(w3.id), null);
  assert.equal(res.body.data.territory, "");

  const logs = await query<{ id: string }>(
    "SELECT id FROM audit_logs WHERE action = 'Cập nhật phường phụ trách' AND details LIKE ?",
    [`%${staff.name}%`]
  );
  assert.ok(logs.length >= 3, "Mỗi lần đổi danh sách phường phải có audit log");
});

test("PATCH territoryIds: chọn phường đang của người khác thì chuyển sang và dọn tóm tắt của người cũ", async () => {
  const w1 = await makeWard("S1");
  const w2 = await makeWard("S2");
  const owner = await makeStaff("owner", { territoryIds: [w1.id, w2.id] });
  const thief = await makeStaff("thief");

  const res = await call(ADMIN, "PATCH", `/staff/${thief.id}`, { territoryIds: [w1.id] });
  assert.equal(res.status, 200);
  assert.equal(await wardOwner(w1.id), thief.name);
  assert.equal(await wardOwner(w2.id), owner.name);

  const ownerRow = await service.getById(owner.id);
  assert.equal(ownerRow?.territory, w2.name);
});

test("PATCH territoryIds sai: không phải mảng, phần tử rỗng, phường không tồn tại → 400 và không đổi gì", async () => {
  const w1 = await makeWard("E1");
  const staff = await makeStaff("bad", { territoryIds: [w1.id] });
  for (const bad of ["abc", [""], [123], ["TB-KHONG-TON-TAI"], [w1.id, "TB-KHONG-TON-TAI"]]) {
    const res = await call(ADMIN, "PATCH", `/staff/${staff.id}`, { territoryIds: bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.equal(await wardOwner(w1.id), staff.name);
});

test("PATCH territoryIds: AM bị 403, chưa đăng nhập 401", async () => {
  const staff = await makeStaff("perm");
  const w1 = await makeWard("PM");
  assert.equal((await call(null, "PATCH", `/staff/${staff.id}`, { territoryIds: [w1.id] })).status, 401);
  assert.equal((await call(AM, "PATCH", `/staff/${staff.id}`, { territoryIds: [w1.id] })).status, 403);
  assert.equal(await wardOwner(w1.id), null);
});

test("đổi tên nhân viên vẫn giữ các phường đã gán (cascade territories.staff_name)", async () => {
  const w1 = await makeWard("R1");
  const w2 = await makeWard("R2");
  const staff = await makeStaff("rename", { territoryIds: [w1.id, w2.id] });
  const newName = `Nhân viên T3 Đổi Tên ${suffix}`;
  const res = await call(ADMIN, "PATCH", `/staff/${staff.id}`, { name: newName, territoryIds: [w1.id, w2.id] });
  assert.equal(res.status, 200);
  assert.equal(await wardOwner(w1.id), newName);
  assert.equal(await wardOwner(w2.id), newName);
});

test("GET /staff (Admin) có mảng territories theo danh mục địa bàn; AM chỉ nhận danh bạ rút gọn", async () => {
  const w1 = await makeWard("L1");
  const w2 = await makeWard("L2");
  const staff = await makeStaff("list", { territoryIds: [w1.id, w2.id] });
  const res = await call(ADMIN, "GET", "/staff");
  assert.equal(res.status, 200);
  const found = (res.body.data as any[]).find((s) => s.id === staff.id);
  assert.deepEqual([...found.territories].sort(), [w1.name, w2.name].sort());

  const brief = await call(AM, "GET", "/staff");
  assert.equal(brief.status, 200);
  const briefFound = (brief.body.data as any[]).find((s) => s.id === staff.id);
  assert.equal(briefFound.territories, undefined);
});

test("GET /staff?status=active chỉ trả nhân viên đang hoạt động; mặc định trả tất cả", async () => {
  const active = await makeStaff("st-act");
  const suspended = await makeStaff("st-sus");
  const stopped = await makeStaff("st-stop");
  assert.equal(
    (await call(ADMIN, "PATCH", `/staff/${suspended.id}/status`, { status: "Đình chỉ", reason: "Thử" })).status,
    200
  );
  assert.equal(
    (await call(ADMIN, "PATCH", `/staff/${stopped.id}/status`, { status: "Ngừng hoạt động", reason: "Thử" })).status,
    200
  );

  const onlyActive = (await call(ADMIN, "GET", "/staff?status=active")).body.data as any[];
  const activeIds = new Set(onlyActive.map((s) => s.id));
  assert.ok(activeIds.has(active.id));
  assert.ok(!activeIds.has(suspended.id));
  assert.ok(!activeIds.has(stopped.id));
  assert.ok(onlyActive.every((s) => s.status === "Đang hoạt động"));

  const all = new Set(((await call(ADMIN, "GET", "/staff")).body.data as any[]).map((s) => s.id));
  assert.ok(all.has(active.id) && all.has(suspended.id) && all.has(stopped.id));
});
