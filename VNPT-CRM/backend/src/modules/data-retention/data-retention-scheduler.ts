import { query, run } from "../../database/db.js";
import { todayVn } from "../../utils/date-vn.js";
import { DataRetentionService } from "./data-retention.service.js";

const TICK_INTERVAL_MS = 60 * 60 * 1000; // 1 giờ
const INITIAL_DELAY_MS = 2 * 60 * 1000; // 2 phút sau khởi động

const service = new DataRetentionService();

async function getLastRunDate(): Promise<string | null> {
  const rows = await query<{ last_run_date: string | null }>(
    "SELECT last_run_date FROM retention_state WHERE id = 'default'"
  );
  return rows[0]?.last_run_date ?? null;
}

async function saveRunResult(
  date: string,
  deletedDebts: number,
  deletedRenewals: number
): Promise<void> {
  await run(
    `INSERT INTO retention_state (id, last_run_date, last_deleted_debts, last_deleted_renewals)
     VALUES ('default', ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       last_run_date = EXCLUDED.last_run_date,
       last_deleted_debts = EXCLUDED.last_deleted_debts,
       last_deleted_renewals = EXCLUDED.last_deleted_renewals`,
    [date, deletedDebts, deletedRenewals]
  );
}

/**
 * Một lần kiểm tra: nếu hôm nay (giờ VN) chưa chạy dọn dữ liệu quá hạn lưu
 * trữ thì chạy `DataRetentionService.runCleanup()`. Dùng riêng cho test (gọi
 * trực tiếp với `now` giả) và cho `setInterval` thật.
 */
export async function dataRetentionSchedulerTick(now: () => Date = () => new Date()): Promise<void> {
  try {
    const current = now();
    const today = todayVn(current);
    const lastRunDate = await getLastRunDate();
    if (lastRunDate === today) return;

    const result = await service.runCleanup(current, "Hệ thống (tự động)");
    await saveRunResult(today, result.deletedDebts, result.deletedRenewals);
  } catch (error) {
    console.error("[DataRetentionScheduler] Lỗi khi dọn dữ liệu quá hạn lưu trữ:", error);
  }
}

/**
 * Khởi động bộ hẹn giờ trong tiến trình: kiểm tra mỗi giờ (+ 1 lần sau khởi
 * động 2 phút). Không dùng thư viện cron ngoài — chỉ `setInterval`, theo
 * đúng quy ước của `reminder-scheduler.ts`. Không chạy khi
 * `NODE_ENV === 'test'`.
 */
export function startDataRetentionScheduler(now: () => Date = () => new Date()): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  setTimeout(() => {
    void dataRetentionSchedulerTick(now);
  }, INITIAL_DELAY_MS);

  setInterval(() => {
    void dataRetentionSchedulerTick(now);
  }, TICK_INTERVAL_MS);
}
