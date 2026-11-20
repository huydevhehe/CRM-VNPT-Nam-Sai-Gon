import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

const ADMIN_ONLY_MENUS = [
  "Hoa hồng",
  "Cấu hình KPI",
  "Nhắc hết hạn (Email)",
  "Cộng tác viên",
  "Nhân viên",
  "Tài khoản & Phân quyền",
  "Cài đặt hệ thống",
];

const SHARED_MENUS = [
  "Dashboard tổng hợp",
  "Lead / Cơ hội",
  "Đơn hàng",
  "Quản lý nợ",
  "Khách hàng",
  "Phường xã",
  "Công việc / Nhắc việc",
];

const ADMIN_ONLY_URLS = [
  "/admin/commissions",
  "/admin/kpi-settings",
  "/admin/reminders",
  "/admin/ctv-accounts",
  "/admin/employees",
  "/admin/settings",
  "/admin/system-settings",
];

test.describe("Phân quyền giao diện theo vai trò", () => {
  test("AM chỉ thấy menu dùng chung, không có menu Admin và không có badge Admin", async ({ page }) => {
    await loginAs(page, "am");
    const sidebar = page.locator("aside");

    for (const name of SHARED_MENUS) {
      await expect(sidebar.getByRole("link", { name })).toBeVisible();
    }
    for (const name of ADMIN_ONLY_MENUS) {
      await expect(sidebar.getByRole("link", { name })).toHaveCount(0);
    }
    await expect(sidebar.getByText("Admin", { exact: true })).toHaveCount(0);
  });

  test("Admin thấy đầy đủ menu", async ({ page }) => {
    await loginAs(page, "admin");
    const sidebar = page.locator("aside");

    for (const name of [...SHARED_MENUS, ...ADMIN_ONLY_MENUS]) {
      await expect(sidebar.getByRole("link", { name })).toBeVisible();
    }
  });

  for (const url of ADMIN_ONLY_URLS) {
    test(`AM vào thẳng ${url} thấy trang Không có quyền truy cập, không gọi API`, async ({ page }) => {
      await loginAs(page, "am");

      const apiCalls: string[] = [];
      page.on("request", (req) => {
        const target = req.url();
        const fromBlockedPage = req.frame().url().includes(url);
        if (fromBlockedPage && target.includes("/api/") && !target.includes("/api/auth/")) apiCalls.push(target);
      });

      await page.goto(url);
      await expect(page.getByTestId("forbidden-page")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();

      expect(apiCalls, `Trang bị chặn không được gọi API: ${apiCalls.join(", ")}`).toEqual([]);
    });
  }

  test("Admin vào /admin/commissions không bị chặn", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/commissions");
    await expect(page.getByTestId("forbidden-page")).toHaveCount(0);
  });
});
