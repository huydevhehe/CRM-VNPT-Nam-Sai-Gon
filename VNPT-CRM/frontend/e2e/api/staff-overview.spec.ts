import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer, createCustomerForOrder } from "./helpers";

const MODULE_KEYS_ADMIN_ONLY = [
  "commissions",
  "reports",
  "reminders",
  "ctv",
  "staff",
  "data_transfer",
  "system_settings",
];

test.describe("API Xem quyền và khách hàng của nhân viên (/api/staff/permissions, /api/staff/:id/overview)", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  async function createStaff(request: Parameters<typeof apiLogin>[0], role: string, tag: string) {
    const suffix = Date.now();
    const code = `NV-OV-${tag}-${suffix}`;
    const res = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code,
        name: `NV Overview ${tag} ${suffix}`,
        role,
        territory: "Phường Tân Phong",
        email: `${code.toLowerCase()}@vnpt.vn`,
        password: "Password@12345",
        mustChangePassword: false,
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data as { id: string; code: string; name: string };
  }

  test("GET /staff/permissions: không token 401, AM 403, Admin 200 với 3 vai trò thật", async ({ request }) => {
    expect((await request.get(`${API_URL}/staff/permissions`)).status()).toBe(401);
    expect((await request.get(`${API_URL}/staff/permissions`, { headers: bearer(amToken) })).status()).toBe(403);

    const res = await request.get(`${API_URL}/staff/permissions`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;

    expect(data.roles.map((r: { role: string }) => r.role)).toEqual(["Admin", "AM", "AM Bán chăm"]);
    expect(JSON.stringify(data)).not.toContain("Viewer");

    const byKey = new Map<string, { access: Record<string, string> }>(
      data.modules.map((m: { key: string; access: Record<string, string> }) => [m.key, m])
    );
    for (const key of MODULE_KEYS_ADMIN_ONLY) {
      expect(byKey.get(key)?.access.Admin, key).toBe("Toàn quyền");
      expect(byKey.get(key)?.access.AM, key).toBe("Không có quyền");
      expect(byKey.get(key)?.access["AM Bán chăm"], key).toBe("Không có quyền");
    }
    expect(byKey.get("leads")?.access.AM).toBe("Chỉ dữ liệu của mình");
    expect(byKey.get("customers")?.access["AM Bán chăm"]).toBe("Chỉ xem");
  });

  test("GET /staff/:id/overview: không token 401, AM 403, nhân viên không tồn tại 404", async ({ request }) => {
    const staff = await createStaff(request, "AM", "guard");
    expect((await request.get(`${API_URL}/staff/${staff.id}/overview`)).status()).toBe(401);
    expect(
      (await request.get(`${API_URL}/staff/${staff.id}/overview`, { headers: bearer(amToken) })).status()
    ).toBe(403);

    const missing = await request.get(`${API_URL}/staff/STAFF-KHONG-TON-TAI/overview`, {
      headers: bearer(adminToken),
    });
    expect(missing.status()).toBe(404);
    expect((await missing.json()).message).toBe("Không tìm thấy Nhân viên");
  });

  test("GET /staff/:id/overview: đếm khách theo cả AM bán hàng và AM CSKH, không lộ mật khẩu", async ({
    request,
  }) => {
    const target = await createStaff(request, "AM Bán chăm", "main");
    const other = await createStaff(request, "AM", "other");

    const salesOnly = await createCustomerForOrder(request, adminToken, { amStaff: target.name, amCaringStaff: other.name });
    const caringOnly = await createCustomerForOrder(request, adminToken, { amStaff: other.name, amCaringStaff: target.name });
    const both = await createCustomerForOrder(request, adminToken, { amStaff: target.name, amCaringStaff: target.name });
    const foreign = await createCustomerForOrder(request, adminToken, { amStaff: other.name, amCaringStaff: other.name });

    const res = await request.get(`${API_URL}/staff/${target.id}/overview`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const raw = await res.text();
    expect(raw.toLowerCase()).not.toContain("password");

    const data = JSON.parse(raw).data;
    expect(data.staff).toMatchObject({ id: target.id, name: target.name, role: "AM Bán chăm" });
    expect(data.stats.customers).toBe(3);

    const byId = new Map<string, { relation: string }>(
      data.customers.map((c: { id: string; relation: string }) => [c.id, c])
    );
    expect(byId.get(salesOnly.id)?.relation).toBe("Bán hàng");
    expect(byId.get(caringOnly.id)?.relation).toBe("CSKH");
    expect(byId.get(both.id)?.relation).toBe("Bán hàng + CSKH");
    expect(byId.has(foreign.id)).toBe(false);

    const commissions = data.permissions.find((p: { key: string }) => p.key === "commissions");
    expect(commissions.level).toBe("Không có quyền");
    const customersPerm = data.permissions.find((p: { key: string }) => p.key === "customers");
    expect(customersPerm.level).toBe("Chỉ xem");
  });

  test("GET /staff/:id/overview: nhân viên Admin có Toàn quyền, chưa có khách thì danh sách rỗng", async ({
    request,
  }) => {
    const admin = await createStaff(request, "Admin", "adm");
    const res = await request.get(`${API_URL}/staff/${admin.id}/overview`, { headers: bearer(adminToken) });
    expect(res.status()).toBe(200);
    const data = (await res.json()).data;
    expect(data.customers).toEqual([]);
    expect(data.stats.customers).toBe(0);
    expect(data.permissions.every((p: { level: string }) => p.level === "Toàn quyền")).toBe(true);
  });
});
