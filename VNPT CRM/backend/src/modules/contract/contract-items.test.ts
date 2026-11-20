import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import { backfillContractItemsFromLegacy } from "../../database/schema-extensions.js";
import { ContractService } from "./contract.service.js";
import {
  normalizeContractItems,
  ITEMS_REQUIRED_MESSAGE,
  SUBSCRIBER_CODE_REQUIRED_MESSAGE,
  subscriberCodeDuplicateMessage,
} from "./contract-items.js";

await initDatabase();
await applySchemaExtensions();

const service = new ContractService();
const DEFAULT_AM = "AM T8 Mặc Định";

async function resetTestData() {
  await run("DELETE FROM contract_items");
  await run("DELETE FROM services");
  await run("DELETE FROM contracts");
  await run("DELETE FROM customers");
  await run("DELETE FROM staff");
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-T8-DEFAULT", "NV-T8-DEF", DEFAULT_AM, "AM", "Phường 1", "ACTIVE"]
  );
}

async function insertCustomer(id: string, name: string) {
  await run(
    `INSERT INTO customers (id, name, type, customer_group) VALUES (?, ?, ?, ?)`,
    [id, name, "Doanh nghiệp", "Tự phát triển"]
  );
}

const ADMIN_ACTOR = { role: "Admin", name: "Admin" };

// ---------------------------------------------------------------------------
// normalizeContractItems: hàm thuần validate dòng (unit)
// ---------------------------------------------------------------------------

test("normalizeContractItems rejects empty list", () => {
  assert.throws(() => normalizeContractItems([]), { message: ITEMS_REQUIRED_MESSAGE });
});

test("normalizeContractItems requires subscriberCode for service lines", () => {
  assert.throws(
    () => normalizeContractItems([{ lineType: "service", unitPrice: 100000 }]),
    { message: SUBSCRIBER_CODE_REQUIRED_MESSAGE }
  );
});

test("normalizeContractItems rejects duplicate subscriberCode in the same order", () => {
  assert.throws(
    () =>
      normalizeContractItems([
        { lineType: "service", subscriberCode: "TB-01", unitPrice: 100000 },
        { lineType: "service", subscriberCode: "tb-01", unitPrice: 200000 },
      ]),
    { message: subscriberCodeDuplicateMessage("tb-01") }
  );
});

test("normalizeContractItems: device lines don't need subscriberCode, amount = quantity * unitPrice", () => {
  const items = normalizeContractItems([
    { lineType: "device", unitPrice: 162000, quantity: 2, serviceName: "TOKEN" },
  ]);
  assert.equal(items[0].subscriberCode, null);
  assert.equal(items[0].amount, 324000);
});

// ---------------------------------------------------------------------------
// ContractService.create/updateInfo với `items` nhiều dòng (STT 10)
// ---------------------------------------------------------------------------

test("create with 2 service lines + 1 device: total computed server-side, device creates no service", async () => {
  await resetTestData();
  await insertCustomer("C-T8-1", "Khách Nhiều Dòng");

  const order = await service.create(
    {
      transactionCode: "GD-T8-001",
      channel: "Trực tiếp",
      customerId: "C-T8-1",
      amStaff: DEFAULT_AM,
      contractTemplate: "hoa_don_dien_tu",
      items: [
        { lineType: "service", subscriberCode: "TB-T8-1", serviceName: "Internet Fiber", unitPrice: 500000 },
        { lineType: "service", subscriberCode: "TB-T8-2", serviceName: "Chữ ký số", unitPrice: 300000 },
        { lineType: "device", serviceName: "TOKEN", unitPrice: 162000, quantity: 1 },
      ],
    },
    ADMIN_ACTOR
  );

  assert.equal(order.totalValue, 962000);
  assert.equal(order.items?.length, 3);

  const servicesRows = await query<{ service_code: string }>(
    "SELECT service_code FROM services WHERE contract_id = ? ORDER BY service_code",
    [order.id]
  );
  assert.deepEqual(servicesRows.map((r) => r.service_code), ["TB-T8-1", "TB-T8-2"]);
});

