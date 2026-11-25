import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  ADMIN,
  API_URL,
  apiLogin,
  bearer,
  createCustomerForOrder,
  getDefaultAmName,
  type TestCustomer,
} from "./helpers";

/**
 * Đơn hàng: hình thức thanh toán (trả trước theo tháng), AM phát triển bắt buộc,
 * đề nghị thanh toán (xem trước không tiêu số, xác nhận mới lấy số, DOCX/PDF cùng một số).
 */
test.describe("Đơn hàng: sửa nhanh + đề nghị thanh toán (API)", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amToken: string;
  let otherAmToken: string;
  let amName: string;
  let customer: TestCustomer;
  let defaultAm: string;
  const suffix = Date.now();

  async function createOrder(request: APIRequestContext, code: string, extra: Record<string, unknown> = {}) {
    return request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `${code}_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_${code}_${suffix}`],
        totalValue: 5940000,
        channel: "Trực tiếp",
        amStaff: defaultAm,
        packageName: "Gói test",
        ...extra,
      },
    });
  }

  async function newStaffToken(request: APIRequestContext, tag: string): Promise<{ token: string; name: string }> {
    const code = `${tag}_${suffix}`;
    const name = `AM ${tag} ${suffix}`;
    const res = await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: { code, name, role: "AM", password: "Password@12345" },
    });
    expect(res.status()).toBe(201);
    return { token: await apiLogin(request, code, "Password@12345"), name };
  }

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    defaultAm = await getDefaultAmName(request, adminToken);
    customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Sửa nhanh ${suffix}`,
      identityCode: "0319653211",
    });
    const a = await newStaffToken(request, "SN_A");
    amToken = a.token;
    amName = a.name;
    otherAmToken = (await newStaffToken(request, "SN_B")).token;
  });

  test("Trả trước bắt buộc số tháng 3/6/12/18/24; hình thức khác xóa số tháng", async ({ request }) => {
    const missing = await createOrder(request, "PRE_NO", { paymentMethod: "Trả trước" });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).message).toContain("phải chọn số tháng trả trước");

    for (const bad of [5, 36, 0]) {
      const res = await createOrder(request, `PRE_BAD${bad}`, { paymentMethod: "Trả trước", prepaidMonths: bad });
      expect(res.status(), `prepaidMonths=${bad}`).toBe(400);
    }

    for (const months of [3, 6, 12, 18, 24]) {
      const ok = await createOrder(request, `PRE_${months}`, { paymentMethod: "Trả trước", prepaidMonths: months });
      expect(ok.status()).toBe(201);
      const data = (await ok.json()).data;
      expect(data.prepaidMonths).toBe(months);
    }

    const monthly = await createOrder(request, "PRE_MONTHLY", { paymentMethod: "Trả hàng tháng", prepaidMonths: 12 });
    expect(monthly.status()).toBe(201);
    expect((await monthly.json()).data.prepaidMonths).toBeNull();

    const byContract = await createOrder(request, "PRE_HD", { paymentMethod: "Theo giá trị hợp đồng" });
    expect(byContract.status()).toBe(201);
    const bc = (await byContract.json()).data;
    expect(bc.paymentMethod).toBe("Theo giá trị hợp đồng");
    expect(bc.prepaidMonths).toBeNull();

    // Sửa: đổi sang Trả trước phải kèm số tháng, rồi đổi lại thì xóa số tháng.
    const patchNoMonths = await request.patch(`${API_URL}/contracts/${bc.id}`, {
      headers: bearer(adminToken),
      data: { paymentMethod: "Trả trước" },
    });
    expect(patchNoMonths.status()).toBe(400);
    const patchOk = await request.patch(`${API_URL}/contracts/${bc.id}`, {
      headers: bearer(adminToken),
      data: { paymentMethod: "Trả trước", prepaidMonths: 12 },
    });
    expect(patchOk.status()).toBe(200);
    expect((await patchOk.json()).data.prepaidMonths).toBe(12);
    const patchBack = await request.patch(`${API_URL}/contracts/${bc.id}`, {
      headers: bearer(adminToken),
      data: { paymentMethod: "Theo giá trị hợp đồng" },
    });
    expect((await patchBack.json()).data.prepaidMonths).toBeNull();
  });

  test("AM phát triển bắt buộc khi tạo đơn; AM tự động là chính mình", async ({ request }) => {
    const none = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `NOAM_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_NOAM_${suffix}`],
        totalValue: 1000,
        channel: "Trực tiếp",
      },
    });
    expect(none.status()).toBe(400);
    expect((await none.json()).message).toBe("Vui lòng chọn AM phát triển");

    const unknown = await createOrder(request, "AM_UNKNOWN", { amStaff: "Người không tồn tại" });
    expect(unknown.status()).toBe(400);
    expect((await unknown.json()).message).toBe("Nhân viên AM không tồn tại");

    // AM tạo đơn không truyền AM: hệ thống ép về chính AM đó.
    const own = await request.post(`${API_URL}/contracts`, {
      headers: bearer(amToken),
      data: {
        transactionCode: `OWNAM_${suffix}`,
        customerId: (
          await createCustomerForOrder(request, adminToken, { name: `KH AM tự tạo ${suffix}`, amStaff: amName })
        ).id,
        subscriberCodes: [`TB_OWNAM_${suffix}`],
        totalValue: 1000,
        channel: "Trực tiếp",
      },
    });
    expect(own.status()).toBe(201);
    expect((await own.json()).data.amStaff).toBe(amName);
  });

  test("Đơn không còn bắt buộc Phường", async ({ request }) => {
    const res = await createOrder(request, "NO_WARD");
    expect(res.status()).toBe(201);
    expect((await res.json()).data.territoryId ?? null).toBeNull();
  });

  test("Đề nghị thanh toán: cần đăng nhập, AM khác bị chặn", async ({ request }) => {
    const created = await createOrder(request, "PR_AUTH", { amStaff: amName });
    expect(created.status()).toBe(201);
    const order = (await created.json()).data;
    const base = `${API_URL}/contracts/${order.id}/payment-request`;

    for (const path of ["/preview", "/preview-file", "/file?exportId=x"]) {
      expect((await request.get(`${base}${path}`)).status(), `GET ${path} không token`).toBe(401);
    }
    expect((await request.post(`${base}/confirm`, { data: {} })).status()).toBe(401);

    for (const path of ["/preview", "/file?exportId=x"]) {
      expect((await request.get(`${base}${path}`, { headers: bearer(otherAmToken) })).status(), `GET ${path} AM khác`).toBe(403);
    }
    const otherConfirm = await request.post(`${base}/confirm`, { headers: bearer(otherAmToken), data: {} });
    expect(otherConfirm.status()).toBe(403);

    // AM phụ trách xem trước được.
    expect((await request.get(`${base}/preview`, { headers: bearer(amToken) })).status()).toBe(200);
    // Chưa xác nhận thì không có số nào được lưu cho đơn này.
    const logs = await request.get(`${API_URL}/contracts/payment-requests`, { headers: bearer(adminToken) });
    expect((await logs.json()).data.some((l: { contractId: string }) => l.contractId === order.id)).toBe(false);
  });

  test("Xem trước không tiêu số; xác nhận mới cấp số; DOCX và PDF cùng một số", async ({ request }) => {
    const a = (await (await createOrder(request, "PR_A", { paymentMethod: "Trả trước", prepaidMonths: 12 })).json()).data;
    const b = (await (await createOrder(request, "PR_B")).json()).data;

    const previewOf = async (id: string, query = "") => {
      const res = await request.get(`${API_URL}/contracts/${id}/payment-request/preview${query}`, {
        headers: bearer(adminToken),
      });
      expect(res.status()).toBe(200);
      return (await res.json()).data;
    };

    // Xem trước nhiều lần: số gợi ý không đổi, không có số nào bị cấp.
    const p1 = await previewOf(a.id);
    const p2 = await previewOf(a.id);
    const p3 = await previewOf(b.id);
    expect(p2.suggestedDocNumber).toBe(p1.suggestedDocNumber);
    expect(p3.suggestedDocNumber).toBe(p1.suggestedDocNumber);
    expect(p1.latestExport).toBeNull();
    expect(Array.isArray(p1.lines)).toBe(true);
    expect(p1.lines.join("\n")).toContain("Trả trước 12 tháng");
    expect(typeof p1.pdfAvailable).toBe("boolean");

    const typed = await previewOf(a.id, "?docNumber=9876");
    expect(typed.lines.join("\n")).toContain("9876");

    // Hai người xác nhận liên tiếp: số liên tiếp, không trùng.
    const c1 = await request.post(`${API_URL}/contracts/${a.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: {},
    });
    expect(c1.status()).toBe(201);
    const r1 = (await c1.json()).data;
    const c2 = await request.post(`${API_URL}/contracts/${b.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: {},
    });
    expect(c2.status()).toBe(201);
    const r2 = (await c2.json()).data;
    expect(Number(r2.docNumber)).toBe(Number(r1.docNumber) + 1);
    if (p1.suggestedDocNumber) expect(r1.docNumber).toBe(p1.suggestedDocNumber);

    // Sau khi cấp số, xem trước báo lần gần nhất và gợi ý số kế tiếp.
    const after = await previewOf(a.id);
    expect(after.latestExport.docNumber).toBe(r1.docNumber);
    expect(Number(after.suggestedDocNumber)).toBe(Number(r2.docNumber) + 1);

    // Xác nhận lại cùng đơn với reuseLatest: giữ số cũ.
    const again = await request.post(`${API_URL}/contracts/${a.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: { reuseLatest: true },
    });
    expect(again.status()).toBe(200);
    expect((await again.json()).data.docNumber).toBe(r1.docNumber);

    // DOCX
    const fileUrl = `${API_URL}/contracts/${a.id}/payment-request/file?exportId=${r1.id}`;
    const docx = await request.get(`${fileUrl}&format=docx`, { headers: bearer(adminToken) });
    expect(docx.status()).toBe(200);
    expect(docx.headers()["content-type"]).toContain("wordprocessingml.document");
    expect(docx.headers()["content-disposition"]).toContain(`De-nghi-thanh-toan_${a.transactionCode}.docx`);
    const docxBody = await docx.body();
    expect(docxBody[0]).toBe(0x50);
    expect(docxBody[1]).toBe(0x4b);

    // PDF: có LibreOffice thì %PDF, không có thì 501 với thông điệp rõ ràng.
    const pdf = await request.get(`${fileUrl}&format=pdf`, { headers: bearer(adminToken) });
    if (p1.pdfAvailable) {
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
      expect((await pdf.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
    } else {
      expect(pdf.status()).toBe(501);
      expect((await pdf.json()).message).toContain("LibreOffice");
    }

    // Số văn bản không đổi sau khi tải DOCX/PDF.
    const final = await previewOf(a.id);
    expect(final.latestExport.docNumber).toBe(r1.docNumber);

    // Sai định dạng / thiếu exportId / exportId của đơn khác.
    expect((await request.get(`${fileUrl}&format=xls`, { headers: bearer(adminToken) })).status()).toBe(400);
    expect(
      (await request.get(`${API_URL}/contracts/${a.id}/payment-request/file`, { headers: bearer(adminToken) })).status()
    ).toBe(400);
    expect(
      (await request.get(`${API_URL}/contracts/${b.id}/payment-request/file?exportId=${r1.id}`, { headers: bearer(adminToken) })).status()
    ).toBe(404);
  });

  test("Xem trước bản in PDF không cấp số", async ({ request }) => {
    const order = (await (await createOrder(request, "PR_PDFPV")).json()).data;
    const pv = await request.get(`${API_URL}/contracts/${order.id}/payment-request/preview`, {
      headers: bearer(adminToken),
    });
    const { pdfAvailable } = (await pv.json()).data;
    const res = await request.get(`${API_URL}/contracts/${order.id}/payment-request/preview-file`, {
      headers: bearer(adminToken),
    });
    if (pdfAvailable) {
      expect(res.status()).toBe(200);
      expect((await res.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
    } else {
      expect(res.status()).toBe(501);
    }
    const after = await request.get(`${API_URL}/contracts/${order.id}/payment-request/preview`, {
      headers: bearer(adminToken),
    });
    expect((await after.json()).data.latestExport).toBeNull();
  });

  test("Nhập tay số văn bản: trùng số bị 409, sai định dạng bị 400", async ({ request }) => {
    const a = (await (await createOrder(request, "PR_M1")).json()).data;
    const b = (await (await createOrder(request, "PR_M2")).json()).data;
    const manual = `M${suffix}`;

    const ok = await request.post(`${API_URL}/contracts/${a.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: { docNumber: manual },
    });
    expect(ok.status()).toBe(201);
    expect((await ok.json()).data.docNumber).toBe(manual);

    const dup = await request.post(`${API_URL}/contracts/${b.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: { docNumber: manual },
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).message).toContain("đã được cấp");

    const bad = await request.post(`${API_URL}/contracts/${b.id}/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: { docNumber: "<script>" },
    });
    expect(bad.status()).toBe(400);

    const notFound = await request.post(`${API_URL}/contracts/HD-KHONG-CO/payment-request/confirm`, {
      headers: bearer(adminToken),
      data: {},
    });
    expect(notFound.status()).toBe(404);
  });
});
