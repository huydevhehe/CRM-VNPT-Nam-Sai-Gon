"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle, Edit3, Wallet, X } from "lucide-react";
import KpiCard from "@/components/admin/shared/KpiCard";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import StatusSelect from "@/components/admin/shared/StatusSelect";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getCommissions,
  getCommissionReferrerSummary,
  updateCommissionStatus,
  updateCommissionAmount,
  updateCommissionPayout,
} from "@/lib/api/commissions.api";
import { CommissionRecord, ReferrerSummaryRecord } from "@/lib/crm/types/crm.types";
import { TableFilter } from "@/lib/table-filters";

type CommissionTab = "chi-tiet" | "thong-ke";

const COMMISSION_STATUSES: CommissionRecord["status"][] = [
  "Đã nhận",
  "Chờ nhận",
  "Đã chi",
  "Chờ chi",
];

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN")} ₫`;
}

type PayoutState = "none" | "partial" | "full";

/** Trạng thái chi tính từ số liệu: Chưa chi / Chi một phần / Đã chi hết (không lưu DB). */
function getPayoutState(item: Pick<CommissionRecord, "amount" | "paidOutAmount">): PayoutState {
  const paid = item.paidOutAmount ?? 0;
  if (paid <= 0) return "none";
  if (paid >= item.amount) return "full";
  return "partial";
}

const PAYOUT_STATE_META: Record<PayoutState, { label: string; className: string }> = {
  none: { label: "Chưa chi", className: "bg-slate-100 text-slate-600" },
  partial: { label: "Chi một phần", className: "bg-amber-50 text-amber-700" },
  full: { label: "Đã chi hết", className: "bg-emerald-50 text-emerald-700" },
};

