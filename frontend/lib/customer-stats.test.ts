import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCustomerStats, formatVnd } from "./customer-stats";

const NOW = new Date("2026-11-16T03:00:00.000Z");

test("computeCustomerStats returns zeros (no NaN) for a customer without data", () => {
  const stats = computeCustomerStats([], [], NOW);
  assert.deepEqual(stats, {
    activeServices: 0,
    expiringServices: 0,
    totalOrders: 0,
    completedOrders: 0,
    totalValue: 0,
    collected: 0,
    outstanding: 0,
  });
});

test("computeCustomerStats counts active and expiring services", () => {
  const stats = computeCustomerStats(
    [
      { expirationDate: "2026-11-10" },
      { expirationDate: "2026-11-16" },
      { expirationDate: "2026-12-10" },
      { expirationDate: "2027-06-01" },
      { expirationDate: "khong-hop-le" },
    ],
    [],
    NOW
  );
  assert.equal(stats.activeServices, 3);
  assert.equal(stats.expiringServices, 2);
});

test("computeCustomerStats: dịch vụ không thời hạn (null) luôn là active, không bao giờ sắp hết hạn", () => {
  const stats = computeCustomerStats(
    [{ expirationDate: null }, { expirationDate: "2026-11-16" }],
    [],
    NOW
  );
  assert.equal(stats.activeServices, 2);
  assert.equal(stats.expiringServices, 1);
});

test("computeCustomerStats sums order value, collected and outstanding", () => {
  const stats = computeCustomerStats(
    [],
    [
      { totalValue: 10_000_000, collectedAmount: 4_000_000, deploymentStatus: "Hoàn tất" },
      { totalValue: 5_000_000, collectedAmount: undefined, deploymentStatus: "Đang triển khai" },
      { totalValue: 2_500_000, collectedAmount: null, deploymentStatus: "Hoàn tất" },
    ],
    NOW
  );
  assert.equal(stats.totalOrders, 3);
  assert.equal(stats.completedOrders, 2);
  assert.equal(stats.totalValue, 17_500_000);
  assert.equal(stats.collected, 4_000_000);
  assert.equal(stats.outstanding, 13_500_000);
});

test("computeCustomerStats never reports a negative outstanding amount", () => {
  const stats = computeCustomerStats(
    [],
    [{ totalValue: 1_000_000, collectedAmount: 3_000_000, deploymentStatus: "Hoàn tất" }],
    NOW
  );
  assert.equal(stats.outstanding, 0);
});

test("formatVnd appends the dong sign", () => {
  assert.match(formatVnd(0), /^0 đ$/);
  assert.ok(formatVnd(1500000).endsWith(" đ"));
});
