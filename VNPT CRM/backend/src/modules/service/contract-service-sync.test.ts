import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions, backfillServicesFromContracts } from "../../database/schema-extensions.js";
import { ContractService } from "../contract/contract.service.js";
import { ServiceService, ServiceServiceError } from "./service.service.js";
import { addMonthsIso, normalizeDateIso, syncServicesFromContract } from "./contract-service-sync.js";

await initDatabase();
await applySchemaExtensions();

const contractService = new ContractService();
const serviceService = new ServiceService();

// AM phát triển là bắt buộc khi tạo đơn mới: các test tạo đơn dùng sẵn một AM mặc định.
const SYNC_DEFAULT_AM = "AM Sync Mặc Định";
await run(
  `INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT (id) DO NOTHING`,
  ["S-SYNC-DEFAULT", "NV-SYNC-DEF", SYNC_DEFAULT_AM, "AM", "Phường 1", "ACTIVE"]
);

let counter = 0;
function uid(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

async function insertCustomer(name: string, amStaff: string | null = null): Promise<string> {
  const id = `C-SYNC-${uid()}`;
  await run(
    `INSERT INTO customers (id, name, type, customer_group, am_staff) VALUES (?, ?, ?, ?, ?)`,
    [id, name, "Doanh nghiệp", "Tự phát triển", amStaff]
  );
  return id;
}

async function servicesOf(customerId: string) {
  return query<any>(
    "SELECT * FROM services WHERE customer_id = ? ORDER BY service_code ASC",
    [customerId]
  );
}

async function customerSummary(customerId: string) {
  const rows = await query<any>("SELECT services, nearest_expiration FROM customers WHERE id = ?", [
    customerId,
  ]);
  return rows[0];
}

async function createOrder(customerId: string, extra: Record<string, unknown> = {}) {
  // amStaff: null = mô phỏng đơn cũ chưa có AM: tạo bằng AM mặc định rồi gỡ AM đi.
  const legacyWithoutAm = extra.amStaff === null;
  const order = await contractService.create({
    transactionCode: `GD-SYNC-${uid()}`,
    subscriberCodes: ["TB-1", "TB-2", "TB-3"],
    totalValue: 1000000,
    channel: "Trực tiếp",
    customerId,
    signedDate: "2026-03-10",
    termMonths: 6,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber",
    packageName: "Home Net 2",
    paymentMethod: "Trả hàng tháng",
    contractTemplate: "hoa_don_dien_tu",
    ...extra,
    amStaff: legacyWithoutAm ? SYNC_DEFAULT_AM : (extra.amStaff ?? SYNC_DEFAULT_AM),
  } as any);
  if (!legacyWithoutAm) return order;
  await run("UPDATE contracts SET am_staff = NULL WHERE id = ?", [order.id]);
  await syncServicesFromContract(order.id);
  return { ...order, amStaff: null };
}

test("addMonthsIso clamps to the end of shorter months", () => {
  assert.equal(addMonthsIso("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsIso("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsIso("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonthsIso("2026-11-30", 12), "2027-11-30");
  assert.equal(addMonthsIso("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonthsIso("2026-03-10", 6), "2026-09-10");
});

test("normalizeDateIso accepts ISO and dd/mm/yyyy, rejects garbage", () => {
  assert.equal(normalizeDateIso("2026-03-10"), "2026-03-10");
  assert.equal(normalizeDateIso("2026-03-10T00:00:00.000Z"), "2026-03-10");
  assert.equal(normalizeDateIso("5/3/2026"), "2026-03-05");
  assert.equal(normalizeDateIso("31/02/2026"), null);
  assert.equal(normalizeDateIso("abc"), null);
  assert.equal(normalizeDateIso(""), null);
});

test("creating an order with 3 subscriber codes creates 3 services", async () => {
  const customerId = await insertCustomer(`KH Sync ${uid()}`, "AM Khách");
  const order = await createOrder(customerId, { amStaff: null });

  assert.equal(order.termMonths, 6);
  const rows = await servicesOf(customerId);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r: any) => r.service_code),
    ["TB-1", "TB-2", "TB-3"]
  );
  for (const r of rows) {
    assert.equal(r.contract_id, order.id);
    assert.equal(r.service_name, "Internet Fiber");
    assert.equal(r.service_group, "BRCĐ");
    assert.equal(r.package_name, "Home Net 2");
    assert.equal(r.payment_type, "Trả hàng tháng");
    assert.equal(r.start_date, "2026-03-10");
    assert.equal(r.expiration_date, "2026-09-10");
    assert.equal(r.staff_name, "AM Khách");
  }

  const summary = await customerSummary(customerId);
  assert.equal(summary.services, "Internet Fiber");

  const listed = await serviceService.listByCustomer(customerId);
  assert.equal(listed[0].contractId, order.id);
  assert.equal(listed[0].transactionCode, order.transactionCode);
});

test("service name falls back to package name then a default; AM of the order wins", async () => {
  const customerId = await insertCustomer(`KH Fallback ${uid()}`, "AM Khách");
  await run("INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)", [
    `S-SYNC-${uid()}`,
    `NV-${uid()}`,
    "AM Đơn Hàng",
    "AM",
    "Phường 1",
    "ACTIVE",
  ]);

  await createOrder(customerId, {
    subscriberCodes: ["TB-A"],
    serviceName: null,
    amStaff: "AM Đơn Hàng",
    transactionCode: `GD-SYNC-A-${uid()}`,
  });
  await createOrder(customerId, {
    subscriberCodes: ["TB-B"],
    serviceName: null,
    packageName: null,
    serviceGroup: null,
    paymentMethod: null,
    amStaff: null,
    transactionCode: `GD-SYNC-B-${uid()}`,
  });

  const [a, b] = await servicesOf(customerId);
  assert.equal(a.service_name, "Home Net 2");
  assert.equal(a.staff_name, "AM Đơn Hàng");
  assert.equal(b.service_name, "Dịch vụ");
  assert.equal(b.service_group, null);
  assert.equal(b.payment_type, null);
  assert.equal(b.staff_name, "AM Khách");
});

test("order without term defaults to 12 months; without signed date uses creation day", async () => {
  const customerId = await insertCustomer(`KH Default ${uid()}`);
  await createOrder(customerId, { subscriberCodes: ["TB-D1"], termMonths: null });
  const [withSigned] = await servicesOf(customerId);
  assert.equal(withSigned.start_date, "2026-03-10");
  assert.equal(withSigned.expiration_date, "2027-03-10");

  const otherCustomer = await insertCustomer(`KH NoDate ${uid()}`);
  await createOrder(otherCustomer, { subscriberCodes: ["TB-D2"], signedDate: null, termMonths: null });
  const [noDate] = await servicesOf(otherCustomer);
  assert.match(noDate.start_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(noDate.expiration_date, addMonthsIso(noDate.start_date, 12));
});

test("end of month term math is applied to generated services", async () => {
  const customerId = await insertCustomer(`KH EOM ${uid()}`);
  await createOrder(customerId, {
    subscriberCodes: ["TB-E"],
    signedDate: "2026-01-31",
    termMonths: 1,
  });
  const [row] = await servicesOf(customerId);
  assert.equal(row.expiration_date, "2026-02-28");
});

test("invalid term months is rejected", async () => {
  const customerId = await insertCustomer(`KH BadTerm ${uid()}`);
  await assert.rejects(() => createOrder(customerId, { termMonths: 0 }), /Thời hạn/);
  await assert.rejects(() => createOrder(customerId, { termMonths: 1.5 }), /Thời hạn/);
});

test("removing a subscriber code removes only that generated service", async () => {
  const customerId = await insertCustomer(`KH Remove ${uid()}`);
  const order = await createOrder(customerId);
  await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Dịch vụ nhập tay",
    serviceCode: "MANUAL-1",
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });

  await contractService.updateInfo(order.id, { subscriberCodes: ["TB-1", "TB-3"] }, { role: "admin" });

  const rows = await servicesOf(customerId);
  assert.deepEqual(
    rows.map((r: any) => r.service_code),
    ["MANUAL-1", "TB-1", "TB-3"]
  );
  const summary = await customerSummary(customerId);
  assert.equal(summary.services.split(", ").length, 2);

  await contractService.updateInfo(order.id, { subscriberCodes: ["TB-1", "TB-3", "TB-4"] }, { role: "admin" });
  assert.equal((await servicesOf(customerId)).length, 4);
});

test("changing term, signed date or order fields re-syncs generated services", async () => {
  const customerId = await insertCustomer(`KH Resync ${uid()}`);
  const order = await createOrder(customerId, { subscriberCodes: ["TB-R"] });

  await contractService.updateInfo(
    order.id,
    { termMonths: 24, signedDate: "2026-05-31", serviceName: "SmartCA", paymentMethod: "Trả trước", prepaidMonths: 12 },
    { role: "admin" }
  );

  const [row] = await servicesOf(customerId);
  assert.equal(row.start_date, "2026-05-31");
  assert.equal(row.expiration_date, "2028-05-31");
  assert.equal(row.service_name, "SmartCA");
  assert.equal(row.payment_type, "Trả trước");
});

test("a subscriber code already on the customer is updated and linked, not duplicated", async () => {
  const customerId = await insertCustomer(`KH Existing ${uid()}`);
  const manual = await serviceService.create({
    customerId,
    serviceGroup: "CNTT",
    serviceName: "Dịch vụ cũ",
    serviceCode: "TB-2",
    paymentType: "Trả trước",
    startDate: "2025-01-01",
    expirationDate: "2025-12-31",
  });

  const order = await createOrder(customerId);

  const rows = await servicesOf(customerId);
  assert.equal(rows.length, 3);
  const reused = rows.find((r: any) => r.service_code === "TB-2");
  assert.equal(reused.id, manual.id);
  assert.equal(reused.contract_id, order.id);
  assert.equal(reused.start_date, "2026-03-10");
  assert.equal(reused.expiration_date, "2026-09-10");
});

test("changing the customer of an order moves generated services and refreshes both summaries", async () => {
  const oldCustomer = await insertCustomer(`KH Old ${uid()}`);
  const newCustomer = await insertCustomer(`KH New ${uid()}`);
  const order = await createOrder(oldCustomer);
  assert.equal((await servicesOf(oldCustomer)).length, 3);

  await contractService.updateInfo(order.id, { customerId: newCustomer }, { role: "admin" });

  assert.equal((await servicesOf(oldCustomer)).length, 0);
  const moved = await servicesOf(newCustomer);
  assert.equal(moved.length, 3);
  assert.equal(moved[0].customer_id, newCustomer);
  assert.match(moved[0].customer_name, /^KH New /);
  assert.equal((await customerSummary(oldCustomer)).services, null);
  assert.ok((await customerSummary(newCustomer)).services);
});

test("moving an order onto a customer that already has the code keeps a single row", async () => {
  const oldCustomer = await insertCustomer(`KH Old2 ${uid()}`);
  const newCustomer = await insertCustomer(`KH New2 ${uid()}`);
  const order = await createOrder(oldCustomer, { subscriberCodes: ["TB-X"] });
  await serviceService.create({
    customerId: newCustomer,
    serviceGroup: "BRCĐ",
    serviceName: "Có sẵn",
    serviceCode: "TB-X",
    paymentType: "Trả trước",
    startDate: "2025-01-01",
    expirationDate: "2025-12-31",
  });

  await contractService.updateInfo(order.id, { customerId: newCustomer }, { role: "admin" });

  assert.equal((await servicesOf(oldCustomer)).length, 0);
  const rows = await servicesOf(newCustomer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contract_id, order.id);
});

test("services generated from an order cannot be edited or deleted by hand", async () => {
  const customerId = await insertCustomer(`KH Locked ${uid()}`);
  const order = await createOrder(customerId, { subscriberCodes: ["TB-L"] });
  const [row] = await servicesOf(customerId);

  await assert.rejects(
    () => serviceService.update(row.id, { expirationDate: "2030-01-01" }),
    (err: unknown) =>
      err instanceof ServiceServiceError &&
      err.status === 400 &&
      err.message.includes(order.transactionCode)
  );
  await assert.rejects(
    () => serviceService.remove(row.id),
    (err: unknown) => err instanceof ServiceServiceError && err.status === 400
  );
  assert.equal((await servicesOf(customerId)).length, 1);
});

test("backfill creates services for existing orders once and is idempotent", async () => {
  const customerId = await insertCustomer(`KH Backfill ${uid()}`);
  const withCustomer = `HD-BF-${uid()}`;
  const withoutCustomer = `HD-BF-NC-${uid()}`;
  const insertOrder = (id: string, custId: string | null, codes: string[]) =>
    run(
      `INSERT INTO contracts (
        id, transaction_code, customer_name, subscriber_codes, total_value, channel,
        deployment_status, payment_status, document_status, has_revenue,
        customer_id, signed_date, service_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, `GD-${id}`, "Tên", JSON.stringify(codes), 0, "Trực tiếp", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0, custId, "2026-02-01", "Chữ ký số"]
    );
  await insertOrder(withCustomer, customerId, ["BF-1", "BF-2"]);
  await insertOrder(withoutCustomer, null, ["BF-9"]);

  await backfillServicesFromContracts();
  const first = await servicesOf(customerId);
  assert.equal(first.length, 2);
  assert.equal(first[0].start_date, "2026-02-01");
  assert.equal(first[0].expiration_date, "2027-02-01");
  assert.equal(first[0].service_name, "Chữ ký số");
  assert.equal((await query<any>("SELECT id FROM services WHERE service_code = 'BF-9'")).length, 0);

  await backfillServicesFromContracts();
  const second = await servicesOf(customerId);
  assert.deepEqual(
    second.map((r: any) => r.id),
    first.map((r: any) => r.id)
  );
  assert.equal((await customerSummary(customerId)).services, "Chữ ký số");
});
