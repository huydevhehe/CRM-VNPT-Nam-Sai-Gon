"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, X } from "lucide-react";
import {
  downloadContractExportFile,
  fetchContractExportPreviewPdf,
  getContractExportPreview,
  type ContractExportFormat,
  type ContractExportPreviewDto,
} from "@/lib/api/contracts.api";
import type { ContractRecord } from "@/lib/crm/types/crm.types";

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

interface ContractExportPreviewModalProps {
  order: ContractRecord;
  onClose: () => void;
}

/** Xem trước bản in hợp đồng (PDF, nếu máy chủ có LibreOffice) trước khi tải về. */
export default function ContractExportPreviewModal({ order, onClose }: Readonly<ContractExportPreviewModalProps>) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ContractExportPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ContractExportFormat | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  // Tải nội dung xem trước, rồi — nếu máy chủ hỗ trợ PDF — tự mở luôn bản in
  // (đây là mục đích chính của modal) ngay trong cùng chuỗi .then(), không set
  // state đồng bộ ở đầu effect.
  useEffect(() => {
    let cancelled = false;
    getContractExportPreview(order.id)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        if (!data.pdfAvailable) return;
        setPdfPreviewLoading(true);
        return fetchContractExportPreviewPdf(order.id).then((blob) => {
          if (!cancelled) setPdfPreviewUrl(window.URL.createObjectURL(blob));
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải xem trước hợp đồng");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setPdfPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  async function handleDownload(format: ContractExportFormat) {
    setDownloading(format);
    setError(null);
    try {
      const blob = await downloadContractExportFile(order.id, format);
      saveBlob(blob, `Hop-dong_${order.transactionCode}.${format}`);
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
        data-testid="contract-preview-modal"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Xem trước hợp đồng</h3>
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

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang chuẩn bị bản xem trước...</div>
        ) : (
          <div className="space-y-4">
            {preview && preview.missingFields.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Cảnh báo: Hợp đồng còn thiếu thông tin
                </div>
                <p className="mt-1">
                  Còn thiếu: <span className="font-semibold">{preview.missingFields.join(", ")}</span>.
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700">
                  Vẫn có thể tải hợp đồng (chỗ thiếu sẽ để trống trong file).
                </p>
              </div>
            )}

            <div>
              {pdfPreviewLoading ? (
                <div className="flex h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400">
                  Đang tạo bản in...
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  title="Bản in hợp đồng"
                  data-testid="contract-pdf-frame"
                  src={pdfPreviewUrl}
                  className="h-[420px] w-full rounded-xl border border-slate-200"
                />
              ) : (
                <div
                  data-testid="contract-preview-lines"
                  className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800"
                >
                  {!pdfAvailable && (
                    <p className="mb-2 text-[11px] font-semibold text-amber-700">
                      Máy chủ chưa cài LibreOffice nên chưa xem được bản in PDF — hiển thị nội dung dạng chữ.
                    </p>
                  )}
                  {(preview?.lines ?? []).map((line, i) => (
                    <p key={`${i}-${line.slice(0, 20)}`}>{line}</p>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p data-testid="contract-preview-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                data-testid="contract-download-docx"
                disabled={downloading !== null}
                onClick={() => handleDownload("docx")}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading === "docx" ? "Đang tạo file..." : "Tải file Word (.docx)"}</span>
              </button>
              <button
                type="button"
                data-testid="contract-download-pdf"
                disabled={downloading !== null || !pdfAvailable}
                onClick={() => handleDownload("pdf")}
                title={pdfAvailable ? undefined : "Máy chủ chưa cài LibreOffice nên chưa xuất được PDF"}
                className="flex items-center gap-1.5 rounded-xl border border-vnpt px-4 py-2 text-xs font-bold text-vnpt hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                <span>{downloading === "pdf" ? "Đang tạo PDF..." : "Tải file PDF"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
