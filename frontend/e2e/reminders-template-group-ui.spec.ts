import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { API_URL, apiLogin, bearer } from "./api/helpers";

test.describe("Tab Mẫu email: chọn mẫu theo nhóm dịch vụ", () => {
  test.describe.configure({ mode: "serial" });

  async function resetAll(request: Parameters<Parameters<typeof test.afterAll>[0]>[0]["request"]) {
    const token = await apiLogin(request, "admin", "admin@Vnpt2026");
    for (const group of ["BRCĐ", "CNTT", "Di động"]) {
      await request.post(`${API_URL}/reminders/template/reset?group=${encodeURIComponent(group)}`, { headers: bearer(token) });
    }
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(token) });
  }

  test.beforeAll(async ({ request }) => {
    await resetAll(request);
  });

  test.afterAll(async ({ request }) => {
    await resetAll(request);
  });

  test("lưu mẫu riêng cho nhóm CNTT, nhóm BRCĐ vẫn theo mẫu chung, rồi dùng lại mẫu chung", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/reminders");
    await page.getByRole("button", { name: "Mẫu email" }).click();

    const subject = page.getByLabel("Tiêu đề");
    const body = page.getByLabel("Nội dung");
    const general = await subject.inputValue();

    await page.getByRole("button", { name: "CNTT", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mẫu email nhắc hết hạn - nhóm CNTT" })).toBeVisible();
    await expect(page.getByText("Đang dùng mẫu chung")).toBeVisible();
    await expect(subject).toHaveValue(general);

    await subject.fill("CNTT: {dịch vụ} hết hạn");
    await body.fill("Gói CNTT của {tên khách} hết hạn ngày {ngày hết hạn}");
    await expect(page.getByTestId("template-preview-subject")).toHaveText("CNTT: Internet cáp quang FiberVNN hết hạn");
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(page.getByText("Đã lưu mẫu riêng cho nhóm CNTT.")).toBeVisible();
    await expect(page.getByText("Đang dùng mẫu chung")).toHaveCount(0);

    await page.getByRole("button", { name: "BRCĐ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mẫu email nhắc hết hạn - nhóm BRCĐ" })).toBeVisible();
    await expect(subject).toHaveValue(general);

    await page.reload();
    await page.getByRole("button", { name: "Mẫu email" }).click();
    await page.getByRole("button", { name: "CNTT", exact: true }).click();
    await expect(subject).toHaveValue("CNTT: {dịch vụ} hết hạn");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Dùng lại mẫu chung" }).click();
    await expect(page.getByText("Đã dùng lại mẫu chung.")).toBeVisible();
    await expect(subject).toHaveValue(general);

    await page.getByRole("button", { name: "Mẫu chung", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mẫu email nhắc hết hạn", exact: true })).toBeVisible();
    await expect(subject).toHaveValue(general);
  });
});
