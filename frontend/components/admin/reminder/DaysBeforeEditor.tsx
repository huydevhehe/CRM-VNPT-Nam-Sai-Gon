"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { normalizeDaysInput } from "@/lib/api/reminders.api";

export const DAYS_MAX_COUNT = 10;
export const DAYS_MAX_VALUE = 365;

interface DaysBeforeEditorProps {
  /** Tên dùng cho aria-label/data-testid, vd "chung", "CNTT". */
  name: string;
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}

/**
 * Sửa danh sách số ngày nhắc trước: mỗi mốc là một chip có nút xoá, thêm mốc
 * bằng ô nhập số (Enter / dấu phẩy / nút Thêm). Luôn sắp giảm dần, không trùng.
 */
export default function DaysBeforeEditor({ name, value, onChange, disabled }: DaysBeforeEditorProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commitDraft() {
    const text = draft.trim();
    if (!text) return;
    const n = Number(text);
    if (!Number.isInteger(n) || n < 0 || n > DAYS_MAX_VALUE) {
      setError(`Số ngày phải là số nguyên từ 0 đến ${DAYS_MAX_VALUE}.`);
      return;
    }
    if (value.includes(n)) {
      setError(`Mốc ${n} ngày đã có.`);
      return;
    }
    if (value.length >= DAYS_MAX_COUNT) {
      setError(`Tối đa ${DAYS_MAX_COUNT} mốc nhắc.`);
      return;
    }
    setError(null);
    setDraft("");
    onChange(normalizeDaysInput([...value, n]));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && value.length > 0 && !disabled) {
      // Xoá nhanh mốc cuối khi ô nhập đang trống.
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div data-testid={`days-editor-${name}`}>
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 && <span className="text-xs text-slate-400">Chưa có mốc nào</span>}
        {value.map((d) => (
          <span
            key={d}
            data-testid={`days-chip-${name}-${d}`}
            className="inline-flex items-center gap-1 rounded-full border border-vnpt/30 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-vnpt"
          >
            {d} ngày
            <button
              type="button"
              disabled={disabled}
              aria-label={`Xóa mốc ${d} ngày (${name})`}
              onClick={() => onChange(value.filter((x) => x !== d))}
              className="rounded-full p-0.5 text-vnpt/70 hover:bg-blue-100 hover:text-vnpt disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={DAYS_MAX_VALUE}
          disabled={disabled}
          aria-label={`Thêm mốc ngày nhắc (${name})`}
          placeholder="Thêm số ngày"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-vnpt focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={commitDraft}
          aria-label={`Thêm mốc (${name})`}
          className="inline-flex items-center gap-1 rounded-lg border border-vnpt px-3 py-1.5 text-xs font-semibold text-vnpt hover:bg-blue-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
