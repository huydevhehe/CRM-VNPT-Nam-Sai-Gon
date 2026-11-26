import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run } = await import("../../database/db.js");
const { dataRetentionSchedulerTick } = await import("./data-retention-scheduler.js");

await initDatabase();

test("scheduler tick chỉ chạy dọn dữ liệu 1 lần/ngày", async () => {
  await run("DELETE FROM retention_state WHERE id = 'default'");

  let runCount = 0;
  const serviceModule = await import("./data-retention.service.js");
  const originalRunCleanup = serviceModule.DataRetentionService.prototype.runCleanup;
  serviceModule.DataRetentionService.prototype.runCleanup = async function (
    ...args: Parameters<typeof originalRunCleanup>
  ) {
    runCount += 1;
    return originalRunCleanup.apply(this, args);
  };

  try {
    const fakeNow = () => new Date("2026-11-20T03:00:00.000Z");
    await dataRetentionSchedulerTick(fakeNow);
    await dataRetentionSchedulerTick(fakeNow);
    await dataRetentionSchedulerTick(fakeNow);

    assert.equal(runCount, 1);
  } finally {
    serviceModule.DataRetentionService.prototype.runCleanup = originalRunCleanup;
    await run("DELETE FROM retention_state WHERE id = 'default'");
  }
});

test("scheduler tick chạy lại khi sang ngày mới (giờ VN)", async () => {
  await run("DELETE FROM retention_state WHERE id = 'default'");

  let runCount = 0;
  const serviceModule = await import("./data-retention.service.js");
  const originalRunCleanup = serviceModule.DataRetentionService.prototype.runCleanup;
  serviceModule.DataRetentionService.prototype.runCleanup = async function (
    ...args: Parameters<typeof originalRunCleanup>
  ) {
    runCount += 1;
    return originalRunCleanup.apply(this, args);
  };

  try {
    await dataRetentionSchedulerTick(() => new Date("2026-11-20T03:00:00.000Z"));
    await dataRetentionSchedulerTick(() => new Date("2026-11-21T03:00:00.000Z"));

    assert.equal(runCount, 2);
  } finally {
    serviceModule.DataRetentionService.prototype.runCleanup = originalRunCleanup;
    await run("DELETE FROM retention_state WHERE id = 'default'");
  }
});
