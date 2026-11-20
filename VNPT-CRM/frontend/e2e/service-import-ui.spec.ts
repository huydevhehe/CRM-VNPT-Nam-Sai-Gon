import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

/**
 * Tạo buffer "giả làm .xlsx" là CSV UTF-8 có BOM — SheetJS tự nhận diện và
 * phân tích như CSV (xem frontend/e2e/api/customer-import.spec.ts).
 */
function buildCsvBuffer(rows: Record<string, string>[], headers: string[]): Buffer {
  const escapeCsv = (value: string) =>
    value.includes(",") || value.includes('"') || value.includes("\n")
      ? `"${value.replace(/"/g, '""')}"`
      : value;

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? "")).join(","));
  }
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(lines.join("\n") + "\n", "utf8")]);
}

const HEADERS = ["Tên khách hàng", "Mã thuê bao", "Tên dịch vụ", "Nhóm dịch vụ", "Ngày bắt đầu", "Ngày kết thúc"];

test.describe("UI Import dịch vụ khách đang dùng", () => {
  test("AM không nhìn thấy nút Nhập dịch vụ (Excel)", async ({ page }) => {
    await loginAs(page, "am");

    await page.goto("/admin/services");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Dịch vụ & Cảnh báo hết hạn/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nhập dịch vụ (Excel)" })).toHaveCount(0);
  });

  test("Admin upload file -> xem tab mới/lỗi -> nhập -> dịch vụ hiện trong danh sách", async ({ page }) => {
    const suffix = Date.now();
    const customerName = `Công ty UI Import Dịch Vụ ${suffix}`;
    const serviceCode = `SUB-UI-${suffix}`;

    await loginAs(page, "admin");

    const token = await page.evaluate(() => window.localStorage.getItem("vnpt_token"));
    const apiBase = process.env.E2E_API_URL || "http://localhost:8099/api";
    const created = await page.request.post(`${apiBase}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: customerName, type: "Doanh nghiệp", customerGroup: "Tập hiện hữu" },
    });
    expect(created.status()).toBe(201);

    await page.goto("/admin/services");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nhập dịch vụ (Excel)" }).click();
    await expect(page.getByText("Nhập dịch vụ khách đang sử dụng (Excel)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tải file mẫu" })).toHaveAttribute(
      "href",
      "/templates/mau-nhap-dich-vu.xlsx"
    );

    const buffer = buildCsvBuffer(
      [
        {
          "Tên khách hàng": customerName,
          "Mã thuê bao": serviceCode,
          "Tên dịch vụ": "FiberVNN",
          "Nhóm dịch vụ": "BRCĐ",
          "Ngày bắt đầu": "2030-01-15",
          "Ngày kết thúc": "2031-01-14",
        },
        {
          "Tên khách hàng": `Công ty Không Tồn Tại ${suffix}`,
          "Mã thuê bao": `SUB-UI-NOCUST-${suffix}`,
          "Tên dịch vụ": "MyTV",
          "Nhóm dịch vụ": "",
          "Ngày bắt đầu": "",
          "Ngày kết thúc": "",
        },
      ],
      HEADERS
    );

    await page.setInputFiles('input[type="file"]', { name: "import.xlsx", mimeType: "text/csv", buffer });
    await page.getByRole("button", { name: "Kiểm tra file" }).click();

    await expect(page.getByRole("button", { name: "Dịch vụ mới (1)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cập nhật (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lỗi (1)" })).toBeVisible();
    await expect(page.getByText(`Khách hàng trong hệ thống: ${customerName}`)).toBeVisible();

    await page.getByRole("button", { name: "Lỗi (1)" }).click();
    await expect(page.getByText("Không tìm thấy khách hàng trong hệ thống")).toBeVisible();

    await page.getByRole("button", { name: "Dịch vụ mới (1)" }).click();
    const submitBtn = page.getByRole("button", { name: "Nhập dữ liệu" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText(/Tạo mới 1, cập nhật 0, bỏ qua 0/)).toBeVisible();
    await page.getByRole("button", { name: "Đóng" }).click();

    await page.getByPlaceholder("Tìm theo tên dịch vụ, khách hàng, mã thuê bao...").fill(serviceCode);
    await expect(page.getByText(serviceCode)).toBeVisible();
    await expect(page.getByText(customerName)).toBeVisible();
  });
});
