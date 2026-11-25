"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, Eye, FileText, X } from "lucide-react";
import {
  downloadContractExportFile,
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

/**
 * Xem trước nội dung Hợp đồng điền từ mẫu TRƯỚC khi tải (chữ hoặc PDF), rồi mới
 * chọn tải Word (.docx) hoặc PDF. Hợp đồng không cấp số văn bản nên không có
 * bước "xác nhận lấy số" như Đề nghị thanh toán.
 */
export default function ContractExportPreviewModal({
  order,
  onClose,
}: Readonly<ContractExportPreviewModalProps>) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ContractExportPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "pdf">("text");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState<ContractExportFormat | null>(null);

  useEffect(() => {
    let cancelled = false;
    getContractExportPreview(order.id)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải bản xem trước hợp đồng");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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

  async function handleViewPdf() {
    setViewMode("pdf");
    if (pdfPreviewUrl) return;
    setPdfLoading(true);
    setError(null);
    try {
      const blob = await downloadContractExportFile(order.id, "pdf");
      setPdfPreviewUrl(window.URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo bản xem trước PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        data-testid="contract-export-preview-modal"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Xem trước Hợp đồng</h3>
            <p className="text-xs text-slate-500">
              Mã GD: <span className="font-mono font-bold text-vnpt">{order.transactionCode}</span> · Khách:{" "}
              <span className="font-semibold text-slate-800">{order.customerName}</span>
              {preview?.templateLabel && <> · Mẫu: {preview.templateLabel}</>}
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
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>
            )}

            {preview && preview.missingFields.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">Thiếu dữ liệu để điền đầy đủ mẫu:</p>
                  <p className="mt-0.5">{preview.missingFields.join(", ")}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  viewMode === "text" ? "bg-vnpt text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Xem dạng chữ
              </button>
              <button
                type="button"
                onClick={handleViewPdf}
                disabled={pdfLoading}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                  viewMode === "pdf" ? "bg-vnpt text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {pdfLoading ? "Đang tạo..." : "Xem bản in (PDF)"}
              </button>
            </div>

            {viewMode === "text" ? (
              <div
                data-testid="contract-preview-text"
                className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700"
              >
                {(preview?.lines ?? []).map((line, idx) => (
                  <p key={idx}>{line || " "}</p>
                ))}
              </div>
            ) : pdfPreviewUrl ? (
              <iframe title="Xem trước PDF hợp đồng" src={pdfPreviewUrl} className="h-[50vh] w-full rounded-xl border border-slate-200" />
            ) : (
              <div className="flex h-[50vh] items-center justify-center rounded-xl border border-slate-200 text-xs text-slate-400">
                Đang tải bản in PDF...
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleDownload("pdf")}
                disabled={downloading !== null}
                className="flex items-center gap-1.5 rounded-xl border border-vnpt px-3.5 py-2 text-xs font-bold text-vnpt hover:bg-vnpt/5 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloading === "pdf" ? "Đang tải..." : "Tải PDF"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload("docx")}
                disabled={downloading !== null}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-3.5 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {downloading === "docx" ? "Đang tải..." : "Tải Word (.docx)"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
