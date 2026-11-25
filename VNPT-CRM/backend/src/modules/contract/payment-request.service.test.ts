import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import {
  PaymentRequestService,
  PaymentRequestBlockedError,
  PaymentRequestConflictError,
  PaymentRequestInputError,
  PaymentRequestNotFoundError,
  ORDER_WITHOUT_CUSTOMER_MESSAGE,
  extractDocxLines,
} from "./payment-request.service.js";
import {
  convertDocxToPdf,
  isPdfConversionAvailable,
  PdfConverterUnavailableError,
  resolveSofficePath,
} from "./docx-to-pdf.js";

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

// ---------------------------------------------------------------------------
// STT 6 + 12: hình thức "Trả trước N tháng", xem trước không tiêu số, xác nhận mới lấy số, PDF
// ---------------------------------------------------------------------------

async function insertExportableOrder(
  id: string,
  transactionCode: string,
  options: { paymentMethod?: string | null; prepaidMonths?: number | null } = {}
) {
  const customerId = `C-${id}`;
  await insertCustomer(customerId, `KHÁCH ${transactionCode}`, "0319653211");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      am_staff, package_name, payment_method, prepaid_months, tax_code,
      deployment_status, payment_status, document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      transactionCode,
      `KHÁCH ${transactionCode}`,
      JSON.stringify(["TB-1"]),
      3000000,
      "Online",
      "Vũ Tiến Khoa",
      "Gói test",
      options.paymentMethod ?? "Trả trước",
      options.prepaidMonths ?? null,
      "0319653211",
      "Hoàn tất",
      "Chưa thanh toán",
      "Soạn thảo",
      customerId,
    ]
  );
}

test("payment method line shows prepaid months, legacy Trả trước keeps old text", async () => {
  await resetTestData();
  await insertExportableOrder("HD-PM-1", "GD-PM-1", { paymentMethod: "Trả trước", prepaidMonths: 12 });
  await insertExportableOrder("HD-PM-2", "GD-PM-2", { paymentMethod: "Trả trước", prepaidMonths: null });
  await insertExportableOrder("HD-PM-3", "GD-PM-3", { paymentMethod: "Theo giá trị hợp đồng" });

  assert.equal((await service.buildData("HD-PM-1", "1")).HinhThucThanhToan, "Trả trước 12 tháng");
  assert.equal((await service.buildData("HD-PM-2", "1")).HinhThucThanhToan, "Trả trước");
  assert.equal((await service.buildData("HD-PM-3", "1")).HinhThucThanhToan, "Theo giá trị hợp đồng");

  const lines = extractDocxLines(service.render(await service.buildData("HD-PM-1", "1")));
  assert.ok(lines.some((l) => l.includes("Hình thức thanh toán: Trả trước 12 tháng")), lines.join("\n"));
});

test("preview shows the document text and never consumes a document number", async () => {
  await resetTestData();
  await insertExportableOrder("HD-PV-1", "GD-PV-1");

  for (let i = 0; i < 3; i += 1) {
    const preview = await service.buildPreview("HD-PV-1");
    assert.equal(preview.suggestedDocNumber, "");
    assert.equal(preview.latestExport, null);
    assert.ok(preview.lines.some((l) => l.includes("GD-PV-1")), "nội dung có mã GD");
    assert.ok(preview.lines.some((l) => l.includes("THÔNG BÁO")));
  }
  const typed = await service.buildPreview("HD-PV-1", "777");
  assert.ok(typed.lines.some((l) => l.includes("777")));

  const rows = await query("SELECT id FROM payment_request_exports");
  assert.equal(rows.length, 0, "xem trước không được ghi số văn bản");
});

test("confirmExport allocates the next number only on confirmation and records the audit log", async () => {
  await resetTestData();
  await run("DELETE FROM audit_logs WHERE action = 'Cấp số văn bản đề nghị thanh toán'");
  await insertExportableOrder("HD-CF-1", "GD-CF-1");
  await insertExportableOrder("HD-CF-2", "GD-CF-2");

  const first = await service.confirmExport("HD-CF-1", { exportedBy: "Khoa" });
  assert.equal(first.reused, false);
  assert.equal(first.record.docNumber, "1");

  const second = await service.confirmExport("HD-CF-2", { exportedBy: "Khoa" });
  assert.equal(second.record.docNumber, "2");

  const preview = await service.buildPreview("HD-CF-1");
  assert.equal(preview.suggestedDocNumber, "3", "xem trước chỉ gợi ý số kế tiếp, chưa tiêu");
  assert.equal(preview.latestExport?.docNumber, "1");

  const rows = await query<{ doc_number: string }>(
    "SELECT doc_number FROM payment_request_exports ORDER BY doc_number"
  );
  assert.deepEqual(rows.map((r) => r.doc_number), ["1", "2"]);

  const logs = await query("SELECT id FROM audit_logs WHERE action = 'Cấp số văn bản đề nghị thanh toán'");
  assert.equal(logs.length, 2);
});

