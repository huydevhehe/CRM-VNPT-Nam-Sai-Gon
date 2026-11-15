import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, query, run } = await import("../../../database/db.js");
const { ContractImportService } = await import("./contract-import.service.js");

await initDatabase();

const importService = new ContractImportService();

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rowNumber: 2,
    transactionCode: "",
    customerName: "",
    subscriberCodes: [],
    totalValue: null,
    channel: "",
    amStaff: "",
    serviceGroup: "",
    serviceName: "",
    packageName: "",
    taxCode: "",
    contractNumber: "",
    signedDate: "",
    note: "",
    ...overrides,
  } as any;
}

async function insertCustomer(id: string, name: string, identityCode: string | null = null) {
  await run(
    "INSERT INTO customers (id, name, identity_code, type, customer_group) VALUES (?, ?, ?, ?, ?)",
    [id, name, identityCode, "Doanh nghiệp", "Tự phát triển"]
  );
}

async function insertContractWithoutCustomer(id: string, transactionCode: string, taxCode: string | null = null) {
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, tax_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, transactionCode, "Tên cũ chưa gắn khách", "[]", 0, "Online", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0, taxCode]
  );
}

test("create inserts a new contract from an import row and links the customer matched by name", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-${suffix}`;
  const customerName = `Công ty Import Create ${suffix}`;
  await insertCustomer(`C-IMP-${suffix}`, customerName, `0${String(suffix).slice(-9)}`);
  const row = makeRow({
    transactionCode,
    customerName: customerName.toUpperCase(),
    subscriberCodes: ["0901111111"],
    totalValue: 1000000,
    channel: "Online",
  });

  const result = await importService.commit(
    { decisions: [{ row, action: "create" }] },
    "Admin Test"
  );

  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 0);

  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [
    transactionCode,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customer_id, `C-IMP-${suffix}`);
  assert.equal(rows[0].customer_name, customerName);
  assert.equal(rows[0].tax_code, `0${String(suffix).slice(-9)}`);
  assert.equal(Number(rows[0].total_value), 1000000);
  assert.deepEqual(JSON.parse(rows[0].subscriber_codes), ["0901111111"]);
});

test("create matches the customer by tax code first (Excel-mangled MST included)", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-MST-${suffix}`;
  const taxCode = `03${String(suffix).slice(-8)}`;
  await insertCustomer(`C-MST-${suffix}`, `Công ty Khớp MST ${suffix}`, taxCode);
  const row = makeRow({
    transactionCode,
    customerName: "Tên khác hẳn trong file",
    taxCode: taxCode.slice(1),
    channel: "Online",
  });

  const result = await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");

  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 0);
  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows[0].customer_id, `C-MST-${suffix}`);
  assert.equal(rows[0].customer_name, `Công ty Khớp MST ${suffix}`);
});

test("create fails with a row error when no customer matches", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-NOCUST-${suffix}`;
  const row = makeRow({
    transactionCode,
    customerName: `Công ty Không Có Trong Hệ Thống ${suffix}`,
    taxCode: "0999999999",
    channel: "Online",
  });

  const result = await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");

  assert.equal(result.created, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].message, "Không tìm thấy khách hàng trong hệ thống (MST/tên)");
  const rows = await query<any>("SELECT id FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows.length, 0);
});

test("create fails when transaction_code already exists", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-DUP-${suffix}`;
  const customerName = `Công ty Import Dup ${suffix}`;
  await insertCustomer(`C-DUP-${suffix}`, customerName);
  const row = makeRow({
    transactionCode,
    customerName,
    channel: "Online",
  });

  await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");

  const secondRow = makeRow({
    transactionCode,
    customerName,
    channel: "Online",
  });
  const result = await importService.commit(
    { decisions: [{ row: secondRow, action: "create" }] },
    "Admin Test"
  );

  assert.equal(result.created, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /đã tồn tại/);
});

