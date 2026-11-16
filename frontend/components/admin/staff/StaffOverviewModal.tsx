"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Search, AlertTriangle, ExternalLink } from "lucide-react";
import StatusBadge from "@/components/admin/shared/StatusBadge";
import AccessBadge from "@/components/admin/staff/AccessBadge";
import { getStaffOverview, type StaffOverview } from "@/lib/api/staff.api";

interface StaffOverviewModalProps {
  staff: { id: string; name: string; code: string; role: string; status: string };
  onClose: () => void;
}

type OverviewTab = "permissions" | "customers";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

const RELATION_STYLES: Record<string, string> = {
  "Bán hàng": "bg-blue-50 text-blue-700",
  CSKH: "bg-violet-50 text-violet-700",
  "Bán hàng + CSKH": "bg-indigo-50 text-indigo-700",
};

export default function StaffOverviewModal({ staff, onClose }: StaffOverviewModalProps) {
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<OverviewTab>("permissions");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getStaffOverview(staff.id);
        if (isMounted) setOverview(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không thể tải thông tin quyền và khách hàng của nhân viên");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [staff.id, reloadKey]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredCustomers = useMemo(() => {
    if (!overview) return [];
    const q = normalize(search.trim());
    if (!q) return overview.customers;
    return overview.customers.filter(
      (c) => normalize(c.name).includes(q) || normalize(c.code ?? "").includes(q)
    );
  }, [overview, search]);

  const stats = overview?.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Quyền và khách hàng của ${staff.name}`}
        data-testid="staff-overview-modal"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900" data-testid="staff-overview-title">
              {staff.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{staff.code}</span>
              <StatusBadge status={staff.role} />
              <StatusBadge status={staff.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            data-testid="staff-overview-close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500" data-testid="staff-overview-loading">
            Đang tải dữ liệu...
          </div>
        ) : error ? (
          <div
            className="m-6 flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-8 text-center"
            data-testid="staff-overview-error"
          >
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <p className="text-sm font-semibold text-rose-700">Không thể tải dữ liệu</p>
            <p className="text-xs text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Thử lại
            </button>
          </div>
        ) : overview && stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 px-6 pt-4 sm:grid-cols-4" data-testid="staff-overview-stats">
              {[
                { id: "customers", label: "Khách hàng", value: stats.customers },
                { id: "leads", label: "Lead", value: stats.leads },
                { id: "orders", label: "Đơn hàng", value: stats.orders },
                { id: "open-tasks", label: "Việc đang mở", value: stats.openTasks },
              ].map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-500">{s.label}</div>
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-${s.id}`}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-1 border-b border-slate-100 px-6" role="tablist">
              {(
                [
                  { id: "permissions", label: "Quyền" },
                  { id: "customers", label: `Khách hàng (${stats.customers})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                    tab === t.id
                      ? "border-vnpt text-vnpt"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {tab === "permissions" ? (
                <div data-testid="permissions-panel">
                  <p className="mb-3 text-xs text-slate-500">
                    Quyền theo vai trò <span className="font-semibold text-slate-700">{overview.staff.role}</span>. Muốn
                    thay đổi quyền, đổi vai trò của nhân viên bằng nút Sửa.
                  </p>
                  {overview.permissions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">Vai trò này chưa có định nghĩa quyền</p>
                  ) : (
                    <table className="w-full text-left text-sm" data-testid="permissions-table">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-3">Chức năng</th>
                          <th className="py-2 pr-3">Mức quyền</th>
                          <th className="py-2">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.permissions.map((p) => (
                          <tr
                            key={p.key}
                            data-testid={`permission-row-${p.key}`}
                            className="border-b border-slate-100 align-top"
                          >
                            <td className="py-2 pr-3 font-semibold text-slate-900">{p.label}</td>
                            <td className="py-2 pr-3">
                              <AccessBadge level={p.level} />
                            </td>
                            <td className="py-2 text-xs text-slate-500">{p.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div data-testid="customers-panel">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="relative w-full max-w-xs">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm theo tên hoặc mã khách hàng..."
                        data-testid="customer-search"
                        className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-vnpt"
                      />
                    </div>
                    <span className="text-xs text-slate-500" data-testid="customers-count">
                      {search.trim()
                        ? `${filteredCustomers.length} / ${overview.customers.length} khách hàng`
                        : `${overview.customers.length} khách hàng`}
                    </span>
                  </div>

                  {overview.customers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500" data-testid="customers-empty">
                      Chưa có khách hàng được giao
                    </p>
                  ) : filteredCustomers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500" data-testid="customers-no-match">
                      Không tìm thấy khách hàng phù hợp
                    </p>
                  ) : (
                    <table className="w-full text-left text-sm" data-testid="customers-table">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-3">Mã KH</th>
                          <th className="py-2 pr-3">Tên khách hàng</th>
                          <th className="py-2 pr-3">Vai trò với KH</th>
                          <th className="py-2 pr-3">Team</th>
                          <th className="py-2 pr-3">Nhóm khách</th>
                          <th className="py-2 text-right">DV đang dùng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((c) => (
                          <tr key={c.id} data-testid="customer-row" className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-mono text-xs text-slate-600">{c.code || "—"}</td>
                            <td className="py-2 pr-3">
                              <Link
                                href={`/admin/customers/${c.id}`}
                                data-testid="customer-link"
                                className="inline-flex items-center gap-1 font-semibold text-vnpt hover:underline"
                              >
                                {c.name}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                            <td className="py-2 pr-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  RELATION_STYLES[c.relation] ?? "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {c.relation}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-slate-600">{c.teamName || "—"}</td>
                            <td className="py-2 pr-3 text-slate-600">{c.customerGroup || "—"}</td>
                            <td className="py-2 text-right font-semibold text-slate-800">{c.activeServices}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
