import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { ADMIN, API_URL, apiLogin, bearer } from "./api/helpers";

test.describe("Trang chi tiết khách hàng", () => {
  test("mở chi tiết khách, thêm 1 dịch vụ, reload vẫn thấy; danh sách khách thấy tên dịch vụ mới", async ({
    page,
    request,
  }) => {
    const suffix = Date.now();
    const token = await apiLogin(request, ADMIN.username, ADMIN.password);
    const customerName = `KH Chi Tiết ${suffix}`;
    const serviceName = `Internet Fiber Chi Tiết ${suffix}`;

    const createRes = await request.post(`${API_URL}/customers`, {
      headers: bearer(token),
      data: { name: customerName, type: "Doanh nghiệp", customerGroup: "Tự phát triển" },
    });
    expect(createRes.status()).toBe(201);
    const customerId = (await createRes.json()).data.id as string;

    await loginAs(page, "admin");
    await page.goto(`/admin/customers/${customerId}`);

    await expect(page.locator("h2", { hasText: customerName })).toBeVisible();

    // Khách mới chưa có dữ liệu: các thẻ thống kê hiện 0, không NaN
    const stats = page.getByLabel("Thống kê khách hàng");
    const statValue = (label: string) =>
      stats.getByText(label, { exact: true }).locator("xpath=following-sibling::div[1]");
    await expect(statValue("Dịch vụ đang dùng")).toHaveText("0");
    await expect(statValue("Sắp hết hạn")).toHaveText("0");
    await expect(statValue("Tổng số đơn hàng")).toHaveText("0");
    await expect(statValue("Còn phải thu")).toHaveText("0 đ");
    await expect(stats).not.toContainText("NaN");

    await page.getByRole("button", { name: "Thêm dịch vụ" }).click();
    const serviceModal = page.locator("div.fixed", { hasText: "Thêm dịch vụ" });
    await expect(serviceModal).toBeVisible();

    await serviceModal.locator("#svc-name").fill(serviceName);
    await serviceModal.locator("#svc-code").fill(`FTTH-DETAIL-${suffix}`);
    await serviceModal.locator("#svc-start").fill("2026-01-01");
    await serviceModal.locator("#svc-end").fill("2027-12-31");
    await serviceModal.getByRole("button", { name: "Lưu" }).click();
    await expect(serviceModal).toBeHidden();

    const servicesSection = page.locator("section", { has: page.getByRole("heading", { name: "Dịch vụ đang dùng" }) });
    await expect(servicesSection).toContainText(serviceName);
    // Thêm dịch vụ xong: thống kê tự cập nhật không cần tải lại trang
    await expect(statValue("Dịch vụ đang dùng")).toHaveText("1");

    // Tải lại trang chi tiết: dịch vụ vẫn còn (lấy từ backend, không chỉ state cục bộ)
    await page.reload();
    await expect(page.locator("section", { has: page.getByRole("heading", { name: "Dịch vụ đang dùng" }) })).toContainText(
      serviceName
    );

    // Danh sách khách hàng: cột "Dịch vụ đã đăng ký" thấy tên dịch vụ mới
    await page.goto("/admin/customers");
    const row = page.locator("tbody tr", { hasText: customerName });
    await expect(row).toContainText(serviceName);
  });
});
