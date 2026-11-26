import { query, run } from "../../database/db.js";

export const RETENTION_DAYS = 365;
export const WARNING_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RetentionWarningItem {
  type: "debt" | "renewal";
  id: string;
  label: string;
  createdAt: string;
  daysUntilDeletion: number;
}

export class DataRetentionService {
  /**
   * Xóa vĩnh viễn các bản ghi nợ/gia hạn được tạo cách đây hơn `RETENTION_DAYS`
   * ngày (1 năm). Idempotent — gọi lại nhiều lần không xóa thêm gì nếu không có
   * bản ghi mới nào quá hạn.
   */
  async runCleanup(
    now: Date = new Date(),
    operator: string = "Hệ thống"
  ): Promise<{ deletedDebts: number; deletedRenewals: number }> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY).toISOString();

    const debtsResult = await run("DELETE FROM debts WHERE created_at < ?", [cutoff]);
    const renewalsResult = await run("DELETE FROM renewals WHERE created_at < ?", [cutoff]);

    const deletedDebts = debtsResult.changes;
    const deletedRenewals = renewalsResult.changes;

    if (deletedDebts > 0 || deletedRenewals > 0) {
      await run(
        'INSERT INTO audit_logs (id, "user", action, details) VALUES (?, ?, ?, ?)',
        [
          `LOG-${Date.now()}`,
          operator,
          "Tự động xóa dữ liệu quá hạn lưu trữ",
          `Đã xóa ${deletedDebts} bản ghi công nợ và ${deletedRenewals} bản ghi gia hạn tạo trước ${cutoff.slice(
            0,
            10
          )} (quá ${RETENTION_DAYS} ngày lưu trữ).`,
        ]
      );
    }

    return { deletedDebts, deletedRenewals };
  }

  /**
   * Danh sách bản ghi nợ/gia hạn sẽ bị tự động xóa trong vòng
   * `WARNING_WINDOW_DAYS` ngày tới — dùng để hiển thị cảnh báo trên FE trước
   * khi job xóa thật sự chạy.
   */
  async getUpcomingDeletions(now: Date = new Date()): Promise<RetentionWarningItem[]> {
    const warnBoundary = new Date(
      now.getTime() - (RETENTION_DAYS - WARNING_WINDOW_DAYS) * MS_PER_DAY
    ).toISOString();

    const debts = await query<{
      id: string;
      subscriber_code: string;
      customer_name: string;
      created_at: string;
    }>(
      "SELECT id, subscriber_code, customer_name, created_at FROM debts WHERE created_at <= ? ORDER BY created_at ASC",
      [warnBoundary]
    );
    const renewals = await query<{
      id: string;
      transaction_code: string;
      customer_name: string;
      created_at: string;
    }>(
      "SELECT id, transaction_code, customer_name, created_at FROM renewals WHERE created_at <= ? ORDER BY created_at ASC",
      [warnBoundary]
    );

    const daysUntilDeletion = (createdAt: string): number => {
      const deleteAt = new Date(createdAt).getTime() + RETENTION_DAYS * MS_PER_DAY;
      return Math.max(0, Math.ceil((deleteAt - now.getTime()) / MS_PER_DAY));
    };

    const debtItems: RetentionWarningItem[] = debts.map((d) => ({
      type: "debt",
      id: d.id,
      label: `${d.subscriber_code} — ${d.customer_name}`,
      createdAt: d.created_at,
      daysUntilDeletion: daysUntilDeletion(d.created_at),
    }));
    const renewalItems: RetentionWarningItem[] = renewals.map((r) => ({
      type: "renewal",
      id: r.id,
      label: `${r.transaction_code} — ${r.customer_name}`,
      createdAt: r.created_at,
      daysUntilDeletion: daysUntilDeletion(r.created_at),
    }));

    return [...debtItems, ...renewalItems].sort(
      (a, b) => a.daysUntilDeletion - b.daysUntilDeletion
    );
  }
}
