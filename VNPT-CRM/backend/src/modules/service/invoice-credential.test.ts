import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, query } = await import("../../database/db.js");
const { CustomerService } = await import("../customer/customer.service.js");
const { ServiceService, ServiceServiceError, isInvoicePortalService } = await import("./service.service.js");
const { encryptInvoicePassword, decryptInvoicePassword, MASKED_PASSWORD } = await import(
  "./invoice-credential-crypto.js"
);

await initDatabase();

// Khóa mã hóa dùng cho test (không phải khóa thật trên server).
process.env.INVOICE_CREDENTIAL_KEY = "khoa-test-chi-dung-cho-unit-test";

async function createTestCustomer(suffix: string | number) {
  const customerService = new CustomerService();
  const result = await customerService.create({
    name: `KH Hóa Đơn ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });
  return result.customer.id as string;
}

test("isInvoicePortalService matches 'Hóa đơn điện tử' regardless of accents/case", () => {
  assert.equal(isInvoicePortalService("Hóa đơn điện tử VNPT Invoice"), true);
  assert.equal(isInvoicePortalService("hoa don dien tu"), true);
  assert.equal(isInvoicePortalService("HÓA ĐƠN ĐIỆN TỬ"), true);
  assert.equal(isInvoicePortalService("Internet Fiber"), false);
  assert.equal(isInvoicePortalService(null), false);
});

test("encrypt/decrypt round-trips and never stores plaintext", () => {
  const enc = encryptInvoicePassword("Mat-khau-that-123!");
  assert.notEqual(enc, "Mat-khau-that-123!");
  assert.ok(enc.split(":").length === 3);
  assert.equal(decryptInvoicePassword(enc), "Mat-khau-that-123!");
});

test("create: invoice credential fields only stored/encrypted for 'Hóa đơn điện tử' services", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  const invoiceService = await serviceService.create({
    customerId,
    serviceGroup: "CNTT",
    serviceName: `Hóa đơn điện tử VNPT Invoice ${suffix}`,
    serviceCode: `INV-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-01-01",
    expirationDate: "2027-12-31",
    invoicePortalUrl: "https://hoadon.vnpt.vn",
    invoicePortalUsername: `user_${suffix}`,
    invoicePortalPassword: "Mat-khau-demo-1",
  });

  assert.equal(invoiceService.isInvoicePortalService, true);
  assert.equal(invoiceService.invoicePortalUrl, "https://hoadon.vnpt.vn");
  assert.equal(invoiceService.invoicePortalUsername, `user_${suffix}`);
  assert.equal(invoiceService.invoicePortalPasswordMasked, MASKED_PASSWORD);

  const [row] = await query<any>("SELECT invoice_portal_password_enc FROM services WHERE id = ?", [
    invoiceService.id,
  ]);
  assert.notEqual(row.invoice_portal_password_enc, "Mat-khau-demo-1");
  assert.equal(decryptInvoicePassword(row.invoice_portal_password_enc), "Mat-khau-demo-1");

  // Dịch vụ không thuộc nhóm hóa đơn: không áp dụng (im lặng bỏ qua, không lưu).
  const otherService = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: `Internet Fiber ${suffix}`,
    serviceCode: `FTTH-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-01-01",
    expirationDate: "2027-12-31",
    invoicePortalUrl: "https://khong-ap-dung.vn",
    invoicePortalPassword: "bi-bo-qua",
  } as any);
  assert.equal(otherService.isInvoicePortalService, false);
  assert.equal(otherService.invoicePortalUrl, null);
  assert.equal(otherService.invoicePortalPasswordMasked, null);
});

test("create: password without username is rejected (400)", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(`${suffix}-b`);

  await assert.rejects(
    async () =>
      serviceService.create({
        customerId,
        serviceGroup: "CNTT",
        serviceName: `Hóa đơn điện tử Thiếu TK ${suffix}`,
        serviceCode: `INV-B-${suffix}`,
        paymentType: "Trả hàng tháng",
        startDate: "2026-01-01",
        expirationDate: "2027-12-31",
        invoicePortalPassword: "mat-khau-khong-co-tk",
      }),
    (err: any) => {
      assert.ok(err instanceof ServiceServiceError);
      assert.equal(err.status, 400);
      assert.match(err.message, /phải nhập Tài khoản/);
      return true;
    }
  );

  await assert.rejects(
    async () =>
      serviceService.create({
        customerId,
        serviceGroup: "CNTT",
        serviceName: `Hóa đơn điện tử Link Sai ${suffix}`,
        serviceCode: `INV-C-${suffix}`,
        paymentType: "Trả hàng tháng",
        startDate: "2026-01-01",
        expirationDate: "2027-12-31",
        invoicePortalUrl: "khong-phai-url",
      }),
    (err: any) => {
      assert.ok(err instanceof ServiceServiceError);
      assert.equal(err.status, 400);
      assert.match(err.message, /Link hệ thống hóa đơn không hợp lệ/);
      return true;
    }
  );
});

test("revealInvoiceCredential decrypts the password and writes an audit log entry", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(`${suffix}-c`);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "CNTT",
    serviceName: `Hóa đơn điện tử Reveal ${suffix}`,
    serviceCode: `INV-R-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-01-01",
    expirationDate: "2027-12-31",
    invoicePortalUrl: "https://hoadon.vnpt.vn",
    invoicePortalUsername: "ketoan01",
    invoicePortalPassword: "Mat-khau-that-456",
  });

  const revealed = await serviceService.revealInvoiceCredential(service.id, "Admin Test");
  assert.equal(revealed.password, "Mat-khau-that-456");
  assert.equal(revealed.username, "ketoan01");

  const logs = await query<any>(
    "SELECT * FROM invoice_credential_audit_logs WHERE service_id = ?",
    [service.id]
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actor, "Admin Test");

  // Gọi lại lần 2 -> ghi thêm 1 dòng audit nữa (mỗi lần xem đều phải có vết).
  await serviceService.revealInvoiceCredential(service.id, "Admin Test");
  const logsAfter = await query<any>(
    "SELECT * FROM invoice_credential_audit_logs WHERE service_id = ?",
    [service.id]
  );
  assert.equal(logsAfter.length, 2);
});

test("revealInvoiceCredential rejects a service outside the invoice portal group", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(`${suffix}-d`);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: `Internet Fiber Không Hóa Đơn ${suffix}`,
    serviceCode: `FTTH-D-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-01-01",
    expirationDate: "2027-12-31",
  });

  await assert.rejects(
    async () => serviceService.revealInvoiceCredential(service.id, "Admin Test"),
    (err: any) => {
      assert.ok(err instanceof ServiceServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});
