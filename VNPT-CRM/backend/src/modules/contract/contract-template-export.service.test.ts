import test from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";
import { initDatabase, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import { ContractTemplateExportService } from "./contract-template-export.service.js";
import { convertDocxToPdf, isPdfConversionAvailable } from "./docx-to-pdf.js";

await initDatabase();
await applySchemaExtensions();

const service = new ContractTemplateExportService();

async function resetTestData() {
  await run("DELETE FROM contracts");
  await run("DELETE FROM customers");
}

async function insertCustomer(id: string, name: string, address: string, taxCode: string) {
  await run(
    "INSERT INTO customers (id, name, identity_code, address, type, customer_group) VALUES (?, ?, ?, ?, ?, ?)",
    [id, name, taxCode, address, "Doanh nghiệp", "Tự phát triển"]
  );
}

async function insertCustomerWithRepresentative(
  id: string,
  name: string,
  address: string,
  taxCode: string,
  rep: { name: string; title: string; idNumber: string; issuedAt: string; issuedPlace: string }
) {
  await run(
    `INSERT INTO customers (
      id, name, identity_code, address, type, customer_group,
      representative_name, representative_title, representative_id_number,
      representative_id_issued_at, representative_id_issued_place
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      taxCode,
      address,
      "Doanh nghiệp",
      "Tự phát triển",
      rep.name,
      rep.title,
      rep.idNumber,
      rep.issuedAt,
      rep.issuedPlace,
    ]
  );
}

async function insertContract(id: string, customerId: string, template: string, contractNumber: string) {
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      contract_template, contract_number, signed_date, deployment_status, payment_status,
      document_status, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "GD-CKS-" + id,
      "CÔNG TY TNHH KHÁCH HÀNG " + id,
      JSON.stringify(["02838123456"]),
      5000000,
      "Trực tiếp",
      template,
      "HD-" + id,
      "2026-11-18",
      "Hoàn tất",
      "Chưa thanh toán",
      "Soạn thảo",
      customerId,
    ]
  );
}

/** Mảng các chuỗi PII thật của khách hàng mẫu (Ô Tô Tân An / Saitex) TUYỆT ĐỐI
 * không được còn sót lại trong file export cuối cùng dùng cho hệ thống. */
const SAMPLE_PII_STRINGS = [
  "SAITEX",
  "ANDRE WONG",
  "1673562",
  "Mauritius",
  "Tân An",
  "TÂN AN",
  "3601051082",
  "NGUYỄN HỮU HOÀNG MINH",
  "079094009992",
  "1101991038",
  "HDHCM2468742614",
  "HDHCM1465862514",
];

interface MergedCheck {
  mainXml: string;
  appendixXmls: string[];
  combinedText: string;
}

function strictParseOrThrow(xml: string, label: string) {
  const parsed = new DOMParser().parseFromString(xml, "text/xml");
  const errors = parsed.getElementsByTagName("parserError").length + parsed.getElementsByTagName("parsererror").length;
  assert.equal(errors, 0, `${label}: XML không hợp lệ (strict parser báo lỗi)`);
  return parsed;
}

function extractAllText(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const texts = doc.getElementsByTagName("w:t");
  let out = "";
  for (let i = 0; i < texts.length; i++) out += texts[i].textContent ?? "";
  return out;
}

function parseAndVerifyMergedDocx(docx: Buffer, expectedAppendixCount: number): MergedCheck {
  const zip = new PizZip(docx);
  const mainFile = zip.file("word/document.xml");
  assert.ok(mainFile, "word/document.xml phải tồn tại trong file docx xuất ra");
  const mainXml = mainFile!.asText();
  strictParseOrThrow(mainXml, "word/document.xml (hợp đồng chính)");

  const appendixXmls: string[] = [];
  for (let i = 1; i <= expectedAppendixCount; i++) {
    const partName = `word/afchunk${i}.docx`;
    const partFile = zip.file(partName);
    assert.ok(partFile, `${partName} phải tồn tại (phụ lục altChunk thứ ${i})`);
    const innerZip = new PizZip(partFile!.asNodeBuffer());
    const innerDocFile = innerZip.file("word/document.xml");
    assert.ok(innerDocFile, `${partName} phải là 1 file .docx hợp lệ (có word/document.xml)`);
    const innerXml = innerDocFile!.asText();
    strictParseOrThrow(innerXml, `${partName} (phụ lục)`);
    appendixXmls.push(innerXml);
  }
  // Không còn afchunk thừa ngoài số lượng kỳ vọng.
  assert.equal(zip.file(`word/afchunk${expectedAppendixCount + 1}.docx`), null);

  const combinedText = [mainXml, ...appendixXmls].map(extractAllText).join(" ");
  return { mainXml, appendixXmls, combinedText };
}

function assertNoLeftoverPlaceholders(combinedText: string) {
  const leftover = combinedText.match(/\{[A-Za-z]+\}/g);
  assert.equal(leftover, null, `Còn sót placeholder chưa thay: ${leftover?.join(", ")}`);
}

function assertNoSamplePii(combinedText: string) {
  for (const term of SAMPLE_PII_STRINGS) {
    assert.ok(!combinedText.includes(term), `File export còn sót PII của khách hàng mẫu: "${term}"`);
  }
}

test("renderFile: cks_token_smartca_dn gộp đúng 2 phụ lục (phiếu đăng ký + điều khoản chung)", async () => {
  await resetTestData();
  await insertCustomer("C-CKS-TOKEN", "CÔNG TY TNHH KHÁCH HÀNG CKS TOKEN", "123 Đường Test, Quận 1, TP.HCM", "0312345678");
  await insertContract("HD-CKS-TOKEN", "C-CKS-TOKEN", "cks_token_smartca_dn", "HD-CKS-TOKEN");

  const { docx, tpl } = await service.renderFile("HD-CKS-TOKEN");
  assert.equal(tpl.key, "cks_token_smartca_dn");

  const { combinedText } = parseAndVerifyMergedDocx(docx, 2);
  assertNoLeftoverPlaceholders(combinedText);
  assertNoSamplePii(combinedText);

  assert.ok(combinedText.includes("CÔNG TY TNHH KHÁCH HÀNG HD-CKS-TOKEN"), "Phải chứa tên khách hàng từ CRM");
  assert.ok(combinedText.includes("123 Đường Test, Quận 1, TP.HCM"), "Phải chứa địa chỉ khách hàng từ CRM");
  assert.ok(combinedText.includes("PHIẾU ĐỀ NGHỊ CUNG CẤP DỊCH VỤ VNPT CA"), "Phải chứa nội dung phụ lục phiếu đăng ký");
  assert.ok(combinedText.includes("ĐIỀU KHOẢN SỬ DỤNG DỊCH VỤ CHỨNG THỰC CHỮ KÝ SỐ"), "Phải chứa nội dung điều khoản chung");
  assert.ok(combinedText.includes("HỢP ĐỒNG CUNG CẤP VÀ SỬ DỤNG DỊCH VỤ CHỨNG THỰC CHỮ KÝ SỐ"), "Phải chứa nội dung hợp đồng chính");
});

test("renderFile: cks_smartca_cn_dn gộp đúng 4 phụ lục (tổ chức, cá nhân, bảo vệ dữ liệu, điều khoản chung)", async () => {
  await resetTestData();
  await insertCustomer("C-CKS-CNDN", "CÔNG TY TNHH KHÁCH HÀNG CKS CNDN", "456 Đường Test 2, Quận 2, TP.HCM", "0398765432");
  await insertContract("HD-CKS-CNDN", "C-CKS-CNDN", "cks_smartca_cn_dn", "HD-CKS-CNDN");

  const { docx, tpl } = await service.renderFile("HD-CKS-CNDN");
  assert.equal(tpl.key, "cks_smartca_cn_dn");

  const { combinedText } = parseAndVerifyMergedDocx(docx, 4);
  assertNoLeftoverPlaceholders(combinedText);
  assertNoSamplePii(combinedText);

  assert.ok(combinedText.includes("CÔNG TY TNHH KHÁCH HÀNG HD-CKS-CNDN"), "Phải chứa tên khách hàng từ CRM");
  assert.ok(combinedText.includes("456 Đường Test 2, Quận 2, TP.HCM"), "Phải chứa địa chỉ khách hàng từ CRM");
  assert.ok(combinedText.includes("PHIẾU ĐỀ NGHỊ CUNG CẤP DỊCH VỤ CHỨNG THỰC CHỮ KÝ SỐ CÔNG CỘNG VNPT-CA"), "Phải chứa phụ lục tổ chức");
  assert.ok(combinedText.includes("DANH SÁCH CÁ NHÂN CẤP CHỨNG THƯ SỐ"), "Phải chứa phụ lục danh sách cá nhân");
  assert.ok(combinedText.includes("PHỤ LỤC CAM KẾT BẢO VỆ DỮ LIỆU CÁ NHÂN"), "Phải chứa phụ lục bảo vệ dữ liệu");
  assert.ok(combinedText.includes("ĐIỀU KHOẢN SỬ DỤNG DỊCH VỤ CHỨNG THỰC CHỮ KÝ SỐ"), "Phải chứa nội dung điều khoản chung");
});

test("renderFile: các mẫu không có phụ lục (hoa_don_dien_tu) vẫn xuất bình thường, không bị gộp altChunk", async () => {
  await resetTestData();
  await insertCustomer("C-HD", "CÔNG TY TNHH HÓA ĐƠN", "789 Đường Test 3, Quận 3, TP.HCM", "0355555555");
  await insertContract("HD-HOADON", "C-HD", "hoa_don_dien_tu", "HD-HOADON");

  const { docx } = await service.renderFile("HD-HOADON");
  const zip = new PizZip(docx);
  assert.equal(zip.file("word/afchunk1.docx"), null, "Mẫu không có phụ lục thì không được chèn altChunk");
  const mainXml = zip.file("word/document.xml")!.asText();
  strictParseOrThrow(mainXml, "word/document.xml (hoa_don_dien_tu)");
});

test("buildPreview: điền đúng dữ liệu người đại diện khi Khách hàng đã có, không còn báo thiếu", async () => {
  await resetTestData();
  await insertCustomerWithRepresentative(
    "C-REP",
    "CÔNG TY TNHH NGƯỜI ĐẠI DIỆN",
    "99 Đường Đại Diện, Quận 1, TP.HCM",
    "0311111111",
    {
      name: "Nguyễn Văn Đại Diện",
      title: "Giám đốc",
      idNumber: "079094005678",
      issuedAt: "15/03/2021",
      issuedPlace: "Cục Cảnh sát QLHC về TTXH",
    }
  );
  await insertContract("HD-REP", "C-REP", "hoa_don_dien_tu", "HD-REP");

  const preview = await service.preview("HD-REP");
  const text = preview.lines.join(" ");

  assert.ok(text.includes("Nguyễn Văn Đại Diện"), "Phải chứa tên người đại diện");
  assert.ok(text.includes("GIÁM ĐỐC"), "Phải chứa chức vụ người đại diện (in hoa, đồng bộ với bên B)");
  assert.ok(text.includes("079094005678"), "Phải chứa số CCCD người đại diện");
  assert.ok(text.includes("15/03/2021"), "Phải chứa ngày cấp CCCD");
  assert.ok(text.includes("Cục Cảnh sát QLHC về TTXH"), "Phải chứa nơi cấp CCCD");
  assert.ok(
    !preview.missingFields.some((f) => f.includes("đại diện") || f.includes("CCCD")),
    "Không được báo thiếu dữ liệu người đại diện khi Khách hàng đã có đủ"
  );
});

test("buildPreview: Khách hàng chưa có người đại diện thì vẫn xuất được, báo thiếu đúng 5 trường", async () => {
  await resetTestData();
  await insertCustomer("C-NOREP", "CÔNG TY TNHH CHƯA CÓ ĐẠI DIỆN", "1 Đường Test, Quận 1, TP.HCM", "0322222222");
  await insertContract("HD-NOREP", "C-NOREP", "hoa_don_dien_tu", "HD-NOREP");

  const preview = await service.preview("HD-NOREP");

  for (const label of [
    "Người đại diện",
    "Chức vụ người đại diện",
    "Số CCCD/Hộ chiếu người đại diện",
    "Ngày cấp CCCD",
    "Nơi cấp CCCD",
  ]) {
    assert.ok(preview.missingFields.includes(label), `Phải báo thiếu: ${label}`);
  }
});

test("renderFile: file docx CKS gộp xong convert PDF hợp lệ bằng LibreOffice (nếu máy có cài)", async (t) => {
  if (!isPdfConversionAvailable()) {
    t.skip("Máy test không có LibreOffice (soffice) nên bỏ qua kiểm tra convert PDF");
    return;
  }
  await resetTestData();
  await insertCustomer("C-CKS-PDF", "CÔNG TY TNHH KHÁCH HÀNG PDF", "1 Đường PDF, Quận 1, TP.HCM", "0366666666");
  await insertContract("HD-CKS-PDF", "C-CKS-PDF", "cks_token_smartca_dn", "HD-CKS-PDF");

  const { docx } = await service.renderFile("HD-CKS-PDF");
  const pdf = await convertDocxToPdf(docx);
  assert.ok(pdf.subarray(0, 5).toString("latin1") === "%PDF-", "LibreOffice phải convert ra PDF hợp lệ (header %PDF-)");
  assert.ok(pdf.length > 1000, "PDF sinh ra phải có nội dung (không phải file lỗi rỗng)");
});
