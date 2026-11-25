import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, query, run } from "../../database/db.js";
import { applySchemaExtensions, backfillRelations } from "../../database/schema-extensions.js";
import { ContractService } from "./contract.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new ContractService();

// AM phát triển là bắt buộc khi tạo đơn: mọi lần reset đều có sẵn một AM mặc định.
const DEFAULT_AM = "AM Mặc Định";

async function resetTestData() {
  await run("DELETE FROM contracts");
  await run("DELETE FROM leads");
  await run("DELETE FROM staff");
  await run("DELETE FROM customers");
  await run(
    "INSERT INTO staff (id, code, name, role, territory, status) VALUES (?, ?, ?, ?, ?, ?)",
    ["S-DEFAULT", "NV-DEF", DEFAULT_AM, "AM", "Phường 1", "ACTIVE"]
  );
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
    prepaidMonths: 12,
    contractTemplate: "hoa_don_dien_tu",
  });

  assert.equal(order.amStaff, "Nguyễn Văn AM");
  assert.equal(order.serviceGroup, "BRCĐ");
  assert.equal(order.paymentMethod, "Trả trước");
  assert.equal(order.prepaidMonths, 12);
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
    amStaff: DEFAULT_AM,
    serviceGroup: "CNTT",
    paymentMethod: "Trả trước",
    prepaidMonths: 6,
    contractTemplate: "hoa_don_dien_tu",
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
    contractTemplate: "hoa_don_dien_tu",
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
    contractTemplate: "hoa_don_dien_tu",
  });

  const updated = await service.updateInfo(
    order.id,
    {
      packageName: "Gói Doanh Nghiệp VIP",
      paymentMethod: "Trả trước",
      prepaidMonths: 12,
      contractNumber: "20261023/0319653211/VNPT.NSG/VNPT026696",
    },
    { role: "admin", name: "Admin" }
  );

  assert.equal(updated.packageName, "Gói Doanh Nghiệp VIP");
  assert.equal(updated.paymentMethod, "Trả trước");
  assert.equal(updated.prepaidMonths, 12);
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
    amStaff: DEFAULT_AM,
    customerId: "C-P1",
    subscriberCodes: ["TB-PAY-1"],
    totalValue: 5000000,
    channel: "Trực tiếp",
    contractTemplate: "hoa_don_dien_tu",
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
    amStaff: DEFAULT_AM,
    customerId: "C-P2",
    subscriberCodes: ["TB-PAY-2"],
    totalValue: 1000000,
    channel: "Trực tiếp",
    contractTemplate: "hoa_don_dien_tu",
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
    amStaff: DEFAULT_AM,
    customerId: "C-P3",
    subscriberCodes: ["TB-PAY-3"],
    totalValue: 3000000,
    channel: "Trực tiếp",
    contractTemplate: "hoa_don_dien_tu",
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
  amStaff: DEFAULT_AM,
  subscriberCodes: ["TB-REQ"],
  totalValue: 1000000,
  channel: "Trực tiếp",
  // T10 (STT 11): mỗi đơn mới bắt buộc chọn mẫu hợp đồng.
  contractTemplate: "hoa_don_dien_tu",
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
    service.create({ ...BASE_INPUT, amStaff: undefined, transactionCode: "GD-SCOPE-1", customerId: "C-OTHER" }, amActor),
    /chỉ được gắn đơn hàng với khách hàng mình đang phụ trách/
  );

  const own = await service.create({ ...BASE_INPUT, amStaff: undefined, transactionCode: "GD-SCOPE-2", customerId: "C-OWN" }, amActor);
  assert.equal(own.customerId, "C-OWN");
  const caring = await service.create({ ...BASE_INPUT, amStaff: undefined, transactionCode: "GD-SCOPE-3", customerId: "C-CARE" }, amActor);
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
  await insertLegacyContractWithoutCustomer("HD-LEGACY-1", "GD-LEGACY-1", DEFAULT_AM);
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

// ---------------------------------------------------------------------------
// STT 6: Hình thức thanh toán — Trả trước kèm số tháng; "Theo giá trị hợp đồng"
// ---------------------------------------------------------------------------

const ADMIN_ACTOR = { role: "Admin", name: "Admin" };

