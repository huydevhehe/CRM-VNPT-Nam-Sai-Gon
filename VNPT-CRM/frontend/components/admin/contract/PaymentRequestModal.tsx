"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Download, Edit2, FileText, X } from "lucide-react";
import {
  confirmPaymentRequest,
  downloadPaymentRequestFile,
  fetchPaymentRequestPreviewPdf,
  getPaymentRequestPreview,
  type ConfirmedPaymentExportDto,
  type PaymentRequestFormat,
  type PaymentRequestPreviewDto,
} from "@/lib/api/contracts.api";
import type { ContractRecord } from "@/lib/crm/types/crm.types";

const ORDER_WITHOUT_CUSTOMER_MESSAGE =
  "Đơn hàng chưa gắn khách hàng. Vui lòng cập nhật khách hàng cho đơn trước khi xuất Đề nghị thanh toán";

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("vi-VN");
}

interface PaymentRequestModalProps {
  order: ContractRecord;
  onClose: () => void;
  /** Mở form sửa đơn (khi đơn chưa gắn khách hàng). */
  onEditOrder: (order: ContractRecord) => void;
}

/**
 * Xuất Đề nghị thanh toán theo 2 bước:
 * 1) Xem trước nội dung + (tùy chọn) nhập số văn bản — CHƯA cấp số;
 * 2) Bấm "Xác nhận & lấy số" mới cấp số, sau đó tải Word (.docx) hoặc PDF cùng một số.
 */
