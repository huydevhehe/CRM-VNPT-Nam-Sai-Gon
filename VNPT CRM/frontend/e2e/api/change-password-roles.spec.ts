import { expect, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, API_URL, apiLogin, bearer, createApprovedCtv } from "./helpers";

async function login(request: APIRequestContext, username: string, password: string) {
  return request.post(`${API_URL}/auth/login`, { data: { username, password } });
}

/** Chạy trọn luồng đổi mật khẩu cho một tài khoản đã đăng nhập được. */
async function runChangePasswordFlow(
  request: APIRequestContext,
  username: string,
  oldPassword: string
) {
  const token = await apiLogin(request, username, oldPassword);
  const newPassword = `Moi${Date.now()}@Vnpt`;

  // Không token -> 401
  const noToken = await request.post(`${API_URL}/auth/change-password`, {
    data: { currentPassword: oldPassword, newPassword },
  });
  expect(noToken.status()).toBe(401);

  // Thiếu trường -> 400
  const missing = await request.post(`${API_URL}/auth/change-password`, {
    headers: bearer(token),
    data: { currentPassword: oldPassword },
  });
  expect(missing.status()).toBe(400);

  // Sai mật khẩu hiện tại -> 400 (không phải 401 để FE không tự đăng xuất), phiên vẫn dùng được
  const wrong = await request.post(`${API_URL}/auth/change-password`, {
    headers: bearer(token),
    data: { currentPassword: "Sai-mat-khau-1", newPassword },
  });
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).message).toBe("Mật khẩu hiện tại không đúng");
  const stillAlive = await request.get(`${API_URL}/auth/me`, { headers: bearer(token) });
  expect(stillAlive.status()).toBe(200);

  // Mật khẩu mới quá ngắn / quá dài / trùng mật khẩu cũ -> 400
  for (const bad of ["1234567", "a".repeat(73), oldPassword]) {
    const res = await request.post(`${API_URL}/auth/change-password`, {
      headers: bearer(token),
      data: { currentPassword: oldPassword, newPassword: bad },
    });
    expect(res.status(), `mật khẩu mới không hợp lệ: ${bad.length} ký tự`).toBe(400);
  }

  // Đổi thành công
  const ok = await request.post(`${API_URL}/auth/change-password`, {
    headers: bearer(token),
    data: { currentPassword: oldPassword, newPassword },
  });
  expect(ok.status()).toBe(200);

  // Mật khẩu mới đăng nhập được, mật khẩu cũ thì không
  const newLogin = await login(request, username, newPassword);
  expect(newLogin.status()).toBe(200);
  expect((await newLogin.json()).data.user.mustChangePassword).toBe(false);
  expect((await login(request, username, oldPassword)).status()).toBe(401);
}

test.describe("Đổi mật khẩu theo từng vai trò (API)", () => {
  for (const role of ["Admin", "AM", "AM Bán chăm"]) {
    test(`Nhân viên vai trò ${role} đổi mật khẩu đủ luồng`, async ({ request }) => {
      const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
      const code = `NV-PW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const password = `Init${Date.now()}@Vnpt`;
      const created = await request.post(`${API_URL}/staff`, {
        headers: bearer(adminToken),
        data: { code, name: `NV đổi mật khẩu ${role}`, role, territory: "Phường 1", password },
      });
      expect(created.status()).toBe(201);

      await runChangePasswordFlow(request, code, password);
    });
  }

  test("CTV đổi mật khẩu đủ luồng", async ({ request }) => {
    const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    const ctv = await createApprovedCtv(request, adminToken);
    await runChangePasswordFlow(request, ctv.username, ctv.password);
  });
});
