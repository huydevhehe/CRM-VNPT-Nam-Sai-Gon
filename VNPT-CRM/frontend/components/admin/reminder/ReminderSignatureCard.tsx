"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import { saveReminderSignature, type ReminderSignature } from "@/lib/api/reminders.api";
import RichTextEditor from "./RichTextEditor";

type Notice = { ok: boolean; text: string } | null;

interface ReminderSignatureCardProps {
  saved: ReminderSignature;
  enabled: boolean;
  html: string;
  onEnabledChange: (enabled: boolean) => void;
  onHtmlChange: (html: string) => void;
  onSaved: (signature: ReminderSignature) => void;
}

/** Chữ ký email: tự chèn vào cuối mọi email nhắc (khách và nhân viên) khi bật. */
export default function ReminderSignatureCard({
  saved,
  enabled,
  html,
  onEnabledChange,
  onHtmlChange,
  onSaved,
}: ReminderSignatureCardProps) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const dirty = enabled !== saved.enabled || html !== saved.html;

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      const next = await saveReminderSignature({ enabled, html });
      onSaved(next);
      setNotice({ ok: true, text: "Đã lưu chữ ký email." });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Lưu chữ ký thất bại." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="signature-card">
      <div className="mb-2 flex items-center gap-2">
        <PenLine className="h-4.5 w-4.5 text-vnpt" />
        <h2 className="text-sm font-bold text-slate-900">Chữ ký email</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Chữ ký dùng chung cho mọi nhóm dịch vụ, tự động chèn vào cuối mọi email nhắc hết hạn (gửi cho khách và
        nhân viên). Có thể ghi tên đơn vị, số điện thoại, liên kết; biến như {"{AM phụ trách}"} cũng dùng được.
      </p>

      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          data-testid="signature-enabled"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Tự động chèn chữ ký vào cuối email
      </label>

      <RichTextEditor
        value={html}
        onChange={onHtmlChange}
        ariaLabel="Nội dung chữ ký"
        testId="signature-editor"
        minHeight={110}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-vnpt px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0066a6] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu chữ ký"}
        </button>
        <button
          type="button"
          onClick={() => onHtmlChange(saved.sampleHtml)}
          disabled={saving}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Chèn chữ ký mẫu
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Chữ ký mẫu chỉ để tham khảo, hãy thay bằng thông tin thật của đơn vị trước khi bật.
      </p>
      {notice && (
        <p className={`mt-2 text-sm ${notice.ok ? "text-emerald-600" : "text-rose-600"}`}>{notice.text}</p>
      )}
    </div>
  );
}
