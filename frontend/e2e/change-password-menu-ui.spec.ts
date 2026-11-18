import { expect, test } from "@playwright/test";
import { ADMIN, API_URL, apiLogin, bearer, createApprovedCtv } from "./api/helpers";

test.describe("Đổi mật khẩu từ menu người dùng trên topbar", () => {
  test("Mở menu → Đổi mật khẩu; nhập sai mật khẩu hiện tại không bị đăng xuất; đổi xong đăng nhập lại bằng mật khẩu mới", async ({
    page,
    request,
  }) => {
    const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    const code = `NV-MENU-${Date.now()}`;
    const oldPassword = `Cu${Date.now()}@Vnpt`;
    const newPassword = `Moi${Date.now()}@Vnpt`;

    const created = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: { code, name: `NV menu ${code}`, role: "AM", territory: "Phường 1", password: oldPassword, mustChangePassword: false },
    });
    expect(created.status()).toBe(201);

    // Đăng nhập
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill(code);
    await page.getByLabel("Mật khẩu").fill(oldPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    // Menu người dùng: có "Đổi mật khẩu" và "Đăng xuất"
    await expect(page.getByTestId("user-menu")).toHaveCount(0);
    await page.getByTestId("user-menu-trigger").click();
    await expect(page.getByTestId("user-menu")).toBeVisible();
    await expect(page.getByTestId("user-menu-logout")).toBeVisible();

    // Esc đóng menu
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("user-menu")).toHaveCount(0);

    // Mở lại, bấm Đổi mật khẩu
    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("user-menu-change-password").click();
    await page.waitForURL("**/doi-mat-khau", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Đổi mật khẩu tài khoản" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quay lại trang làm việc" })).toBeVisible();

    // Sai mật khẩu hiện tại: báo lỗi tiếng Việt, vẫn ở trang và vẫn đăng nhập
    await page.getByLabel("Mật khẩu hiện tại").fill("Sai-mat-khau-1");
    await page.getByLabel("Mật khẩu mới (ít nhất 8 ký tự)").fill(newPassword);
    await page.getByLabel("Xác nhận mật khẩu mới").fill(newPassword);
    await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    await expect(page.getByText("Mật khẩu hiện tại không đúng")).toBeVisible();
    await expect(page).toHaveURL(/\/doi-mat-khau$/);
    await expect(page.getByRole("heading", { name: "Đổi mật khẩu tài khoản" })).toBeVisible();

    // Mật khẩu mới trùng mật khẩu cũ -> báo lỗi ngay ở client
    await page.getByLabel("Mật khẩu hiện tại").fill(oldPassword);
    await page.getByLabel("Mật khẩu mới (ít nhất 8 ký tự)").fill(oldPassword);
    await page.getByLabel("Xác nhận mật khẩu mới").fill(oldPassword);
    await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    await expect(page.getByText("Mật khẩu mới phải khác mật khẩu hiện tại")).toBeVisible();

    // Đổi đúng
    await page.getByLabel("Mật khẩu hiện tại").fill(oldPassword);
    await page.getByLabel("Mật khẩu mới (ít nhất 8 ký tự)").fill(newPassword);
    await page.getByLabel("Xác nhận mật khẩu mới").fill(newPassword);
    await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    await expect(page.getByText("Đổi mật khẩu thành công!")).toBeVisible();
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    // Đăng xuất bằng menu người dùng
    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("user-menu-logout").click();
    await page.waitForURL("**/login", { timeout: 15_000 });

    // Mật khẩu cũ không vào được, mật khẩu mới vào được
    await page.getByLabel("Tên đăng nhập").fill(code);
    await page.getByLabel("Mật khẩu").fill(oldPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText("Sai tài khoản hoặc mật khẩu")).toBeVisible();

    await page.getByLabel("Mật khẩu").fill(newPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
  });

  test("Chưa đăng nhập mở /doi-mat-khau bị đưa về trang đăng nhập", async ({ page }) => {
    await page.goto("/doi-mat-khau");
    await page.waitForURL("**/login", { timeout: 15_000 });
  });

  test("CTV vào được trang đổi mật khẩu từ thanh bên và đổi thành công", async ({ page, request }) => {
    const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    const ctv = await createApprovedCtv(request, adminToken);
    const newPassword = `Moi${Date.now()}@Ctv`;

    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill(ctv.username);
    await page.getByLabel("Mật khẩu").fill(ctv.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL("**/cong-tac-vien/dashboard", { timeout: 15_000 });

    await page.getByTestId("ctv-change-password").click();
    await page.waitForURL("**/doi-mat-khau", { timeout: 15_000 });
    await page.getByLabel("Mật khẩu hiện tại").fill(ctv.password);
    await page.getByLabel("Mật khẩu mới (ít nhất 8 ký tự)").fill(newPassword);
    await page.getByLabel("Xác nhận mật khẩu mới").fill(newPassword);
    await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    await expect(page.getByText("Đổi mật khẩu thành công!")).toBeVisible();
    await page.waitForURL("**/cong-tac-vien/dashboard", { timeout: 15_000 });

    const relogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: ctv.username, password: newPassword },
    });
    expect(relogin.status()).toBe(200);
  });
});
