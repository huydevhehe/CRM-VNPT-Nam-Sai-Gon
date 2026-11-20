import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { API_URL, apiLogin, bearer } from "./api/helpers";

async function openTemplateTab(page: Page) {
  await page.goto("/admin/reminders");
  await page.getByRole("button", { name: "Mẫu email", exact: true }).click();
  await expect(page.getByTestId("body-editor")).toBeVisible();
}

/** Xoá toàn bộ nội dung trình soạn thảo rồi gõ `text`. */
async function typeInBody(page: Page, text: string) {
  const editor = page.getByRole("textbox", { name: "Nội dung", exact: true });
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  if (text) await page.keyboard.type(text);
}

test.describe("Tab Mẫu email nhắc hết hạn", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ request }) => {
    const token = await apiLogin(request, "admin", "admin@Vnpt2026");
    await request.post(`${API_URL}/reminders/template/reset`, { headers: bearer(token) });
  });

  test("soạn mẫu có định dạng: chèn biến, đậm, nghiêng, màu chữ, tô nền, xem trước, lưu, khôi phục", async ({ page }) => {
    await loginAs(page, "admin");
    await openTemplateTab(page);

    const subject = page.getByLabel("Tiêu đề");
    await expect(subject).toHaveValue(/\[VNPT NSG\]/);

    // Chèn biến vào tiêu đề.
    await subject.fill("Nhắc: ");
    await subject.focus();
    await page.getByRole("button", { name: "{tên khách}" }).click();
    await expect(subject).toHaveValue("Nhắc: {tên khách}");
    await expect(page.getByTestId("template-preview-subject")).toHaveText("Nhắc: Công ty TNHH ABC");

    // Chèn biến vào nội dung (đang soạn trong trình soạn thảo).
    await typeInBody(page, "Còn ");
    await page.getByRole("button", { name: "{số ngày còn lại}" }).click();
    await page.keyboard.type(" ngày");
    const preview = page.getByTestId("template-preview-body");
    await expect(preview).toContainText("Còn 7 ngày");

    // Đậm + nghiêng cho cả dòng.
    const bodyToolbar = page.getByTestId("body-editor");
    await page.keyboard.press("Control+A");
    await bodyToolbar.getByRole("button", { name: "Đậm", exact: true }).click();
    await bodyToolbar.getByRole("button", { name: "Nghiêng", exact: true }).click();
    await expect(preview.locator("strong em, em strong").first()).toContainText("Còn 7 ngày");

    // Màu chữ đỏ và tô nền vàng. Trình duyệt chuẩn hoá hex nhập vào thành
    // rgb(...) trong DOM (ProseMirror đọc lại style qua DOM), nên mẫu đã lưu
    // và bản xem trước mang màu dạng rgb — sanitizer backend vẫn giữ nguyên vì
    // rgb(...) nằm trong danh sách màu an toàn.
    await bodyToolbar.getByRole("button", { name: "Màu chữ", exact: true }).click();
    await page.getByTestId("text-color-dc2626").click();
    await expect(preview.locator("span[style*='color: rgb(220, 38, 38)']").first()).toBeVisible();
    await bodyToolbar.getByRole("button", { name: "Tô nền", exact: true }).click();
    await page.getByTestId("bg-color-fef08a").click();
    await expect(preview.locator("span[style*='background-color: rgb(254, 240, 138)']").first()).toBeVisible();

    // Bản chữ thuần suy ra từ HTML không còn thẻ.
    await page.getByText("Bản chữ thuần").click();
    await expect(page.getByTestId("template-preview-text")).toContainText("Còn 7 ngày");

    // Biến lạ: báo lỗi, không lưu được.
    await typeInBody(page, "Lỗi {biến_lạ}");
    await expect(page.getByText(/biến không hợp lệ/).first()).toBeVisible();
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(page.getByText(/biến không hợp lệ/).first()).toBeVisible();

    // Soạn lại, có định dạng, rồi lưu.
    await typeInBody(page, "Kính gửi ");
    await bodyToolbar.getByRole("button", { name: "Đậm", exact: true }).click();
    await page.getByRole("button", { name: "{tên khách}" }).click();
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(page.getByText("Đã lưu mẫu email nhắc hết hạn.")).toBeVisible();

    // Tải lại: nội dung và định dạng đậm của biến vẫn còn.
    await page.reload();
    await page.getByRole("button", { name: "Mẫu email", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Nội dung", exact: true });
    await expect(editor).toContainText("Kính gửi {tên khách}");
    await expect(editor.locator("strong")).toContainText("{tên khách}");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByText("Đã khôi phục mẫu mặc định.")).toBeVisible();
    await expect(page.getByLabel("Tiêu đề")).toHaveValue(/\[VNPT NSG\]/);
    await expect(page.getByRole("textbox", { name: "Nội dung", exact: true })).toContainText("Dịch vụ: {dịch vụ}");
  });

  test("chèn liên kết: địa chỉ hợp lệ thành thẻ a, javascript: bị từ chối", async ({ page }) => {
    await loginAs(page, "admin");
    await openTemplateTab(page);

    await typeInBody(page, "Xem tại ");
    await page.getByTestId("body-editor").getByRole("button", { name: "Chèn liên kết" }).click();
    await page.getByLabel("Địa chỉ liên kết").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Áp dụng" }).click();
    await expect(page.getByText(/Chỉ hỗ trợ liên kết http, https hoặc mailto/)).toBeVisible();

    await page.getByLabel("Địa chỉ liên kết").fill("vnpt.vn/hotro");
    await page.getByRole("button", { name: "Áp dụng" }).click();
    const link = page.getByTestId("template-preview-body").locator("a");
    await expect(link).toHaveAttribute("href", "https://vnpt.vn/hotro");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });
});
