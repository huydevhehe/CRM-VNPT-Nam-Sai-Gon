"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import {
  decideLeadStageRequest,
  getLeadStageRequests,
  LeadStageRequest,
  StageRequestStatus,
} from "@/lib/api/leads.api";

type Filter = StageRequestStatus | "Tất cả";

const FILTERS: Filter[] = ["Chờ duyệt", "Đã duyệt", "Từ chối", "Tất cả"];

const STATUS_STYLE: Record<StageRequestStatus, string> = {
  "Chờ duyệt": "bg-amber-50 text-amber-700 border-amber-200/80",
  "Đã duyệt": "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  "Từ chối": "bg-rose-50 text-rose-700 border-rose-200/80",
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
}

interface StageRequestsPanelProps {
  /** Gọi sau khi Admin duyệt/từ chối để trang Lead tải lại danh sách và số lượng chờ duyệt. */
  onDecided: () => void;
}

export default function StageRequestsPanel({ onDecided }: Readonly<StageRequestsPanelProps>) {
  const [filter, setFilter] = useState<Filter>("Chờ duyệt");
  const [requests, setRequests] = useState<LeadStageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await getLeadStageRequests(filter === "Tất cả" ? undefined : filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(req: LeadStageRequest, action: "approve" | "reject") {
    setBusyId(req.id);
    setError(null);
    try {
      await decideLeadStageRequest(req.id, action, notes[req.id]);
      await load();
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được yêu cầu.");
      // Yêu cầu có thể đã được xử lý ở nơi khác: tải lại để hiển thị đúng.
      await load();
      onDecided();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" data-testid="stage-requests-panel">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Yêu cầu quay lại bước trước</h3>
          <p className="text-xs text-slate-500">
            Nhân viên không tự lùi trạng thái Lead được. Duyệt để đổi trạng thái đúng như yêu cầu, hoặc từ chối.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Lọc yêu cầu theo trạng thái"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-vnpt focus:outline-none"
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Đang tải yêu cầu...</p>
      ) : requests.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {filter === "Chờ duyệt" ? "Không có yêu cầu nào đang chờ duyệt." : "Không có yêu cầu nào."}
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id} data-testid="stage-request-item" className="rounded-xl border border-slate-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {req.customerName} <span className="font-mono text-xs font-semibold text-vnpt">{req.phone}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">{req.fromStatus}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{req.toStatus}</span>
                    {req.currentStatus !== req.fromStatus && (
                      <span className="text-[11px] text-amber-600">(hiện đang ở &quot;{req.currentStatus}&quot;)</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-700">
                    <span className="font-semibold">Lý do:</span> {req.reason}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {req.requestedBy} · AM phụ trách: {req.staffName} · {formatTime(req.createdAt)}
                  </p>
                  {req.status !== "Chờ duyệt" && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {req.status} bởi {req.decidedBy} · {formatTime(req.decidedAt)}
                      {req.decisionNote ? ` · ${req.decisionNote}` : ""}
                    </p>
                  )}
                </div>
                <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[req.status]}`}>
                  {req.status}
                </span>
              </div>

              {req.status === "Chờ duyệt" && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={notes[req.id] ?? ""}
                    maxLength={500}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    placeholder="Ghi chú của Admin (không bắt buộc)"
                    aria-label="Ghi chú của Admin"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => decide(req, "approve")}
                      data-testid="stage-request-approve"
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => decide(req, "reject")}
                      data-testid="stage-request-reject"
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Từ chối
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
