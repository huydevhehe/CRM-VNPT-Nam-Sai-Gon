"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, RotateCcw, Send } from "lucide-react";
import {
  REMINDER_TEMPLATE_GROUPS,
  getReminderTemplate,
  previewReminderTemplate,
  resetReminderTemplate,
  saveReminderTemplate,
  sendReminderTemplateTest,
  type ReminderTemplate,
  type ReminderTemplateGroup,
  type ReminderTemplatePreview,
} from "@/lib/api/reminders.api";

type FieldKey = "subject" | "body";
type Notice = { ok: boolean; text: string } | null;

const SUBJECT_MAX = 200;
const BODY_MAX = 5000;

export default function ReminderTemplateTab() {
  const [group, setGroup] = useState<ReminderTemplateGroup | null>(null);
  const [template, setTemplate] = useState<ReminderTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<ReminderTemplatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testNotice, setTestNotice] = useState<Notice>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<FieldKey>("body");
  const previewSeq = useRef(0);

  function applyTemplate(data: ReminderTemplate) {
    setTemplate(data);
    setSubject(data.subject);
    setBody(data.body);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getReminderTemplate(group);
        if (cancelled) return;
        applyTemplate(data);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setTemplate(null);
        setLoadError(err instanceof Error ? err.message : "Không tải được mẫu email.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group]);

  useEffect(() => {
    if (!template) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await previewReminderTemplate({ subject, body }, group);
        if (seq !== previewSeq.current) return;
        setPreview(result);
        setPreviewError(null);
      } catch (err) {
        if (seq !== previewSeq.current) return;
        setPreview(null);
        setPreviewError(err instanceof Error ? err.message : "Không xem trước được.");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [subject, body, template, group]);

  function selectGroup(next: ReminderTemplateGroup | null) {
    if (next === group) return;
    if (template && (subject !== template.subject || body !== template.body)) {
      if (!window.confirm("Nội dung đang soạn chưa lưu sẽ bị bỏ. Chuyển sang mẫu khác?")) return;
    }
    setNotice(null);
    setTestNotice(null);
    setPreview(null);
    setLoading(true);
    setGroup(next);
  }

  function insertVariable(key: string) {
    const token = `{${key}}`;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? subject : body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (field === "subject") setSubject(next);
    else setBody(next);
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      applyTemplate(await saveReminderTemplate({ subject, body }, group));
      setNotice({ ok: true, text: group ? `Đã lưu mẫu riêng cho nhóm ${group}.` : "Đã lưu mẫu email nhắc hết hạn." });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Lưu thất bại." });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const confirmText = group
      ? `Xoá mẫu riêng của nhóm ${group} và dùng lại mẫu chung? Nội dung đang dùng sẽ bị thay thế.`
      : "Khôi phục mẫu email về mặc định? Nội dung đang dùng sẽ bị thay thế.";
    if (!window.confirm(confirmText)) return;
    setSaving(true);
    setNotice(null);
    try {
      applyTemplate(await resetReminderTemplate(group));
      setNotice({ ok: true, text: group ? "Đã dùng lại mẫu chung." : "Đã khôi phục mẫu mặc định." });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Khôi phục thất bại." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestNotice(null);
    try {
      await sendReminderTemplateTest(testTo.trim(), { subject, body }, group);
      setTestNotice({ ok: true, text: `Đã gửi thử tới ${testTo.trim()}.` });
    } catch (err) {
      setTestNotice({ ok: false, text: err instanceof Error ? err.message : "Gửi thử thất bại." });
    } finally {
      setTesting(false);
    }
  }

  const groupSelector = (
    <div role="group" aria-label="Chọn mẫu theo nhóm dịch vụ" className="flex flex-wrap items-center gap-2">
      {[null, ...REMINDER_TEMPLATE_GROUPS].map((g) => (
        <button
          key={g ?? "chung"}
          type="button"
          aria-pressed={group === g}
          onClick={() => selectGroup(g)}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            group === g
              ? "border-vnpt bg-vnpt text-white"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {g ?? "Mẫu chung"}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {groupSelector}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Đang tải...
        </div>
      </div>
    );
  }
  if (!template) {
    return (
      <div className="space-y-4">
        {groupSelector}
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError || "Không tải được mẫu email."}
        </div>
      </div>
    );
  }

  const dirty = subject !== template.subject || body !== template.body;

  return (
    <div className="space-y-4">
      {groupSelector}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4.5 w-4.5 text-vnpt" />
          <h2 className="text-sm font-bold text-slate-900">
            {group ? `Mẫu email nhắc hết hạn - nhóm ${group}` : "Mẫu email nhắc hết hạn"}
          </h2>
          {template.isDefault && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
              {group ? "Đang dùng mẫu chung" : "Đang dùng mặc định"}
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-slate-500">
          {group
            ? `Mẫu riêng cho dịch vụ thuộc nhóm ${group}. Chưa lưu mẫu riêng thì nhóm này dùng mẫu chung.`
            : "Mẫu chung dùng cho mọi nhóm chưa có mẫu riêng và cho email từ file Excel."}{" "}
          Nội dung là văn bản thuần, xuống dòng được giữ nguyên.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="reminder-template-subject" className="mb-1 block text-xs font-semibold text-slate-600">
              Tiêu đề
            </label>
            <input
              id="reminder-template-subject"
              ref={subjectRef}
              value={subject}
              maxLength={SUBJECT_MAX}
              onFocus={() => (lastField.current = "subject")}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {subject.length}/{SUBJECT_MAX}
            </p>
          </div>

          <div>
            <label htmlFor="reminder-template-body" className="mb-1 block text-xs font-semibold text-slate-600">
              Nội dung
            </label>
            <textarea
              id="reminder-template-body"
              ref={bodyRef}
              value={body}
              rows={9}
              maxLength={BODY_MAX}
              onFocus={() => (lastField.current = "body")}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {body.length}/{BODY_MAX}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">
              Biến có thể chèn (bấm để chèn vào vị trí con trỏ)
            </p>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={v.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(v.key)}
                  className="rounded-full border border-vnpt/30 bg-blue-50 px-3 py-1 text-xs font-semibold text-vnpt hover:bg-blue-100"
                >
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-lg bg-vnpt px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0066a6] disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu mẫu"}
          </button>
          <button
            onClick={handleReset}
            disabled={saving || (template.isDefault && !dirty)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {group ? "Dùng lại mẫu chung" : "Khôi phục mặc định"}
          </button>
        </div>
        {notice && (
          <p className={`mt-2 text-sm ${notice.ok ? "text-emerald-600" : "text-rose-600"}`}>{notice.text}</p>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-bold text-slate-900">Xem trước</h2>
          <p className="mb-4 text-xs text-slate-500">Hiển thị với dữ liệu mẫu, cập nhật theo nội dung đang soạn.</p>
          {previewError ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {previewError}
            </div>
          ) : preview ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Tiêu đề</p>
              <p data-testid="template-preview-subject" className="mb-3 text-sm font-semibold text-slate-900">
                {preview.subject}
              </p>
              <p className="text-xs font-semibold text-slate-500">Nội dung</p>
              <p
                data-testid="template-preview-body"
                className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800"
              >
                {preview.text}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Đang tạo bản xem trước...</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-bold text-slate-900">Gửi thử</h2>
          <p className="mb-3 text-xs text-slate-500">
            Gửi bản xem trước (dữ liệu mẫu, theo nội dung đang soạn) tới một email, qua cấu hình SMTP đã lưu.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="email"
              aria-label="Email nhận thử"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="ten@congty.vn"
              className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testTo.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-vnpt px-4 py-2.5 text-sm font-semibold text-vnpt hover:bg-blue-50 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {testing ? "Đang gửi..." : "Gửi thử"}
            </button>
          </div>
          {testNotice && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-sm ${testNotice.ok ? "text-emerald-600" : "text-rose-600"}`}
            >
              {testNotice.ok && <CheckCircle2 className="h-4 w-4" />}
              {testNotice.text}
            </p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
