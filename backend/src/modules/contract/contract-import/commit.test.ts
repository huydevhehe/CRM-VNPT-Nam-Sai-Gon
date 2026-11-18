import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, query, run } = await import("../../../database/db.js");
const { ContractImportService } = await import("./contract-import.service.js");
import type { ContractItemInput } from "../contract-items.js";
import type { ContractImportRow } from "./parse.js";

await initDatabase();

const importService = new ContractImportService();

function makeItem(overrides: Partial<ContractItemInput> = {}): ContractItemInput {
  return {
    lineType: "service",
    serviceGroup: null,
    serviceName: null,
    packageName: null,
    subscriberCode: "0901111111",
    quantity: 1,
    unitPrice: 1000000,
    termMonths: null,
    startDate: null,
    note: null,
    ...overrides,
  };
}

function makeRow(overrides: Partial<ContractImportRow> = {}): ContractImportRow {
  const rowNumber = overrides.rowNumber ?? 2;
  return {
    rowNumber,
    rowNumbers: [rowNumber],
    transactionCode: "",
    customerName: "",
    subscriberCodes: [],
    totalValue: null,
    termMonths: null,
    channel: "",
    amStaff: "AM Import",
    serviceGroup: "",
    serviceName: "",
    packageName: "",
    taxCode: "",
    contractNumber: "",
    signedDate: "",
    note: "",
    items: [makeItem()],
    ...overrides,
  } as ContractImportRow;
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

test("create inserts a new contract (1 dòng dịch vụ) and links the customer matched by name", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-${suffix}`;
  const customerName = `Công ty Import Create ${suffix}`;
  await insertCustomer(`C-IMP-${suffix}`, customerName, `0${String(suffix).slice(-9)}`);
  const row = makeRow({
    transactionCode,
    customerName: customerName.toUpperCase(),
    channel: "Online",
    items: [makeItem({ subscriberCode: "0901111111", unitPrice: 1000000 })],
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

  const items = await query<any>(
    "SELECT * FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [rows[0].id]
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].line_type, "service");
  assert.equal(items[0].subscriber_code, "0901111111");
  assert.equal(Number(items[0].amount), 1000000);
});

test("create inserts 2 dịch vụ + 1 thiết bị TOKEN as separate contract_items rows and sums total_value", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-MULTI-${suffix}`;
  const customerName = `Công ty Nhiều Dịch Vụ ${suffix}`;
  await insertCustomer(`C-MULTI-${suffix}`, customerName);
  const row = makeRow({
    rowNumber: 2,
    rowNumbers: [2, 3, 4],
    transactionCode,
    customerName,
    channel: "Online",
    items: [
      makeItem({ subscriberCode: "0911111111", serviceName: "FiberVNN", unitPrice: 300000 }),
      makeItem({ subscriberCode: "0922222222", serviceName: "VNPT CA", unitPrice: 500000 }),
      makeItem({
        lineType: "device",
        subscriberCode: null,
        serviceName: "TOKEN",
        quantity: 1,
        unitPrice: 162000,
      }),
    ],
  });

  const result = await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");
  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 0);

  const contracts = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(contracts.length, 1);
  assert.equal(Number(contracts[0].total_value), 300000 + 500000 + 162000);

  const items = await query<any>(
    "SELECT * FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [contracts[0].id]
  );
  assert.equal(items.length, 3);
  assert.equal(items.filter((i) => i.line_type === "service").length, 2);
  assert.equal(items.filter((i) => i.line_type === "device").length, 1);

  // Thiết bị không sinh dịch vụ; chỉ 2 dòng dịch vụ sinh services.
  const services = await query<any>("SELECT * FROM services WHERE customer_id = ?", [`C-MULTI-${suffix}`]);
  assert.equal(services.length, 2);
});

