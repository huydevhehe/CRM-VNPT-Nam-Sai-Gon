"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { TerritoryRecord } from "@/lib/crm/types/crm.types";

interface WardMultiSelectProps {
  territories: TerritoryRecord[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Tên nhân viên đang sửa; phường đang giao cho người khác sẽ được ghi chú rõ. */
  currentStaffName?: string;
  testId?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export default function WardMultiSelect({
  territories,
  value,
  onChange,
  currentStaffName,
  testId = "ward-multi-select",
}: WardMultiSelectProps) {
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const me = (currentStaffName ?? "").trim();

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    const list = q ? territories.filter((t) => normalize(t.wardName).includes(q)) : territories;
    return [...list].sort((a, b) => a.wardName.localeCompare(b.wardName, "vi"));
  }, [territories, search]);

  const takenFromOthers = territories.filter((t) => {
    const owner = (t.staffName ?? "").trim();
    return selected.has(t.id) && owner !== "" && owner !== me;
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(territories.filter((t) => next.has(t.id)).map((t) => t.id));
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500" data-testid={`${testId}-count`}>
          Chọn được nhiều phường · đã chọn {value.length}
        </span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            Bỏ chọn tất cả
          </button>
        )}
      </div>

      {territories.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm phường..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-vnpt focus:outline-none"
          />
        </div>
      )}

      <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-slate-400">Không có phường phù hợp</p>
        ) : (
          <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {visible.map((t) => {
              const owner = (t.staffName ?? "").trim();
              const heldByOther = owner !== "" && owner !== me;
              return (
                <li key={t.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50 ${
                      selected.has(t.id) ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      data-testid={`ward-option-${t.id}`}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-vnpt focus:ring-vnpt"
                    />
                    <span>
                      <span className="font-semibold text-slate-800">{t.wardName}</span>
                      {heldByOther && (
                        <span className="block text-[10px] text-amber-700">Đang giao cho {owner}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {takenFromOthers.length > 0 && (
        <p
          className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800"
          data-testid={`${testId}-takeover-note`}
        >
          Lưu ý: {takenFromOthers.map((t) => t.wardName).join(", ")} đang do nhân viên khác phụ trách, lưu lại sẽ
          chuyển sang nhân viên này.
        </p>
      )}
    </div>
  );
}
