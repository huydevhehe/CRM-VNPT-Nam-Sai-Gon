import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { API_URL, apiLogin, bearer } from "./api/helpers";

async function openTemplateTab(page: Page) {
  await page.goto("/admin/reminders");
  await page.getByRole("button", { name: "Mẫu email", exact: true }).click();
  await expect(page.getByTestId("body-editor")).toBeVisible();
}

test.describe("Nhắc hết hạn: số ngày theo nhóm và chữ ký", () => {
  test.describe.configure({ mode: "serial" });

  async function cleanup(request: APIRequestContext) {
    const token = await apiLogin(request, "admin", "admin@Vnpt2026");
    for (const group of ["BRCĐ", "CNTT", "Di động"]) {
      await request.delete(`${API_URL}/reminders/groups/${encodeURIComponent(group)}`, { headers: bearer(token) });
    }
    await request.put(`${API_URL}/reminders/signature`, { headers: bearer(token), data: { enabled: false, html: "" } });
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(token) });
  }

  test.beforeAll(async ({ request }) => {
    await cleanup(request);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("đặt số ngày nhắc riêng cho nhóm CNTT, tắt nhóm Di động, rồi dùng lại cấu hình chung", async ({ page }) => {
    await loginAs(page, "admin");
    await openTemplateTab(page);

    await page.getByRole("button", { name: "CNTT", exact: true }).click();
    const card = page.getByTestId("group-days-CNTT");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("group-days-state-CNTT")).toHaveText("Đang dùng cấu hình chung");
    await expect(page.getByRole("button", { name: "Dùng cấu hình chung" })).toBeDisabled();

    // Thêm mốc 60 và 15, bỏ các mốc khác.
    const chips = card.locator('[data-testid^="days-chip-CNTT-"]');
    while ((await chips.count()) > 0) {
      await card.locator('button[aria-label^="Xóa mốc"]').first().click();
    }
    await expect(page.getByRole("button", { name: "Lưu số ngày nhắc" })).toBeEnabled();
    const add = page.getByLabel("Thêm mốc ngày nhắc (CNTT)");
    await add.fill("15");
    await add.press("Enter");
    await add.fill("60");
    await add.press("Enter");
    await expect(chips).toHaveText(["60 ngày", "15 ngày"]);

    // Giá trị sai bị báo, không thêm.
    await add.fill("400");
    await add.press("Enter");
    await expect(page.getByText("Số ngày phải là số nguyên từ 0 đến 365.")).toBeVisible();
    await add.fill("15");
    await add.press("Enter");
    await expect(page.getByText("Mốc 15 ngày đã có.")).toBeVisible();

    await page.getByRole("button", { name: "Lưu số ngày nhắc" }).click();
    await expect(page.getByText("Đã lưu số ngày nhắc riêng cho nhóm CNTT.")).toBeVisible();
    await expect(page.getByTestId("group-days-state-CNTT")).toHaveText("Cấu hình riêng");

    // Nhóm khác vẫn theo chung.
    await page.getByRole("button", { name: "BRCĐ", exact: true }).click();
    await expect(page.getByTestId("group-days-state-BRCĐ")).toHaveText("Đang dùng cấu hình chung");

    // Tắt nhắc cho Di động.
    await page.getByRole("button", { name: "Di động", exact: true }).click();
    await page.getByLabel("Bật nhắc hết hạn cho nhóm Di động").uncheck();
    await page.getByRole("button", { name: "Lưu số ngày nhắc" }).click();
    await expect(page.getByText("Đã lưu số ngày nhắc riêng cho nhóm Di động.")).toBeVisible();

    // Bảng tổng hợp ở tab "Dịch vụ sắp hết hạn" phản ánh đúng, và bấm "Chỉnh" mở đúng nhóm.
    await page.reload();
    await expect(page.getByTestId("group-overview-row-CNTT")).toContainText("60, 15");
    await expect(page.getByTestId("group-overview-row-CNTT")).toContainText("Cấu hình riêng");
    await expect(page.getByTestId("group-overview-row-BRCĐ")).toContainText("Dùng chung");
    await expect(page.getByTestId("group-overview-row-Di động")).toContainText("Đã tắt nhắc");
    await page.getByTestId("group-overview-row-CNTT").getByRole("button", { name: "Chỉnh số ngày và mẫu email" }).click();
    await expect(page.getByTestId("group-days-CNTT")).toBeVisible();

    // Quay lại dùng cấu hình chung.
    await page.getByRole("button", { name: "Dùng cấu hình chung" }).click();
    await expect(page.getByText("Nhóm CNTT đã dùng lại cấu hình chung.")).toBeVisible();
    await expect(page.getByTestId("group-days-state-CNTT")).toHaveText("Đang dùng cấu hình chung");
  });

  test("chữ ký: soạn, xem trước kèm chữ ký, lưu, tắt thì xem trước không còn chữ ký", async ({ page }) => {
    await loginAs(page, "admin");
    await openTemplateTab(page);

    const preview = page.getByTestId("template-preview-body");
    await expect(preview).not.toContainText("Trân trọng");

    // Chữ ký mẫu có nhãn rõ ràng là mẫu.
    await page.getByRole("button", { name: "Chèn chữ ký mẫu" }).click();
    const signatureEditor = page.getByRole("textbox", { name: "Nội dung chữ ký" });
    await expect(signatureEditor).toContainText("Chữ ký mẫu - thay bằng thông tin thật");

    // Soạn chữ ký thật (có định dạng đậm), bật chèn tự động.
    await signatureEditor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("Trân trọng, ");
    await signatureEditor.locator("xpath=ancestor::*[@data-testid='signature-editor']").getByRole("button", { name: "Đậm", exact: true }).click();
    await page.keyboard.type("VNPT Nam Sài Gòn");

    // Chưa bật: xem trước chưa có chữ ký.
    await expect(preview).not.toContainText("Trân trọng");
    await page.getByTestId("signature-enabled").check();
    await expect(preview).toContainText("Trân trọng, VNPT Nam Sài Gòn");
    await expect(preview.locator("strong")).toContainText("VNPT Nam Sài Gòn");

    await page.getByRole("button", { name: "Lưu chữ ký" }).click();
    await expect(page.getByText("Đã lưu chữ ký email.")).toBeVisible();

    // Tải lại: chữ ký còn, công tắc còn bật, xem trước có chữ ký.
    await page.reload();
    await page.getByRole("button", { name: "Mẫu email", exact: true }).click();
    await expect(page.getByTestId("signature-enabled")).toBeChecked();
    await expect(page.getByTestId("template-preview-body")).toContainText("Trân trọng, VNPT Nam Sài Gòn");

    // Tắt: xem trước không còn chữ ký (nội dung chữ ký vẫn được giữ).
    await page.getByTestId("signature-enabled").uncheck();
    await expect(page.getByTestId("template-preview-body")).not.toContainText("Trân trọng");
    await page.getByRole("button", { name: "Lưu chữ ký" }).click();
    await expect(page.getByText("Đã lưu chữ ký email.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nội dung chữ ký" })).toContainText("Trân trọng, VNPT Nam Sài Gòn");
  });
});
