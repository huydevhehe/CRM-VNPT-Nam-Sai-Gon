import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

test.describe("API Nhân viên phụ trách nhiều phường và lọc theo trạng thái", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;
  const suffix = Date.now();

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  async function createWard(request: APIRequestContext, tag: string) {
    const res = await request.post(`${API_URL}/territories`, {
      headers: bearer(adminToken),
      data: { wardName: `Phường E2E NV ${tag} ${suffix}` },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data as { id: string; wardName: string };
  }

  async function createStaff(request: APIRequestContext, tag: string, extra: Record<string, unknown> = {}) {
    const res = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code: `NV-E2E-T3-${tag}-${suffix}`,
        name: `NV E2E T3 ${tag} ${suffix}`,
        role: "AM",
        password: "Password@12345",
        mustChangePassword: false,
        ...extra,
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data as { id: string; code: string; name: string; territory: string };
  }

  async function overviewWards(request: APIRequestContext, staffId: string) {
    const res = await request.get(`${API_URL}/staff/${staffId}/overview`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    return (await res.json()).data.territories as Array<{ id: string; wardName: string; source: string }>;
  }

  test("Nhân viên chưa có phường: overview trả territories rỗng", async ({ request }) => {
    const staff = await createStaff(request, "empty");
    expect(await overviewWards(request, staff.id)).toEqual([]);
  });

  test("Tạo nhân viên với nhiều phường, overview và GET /staff liệt kê đủ", async ({ request }) => {
    const w1 = await createWard(request, "A");
    const w2 = await createWard(request, "B");
    const staff = await createStaff(request, "multi", { territoryIds: [w1.id, w2.id] });

    const wards = await overviewWards(request, staff.id);
    expect(wards.map((w) => w.id).sort()).toEqual([w1.id, w2.id].sort());
    expect(wards.every((w) => w.source === "assigned")).toBe(true);

    const list = await request.get(`${API_URL}/staff`, { headers: bearer(adminToken) });
    const found = ((await list.json()).data as Array<{ id: string; territories: string[] }>).find((s) => s.id === staff.id);
    expect([...(found?.territories ?? [])].sort()).toEqual([w1.wardName, w2.wardName].sort());

    // Trang Địa bàn thấy cùng một sự thật: phường đã gán đúng nhân viên.
    const territories = await request.get(`${API_URL}/territories`, { headers: bearer(adminToken) });
    const rows = (await territories.json()).data as Array<{ id: string; staff_name?: string; staffName?: string }>;
    const row1 = rows.find((r) => r.id === w1.id);
    expect(row1?.staff_name ?? row1?.staffName).toBe(staff.name);
  });

  test("PATCH territoryIds thay thế danh sách: phường bỏ ra không còn thuộc nhân viên", async ({ request }) => {
    const w1 = await createWard(request, "C");
    const w2 = await createWard(request, "D");
    const staff = await createStaff(request, "patch", { territoryIds: [w1.id, w2.id] });

    const res = await request.patch(`${API_URL}/staff/${staff.id}`, {
      headers: bearer(adminToken),
      data: { territoryIds: [w2.id] },
    });
    expect(res.status()).toBe(200);
    expect((await overviewWards(request, staff.id)).map((w) => w.id)).toEqual([w2.id]);
  });

  test("PATCH territoryIds sai trả 400; AM bị 403; không token 401", async ({ request }) => {
    const staff = await createStaff(request, "guard");
    const bad = await request.patch(`${API_URL}/staff/${staff.id}`, {
      headers: bearer(adminToken),
      data: { territoryIds: ["TB-KHONG-TON-TAI"] },
    });
    expect(bad.status()).toBe(400);

    const notArray = await request.patch(`${API_URL}/staff/${staff.id}`, {
      headers: bearer(adminToken),
      data: { territoryIds: "abc" },
    });
    expect(notArray.status()).toBe(400);

    const forbidden = await request.patch(`${API_URL}/staff/${staff.id}`, {
      headers: bearer(amToken),
      data: { territoryIds: [] },
    });
    expect(forbidden.status()).toBe(403);

    const anon = await request.patch(`${API_URL}/staff/${staff.id}`, { data: { territoryIds: [] } });
    expect(anon.status()).toBe(401);
  });

  test("GET /staff?status=active chỉ trả nhân viên đang hoạt động", async ({ request }) => {
    const active = await createStaff(request, "act");
    const suspended = await createStaff(request, "sus");
    const res = await request.patch(`${API_URL}/staff/${suspended.id}/status`, {
      headers: bearer(adminToken),
      data: { status: "Đình chỉ", reason: "Kiểm thử bộ lọc" },
    });
    expect(res.status()).toBe(200);

    const filtered = await request.get(`${API_URL}/staff?status=active`, { headers: bearer(adminToken) });
    const rows = (await filtered.json()).data as Array<{ id: string; status: string }>;
    expect(rows.every((r) => r.status === "Đang hoạt động")).toBe(true);
    expect(rows.some((r) => r.id === active.id)).toBe(true);
    expect(rows.some((r) => r.id === suspended.id)).toBe(false);
  });
});