test("create with Trả trước requires prepaid months from 3/6/12/18/24", async () => {
  await resetTestData();
  await insertCustomer("C-PRE", "Khách Trả Trước");

  await assert.rejects(
    service.create({ ...BASE_INPUT, transactionCode: "GD-PRE-1", customerId: "C-PRE", paymentMethod: "Trả trước" }),
    /phải chọn số tháng trả trước/
  );
  for (const bad of [0, 1, 5, 13, 36, "abc"]) {
    await assert.rejects(
      service.create({
        ...BASE_INPUT,
        transactionCode: "GD-PRE-BAD",
        customerId: "C-PRE",
        paymentMethod: "Trả trước",
        prepaidMonths: bad as any,
      }),
      /phải chọn số tháng trả trước/,
      `prepaidMonths=${String(bad)} phải bị từ chối`
    );
  }
  assert.equal((await query("SELECT id FROM contracts")).length, 0);

  for (const months of [3, 6, 12, 18, 24]) {
    const order = await service.create({
      ...BASE_INPUT,
      transactionCode: `GD-PRE-OK-${months}`,
      customerId: "C-PRE",
      paymentMethod: "Trả trước",
      prepaidMonths: months,
    });
    assert.equal(order.prepaidMonths, months);
    assert.equal(order.paymentMethod, "Trả trước");
  }
});

test("other payment methods drop prepaid months; Theo giá trị hợp đồng is accepted", async () => {
  await resetTestData();
  await insertCustomer("C-OTH", "Khách Hình Thức Khác");

  const monthly = await service.create({
    ...BASE_INPUT,
    transactionCode: "GD-OTH-1",
    customerId: "C-OTH",
    paymentMethod: "Trả hàng tháng",
    prepaidMonths: 12,
  });
  assert.equal(monthly.prepaidMonths, null);

  const byContract = await service.create({
    ...BASE_INPUT,
    transactionCode: "GD-OTH-2",
    customerId: "C-OTH",
    paymentMethod: "Theo giá trị hợp đồng",
  });
  assert.equal(byContract.paymentMethod, "Theo giá trị hợp đồng");
  assert.equal(byContract.prepaidMonths, null);

  const none = await service.create({ ...BASE_INPUT, transactionCode: "GD-OTH-3", customerId: "C-OTH" });
  assert.equal(none.paymentMethod, null);
  assert.equal(none.prepaidMonths, null);
});

test("updateInfo: switching to Trả trước needs months; leaving Trả trước clears them", async () => {
  await resetTestData();
  await insertCustomer("C-UPD", "Khách Sửa Hình Thức");
  const order = await service.create({
    ...BASE_INPUT,
    transactionCode: "GD-UPD-1",
    customerId: "C-UPD",
    paymentMethod: "Trả hàng tháng",
  });

  await assert.rejects(
    service.updateInfo(order.id, { paymentMethod: "Trả trước" }, ADMIN_ACTOR),
    /phải chọn số tháng trả trước/
  );
  await assert.rejects(
    service.updateInfo(order.id, { paymentMethod: "Trả trước", prepaidMonths: null }, ADMIN_ACTOR),
    /phải chọn số tháng trả trước/
  );
  await assert.rejects(
    service.updateInfo(order.id, { paymentMethod: "Trả trước", prepaidMonths: 7 }, ADMIN_ACTOR),
    /phải chọn số tháng trả trước/
  );

  const prepaid = await service.updateInfo(order.id, { paymentMethod: "Trả trước", prepaidMonths: 6 }, ADMIN_ACTOR);
  assert.equal(prepaid.prepaidMonths, 6);

  // Sửa trường khác, không gửi hình thức: giữ nguyên số tháng.
  const renamed = await service.updateInfo(order.id, { packageName: "Gói mới" }, ADMIN_ACTOR);
  assert.equal(renamed.prepaidMonths, 6);

  // Đổi số tháng khi vẫn Trả trước.
  const changed = await service.updateInfo(order.id, { paymentMethod: "Trả trước", prepaidMonths: 24 }, ADMIN_ACTOR);
  assert.equal(changed.prepaidMonths, 24);

  // Không được xóa số tháng của đơn đã có số tháng.
  await assert.rejects(
    service.updateInfo(order.id, { paymentMethod: "Trả trước", prepaidMonths: null }, ADMIN_ACTOR),
    /phải chọn số tháng trả trước/
  );

  const byContract = await service.updateInfo(order.id, { paymentMethod: "Theo giá trị hợp đồng", prepaidMonths: 12 }, ADMIN_ACTOR);
  assert.equal(byContract.paymentMethod, "Theo giá trị hợp đồng");
  assert.equal(byContract.prepaidMonths, null);
});

