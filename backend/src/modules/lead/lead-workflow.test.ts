import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

const { initDatabase, query, run } = await import("../../database/db.js");
const { config } = await import("../../config/index.js");
const { requireAuth } = await import("../../middleware/require-auth.js");
const { requireStaff } = await import("../../middleware/require-role.js");
const { leadRouter } = await import("./lead.controller.js");
const { channelSourceRouter } = await import("../channel-source/channel-source.controller.js");

await initDatabase();

const AM_A = { id: "USR-VNPT-AM-01", role: "AM Bán chăm", name: "Nguyễn Thị Tình" };
const AM_B = { id: "USR-VNPT-AM-02", role: "AM", name: "Nguyễn Thị Huyền Trang" };
const ADMIN = { id: "USR-ADMIN", role: "Admin", name: "Quản trị viên" };
type Actor = { id: string; role: string; name: string };

function tokenOf(u: Actor): string {
  return jwt.sign({ sub: u.id, role: u.role, name: u.name }, config.jwtSecret, { expiresIn: "1h" });
}

const app = express();
app.use(express.json());
app.use("/api/leads", requireAuth, requireStaff, leadRouter);
app.use("/api/channel-sources", requireAuth, requireStaff, channelSourceRouter);

const server: Server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

const tag = `${Date.now()}`;
const createdLeadIds: string[] = [];
const createdSourceIds: string[] = [];
const CTV_ID = `USR-CTV-T1-${tag}`;

await run(
  "INSERT INTO users (id, username, name, role, status, referral_code) VALUES (?, ?, ?, ?, ?, ?)",
  [CTV_ID, `ctv-t1-${tag}`, `CTV Thử Nghiệm ${tag}`, "CTV", "Đang hoạt động", `T1${tag}`]
);

