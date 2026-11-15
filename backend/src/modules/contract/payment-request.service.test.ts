import test from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import {
  PaymentRequestService,
  PaymentRequestBlockedError,
  ORDER_WITHOUT_CUSTOMER_MESSAGE,
} from "./payment-request.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new PaymentRequestService();

async function resetTestData() {
  await run("DELETE FROM contracts");
  await run("DELETE FROM staff");
  await run("DELETE FROM customers");
  await run("DELETE FROM payment_request_exports");
}

async function insertCustomer(id: string, name: string, identityCode: string | null = null) {
  await run(
    "INSERT INTO customers (id, name, identity_code, type, customer_group) VALUES (?, ?, ?, ?, ?)",
    [id, name, identityCode, "Doanh nghiệp", "Tự phát triển"]
  );
}

test("buildData fills customer, AM and amount fields correctly", async () => {
  await resetTestData();
  await run(
    `INSERT INTO staff (id, code, name, role, hrm_code, phone, email, short_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["S-KHOA", "NV-KHOA", "Vũ Tiến Khoa", "AM", "VNPT026696", "0838999333", "khoavt.hcm@vnpt.vn", "KHOA", "ACTIVE"]
  );

  const contractId = "HD-TEST-DOCX";
  await insertCustomer("C-DOCX", "TRƯỜNG TIỂU HỌC NAM SÀI GÒN", "0319653211");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      am_staff, service_group, service_name, package_name, payment_method,
      tax_code, contract_number, signed_date, deployment_status, payment_status, document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contractId,
      "GD-26001",
      "TRƯỜNG TIỂU HỌC NAM SÀI GÒN",
      JSON.stringify(["02838123456"]),
      5940000,
      "Trực tiếp",
      "Vũ Tiến Khoa",
      "CNTT",
      "eduOffice",
      "Gói edu 12T",
      "Trả trước",
      "0319653211",
      "20261023/0319653211/VNPT.NSG/VNPT026696",
      "2026-10-23",
      "Hoàn tất",
      "Chưa thanh toán",
      "Soạn thảo",
      "C-DOCX",
    ]
  );

  const data = await service.buildData(contractId, "706", new Date("2026-10-26T00:00:00Z"));
  assert.equal(data.SoVanBan, "706");
  assert.equal(data.SoHopDong, "20261023/0319653211/VNPT.NSG/VNPT026696");
  assert.equal(data.TenVietTatAM, "KHOA");
  assert.equal(data.SoTienBangChu, "Năm triệu, chín trăm bốn mươi nghìn đồng");
  assert.equal(data.GiaTriHopDong, "5.940.000 đồng");
  assert.equal(data.MaSoThue, "0319653211");
  assert.equal(data.missingFields.length, 0);
});

test("buildData lists missing fields for incomplete order without failing", async () => {
  await resetTestData();
  const contractId = "HD-LEGACY";
  await insertCustomer("C-OLD", "Khách Hàng Cũ");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contractId,
      "GD-OLD",
      "Khách Hàng Cũ",
      JSON.stringify(["TB-OLD"]),
      1000000,
      "Trực tiếp",
      "Hoàn tất",
      "Chưa thanh toán",
      "Soạn thảo",
      "C-OLD",
    ]
  );

  const data = await service.buildData(contractId, "101");
  assert.ok(data.missingFields.includes("Mã số thuế"));
  assert.ok(data.missingFields.includes("AM tiếp thị"));
  assert.ok(data.missingFields.includes("Gói cước"));
});

test("render produces docx without leftover unrendered tags", async () => {
  await resetTestData();
  const contractId = "HD-RENDER";
  await insertCustomer("C-RENDER", "CÔNG TY RENDER TEST", "0319653211");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      am_staff, service_group, service_name, package_name, payment_method,
      tax_code, signed_date, deployment_status, payment_status, document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contractId,
      "GD-RENDER-1",
      "CÔNG TY RENDER TEST",
      JSON.stringify(["TB-001"]),
      2000000,
      "Trực tiếp",
      "Vũ Tiến Khoa",
      "BRCĐ",
      "Fiber",
      "Gói VIP",
      "Trả trước",
      "0319653211",
      "2026-11-13",
      "Hoàn tất",
      "Chưa thanh toán",
      "Soạn thảo",
      "C-RENDER",
    ]
  );

  const data = await service.buildData(contractId, "888");
  const buffer = service.render(data);
  assert.ok(buffer.length > 0);

  // Inspect XML inside docx
  const zip = new PizZip(buffer);
  const docXml = zip.file("word/document.xml")?.asText();
  assert.ok(docXml, "document.xml exists");

  // Must contain rendered values
  assert.ok(docXml.includes("CÔNG TY RENDER TEST"));
  assert.ok(docXml.includes("0319653211"));
  // Must NOT have leftover unrendered curly braces for variables
  const unrendered = docXml.match(/\{[A-Za-z0-9_]+\}/g);
  assert.equal(unrendered, null, `Should have no unrendered tags: ${unrendered?.join(", ")}`);
});

test("suggestNextDocNumber returns max + 1 within year", async () => {
  await resetTestData();
  await run(
    `INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by, exported_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["EXP-1", "HD-1", "705", "Admin", "2026-05-01T10:00:00Z"]
  );
  await run(
    `INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by, exported_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["EXP-2", "HD-2", "706", "Admin", "2026-06-01T10:00:00Z"]
  );

  const next = await service.suggestNextDocNumber(2026);
  assert.equal(next, "707");

  const otherYear = await service.suggestNextDocNumber(2027);
  assert.equal(otherYear, "");
});

test("buildData blocks orders that are not linked to a customer", async () => {
  await resetTestData();
  const contractId = "HD-NO-CUSTOMER";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contractId, "GD-NO-CUST", "Khách Chưa Gắn", JSON.stringify(["TB-X"]), 1000000, "Trực tiếp", "Hoàn tất", "Chưa thanh toán", "Soạn thảo"]
  );

  await assert.rejects(service.buildData(contractId, "1"), (err: unknown) => {
    assert.ok(err instanceof PaymentRequestBlockedError);
    assert.equal((err as Error).message, ORDER_WITHOUT_CUSTOMER_MESSAGE);
    assert.match((err as Error).message, /chưa gắn khách hàng/);
    return true;
  });

  const exports = await query("SELECT id FROM payment_request_exports");
  assert.equal(exports.length, 0);
});

test("buildData blocks orders whose linked customer no longer exists", async () => {
  await resetTestData();
  const contractId = "HD-DANGLING";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contractId, "GD-DANGLING", "Khách Đã Xóa", JSON.stringify(["TB-X"]), 1000000, "Trực tiếp", "Hoàn tất", "Chưa thanh toán", "Soạn thảo", "C-DA-XOA"]
  );

  await assert.rejects(service.buildData(contractId, "1"), PaymentRequestBlockedError);
});