test("legacy Trả trước order without months can still be edited and keeps displaying", async () => {
  await resetTestData();
  await insertCustomer("C-LEG", "Khách Trả Trước Cũ");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, am_staff, payment_method, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["HD-LEG-PRE", "GD-LEG-PRE", "Khách Trả Trước Cũ", "[]", 1000000, "Online", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0, DEFAULT_AM, "Trả trước", "C-LEG"]
  );

  // Form sửa luôn gửi cả hình thức lẫn số tháng (null) khi người dùng không đụng tới.
  const edited = await service.updateInfo(
    "HD-LEG-PRE",
    { packageName: "Gói X", paymentMethod: "Trả trước", prepaidMonths: null },
    ADMIN_ACTOR
  );
  assert.equal(edited.paymentMethod, "Trả trước");
  assert.equal(edited.prepaidMonths, null);
  assert.equal(edited.packageName, "Gói X");

  const filled = await service.updateInfo("HD-LEG-PRE", { prepaidMonths: 12 }, ADMIN_ACTOR);
  assert.equal(filled.prepaidMonths, 12);
});

// ---------------------------------------------------------------------------
// STT 9: AM phát triển bắt buộc
// ---------------------------------------------------------------------------

test("create requires an AM (admin must choose one)", async () => {
  await resetTestData();
  await insertCustomer("C-AM1", "Khách AM");
  const { amStaff: _omit, ...withoutAm } = BASE_INPUT;

  await assert.rejects(
    service.create({ ...withoutAm, transactionCode: "GD-AM-1", customerId: "C-AM1" }, ADMIN_ACTOR),
    { message: "Vui lòng chọn AM phát triển" }
  );
  await assert.rejects(
    service.create({ ...withoutAm, transactionCode: "GD-AM-2", customerId: "C-AM1", amStaff: "   " }, ADMIN_ACTOR),
    { message: "Vui lòng chọn AM phát triển" }
  );
  await assert.rejects(
    service.create({ ...withoutAm, transactionCode: "GD-AM-3", customerId: "C-AM1", amStaff: "Người Không Có" }, ADMIN_ACTOR),
    { message: "Nhân viên AM không tồn tại" }
  );
  assert.equal((await query("SELECT id FROM contracts")).length, 0);

  const ok = await service.create(
    { ...withoutAm, transactionCode: "GD-AM-4", customerId: "C-AM1", amStaff: DEFAULT_AM },
    ADMIN_ACTOR
  );
  assert.equal(ok.amStaff, DEFAULT_AM);
});

test("create by AM is forced to the AM itself; order from a lead without AM must choose one", async () => {
  await resetTestData();
  await insertCustomer("C-AM2", "Khách AM 2", { amStaff: "AM Khoa" });
  const { amStaff: _omit, ...withoutAm } = BASE_INPUT;

  const own = await service.create(
    { ...withoutAm, transactionCode: "GD-AM-5", customerId: "C-AM2" },
    { role: "AM", name: "AM Khoa" }
  );
  assert.equal(own.amStaff, "AM Khoa");

  await assert.rejects(
    service.create({ ...withoutAm, transactionCode: "GD-AM-6", customerId: "C-AM2", amStaff: "AM Tuấn" }, { role: "AM", name: "AM Khoa" }),
    /chỉ được tạo đơn hàng do chính mình phụ trách/
  );

  await run(
    "INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name) VALUES (?, ?, ?, ?, ?, ?)",
    ["L-NOAM", "Lead không AM", "0901111222", "Khách hàng cá nhân", "Online", ""]
  );
  await assert.rejects(
    service.create({ ...withoutAm, transactionCode: "GD-AM-7", customerId: "C-AM2", leadId: "L-NOAM" }, ADMIN_ACTOR),
    { message: "Vui lòng chọn AM phát triển" }
  );
  const chosen = await service.create(
    { ...withoutAm, transactionCode: "GD-AM-8", customerId: "C-AM2", leadId: "L-NOAM", amStaff: DEFAULT_AM },
    ADMIN_ACTOR
  );
  assert.equal(chosen.amStaff, DEFAULT_AM);
});

