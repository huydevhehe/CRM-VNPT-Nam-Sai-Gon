"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Download, X } from "lucide-react";
import {
  confirmQuote,
  downloadQuoteFile,
  getQuotePreview,
  type ConfirmedQuoteExportDto,
  type QuoteFormat,
  type QuoteInput,
  type QuotePreviewDto,
} from "@/lib/api/customers.api";
import { getCustomLists, type CustomListItem } from "@/lib/api/custom-lists.api";

/** Tên danh mục tùy biến chứa bảng giá Internet/Fiber (seed sẵn, Admin có thể sửa ở /admin/custom-lists). */
const SERVICE_CATALOG_LIST_NAME = "Gói dịch vụ Internet/Fiber";

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

interface QuoteModalProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

const EMPTY_INPUT: QuoteInput = {
  serviceType: "",
  packageName: "",
  unit: "",
  quantity: 1,
  unitPrice: 0,
  vatPercent: 10,
  note: "",
};

function hasRequiredFields(input: QuoteInput): boolean {
  return Boolean(
    input.serviceType.trim() && input.packageName.trim() && input.unit.trim() && input.quantity > 0 && input.unitPrice > 0
  );
}

/**
 * Lập Báo giá theo 2 bước, giống Đề nghị thanh toán:
 * 1) Nhập thông tin dịch vụ + xem trước nội dung — CHƯA cấp số;
 * 2) Bấm "Xác nhận & lấy số" mới cấp số báo giá, sau đó tải Word (.docx) hoặc PDF.
 */
