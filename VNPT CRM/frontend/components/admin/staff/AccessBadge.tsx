import type { AccessLevel } from "@/lib/api/staff.api";

const LEVEL_STYLES: Record<AccessLevel, string> = {
  "Toàn quyền": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Chỉ dữ liệu của mình": "bg-amber-100 text-amber-800 border-amber-200",
  "Chỉ xem": "bg-slate-100 text-slate-600 border-slate-200",
  "Không có quyền": "bg-rose-50 text-rose-600 border-rose-100",
};

export default function AccessBadge({ level }: { level: AccessLevel }) {
  return (
    <span
      data-testid="access-badge"
      data-level={level}
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLES[level]}`}
    >
      {level}
    </span>
  );
}