export default function PaymentRequestModal({
  order,
  onClose,
  onEditOrder,
}: Readonly<PaymentRequestModalProps>) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(order.customerId ? null : ORDER_WITHOUT_CUSTOMER_MESSAGE);
  const [preview, setPreview] = useState<PaymentRequestPreviewDto | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [numberEdited, setNumberEdited] = useState(false);
  const [eoNumber, setEoNumber] = useState("");
  const [dismissLatest, setDismissLatest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedPaymentExportDto | null>(null);
  const [downloading, setDownloading] = useState<PaymentRequestFormat | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tải dữ liệu xem trước lần đầu.
  useEffect(() => {
    if (!order.customerId) return;
    let cancelled = false;
    getPaymentRequestPreview(order.id)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setDocNumber(data.suggestedDocNumber || "");
      })
      .catch((err) => {
        if (!cancelled) {
          setBlocked(err instanceof Error ? err.message : "Không thể tải thông tin đề nghị thanh toán");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, order.customerId]);

  // Dọn URL xem trước PDF và bộ đếm khi đóng.
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  // Mặc định hiện luôn bản in (PDF) thay vì bắt bấm thêm nút — theo đúng yêu cầu
  // khách: "Xem trước là yêu cầu dạng bản in". Tự chạy lại mỗi khi preview đổi
  // (lần đầu tải xong, hoặc sau khi sửa số văn bản/số EO).
  useEffect(() => {
    if (!preview || !preview.pdfAvailable || pdfPreviewUrl || pdfPreviewLoading) return;
    let cancelled = false;
    setPdfPreviewLoading(true);
    fetchPaymentRequestPreviewPdf(order.id, numberEdited ? docNumber : undefined)
      .then((blob) => {
        if (!cancelled) setPdfPreviewUrl(window.URL.createObjectURL(blob));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tạo bản xem trước PDF.");
      })
      .finally(() => {
        if (!cancelled) setPdfPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const refreshPreview = useCallback(
    (nextNumber: string, nextEoNumber: string) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        getPaymentRequestPreview(order.id, nextNumber, nextEoNumber)
          .then((data) => setPreview((prev) => (prev ? { ...prev, lines: data.lines } : data)))
          .catch(() => undefined);
      }, 400);
    },
    [order.id]
  );

  function handleNumberChange(value: string) {
    setDocNumber(value);
    setNumberEdited(true);
    setError(null);
    setPdfPreviewUrl(null);
    refreshPreview(value, eoNumber);
  }

  function handleEoNumberChange(value: string) {
    setEoNumber(value);
    setError(null);
    setPdfPreviewUrl(null);
    refreshPreview(docNumber, value);
  }

  async function handleConfirm(reuseLatest = false) {
    setConfirming(true);
    setError(null);
    try {
      // Không sửa số thì để hệ thống tự cấp số kế tiếp tại thời điểm xác nhận (tránh trùng khi nhiều người cùng xuất).
      const typed = numberEdited ? docNumber.trim() : "";
      const result = await confirmPaymentRequest(order.id, {
        docNumber: typed || undefined,
        eoNumber: eoNumber.trim() || undefined,
        reuseLatest,
      });
      setConfirmed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cấp số văn bản. Vui lòng thử lại.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleDownload(format: PaymentRequestFormat) {
    if (!confirmed) return;
    setDownloading(format);
    setError(null);
    try {
      const blob = await downloadPaymentRequestFile(order.id, confirmed.id, format);
      saveBlob(blob, `De-nghi-thanh-toan_${order.transactionCode}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải file. Vui lòng thử lại.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleTogglePdfPreview() {
    if (pdfPreviewUrl) {
      setPdfPreviewUrl(null);
      return;
    }
    setPdfPreviewLoading(true);
    setError(null);
    try {
      const blob = await fetchPaymentRequestPreviewPdf(order.id, numberEdited ? docNumber : undefined);
      setPdfPreviewUrl(window.URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo bản xem trước PDF.");
    } finally {
      setPdfPreviewLoading(false);
    }
  }

  const latest = preview?.latestExport ?? null;
  const showLatestChoice = Boolean(latest) && !dismissLatest && !confirmed;
  const pdfAvailable = preview?.pdfAvailable ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        data-testid="payment-request-modal"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Xuất đề nghị thanh toán</h3>
            <p className="text-xs text-slate-500">
              Mã GD: <span className="font-mono font-bold text-vnpt">{order.transactionCode}</span> · Khách:{" "}
              <span className="font-semibold text-slate-800">{order.customerName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && !blocked ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang chuẩn bị dữ liệu văn bản...</div>
        ) : blocked ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Không thể xuất Đề nghị thanh toán
              </div>
              <p className="mt-1">{blocked}</p>
            </div>
            <div className="flex justify-end gap-2 border-t pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditOrder(order);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark"
              >
                <Edit2 className="h-4 w-4" />
                <span>Chỉnh sửa đơn hàng</span>
              </button>
            </div>
          </div>
        ) : confirmed ? (
          <div className="space-y-4" data-testid="pr-done">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-900">
                <p className="font-bold">
                  {confirmed.reused ? "Dùng lại số văn bản đã cấp: " : "Đã cấp số văn bản: "}
                  <span data-testid="pr-issued-number" className="font-mono text-base">
                    {confirmed.docNumber}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  Cấp lúc {formatDateTime(confirmed.exportedAt)}
                  {confirmed.exportedBy ? ` bởi ${confirmed.exportedBy}` : ""}. File Word và PDF đều mang đúng số này.
                </p>
              </div>
            </div>

            {error && (
              <p data-testid="pr-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="pr-download-docx"
                disabled={downloading !== null}
                onClick={() => handleDownload("docx")}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading === "docx" ? "Đang tạo file..." : "Tải file Word (.docx)"}</span>
              </button>
              <button
                type="button"
                data-testid="pr-download-pdf"
                disabled={downloading !== null || !pdfAvailable}
                onClick={() => handleDownload("pdf")}
                title={pdfAvailable ? undefined : "Máy chủ chưa cài LibreOffice nên chưa xuất được PDF"}
                className="flex items-center gap-1.5 rounded-xl border border-vnpt px-4 py-2 text-xs font-bold text-vnpt hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                <span>{downloading === "pdf" ? "Đang tạo PDF..." : "Tải file PDF"}</span>
              </button>
            </div>
            {!pdfAvailable && (
              <p data-testid="pr-pdf-unavailable" className="text-[11px] text-amber-700">
                Máy chủ chưa cài LibreOffice nên chưa xuất được PDF. Bạn vẫn có thể tải file Word (.docx).
              </p>
            )}

            <div className="flex justify-end border-t pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {preview && preview.missingFields.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Cảnh báo: Đơn hàng còn thiếu thông tin
                </div>
                <p className="mt-1">
                  Còn thiếu: <span className="font-semibold">{preview.missingFields.join(", ")}</span>.
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700">
                  Vẫn có thể xuất văn bản (chỗ thiếu sẽ để trống trong file).
                </p>
              </div>
            )}

            {showLatestChoice && latest && (
              <div data-testid="pr-latest" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <p className="font-bold">
                  Đơn này đã được cấp số văn bản <span className="font-mono">{latest.docNumber}</span> lúc{" "}
                  {formatDateTime(latest.exportedAt)}.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="pr-reuse"
                    disabled={confirming}
                    onClick={() => handleConfirm(true)}
                    className="rounded-lg bg-vnpt px-3 py-1.5 font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
                  >
                    Dùng lại số {latest.docNumber} để tải file
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissLatest(true)}
                    className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 font-bold text-sky-800 hover:bg-sky-100"
                  >
                    Cấp số mới
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Xem trước nội dung (chưa cấp số)
                </h4>
                {pdfAvailable && (
                  <button
                    type="button"
                    data-testid="pr-pdf-preview-toggle"
                    onClick={handleTogglePdfPreview}
                    disabled={pdfPreviewLoading}
                    className="text-xs font-bold text-vnpt hover:underline disabled:opacity-60"
                  >
                    {pdfPreviewLoading
                      ? "Đang tạo bản in..."
                      : pdfPreviewUrl
                        ? "Xem dạng chữ"
                        : "Xem bản in (PDF)"}
                  </button>
                )}
              </div>
              {pdfPreviewUrl ? (
                <iframe
                  title="Bản in đề nghị thanh toán"
                  data-testid="pr-pdf-frame"
                  src={pdfPreviewUrl}
                  className="h-[420px] w-full rounded-xl border border-slate-200"
                />
              ) : (
                <div
                  data-testid="pr-preview"
                  className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800"
                >
                  {(preview?.lines ?? []).map((line, i) => (
                    <p key={`${i}-${line.slice(0, 20)}`}>{line}</p>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="pr-doc-number" className="mb-1 block text-xs font-semibold text-slate-700">
                Số văn bản
              </label>
              <input
                id="pr-doc-number"
                data-testid="pr-doc-number"
                value={docNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="Để trống = hệ thống tự cấp số kế tiếp"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {preview?.suggestedDocNumber
                  ? `Số kế tiếp dự kiến: ${preview.suggestedDocNumber}. `
                  : "Năm nay chưa có số nào. "}
                Số chỉ thật sự được cấp khi bạn bấm <b>Xuất trình ký</b>; xem trước nhiều lần không làm tăng số.
              </p>
            </div>

            <div>
              <label htmlFor="pr-eo-number" className="mb-1 block text-xs font-semibold text-slate-700">
                Số EO (tùy chọn)
              </label>
              <input
                id="pr-eo-number"
                data-testid="pr-eo-number"
                value={eoNumber}
                onChange={(e) => handleEoNumberChange(e.target.value)}
                placeholder="Số từ hệ thống E-Office (nếu có)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
              />
            </div>

            {error && (
              <p data-testid="pr-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="pr-confirm"
                disabled={confirming}
                onClick={() => handleConfirm(false)}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{confirming ? "Đang xuất trình ký..." : "Xuất trình ký"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