test("legacy order without AM can be opened but saving requires choosing an AM; status changes still work", async () => {
  await resetTestData();
  await insertCustomer("C-AM3", "Khách AM 3");
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["HD-NOAM", "GD-NOAM", "Khách AM 3", "[]", 1000000, "Online", "Chưa triển khai", "Chưa thanh toán", "Soạn thảo", 0, "C-AM3"]
  );

  const status = await service.updateStatus("HD-NOAM", { deploymentStatus: "Đang triển khai" });
  assert.equal(status.deploymentStatus, "Đang triển khai");
  const paid = await service.addPayment("HD-NOAM", { amount: 1000 }, "Admin Test");
  assert.equal(paid.collectedAmount, 1000);

  await assert.rejects(
    service.updateInfo("HD-NOAM", { packageName: "Gói" }, ADMIN_ACTOR),
    { message: "Vui lòng chọn AM phát triển" }
  );
  await assert.rejects(
    service.updateInfo("HD-NOAM", { packageName: "Gói", amStaff: null }, ADMIN_ACTOR),
    { message: "Vui lòng chọn AM phát triển" }
  );

  const fixed = await service.updateInfo("HD-NOAM", { packageName: "Gói", amStaff: DEFAULT_AM }, ADMIN_ACTOR);
  assert.equal(fixed.amStaff, DEFAULT_AM);
  assert.equal(fixed.packageName, "Gói");
});

test("territory is no longer required for orders", async () => {
  await resetTestData();
  await insertCustomer("C-TER", "Khách Không Phường");
  const order = await service.create({ ...BASE_INPUT, transactionCode: "GD-TER-1", customerId: "C-TER" });
  assert.equal(order.territoryId, null);
});

// --- T6: chi tiết kênh trên Đơn hàng + CTV -> hoa hồng tự động ---

async function insertCtvUser(id: string, name: string, code: string, status: string = "Đang hoạt động") {
  await run(
    "INSERT INTO users (id, username, name, role, status, referral_code) VALUES (?, ?, ?, ?, ?, ?)",
    [id, id, name, "CTV", status, code]
  );
}

async function insertOnlineSource(id: string, name: string) {
  await run(
    "INSERT INTO channel_sources (id, kind, name, active, sort_order, created_at) VALUES (?, 'online', ?, TRUE, 1, ?)",
    [id, name, new Date().toISOString()]
  );
}

test("contract channel detail: Online requires a source, CTV requires an active CTV", async () => {
  await resetTestData();
  await insertCustomer("C-CH1", "Khách Chi Tiết Kênh");
  await insertOnlineSource("CHS-T6-1", "Zalo Ads T6");
  await insertCtvUser("CTV-T6-1", "CTV Test T6", "REF-T6-1");

  await assert.rejects(
    service.create(
      { ...BASE_INPUT, transactionCode: "GD-CH-1", customerId: "C-CH1", channel: "Online" },
      ADMIN_ACTOR
    ),
    /Kênh Online phải chọn nguồn Online/
  );

  const withSource = await service.create(
    {
      ...BASE_INPUT,
      transactionCode: "GD-CH-2",
      customerId: "C-CH1",
      channel: "Online",
      channelSourceId: "CHS-T6-1",
    },
    ADMIN_ACTOR
  );
  assert.equal(withSource.channelSourceId, "CHS-T6-1");
  assert.equal(withSource.channelSourceName, "Zalo Ads T6");

  await assert.rejects(
    service.create(
      { ...BASE_INPUT, transactionCode: "GD-CH-3", customerId: "C-CH1", channel: "CTV giới thiệu" },
      ADMIN_ACTOR
    ),
    /Kênh CTV giới thiệu phải chọn Cộng tác viên/
  );

  const withCtv = await service.create(
    {
      ...BASE_INPUT,
      transactionCode: "GD-CH-4",
      customerId: "C-CH1",
      channel: "CTV giới thiệu",
      referredByCtvId: "CTV-T6-1",
    },
    ADMIN_ACTOR
  );
  assert.equal(withCtv.referredByCtvId, "CTV-T6-1");
});

test("contract created from a Lead inherits channel detail + CTV, editable before save", async () => {
  await resetTestData();
  await insertCustomer("C-CH2", "Khách Kế Thừa Lead");
  await insertCtvUser("CTV-T6-2", "CTV Lead T6", "REF-T6-2");
  await insertCtvUser("CTV-T6-3", "CTV Lead T6 Khác", "REF-T6-3");
  await run(
    `INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name, referred_by_ctv_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["L-CH1", "Khách Kế Thừa Lead", "0909000111", "Lead KH mới", "CTV giới thiệu", DEFAULT_AM, "CTV-T6-2"]
  );

  const inherited = await service.create(
    { ...BASE_INPUT, transactionCode: "GD-CH-5", customerId: "C-CH2", leadId: "L-CH1", channel: "CTV giới thiệu" },
    ADMIN_ACTOR
  );
  assert.equal(inherited.referredByCtvId, "CTV-T6-2");

  // Sửa CTV trước khi lưu (ghi đè chi tiết kế thừa từ Lead).
  await run(
    `INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name, referred_by_ctv_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["L-CH2", "Khách Kế Thừa Lead 2", "0909000112", "Lead KH mới", "CTV giới thiệu", DEFAULT_AM, "CTV-T6-2"]
  );
  const overridden = await service.create(
    {
      ...BASE_INPUT,
      transactionCode: "GD-CH-6",
      customerId: "C-CH2",
      leadId: "L-CH2",
      channel: "CTV giới thiệu",
      referredByCtvId: "CTV-T6-3",
    },
    ADMIN_ACTOR
  );
  assert.equal(overridden.referredByCtvId, "CTV-T6-3");
});

