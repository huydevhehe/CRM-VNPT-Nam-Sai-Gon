import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { API_URL, apiLogin, bearer } from "./api/helpers";

test.describe("Tab Mẫu email nhắc hết hạn", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ request }) => {
    const token = await apiLogin(request, "admin", "admin@Vnpt2026");
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(token) });
  });

  test("soạn mẫu, chèn biến, xem trước, lưu rồi khôi phục mặc định", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/reminders");
    await page.getByRole("button", { name: "Mẫu email" }).click();

    const subject = page.getByLabel("Tiêu đề");
    const body = page.getByLabel("Nội dung");
    await expect(subject).toHaveValue(/\[VNPT NSG\]/);

    await subject.fill("Nhắc: ");
    await subject.focus();
    await page.getByRole("button", { name: "{tên khách}" }).click();
    await expect(subject).toHaveValue("Nhắc: {tên khách}");
    await expect(page.getByTestId("template-preview-subject")).toHaveText("Nhắc: Công ty TNHH ABC");

    await body.fill("Còn {số ngày còn lại} ngày <b>x</b>");
    await expect(page.getByTestId("template-preview-body")).toHaveText("Còn 7 ngày <b>x</b>");

    await body.fill("Lỗi {biến_lạ}");
    await expect(page.getByText("{biến_lạ}").first()).toBeVisible();
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(page.getByText(/biến không hợp lệ/).first()).toBeVisible();

    await body.fill("Kính gửi {tên khách}");
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(page.getByText("Đã lưu mẫu email nhắc hết hạn.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Mẫu email" }).click();
    await expect(page.getByLabel("Nội dung")).toHaveValue("Kính gửi {tên khách}");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByText("Đã khôi phục mẫu mặc định.")).toBeVisible();
    await expect(page.getByLabel("Tiêu đề")).toHaveValue(/\[VNPT NSG\]/);
  });
});
