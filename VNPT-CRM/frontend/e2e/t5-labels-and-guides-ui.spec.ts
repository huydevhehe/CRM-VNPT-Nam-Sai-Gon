import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { ADMIN, API_URL, apiLogin, bearer } from "./api/helpers";

function parseMoney(text: string): number {
  return Number(text.replace(/[^\d-]/g, ""));
}

test.describe("Nhãn hoa hồng, hướng dẫn KPI, giải thích trang Dịch vụ", () => {
  test("Hoa hồng: nhãn Hoa hồng nhận / Đã chi / Còn lại, nhãn trạng thái chi khớp số liệu, thẻ tổng là số thật", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/commissions");
    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });

    const headers = page.locator("table thead th");
    await expect(headers.filter({ hasText: "Hoa hồng nhận" })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Đã chi$/ })).toHaveCount(1);
    await expect(headers.filter({ hasText: "Còn lại" })).toHaveCount(1);
    await expect(headers.filter({ hasText: "Hoa hồng phải chi" })).toHaveCount(0);
    await expect(page.getByTestId("commission-legend")).toContainText("Còn lại = Hoa hồng nhận − Đã chi");

    // Mỗi dòng: nhãn trạng thái chi đúng theo số liệu, Còn lại = nhận − đã chi
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    let sumReceived = 0;
    let sumPaid = 0;
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator("td");
      // Cột: 5 Hoa hồng nhận, 6 Đã chi, 7 Còn lại
      const received = parseMoney(await cells.nth(5).locator("span").first().innerText());
      const paid = parseMoney(await cells.nth(6).locator("span").first().innerText());
      const remaining = parseMoney(await cells.nth(7).locator("span").first().innerText());
      expect(remaining).toBe(received - paid);
      const expectedState = paid <= 0 ? "none" : paid >= received ? "full" : "partial";
      await expect(cells.nth(6).getByTestId("commission-payout-state")).toHaveAttribute(
        "data-state",
        expectedState
      );
      sumReceived += received;
      sumPaid += paid;
    }

    // Thẻ tổng cộng đúng từ bảng (không còn số cứng "86,5 tr ₫")
    const cards = page.getByTestId("commission-kpi-cards");
    await expect(cards).toContainText(`${sumReceived.toLocaleString("vi-VN")} ₫`);
    await expect(cards).toContainText(`${sumPaid.toLocaleString("vi-VN")} ₫`);
    await expect(cards).toContainText(`${(sumReceived - sumPaid).toLocaleString("vi-VN")} ₫`);
    await expect(cards).not.toContainText("86,5 tr");
  });

  test("Cấu hình KPI: có khối Hướng dẫn sử dụng, thu gọn/mở rộng được, nêu đủ 4 chỉ tiêu và ngưỡng đang áp dụng", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/kpi-settings");

    const guide = page.getByTestId("kpi-guide");
    await expect(guide).toBeVisible({ timeout: 15_000 });
    await expect(guide).toContainText("Hướng dẫn sử dụng");
    await expect(guide).toContainText("Điểm = a × TL + b");
    for (const key of ["thu_ngay", "ghtt_t", "ghtt_t1", "thu_luy_ke"]) {
      await expect(page.getByTestId(`kpi-guide-row-${key}`)).toBeVisible();
    }
    // Ngưỡng mặc định của thu ngay: 98% ≤ TL < 100% → 150 × TL − 146
    await expect(page.getByTestId("kpi-guide-thresholds-thu_ngay")).toContainText("150 × TL − 146");
    await expect(page.getByTestId("kpi-guide-row-thu_luy_ke")).toContainText("Cần xác nhận");

    await page.getByTestId("kpi-guide-toggle").click();
    await expect(page.getByTestId("kpi-guide-row-thu_ngay")).toHaveCount(0);
    await page.getByTestId("kpi-guide-toggle").click();
    await expect(page.getByTestId("kpi-guide-row-thu_ngay")).toBeVisible();
  });

  test("Dịch vụ & Cảnh báo: có khung giới thiệu, thẻ số thật khớp danh sách, nút cấu hình mốc đi tới /admin/reminders", async ({
    page,
    request,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/services");

    await expect(page.getByTestId("services-intro")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("services-intro")).toContainText("Dữ liệu lấy từ đâu");
    await expect(page.getByTestId("services-intro")).toContainText("Tạo việc");

    // Không còn số cứng
    const cards = page.getByTestId("services-kpi-cards");
    await expect(cards).not.toContainText("2.816");
    await expect(cards).not.toContainText("EMAIL CẢNH BÁO");

    // Bốn thẻ khớp số đếm từ API dịch vụ
    const token = await apiLogin(request, ADMIN.username, ADMIN.password);
    const res = await request.get(`${API_URL}/services`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const services: Array<{ isExpired: boolean; daysRemaining: number }> = (await res.json()).data;
    const active = services.filter((x) => !x.isExpired);
    const expected: Record<string, number> = {
      "DỊCH VỤ CÒN HẠN": active.length,
      "SẮP HẾT HẠN (30 NGÀY)": active.filter((x) => x.daysRemaining <= 30).length,
      "SẮP HẾT HẠN (7 NGÀY)": active.filter((x) => x.daysRemaining <= 7).length,
      "ĐÃ QUÁ HẠN": services.filter((x) => x.isExpired).length,
    };
    for (const [title, value] of Object.entries(expected)) {
      const card = cards.locator("> div").filter({ hasText: title });
      await expect(card).toHaveCount(1);
      await expect(card.locator("span.text-2xl")).toHaveText(value.toLocaleString("vi-VN"));
    }

    // Nút giả (alert) đã đổi thành liên kết thật
    const link = page.getByTestId("services-reminder-config-link");
    await expect(link).toHaveAttribute("href", "/admin/reminders");
    await link.click();
    await page.waitForURL("**/admin/reminders", { timeout: 15_000 });
  });

  test("Dịch vụ & Cảnh báo: AM thấy khung giới thiệu, không thấy nút cấu hình mốc cảnh báo", async ({ page }) => {
    await loginAs(page, "am");
    await page.goto("/admin/services");
    await expect(page.getByTestId("services-intro")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("services-reminder-config-link")).toHaveCount(0);
  });
});