test("CTV commission auto-generates once when a completed order gains a CTV via updateInfo", async () => {
  await resetTestData();
  await insertCustomer("C-CH3", "Khách CTV Hoàn Tất");
  await insertCtvUser("CTV-T6-4", "CTV Hoàn Tất", "REF-T6-4");
  await run("DELETE FROM commissions");

  const order = await service.create(
    { ...BASE_INPUT, transactionCode: "GD-CH-7", customerId: "C-CH3", channel: "Trực tiếp" },
    ADMIN_ACTOR
  );

  const completed = await service.updateStatus(order.id, { deploymentStatus: "Hoàn tất" });
  assert.equal(completed.commissionNotice, "Đơn không có CTV giới thiệu nên không phát sinh hoa hồng.");
  assert.equal((await query("SELECT * FROM commissions WHERE contract_id = ?", [order.id])).length, 0);

  // Gán CTV sau khi đã Hoàn tất -> phải tự sinh hoa hồng (không im lặng, không cần tạo lại trạng thái).
  const withCtv = await service.updateInfo(
    order.id,
    { channel: "CTV giới thiệu", referredByCtvId: "CTV-T6-4" },
    ADMIN_ACTOR
  );
  assert.equal(withCtv.commissionNotice, null);
  const commissions1 = await query<{ id: string; ctv_id: string }>(
    "SELECT * FROM commissions WHERE contract_id = ?",
    [order.id]
  );
  assert.equal(commissions1.length, 1);
  assert.equal(commissions1[0].ctv_id, "CTV-T6-4");

  // Gọi lại updateInfo với cùng CTV (không đổi) -> không tạo thêm hoa hồng.
  await service.updateInfo(order.id, { packageName: "Gói giữ nguyên" }, ADMIN_ACTOR);
  assert.equal((await query("SELECT * FROM commissions WHERE contract_id = ?", [order.id])).length, 1);

  // Đổi sang CTV khác sau khi đã có hoa hồng -> KHÔNG tự ghi đè, chỉ báo thông điệp.
  await insertCtvUser("CTV-T6-5", "CTV Hoàn Tất Khác", "REF-T6-5");
  const switched = await service.updateInfo(
    order.id,
    { referredByCtvId: "CTV-T6-5" },
    ADMIN_ACTOR
  );
  assert.match(switched.commissionNotice ?? "", /đã có hoa hồng CTV khác/);
  const commissions2 = await query<{ ctv_id: string }>(
    "SELECT * FROM commissions WHERE contract_id = ?",
    [order.id]
  );
  assert.equal(commissions2.length, 1);
  assert.equal(commissions2[0].ctv_id, "CTV-T6-4", "không ghi đè hoa hồng đã có");
});

test("getCtvCommissionGaps lists completed CTV orders missing referred_by_ctv_id (read-only)", async () => {
  await resetTestData();
  await insertCustomer("C-CH4", "Khách Thiếu CTV");
  const order = await service.create(
    { ...BASE_INPUT, transactionCode: "GD-CH-8", customerId: "C-CH4", channel: "Trực tiếp" },
    ADMIN_ACTOR
  );
  // Đơn cũ: kênh CTV nhưng không có referred_by_ctv_id (mô phỏng dữ liệu cũ trước khi có form chọn CTV).
  await run("UPDATE contracts SET channel = 'CTV giới thiệu', deployment_status = 'Hoàn tất' WHERE id = ?", [order.id]);

  const gaps = await service.getCtvCommissionGaps();
  assert.ok(gaps.some((g) => g.id === order.id));
  assert.equal((await query("SELECT * FROM commissions WHERE contract_id = ?", [order.id])).length, 0);
});
