import { test, expect, type APIRequestContext } from "@playwright/test";
import { ADMIN, API_URL, apiLogin, bearer, createCustomerForOrder, getDefaultAmName, type TestCustomer } from "./helpers";
import { loginAs } from "../fixtures/auth";

/** Xem trước bản in PDF của Hợp đồng trước khi tải (giống cơ chế Đề nghị thanh toán). */
test.describe("Hợp đồng: xem trước bản in PDF (API)", () => {
  let adminToken: string;
  let customer: TestCustomer;
  let defaultAm: string;
  const suffix = Date.now();

  async function createOrder(request: APIRequestContext, code: string) {
    const res = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `${code}_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_${code}_${suffix}`],
        totalValue: 5940000,
        channel: "Trực tiếp",
        amStaff: defaultAm,
        packageName: "Gói test",
        contractTemplate: "cks_token_smartca_dn",
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data;
  }

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    defaultAm = await getDefaultAmName(request, adminToken);
    customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Xem truoc HD ${suffix}`,
      identityCode: "0319653299",
    });
  });

  test("preview trả về pdfAvailable; preview-file trả PDF khi có LibreOffice, 501 khi không", async ({ request }) => {
    const order = await createOrder(request, "HD_PDFPV");

    const pv = await request.get(`${API_URL}/contracts/${order.id}/contract-export/preview`, {
      headers: bearer(adminToken),
    });
    expect(pv.status()).toBe(200);
    const previewBody = await pv.json();
    expect(typeof previewBody.data.pdfAvailable).toBe("boolean");

    const res = await request.get(`${API_URL}/contracts/${order.id}/contract-export/preview-file`, {
      headers: bearer(adminToken),
    });
    if (previewBody.data.pdfAvailable) {
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/pdf");
      expect(res.headers()["content-disposition"]).toContain("inline");
      expect((await res.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
    } else {
      expect(res.status()).toBe(501);
    }
  });

  test("preview-file của đơn không tồn tại trả 404", async ({ request }) => {
    const res = await request.get(`${API_URL}/contracts/khong-ton-tai/contract-export/preview-file`, {
      headers: bearer(adminToken),
    });
    expect(res.status()).toBe(404);
  });

  test("UI: bấm nút Hợp đồng mở modal xem trước (PDF hoặc chữ), có nút tải Word/PDF", async ({ page, request }) => {
    const order = await createOrder(request, "HD_UIPV");

    await loginAs(page, "admin");
    await page.goto("/admin/contracts");
    await page.getByPlaceholder("Tìm theo mã giao dịch, khách hàng, AM, mã thuê bao...").fill(order.transactionCode);

    const row = page.locator("table tbody tr", { hasText: order.transactionCode });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Hợp đồng" }).click();

    const modal = page.getByTestId("contract-preview-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Xem trước hợp đồng")).toBeVisible();

    // Hoặc hiện iframe PDF (có LibreOffice), hoặc hiện nội dung dạng chữ (không có LibreOffice).
    await expect(modal.getByTestId("contract-pdf-frame").or(modal.getByTestId("contract-preview-lines"))).toBeVisible({
      timeout: 15_000,
    });

    await expect(modal.getByTestId("contract-download-docx")).toBeEnabled();

    await modal.getByLabel("Đóng").click();
    await expect(modal).not.toBeVisible();
  });
});