export default function QuoteModal({ customerId, customerName, onClose }: Readonly<QuoteModalProps>) {
  const [input, setInput] = useState<QuoteInput>(EMPTY_INPUT);
  const [preview, setPreview] = useState<QuotePreviewDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedQuoteExportDto | null>(null);
  const [downloading, setDownloading] = useState<QuoteFormat | null>(null);
  const [catalogItems, setCatalogItems] = useState<CustomListItem[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getCustomLists()
      .then((lists) => {
        const catalog = lists.find((l) => l.name === SERVICE_CATALOG_LIST_NAME);
        setCatalogItems(catalog?.items.filter((i) => i.active && i.price !== null) ?? []);
      })
      .catch(() => setCatalogItems([]));
  }, []);

  const refreshPreview = useCallback(
    (next: QuoteInput) => {
      if (!hasRequiredFields(next)) {
        setPreview(null);
        return;
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setPreviewLoading(true);
        getQuotePreview(customerId, next)
          .then((data) => {
            setPreview(data);
            setError(null);
          })
          .catch((err) => setError(err instanceof Error ? err.message : "Không thể xem trước báo giá."))
          .finally(() => setPreviewLoading(false));
      }, 400);
    },
    [customerId]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function updateField<K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) {
    const next = { ...input, [key]: value };
    setInput(next);
    refreshPreview(next);
  }

  /** Chọn nhanh gói có sẵn trong danh mục — điền Gói cước + Đơn giá, vẫn sửa tay được sau đó. */
  function handleSelectCatalogItem(itemId: string) {
    const item = catalogItems.find((i) => i.id === itemId);
    if (!item || item.price === null) return;
    const next: QuoteInput = {
      ...input,
      serviceType: input.serviceType.trim() || "Internet Fiber",
      packageName: item.value,
      unit: input.unit.trim() || "Gói/tháng",
      unitPrice: item.price,
    };
    setInput(next);
    refreshPreview(next);
  }

  async function handleConfirm() {
    if (!hasRequiredFields(input)) {
      setError("Vui lòng nhập đủ: Loại hình dịch vụ, Gói cước/nội dung, Đơn vị tính, Số lượng, Đơn giá.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmQuote(customerId, input);
      setConfirmed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cấp số báo giá. Vui lòng thử lại.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleDownload(format: QuoteFormat) {
    if (!confirmed) return;
    setDownloading(format);
    setError(null);
    try {
      const blob = await downloadQuoteFile(customerId, confirmed.id, format);
      saveBlob(blob, `Bao-gia_${confirmed.docNumber}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải file. Vui lòng thử lại.");
    } finally {
      setDownloading(null);
    }
  }

  const pdfAvailable = preview?.pdfAvailable ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        data-testid="quote-modal"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Lập báo giá</h3>
            <p className="text-xs text-slate-500">
              Khách: <span className="font-semibold text-slate-800">{customerName}</span>
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

        {confirmed ? (
          <div className="space-y-4" data-testid="quo-done">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-900">
                <p className="font-bold">
                  {confirmed.reused ? "Dùng lại số báo giá đã cấp: " : "Đã cấp số báo giá: "}
                  <span data-testid="quo-issued-number" className="font-mono text-base">
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
              <p data-testid="quo-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="quo-download-docx"
                disabled={downloading !== null}
                onClick={() => handleDownload("docx")}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading === "docx" ? "Đang tạo file..." : "Tải file Word (.docx)"}</span>
              </button>
              <button
                type="button"
                data-testid="quo-download-pdf"
                disabled={downloading !== null}
                onClick={() => handleDownload("pdf")}
                className="flex items-center gap-1.5 rounded-xl border border-vnpt px-4 py-2 text-xs font-bold text-vnpt hover:bg-sky-50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading === "pdf" ? "Đang tạo PDF..." : "Tải file PDF"}</span>
              </button>
            </div>

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
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Loại hình dịch vụ</label>
                <input
                  data-testid="quo-service-type"
                  value={input.serviceType}
                  onChange={(e) => updateField("serviceType", e.target.value)}
                  placeholder="VD: Dịch vụ Internet cáp quang"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              {catalogItems.length > 0 && (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Chọn nhanh từ danh mục (tùy chọn)
                  </label>
                  <select
                    data-testid="quo-catalog-select"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleSelectCatalogItem(e.target.value);
                      e.target.value = "";
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    <option value="">— Chọn gói có sẵn hoặc tự nhập bên dưới —</option>
                    {catalogItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.value} — {item.price?.toLocaleString("vi-VN")} ₫
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Gói cước / Nội dung</label>
                <input
                  data-testid="quo-package-name"
                  value={input.packageName}
                  onChange={(e) => updateField("packageName", e.target.value)}
                  placeholder="VD: Gói FiberVNN 100Mbps"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Đơn vị tính</label>
                <input
                  data-testid="quo-unit"
                  value={input.unit}
                  onChange={(e) => updateField("unit", e.target.value)}
                  placeholder="VD: Gói/tháng"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Số lượng</label>
                <input
                  data-testid="quo-quantity"
                  type="number"
                  min={0}
                  value={input.quantity}
                  onChange={(e) => updateField("quantity", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Đơn giá (VNĐ)</label>
                <input
                  data-testid="quo-unit-price"
                  type="number"
                  min={0}
                  value={input.unitPrice}
                  onChange={(e) => updateField("unitPrice", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Thuế VAT (%)</label>
                <input
                  data-testid="quo-vat"
                  type="number"
                  min={0}
                  max={100}
                  value={input.vatPercent ?? 10}
                  onChange={(e) => updateField("vatPercent", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Ghi chú khác (tùy chọn)</label>
                <input
                  data-testid="quo-note"
                  value={input.note ?? ""}
                  onChange={(e) => updateField("note", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>
            </div>

            {preview && preview.missingFields.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Cảnh báo: còn thiếu thông tin
                </div>
                <p className="mt-1">
                  Còn thiếu: <span className="font-semibold">{preview.missingFields.join(", ")}</span>.
                </p>
              </div>
            )}

            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                Xem trước nội dung (chưa cấp số)
              </h4>
              <div
                data-testid="quo-preview"
                className="max-h-[260px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800"
              >
                {previewLoading ? (
                  <p className="text-slate-400">Đang cập nhật bản xem trước...</p>
                ) : preview?.lines?.length ? (
                  preview.lines.map((line, i) => <p key={`${i}-${line.slice(0, 20)}`}>{line}</p>)
                ) : (
                  <p className="text-slate-400">Nhập đủ thông tin dịch vụ để xem trước nội dung báo giá.</p>
                )}
              </div>
              {preview?.suggestedDocNumber && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Số báo giá kế tiếp dự kiến: {preview.suggestedDocNumber}. Số chỉ thật sự được cấp khi bạn bấm{" "}
                  <b>Xác nhận &amp; lấy số báo giá</b>.
                </p>
              )}
            </div>

            {error && (
              <p data-testid="quo-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
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
                data-testid="quo-confirm"
                disabled={confirming || !hasRequiredFields(input)}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{confirming ? "Đang cấp số..." : "Xác nhận & lấy số báo giá"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