test("create rejects a service line with a totalValue client sends ignored (recomputed from items)", async () => {
  await resetTestData();
  await insertCustomer("C-T8-2", "Khách Tổng Giả", );

  const order = await service.create(
    {
      transactionCode: "GD-T8-002",
      channel: "Trực tiếp",
      customerId: "C-T8-2",
      amStaff: DEFAULT_AM,
      contractTemplate: "hoa_don_dien_tu",
      totalValue: 999999999, // bị bỏ qua vì có items
      items: [{ lineType: "service", subscriberCode: "TB-T8-3", unitPrice: 123000 }],
    },
    ADMIN_ACTOR
  );
  assert.equal(order.totalValue, 123000);
});

test("create rejects duplicate subscriberCode across items (400-style error)", async () => {
  await resetTestData();
  await insertCustomer("C-T8-3", "Khách Trùng Mã");

  await assert.rejects(
    service.create(
      {
        transactionCode: "GD-T8-003",
        channel: "Trực tiếp",
        customerId: "C-T8-3",
        amStaff: DEFAULT_AM,
        contractTemplate: "hoa_don_dien_tu",
        items: [
          { lineType: "service", subscriberCode: "DUP-1", unitPrice: 100000 },
          { lineType: "service", subscriberCode: "DUP-1", unitPrice: 200000 },
        ],
      },
      ADMIN_ACTOR
    ),
    { message: subscriberCodeDuplicateMessage("DUP-1") }
  );
});

test("create rejects a service line missing subscriberCode", async () => {
  await resetTestData();
  await insertCustomer("C-T8-4", "Khách Thiếu Mã");

  await assert.rejects(
    service.create(
      {
        transactionCode: "GD-T8-004",
        channel: "Trực tiếp",
        customerId: "C-T8-4",
        amStaff: DEFAULT_AM,
        contractTemplate: "hoa_don_dien_tu",
        items: [{ lineType: "service", unitPrice: 100000 }],
      },
      ADMIN_ACTOR
    ),
    { message: SUBSCRIBER_CODE_REQUIRED_MESSAGE }
  );
});

test("updateInfo: removing a line updates the corresponding generated service", async () => {
  await resetTestData();
  await insertCustomer("C-T8-5", "Khách Sửa Dòng");

  const order = await service.create(
    {
      transactionCode: "GD-T8-005",
      channel: "Trực tiếp",
      customerId: "C-T8-5",
      amStaff: DEFAULT_AM,
      contractTemplate: "hoa_don_dien_tu",
      items: [
        { lineType: "service", subscriberCode: "TB-T8-5A", unitPrice: 200000 },
        { lineType: "service", subscriberCode: "TB-T8-5B", unitPrice: 300000 },
      ],
    },
    ADMIN_ACTOR
  );
  assert.equal((await query("SELECT id FROM services WHERE contract_id = ?", [order.id])).length, 2);

  const updated = await service.updateInfo(
    order.id,
    {
      items: [{ lineType: "service", subscriberCode: "TB-T8-5A", unitPrice: 200000 }],
    },
    ADMIN_ACTOR
  );
  assert.equal(updated.totalValue, 200000);
  const remaining = await query<{ service_code: string }>(
    "SELECT service_code FROM services WHERE contract_id = ?",
    [order.id]
  );
  assert.deepEqual(remaining.map((r) => r.service_code), ["TB-T8-5A"]);
});

test("order must have at least one line: clearing subscriberCodes to [] is rejected", async () => {
  await resetTestData();
  await insertCustomer("C-T8-6", "Khách Không Dòng");
  const order = await service.create(
    {
      transactionCode: "GD-T8-006",
      channel: "Trực tiếp",
      customerId: "C-T8-6",
      amStaff: DEFAULT_AM,
      contractTemplate: "hoa_don_dien_tu",
      subscriberCodes: ["TB-T8-6"],
      totalValue: 100000,
    },
    ADMIN_ACTOR
  );

  await assert.rejects(
    service.updateInfo(order.id, { subscriberCodes: [] }, ADMIN_ACTOR),
    { message: ITEMS_REQUIRED_MESSAGE }
  );

  // Đơn không đổi (bị chặn trước khi ghi).
  const unchanged = await query<{ subscriber_codes: string }>(
    "SELECT subscriber_codes FROM contracts WHERE id = ?",
    [order.id]
  );
  assert.equal(unchanged[0].subscriber_codes, JSON.stringify(["TB-T8-6"]));
});