after(async () => {
  for (const id of createdLeadIds) await run("DELETE FROM leads WHERE id = ?", [id]);
  for (const id of createdSourceIds) await run("DELETE FROM channel_sources WHERE id = ?", [id]);
  await run("DELETE FROM users WHERE id = ?", [CTV_ID]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(
  actor: Actor | null,
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

async function makeSource(kind: "online" | "partner", name: string): Promise<string> {
  const res = await call(ADMIN, "POST", "/channel-sources", { kind, name: `${name} ${tag}` });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  createdSourceIds.push(res.body.data.id);
  return res.body.data.id;
}

function payload(staffName: string, label: string, extra: Record<string, unknown> = {}) {
  return {
    customerName: `KH Quy trình ${label} ${tag}`,
    phone: "0901234567",
    group: "Lead KH mới",
    channel: "Chiến dịch",
    staffName,
    ...extra,
  };
}

async function newLead(staffName: string, label: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await call(ADMIN, "POST", "/leads", payload(staffName, label, extra));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  createdLeadIds.push(res.body.data.id);
  return res.body.data.id;
}

async function statusOf(id: string): Promise<string> {
  const rows = await query<{ status: string }>("SELECT status FROM leads WHERE id = ?", [id]);
  return rows[0].status;
}

const BLOCK_MESSAGE = "Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt.";

// ---------------------------------------------------------------------------
// STT 3: chặn lùi bước
// ---------------------------------------------------------------------------

test("Chưa đăng nhập: các endpoint Lead mới trả 401", async () => {
  assert.equal((await call(null, "PATCH", "/leads/LEAD-X", { customerName: "a" })).status, 401);
  assert.equal((await call(null, "POST", "/leads/LEAD-X/stage-requests", {})).status, 401);
  assert.equal((await call(null, "GET", "/leads/stage-requests")).status, 401);
  assert.equal((await call(null, "PATCH", "/leads/stage-requests/X", { action: "approve" })).status, 401);
  assert.equal((await call(null, "GET", "/channel-sources")).status, 401);
});

test("Nhân viên: đi tiến (kể cả nhảy cách bước) và sang Thất bại được; lùi bước bị 409 và không đổi trạng thái", async () => {
  const id = await newLead(AM_A.name, "tien-lui");

  assert.equal((await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Đang tư vấn" })).status, 200); // nhảy cách bước
  assert.equal(await statusOf(id), "Đang tư vấn");

  for (const back of ["Mới tiếp nhận", "Đã liên hệ"]) {
    const res = await call(AM_A, "PATCH", `/leads/${id}/status`, { status: back });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, BLOCK_MESSAGE);
    assert.equal(await statusOf(id), "Đang tư vấn");
  }

  // Cùng trạng thái: không phải lùi bước, không lỗi
  assert.equal((await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Đang tư vấn" })).status, 200);

  assert.equal((await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Chốt thành công" })).status, 200);
  // Từ trạng thái cuối: về bước nào cũng bị chặn, kể cả đổi qua lại hai trạng thái cuối
  for (const target of ["Mới tiếp nhận", "Đã liên hệ", "Đang tư vấn", "Thất bại"]) {
    const res = await call(AM_A, "PATCH", `/leads/${id}/status`, { status: target });
    assert.equal(res.status, 409, target);
    assert.equal(await statusOf(id), "Chốt thành công");
  }

  const fail = await newLead(AM_A.name, "that-bai");
  assert.equal((await call(AM_A, "PATCH", `/leads/${fail}/status`, { status: "Thất bại" })).status, 200);
  assert.equal((await call(AM_A, "PATCH", `/leads/${fail}/status`, { status: "Chốt thành công" })).status, 409);
  assert.equal((await call(AM_A, "PATCH", `/leads/${fail}/status`, { status: "Mới tiếp nhận" })).status, 409);
  assert.equal(await statusOf(fail), "Thất bại");

  assert.equal((await call(AM_A, "PATCH", `/leads/${fail}/status`, { status: "Không hợp lệ" })).status, 400);
});

test("Admin đổi sang bất kỳ trạng thái nào, kể cả lùi bước, và có ghi nhật ký", async () => {
  const id = await newLead(AM_A.name, "admin-tu-do");
  await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Chốt thành công" });

  for (const target of ["Mới tiếp nhận", "Thất bại", "Chốt thành công", "Đã liên hệ", "Đang tư vấn"]) {
    const res = await call(ADMIN, "PATCH", `/leads/${id}/status`, { status: target });
    assert.equal(res.status, 200, target);
    assert.equal(await statusOf(id), target);
  }
  const logs = await query<{ details: string }>(
    "SELECT details FROM audit_logs WHERE action = 'Admin đổi Lead lùi bước' AND details LIKE ?",
    [`%${id}%`]
  );
  assert.ok(logs.length >= 1);
});

test("Yêu cầu quay lại bước: tạo, chặn trùng, kiểm tra điều kiện, phạm vi AM", async () => {
  const id = await newLead(AM_A.name, "yeu-cau");
  const other = await newLead(AM_B.name, "yeu-cau-khac");
  await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Đang tư vấn" });

  // Thiếu lý do / trạng thái sai / không phải lùi bước / admin tự đổi
  assert.equal((await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Đã liên hệ", reason: "  " })).status, 400);
  assert.equal((await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Sai", reason: "x" })).status, 400);
  assert.equal((await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Chốt thành công", reason: "x" })).status, 400);
  assert.equal((await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Đang tư vấn", reason: "x" })).status, 400);
  assert.equal((await call(ADMIN, "POST", `/leads/${id}/stage-requests`, { toStatus: "Đã liên hệ", reason: "x" })).status, 400);
  assert.equal(
    (await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Đã liên hệ", reason: "x".repeat(501) })).status,
    400
  );

  // Lead của người khác 403, không tồn tại 404
  assert.equal((await call(AM_A, "POST", `/leads/${other}/stage-requests`, { toStatus: "Mới tiếp nhận", reason: "x" })).status, 403);
  assert.equal((await call(AM_A, "POST", `/leads/LEAD-KHONG-CO/stage-requests`, { toStatus: "Mới tiếp nhận", reason: "x" })).status, 404);

  const created = await call(AM_A, "POST", `/leads/${id}/stage-requests`, {
    toStatus: "Đã liên hệ",
    reason: "Nhập nhầm, khách chưa tư vấn",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.status, "Chờ duyệt");
  assert.equal(created.body.data.fromStatus, "Đang tư vấn");
  assert.equal(created.body.data.toStatus, "Đã liên hệ");
  assert.equal(created.body.data.requestedBy, AM_A.name);

  // Không tạo trùng khi đã có yêu cầu chờ duyệt
  const dup = await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Mới tiếp nhận", reason: "lại" });
  assert.equal(dup.status, 409);

  // Lead hiển thị yêu cầu đang chờ cho nhân viên
  const mine = (await call(AM_A, "GET", "/leads")).body.data.find((l: any) => l.id === id);
  assert.equal(mine.pendingStageRequest.toStatus, "Đã liên hệ");
  assert.equal(mine.pendingStageRequest.reason, "Nhập nhầm, khách chưa tư vấn");
});

test("Duyệt / từ chối yêu cầu: chỉ Admin; duyệt áp dụng trạng thái; không xử lý hai lần", async () => {
  const id = await newLead(AM_A.name, "duyet");
  await call(AM_A, "PATCH", `/leads/${id}/status`, { status: "Chốt thành công" });
  const req1 = await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Đang tư vấn", reason: "Khách đổi ý" });
  assert.equal(req1.status, 201);
  const reqId = req1.body.data.id;

  // Nhân viên không xem / duyệt được
  assert.equal((await call(AM_A, "GET", "/leads/stage-requests")).status, 403);
  assert.equal((await call(AM_A, "PATCH", `/leads/stage-requests/${reqId}`, { action: "approve" })).status, 403);
  assert.equal(await statusOf(id), "Chốt thành công");

  // Admin xem danh sách theo trạng thái
  const pending = await call(ADMIN, "GET", "/leads/stage-requests?status=Chờ duyệt");
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.some((r: any) => r.id === reqId));
  assert.equal((await call(ADMIN, "GET", "/leads/stage-requests?status=Sai")).status, 400);

  // Sai hành động / không tồn tại
  assert.equal((await call(ADMIN, "PATCH", `/leads/stage-requests/${reqId}`, { action: "xoa" })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/stage-requests/LSR-KHONG-CO`, { action: "approve" })).status, 404);

  // Duyệt: áp dụng trạng thái, ghi người duyệt
  const approved = await call(ADMIN, "PATCH", `/leads/stage-requests/${reqId}`, { action: "approve", note: "Đồng ý" });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.status, "Đã duyệt");
  assert.equal(approved.body.data.decidedBy, ADMIN.name);
  assert.equal(approved.body.data.decisionNote, "Đồng ý");
  assert.equal(await statusOf(id), "Đang tư vấn");

  // Không xử lý lại
  assert.equal((await call(ADMIN, "PATCH", `/leads/stage-requests/${reqId}`, { action: "reject" })).status, 409);

  // Không còn yêu cầu chờ trên Lead
  const lead = (await call(ADMIN, "GET", "/leads")).body.data.find((l: any) => l.id === id);
  assert.equal(lead.pendingStageRequest, null);

  // Từ chối: giữ nguyên trạng thái, sau đó nhân viên gửi lại được
  const req2 = await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Mới tiếp nhận", reason: "Làm lại" });
  assert.equal(req2.status, 201);
  const rejected = await call(ADMIN, "PATCH", `/leads/stage-requests/${req2.body.data.id}`, { action: "reject", note: "Không hợp lý" });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.status, "Từ chối");
  assert.equal(await statusOf(id), "Đang tư vấn");
  const req3 = await call(AM_A, "POST", `/leads/${id}/stage-requests`, { toStatus: "Mới tiếp nhận", reason: "Gửi lại" });
  assert.equal(req3.status, 201);

  const logs = await query<{ action: string }>(
    "SELECT action FROM audit_logs WHERE details LIKE ? AND action LIKE '%lùi bước%'",
    [`%${id}%`]
  );
  assert.ok(logs.length >= 3);
});

// ---------------------------------------------------------------------------
// STT 2: Admin sửa thông tin Lead
// ---------------------------------------------------------------------------

test("Admin PATCH thông tin Lead; AM bị 403; kiểm tra dữ liệu", async () => {
  const id = await newLead(AM_A.name, "sua");

  const body = {
    customerName: "  KH Đã Sửa  ",
    phone: "0988777666",
    group: "Lead gia hạn",
    expectedValue: 5000000,
    demandDescription: "Nhu cầu mới",
    note: "Ghi chú mới",
  };
  const ok = await call(ADMIN, "PATCH", `/leads/${id}`, body);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.customerName, "KH Đã Sửa");
  assert.equal(ok.body.data.phone, "0988777666");
  assert.equal(ok.body.data.group, "Lead gia hạn");
  assert.equal(ok.body.data.expectedValue, 5000000);
  assert.equal(ok.body.data.demandDescription, "Nhu cầu mới");
  assert.equal(ok.body.data.note, "Ghi chú mới");
  assert.equal(ok.body.data.staffName, AM_A.name); // không đổi người phụ trách
  assert.equal(ok.body.data.status, "Mới tiếp nhận"); // không đổi trạng thái

  const logs = await query<{ details: string }>("SELECT details FROM audit_logs WHERE action = 'Sửa Lead' AND details LIKE ?", [`%${id}%`]);
  assert.equal(logs.length, 1);

  // Chỉ Admin: AM kể cả Lead của mình đều 403; không lộ thay đổi
  assert.equal((await call(AM_A, "PATCH", `/leads/${id}`, { customerName: "Xâm nhập" })).status, 403);
  assert.equal((await call(AM_B, "PATCH", `/leads/${id}`, { customerName: "Xâm nhập" })).status, 403);
  const after1 = (await call(ADMIN, "GET", "/leads")).body.data.find((l: any) => l.id === id);
  assert.equal(after1.customerName, "KH Đã Sửa");

  assert.equal((await call(ADMIN, "PATCH", `/leads/LEAD-KHONG-CO`, { customerName: "a" })).status, 404);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { customerName: "   " })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { phone: "" })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { group: "Nhóm lạ" })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { expectedValue: -5 })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { expectedValue: "abc" })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, { note: "n".repeat(1001) })).status, 400);

  // Không gửi gì để đổi: trả nguyên Lead
  assert.equal((await call(ADMIN, "PATCH", `/leads/${id}`, {})).status, 200);
});

// ---------------------------------------------------------------------------
// STT 5: Chi tiết kênh
// ---------------------------------------------------------------------------

test("Chi tiết kênh khi tạo Lead: ràng buộc theo từng kênh", async () => {
  const onlineId = await makeSource("online", "Zalo OA");
  const partnerId = await makeSource("partner", "Đối tác ABC");

  const create = (extra: Record<string, unknown>) => call(ADMIN, "POST", "/leads", payload(AM_A.name, "kenh", extra));

  // Online
  assert.equal((await create({ channel: "Online" })).status, 400);
  assert.equal((await create({ channel: "Online", channelSourceId: partnerId })).status, 400); // sai loại
  assert.equal((await create({ channel: "Online", channelSourceId: "CHS-KHONG-CO" })).status, 400);
  assert.equal((await create({ channel: "Online", channelSourceId: onlineId, referredByCtvId: CTV_ID })).status, 400);
  const online = await create({ channel: "Online", channelSourceId: onlineId });
  assert.equal(online.status, 201, JSON.stringify(online.body));
  createdLeadIds.push(online.body.data.id);
  assert.equal(online.body.data.channelSourceId, onlineId);
  assert.equal(online.body.data.channelSourceName, `Zalo OA ${tag}`);
  assert.equal(online.body.data.channelSourceKind, "online");

  // Đối tác
  assert.equal((await create({ channel: "Đối tác" })).status, 400);
  assert.equal((await create({ channel: "Đối tác", channelSourceId: onlineId })).status, 400);
  const partner = await create({ channel: "Đối tác", channelSourceId: partnerId });
  assert.equal(partner.status, 201, JSON.stringify(partner.body));
  createdLeadIds.push(partner.body.data.id);
  assert.equal(partner.body.data.channelSourceName, `Đối tác ABC ${tag}`);

  // CTV giới thiệu
  assert.equal((await create({ channel: "CTV giới thiệu" })).status, 400);
  assert.equal((await create({ channel: "CTV giới thiệu", referredByCtvId: "USR-KHONG-CO" })).status, 400);
  assert.equal((await create({ channel: "CTV giới thiệu", referredByCtvId: AM_B.id })).status, 400); // không phải CTV
  assert.equal((await create({ channel: "CTV giới thiệu", referredByCtvId: CTV_ID, channelSourceId: onlineId })).status, 400);
  const ctv = await create({ channel: "CTV giới thiệu", referredByCtvId: CTV_ID });
  assert.equal(ctv.status, 201, JSON.stringify(ctv.body));
  createdLeadIds.push(ctv.body.data.id);
  assert.equal(ctv.body.data.referredByCtvName, `CTV Thử Nghiệm ${tag}`);
  assert.equal(ctv.body.data.channelSourceId, null);

  // Kênh khác: không có chi tiết
  assert.equal((await create({ channel: "Khách hàng hiện hữu", channelSourceId: onlineId })).status, 400);
  assert.equal((await create({ channel: "Chiến dịch", referredByCtvId: CTV_ID })).status, 400);
  const other = await create({ channel: "Khách hàng hiện hữu" });
  assert.equal(other.status, 201);
  createdLeadIds.push(other.body.data.id);
  assert.equal((await create({ channel: "Kênh lạ" })).status, 400);

  // Nguồn đã ẩn không chọn mới được
  await call(ADMIN, "PATCH", `/channel-sources/${onlineId}`, { active: false });
  assert.equal((await create({ channel: "Online", channelSourceId: onlineId })).status, 400);
  await call(ADMIN, "PATCH", `/channel-sources/${onlineId}`, { active: true });
});

test("Sửa chi tiết kênh của Lead; Lead cũ chưa có chi tiết vẫn sửa/ghi chú được", async () => {
  const onlineId = await makeSource("online", "Facebook Ads");
  const online2 = await makeSource("online", "Website B");
  const partnerId = await makeSource("partner", "Đối tác XYZ");

  // Lead cũ: kênh Online nhưng chưa có chi tiết (chèn thẳng như dữ liệu trước đây)
  const legacyId = `LEAD-T1-LEGACY-${tag}`;
  await run(
    `INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name, status, expected_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [legacyId, `KH Cũ ${tag}`, "0911000111", "Lead KH mới", "Online", AM_A.name, "Mới tiếp nhận", 0]
  );
  createdLeadIds.push(legacyId);

  const listed = (await call(AM_A, "GET", "/leads")).body.data.find((l: any) => l.id === legacyId);
  assert.equal(listed.channelSourceId, null);
  assert.equal(listed.channelSourceName, null);

  // Chỉ đổi ghi chú: không bắt buộc chi tiết
  assert.equal((await call(AM_A, "PATCH", `/leads/${legacyId}/note`, { note: "ok" })).status, 200);
  // Admin sửa tên, gửi lại đúng kênh cũ (không đổi) vẫn được
  const rename = await call(ADMIN, "PATCH", `/leads/${legacyId}`, {
    customerName: "KH Cũ Đã Sửa",
    channel: "Online",
    channelSourceId: null,
  });
  assert.equal(rename.status, 200, JSON.stringify(rename.body));
  assert.equal(rename.body.data.customerName, "KH Cũ Đã Sửa");

  // Admin bổ sung chi tiết
  const withSource = await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "Online", channelSourceId: onlineId });
  assert.equal(withSource.status, 200, JSON.stringify(withSource.body));
  assert.equal(withSource.body.data.channelSourceId, onlineId);

  // Đổi nguồn Online sang loại sai / không hợp lệ
  assert.equal((await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channelSourceId: partnerId })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channelSourceId: online2 })).status, 200);

  // Đổi sang kênh Đối tác mà không chọn đối tác: chặn; chọn đúng: được và xóa nguồn Online cũ
  assert.equal((await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "Đối tác" })).status, 400);
  const toPartner = await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "Đối tác", channelSourceId: partnerId });
  assert.equal(toPartner.status, 200);
  assert.equal(toPartner.body.data.channelSourceId, partnerId);

  // Đổi sang CTV: bắt buộc CTV; đổi sang kênh khác: tự xóa chi tiết cũ
  assert.equal((await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "CTV giới thiệu" })).status, 400);
  const toCtv = await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "CTV giới thiệu", referredByCtvId: CTV_ID });
  assert.equal(toCtv.status, 200);
  assert.equal(toCtv.body.data.channelSourceId, null);
  assert.equal(toCtv.body.data.referredByCtvId, CTV_ID);
  const toCampaign = await call(ADMIN, "PATCH", `/leads/${legacyId}`, { channel: "Chiến dịch" });
  assert.equal(toCampaign.status, 200);
  assert.equal(toCampaign.body.data.referredByCtvId, null);
  assert.equal(toCampaign.body.data.channelSourceId, null);
});

// ---------------------------------------------------------------------------
// Danh mục kênh
// ---------------------------------------------------------------------------

test("Danh mục kênh: đọc cho mọi nhân viên, ghi chỉ Admin, trùng tên 409", async () => {
  // Đã seed 3 nguồn Online mẫu
  const seeded = await call(AM_A, "GET", "/channel-sources?kind=online");
  assert.equal(seeded.status, 200);
  const names = seeded.body.data.map((s: any) => s.name);
  for (const n of ["Zalo Ads", "Facebook", "Website"]) assert.ok(names.includes(n), n);
  assert.equal((await call(AM_A, "GET", "/channel-sources?kind=sai")).status, 400);

  // AM không ghi được
  assert.equal((await call(AM_A, "POST", "/channel-sources", { kind: "partner", name: "X" })).status, 403);
  assert.equal((await call(AM_A, "PATCH", "/channel-sources/CHS-SEED-1", { name: "Hack" })).status, 403);
  assert.equal((await call(AM_A, "DELETE", "/channel-sources/CHS-SEED-1")).status, 403);
  assert.equal((await call(AM_A, "POST", "/channel-sources/reorder", { kind: "online", orderedIds: ["a"] })).status, 403);

  // Admin tạo, kiểm tra dữ liệu, trùng tên không phân biệt hoa thường (cùng loại), khác loại thì được
  assert.equal((await call(ADMIN, "POST", "/channel-sources", { kind: "sai", name: "X" })).status, 400);
  assert.equal((await call(ADMIN, "POST", "/channel-sources", { kind: "partner", name: "   " })).status, 400);
  assert.equal((await call(ADMIN, "POST", "/channel-sources", { kind: "partner", name: "a".repeat(101) })).status, 400);
  const created = await call(ADMIN, "POST", "/channel-sources", { kind: "partner", name: `  Đối   tác Một ${tag} ` });
  assert.equal(created.status, 201);
  createdSourceIds.push(created.body.data.id);
  assert.equal(created.body.data.name, `Đối tác Một ${tag}`);
  assert.equal(created.body.data.active, true);
  assert.equal((await call(ADMIN, "POST", "/channel-sources", { kind: "partner", name: `ĐỐI TÁC MỘT ${tag}`.toLowerCase() })).status, 409);
  const sameNameOnline = await call(ADMIN, "POST", "/channel-sources", { kind: "online", name: `Đối tác Một ${tag}` });
  assert.equal(sameNameOnline.status, 201);
  createdSourceIds.push(sameNameOnline.body.data.id);

  // Sửa tên (trùng thì 409), ẩn/hiện, thứ tự
  const id = created.body.data.id;
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/${id}`, { name: `Đối tác Một Mới ${tag}` })).status, 200);
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/${id}`, { active: "no" })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/${id}`, { sortOrder: -1 })).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/${id}`, {})).status, 400);
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/CHS-KHONG-CO`, { name: "a" })).status, 404);

  // Ẩn: nhân viên không thấy, Admin thấy khi includeInactive
  assert.equal((await call(ADMIN, "PATCH", `/channel-sources/${id}`, { active: false })).status, 200);
  const staffView = await call(AM_A, "GET", `/channel-sources?kind=partner&includeInactive=true`);
  assert.ok(!staffView.body.data.some((s: any) => s.id === id));
  const adminView = await call(ADMIN, "GET", `/channel-sources?kind=partner&includeInactive=true`);
  const row = adminView.body.data.find((s: any) => s.id === id);
  assert.equal(row.active, false);
  assert.equal(row.usageCount, 0);
  const adminActiveOnly = await call(ADMIN, "GET", `/channel-sources?kind=partner`);
  assert.ok(!adminActiveOnly.body.data.some((s: any) => s.id === id));
});

test("Danh mục kênh: xóa mục chưa dùng thì xóa hẳn, đã dùng thì chuyển sang ẩn; sắp xếp lại", async () => {
  const unused = await makeSource("partner", "Chưa dùng");
  const used = await makeSource("partner", "Đang dùng");

  await newLead(AM_A.name, "dung-nguon", { channel: "Đối tác", channelSourceId: used });

  const delUsed = await call(ADMIN, "DELETE", `/channel-sources/${used}`);
  assert.equal(delUsed.status, 200);
  assert.equal(delUsed.body.data.deleted, false);
  assert.equal(delUsed.body.data.deactivated, true);
  assert.match(delUsed.body.message, /đã được dùng ở 1 bản ghi/);
  const stillThere = await query<{ active: boolean }>("SELECT active FROM channel_sources WHERE id = ?", [used]);
  assert.equal(stillThere.length, 1);
  assert.equal(stillThere[0].active, false);

  // Lead cũ vẫn hiển thị tên nguồn đã ẩn
  const leads = (await call(ADMIN, "GET", "/leads")).body.data;
  assert.ok(leads.some((l: any) => l.channelSourceId === used && l.channelSourceName === `Đang dùng ${tag}`));

  const delUnused = await call(ADMIN, "DELETE", `/channel-sources/${unused}`);
  assert.equal(delUnused.status, 200);
  assert.equal(delUnused.body.data.deleted, true);
  assert.equal((await query("SELECT id FROM channel_sources WHERE id = ?", [unused])).length, 0);
  assert.equal((await call(ADMIN, "DELETE", `/channel-sources/${unused}`)).status, 404);

  // Sắp xếp lại
  const a = await makeSource("partner", "Sắp xếp A");
  const b = await makeSource("partner", "Sắp xếp B");
  const all = (await call(ADMIN, "GET", "/channel-sources?kind=partner&includeInactive=true")).body.data.map((s: any) => s.id);
  const reordered = all.filter((x: string) => x !== a && x !== b);
  reordered.unshift(b, a);
  const res = await call(ADMIN, "POST", "/channel-sources/reorder", { kind: "partner", orderedIds: reordered });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.data.slice(0, 2).map((s: any) => s.id), [b, a]);
  assert.equal((await call(ADMIN, "POST", "/channel-sources/reorder", { kind: "partner", orderedIds: [a, a] })).status, 400);
  assert.equal((await call(ADMIN, "POST", "/channel-sources/reorder", { kind: "partner", orderedIds: ["CHS-KHONG-CO"] })).status, 400);
  assert.equal((await call(ADMIN, "POST", "/channel-sources/reorder", { kind: "online", orderedIds: [a] })).status, 400);
});

test("Migration kênh/yêu cầu chạy lặp lại không lỗi và không nhân đôi dữ liệu mẫu", async () => {
  const { applyLeadChannelSchema } = await import("../../database/ext/t1.js");
  const before = await query<{ total: string }>("SELECT COUNT(*) AS total FROM channel_sources WHERE kind = 'online' AND name IN ('Zalo Ads','Facebook','Website')");
  await applyLeadChannelSchema();
  await applyLeadChannelSchema();
  const afterRows = await query<{ total: string }>("SELECT COUNT(*) AS total FROM channel_sources WHERE kind = 'online' AND name IN ('Zalo Ads','Facebook','Website')");
  assert.equal(Number(before[0].total), 3);
  assert.equal(Number(afterRows[0].total), 3);
});
