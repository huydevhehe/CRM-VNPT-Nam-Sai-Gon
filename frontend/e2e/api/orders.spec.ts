import { test, expect } from "@playwright/test";
import { ADMIN, API_URL, apiLogin, bearer, createCustomerForOrder, type TestCustomer } from "./helpers";

test.describe("Orders API (Đơn hàng)", () => {
  test.describe.configure({ mode: "serial" });

  let adminToken: string;
  let amKhoaToken: string;
  let amTuanToken: string;
  let amKhoaName: string;
  let customer: TestCustomer;

  test.beforeAll(async ({ request }) => {
    // 1. Login as admin
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    customer = await createCustomerForOrder(request, adminToken, {
      name: `KH Đơn Hàng E2E ${Date.now()}`,
      identityCode: "0319653211",
    });

    // 2. Ensure staff AM Khoa and AM Tuấn exist
    const suffix = Date.now();
    amKhoaName = `Vũ Tiến Khoa ${suffix}`;
    const tuanName = `Trần Văn Tuấn ${suffix}`;

    await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code: `KHOA_${suffix}`,
        name: amKhoaName,
        role: "AM",
        password: "Password@12345",
      },
    });

    await request.post(`${API_URL}/staff`, {
      headers: bearer(adminToken),
      data: {
        code: `TUAN_${suffix}`,
        name: tuanName,
        role: "AM",
        password: "Password@12345",
      },
    });

    // Login AM Khoa & Tuấn
    amKhoaToken = await apiLogin(request, `KHOA_${suffix}`, "Password@12345");
    amTuanToken = await apiLogin(request, `TUAN_${suffix}`, "Password@12345");
  });

  test("create order with full fields and get in list", async ({ request }) => {
    const suffix = Date.now();
    const createRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_TEST_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_${suffix}`],
        totalValue: 5940000,
        channel: "Trực tiếp",
        serviceGroup: "BRCĐ",
        serviceName: "FiberVNN",
        packageName: "Home Net 2",
        paymentMethod: "Trả trước",
        contractNumber: `20261113/0319653211/VNPT.NSG/VNPT026696`,
        signedDate: "2026-11-13",
      },
    });

    expect(createRes.status()).toBe(201);
    const createdJson = await createRes.json();
    expect(createdJson.data.serviceGroup).toBe("BRCĐ");
    expect(createdJson.data.paymentMethod).toBe("Trả trước");
    expect(createdJson.data.contractNumber).toBe(`20261113/0319653211/VNPT.NSG/VNPT026696`);

    // Verify GET /contracts contains it
    const listRes = await request.get(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
    });
    expect(listRes.status()).toBe(200);
    const listJson = await listRes.json();
    const found = listJson.data.find((c: any) => c.transactionCode === `GD_TEST_${suffix}`);
    expect(found).toBeDefined();
    expect(found.serviceGroup).toBe("BRCĐ");
    expect(found.packageName).toBe("Home Net 2");
  });

  test("AM cannot update order belonging to another AM (403)", async ({ request }) => {
    const suffix = Date.now();
    // Admin creates order assigned to AM Khoa
    const createRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_KHOA_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_KHOA_${suffix}`],
        totalValue: 2000000,
        channel: "Trực tiếp",
        amStaff: amKhoaName,
        serviceGroup: "CNTT",
        paymentMethod: "Trả trước",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()).data;

    // AM Tuấn tries to edit Khoa's order -> 403
    const updateRes = await request.patch(`${API_URL}/contracts/${created.id}`, {
      headers: bearer(amTuanToken),
      data: {
        packageName: "Gói Lạ",
      },
    });
    expect(updateRes.status()).toBe(403);
    const errJson = await updateRes.json();
    expect(errJson.message).toBe("Không có quyền chỉnh sửa đơn hàng này");
  });

  test("Admin or assigned AM can update order (200)", async ({ request }) => {
    const suffix = Date.now();
    const createRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_EDIT_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_EDIT_${suffix}`],
        totalValue: 3000000,
        channel: "Trực tiếp",
        amStaff: amKhoaName,
        serviceGroup: "Di động",
        paymentMethod: "Trả hàng tháng",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()).data;

    // Assigned AM Khoa updates package
    const updateRes = await request.patch(`${API_URL}/contracts/${created.id}`, {
      headers: bearer(amKhoaToken),
      data: {
        packageName: "Gói Doanh Nghiệp VIP",
        paymentMethod: "Trả trước",
      },
    });
    expect(updateRes.status()).toBe(200);
    const updated = (await updateRes.json()).data;
    expect(updated.packageName).toBe("Gói Doanh Nghiệp VIP");
    expect(updated.paymentMethod).toBe("Trả trước");
  });

  test("export payment request docx produces valid docx file and logs export", async ({ request }) => {
    const suffix = Date.now();
    const createRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_EXPORT_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_EXP_${suffix}`],
        totalValue: 5940000,
        channel: "Trực tiếp",
        serviceGroup: "CNTT",
        packageName: "eduOffice",
        paymentMethod: "Trả trước",
      },
    });
    expect(createRes.status()).toBe(201);
    const order = (await createRes.json()).data;

    // Missing docNumber -> 400
    const errRes = await request.get(`${API_URL}/contracts/${order.id}/payment-request`, {
      headers: bearer(adminToken),
    });
    expect(errRes.status()).toBe(400);

    // Preview
    const previewRes = await request.get(`${API_URL}/contracts/${order.id}/payment-request/preview`, {
      headers: bearer(adminToken),
    });
    expect(previewRes.status()).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.data.missingFields).toBeDefined();

    // Export with docNumber=706
    const exportRes = await request.get(`${API_URL}/contracts/${order.id}/payment-request?docNumber=706`, {
      headers: bearer(adminToken),
    });
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()["content-type"]).toContain("officedocument.wordprocessingml.document");
    expect(exportRes.headers()["content-disposition"]).toContain(`De-nghi-thanh-toan_${order.transactionCode}.docx`);

    const bodyBuffer = await exportRes.body();
    // Docx file starts with PK (0x50 0x4B)
    expect(bodyBuffer[0]).toBe(0x50);
    expect(bodyBuffer[1]).toBe(0x4B);

    // Verify logs
    const logsRes = await request.get(`${API_URL}/contracts/payment-requests`, {
      headers: bearer(adminToken),
    });
    expect(logsRes.status()).toBe(200);
    const logsJson = await logsRes.json();
    const foundLog = logsJson.data.find((l: any) => l.contractId === order.id && l.docNumber === "706");
    expect(foundLog).toBeDefined();
  });
  test("create order requires a customer from the system", async ({ request }) => {
    const suffix = Date.now();
    const base = {
      subscriberCodes: [`TB_REQ_${suffix}`],
      totalValue: 1000000,
      channel: "Trực tiếp",
    };

    const missing = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: { ...base, transactionCode: `GD_NOCUST_${suffix}`, customerName: "Chỉ có tên tự do" },
    });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).message).toContain("Vui lòng chọn Khách hàng");

    const unknown = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: { ...base, transactionCode: `GD_BADCUST_${suffix}`, customerId: `KH-KHONG-CO-${suffix}` },
    });
    expect(unknown.status()).toBe(400);
    expect((await unknown.json()).message).toBe("Khách hàng không tồn tại");
  });

  test("create order takes customer name and tax code from the selected customer", async ({ request }) => {
    const suffix = Date.now();
    const res = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_DERIVE_${suffix}`,
        customerId: customer.id,
        customerName: "Tên nhập tay phải bị bỏ qua",
        subscriberCodes: [`TB_DER_${suffix}`],
        totalValue: 1000000,
        channel: "Trực tiếp",
      },
    });
    expect(res.status()).toBe(201);
    const order = (await res.json()).data;
    expect(order.customerId).toBe(customer.id);
    expect(order.customerName).toBe(customer.name);
    expect(order.taxCode).toBe("0319653211");
  });

  test("AM can only create orders for customers they manage", async ({ request }) => {
    const suffix = Date.now();
    const own = await createCustomerForOrder(request, adminToken, {
      name: `KH Của Khoa ${suffix}`,
      amStaff: amKhoaName,
      amCaringStaff: amKhoaName,
    });
    const orderBody = (customerId: string, code: string) => ({
      transactionCode: code,
      customerId,
      amStaff: amKhoaName,
      subscriberCodes: [`TB_SC_${suffix}`],
      totalValue: 1000000,
      channel: "Trực tiếp",
    });

    const outside = await request.post(`${API_URL}/contracts`, {
      headers: bearer(amKhoaToken),
      data: orderBody(customer.id, `GD_OUT_${suffix}`),
    });
    expect(outside.status()).toBe(400);
    expect((await outside.json()).message).toContain("khách hàng mình đang phụ trách");

    const inside = await request.post(`${API_URL}/contracts`, {
      headers: bearer(amKhoaToken),
      data: orderBody(own.id, `GD_IN_${suffix}`),
    });
    expect(inside.status()).toBe(201);
    expect((await inside.json()).data.customerId).toBe(own.id);
  });

  test("editing an order cannot remove its customer", async ({ request }) => {
    const suffix = Date.now();
    const createRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode: `GD_KEEP_${suffix}`,
        customerId: customer.id,
        subscriberCodes: [`TB_KEEP_${suffix}`],
        totalValue: 1000000,
        channel: "Trực tiếp",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()).data;

    const clearRes = await request.patch(`${API_URL}/contracts/${created.id}`, {
      headers: bearer(adminToken),
      data: { customerId: "" },
    });
    expect(clearRes.status()).toBe(400);
    expect((await clearRes.json()).message).toContain("Vui lòng chọn Khách hàng");

    const keepRes = await request.patch(`${API_URL}/contracts/${created.id}`, {
      headers: bearer(adminToken),
      data: { packageName: "Gói giữ khách" },
    });
    expect(keepRes.status()).toBe(200);
    expect((await keepRes.json()).data.customerId).toBe(customer.id);
  });

});
