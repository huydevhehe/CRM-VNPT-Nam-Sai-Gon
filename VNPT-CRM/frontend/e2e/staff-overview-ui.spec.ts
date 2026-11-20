import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { ADMIN, API_URL, apiLogin, bearer, createCustomerForOrder } from "./api/helpers";

/** Tài khoản AM mẫu (VNPT-AM-01) và tên nhân viên gắn với nó. */
const AM_CODE = "VNPT-AM-01";
const AM_NAME = "Nguyễn Thị Tình";

test.describe("Admin xem quyền và khách hàng của nhân viên", () => {
  test("Trang Nhân viên: nút Xem mở panel với thống kê, tab Quyền và tab Khách hàng", async ({ page, request }) => {
    const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    const customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Xem NV ${Date.now()}`,
      amStaff: AM_NAME,
    });

    await loginAs(page, "admin");
    await page.goto("/admin/employees");

    await page.getByTestId(`staff-view-${AM_CODE}`).click();
    const modal = page.getByTestId("staff-overview-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId("staff-overview-title")).toHaveText(AM_NAME);
    await expect(modal.getByTestId("staff-overview-stats")).toBeVisible();
    for (const id of ["customers", "leads", "orders", "open-tasks"]) {
      await expect(modal.getByTestId(`stat-${id}`)).toBeVisible();
    }

    // Tab Quyền (mặc định): AM không có quyền Hoa hồng, chỉ dữ liệu của mình ở Lead.
    await expect(modal.getByTestId("permissions-table")).toBeVisible();
    await expect(
      modal.getByTestId("permission-row-commissions").getByTestId("access-badge")
    ).toHaveAttribute("data-level", "Không có quyền");
    await expect(
      modal.getByTestId("permission-row-leads").getByTestId("access-badge")
    ).toHaveAttribute("data-level", "Chỉ dữ liệu của mình");

    // Tab Khách hàng: tìm theo tên, link sang trang chi tiết.
    await modal.getByTestId("tab-customers").click();
    await expect(modal.getByTestId("customers-table")).toBeVisible();
    await modal.getByTestId("customer-search").fill(customer.name);
    await expect(modal.getByTestId("customer-row")).toHaveCount(1);
    await expect(modal.getByTestId("customer-link")).toHaveAttribute("href", `/admin/customers/${customer.id}`);

    await modal.getByTestId("customer-search").fill("khong-co-khach-nao-ten-nay-zzz");
    await expect(modal.getByTestId("customers-no-match")).toBeVisible();

    await modal.getByTestId("staff-overview-close").click();
    await expect(modal).toHaveCount(0);
  });

  test("Nhân viên chưa có khách: hiển thị trạng thái rỗng", async ({ page, request }) => {
    const adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    const code = `NV-UI-EMPTY-${Date.now()}`;
    const created = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code,
        name: `NV Chưa Có Khách ${Date.now()}`,
        role: "AM",
        password: "Password@12345",
        mustChangePassword: false,
      },
    });
    expect(created.status()).toBe(201);

    await loginAs(page, "admin");
    await page.goto("/admin/employees");
    await page.getByTestId(`staff-view-${code}`).click();

    const modal = page.getByTestId("staff-overview-modal");
    await modal.getByTestId("tab-customers").click();
    await expect(modal.getByTestId("customers-empty")).toHaveText("Chưa có khách hàng được giao");
  });

  test("Các nút Sửa, Đổi mật khẩu, Đình chỉ, Ngừng vẫn còn trên hàng nhân viên", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/employees");
    const row = page.locator("tr", { hasText: AM_CODE }).first();
    await expect(row.getByRole("button", { name: "Xem" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Sửa" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Đổi mật khẩu" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Đình chỉ" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Ngừng" })).toBeVisible();
  });

  test("Trang Tài khoản & Phân quyền: 3 vai trò thật và ma trận quyền, không còn Viewer", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/settings");

    const cards = page.getByTestId("role-cards");
    await expect(cards).toBeVisible();
    await expect(page.getByTestId("role-card-Admin")).toBeVisible();
    await expect(page.getByTestId("role-card-AM")).toBeVisible();
    await expect(page.getByTestId("role-card-AM Bán chăm")).toBeVisible();
    await expect(page.getByText("Người xem (Viewer)")).toHaveCount(0);

    const matrix = page.getByTestId("permission-matrix");
    await expect(matrix).toBeVisible();
    await expect(page.getByTestId("matrix-row-commissions").getByTestId("access-badge")).toHaveCount(3);
    await expect(page.getByTestId("matrix-row-commissions").getByTestId("access-badge").nth(0)).toHaveAttribute(
      "data-level",
      "Toàn quyền"
    );
    await expect(page.getByTestId("matrix-row-commissions").getByTestId("access-badge").nth(1)).toHaveAttribute(
      "data-level",
      "Không có quyền"
    );
    await expect(page.getByTestId("matrix-row-customers").getByTestId("access-badge").nth(1)).toHaveAttribute(
      "data-level",
      "Chỉ xem"
    );

    // Nhật ký hệ thống vẫn còn.
    await expect(page.getByText("Nhật ký thao tác hệ thống (Audit Log)")).toBeVisible();
  });
});
