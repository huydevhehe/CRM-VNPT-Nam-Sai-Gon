import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { ADMIN, API_URL, apiLogin, bearer } from "./api/helpers";

test.describe("Trang Nhân viên: lọc trạng thái mặc định và nhiều phường phụ trách", () => {
  const suffix = Date.now();

  async function createWard(request: APIRequestContext, token: string, tag: string) {
    const res = await request.post(`${API_URL}/territories`, {
      headers: bearer(token),
      data: { wardName: `Phường UI NV ${tag} ${suffix}` },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data as { id: string; wardName: string };
  }

  async function createStaff(request: APIRequestContext, token: string, tag: string, extra: Record<string, unknown> = {}) {
    const code = `NV-UI-T3-${tag}-${suffix}`;
    const res = await request.post(`${API_URL}/staff`, {
      headers: bearer(token),
      data: {
        code,
        name: `NV UI T3 ${tag} ${suffix}`,
        role: "AM",
        password: "Password@12345",
        mustChangePassword: false,
        ...extra,
      },
    });
    expect(res.status()).toBe(201);
    return { ...((await res.json()).data as { id: string; name: string }), code };
  }

  test("Mặc định chỉ hiện nhân viên đang hoạt động; đổi bộ lọc hiện đình chỉ/ngừng/tất cả", async ({ page, request }) => {
    const token = await apiLogin(request, ADMIN.username, ADMIN.password);
    const active = await createStaff(request, token, "act");
    const suspended = await createStaff(request, token, "sus");
    const stopped = await createStaff(request, token, "stop");
    for (const [staff, status] of [
      [suspended, "Đình chỉ"],
      [stopped, "Ngừng hoạt động"],
    ] as const) {
      const res = await request.patch(`${API_URL}/staff/${staff.id}/status`, {
        headers: bearer(token),
        data: { status, reason: "Kiểm thử bộ lọc" },
      });
      expect(res.status()).toBe(200);
    }

    await loginAs(page, "admin");
    await page.goto("/admin/employees");

    const filter = page.getByTestId("staff-status-filter");
    await expect(filter).toHaveValue("Đang hoạt động");
    await expect(page.getByTestId(`staff-view-${active.code}`)).toBeVisible();
    await expect(page.getByTestId(`staff-view-${suspended.code}`)).toHaveCount(0);
    await expect(page.getByTestId(`staff-view-${stopped.code}`)).toHaveCount(0);
    await expect(page.getByTestId("staff-filter-summary")).toContainText("đang ẩn");

    await filter.selectOption("Đình chỉ");
    await expect(page.getByTestId(`staff-view-${suspended.code}`)).toBeVisible();
    await expect(page.getByTestId(`staff-view-${active.code}`)).toHaveCount(0);

    await filter.selectOption("Ngừng hoạt động");
    await expect(page.getByTestId(`staff-view-${stopped.code}`)).toBeVisible();

    await filter.selectOption("Tất cả");
    await expect(page.getByTestId(`staff-view-${active.code}`)).toBeVisible();
    await expect(page.getByTestId(`staff-view-${suspended.code}`)).toBeVisible();
    await expect(page.getByTestId(`staff-view-${stopped.code}`)).toBeVisible();
  });

  test("Nhiều phường: panel Xem liệt kê đủ, form Sửa chọn nhiều phường và lưu được", async ({ page, request }) => {
    const token = await apiLogin(request, ADMIN.username, ADMIN.password);
    const w1 = await createWard(request, token, "X");
    const w2 = await createWard(request, token, "Y");
    const w3 = await createWard(request, token, "Z");
    const staff = await createStaff(request, token, "ward", { territoryIds: [w1.id, w2.id] });

    await loginAs(page, "admin");
    await page.goto("/admin/employees");

    // Cột Địa bàn phụ trách có tên phường.
    await expect(page.getByTestId(`staff-wards-${staff.code}`)).toBeVisible();

    // Panel Xem: tab Phường phụ trách liệt kê 2 phường.
    await page.getByTestId(`staff-view-${staff.code}`).click();
    const modal = page.getByTestId("staff-overview-modal");
    await modal.getByTestId("tab-territories").click();
    await expect(modal.getByTestId("territory-row")).toHaveCount(2);
    await expect(modal.getByTestId("territory-link").first()).toHaveAttribute("href", /\/admin\/territories\/TB-/);
    await modal.getByTestId("staff-overview-close").click();

    // Sửa: thêm phường thứ ba, bỏ phường đầu.
    const row = page.locator("tr", { hasText: staff.code }).first();
    await row.getByRole("button", { name: "Sửa" }).click();
    const picker = page.getByTestId("edit-ward-select");
    await expect(picker.getByTestId(`ward-option-${w1.id}`)).toBeChecked();
    await expect(picker.getByTestId(`ward-option-${w2.id}`)).toBeChecked();
    await picker.getByTestId(`ward-option-${w1.id}`).uncheck();
    await picker.getByTestId(`ward-option-${w3.id}`).check();
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toHaveCount(0);

    await page.getByTestId(`staff-view-${staff.code}`).click();
    const modal2 = page.getByTestId("staff-overview-modal");
    await modal2.getByTestId("tab-territories").click();
    await expect(modal2.getByTestId("territory-row")).toHaveCount(2);
    await expect(modal2.getByTestId("territories-table")).toContainText(w2.wardName);
    await expect(modal2.getByTestId("territories-table")).toContainText(w3.wardName);
    await expect(modal2.getByTestId("territories-table")).not.toContainText(w1.wardName);
  });

  test("Nhân viên chưa có phường: tab Phường phụ trách báo trống", async ({ page, request }) => {
    const token = await apiLogin(request, ADMIN.username, ADMIN.password);
    const staff = await createStaff(request, token, "nowards");
    await loginAs(page, "admin");
    await page.goto("/admin/employees");
    await page.getByTestId(`staff-view-${staff.code}`).click();
    const modal = page.getByTestId("staff-overview-modal");
    await modal.getByTestId("tab-territories").click();
    await expect(modal.getByTestId("territories-empty")).toHaveText("Chưa phụ trách phường nào");
  });
});
