import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions, backfillRelations } from "../../database/schema-extensions.js";
import { ContractService } from "./contract.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new ContractService();

async function resetTestData() {
  await run("DELETE FROM contracts");
  await run("DELETE FROM leads");
  await run("DELETE FROM staff");
  await run("DELETE FROM customers");
}

async function insertCustomer(
  id: string,
  name: string,
  options: { identityCode?: string | null; amStaff?: string | null; amCaringStaff?: string | null } = {}
) {
  await run(
    `INSERT INTO customers (id, name, identity_code, type, customer_group, am_staff, am_caring_staff)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      options.identityCode ?? null,
      "Doanh nghiệp",
      "Tự phát triển",
      options.amStaff ?? null,
      options.amCaringStaff ?? null,
    ]
  );
}

async function insertLegacyContractWithoutCustomer(id: string, transactionCode: string, amStaff: string | null = null) {
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, am_staff
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      transactionCode,
      "Khách Cũ Chưa Gắn",
      JSON.stringify(["TB-LEGACY"]),
      1000000,
      "Trực tiếp",
      "Chưa triển khai",
      "Chưa thanh toán",
      "Soạn thảo",
      0,
      amStaff,
    ]
  );
}

test("create copies AM from lead when amStaff is missing", async () => {
  await resetTestData();
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-1", "NV001", "Nguyễn Văn AM", "AM", "Phường 1", "ACTIVE"]
  );
  await run(
    "INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name) VALUES (?, ?, ?, ?, ?, ?)",
    ["L-1", "Khách Hàng A", "0901234567", "Khách hàng cá nhân", "Trực tiếp", "Nguyễn Văn AM"]
  );
  await insertCustomer("C-A", "Khách Hàng A");

  const order = await service.create({
    transactionCode: "GD-001",
    customerId: "C-A",
    subscriberCodes: ["TB01"],
    totalValue: 5000000,
    channel: "Trực tiếp",
    leadId: "L-1",
    serviceGroup: "BRCĐ",
    paymentMethod: "Trả trước",
  });

  assert.equal(order.amStaff, "Nguyễn Văn AM");
  assert.equal(order.serviceGroup, "BRCĐ");
  assert.equal(order.paymentMethod, "Trả trước");
});

test("create rejects unknown serviceGroup", async () => {
  await resetTestData();
  await insertCustomer("C-B", "Khách Hàng B");
  await assert.rejects(
    async () => {
      await service.create({
        transactionCode: "GD-002",
        customerId: "C-B",
        subscriberCodes: ["TB02"],
        totalValue: 1000000,
        channel: "Trực tiếp",
        serviceGroup: "InvalidGroup" as any,
      });
    },
    { message: "Nhóm dịch vụ không hợp lệ" }
  );
});

test("create rejects unknown paymentMethod", async () => {
  await resetTestData();
  await insertCustomer("C-C", "Khách Hàng C");
  await assert.rejects(
    async () => {
      await service.create({
        transactionCode: "GD-003",
        customerId: "C-C",
        subscriberCodes: ["TB03"],
        totalValue: 1000000,
        channel: "Trực tiếp",
        serviceGroup: "BRCĐ",
        paymentMethod: "InvalidMethod" as any,
      });
    },
    { message: "Hình thức thanh toán không hợp lệ" }
  );
});

test("create fills taxCode from customer if customerId provided and taxCode empty", async () => {
  await resetTestData();
  await run(
    "INSERT INTO customers (id, name, identity_code, type, customer_group) VALUES (?, ?, ?, ?, ?)",
    ["C-1", "Công Ty ABC", "0319653211", "Doanh nghiệp", "KHDN"]
  );

  const order = await service.create({
    transactionCode: "GD-004",
    subscriberCodes: ["TB04"],
    totalValue: 2000000,
    channel: "Trực tiếp",
    customerId: "C-1",
    serviceGroup: "CNTT",
    paymentMethod: "Trả trước",
  });

  assert.equal(order.customerId, "C-1");
  assert.equal(order.taxCode, "0319653211");
  assert.equal(order.customerName, "Công Ty ABC");
});

test("updateInfo by other AM returns 403 forbidden", async () => {
  await resetTestData();
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-1", "NV001", "AM Khoa", "AM", "Phường 1", "ACTIVE"]
  );
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-2", "NV002", "AM Tuấn", "AM", "Phường 2", "ACTIVE"]
  );

  await insertCustomer("C-D", "Khách Hàng D");

  const order = await service.create({
    transactionCode: "GD-005",
    customerId: "C-D",
    subscriberCodes: ["TB05"],
    totalValue: 3000000,
    channel: "Trực tiếp",
    amStaff: "AM Khoa",
    serviceGroup: "Di động",
    paymentMethod: "Trả hàng tháng",
  });

  await assert.rejects(
    async () => {
      await service.updateInfo(
        order.id,
        { packageName: "Gói Mới" },
        { role: "staff", name: "AM Tuấn" }
      );
    },
    { message: "Không có quyền chỉnh sửa đơn hàng này" }
  );
});

test("updateInfo by admin changes package and method", async () => {
  await resetTestData();
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-1", "NV001", "AM Khoa", "AM", "Phường 1", "ACTIVE"]
  );

  await insertCustomer("C-E", "Khách Hàng E");

  const order = await service.create({
    transactionCode: "GD-006",
    customerId: "C-E",
    subscriberCodes: ["TB06"],
    totalValue: 3000000,
    channel: "Trực tiếp",
    amStaff: "AM Khoa",
    serviceGroup: "Di động",
    paymentMethod: "Trả hàng tháng",
  });

  const updated = await service.updateInfo(
    order.id,
    {
      packageName: "Gói Doanh Nghiệp VIP",
      paymentMethod: "Trả trước",
      contractNumber: "20261023/0319653211/VNPT.NSG/VNPT026696",
    },
    { role: "admin", name: "Admin" }
  );

  assert.equal(updated.packageName, "Gói Doanh Nghiệp VIP");
  assert.equal(updated.paymentMethod, "Trả trước");
  assert.equal(updated.contractNumber, "20261023/0319653211/VNPT.NSG/VNPT026696");
});

test("backfill sets am_staff from lead for contracts having lead_id but am_staff null", async () => {
  await resetTestData();
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-1", "NV001", "AM Lan", "AM", "Phường 1", "ACTIVE"]
  );
  await run(
    "INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name) VALUES (?, ?, ?, ?, ?, ?)",
    ["L-2", "Khách Hàng F", "0901234568", "Khách hàng cá nhân", "Trực tiếp", "AM Lan"]
  );

  const id = "HD-BACKFILL-1";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, lead_id, am_staff
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "GD-BF-1",
      "Khách Hàng F",
      JSON.stringify(["TB-BF"]),
      1000000,
      "Trực tiếp",
      "Chưa triển khai",
      "Chưa thanh toán",
      "Soạn thảo",
      0,
      "L-2",
      null,
    ]
  );

  await run("DELETE FROM schema_migrations_state WHERE key = 'contracts_am_staff_backfill_v1'");
  await backfillRelations();

  const rows = await query<{ am_staff: string }>("SELECT am_staff FROM contracts WHERE id = ?", [id]);
  assert.equal(rows[0].am_staff, "AM Lan");
});

test("addPayment accumulates collected amount and marks paid when reaching total", async () => {
  await resetTestData();
  await insertCustomer("C-P1", "Khách Thu Tiền");
  const order = await service.create({
    transactionCode: "GD-PAY-1",
    customerId: "C-P1",
    subscriberCodes: ["TB-PAY-1"],
    totalValue: 5000000,
    channel: "Trực tiếp",
  });

  // Lần 1: thu 2.000.000
  const after1 = await service.addPayment(
    order.id,
    { amount: 2000000, paidDate: "2026-11-13", note: "Thu đợt 1" },
    "Admin Test"
  );
  assert.equal(after1.collectedAmount, 2000000);
  assert.equal(after1.paymentStatus, "Chưa thanh toán");

  // Lần 2: thu thêm 3.000.000 -> đủ 5.000.000 -> tự thành Đã thanh toán
  const after2 = await service.addPayment(
    order.id,
    { amount: 3000000, paidDate: "2026-11-14", note: "Thu đợt 2 đủ tiền" },
    "Admin Test"
  );
  assert.equal(after2.collectedAmount, 5000000);
  assert.equal(after2.paymentStatus, "Đã thanh toán");

  const payments = await service.listPayments(order.id);
  assert.equal(payments.length, 2);
  assert.equal(payments[0].amount, 2000000);
  assert.equal(payments[1].amount, 3000000);
});

test("addPayment rejects zero or negative amount", async () => {
  await resetTestData();
  await insertCustomer("C-P2", "Khách Zero");
  const order = await service.create({
    transactionCode: "GD-PAY-2",
    customerId: "C-P2",
    subscriberCodes: ["TB-PAY-2"],
    totalValue: 1000000,
    channel: "Trực tiếp",
  });

  await assert.rejects(
    async () => {
      await service.addPayment(order.id, { amount: 0 }, "Admin Test");
    },
    { message: "Số tiền thu phải lớn hơn 0" }
  );

  await assert.rejects(
    async () => {
      await service.addPayment(order.id, { amount: -500000 }, "Admin Test");
    },
    { message: "Số tiền thu phải lớn hơn 0" }
  );
});

test("deletePayment recomputes collected amount and updates payment status", async () => {
  await resetTestData();
  await insertCustomer("C-P3", "Khách Xóa Thu");
  const order = await service.create({
    transactionCode: "GD-PAY-3",
    customerId: "C-P3",
    subscriberCodes: ["TB-PAY-3"],
    totalValue: 3000000,
    channel: "Trực tiếp",
  });

  await service.addPayment(order.id, { amount: 3000000 }, "Admin Test");
  const list = await service.listPayments(order.id);
  assert.equal(list.length, 1);

  const afterDelete = await service.deletePayment(list[0].id);
  assert.equal(afterDelete.collectedAmount, 0);
  assert.equal(afterDelete.paymentStatus, "Chưa thanh toán");
});

test("backfill creates payment for paid orders without existing payments", async () => {
  await resetTestData();
  const id = "HD-PAID-BF-1";
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, collected_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "GD-PAID-BF",
      "Khách Đã Trả",
      JSON.stringify(["TB-PAID"]),
      4500000,
      "Trực tiếp",
      "Hoàn tất",
      "Đã thanh toán",
      "Hoàn thiện bàn giao",
      1,
      0,
    ]
  );

  await run("DELETE FROM schema_migrations_state WHERE key = 'contract_payments_backfill_v1'");
  await run("DELETE FROM contract_payments");
  await backfillRelations();

  const payments = await service.listPayments(id);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, 4500000);

  const orderRows = await query<{ collected_amount: number }>("SELECT collected_amount FROM contracts WHERE id = ?", [id]);
  assert.equal(Number(orderRows[0].collected_amount), 4500000);
});

const BASE_INPUT = {
  subscriberCodes: ["TB-REQ"],
  totalValue: 1000000,
  channel: "Trực tiếp",
};

test("create requires customerId", async () => {
  await resetTestData();
  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-REQ-1" }),
    /Vui lòng chọn Khách hàng/
  );
  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-REQ-2", customerName: "Tên tự do", customerId: "  " }),
    /Vui lòng chọn Khách hàng/
  );
  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-REQ-3", customerId: null }),
    /Vui lòng chọn Khách hàng/
  );

  const rows = await query("SELECT id FROM contracts");
  assert.equal(rows.length, 0);
});

test("create rejects customerId that does not exist", async () => {
  await resetTestData();
  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-REQ-4", customerId: "C-KHONG-CO" }),
    { message: "Khách hàng không tồn tại" }
  );
});

test("create derives customer_name and tax code from the selected customer", async () => {
  await resetTestData();
  await insertCustomer("C-DERIVE", "Công Ty Suy Ra", { identityCode: "0101234567" });

  const order = await service.create({
    ...BASE_INPUT,
    transactionCode: "GD-DERIVE",
    customerName: "Tên nhập tay phải bị bỏ qua",
    customerId: "C-DERIVE",
  });

  assert.equal(order.customerId, "C-DERIVE");
  assert.equal(order.customerName, "Công Ty Suy Ra");
  assert.equal(order.taxCode, "0101234567");

  const rows = await query<{ customer_name: string }>("SELECT customer_name FROM contracts WHERE id = ?", [order.id]);
  assert.equal(rows[0].customer_name, "Công Ty Suy Ra");
});

test("create by AM only accepts customers within the AM scope", async () => {
  await resetTestData();
  await insertCustomer("C-OWN", "Khách Của Tôi", { amStaff: "AM Khoa" });
  await insertCustomer("C-CARE", "Khách Tôi Chăm Sóc", { amStaff: "AM Tuấn", amCaringStaff: "AM Khoa" });
  await insertCustomer("C-OTHER", "Khách Người Khác", { amStaff: "AM Tuấn", amCaringStaff: "AM Tuấn" });
  const amActor = { role: "AM", name: "AM Khoa" };

  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-SCOPE-1", customerId: "C-OTHER" }, amActor),
    /chỉ được gắn đơn hàng với khách hàng mình đang phụ trách/
  );

  const own = await service.create({ ...BASE_INPUT, transactionCode: "GD-SCOPE-2", customerId: "C-OWN" }, amActor);
  assert.equal(own.customerId, "C-OWN");
  const caring = await service.create({ ...BASE_INPUT, transactionCode: "GD-SCOPE-3", customerId: "C-CARE" }, amActor);
  assert.equal(caring.customerId, "C-CARE");

  const byAdmin = await service.create(
    { ...BASE_INPUT, transactionCode: "GD-SCOPE-4", customerId: "C-OTHER" },
    { role: "Admin", name: "Admin" }
  );
  assert.equal(byAdmin.customerId, "C-OTHER");
});

test("updateInfo on a legacy order without customer requires choosing a customer", async () => {
  await resetTestData();
  await insertCustomer("C-FIX", "Khách Bổ Sung", { identityCode: "0309999999" });
  await insertLegacyContractWithoutCustomer("HD-LEGACY-1", "GD-LEGACY-1");
  const admin = { role: "admin", name: "Admin" };

  await assert.rejects(
    service.updateInfo("HD-LEGACY-1", { packageName: "Gói Mới" }, admin),
    /Vui lòng chọn Khách hàng/
  );
  await assert.rejects(
    service.updateInfo("HD-LEGACY-1", { customerId: null }, admin),
    /Vui lòng chọn Khách hàng/
  );

  const unchanged = await query<{ customer_id: string | null; package_name: string | null }>(
    "SELECT customer_id, package_name FROM contracts WHERE id = ?",
    ["HD-LEGACY-1"]
  );
  assert.equal(unchanged[0].customer_id, null);
  assert.equal(unchanged[0].package_name, null);

  const fixed = await service.updateInfo(
    "HD-LEGACY-1",
    { customerId: "C-FIX", packageName: "Gói Mới" },
    admin
  );
  assert.equal(fixed.customerId, "C-FIX");
  assert.equal(fixed.customerName, "Khách Bổ Sung");
  assert.equal(fixed.taxCode, "0309999999");
  assert.equal(fixed.packageName, "Gói Mới");
});

test("updateInfo keeps the linked customer and rejects clearing it", async () => {
  await resetTestData();
  await insertCustomer("C-KEEP", "Khách Giữ", { identityCode: "0300000001", amStaff: "AM Khoa" });
  await insertCustomer("C-NEW", "Khách Mới", { identityCode: "0300000002", amStaff: "AM Tuấn" });
  const order = await service.create({
    ...BASE_INPUT,
    transactionCode: "GD-KEEP",
    customerId: "C-KEEP",
  });
  const admin = { role: "Admin", name: "Admin" };

  const edited = await service.updateInfo(order.id, { packageName: "Gói X" }, admin);
  assert.equal(edited.customerId, "C-KEEP");
  assert.equal(edited.customerName, "Khách Giữ");

  await assert.rejects(
    service.updateInfo(order.id, { customerId: "" }, admin),
    /Vui lòng chọn Khách hàng/
  );
  await assert.rejects(
    service.updateInfo(order.id, { customerId: "C-KHONG-CO" }, admin),
    { message: "Khách hàng không tồn tại" }
  );

  const switched = await service.updateInfo(order.id, { customerId: "C-NEW" }, admin);
  assert.equal(switched.customerId, "C-NEW");
  assert.equal(switched.customerName, "Khách Mới");
  assert.equal(switched.taxCode, "0300000002");
});

test("updateInfo by owner AM can only switch to a customer within scope", async () => {
  await resetTestData();
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-1", "NV001", "AM Khoa", "AM", "Phường 1", "ACTIVE"]
  );
  await insertCustomer("C-MINE", "Khách Của Khoa", { amStaff: "AM Khoa" });
  await insertCustomer("C-MINE-2", "Khách Của Khoa 2", { amCaringStaff: "AM Khoa" });
  await insertCustomer("C-NOT-MINE", "Khách Người Khác", { amStaff: "AM Tuấn" });
  const amActor = { role: "AM", name: "AM Khoa" };
  const order = await service.create(
    { ...BASE_INPUT, transactionCode: "GD-OWNER", customerId: "C-MINE", amStaff: "AM Khoa" },
    amActor
  );

  const sameCustomer = await service.updateInfo(order.id, { packageName: "Gói" }, amActor);
  assert.equal(sameCustomer.customerId, "C-MINE");

  await assert.rejects(
    service.updateInfo(order.id, { customerId: "C-NOT-MINE" }, amActor),
    /chỉ được gắn đơn hàng với khách hàng mình đang phụ trách/
  );

  const switched = await service.updateInfo(order.id, { customerId: "C-MINE-2" }, amActor);
  assert.equal(switched.customerId, "C-MINE-2");
});

test("updateStatus and addPayment still work on legacy orders without customer", async () => {
  await resetTestData();
  await insertLegacyContractWithoutCustomer("HD-LEGACY-2", "GD-LEGACY-2");

  const withStatus = await service.updateStatus("HD-LEGACY-2", { deploymentStatus: "Đang triển khai" });
  assert.equal(withStatus.deploymentStatus, "Đang triển khai");
  assert.equal(withStatus.customerId, null);

  const withPayment = await service.addPayment("HD-LEGACY-2", { amount: 500000 }, "Admin Test");
  assert.equal(withPayment.collectedAmount, 500000);
});
