import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, query, run } = await import("../../../database/db.js");
const { ServiceImportService } = await import("./service-import.service.js");

await initDatabase();

const importService = new ServiceImportService();
const suffix = Date.now();
const AM_SALES = `AM Bán Hàng ${suffix}`;
const AM_CARING = `AM CSKH ${suffix}`;
const AM_FILE = `AM Trong File ${suffix}`;

await run("INSERT INTO staff (id, code, name, role) VALUES (?, ?, ?, ?)", [
  `S-IMP-1-${suffix}`,
  `IMP1-${suffix}`,
  AM_SALES,
  "AM",
]);
await run("INSERT INTO staff (id, code, name, role) VALUES (?, ?, ?, ?)", [
  `S-IMP-2-${suffix}`,
  `IMP2-${suffix}`,
  AM_CARING,
  "AM",
]);
await run("INSERT INTO staff (id, code, name, role) VALUES (?, ?, ?, ?)", [
  `S-IMP-3-${suffix}`,
  `IMP3-${suffix}`,
  AM_FILE,
  "AM",
]);

let counter = 0;

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rowNumber: 2,
    customerCode: "",
    taxCode: "",
    customerName: "",
    serviceCode: `SUB-${suffix}-${++counter}`,
    serviceName: "FiberVNN",
    serviceGroup: "",
    packageName: "",
    paymentType: "",
    startDate: "",
    endDate: "",
    termMonths: null,
    amStaff: "",
    ...overrides,
  } as any;
}

async function insertCustomer(
  id: string,
  name: string,
  opts: { code?: string; amStaff?: string | null; amCaring?: string | null } = {}
) {
  await run(
    `INSERT INTO customers (id, name, type, customer_group, customer_code, am_staff, am_caring_staff)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, "Doanh nghiệp", "Tự phát triển", opts.code ?? null, opts.amStaff ?? null, opts.amCaring ?? null]
  );
}

async function insertService(id: string, customerId: string, code: string, extra: Record<string, unknown> = {}) {
  await run(
    `INSERT INTO services (
      id, customer_name, service_name, service_code, start_date, expiration_date, staff_name,
      customer_id, service_group, package_name, payment_type, contract_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "Tên cũ",
      (extra.serviceName as string) ?? "Dịch vụ cũ",
      code,
      "2025-01-01",
      "2026-01-01",
      "Người cũ",
      customerId,
      "BRCĐ",
      "Gói cũ",
      "Trả trước",
      (extra.contractId as string) ?? null,
    ]
  );
}

test("create inserts a service for the matched customer, defaults staff to sales AM and refreshes the summary", async () => {
  const customerId = `C-SI-CREATE-${suffix}`;
  await insertCustomer(customerId, `Công ty Dịch Vụ ${suffix}`, {
    code: `KH-CR-${suffix}`,
    amStaff: AM_SALES,
    amCaring: AM_CARING,
  });
  const row = makeRow({
    customerCode: `KH-CR-${suffix}`.toLowerCase(),
    serviceCode: `SUB-CREATE-${suffix}`,
    serviceName: "FiberVNN",
    serviceGroup: "BRCĐ",
    paymentType: "Trả trước",
    packageName: "Home Net 2",
    startDate: "2030-01-31",
    termMonths: 1,
  });

  const result = await importService.commit({ decisions: [{ row, action: "create" }] }, "Admin Test");

  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 0);
  const services = await query<any>("SELECT * FROM services WHERE customer_id = ?", [customerId]);
  assert.equal(services.length, 1);
  assert.equal(services[0].service_code, `SUB-CREATE-${suffix}`);
  assert.equal(services[0].customer_name, `Công ty Dịch Vụ ${suffix}`);
  assert.equal(services[0].service_group, "BRCĐ");
  assert.equal(services[0].package_name, "Home Net 2");
  assert.equal(services[0].payment_type, "Trả trước");
  assert.equal(services[0].start_date, "2030-01-31");
  assert.equal(services[0].expiration_date, "2030-02-28");
  assert.equal(services[0].staff_name, AM_SALES);
  assert.equal(services[0].contract_id, null);

  const customer = await query<any>("SELECT services, nearest_expiration FROM customers WHERE id = ?", [customerId]);
  assert.equal(customer[0].services, "FiberVNN");
  assert.equal(customer[0].nearest_expiration, "2030-02-28");

  const logs = await query<any>("SELECT * FROM audit_logs WHERE action = ? AND \"user\" = ?", [
    "Nhập dịch vụ từ Excel",
    "Admin Test",
  ]);
  assert.ok(logs.length >= 1);
});

