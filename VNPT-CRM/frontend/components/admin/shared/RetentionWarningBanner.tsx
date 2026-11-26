"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { getRetentionWarnings, RetentionWarningItem } from "@/lib/api/data-retention.api";

interface RetentionWarningBannerProps {
  /** Chỉ hiện cảnh báo cho loại bản ghi này ("debt" ở Quản lý nợ, "renewal" ở Gia hạn trả trước). */
  type: "debt" | "renewal";
}

/**
 * Cảnh báo các bản ghi sắp bị hệ thống tự động xóa vĩnh viễn (quá 1 năm lưu
 * trữ) trong 30 ngày tới. Dữ liệu từ `GET /api/data-retention/warnings`.
 */
export default function RetentionWarningBanner({ type }: RetentionWarningBannerProps) {
  const [items, setItems] = useState<RetentionWarningItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRetentionWarnings()
      .then((all) => {
        if (!cancelled) setItems(all.filter((w) => w.type === type));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  if (items.length === 0) return null;

  const label = type === "debt" ? "bản ghi công nợ" : "bản ghi gia hạn";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          Có <strong>{items.length}</strong> {label} sẽ tự động bị xóa vĩnh viễn trong 30 ngày tới
          (đã lưu trữ gần đủ 1 năm).
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-amber-600" />
        )}
      </button>

      {expanded && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-amber-200 pt-2 text-[11px] text-amber-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 font-semibold">
                còn {item.daysUntilDeletion} ngày
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
