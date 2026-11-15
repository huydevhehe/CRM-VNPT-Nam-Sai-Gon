import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

/** Tên nhân viên gắn với tài khoản AM test (VNPT-AM-01). */
const AM_NAME = "Nguyễn Thị Tình";
/** AM khác (không dùng để đăng nhập, chỉ để gán dữ liệu cho người khác). */
const OTHER_AM_NAME = "Nguyễn Thị Huyền Trang";

const ADMIN_ONLY_GET = [
  "/commissions",
  "/commissions/summary",
  "/reports/summary",
  "/reports/audit-logs",
  "/settings",
  "/reminders/settings",
  "/ctv-accounts",
];

test.describe("Phân quyền tầng API: AM không có quyền Admin", () => {
  let adminToken: string;
  let amToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  for (const path of ADMIN_ONLY_GET) {
    test(`GET ${path}: không token 401, AM 403, Admin 200`, async ({ request }) => {
      expect((await request.get(`${API_URL}${path}`)).status()).toBe(401);
      expect((await request.get(`${API_URL}${path}`, { headers: bearer(amToken) })).status()).toBe(403);
      expect((await request.get(`${API_URL}${path}`, { headers: bearer(adminToken) })).status()).toBe(200);
    });
  }

  test("Hoa hồng / Cài đặt: AM ghi bị 403", async ({ request }) => {
    const h = { headers: bearer(amToken) };
    expect((await request.patch(`${API_URL}/commissions/x/status`, { ...h, data: { status: "Đã chi" } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/commissions/x/amount`, { ...h, data: { amount: 1 } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/commissions/x/payout`, { ...h, data: {} })).status()).toBe(403);
    expect((await request.put(`${API_URL}/settings`, { ...h, data: { smtpHost: "evil.example.com" } })).status()).toBe(403);
    expect((await request.post(`${API_URL}/settings/smtp/test`, { ...h, data: { to: "a@b.vn" } })).status()).toBe(403);
  });

  test("Nhân viên: AM chỉ nhận danh bạ rút gọn, Admin nhận đủ hồ sơ", async ({ request }) => {
    const am = await request.get(`${API_URL}/staff`, { headers: bearer(amToken) });
    expect(am.status()).toBe(200);
    const amRows: Array<Record<string, unknown>> = (await am.json()).data;
    expect(amRows.length).toBeGreaterThan(0);
    for (const row of amRows) {
      expect(Object.keys(row).sort()).toEqual(["code", "id", "name", "role", "status"]);
    }
    expect(JSON.stringify(amRows)).not.toContain("@vnpt.vn");

    const admin = await request.get(`${API_URL}/staff`, { headers: bearer(adminToken) });
    const adminRows: Array<Record<string, unknown>> = (await admin.json()).data;
    expect(adminRows[0]).toHaveProperty("email");
    expect(adminRows[0]).toHaveProperty("phone");
    expect(adminRows[0]).toHaveProperty("revenue");
  });

  test("Địa bàn: AM không ghi được số hộ, thống kê, đầu mối", async ({ request }) => {
    const h = { headers: bearer(amToken) };
    const wards: Array<{ id: string }> = (
      await (await request.get(`${API_URL}/territories`, h)).json()
    ).data;
    const id = wards[0].id;
    expect((await request.patch(`${API_URL}/territories/${id}/households`, { ...h, data: { householdCount: 1 } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/territories/${id}/stats`, { ...h, data: { revenue: 1 } })).status()).toBe(403);
    expect((await request.post(`${API_URL}/territories/${id}/contacts`, { ...h, data: { unit: "UBND", fullName: "E2E AM" } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/territories/contacts/x`, { ...h, data: { fullName: "E2E" } })).status()).toBe(403);
    expect((await request.delete(`${API_URL}/territories/contacts/x`, h)).status()).toBe(403);
  });

  test("Lead: AM chỉ thấy/sửa Lead của mình, không tạo hộ người khác, không giao lại AM", async ({ request }) => {
    const suffix = Date.now();
    const leadBody = (staffName: string | undefined, tag: string) => ({
      customerName: `KH ACL ${tag} ${suffix}`,
      phone: "0901234567",
      group: "Lead KH mới",
      channel: "Online",
      ...(staffName === undefined ? {} : { staffName }),
    });

    const mineRes = await request.post(`${API_URL}/leads`, { headers: bearer(adminToken), data: leadBody(AM_NAME, "own") });
    const otherRes = await request.post(`${API_URL}/leads`, { headers: bearer(adminToken), data: leadBody(OTHER_AM_NAME, "other") });
    expect(mineRes.status()).toBe(201);
    expect(otherRes.status()).toBe(201);
    const mineId: string = (await mineRes.json()).data.id;
    const otherId: string = (await otherRes.json()).data.id;
    const h = { headers: bearer(amToken) };

    const list: Array<{ id: string; staffName: string }> = (await (await request.get(`${API_URL}/leads`, h)).json()).data;
    expect(list.some((l) => l.id === mineId)).toBe(true);
    expect(list.some((l) => l.id === otherId)).toBe(false);
    expect(list.every((l) => l.staffName === AM_NAME)).toBe(true);

    const adminList: Array<{ id: string }> = (
      await (await request.get(`${API_URL}/leads`, { headers: bearer(adminToken) })).json()
    ).data;
    expect(adminList.some((l) => l.id === mineId) && adminList.some((l) => l.id === otherId)).toBe(true);

    expect((await request.patch(`${API_URL}/leads/${mineId}/status`, { ...h, data: { status: "Đã liên hệ" } })).status()).toBe(200);
    expect((await request.patch(`${API_URL}/leads/${mineId}/note`, { ...h, data: { note: "AM ghi chú" } })).status()).toBe(200);
    expect((await request.patch(`${API_URL}/leads/${otherId}/status`, { ...h, data: { status: "Đã liên hệ" } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/leads/${otherId}/note`, { ...h, data: { note: "xâm nhập" } })).status()).toBe(403);

    expect((await request.patch(`${API_URL}/leads/${mineId}/assignment`, { ...h, data: { staffName: OTHER_AM_NAME } })).status()).toBe(403);
    expect((await request.patch(`${API_URL}/leads/${otherId}/assignment`, { ...h, data: { staffName: AM_NAME } })).status()).toBe(403);

    expect((await request.post(`${API_URL}/leads`, { ...h, data: leadBody(OTHER_AM_NAME, "cr-other") })).status()).toBe(403);
    expect((await request.post(`${API_URL}/leads`, { ...h, data: leadBody("__RANDOM__", "cr-random") })).status()).toBe(403);
    const self = await request.post(`${API_URL}/leads`, { ...h, data: leadBody(undefined, "cr-self") });
    expect(self.status()).toBe(201);
    expect((await self.json()).data.staffName).toBe(AM_NAME);

    const reassigned = await request.patch(`${API_URL}/leads/${mineId}/assignment`, {
      headers: bearer(adminToken),
      data: { staffName: OTHER_AM_NAME },
    });
    expect(reassigned.status()).toBe(200);
  });

  test("Công việc: AM chỉ thấy/sửa việc giao cho mình, chỉ tạo việc cho mình", async ({ request }) => {
    const suffix = Date.now();
    const taskBody = (assignee: string | undefined, tag: string) => ({
      title: `Việc ACL ${tag} ${suffix}`,
      relatedTarget: "KH test",
      dueDate: "2026-12-31",
      ...(assignee === undefined ? {} : { assignee }),
    });

    const mineRes = await request.post(`${API_URL}/tasks`, { headers: bearer(adminToken), data: taskBody(AM_NAME, "own") });
    const otherRes = await request.post(`${API_URL}/tasks`, { headers: bearer(adminToken), data: taskBody(OTHER_AM_NAME, "other") });
    expect(mineRes.status()).toBe(201);
    expect(otherRes.status()).toBe(201);
    const mineId: string = (await mineRes.json()).data.id;
    const otherId: string = (await otherRes.json()).data.id;
    const h = { headers: bearer(amToken) };

    const list: Array<{ id: string; assignee: string }> = (await (await request.get(`${API_URL}/tasks`, h)).json()).data;
    expect(list.some((t) => t.id === mineId)).toBe(true);
    expect(list.some((t) => t.id === otherId)).toBe(false);
    expect(list.every((t) => t.assignee === AM_NAME)).toBe(true);

    expect((await request.patch(`${API_URL}/tasks/${mineId}/status`, { ...h, data: { status: "Đang làm" } })).status()).toBe(200);
    expect((await request.patch(`${API_URL}/tasks/${otherId}/status`, { ...h, data: { status: "Đang làm" } })).status()).toBe(403);

    expect((await request.post(`${API_URL}/tasks`, { ...h, data: taskBody(OTHER_AM_NAME, "cr-other") })).status()).toBe(403);
    const self = await request.post(`${API_URL}/tasks`, { ...h, data: taskBody(undefined, "cr-self") });
    expect(self.status()).toBe(201);
    expect((await self.json()).data.assignee).toBe(AM_NAME);

    const adminList: Array<{ id: string }> = (
      await (await request.get(`${API_URL}/tasks`, { headers: bearer(adminToken) })).json()
    ).data;
    expect(adminList.some((t) => t.id === mineId) && adminList.some((t) => t.id === otherId)).toBe(true);
  });

  test("Dịch vụ: AM chỉ thấy dịch vụ của mình dù truyền ?staff= của người khác", async ({ request }) => {
    const res = await request.get(`${API_URL}/services?staff=${encodeURIComponent(OTHER_AM_NAME)}`, {
      headers: bearer(amToken),
    });
    expect(res.status()).toBe(200);
    const rows: Array<{ staffName: string }> = (await res.json()).data;
    expect(rows.every((s) => s.staffName === AM_NAME)).toBe(true);
  });
});
