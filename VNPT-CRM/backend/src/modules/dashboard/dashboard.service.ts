import { query } from "../../database/db.js";
import { StaffService } from "../staff/staff.service.js";
import { currentMonthVn } from "../../utils/date-vn.js";
import { DEFAULT_KPI_TARGETS } from "../../constants/org.js";

const staffService = new StaffService();

/** Mục tiêu thu lũy kế (%) của tháng: trung bình chỉ tiêu KPI `thu_luy_ke` của các nhân viên có nợ trong tháng; nhân viên chưa nhập thì dùng mặc định. */
async function getCumulativeCollectionTarget(month: string): Promise<number> {
  const fallback = Number(((DEFAULT_KPI_TARGETS.thu_luy_ke ?? 0) * 100).toFixed(1));
  const staffRows = await query<{ staff_name: string }>(
    "SELECT DISTINCT staff_name FROM debts WHERE month = ? AND staff_name IS NOT NULL",
    [month]
  );
  if (!staffRows.length) return fallback;

  const targetRows = await query<{ staff_name: string; target_rate: number }>(
    "SELECT staff_name, target_rate FROM kpi_targets WHERE month = ? AND kpi_key = 'thu_luy_ke'",
    [month]
  );
  const explicit = new Map(targetRows.map((r) => [r.staff_name.trim(), Number(r.target_rate)]));
  const total = staffRows.reduce(
    (sum, r) => sum + (explicit.get(r.staff_name.trim()) ?? DEFAULT_KPI_TARGETS.thu_luy_ke ?? 0),
    0
  );
  return Number(((total / staffRows.length) * 100).toFixed(1));
}

export class DashboardService {
  async getLiveStats(month: string = currentMonthVn()) {
    // 1. Debt Stats
    const debtRes = await query<{
      totalImmediate: number;
      totalCumulative: number;
      totalCollected: number;
    }>(
      `SELECT
        COALESCE(SUM(immediate_debt), 0) as "totalImmediate",
        COALESCE(SUM(cumulative_debt), 0) as "totalCumulative",
        COALESCE(SUM(collected_amount), 0) as "totalCollected"
      FROM debts WHERE month = ?`,
      [month]
    );

    const { totalImmediate, totalCumulative, totalCollected } = debtRes[0] || {
      totalImmediate: 0,
      totalCumulative: 0,
      totalCollected: 0,
    };

    const collectionRateImmediate =
      totalImmediate > 0 ? Number(((totalCollected / totalImmediate) * 100).toFixed(1)) : 0;
    const collectionRateCumulative =
      totalImmediate + totalCumulative > 0
        ? Number(((totalCollected / (totalImmediate + totalCumulative)) * 100).toFixed(1))
        : 0;

    const collectionRateCumulativeTarget = await getCumulativeCollectionTarget(month);

    // 2. Renewal Stats
    const renewalT = await query<{ total: number; completed: number }>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Hoàn thành' THEN 1 ELSE 0 END) as completed
      FROM renewals WHERE cohort = 'THÁNG T'`
    );
    const renewalT1 = await query<{ total: number; completed: number }>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Hoàn thành' THEN 1 ELSE 0 END) as completed
      FROM renewals WHERE cohort = 'THÁNG T-1'`
    );

    const renewalRateT =
      renewalT[0]?.total > 0
        ? Number(((renewalT[0].completed / renewalT[0].total) * 100).toFixed(1))
        : 0;
    const renewalRateT1 =
      renewalT1[0]?.total > 0
        ? Number(((renewalT1[0].completed / renewalT1[0].total) * 100).toFixed(1))
        : 0;

    // 3. Staff stats — doanh thu tính từ đơn hàng (Đợt 5), không còn đọc số cố định
    // revenue_executed. Xếp hạng theo doanh thu "đã chốt" của tháng đang xem.
    const staffList = (await staffService.getAll({ month })).sort(
      (a, b) => (b.revenue?.closedMonth ?? 0) - (a.revenue?.closedMonth ?? 0)
    );

    // 4. Territory totals
    const territoryRes = await query<{ totalWards: number; totalHouseholds: number; totalDeployed: number }>(
      'SELECT COUNT(*) as "totalWards", SUM(household_count) as "totalHouseholds", SUM(deployed_count) as "totalDeployed" FROM territories'
    );

    // 5. Recent audit logs
    const recentLogs = await query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10");

    return {
      month,
      kpis: {
        collectionRateImmediate,
        collectionRateCumulative,
        collectionRateCumulativeTarget,
        totalImmediateDebtRemaining: Math.max(0, totalImmediate - totalCollected),
        totalCumulativeDebtRemaining: totalCumulative,
        renewalRateT,
        renewalRateT1,
        renewalCompletedT: Number(renewalT[0]?.completed ?? 0),
        renewalTotalT: Number(renewalT[0]?.total ?? 0),
      },
      territorySummary: territoryRes[0],
      staffList,
      recentLogs,
    };
  }
}

