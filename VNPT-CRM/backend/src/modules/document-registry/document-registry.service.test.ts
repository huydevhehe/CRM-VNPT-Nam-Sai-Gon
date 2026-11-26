import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import { DocumentRegistryService } from "./document-registry.service.js";
import { MemoRegistryService } from "./memo-registry.service.js";
import { QuoteService } from "../customer/quote.service.js";
import { PaymentRequestService } from "../contract/payment-request.service.js";

await initDatabase();
await applySchemaExtensions();

const registry = new DocumentRegistryService();
const memoService = new MemoRegistryService();
const quoteService = new QuoteService();
const paymentService = new PaymentRequestService();

async function resetTestData() {
  await run("DELETE FROM memo_registry");
  await run("DELETE FROM quote_exports");
  await run("DELETE FROM payment_request_exports");
  await run("DELETE FROM contracts");
  await run("DELETE FROM customers");
}

async function insertCustomer(id: string) {
  await run(
    "INSERT INTO customers (id, name, identity_code, type, customer_group, address, phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, "KH Sổ văn bản", "0312345678", "Doanh nghiệp", "Tự phát triển", "123 ABC", "0900000000"]
  );
}

async function insertExportableOrder(contractId: string, transactionCode: string, customerId: string) {
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      am_staff, service_group, service_name, package_name, payment_method,
      tax_code, deployment_status, payment_status, document_status, customer_id, contract_template
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contractId,
      transactionCode,
      "KH Sổ văn bản",
      "[]",
      1000000,
      "Trực tiếp",
      "AM Test",
      "BRCĐ",
      "Internet",
      "Gói A",
      "Trả trước",
      "0312345678",
      "Chưa triển khai",
      "Chưa thanh toán",
      "Chưa xuất",
      customerId,
      "hoa_don_dien_tu",
    ]
  );
}

test("list gộp cả 3 loại văn bản, định dạng số đúng hậu tố từng loại", async () => {
  await resetTestData();
  await insertCustomer("CUS-SVB-1");
  await insertExportableOrder("HD-SVB-1", "GD-SVB-1", "CUS-SVB-1");

  await quoteService.confirmExport("CUS-SVB-1", {
    serviceType: "Internet",
    packageName: "Gói A",
    unit: "Gói",
    quantity: 1,
    unitPrice: 100000,
    exportedBy: "Khoa",
  });
  await paymentService.confirmExport("HD-SVB-1", { exportedBy: "Khoa" });
  await memoService.register({ docNumber: "5", note: "Tờ trình thử nghiệm", registeredBy: "Khoa" });

  const all = await registry.list();
  assert.equal(all.length, 3);

  const quote = all.find((e) => e.type === "bao-gia");
  assert.ok(quote?.displayNumber.endsWith("/BG-VNPT.TPHCM-NSG"));

  const payment = all.find((e) => e.type === "de-nghi-thanh-toan");
  assert.ok(payment?.displayNumber.endsWith("/DNTT-VNPT.TPHCM-NSG"));

  const memo = all.find((e) => e.type === "to-trinh");
  assert.ok(memo?.displayNumber.endsWith("/TTr-VNPT.TPHCM-NSG"));
  assert.equal(memo?.note, "Tờ trình thử nghiệm");
});

test("list lọc theo năm, năm không có dữ liệu trả về rỗng", async () => {
  await resetTestData();
  await memoService.register({ docNumber: "1", registeredBy: "Khoa" });

  const thisYear = String(new Date().getFullYear());
  const current = await registry.list(thisYear);
  assert.equal(current.length, 1);

  const other = await registry.list("2000");
  assert.equal(other.length, 0);
});