function PayoutStateBadge({ item }: { item: Pick<CommissionRecord, "amount" | "paidOutAmount"> }) {
  const state = getPayoutState(item);
  const meta = PAYOUT_STATE_META[state];
  return (
    <span
      data-testid="commission-payout-state"
      data-state={state}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [activeTab, setActiveTab] = useState<CommissionTab>("chi-tiet");

  const [data, setData] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<ReferrerSummaryRecord[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<CommissionRecord | null>(null);
  const [amountInput, setAmountInput] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [payoutItem, setPayoutItem] = useState<CommissionRecord | null>(null);
  const [payoutOverrideInput, setPayoutOverrideInput] = useState<string>("");
  const [payoutAmountInput, setPayoutAmountInput] = useState<string>("");
  const [payoutDateInput, setPayoutDateInput] = useState<string>("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSaving, setPayoutSaving] = useState(false);

  // Tổng hợp từ chính dữ liệu bảng (không dùng số cứng).
  const totals = data.reduce(
    (acc, row) => {
      acc.received += row.amount;
      acc.paid += row.paidOutAmount ?? 0;
      acc[getPayoutState(row)] += 1;
      return acc;
    },
    { received: 0, paid: 0, none: 0, partial: 0, full: 0 }
  );
  const totalRemaining = totals.received - totals.paid;

  function openEditModal(item: CommissionRecord) {
    setEditingItem(item);
    setAmountInput(String(item.amount));
    setNoteInput(item.note ?? "");
    setModalError(null);
  }

  async function handleSaveAmount(e: FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    const val = Number(amountInput);
    if (isNaN(val) || val < 0) {
      setModalError("Số tiền phải là số lớn hơn hoặc bằng 0");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateCommissionAmount(editingItem.id, val, noteInput.trim() || null);
      setData((prev) => prev.map((row) => (row.id === editingItem.id ? updated : row)));
      setEditingItem(null);
      reloadSummary();
    } catch (err: any) {
      setModalError(err.message || "Không thể cập nhật số tiền hoa hồng");
    } finally {
      setSaving(false);
    }
  }

  function openPayoutModal(item: CommissionRecord) {
    setPayoutItem(item);
    setPayoutOverrideInput(
      item.customerPaidOverride !== null && item.customerPaidOverride !== undefined
        ? String(item.customerPaidOverride)
        : ""
    );
    setPayoutAmountInput(String(item.paidOutAmount ?? 0));
    setPayoutDateInput(item.paidOutDate ?? "");
    setPayoutError(null);
  }

  async function handleSavePayout(e: FormEvent) {
    e.preventDefault();
    if (!payoutItem) return;

    const overrideTrimmed = payoutOverrideInput.trim();
    let overrideVal: number | null = null;
    if (overrideTrimmed !== "") {
      overrideVal = Number(overrideTrimmed);
      if (isNaN(overrideVal) || overrideVal < 0) {
        setPayoutError("Số tiền \"Khách đã chi\" phải là số lớn hơn hoặc bằng 0");
        return;
      }
    }

    const amountVal = Number(payoutAmountInput);
    if (isNaN(amountVal) || amountVal < 0) {
      setPayoutError("Số tiền đã chi hoa hồng phải là số lớn hơn hoặc bằng 0");
      return;
    }

    setPayoutSaving(true);
    setPayoutError(null);
    try {
      const updated = await updateCommissionPayout(payoutItem.id, {
        customerPaidOverride: overrideVal,
        paidOutAmount: amountVal,
        paidOutDate: payoutDateInput.trim() || null,
      });
      setData((prev) => prev.map((row) => (row.id === payoutItem.id ? updated : row)));
      setPayoutItem(null);
      reloadSummary();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Không thể cập nhật chi hoa hồng");
    } finally {
      setPayoutSaving(false);
    }
  }

  async function reloadSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const summary = await getCommissionReferrerSummary();
      setSummaryData(summary);
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : "Không thể tải dữ liệu thống kê theo người giới thiệu."
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCommissions() {
      setLoading(true);
      setError(null);
      try {
        const commissions = await getCommissions();
        if (isMounted) {
          setData(commissions);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu Hoa hồng. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCommissions();
    reloadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  // Thứ tự cột theo Global Constraints đợt 4: Mã giao dịch → Người giới thiệu →
  // Khách hàng → Loại → Khách đã chi → Hoa hồng phải chi → Đã chi hoa hồng →
  // Còn lại → Trạng thái → Ngày.
  const columns: Column<CommissionRecord>[] = [
    {
      header: "Mã giao dịch",
      accessorKey: "transactionCode",
      cell: (item) =>
        item.contractId ? (
          <Link
            href={`/admin/contracts?ma=${encodeURIComponent(item.transactionCode)}`}
            className="font-mono font-semibold text-vnpt hover:underline"
          >
            {item.transactionCode}
          </Link>
        ) : (
          <span className="font-mono text-slate-700 font-semibold">
            {item.transactionCode}
          </span>
        ),
    },
    {
      header: "Người giới thiệu",
      accessorKey: "referrerName",
      cell: (item) => (
        <div>
          <span className="font-bold text-slate-900">{item.referrerName ?? "—"}</span>
          {item.referrerCode && (
            <p className="text-[11px] font-mono text-slate-400">{item.referrerCode}</p>
          )}
        </div>
      ),
    },
    {
      header: "Khách hàng",
      accessorKey: "customerName",
      cell: (item) => <span className="text-slate-700">{item.customerName ?? "—"}</span>,
    },
    {
      header: "Loại",
      accessorKey: "type",
      cell: (item) => (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
            item.type === "Hoa hồng nội bộ"
              ? "bg-blue-50 text-blue-700"
              : "bg-purple-50 text-purple-700"
          }`}
        >
          {item.type}
        </span>
      ),
    },
    {
      header: "Khách đã chi",
      accessorKey: "customerPaid",
      cell: (item) => (
        <div>
          <span className="font-semibold text-slate-800">{formatMoney(item.customerPaid)}</span>
          {item.customerPaidOverride !== null && item.customerPaidOverride !== undefined && (
            <p className="text-[11px] text-amber-600">Đã sửa tay</p>
          )}
        </div>
      ),
    },
    {
      header: "Hoa hồng nhận",
      accessorKey: "amount",
      cell: (item) => (
        <div title="Hoa hồng nhận (trước đây gọi là “Hoa hồng phải chi”)">
          <span className="font-bold text-slate-900">{formatMoney(item.amount)}</span>
          {item.note && (
            <p className="text-[11px] text-slate-500 italic mt-0.5">{item.note}</p>
          )}
        </div>
      ),
    },
    {
      header: "Đã chi",
      accessorKey: "paidOutAmount",
      cell: (item) => (
        <div title="Đã chi (trước đây gọi là “Đã chi hoa hồng”)">
          <span className="font-semibold text-slate-800">{formatMoney(item.paidOutAmount)}</span>
          {item.paidOutDate && (
            <p className="text-[11px] text-slate-400">{item.paidOutDate}</p>
          )}
          <div className="mt-0.5">
            <PayoutStateBadge item={item} />
          </div>
        </div>
      ),
    },
    {
      header: "Còn lại",
      accessorKey: "remaining",
      cell: (item) => (
        <div title="Còn lại = Hoa hồng nhận − Đã chi">
          <span className={`font-bold ${item.remaining < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {formatMoney(item.remaining)}
          </span>
          <p className="text-[10px] text-slate-400">= nhận − đã chi</p>
        </div>
      ),
    },
    {
      header: "Trạng thái",
      accessorKey: "status",
      cell: (item) => (
        <StatusSelect
          value={item.status}
          options={COMMISSION_STATUSES}
          onChange={async (next) => {
            const updated = await updateCommissionStatus(item.id, next);
            setData((prev) =>
              prev.map((row) => (row.id === item.id ? updated : row))
            );
          }}
        />
      ),
    },
    {
      header: "Ngày",
      accessorKey: "date",
    },
    ...(isAdmin
      ? [
          {
            header: "Thao tác",
            cell: (item: CommissionRecord) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-vnpt hover:border-vnpt transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  Sửa số tiền
                </button>
                <button
                  type="button"
                  onClick={() => openPayoutModal(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-vnpt hover:border-vnpt transition-colors"
                >
                  <Wallet className="h-3 w-3" />
                  Chi hoa hồng
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const filters: TableFilter<CommissionRecord>[] = [
    { id: "referrerName", label: "Người giới thiệu", getValue: (row) => row.referrerName },
    { id: "type", label: "Loại", getValue: (row) => row.type },
    { id: "status", label: "Trạng thái", getValue: (row) => row.status },
  ];

  const summaryColumns: Column<ReferrerSummaryRecord>[] = [
    {
      header: "Người giới thiệu",
      accessorKey: "referrerName",
      cell: (item) => (
        <div>
          <span className="font-bold text-slate-900">{item.referrerName}</span>
          {item.referrerCode && (
            <p className="text-[11px] font-mono text-slate-400">{item.referrerCode}</p>
          )}
        </div>
      ),
    },
    { header: "Số khách", accessorKey: "customerCount" },
    { header: "Số đơn hàng", accessorKey: "orderCount" },
    {
      header: "Tổng khách đã chi",
      accessorKey: "totalCustomerPaid",
      cell: (item) => formatMoney(item.totalCustomerPaid),
    },
    {
      header: "Tổng hoa hồng nhận",
      accessorKey: "totalCommission",
      cell: (item) => formatMoney(item.totalCommission),
    },
    {
      header: "Tổng đã chi",
      accessorKey: "totalPaidOut",
      cell: (item) => formatMoney(item.totalPaidOut),
    },
    {
      header: "Tổng còn lại",
      accessorKey: "totalRemaining",
      cell: (item) => (
        <span className={`font-bold ${item.totalRemaining < 0 ? "text-rose-600" : "text-emerald-700"}`}>
          {formatMoney(item.totalRemaining)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Quản lý hoa hồng nội bộ & chi kênh
            </h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Theo dõi hoa hồng nhận, số đã chi và số còn lại cho từng đối tác/kênh
          </p>
        </div>
      </div>

      {/* KPI Cards: số thật cộng từ bảng bên dưới */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="commission-kpi-cards">
        <KpiCard
          title="HOA HỒNG NHẬN"
          value={loading ? "—" : formatMoney(totals.received)}
          subtitle={loading ? "Đang tải..." : `Tổng của ${data.length} bản ghi`}
          icon={ArrowDownLeft}
        />
        <KpiCard
          title="ĐÃ CHI"
          value={loading ? "—" : formatMoney(totals.paid)}
          subtitle={
            loading
              ? "Đang tải..."
              : `Chi hết ${totals.full} · một phần ${totals.partial} · chưa chi ${totals.none}`
          }
          icon={ArrowUpRight}
        />
        <KpiCard
          title="CÒN LẠI"
          value={loading ? "—" : formatMoney(totalRemaining)}
          subtitle="Còn lại = Hoa hồng nhận − Đã chi"
          icon={Clock}
        />
        <KpiCard
          title="PHÂN QUYỀN TRUY CẬP"
          value="Bảo mật"
          subtitle="Chỉ tài khoản Admin được xem"
          icon={ShieldAlert}
        />
      </div>

      {/* Giải thích nhãn cho người dùng quen cách gọi cũ */}
      <p className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-slate-600" data-testid="commission-legend">
        <strong className="text-slate-800">Cách đọc:</strong> <strong>Hoa hồng nhận</strong> là số hoa hồng phát sinh của đơn
        (cột cũ “Hoa hồng phải chi”); <strong>Đã chi</strong> là số đã chi trả (cột cũ “Đã chi hoa hồng”);{" "}
        <strong>Còn lại = Hoa hồng nhận − Đã chi</strong>. Nhãn chi: <em>Chưa chi</em> (đã chi = 0),{" "}
        <em>Chi một phần</em> (0 &lt; đã chi &lt; nhận), <em>Đã chi hết</em> (đã chi ≥ nhận).
      </p>

      {/* Tabs */}
      <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("chi-tiet")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "chi-tiet"
              ? "bg-white text-vnpt shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Chi tiết
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("thong-ke")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "thong-ke"
              ? "bg-white text-vnpt shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Thống kê theo người giới thiệu
        </button>
      </div>

      {/* Table */}
      {activeTab === "chi-tiet" ? (
        error ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <p className="text-sm font-semibold text-rose-700">
              Không thể tải dữ liệu Hoa hồng
            </p>
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
            Đang tải dữ liệu Hoa hồng...
          </div>
        ) : (
          <DataTable
            title="Bảng đối soát hoa hồng"
            subtitle="Chi tiết từng giao dịch nhận từ Sales và lệnh chi cho đối tác"
            columns={columns}
            data={data}
            filters={filters}
            searchPlaceholder="Tìm theo người giới thiệu, khách hàng, mã giao dịch..."
            exportFileName="vnpt_hoa_hong"
            pagination
          />
        )
      ) : summaryError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">
            Không thể tải dữ liệu thống kê
          </p>
          <p className="text-xs text-rose-600">{summaryError}</p>
        </div>
      ) : summaryLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải dữ liệu thống kê...
        </div>
      ) : (
        <DataTable
          title="Thống kê theo người giới thiệu"
          subtitle="Số khách, số đơn hàng và tổng tiền theo từng người giới thiệu"
          columns={summaryColumns}
          data={summaryData}
          searchPlaceholder="Tìm theo tên người giới thiệu..."
          exportFileName="vnpt_hoa_hong_thong_ke_nguoi_gioi_thieu"
          pagination
        />
      )}

      {/* Modal Sửa Số Tiền Hoa Hồng (Chỉ dành cho Admin) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Sửa số tiền hoa hồng
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAmount} className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  Đối tượng: <strong className="text-slate-800">{editingItem.recipientName}</strong>
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  Mã GD: <strong className="font-mono text-slate-800">{editingItem.transactionCode}</strong>
                </p>
              </div>

              <div>
                <label className="text-form-label mb-1.5 block text-slate-700">
                  Hoa hồng nhận (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="Nhập số tiền..."
                />
              </div>

              <div>
                <label className="text-form-label mb-1.5 block text-slate-700">
                  Ghi chú công thức / lý do điều chỉnh
                </label>
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="VD: Áp dụng mức 20% theo thoả thuận gói CNTT..."
                />
              </div>

              {modalError && (
                <p className="text-xs font-semibold text-rose-600">{modalError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-vnpt px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-vnpt-darker"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chi Hoa Hồng (Chỉ dành cho Admin): ghi nhận đã chi + ghi đè khách đã chi */}
      {payoutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Chi hoa hồng</h3>
              <button
                type="button"
                onClick={() => setPayoutItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayout} className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  Người giới thiệu: <strong className="text-slate-800">{payoutItem.referrerName ?? "—"}</strong>
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  Mã GD: <strong className="font-mono text-slate-800">{payoutItem.transactionCode}</strong>
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <label className="text-form-label mb-1.5 block text-slate-700">Khách đã chi</label>
                <p className="text-xs text-slate-500 mb-2">
                  Tự tính từ đơn hàng: <strong>{formatMoney(payoutItem.customerPaidAuto)}</strong>
                </p>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={payoutOverrideInput}
                  onChange={(e) => setPayoutOverrideInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-vnpt focus:outline-hidden"
                  placeholder="Sửa tay (để trống = dùng số tự tính)"
                />
              </div>

              <div>
                <label className="text-form-label mb-1.5 block text-slate-700">
                  Đã chi (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={payoutAmountInput}
                  onChange={(e) => setPayoutAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="Nhập số tiền đã chi..."
                />
              </div>

              <div>
                <label className="text-form-label mb-1.5 block text-slate-700">Ngày chi</label>
                <input
                  type="date"
                  value={payoutDateInput}
                  onChange={(e) => setPayoutDateInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 focus:border-vnpt focus:bg-white focus:outline-hidden"
                />
              </div>

              {payoutError && (
                <p className="text-xs font-semibold text-rose-600">{payoutError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutItem(null)}
                  disabled={payoutSaving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={payoutSaving}
                  className="rounded-xl bg-vnpt px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-vnpt-darker"
                >
                  {payoutSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

