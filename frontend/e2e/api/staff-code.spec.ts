import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./helpers";

test.describe("API Đổi mã nhân viên / tên đăng nhập (PATCH /api/staff/:id)", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  async function createStaff(
    request: Parameters<typeof apiLogin>[0],
    code: string,
    password = "Password@12345"
  ) {
    const res = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code,
        name: `NV Đổi mã ${code}`,
        role: "AM",
        territory: "Phường Tân Phong",
        email: `${code.toLowerCase()}@vnpt.vn`,
        password,
        mustChangePassword: false,
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data as { id: string; code: string };
  }

  test("admin đổi mã: đăng nhập bằng tên mới + mật khẩu cũ, tên cũ bị từ chối, token cũ hết hiệu lực", async ({
    request,
  }) => {
    const suffix = Date.now();
    const oldCode = `NV-CHG-OLD-${suffix}`;
    const newCode = `NV-CHG-NEW-${suffix}`;
    const password = "Password@12345";
    const staff = await createStaff(request, oldCode, password);
    const oldToken = await apiLogin(request, oldCode, password);

    const res = await request.patch(`${API_URL}/staff/${staff.id}`, {
      headers: bearer(adminToken),
      data: { code: newCode },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.code).toBe(newCode);
    expect(body.data.username).toBe(newCode);

    const oldLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: oldCode, password },
    });
    expect(oldLogin.status()).toBe(401);

    const newLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: newCode, password },
    });
    expect(newLogin.status()).toBe(200);
    expect((await newLogin.json()).data.user.id).toBe(`USR-${oldCode}`);

    const withOldToken = await request.get(`${API_URL}/staff`, { headers: bearer(oldToken) });
    expect(withOldToken.status()).toBe(401);

    const newToken = (await newLogin.json()).data.token as string;
    const withNewToken = await request.get(`${API_URL}/auth/me`, { headers: bearer(newToken) });
    expect(withNewToken.status()).toBe(200);
  });

  test("đổi mã trùng mã nhân viên khác (kể cả khác hoa/thường) → 409", async ({ request }) => {
    const suffix = Date.now();
    const a = await createStaff(request, `NV-CHG-DA-${suffix}`);
    const b = await createStaff(request, `NV-CHG-DB-${suffix}`);

    for (const code of [b.code, b.code.toLowerCase()]) {
      const res = await request.patch(`${API_URL}/staff/${a.id}`, {
        headers: bearer(adminToken),
        data: { code },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).success).toBe(false);
    }
  });

  test("đổi mã trùng tên đăng nhập có sẵn (admin) → 409", async ({ request }) => {
    const a = await createStaff(request, `NV-CHG-UA-${Date.now()}`);
    for (const code of ["admin", "ADMIN"]) {
      const res = await request.patch(`${API_URL}/staff/${a.id}`, {
        headers: bearer(adminToken),
        data: { code },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).message).toContain("Tên đăng nhập");
    }
  });

  test("đổi mã sai định dạng → 400", async ({ request }) => {
    const a = await createStaff(request, `NV-CHG-BAD-${Date.now()}`);
    for (const code of ["", "ab", "NV CODE", "NV/CODE", "x".repeat(51)]) {
      const res = await request.patch(`${API_URL}/staff/${a.id}`, {
        headers: bearer(adminToken),
        data: { code },
      });
      expect(res.status(), `code="${code}"`).toBe(400);
    }
  });

  test("AM không được đổi mã → 403", async ({ request }) => {
    const a = await createStaff(request, `NV-CHG-FB-${Date.now()}`);
    const res = await request.patch(`${API_URL}/staff/${a.id}`, {
      headers: bearer(amToken),
      data: { code: `NV-CHG-FB2-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
  });
});
