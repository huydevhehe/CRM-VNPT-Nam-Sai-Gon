import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import {
  QuoteService,
  QuoteBlockedError,
  QuoteConflictError,
  QuoteInputError,
  CUSTOMER_NOT_FOUND_MESSAGE,
  type CreateQuoteInput,
} from "./quote.service.js";
import { extractDocxLines } from "../contract/payment-request.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new QuoteService();

async function resetTestData() {
  await run("DELETE FROM quote_exports");
  await run("DELETE FROM staff");
  await run("DELETE FROM customers");
}

async function insertCustomer(id: string, overrides: Record<string, unknown> = {}) {
  const base = {
    name: "CÔNG TY TNHH KHÁCH HÀNG TEST",
    identity_code: "0312345678",
    type: "Doanh nghiệp",
    customer_group: "Tự phát triển",
    address: "123 Nguyễn Văn Linh, Quận 7",
    phone: "0901111222",
    contact_name: "Nguyễn Văn A",
    contact_email: "a.nguyen@test.vn",
    am_staff: "Vũ Tiến Khoa",
    ...overrides,
  };
  await run(
    `INSERT INTO customers (id, name, identity_code, type, customer_group, address, phone, contact_name, contact_email, am_staff)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      base.name,
      base.identity_code,
      base.type,
      base.customer_group,
      base.address,
      base.phone,
      base.contact_name,
      base.contact_email,
      base.am_staff,
    ]
  );
}

const sampleInput: CreateQuoteInput = {
  serviceType: "Dịch vụ Internet cáp quang",
  packageName: "Gói FiberVNN 100Mbps",
  unit: "Gói/tháng",
  quantity: 2,
  unitPrice: 500000,
  vatPercent: 10,
  note: "Áp dụng cho văn phòng mới",
};

test("buildData fills customer info and computes line-item totals", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-1");
  await run(
    `INSERT INTO staff (id, code, name, role, hrm_code, phone, email, short_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["S-KHOA", "NV-KHOA", "Vũ Tiến Khoa", "AM", "VNPT026696", "0838999333", "khoavt.hcm@vnpt.vn", "KHOA", "ACTIVE"]
  );

  const data = await service.buildData("CUS-QUO-1", "15", sampleInput);

  assert.equal(data.soBaoGia, "15");
  assert.equal(data.tenDoanhNghiepA, "CÔNG TY TNHH KHÁCH HÀNG TEST");
  assert.equal(data.diaChiA, "123 Nguyễn Văn Linh, Quận 7");
  assert.equal(data.maSoThueA, "0312345678");
  assert.equal(data.tenLead, "Nguyễn Văn A");
  assert.equal(data.soDienThoaiLead, "0901111222");
  assert.equal(data.emailLead, "a.nguyen@test.vn");
  assert.equal(data.hoTenNhanVien, "Vũ Tiến Khoa");
  assert.equal(data.soDienThoaiNhanVien, "0838999333");
  assert.equal(data.emailVNPTNhanVien, "khoavt.hcm@vnpt.vn");
  assert.equal(data.goiCuocDichVu, "Gói FiberVNN 100Mbps");
  assert.equal(data.soLuongDichVu, "2");
  assert.equal(data.donGiaDichVu, "500.000");
  assert.equal(data.thanhTienDichVu, "1.000.000");
  assert.equal(data.tongThanhTienChuaVAT, "1.000.000");
  assert.equal(data.thueVAT, "10");
  assert.equal(data.soTienThueVAT, "100.000");
  assert.equal(data.tongThanhTienSauVAT, "1.100.000");
  assert.equal(data.missingFields.length, 0);
});

test("buildData falls back to customer am_staff and reports missing fields", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-2", {
    address: null,
    identity_code: null,
    contact_name: null,
    contact_email: null,
  });

  const data = await service.buildData("CUS-QUO-2", "1", {
    ...sampleInput,
    staffName: undefined,
  });

  assert.equal(data.hoTenNhanVien, "Vũ Tiến Khoa");
  assert.ok(data.missingFields.includes("Địa chỉ"));
  assert.ok(data.missingFields.includes("Mã số thuế"));
  assert.equal(data.tenLead, data.tenDoanhNghiepA);
});

test("buildData throws QuoteBlockedError when customer not found", async () => {
  await resetTestData();
  await assert.rejects(
    () => service.buildData("CUS-NOT-FOUND", "1", sampleInput),
    (err: unknown) => {
      assert.ok(err instanceof QuoteBlockedError);
      assert.equal((err as Error).message, CUSTOMER_NOT_FOUND_MESSAGE);
      return true;
    }
  );
});

