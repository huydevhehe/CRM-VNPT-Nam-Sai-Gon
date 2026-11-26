"use client";

import { useEffect, useState } from "react";
import { FilePlus2, FileText } from "lucide-react";
import {
  getDocumentRegistry,
  registerMemoNumber,
  type DocumentRegistryEntry,
  type DocumentRegistryType,
} from "@/lib/api/document-registry.api";

const TYPE_LABEL: Record<DocumentRegistryType, string> = {
  "bao-gia": "Báo giá",
  "de-nghi-thanh-toan": "Đề nghị thanh toán",
  "to-trinh": "Tờ trình",
};

const TYPE_BADGE: Record<DocumentRegistryType, string> = {
  "bao-gia": "bg-sky-50 text-sky-700 border-sky-200",
  "de-nghi-thanh-toan": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "to-trinh": "bg-amber-50 text-amber-700 border-amber-200",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("vi-VN");
}

const CURRENT_YEAR = String(new Date().getFullYear());

export default function DocumentRegistryPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [entries, setEntries] = useState<DocumentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memoNumber, setMemoNumber] = useState("");
  const [memoNote, setMemoNote] = useState("");
  const [registering, setRegistering] = useState(false);

  function reload() {
    setLoading(true);
    getDocumentRegistry(year)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được sổ văn bản"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [year]);

  async function handleRegisterMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!memoNumber.trim()) return;
    setRegistering(true);
    setError(null);
    try {
      await registerMemoNumber({ docNumber: memoNumber.trim(), note: memoNote.trim() || undefined });
      setMemoNumber("");
      setMemoNote("");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đăng ký được số tờ trình");
    } finally {
      setRegistering(false);
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(Number(CURRENT_YEAR) - i));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sổ văn bản</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi số đã cấp theo năm cho cả 3 loại: Báo giá, Đề nghị thanh toán, Tờ trình.
          </p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              Năm {y}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <FilePlus2 className="h-4 w-4 text-vnpt" />
          Đăng ký số Tờ trình
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Tờ trình soạn nội dung bên ngoài CRM — ở đây chỉ đăng ký số đã lấy để tránh trùng trong năm, tự
          nhập tay số (không tự sinh số như Báo giá/ĐNTT).
        </p>
        <form onSubmit={handleRegisterMemo} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Số tờ trình</label>
            <input
              data-testid="memo-number-input"
              value={memoNumber}
              onChange={(e) => setMemoNumber(e.target.value)}
              placeholder="VD: 15"
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Ghi chú (tùy chọn)</label>
            <input
              data-testid="memo-note-input"
              value={memoNote}
              onChange={(e) => setMemoNote(e.target.value)}
              placeholder="VD: Tờ trình xin chủ trương..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
            />
          </div>
          <button
            type="submit"
            data-testid="register-memo-submit"
            disabled={registering || !memoNumber.trim()}
            className="rounded-lg bg-vnpt px-4 py-2 text-sm font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
          >
            {registering ? "Đang đăng ký..." : "Đăng ký số"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <FileText className="h-4 w-4 text-vnpt" />
          Danh sách số đã cấp năm {year}
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Đang tải...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có số nào được cấp trong năm này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                  <th className="py-2 pr-3">Loại</th>
                  <th className="py-2 pr-3">Số văn bản</th>
                  <th className="py-2 pr-3">Ngày cấp</th>
                  <th className="py-2 pr-3">Người cấp</th>
                  <th className="py-2">Khách hàng / Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.type}-${e.docNumber}-${i}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE[e.type]}`}
                      >
                        {TYPE_LABEL[e.type]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.displayNumber}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{formatDateTime(e.issuedAt)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{e.issuedBy ?? "—"}</td>
                    <td className="py-2 text-xs text-slate-600">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
