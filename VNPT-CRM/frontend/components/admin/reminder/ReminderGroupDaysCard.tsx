"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import {
  resetReminderGroupSetting,
  saveReminderGroupSetting,
  type ReminderGroupSetting,
  type ReminderTemplateGroup,
} from "@/lib/api/reminders.api";
import DaysBeforeEditor from "./DaysBeforeEditor";

type Notice = { ok: boolean; text: string } | null;

interface ReminderGroupDaysCardProps {
  /** Nhóm đang chọn; null là "Mẫu chung" (chỉ hiển thị cấu hình chung). */
  group: ReminderTemplateGroup | null;
  setting: ReminderGroupSetting | null;
  /** Các mốc ngày của cấu hình chung. */
  general: number[];
  onSaved: (setting: ReminderGroupSetting) => void;
  onOpenGeneral: () => void;
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Số ngày nhắc trước theo nhóm dịch vụ, sửa trực tiếp: nhóm có cấu hình riêng thì
 * dùng riêng, không thì theo cấu hình chung. Có công tắc bật/tắt nhắc cho nhóm.
 */
export default function ReminderGroupDaysCard({
  group,
  setting,
  general,
  onSaved,
  onOpenGeneral,
}: ReminderGroupDaysCardProps) {
  const [days, setDays] = useState<number[]>(setting?.daysBefore ?? general);
  const [enabled, setEnabled] = useState(setting?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // Chỉ nạp lại từ props khi THỰC SỰ đổi nhóm (bấm nút nhóm khác) — nếu nạp lại
  // mỗi khi `setting` đổi tham chiếu, thông báo "Đã lưu..." vừa set trong
  // handleSave/handleUseGeneral sẽ bị effect này xoá ngay trong cùng lượt
  // render (do onSaved cập nhật `setting` ở component cha), làm người dùng
  // không bao giờ thấy được thông báo thành công.
  const lastGroupRef = useRef(group);

  useEffect(() => {
    if (lastGroupRef.current === group) return;
    lastGroupRef.current = group;
    setDays(setting?.daysBefore ?? general);
    setEnabled(setting?.enabled ?? true);
    setNotice(null);
  }, [group, setting, general]);

  if (!group) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="group-days-general">
        <div className="mb-2 flex items-center gap-2">
          <BellRing className="h-4.5 w-4.5 text-vnpt" />
          <h2 className="text-sm font-bold text-slate-900">Số ngày nhắc trước (chung)</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Các nhóm dịch vụ chưa có cấu hình riêng sẽ nhắc theo các mốc này. Muốn mỗi nhóm nhắc khác nhau, chọn
          nhóm ở trên rồi đặt số ngày riêng.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {general.map((d) => (
            <span key={d} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {d} ngày
            </span>
          ))}
          <button
            type="button"
            onClick={onOpenGeneral}
            className="ml-2 text-xs font-semibold text-vnpt hover:underline"
          >
            Sửa số ngày chung
          </button>
        </div>
      </div>
    );
  }

  const baseline = setting?.daysBefore ?? general;
  const dirty = !sameDays(days, baseline) || enabled !== (setting?.enabled ?? true);

  async function handleSave() {
    if (!group) return;
    if (days.length === 0) {
      setNotice({ ok: false, text: "Cần ít nhất 1 mốc ngày nhắc." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveReminderGroupSetting(group, { enabled, daysBefore: days });
      onSaved(saved);
      setDays(saved.daysBefore);
      setEnabled(saved.enabled);
      setNotice({ ok: true, text: `Đã lưu số ngày nhắc riêng cho nhóm ${group}.` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Lưu thất bại." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUseGeneral() {
    if (!group) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await resetReminderGroupSetting(group);
      onSaved(saved);
      setDays(saved.daysBefore);
      setEnabled(saved.enabled);
      setNotice({ ok: true, text: `Nhóm ${group} đã dùng lại cấu hình chung.` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Thao tác thất bại." });
    } finally {
      setSaving(false);
    }
  }

  const isCustom = Boolean(setting?.custom);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6" data-testid={`group-days-${group}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <BellRing className="h-4.5 w-4.5 text-vnpt" />
        <h2 className="text-sm font-bold text-slate-900">Nhắc trước … ngày - nhóm {group}</h2>
        <span
          data-testid={`group-days-state-${group}`}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isCustom ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isCustom ? "Cấu hình riêng" : "Đang dùng cấu hình chung"}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Hệ thống gửi email nhắc khi dịch vụ của nhóm này còn đúng số ngày dưới đây trước ngày hết hạn. Chưa đặt
        riêng thì theo cấu hình chung ({general.join(", ")} ngày).
      </p>

      <DaysBeforeEditor name={group} value={days} onChange={setDays} disabled={saving} />

      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Bật nhắc hết hạn cho nhóm {group}
      </label>
      {!enabled && (
        <p className="mt-1 text-xs text-amber-700">Nhóm này sẽ không được nhắc khi đã lưu (dù tính năng nhắc chung đang bật).</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-vnpt px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0066a6] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu số ngày nhắc"}
        </button>
        <button
          type="button"
          onClick={handleUseGeneral}
          disabled={saving || !isCustom}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Dùng cấu hình chung
        </button>
      </div>
      {notice && (
        <p className={`mt-2 text-sm ${notice.ok ? "text-emerald-600" : "text-rose-600"}`}>{notice.text}</p>
      )}
    </div>
  );
}