test("create fails when a service line has a duplicate subscriber code within the same order", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-DUPCODE-${suffix}`;
  const customerName = `Công ty Mã Trùng ${suffix}`;
  await insertCustomer(`C-DUPCODE-${suffix}`, customerName);
  const row = makeRow({
    transactionCode,
    customerName,
    items: [
      makeItem({ subscriberCode: "0933333333", unitPrice: 100000 }),
      makeItem({ subscriberCode: "0933333333", unitPrice: 200000 }),
    ],
  });

  const result = await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");
  assert.equal(result.created, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /trùng/);
  const rows = await query<any>("SELECT id FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(rows.length, 0);
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

test("update only overwrites non-empty header fields from the import row; items untouched when the row has none", async () => {
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
    items: [makeItem({ packageName: "Gói cũ giữ nguyên" })],
  });

  await importService.commit({ decisions: [{ row: createRow, action: "create" }] }, "Admin Test");

  const updateRow = makeRow({
    transactionCode,
    customerName: newName,
    channel: "", // rỗng -> không được xóa kênh cũ
    amStaff: "Nguyễn Thị Tình",
    items: [], // không khai dòng dịch vụ nào trong file -> giữ nguyên dòng cũ
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

  const items = await query<any>("SELECT * FROM contract_items WHERE contract_id = ?", [rows[0].id]);
  assert.equal(items.length, 1); // vẫn là dòng cũ, không bị xóa
});

test("update replaces contract_items entirely when the row declares new items", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-REPL-${suffix}`;
  const customerName = `Công ty Thay Dòng ${suffix}`;
  await insertCustomer(`C-REPL-${suffix}`, customerName);
  await importService.commit(
    {
      decisions: [
        {
          row: makeRow({
            transactionCode,
            customerName,
            channel: "Online",
            items: [makeItem({ subscriberCode: "OLD-CODE", unitPrice: 100000 })],
          }),
          action: "create",
        },
      ],
    },
    "Admin Test"
  );

  const updateRow = makeRow({
    transactionCode,
    customerName,
    items: [
      makeItem({ subscriberCode: "NEW-CODE-1", unitPrice: 200000 }),
      makeItem({ subscriberCode: "NEW-CODE-2", unitPrice: 300000 }),
    ],
  });
  const result = await importService.commit({ decisions: [{ row: updateRow, action: "update" }] }, "Admin Test");
  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);

  const contract = await query<any>("SELECT * FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(Number(contract[0].total_value), 500000);
  const items = await query<any>(
    "SELECT subscriber_code FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [contract[0].id]
  );
  assert.deepEqual(items.map((i) => i.subscriber_code), ["NEW-CODE-1", "NEW-CODE-2"]);
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
    items: [],
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
    items: [],
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

  const row = makeRow({ transactionCode, customerName: "Tên khác trong file", taxCode, items: [] });
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

test("create and update sync one service per subscriber code", async () => {
  const suffix = Date.now();
  const transactionCode = `GD-IMP-SVC-${suffix}`;
  const customerId = `C-SVC-${suffix}`;
  const customerName = `Công ty Import Dịch vụ ${suffix}`;
  await insertCustomer(customerId, customerName);

  const createRow = makeRow({
    transactionCode,
    customerName,
    signedDate: "2026-04-01",
    termMonths: 3,
    items: [
      makeItem({ subscriberCode: "IMP-1", serviceName: "Internet Fiber", unitPrice: 500000 }),
      makeItem({ subscriberCode: "IMP-2", serviceName: "Internet Fiber", unitPrice: 500000 }),
    ],
  });
  const created = await importService.commit({ decisions: [{ row: createRow, action: "create" }] }, "Admin Test");
  assert.equal(created.created, 1);

  let services = await query<any>(
    "SELECT * FROM services WHERE customer_id = ? ORDER BY service_code",
    [customerId]
  );
  assert.deepEqual(services.map((s) => s.service_code), ["IMP-1", "IMP-2"]);
  assert.equal(services[0].start_date, "2026-04-01");
  assert.equal(services[0].expiration_date, "2026-07-01");
  const contract = await query<any>("SELECT term_months FROM contracts WHERE transaction_code = ?", [transactionCode]);
  assert.equal(contract[0].term_months, 3);

  const updateRow = makeRow({
    transactionCode,
    customerName,
    items: [
      makeItem({ subscriberCode: "IMP-2", serviceName: "Internet Fiber", unitPrice: 500000 }),
      makeItem({ subscriberCode: "IMP-3", serviceName: "Internet Fiber", unitPrice: 500000 }),
    ],
  });
  const updated = await importService.commit({ decisions: [{ row: updateRow, action: "update" }] }, "Admin Test");
  assert.equal(updated.updated, 1);

  services = await query<any>("SELECT * FROM services WHERE customer_id = ? ORDER BY service_code", [customerId]);
  assert.deepEqual(services.map((s) => s.service_code), ["IMP-2", "IMP-3"]);
  assert.equal(services[0].expiration_date, "2026-07-01");
});

test("create and update refuse rows without an AM", async () => {
  const suffix = Date.now();
  const customerName = `Công ty Import Thiếu AM ${suffix}`;
  await insertCustomer(`C-NOAM-${suffix}`, customerName);

  const missingCreate = await importService.commit(
    {
      decisions: [
        { row: makeRow({ rowNumber: 2, transactionCode: `GD-NOAM-${suffix}`, customerName, amStaff: "" }), action: "create" },
      ],
    },
    "Admin Test"
  );
  assert.equal(missingCreate.created, 0);
  assert.equal(missingCreate.errors.length, 1);
  assert.match(missingCreate.errors[0].message, /Thiếu AM phát triển/);
  const none = await query("SELECT id FROM contracts WHERE transaction_code = ?", [`GD-NOAM-${suffix}`]);
  assert.equal(none.length, 0);

  await insertContractWithoutCustomer(`HD-NOAM-${suffix}`, `GD-NOAM-UPD-${suffix}`);
  const missingUpdate = await importService.commit(
    {
      decisions: [
        {
          row: makeRow({
            rowNumber: 3,
            transactionCode: `GD-NOAM-UPD-${suffix}`,
            customerName,
            amStaff: "",
            items: [],
          }),
          action: "update",
        },
      ],
    },
    "Admin Test"
  );
  assert.equal(missingUpdate.updated, 0);
  assert.match(missingUpdate.errors[0].message, /Thiếu AM phát triển/);
});