// ---------------------------------------------------------------------------
// Payload cũ (1 dịch vụ + mảng mã thuê bao) vẫn chạy được, tự mở rộng
// ---------------------------------------------------------------------------

test("legacy payload (no items) still works and is expanded into contract_items", async () => {
  await resetTestData();
  await insertCustomer("C-T8-7", "Khách Payload Cũ");

  const order = await service.create(
    {
      transactionCode: "GD-T8-007",
      channel: "Trực tiếp",
      customerId: "C-T8-7",
      amStaff: DEFAULT_AM,
      contractTemplate: "hoa_don_dien_tu",
      subscriberCodes: ["TB-T8-7A", "TB-T8-7B", "TB-T8-7C"],
      totalValue: 1000000,
      serviceName: "Dịch vụ cũ",
    },
    ADMIN_ACTOR
  );

  assert.equal(order.totalValue, 1000000);
  const items = await query<{ subscriber_code: string; unit_price: number }>(
    "SELECT subscriber_code, unit_price FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [order.id]
  );
  assert.equal(items.length, 3);
  const sum = items.reduce((s, i) => s + Number(i.unit_price), 0);
  assert.equal(sum, 1000000);

  const servicesRows = await query("SELECT id FROM services WHERE contract_id = ?", [order.id]);
  assert.equal(servicesRows.length, 3);
});

// ---------------------------------------------------------------------------
// Migration dữ liệu cũ: tách contract_items từ subscriber_codes, idempotent
// ---------------------------------------------------------------------------

test("backfillContractItemsFromLegacy splits old orders into service lines once, idempotent on re-run", async () => {
  await resetTestData();
  const id = "HD-T8-LEGACY-1";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, service_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "GD-T8-LEGACY-1",
      "Khách Cũ Trước T8",
      JSON.stringify(["LEG-A", "LEG-B", "LEG-C"]),
      1000000,
      "Trực tiếp",
      "Chưa triển khai",
      "Chưa thanh toán",
      "Soạn thảo",
      0,
      "Dịch vụ cũ",
    ]
  );

  await backfillContractItemsFromLegacy();
  const firstRun = await query<{ id: string; unit_price: number; legacy: boolean }>(
    "SELECT id, unit_price, legacy FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [id]
  );
  assert.equal(firstRun.length, 3);
  assert.ok(firstRun.every((r) => r.legacy === true));
  const total = firstRun.reduce((s, r) => s + Number(r.unit_price), 0);
  assert.equal(total, 1000000);

  // Chạy lại: không nhân đôi (mỗi đơn đã có contract_items thì bị bỏ qua).
  await backfillContractItemsFromLegacy();
  const secondRun = await query<{ id: string }>(
    "SELECT id FROM contract_items WHERE contract_id = ? ORDER BY line_no",
    [id]
  );
  assert.deepEqual(secondRun.map((r) => r.id), firstRun.map((r) => r.id));
});

test("backfillContractItemsFromLegacy: order with zero subscriber codes gets a single legacy line without code", async () => {
  await resetTestData();
  const id = "HD-T8-LEGACY-2";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, "GD-T8-LEGACY-2", "Khách Không Mã", "[]", 500000, "Trực tiếp", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0]
  );

  await backfillContractItemsFromLegacy();
  const rows = await query<{ subscriber_code: string | null; unit_price: number; legacy: boolean }>(
    "SELECT subscriber_code, unit_price, legacy FROM contract_items WHERE contract_id = ?",
    [id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subscriber_code, null);
  assert.equal(Number(rows[0].unit_price), 500000);
  assert.equal(rows[0].legacy, true);
});
