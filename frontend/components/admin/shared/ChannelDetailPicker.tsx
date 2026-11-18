"use client";

import { useEffect, useState } from "react";
import { getChannelSources, ChannelSource } from "@/lib/api/channel-sources.api";
import { getCtvOptions, CtvOption } from "@/lib/api/leads.api";
import {
  CHANNEL_DETAIL_KIND,
  ChannelDetailValue,
} from "@/lib/crm/channel-detail";

interface ChannelDetailPickerProps {
  /** Kênh phát triển đang chọn (Online, Đối tác, CTV giới thiệu, ...). */
  channel: string;
  value: ChannelDetailValue;
  onChange: (next: ChannelDetailValue) => void;
  /** Mặc định true: bắt buộc chọn (đánh dấu * và `required`). */
  required?: boolean;
  disabled?: boolean;
  /** Tên hiển thị của nguồn/đối tác/CTV đang gắn nhưng đã bị ẩn khỏi danh sách chọn. */
  currentLabel?: string | null;
  /** Danh sách CTV có sẵn (nếu bỏ trống, component tự tải). */
  ctvOptions?: CtvOption[];
  className?: string;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

/**
 * Ô "Chi tiết kênh" theo kênh phát triển: Online → chọn nguồn Online, Đối tác → chọn đối tác,
 * CTV giới thiệu → chọn cộng tác viên; kênh khác không hiển thị gì.
 * Dùng chung cho Lead, (sau này) Đơn hàng và Khách hàng.
 */
export default function ChannelDetailPicker({
  channel,
  value,
  onChange,
  required = true,
  disabled,
  currentLabel,
  ctvOptions,
  className,
}: Readonly<ChannelDetailPickerProps>) {
  const kind = CHANNEL_DETAIL_KIND[channel];
  const [sources, setSources] = useState<ChannelSource[]>([]);
  const [ctvs, setCtvs] = useState<CtvOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sourceKind = kind === "online" || kind === "partner" ? kind : null;

  useEffect(() => {
    if (!sourceKind) return;
    let alive = true;
    setLoadError(null);
    getChannelSources({ kind: sourceKind })
      .then((rows) => {
        if (alive) setSources(rows);
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : "Không tải được danh mục kênh");
      });
    return () => {
      alive = false;
    };
  }, [sourceKind]);

  useEffect(() => {
    if (kind !== "ctv" || ctvOptions) return;
    let alive = true;
    getCtvOptions()
      .then((rows) => {
        if (alive) setCtvs(rows);
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : "Không tải được danh sách cộng tác viên");
      });
    return () => {
      alive = false;
    };
  }, [kind, ctvOptions]);

  if (!kind) return null;

  const labelText =
    kind === "online"
      ? "Chi tiết kênh — Nguồn Online"
      : kind === "partner"
        ? "Chi tiết kênh — Đối tác"
        : "Chi tiết kênh — Cộng tác viên giới thiệu";

  const label = (
    <label className="mb-1 block text-xs font-semibold text-slate-600">
      {labelText}
      {required && <span className="text-rose-500"> *</span>}
    </label>
  );

  if (kind === "ctv") {
    const list = ctvOptions ?? ctvs;
    const missing = value.referredByCtvId && !list.some((c) => c.id === value.referredByCtvId);
    return (
      <div className={className} data-testid="channel-detail-picker">
        {label}
        <select
          required={required}
          disabled={disabled}
          data-testid="channel-detail-select"
          value={value.referredByCtvId}
          onChange={(e) => onChange({ channelSourceId: "", referredByCtvId: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">— Chọn cộng tác viên —</option>
          {missing && <option value={value.referredByCtvId}>{currentLabel || value.referredByCtvId}</option>}
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.referralCode})
            </option>
          ))}
        </select>
        {loadError && <p className="mt-1 text-[11px] text-rose-500">{loadError}</p>}
      </div>
    );
  }

  const missing = value.channelSourceId && !sources.some((s) => s.id === value.channelSourceId);
  const emptyHint = !sources.length && !loadError;
  return (
    <div className={className} data-testid="channel-detail-picker">
      {label}
      <select
        required={required}
        disabled={disabled}
        data-testid="channel-detail-select"
        value={value.channelSourceId}
        onChange={(e) => onChange({ channelSourceId: e.target.value, referredByCtvId: "" })}
        className={SELECT_CLASS}
      >
        <option value="">{kind === "online" ? "— Chọn nguồn Online —" : "— Chọn đối tác —"}</option>
        {missing && <option value={value.channelSourceId}>{currentLabel || "Mục đã ẩn"} (đã ẩn)</option>}
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {emptyHint && kind === "partner" && (
        <p className="mt-1 text-[11px] text-amber-600">
          Chưa có đối tác nào. Admin thêm ở menu &quot;Danh mục kênh&quot;.
        </p>
      )}
      {loadError && <p className="mt-1 text-[11px] text-rose-500">{loadError}</p>}
    </div>
  );
}
