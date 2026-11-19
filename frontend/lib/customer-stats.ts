export interface StatServiceInput {
  /** null = dịch vụ không có thời hạn (vd: hóa đơn điện tử). */
  expirationDate: string | null;
}

export interface StatContractInput {
  totalValue: number;
  collectedAmount?: number | null;
  deploymentStatus: string;
}

export interface CustomerStats {
  activeServices: number;
  expiringServices: number;
  totalOrders: number;
  completedOrders: number;
  totalValue: number;
  collected: number;
  outstanding: number;
}

export const EXPIRING_WINDOW_DAYS = 30;

/** Số ngày còn lại tới ngày hết hạn (làm tròn lên); NaN nếu ngày không hợp lệ. */
export function daysUntil(expirationDate: string, now: Date = new Date()): number {
  return Math.ceil((new Date(expirationDate).getTime() - now.getTime()) / 86400000);
}

export function isExpiringSoon(expirationDate: string, now: Date = new Date()): boolean {
  const days = daysUntil(expirationDate, now);
  return days >= 0 && days <= EXPIRING_WINDOW_DAYS;
}

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function computeCustomerStats(
  services: StatServiceInput[],
  contracts: StatContractInput[],
  now: Date = new Date()
): CustomerStats {
  // Dịch vụ không có thời hạn (expirationDate null) luôn tính là đang hoạt động,
  // không bao giờ tính "sắp hết hạn".
  const activeServices = services.filter(
    (s) => s.expirationDate === null || daysUntil(s.expirationDate, now) >= 0
  ).length;
  const expiringServices = services.filter(
    (s) => s.expirationDate !== null && isExpiringSoon(s.expirationDate, now)
  ).length;

  const totalValue = contracts.reduce((sum, c) => sum + toAmount(c.totalValue), 0);
  const collected = contracts.reduce((sum, c) => sum + toAmount(c.collectedAmount), 0);

  return {
    activeServices,
    expiringServices,
    totalOrders: contracts.length,
    completedOrders: contracts.filter((c) => c.deploymentStatus === "Hoàn tất").length,
    totalValue,
    collected,
    outstanding: Math.max(0, totalValue - collected),
  };
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}
