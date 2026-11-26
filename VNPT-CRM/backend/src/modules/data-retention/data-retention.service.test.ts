import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { DataRetentionService, RETENTION_DAYS } = await import("./data-retention.service.js");

await initDatabase();

const service = new DataRetentionService();

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function insertDebt(id: string, createdAt: string) {
  await run(
    `INSERT INTO debts (
      id, staff_name, service_group, payment_code, subscriber_code,
      customer_name, installation_address, immediate_debt, cumulative_debt,
      status, month, created_at, updated_at
    ) VALUES (?, 'NV Test', 'BRCĐ', 'PC-1', ?, 'KH Test Retention', '', 0, 0, 'Nợ cước', '2026-01', ?, ?)`,
    [id, id, createdAt, createdAt]
  );
}

async function insertRenewal(id: string, createdAt: string) {
  await run(
    `INSERT INTO renewals (
      id, transaction_code, subscriber_code, customer_name, payment_code,
      installation_address, staff_name, term_amount, duration_months,
      cohort, status, created_at, updated_at
    ) VALUES (?, ?, ?, 'KH Test Retention', 'PC-1', '', 'NV Test', 100000, 12, 'THÁNG T', 'Chưa xử lý', ?, ?)`,
    [id, id, id, createdAt, createdAt]
  );
}

test("runCleanup xóa bản ghi nợ/gia hạn tạo quá 1 năm, giữ lại bản ghi còn mới", async () => {
  const oldId = `DEBT-RET-OLD-${Date.now()}`;
  const freshId = `DEBT-RET-FRESH-${Date.now()}`;
  const oldRenewalId = `RN-RET-OLD-${Date.now()}`;
  const freshRenewalId = `RN-RET-FRESH-${Date.now()}`;

  await insertDebt(oldId, daysAgoIso(RETENTION_DAYS + 5));
  await insertDebt(freshId, daysAgoIso(10));
  await insertRenewal(oldRenewalId, daysAgoIso(RETENTION_DAYS + 5));
  await insertRenewal(freshRenewalId, daysAgoIso(10));

  const result = await service.runCleanup(new Date(), "Test");

  assert.ok(result.deletedDebts >= 1);
  assert.ok(result.deletedRenewals >= 1);

  const remainingOldDebt = await query("SELECT id FROM debts WHERE id = ?", [oldId]);
  const remainingFreshDebt = await query("SELECT id FROM debts WHERE id = ?", [freshId]);
  const remainingOldRenewal = await query("SELECT id FROM renewals WHERE id = ?", [oldRenewalId]);
  const remainingFreshRenewal = await query("SELECT id FROM renewals WHERE id = ?", [freshRenewalId]);

  assert.equal(remainingOldDebt.length, 0, "bản ghi nợ quá hạn phải bị xóa");
  assert.equal(remainingFreshDebt.length, 1, "bản ghi nợ còn mới không được xóa");
  assert.equal(remainingOldRenewal.length, 0, "bản ghi gia hạn quá hạn phải bị xóa");
  assert.equal(remainingFreshRenewal.length, 1, "bản ghi gia hạn còn mới không được xóa");

  const auditRows = await query<{ details: string }>(
    "SELECT details FROM audit_logs WHERE action = 'Tự động xóa dữ liệu quá hạn lưu trữ' ORDER BY id DESC LIMIT 1"
  );
  assert.equal(auditRows.length, 1, "phải ghi audit log khi có xóa");
});

test("runCleanup không làm gì và không ghi audit log khi không có bản ghi nào quá hạn", async () => {
  const auditCountBefore = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM audit_logs WHERE action = 'Tự động xóa dữ liệu quá hạn lưu trữ'"
  );

  const freshId = `DEBT-RET-NOCLEANUP-${Date.now()}`;
  await insertDebt(freshId, daysAgoIso(1));

  const result = await service.runCleanup(new Date(), "Test");
  assert.equal(result.deletedDebts, 0);

  const auditCountAfter = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM audit_logs WHERE action = 'Tự động xóa dữ liệu quá hạn lưu trữ'"
  );
  assert.equal(Number(auditCountAfter[0].count), Number(auditCountBefore[0].count));
});

test("getUpcomingDeletions trả về bản ghi sắp bị xóa trong 30 ngày tới, không trả về bản ghi còn quá mới", async () => {
  const soonId = `DEBT-RET-SOON-${Date.now()}`;
  const freshId = `DEBT-RET-FAR-${Date.now()}`;

  // Tuổi 340 ngày -> còn 25 ngày nữa mới đủ 365 ngày -> nằm trong cửa sổ cảnh báo 30 ngày.
  await insertDebt(soonId, daysAgoIso(RETENTION_DAYS - 25));
  // Tuổi 10 ngày -> còn rất lâu mới bị xóa -> không được liệt kê.
  await insertDebt(freshId, daysAgoIso(10));

  const warnings = await service.getUpcomingDeletions(new Date());
  const ids = warnings.map((w) => w.id);

  assert.ok(ids.includes(soonId), "bản ghi sắp hết hạn lưu trữ phải nằm trong danh sách cảnh báo");
  assert.ok(!ids.includes(freshId), "bản ghi còn mới không được liệt kê cảnh báo");

  const soonWarning = warnings.find((w) => w.id === soonId)!;
  assert.ok(soonWarning.daysUntilDeletion <= 30 && soonWarning.daysUntilDeletion >= 20);
});
