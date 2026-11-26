import { expect, test } from "@playwright/test";
import { ADMIN, API_URL, apiLogin, bearer, createCustomerForOrder } from "./helpers";

test.describe("API Báo giá (POST /api/customers/:id/quote/preview, /confirm, GET /file, /exports)", () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
  });

  const sampleQuoteInput = {
    serviceType: "Dịch vụ Internet cáp quang",
    packageName: "Gói FiberVNN 100Mbps",
    unit: "Gói/tháng",
    quantity: 2,
    unitPrice: 500000,
    vatPercent: 10,
    note: "E2E test",
  };

  test("preview trả về nội dung đã tính thành tiền, không cấp số", async ({ request }) => {
    const customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Báo giá ${Date.now()}`,
      identityCode: "0312345678",
    });

    const res = await request.post(`${API_URL}/customers/${customer.id}/quote/preview`, {
      headers: bearer(adminToken),
      data: sampleQuoteInput,
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()).data;
    expect(body.lines.join("\n")).toContain(customer.name);
    expect(body.lines.join("\n")).toContain("1.000.000");
    expect(body.lines.join("\n")).not.toContain("${");

    const exportsRes = await request.get(`${API_URL}/customers/${customer.id}/quote/exports`, {
      headers: bearer(adminToken),
    });
    expect((await exportsRes.json()).data).toHaveLength(0);
  });

  test("confirm cấp số báo giá tuần tự rồi tải được file docx", async ({ request }) => {
    const customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Báo giá Confirm ${Date.now()}`,
      identityCode: "0312345679",
    });

    const first = await request.post(`${API_URL}/customers/${customer.id}/quote/confirm`, {
      headers: bearer(adminToken),
      data: sampleQuoteInput,
    });
    expect(first.status()).toBe(201);
    const firstRecord = (await first.json()).data;
    expect(firstRecord.reused).toBe(false);

    const second = await request.post(`${API_URL}/customers/${customer.id}/quote/confirm`, {
      headers: bearer(adminToken),
      data: sampleQuoteInput,
    });
    expect(second.status()).toBe(201);
    const secondRecord = (await second.json()).data;
    expect(Number(secondRecord.docNumber)).toBe(Number(firstRecord.docNumber) + 1);

    const fileRes = await request.get(
      `${API_URL}/customers/${customer.id}/quote/file?exportId=${firstRecord.id}&format=docx`,
      { headers: bearer(adminToken) }
    );
    expect(fileRes.status()).toBe(200);
    expect(fileRes.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    const exportsRes = await request.get(`${API_URL}/customers/${customer.id}/quote/exports`, {
      headers: bearer(adminToken),
    });
    const list = (await exportsRes.json()).data;
    expect(list).toHaveLength(2);
  });

  test("confirm với khách hàng không tồn tại trả lỗi 400", async ({ request }) => {
    const res = await request.post(`${API_URL}/customers/CUS-KHONG-TON-TAI/quote/confirm`, {
      headers: bearer(adminToken),
      data: sampleQuoteInput,
    });
    expect(res.status()).toBe(400);
  });
});