test("staff defaults to the caring AM when no sales AM, and the AM in the file wins", async () => {
  const caringOnly = `C-SI-CARE-${suffix}`;
  const withFile = `C-SI-FILE-${suffix}`;
  await insertCustomer(caringOnly, `Công ty Chỉ CSKH ${suffix}`, { amCaring: AM_CARING });
  await insertCustomer(withFile, `Công ty Có AM File ${suffix}`, { amStaff: AM_SALES });

  const result = await importService.commit(
    {
      decisions: [
        { row: makeRow({ rowNumber: 2, customerName: `Công ty Chỉ CSKH ${suffix}` }), action: "create" },
        {
          row: makeRow({ rowNumber: 3, customerName: `Công ty Có AM File ${suffix}`, amStaff: AM_FILE }),
          action: "create",
        },
      ],
    },
    "Admin Test"
  );

  assert.equal(result.created, 2);
  const [a] = await query<any>("SELECT staff_name FROM services WHERE customer_id = ?", [caringOnly]);
  const [b] = await query<any>("SELECT staff_name FROM services WHERE customer_id = ?", [withFile]);
  assert.equal(a.staff_name, AM_CARING);
  assert.equal(b.staff_name, AM_FILE);
});

test("update only overwrites non-empty columns and keeps the old dates when the file has none", async () => {
  const customerId = `C-SI-UPD-${suffix}`;
  await insertCustomer(customerId, `Công ty Cập Nhật ${suffix}`, { code: `KH-UP-${suffix}`, amStaff: AM_SALES });
  const code = `SUB-UPD-${suffix}`;
  await insertService(`SRV-SI-UPD-${suffix}`, customerId, code);

  const row = makeRow({
    customerCode: `KH-UP-${suffix}`,
    serviceCode: code,
    serviceName: "Tên mới",
    paymentType: "Trả hàng tháng",
  });
  const result = await importService.commit({ decisions: [{ row, action: "update" }] }, "Admin Test");

  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);
  const services = await query<any>("SELECT * FROM services WHERE customer_id = ?", [customerId]);
  assert.equal(services.length, 1);
  assert.equal(services[0].service_name, "Tên mới");
  assert.equal(services[0].payment_type, "Trả hàng tháng");
  assert.equal(services[0].service_group, "BRCĐ");
  assert.equal(services[0].package_name, "Gói cũ");
  assert.equal(services[0].start_date, "2025-01-01");
  assert.equal(services[0].expiration_date, "2026-01-01");
  assert.equal(services[0].staff_name, "Người cũ");
  assert.equal(services[0].customer_name, `Công ty Cập Nhật ${suffix}`);

  const customer = await query<any>("SELECT services FROM customers WHERE id = ?", [customerId]);
  assert.equal(customer[0].services, "Tên mới");
});

test("skip writes nothing", async () => {
  const customerId = `C-SI-SKIP-${suffix}`;
  await insertCustomer(customerId, `Công ty Bỏ Qua ${suffix}`);

  const result = await importService.commit(
    { decisions: [{ row: makeRow({ customerName: `Công ty Bỏ Qua ${suffix}` }), action: "skip" }] },
    "Admin Test"
  );

  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);
  assert.equal((await query<any>("SELECT id FROM services WHERE customer_id = ?", [customerId])).length, 0);
});

test("does not trust the preview: create on an existing code errors, update on a missing code errors", async () => {
  const customerId = `C-SI-TRUST-${suffix}`;
  await insertCustomer(customerId, `Công ty Không Tin Preview ${suffix}`);
  const code = `SUB-TRUST-${suffix}`;
  await insertService(`SRV-SI-TRUST-${suffix}`, customerId, code);

  const result = await importService.commit(
    {
      decisions: [
        {
          row: makeRow({ rowNumber: 2, customerName: `Công ty Không Tin Preview ${suffix}`, serviceCode: code }),
          action: "create",
        },
        {
          row: makeRow({
            rowNumber: 3,
            customerName: `Công ty Không Tin Preview ${suffix}`,
            serviceCode: `SUB-MISSING-${suffix}`,
          }),
          action: "update",
        },
        {
          row: makeRow({ rowNumber: 4, customerName: `Công ty Không Tồn Tại ${suffix}` }),
          action: "create",
        },
      ],
    },
    "Admin Test"
  );

  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.deepEqual(
    result.errors.map((e) => e.rowNumber),
    [2, 3, 4]
  );
  assert.match(result.errors[0].message, /đã có mã thuê bao này/);
  assert.match(result.errors[1].message, /Không tìm thấy dịch vụ để cập nhật/);
  assert.equal(result.errors[2].message, "Không tìm thấy khách hàng trong hệ thống");
  assert.equal((await query<any>("SELECT id FROM services WHERE customer_id = ?", [customerId])).length, 1);
});