test("update only overwrites non-empty fields from the import row", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-UPD-${suffix}`;
  const oldName = `Công ty Import Update Cũ ${suffix}`;
  const newName = `Công ty Import Update Mới ${suffix}`;
  await insertCustomer(`C-UPD-OLD-${suffix}`, oldName);
  await insertCustomer(`C-UPD-NEW-${suffix}`, newName);
  const createRow = makeRow({
    transactionCode,
    customerName: oldName,
    channel: "Online",
    packageName: "Gói cũ giữ nguyên",
  });

  await importService.commit({ decisions: [{ row: createRow, action: "create" }] }, "Admin Test");

  const updateRow = makeRow({
    transactionCode,
    customerName: newName,
    channel: "", // rỗng -> không được xóa kênh cũ
    amStaff: "Nguyễn Thị Tình",
  });

  const result = await importService.commit(
    { decisions: [{ row: updateRow, action: "update" }] },
    "Admin Test"
  );

  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);

  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [
    transactionCode,
  ]);
  assert.equal(rows[0].customer_id, `C-UPD-NEW-${suffix}`);
  assert.equal(rows[0].customer_name, newName);
  assert.equal(rows[0].channel, "Online");
  assert.equal(rows[0].package_name, "Gói cũ giữ nguyên");
  assert.equal(rows[0].am_staff, "Nguyễn Thị Tình");
});

test("update keeps the existing customer when the row matches no customer", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-KEEP-${suffix}`;
  const customerName = `Công ty Giữ Khách ${suffix}`;
  await insertCustomer(`C-KEEP-${suffix}`, customerName);
  await importService.commit(
    { decisions: [{ row: makeRow({ transactionCode, customerName, channel: "Online" }), action: "create" }] },
    "Admin Test"
  );

  const updateRow = makeRow({
    transactionCode,
    customerName: `Tên không có trong hệ thống ${suffix}`,
    packageName: "Gói mới",
  });
  const result = await importService.commit({ decisions: [{ row: updateRow, action: "update" }] }, "Admin Test");

  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);
  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows[0].customer_id, `C-KEEP-${suffix}`);
  assert.equal(rows[0].customer_name, customerName);
  assert.equal(rows[0].package_name, "Gói mới");
});

test("update fails for a contract without customer when the row matches no customer", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-LEGACY-${suffix}`;
  await insertContractWithoutCustomer(`HD-LEGACY-${suffix}`, transactionCode);

  const row = makeRow({
    transactionCode,
    customerName: `Tên không có trong hệ thống ${suffix}`,
    packageName: "Gói không được ghi",
  });
  const result = await importService.commit({ decisions: [{ row, action: "update" }] }, "Admin Test");

  assert.equal(result.updated, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].message, "Không tìm thấy khách hàng trong hệ thống (MST/tên)");
  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows[0].customer_id, null);
  assert.equal(rows[0].package_name, null);
});

test("update assigns the matched customer to a contract without customer", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-ASSIGN-${suffix}`;
  const taxCode = `05${String(suffix).slice(-8)}`;
  await insertCustomer(`C-ASSIGN-${suffix}`, `Công ty Gán Khách ${suffix}`, taxCode);
  await insertContractWithoutCustomer(`HD-ASSIGN-${suffix}`, transactionCode);

  const row = makeRow({ transactionCode, customerName: "Tên khác trong file", taxCode });
  const result = await importService.commit({ decisions: [{ row, action: "update" }] }, "Admin Test");

  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);
  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows[0].customer_id, `C-ASSIGN-${suffix}`);
  assert.equal(rows[0].customer_name, `Công ty Gán Khách ${suffix}`);
  assert.equal(rows[0].tax_code, taxCode);
});

test("update fails when transaction_code is not found", async () => {
  const suffix = Date.now();
  const row = makeRow({
    transactionCode: `GD-IMP-NOTFOUND-${suffix}`,
    customerName: "Không tồn tại",
  });

  const result = await importService.commit(
    { decisions: [{ row, action: "update" }] },
    "Admin Test"
  );

  assert.equal(result.updated, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Không tìm thấy/);
});

test("skip does not touch the database", async () => {
  const suffix = Date.now();
  const row = makeRow({
    transactionCode: `GD-IMP-SKIP-${suffix}`,
    customerName: "Bỏ qua",
  });

  const result = await importService.commit(
    { decisions: [{ row, action: "skip" }] },
    "Admin Test"
  );

  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);

  const rows = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [
    row.transactionCode,
  ]);
  assert.equal(rows.length, 0);
});
