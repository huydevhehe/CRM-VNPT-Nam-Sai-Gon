"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Ban, Trash2, X } from "lucide-react";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  /** Tiêu đề, ví dụ "Xóa khách hàng". */
  title: string;
  /** Nội dung xác nhận, nên nêu tên bản ghi sắp xóa (có thể là JSX, ví dụ <strong>…</strong>). */
  description: ReactNode;
  /**
   * Lý do không cho xóa (biết trước ở phía giao diện, ví dụ "Khách còn 3 đơn hàng").
   * Có giá trị thì hiện khung cảnh báo và vô hiệu hóa nút Xóa.
   */
  blockedReason?: string | null;
  /** Trạng thái đang xóa do nơi gọi điều khiển (tùy chọn; dialog cũng tự theo dõi khi onConfirm trả Promise). */
  loading?: boolean;
  /**
   * Lỗi từ server do nơi gọi tự quản lý (tùy chọn). Nếu onConfirm ném lỗi (vd 409),
   * dialog tự hiển thị `error.message` và giữ nguyên hộp thoại để người dùng đọc.
   */
  error?: string | null;
  /** Nhãn nút xác nhận, mặc định "Xóa". */
  confirmLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}

/**
 * Hộp thoại xác nhận xóa dùng chung cho các trang quản trị.
 * - Nút Xóa màu đỏ, nút Hủy; đóng bằng Esc hoặc bấm ra ngoài (trừ lúc đang xóa).
 * - Hiện lỗi server (409...) bằng tiếng Việt ngay trong hộp thoại.
 * - data-testid: confirm-delete-dialog, confirm-delete-submit, confirm-delete-cancel,
 *   confirm-delete-error, confirm-delete-blocked.
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  blockedReason,
  loading = false,
  error: externalError = null,
  confirmLabel = "Xóa",
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = loading || submitting;
  const blocked = Boolean(blockedReason);
  const shownError = localError ?? externalError;

  // Mỗi lần mở lại: xóa lỗi cũ, đưa focus vào nút Hủy (an toàn hơn nút Xóa).
  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setSubmitting(false);
    cancelRef.current?.focus();
  }, [open]);

  // Esc để đóng (không đóng khi đang xóa dở).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    if (busy || blocked) return;
    setLocalError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setLocalError(
        err instanceof Error && err.message
          ? err.message
          : "Không thể xóa. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        // Bấm ra ngoài vùng hộp thoại thì đóng.
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="confirm-delete-dialog"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-bold text-slate-900">
                {title}
              </h3>
              <div id={descId} className="mt-1 text-sm text-slate-600">
                {description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {blocked && (
          <div
            role="alert"
            data-testid="confirm-delete-blocked"
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          >
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{blockedReason}</span>
          </div>
        )}

        {shownError && (
          <div
            role="alert"
            data-testid="confirm-delete-error"
            className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{shownError}</span>
          </div>
        )}

        {!blocked && !shownError && (
          <p className="mt-3 text-xs text-slate-400">Thao tác này không thể hoàn tác.</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-delete-cancel"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            data-testid="confirm-delete-submit"
            onClick={handleConfirm}
            disabled={busy || blocked}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Đang xóa..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
