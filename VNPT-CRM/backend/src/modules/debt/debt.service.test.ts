import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { DebtService } = await import("./debt.service.js");

await initDatabase();

async function createTestStaff(suffix: string | number): Promise<string> {
  const name = `AM Debt Test ${suffix}`;
  await run("INSERT INTO staff (id, name, code, role, status) VALUES (?, ?, ?, ?, ?)", [
    `STF-DEBT-TEST-${suffix}`,
    name,
    `NV-DEBT-TEST-${suffix}`,
    "AM",
    "Đang hoạt động",
  ]);
  return name;
}

test("createSingle validates month and amounts", async () => {
  const service = new DebtService();
  const suffix = Date.now();
  const staffName = await createTestStaff(suffix);

  const base = {
    staffName,
    serviceGroup: "BRCĐ",
    paymentCode: `PC-${suffix}`,
    subscriberCode: `SUB-${suffix}`,
    customerName: `Khách hàng nợ lẻ ${suffix}`,
    installationAddress: "123 Đường Test",
    immediateDebt: 1_000_000,
    cumulativeDebt: 500_000,
    month: "2026-10",
  };

  // Tháng sai định dạng
  await assert.rejects(
    () => service.createSingle({ ...base, month: "10/2026" }, "Admin"),
    /tháng/i
  );

  // Số tiền âm
  await assert.rejects(
    () => service.createSingle({ ...base, immediateDebt: -1 }, "Admin"),
    /âm/i
  );
  await assert.rejects(
    () => service.createSingle({ ...base, cumulativeDebt: -1 }, "Admin"),
    /âm/i
  );

  // Nhân viên không tồn tại
  await assert.rejects(
    () => service.createSingle({ ...base, staffName: `Không tồn tại ${suffix}` }, "Admin"),
    /nhân viên/i
  );

  // Hợp lệ
  const created = await service.createSingle(base, "Admin");
  assert.equal(created.staff_name, staffName);
  assert.equal(created.status, "Nợ cước");
  assert.equal(Number(created.immediate_debt), 1_000_000);
  assert.equal(Number(created.cumulative_debt), 500_000);
  assert.equal(created.month, "2026-10");

  const rows = await query<{ id: string }>("SELECT id FROM debts WHERE subscriber_code = ?", [
    base.subscriberCode,
  ]);
  assert.equal(rows.length, 1);
});

test("getAll filters by staff and month", async () => {
  const service = new DebtService();
  const suffix = `${Date.now()}-filter`;
  const staffName = await createTestStaff(suffix);

  await service.createSingle(
    {
      staffName,
      serviceGroup: "BRCĐ",
      paymentCode: `PC-${suffix}`,
      subscriberCode: `SUB-${suffix}`,
      customerName: `KH filter ${suffix}`,
      immediateDebt: 100,
      cumulativeDebt: 0,
      month: "2026-11",
    },
    "Admin"
  );

  const rows = await service.getAll({ staff: staffName, month: "2026-11" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].staff_name, staffName);

  const otherMonth = await service.getAll({ staff: staffName, month: "2026-01" });
  assert.equal(otherMonth.length, 0);
});

test("importExcel reads real VNPT export columns (TEN_NV, TEN_TB) — not just the legacy aliases", async () => {
  const XLSX = await import("xlsx");
  const service = new DebtService();
  const suffix = Date.now();

  // Tên cột lấy đúng từ file xuất thật của VNPT ("TẬP NỢ KH1.xlsx"), khác
  // với các alias cũ (TÊN NHÂN VIÊN CHĂM / TEN_THUÊ BAO) đã hỗ trợ trước đó.
  const rows = [
    {
      TEN_NV: "AM Real Export Test",
      NHOM_DV: "DIDONG",
      MA_TT: `PC-REAL-${suffix}`,
      MA_TB: `SUB-REAL-${suffix}`,
      TEN_TB: `KH Real Export ${suffix}`,
      DIACHI_LD: "123 Test Street",
      CONNO_THUNGAY: 50000,
      CONNO_LUYKE: 120000,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "8378");
  const buffer = XLSX.write(wb, { type: "buffer" }) as Buffer;

  const result = await service.importExcel(buffer, "2026-11", "Admin");
  assert.equal(result.importedCount, 1, `Phải nhập được 1 dòng, lỗi: ${JSON.stringify(result.errors)}`);
  assert.equal(result.skippedCount, 0);

  const created = await query<{ customer_name: string; staff_name: string; immediate_debt: number }>(
    "SELECT customer_name, staff_name, immediate_debt FROM debts WHERE subscriber_code = ?",
    [`SUB-REAL-${suffix}`]
  );
  assert.equal(created.length, 1);
  assert.equal(created[0].customer_name, `KH Real Export ${suffix}`);
  assert.equal(created[0].staff_name, "AM Real Export Test");
  assert.equal(Number(created[0].immediate_debt), 50000);
});