test("a subscriber code generated from an order is rejected and left untouched", async () => {
  const customerId = `C-SI-ORDER-${suffix}`;
  await insertCustomer(customerId, `Công ty Có Đơn Hàng ${suffix}`);
  const contractId = `HD-SI-${suffix}`;
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contractId, `GD-SI-${suffix}`, "Tên", "[]", 0, "Online", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0, customerId]
  );
  const code = `SUB-ORDER-${suffix}`;
  await insertService(`SRV-SI-ORDER-${suffix}`, customerId, code, { contractId, serviceName: "Từ đơn hàng" });

  const result = await importService.commit(
    {
      decisions: [
        {
          row: makeRow({ customerName: `Công ty Có Đơn Hàng ${suffix}`, serviceCode: code, serviceName: "Ghi đè" }),
          action: "update",
        },
      ],
    },
    "Admin Test"
  );

  assert.equal(result.updated, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].message, `Mã thuê bao thuộc đơn hàng GD-SI-${suffix}, vui lòng chỉnh ở đơn hàng`);
  const [service] = await query<any>("SELECT service_name FROM services WHERE id = ?", [`SRV-SI-ORDER-${suffix}`]);
  assert.equal(service.service_name, "Từ đơn hàng");
});

test("two rows with the same customer + code in one commit: the later row wins, one record", async () => {
  const customerId = `C-SI-DUP-${suffix}`;
  await insertCustomer(customerId, `Công ty Trùng Trong File ${suffix}`);
  const code = `SUB-DUP-${suffix}`;
  const common = { customerName: `Công ty Trùng Trong File ${suffix}`, serviceCode: code };

  const result = await importService.commit(
    {
      decisions: [
        { row: makeRow({ ...common, rowNumber: 3, serviceName: "Dòng sau" }), action: "create" },
        { row: makeRow({ ...common, rowNumber: 2, serviceName: "Dòng trước" }), action: "create" },
      ],
    },
    "Admin Test"
  );

  assert.equal(result.created, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.errors.length, 0);
  const services = await query<any>("SELECT service_name FROM services WHERE customer_id = ?", [customerId]);
  assert.equal(services.length, 1);
  assert.equal(services[0].service_name, "Dòng sau");
});

test("rejects invalid group, payment type, AM and dates at commit time", async () => {
  const customerId = `C-SI-INVALID-${suffix}`;
  await insertCustomer(customerId, `Công ty Dữ Liệu Sai ${suffix}`);
  const name = `Công ty Dữ Liệu Sai ${suffix}`;

  const result = await importService.commit(
    {
      decisions: [
        { row: makeRow({ rowNumber: 2, customerName: name, serviceGroup: "Khác" }), action: "create" },
        { row: makeRow({ rowNumber: 3, customerName: name, paymentType: "Trả sau" }), action: "create" },
        { row: makeRow({ rowNumber: 4, customerName: name, amStaff: "Người lạ" }), action: "create" },
        {
          row: makeRow({ rowNumber: 5, customerName: name, startDate: "2026-05-01", endDate: "2026-04-01" }),
          action: "create",
        },
        { row: { rowNumber: 6, customerName: name, serviceCode: 12345, serviceName: null }, action: "create" },
      ],
    },
    "Admin Test"
  );

  assert.equal(result.created, 0);
  assert.equal(result.errors.length, 5);
  assert.equal((await query<any>("SELECT id FROM services WHERE customer_id = ?", [customerId])).length, 0);
});

test("rejects an empty decision list", async () => {
  await assert.rejects(() => importService.commit({ decisions: [] }, "Admin Test"), /không được để trống/);
});
