import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { ADMIN, AM, API_URL, apiLogin, bearer } from "./api/helpers";

const AM_NAME = "Nguyễn Thị Tình";
const SEARCH = "Tìm theo tên Lead, SĐT, kênh phát triển...";

function fieldByLabel(scope: Page | Locator, labelText: string): Locator {
  return scope
    .locator(`div:has(> label:text-is("${labelText}")) :is(input, select, textarea)`)
    .first();
}

test.describe("Lead: Danh mục kênh, chi tiết kênh, sửa Lead, lùi bước cần Admin duyệt", () => {
  let adminToken: string;
  let amToken: string;
  const suffix = Date.now();
  const createdSources: string[] = [];

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdSources) {
      await request.delete(`${API_URL}/channel-sources/${id}`, { headers: bearer(adminToken) });
    }
  });

  test("Admin: bảng Lead không có cột/lọc Phường; tạo Lead Online phải chọn nguồn; sửa Lead sang Đối tác", async ({
    page,
    request,
  }) => {
    const partnerName = `Đối tác UI ${suffix}`;
    const partner = await request.post(`${API_URL}/channel-sources`, {
      headers: bearer(adminToken),
      data: { kind: "partner", name: partnerName },
    });
    expect(partner.status()).toBe(201);
    createdSources.push((await partner.json()).data.id);

    const customerName = `KH UI Kênh ${suffix}`;
    const phone = `09${String(suffix).slice(-8)}`;

    await loginAs(page, "admin");
    await page.goto("/admin/leads");
    await expect(page.locator("table")).toBeVisible();

    // Bỏ cột Phường khỏi bảng và bộ lọc; có cột Chi tiết kênh
    await expect(page.getByRole("columnheader", { name: "Phường" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Chi tiết kênh" })).toBeVisible();

    await page.getByRole("button", { name: "Tạo Cơ hội mới" }).click();
    const modal = page.locator("div.fixed:has(h3:text-is('Tạo Cơ hội mới'))");
    await fieldByLabel(modal, "Tên khách hàng / Đầu mối").fill(customerName);
    await fieldByLabel(modal, "Số điện thoại").fill(phone);
    await fieldByLabel(modal, "AM Phụ trách").selectOption(AM_NAME);

    // Kênh Online: có ô Chi tiết kênh với các nguồn mẫu; bỏ trống thì không tạo được
    const detail = modal.getByTestId("channel-detail-select");
    await expect(modal.getByTestId("channel-detail-picker")).toContainText("Chi tiết kênh");
    await expect(detail.locator("option", { hasText: "Zalo Ads" })).toHaveCount(1);
    await expect(detail.locator("option", { hasText: "Facebook" })).toHaveCount(1);
    await modal.getByRole("button", { name: "Tạo Cơ hội", exact: true }).click();
    await expect(modal).toBeVisible(); // bị chặn vì chưa chọn nguồn
    await detail.selectOption({ label: "Zalo Ads" });
    await modal.getByRole("button", { name: "Tạo Cơ hội", exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(SEARCH).fill(phone);
    const row = page.locator("table tbody tr", { hasText: phone });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("lead-channel-detail")).toHaveText("Online › Zalo Ads");

    // Admin sửa: đổi tên + sang kênh Đối tác
    await row.getByTestId("lead-edit").click();
    const edit = page.locator("div.fixed:has(h3:text-is('Sửa thông tin Cơ hội'))");
    await expect(edit).toBeVisible();
    await expect(fieldByLabel(edit, "Tên khách hàng / Đầu mối")).toHaveValue(customerName);
    await fieldByLabel(edit, "Tên khách hàng / Đầu mối").fill(`${customerName} (sửa)`);
    await fieldByLabel(edit, "Kênh phát triển").selectOption("Đối tác");
    await edit.getByTestId("channel-detail-select").selectOption({ label: partnerName });
    await page.screenshot({ path: "e2e-shot-t1-edit.png" });
    await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(edit).not.toBeVisible({ timeout: 10_000 });

    const edited = page.locator("table tbody tr", { hasText: phone });
    await expect(edited).toContainText(`${customerName} (sửa)`);
    await expect(edited.getByTestId("lead-channel-detail")).toHaveText(`Đối tác › ${partnerName}`);

    // Đã ghi DB thật
    await page.reload();
    await page.getByPlaceholder(SEARCH).fill(phone);
    await expect(
      page.locator("table tbody tr", { hasText: phone }).getByTestId("lead-channel-detail")
    ).toHaveText(`Đối tác › ${partnerName}`);
  });

  test("AM: lùi bước phải gửi yêu cầu cho Admin, không có nút Sửa", async ({ page, request }) => {
    const phone = `08${String(suffix).slice(-8)}`;
    const create = await request.post(`${API_URL}/leads`, {
      headers: bearer(adminToken),
      data: {
        customerName: `KH UI Lùi bước ${suffix}`,
        phone,
        group: "Lead KH mới",
        channel: "Chiến dịch",
        staffName: AM_NAME,
      },
    });
    expect(create.status()).toBe(201);
    const leadId: string = (await create.json()).data.id;

    await loginAs(page, "am");
    await page.goto("/admin/leads");
    await page.getByPlaceholder(SEARCH).fill(phone);
    const row = page.locator("table tbody tr", { hasText: phone });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("lead-edit")).toHaveCount(0);
    await expect(page.getByTestId("tab-stage-requests")).toHaveCount(0);

    const status = row.locator("select");
    await status.selectOption("Đang tư vấn");
    await expect(status).toHaveValue("Đang tư vấn", { timeout: 10_000 });

    // Chọn lùi bước: không đổi trạng thái, mở hộp xin duyệt
    await status.selectOption("Đã liên hệ");
    const dialog = page.getByTestId("lead-request-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt.");
    await expect(status).toHaveValue("Đang tư vấn");
    await expect(page.getByTestId("lead-request-submit")).toBeDisabled(); // chưa có lý do
    await dialog.locator("textarea").fill("Nhập nhầm, khách chưa được tư vấn");
    await page.screenshot({ path: "e2e-shot-t1-request.png" });
    await page.getByTestId("lead-request-submit").click();
    await expect(page.getByTestId("lead-request-notice")).toBeVisible({ timeout: 10_000 });
    await expect(row.getByTestId("lead-pending-request")).toContainText("Đã liên hệ");

    // Trạng thái thật vẫn là Đang tư vấn cho tới khi Admin duyệt
    const list = await (await request.get(`${API_URL}/leads`, { headers: bearer(amToken) })).json();
    expect(list.data.find((l: { id: string }) => l.id === leadId).status).toBe("Đang tư vấn");
  });

  test("Admin: thấy số yêu cầu chờ duyệt và duyệt thì Lead đổi trạng thái", async ({ page, request }) => {
    const phone = `07${String(suffix).slice(-8)}`;
    const create = await request.post(`${API_URL}/leads`, {
      headers: bearer(adminToken),
      data: {
        customerName: `KH UI Duyệt ${suffix}`,
        phone,
        group: "Lead KH mới",
        channel: "Chiến dịch",
        staffName: AM_NAME,
        status: "Chốt thành công",
      },
    });
    expect(create.status()).toBe(201);
    const leadId: string = (await create.json()).data.id;
    const reqRes = await request.post(`${API_URL}/leads/${leadId}/stage-requests`, {
      headers: bearer(amToken),
      data: { toStatus: "Đang tư vấn", reason: "Khách đổi ý chưa ký" },
    });
    expect(reqRes.status()).toBe(201);

    await loginAs(page, "admin");
    await page.goto("/admin/leads");
    await expect(page.getByTestId("stage-requests-count")).not.toHaveText("0", { timeout: 10_000 });
    await page.getByTestId("tab-stage-requests").click();

    const item = page.locator('[data-testid="stage-request-item"]', { hasText: `KH UI Duyệt ${suffix}` });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Khách đổi ý chưa ký");
    await page.screenshot({ path: "e2e-shot-t1-approve.png" });
    await item.getByTestId("stage-request-approve").click();
    await expect(page.locator('[data-testid="stage-request-item"]', { hasText: `KH UI Duyệt ${suffix}` })).toHaveCount(0, {
      timeout: 10_000,
    });

    const list = await (await request.get(`${API_URL}/leads`, { headers: bearer(adminToken) })).json();
    expect(list.data.find((l: { id: string }) => l.id === leadId).status).toBe("Đang tư vấn");
  });

  test("Danh mục kênh: Admin thêm/ẩn nguồn, AM không thấy menu và bị chặn trang", async ({ page, browser }) => {
    const name = `Website UI ${suffix}`;
    await loginAs(page, "admin");
    await page.getByRole("link", { name: "Danh mục kênh" }).click();
    await expect(page.getByRole("heading", { name: "Danh mục kênh" })).toBeVisible();

    const online = page.getByTestId("channel-section-online");
    await online.getByLabel("Tên Nguồn Online mới").fill(name);
    await online.getByRole("button", { name: "Thêm" }).click();
    const row = online.locator('[data-testid="channel-source-row"]', { hasText: name });
    await expect(row).toBeVisible();
    await page.screenshot({ path: "e2e-shot-t1-catalog.png" });

    // Ẩn rồi hiện lại
    await row.getByRole("button", { name: "Ẩn khỏi danh sách chọn" }).click();
    await expect(row).toContainText("Đã ẩn");
    await row.getByRole("button", { name: "Hiện lại" }).click();
    await expect(row).not.toContainText("Đã ẩn");

    // Xóa (chưa dùng nên xóa hẳn) có bước xác nhận
    await row.getByRole("button", { name: "Xóa" }).click();
    await row.getByTestId("channel-source-confirm-delete").click();
    await expect(online.locator('[data-testid="channel-source-row"]', { hasText: name })).toHaveCount(0);

    // AM: không có menu, vào thẳng URL bị chặn
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const amPage = await ctx.newPage();
    await loginAs(amPage, "am");
    await expect(amPage.getByRole("link", { name: "Danh mục kênh" })).toHaveCount(0);
    await amPage.goto("/admin/channel-sources");
    await expect(amPage.getByTestId("forbidden-page")).toBeVisible();
    await ctx.close();
  });
});