test("render produces a docx whose lines contain the filled quote data", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-3");
  const data = await service.buildData("CUS-QUO-3", "20", sampleInput);
  const buffer = service.render(data);
  const lines = extractDocxLines(buffer);
  const joined = lines.join("\n");

  assert.ok(joined.includes("20"), "số báo giá phải xuất hiện");
  assert.ok(joined.includes("CÔNG TY TNHH KHÁCH HÀNG TEST"));
  assert.ok(joined.includes("1.000.000"), "thành tiền phải được tính sẵn, không còn công thức chữ");
  assert.ok(!joined.includes("${"), "không được còn placeholder chưa thay thế");
});

test("confirmExport issues sequential doc numbers and persists line items", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-4");

  const first = await service.confirmExport("CUS-QUO-4", { ...sampleInput, exportedBy: "admin" });
  assert.equal(first.reused, false);
  const firstNum = parseInt(first.record.docNumber, 10);
  assert.ok(Number.isInteger(firstNum));

  const second = await service.confirmExport("CUS-QUO-4", { ...sampleInput, exportedBy: "admin" });
  assert.equal(parseInt(second.record.docNumber, 10), firstNum + 1);
  assert.equal(second.record.packageName, sampleInput.packageName);
  assert.equal(second.record.quantity, sampleInput.quantity);
});

test("confirmExport rejects a manual doc number already used by another customer", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-5");
  await insertCustomer("CUS-QUO-6");

  await service.confirmExport("CUS-QUO-5", { ...sampleInput, exportedBy: "admin", docNumber: "900" });

  await assert.rejects(
    () => service.confirmExport("CUS-QUO-6", { ...sampleInput, exportedBy: "admin", docNumber: "900" }),
    (err: unknown) => {
      assert.ok(err instanceof QuoteConflictError);
      return true;
    }
  );
});

test("confirmExport rejects an invalid manual doc number", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-7");

  await assert.rejects(
    () =>
      service.confirmExport("CUS-QUO-7", {
        ...sampleInput,
        exportedBy: "admin",
        docNumber: "số không hợp lệ quá dài vượt giới hạn hai mươi ký tự",
      }),
    (err: unknown) => {
      assert.ok(err instanceof QuoteInputError);
      return true;
    }
  );
});

test("buildDataForExport rebuilds the exact same data from a stored export", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-8");

  const { record } = await service.confirmExport("CUS-QUO-8", { ...sampleInput, exportedBy: "admin" });
  const data = await service.buildDataForExport(record);

  assert.equal(data.soBaoGia, record.docNumber);
  assert.equal(data.goiCuocDichVu, sampleInput.packageName);
  assert.equal(data.tongThanhTienSauVAT, "1.100.000");
});

test("listExports returns exports for a customer ordered by most recent", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-9");

  await service.confirmExport("CUS-QUO-9", { ...sampleInput, exportedBy: "admin" });
  await service.confirmExport("CUS-QUO-9", { ...sampleInput, exportedBy: "admin" });

  const list = await service.listExports("CUS-QUO-9");
  assert.equal(list.length, 2);
  assert.equal(list[0].customerId, "CUS-QUO-9");
});

test("buildData điền Số EO vào nội dung báo giá, cho phép để trống", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-10");

  const withEo = await service.buildData("CUS-QUO-10", "1", { ...sampleInput, eoNumber: "EO-2026-0088" });
  assert.equal(withEo.soEO, "EO-2026-0088");

  const withoutEo = await service.buildData("CUS-QUO-10", "1", sampleInput);
  assert.equal(withoutEo.soEO, "");
});

test("render hiển thị Số EO trong nội dung file khi có nhập", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-11");
  const data = await service.buildData("CUS-QUO-11", "30", { ...sampleInput, eoNumber: "EO-2026-0099" });
  const buffer = service.render(data);
  const lines = extractDocxLines(buffer);
  assert.ok(lines.join("\n").includes("EO-2026-0099"));
});

test("confirmExport lưu Số EO (tùy chọn, nhập tay) cùng lần cấp số", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-12");

  const { record } = await service.confirmExport("CUS-QUO-12", {
    ...sampleInput,
    exportedBy: "admin",
    eoNumber: "  EO-2026-0100  ",
  });
  assert.equal(record.eoNumber, "EO-2026-0100");

  const { record: withoutEo } = await service.confirmExport("CUS-QUO-12", { ...sampleInput, exportedBy: "admin" });
  assert.equal(withoutEo.eoNumber, null);
});

test("buildDataForExport khôi phục đúng Số EO đã lưu", async () => {
  await resetTestData();
  await insertCustomer("CUS-QUO-13");

  const { record } = await service.confirmExport("CUS-QUO-13", {
    ...sampleInput,
    exportedBy: "admin",
    eoNumber: "EO-2026-0200",
  });
  const data = await service.buildDataForExport(record);
  assert.equal(data.soEO, "EO-2026-0200");
});
