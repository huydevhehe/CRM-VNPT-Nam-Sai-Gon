import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { CustomerService } = await import("../customer/customer.service.js");
const { ServiceService, ServiceServiceError } = await import("./service.service.js");

await initDatabase();

async function createTestCustomer(suffix: string | number, amCaringStaff?: string) {
  const customerService = new CustomerService();
  const result = await customerService.create({
    name: `KH Dịch Vụ ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amCaringStaff,
  });
  return result.customer.id as string;
}

test("create service links customer and updates customer summary", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix, "Nguyễn Thị Tình");

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: `Internet Fiber ${suffix}`,
    serviceCode: `FTTH-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-01-01",
    expirationDate: "2027-12-31",
  });

  assert.equal(service.customerId, customerId);
  assert.equal(service.staffName, "Nguyễn Thị Tình");

  const rows = await query<any>("SELECT services, nearest_expiration FROM customers WHERE id = ?", [
    customerId,
  ]);
  assert.equal(rows[0].services, `Internet Fiber ${suffix}`);
  assert.equal(rows[0].nearest_expiration, "2027-12-31");
});

test("create rejects end before start", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  await assert.rejects(
    async () => {
      await serviceService.create({
        customerId,
        serviceGroup: "BRCĐ",
        serviceName: "Test",
        serviceCode: "X",
        paymentType: "Trả trước",
        startDate: "2026-06-01",
        expirationDate: "2026-01-01",
      });
    },
    (err: any) => {
      assert.ok(err instanceof ServiceServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("backfill links only unique name matches", async () => {
  const suffix = Date.now();
  const uniqueName = `KH Backfill Duy Nhất ${suffix}`;
  const dupName = `KH Backfill Trùng ${suffix}`;

  await run(
    "INSERT INTO customers (id, name, type, customer_group) VALUES (?, ?, ?, ?)",
    [`CUS-BF-U-${suffix}`, uniqueName, "Doanh nghiệp", "Tự phát triển"]
  );
  await run(
    "INSERT INTO customers (id, name, type, customer_group) VALUES (?, ?, ?, ?)",
    [`CUS-BF-D1-${suffix}`, dupName, "Doanh nghiệp", "Tự phát triển"]
  );
  await run(
    "INSERT INTO customers (id, name, type, customer_group) VALUES (?, ?, ?, ?)",
    [`CUS-BF-D2-${suffix}`, dupName, "Doanh nghiệp", "Tự phát triển"]
  );

  await run(
    `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`SRV-BF-U-${suffix}`, uniqueName, "Internet", `FTTH-U-${suffix}`, "2026-01-01", "2026-12-31", "AM Test"]
  );
  await run(
    `INSERT INTO services (id, customer_name, service_name, service_code, start_date, expiration_date, staff_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`SRV-BF-D-${suffix}`, dupName, "Internet", `FTTH-D-${suffix}`, "2026-01-01", "2026-12-31", "AM Test"]
  );

  const { backfillServiceCustomerIds } = await import("../../database/schema-extensions.js");
  await backfillServiceCustomerIds();

  const uniqueRows = await query<any>("SELECT customer_id FROM services WHERE id = ?", [
    `SRV-BF-U-${suffix}`,
  ]);
  const dupRows = await query<any>("SELECT customer_id FROM services WHERE id = ?", [
    `SRV-BF-D-${suffix}`,
  ]);

  assert.equal(uniqueRows[0].customer_id, `CUS-BF-U-${suffix}`);
  assert.equal(dupRows[0].customer_id, null);
});

test("listByCustomer returns all services of customer", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber",
    serviceCode: `A-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });
  await serviceService.create({
    customerId,
    serviceGroup: "CNTT",
    serviceName: "Hóa đơn điện tử",
    serviceCode: `B-${suffix}`,
    paymentType: "Trả hàng tháng",
    startDate: "2026-02-01",
    expirationDate: "2027-01-31",
  });

  const list = await serviceService.listByCustomer(customerId);
  assert.equal(list.length, 2);
  assert.ok(list.every((s) => s.customerId === customerId));
});

test("remove (tắt cảnh báo) không xóa dịch vụ khỏi tóm tắt khách hàng, chỉ bỏ khỏi nearest_expiration", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber Xóa",
    serviceCode: `DEL-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });

  await serviceService.remove(service.id);

  const rows = await query<any>("SELECT services, nearest_expiration FROM customers WHERE id = ?", [
    customerId,
  ]);
  assert.equal(rows[0].services, "Internet Fiber Xóa", "dữ liệu dịch vụ của khách không bị mất/giảm");
  assert.equal(rows[0].nearest_expiration, null, "dịch vụ đã tắt cảnh báo không còn tính vào nearest_expiration");
});

test("remove không xóa thật dữ liệu — chỉ đánh archived (soft delete), bản ghi vẫn còn trong DB", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber Soft Delete",
    serviceCode: `SOFT-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });

  await serviceService.remove(service.id);

  const rows = await query<any>("SELECT id, archived_at FROM services WHERE id = ?", [service.id]);
  assert.equal(rows.length, 1, "bản ghi dịch vụ phải vẫn còn trong DB, không bị DELETE thật");
  assert.ok(rows[0].archived_at, "phải có archived_at sau khi xóa");
});

test("getAll (trang Dịch vụ & Cảnh báo) không trả về dịch vụ đã archived", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber Archived GetAll",
    serviceCode: `GA-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });
  await serviceService.remove(service.id);

  const all = await serviceService.getAll({});
  assert.ok(!all.some((s) => s.id === service.id));
});

test("listByCustomer vẫn trả về dịch vụ đã archived, có đánh dấu isArchived để FE hiển thị mờ", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  const service = await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber Archived ByCustomer",
    serviceCode: `LBC-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });
  await serviceService.remove(service.id);

  const list = await serviceService.listByCustomer(customerId);
  const found = list.find((s) => s.id === service.id);
  assert.ok(found, "dịch vụ đã archived vẫn phải còn hiển thị trên hồ sơ khách hàng");
  assert.equal(found!.isArchived, true);
});

test("remove không cho xóa dịch vụ sinh từ hợp đồng (vẫn giữ nguyên hành vi cũ)", async () => {
  const serviceService = new ServiceService();
  const suffix = Date.now();
  const customerId = await createTestCustomer(suffix);

  await serviceService.create({
    customerId,
    serviceGroup: "BRCĐ",
    serviceName: "Internet Fiber Có Hợp Đồng",
    serviceCode: `CONTRACT-${suffix}`,
    paymentType: "Trả trước",
    startDate: "2026-01-01",
    expirationDate: "2026-12-31",
  });
  const rows = await query<any>("SELECT id FROM services WHERE service_code = ?", [
    `CONTRACT-${suffix}`,
  ]);
  await run("UPDATE services SET contract_id = ? WHERE id = ?", [`CTR-${suffix}`, rows[0].id]);

  await assert.rejects(
    async () => {
      await serviceService.remove(rows[0].id);
    },
    (err: any) => {
      assert.ok(err instanceof ServiceServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});