test("two people confirming at the same time get consecutive numbers without duplicates or gaps", async () => {
  await resetTestData();
  const ids = ["HD-CC-1", "HD-CC-2", "HD-CC-3", "HD-CC-4", "HD-CC-5"];
  for (const id of ids) await insertExportableOrder(id, id.replace("HD", "GD"));
  await run(
    `INSERT INTO payment_request_exports (id, contract_id, doc_number, exported_by, exported_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["EXP-OLD", "HD-OLD", "705", "Admin", new Date().toISOString()]
  );

  const results = await Promise.all(ids.map((id, i) => service.confirmExport(id, { exportedBy: `NV${i}` })));
  const numbers = results.map((r) => Number(r.record.docNumber)).sort((a, b) => a - b);
  assert.deepEqual(numbers, [706, 707, 708, 709, 710]);
  assert.equal(new Set(results.map((r) => r.record.docNumber)).size, ids.length);
});

test("confirmExport with a typed number rejects duplicates and bad formats, reuses own number", async () => {
  await resetTestData();
  await insertExportableOrder("HD-MN-1", "GD-MN-1");
  await insertExportableOrder("HD-MN-2", "GD-MN-2");

  const a = await service.confirmExport("HD-MN-1", { docNumber: "706", exportedBy: "Khoa" });
  assert.equal(a.record.docNumber, "706");

  await assert.rejects(
    service.confirmExport("HD-MN-2", { docNumber: "706", exportedBy: "Tuấn" }),
    (err: unknown) => {
      assert.ok(err instanceof PaymentRequestConflictError);
      assert.match((err as Error).message, /đã được cấp cho đơn GD-MN-1/);
      assert.match((err as Error).message, /707/);
      return true;
    }
  );
  for (const bad of ["<b>1</b>", "12 34", "x".repeat(21), "../1"]) {
    await assert.rejects(
      service.confirmExport("HD-MN-2", { docNumber: bad, exportedBy: "Tuấn" }),
      PaymentRequestInputError,
      `số văn bản "${bad}" phải bị từ chối`
    );
  }

  const again = await service.confirmExport("HD-MN-1", { docNumber: "706", exportedBy: "Khoa" });
  assert.equal(again.reused, true);
  const reuse = await service.confirmExport("HD-MN-1", { reuseLatest: true, exportedBy: "Khoa" });
  assert.equal(reuse.reused, true);
  assert.equal(reuse.record.id, a.record.id);

  const rows = await query("SELECT id FROM payment_request_exports");
  assert.equal(rows.length, 1);
});

test("confirmExport refuses orders without a customer and does not consume a number", async () => {
  await resetTestData();
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["HD-CF-NOCUST", "GD-CF-NOCUST", "Khách", "[]", 1, "Online", "Hoàn tất", "Chưa thanh toán", "Soạn thảo"]
  );
  await assert.rejects(service.confirmExport("HD-CF-NOCUST", { exportedBy: "Khoa" }), PaymentRequestBlockedError);
  await assert.rejects(service.confirmExport("HD-KHONG-CO", { exportedBy: "Khoa" }), /Không tìm thấy Đơn hàng/);
  assert.equal((await query("SELECT id FROM payment_request_exports")).length, 0);
});

test("DOCX and PDF of one confirmation carry the same document number and date", async () => {
  await resetTestData();
  await insertExportableOrder("HD-SAME-1", "GD-SAME-1", { paymentMethod: "Trả trước", prepaidMonths: 6 });
  const { record } = await service.confirmExport("HD-SAME-1", { docNumber: "812", exportedBy: "Khoa" });

  const fetched = await service.getExport(record.id, "HD-SAME-1");
  assert.equal(fetched.docNumber, "812");
  await assert.rejects(service.getExport(record.id, "HD-KHAC"), PaymentRequestNotFoundError);

  const docx = service.render(await service.buildDataForExport(fetched));
  const docxLines = extractDocxLines(docx);
  assert.ok(docxLines.some((l) => l.includes("812")), "DOCX mang số 812");
  assert.ok(docxLines.some((l) => l.includes("Trả trước 6 tháng")));

  if (resolveSofficePath()) {
    const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("vnpt-pdf-")).length;
    const pdf = await convertDocxToPdf(docx);
    assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF", "PDF phải bắt đầu bằng %PDF");
    assert.ok(pdf.length > 1000);
    const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("vnpt-pdf-")).length;
    assert.equal(after, before, "không giữ file PDF/DOCX tạm");
  }
});

test("PDF conversion fails with a clear Vietnamese error when LibreOffice is not installed", async () => {
  const previous = process.env.SOFFICE_PATH;
  process.env.SOFFICE_PATH = path.join(os.tmpdir(), "khong-co-soffice.exe");
  try {
    assert.equal(resolveSofficePath(), null);
    assert.equal(isPdfConversionAvailable(), false);
    await assert.rejects(convertDocxToPdf(Buffer.from("x")), (err: unknown) => {
      assert.ok(err instanceof PdfConverterUnavailableError);
      assert.match((err as Error).message, /chưa cài LibreOffice/);
      return true;
    });
  } finally {
    if (previous === undefined) delete process.env.SOFFICE_PATH;
    else process.env.SOFFICE_PATH = previous;
  }
});
