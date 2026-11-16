"use client";

import { useMemo, useState, ChangeEvent } from "react";
import { X, UploadCloud, AlertTriangle, CheckCircle2, FileSpreadsheet, Download } from "lucide-react";
import {
  previewServiceImport,
  commitServiceImport,
  ClassifiedServiceRow,
  ServiceImportPreviewResult,
  CommitServiceImportResult,
  ServiceCommitAction,
  ServiceCommitDecisionInput,
} from "@/lib/api/service-import.api";

interface RowState {
  classified: ClassifiedServiceRow;
  action: ServiceCommitAction;
}

type TabKey = "new" | "update" | "error";

interface ServiceImportWizardProps {
  onClose: () => void;
  onImported: () => void;
}

function buildInitialRowState(classified: ClassifiedServiceRow): RowState {
  return {
    classified,
    action: classified.status === "update" ? "update" : "create",
  };
}

export default function ServiceImportWizard({ onClose, onImported }: ServiceImportWizardProps) {
  const [step, setStep] = useState<"upload" | "review" | "result">("upload");

  // Bước 1
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Bước 2
  const [rowStates, setRowStates] = useState<RowState[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bước 3
  const [result, setResult] = useState<CommitServiceImportResult | null>(null);

  async function handleCheckFile() {
    if (!file) {
      setUploadError("Vui lòng chọn file Excel");
      return;
    }
    setUploadError(null);
    setChecking(true);
    try {
      const preview: ServiceImportPreviewResult = await previewServiceImport(file);
      setRowStates(preview.rows.map(buildInitialRowState));
      setActiveTab(preview.summary.new > 0 ? "new" : preview.summary.update > 0 ? "update" : "error");
      setStep("review");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Kiểm tra file thất bại");
    } finally {
      setChecking(false);
    }
  }

  const newRows = useMemo(() => rowStates.filter((r) => r.classified.status === "new"), [rowStates]);
  const updateRows = useMemo(
    () => rowStates.filter((r) => r.classified.status === "update"),
    [rowStates]
  );
  const errorRows = useMemo(() => rowStates.filter((r) => r.classified.status === "error"), [rowStates]);

  const visibleRows = useMemo(() => {
    if (activeTab === "new") return newRows;
    if (activeTab === "update") return updateRows;
    return errorRows;
  }, [activeTab, newRows, updateRows, errorRows]);

  const canSubmit = newRows.length > 0 || updateRows.length > 0;

  function updateRowAction(rowNumber: number, action: ServiceCommitAction) {
    setRowStates((prev) =>
      prev.map((r) => (r.classified.row.rowNumber === rowNumber ? { ...r, action } : r))
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const decisions: ServiceCommitDecisionInput[] = [...newRows, ...updateRows].map((r) => ({
        row: r.classified.row,
        action: r.action,
      }));

      const res = await commitServiceImport({ decisions });
      setResult(res);
      setStep("result");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Nhập dữ liệu thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vnpt/10 text-vnpt">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nhập dịch vụ khách đang sử dụng (Excel)</h3>
              <p className="text-[11px] text-slate-500">
                Khách đã có mã thuê bao sẽ được cập nhật, chưa có sẽ được tạo mới
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    File Excel (.xlsx, .xls) <span className="text-rose-500">*</span>
                  </label>
                  <a
                    href="/templates/mau-nhap-dich-vu.xlsx"
                    download
                    className="flex items-center gap-1 text-[11px] font-semibold text-vnpt hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Tải file mẫu
                  </a>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-vnpt/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-vnpt hover:file:bg-vnpt/20"
                />
              </div>

              <p className="rounded-lg bg-sky-50 p-2.5 text-[11px] text-sky-800">
                Mỗi dòng là một dịch vụ - mã thuê bao của một khách hàng đã có trong hệ thống. Hệ thống khớp khách
                theo <b>Mã khách hàng</b> trước, sau đó <b>MST/CCCD</b>, cuối cùng là <b>Tên khách hàng</b> (đúng
                nguyên văn, không phân biệt hoa/thường). Bắt buộc có <b>Mã thuê bao</b> và <b>Tên dịch vụ</b>. Mã
                thuê bao thuộc dịch vụ sinh từ đơn hàng phải chỉnh ở đơn hàng.
              </p>

              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2">
                {([
                  ["new", `Dịch vụ mới (${newRows.length})`],
                  ["update", `Cập nhật (${updateRows.length})`],
                  ["error", `Lỗi (${errorRows.length})`],
                ] as [TabKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === key ? "bg-vnpt text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {visibleRows.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">Không có dòng nào</p>
                )}
                {visibleRows.map((row) => {
                  const { classified } = row;
                  return (
                    <div
                      key={classified.row.rowNumber}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Dòng {classified.row.rowNumber} — {classified.row.serviceCode || "(không có mã thuê bao)"}
                          {classified.row.serviceName ? ` · ${classified.row.serviceName}` : ""}
                        </p>
                        {classified.status === "error" ? (
                          <p className="text-xs text-rose-600">{classified.notes.join("; ")}</p>
                        ) : (
                          classified.resolved && (
                            <p className="text-[11px] text-slate-500">
                              {classified.resolved.startDate} → {classified.resolved.expirationDate}
                              {classified.resolved.staffName ? ` · AM: ${classified.resolved.staffName}` : ""}
                            </p>
                          )
                        )}
                        {classified.customer && (
                          <p className="mt-1 text-[11px] text-emerald-700">
                            Khách hàng trong hệ thống: {classified.customer.name}
                            {classified.customer.customer_code ? ` (Mã KH: ${classified.customer.customer_code})` : ""}
                            {classified.customer.identity_code
                              ? ` (MST: ${classified.customer.identity_code})`
                              : ""}
                          </p>
                        )}
                        {classified.status === "update" && classified.existing && (
                          <p className="mt-1 text-[11px] text-amber-700">
                            Dịch vụ hiện có: {classified.existing.service_name} (
                            {classified.existing.start_date} → {classified.existing.expiration_date})
                          </p>
                        )}
                        {classified.notes.length > 0 && classified.status !== "error" && (
                          <p className="mt-1 text-[11px] text-amber-700">{classified.notes.join("; ")}</p>
                        )}
                      </div>

                      {classified.status !== "error" && (
                        <select
                          value={row.action}
                          onChange={(e) =>
                            updateRowAction(classified.row.rowNumber, e.target.value as ServiceCommitAction)
                          }
                          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
                        >
                          {classified.status === "update" ? (
                            <option value="update">Cập nhật</option>
                          ) : (
                            <option value="create">Tạo mới</option>
                          )}
                          <option value="skip">Bỏ qua</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <span>
                  Tạo mới {result.created}, cập nhật {result.updated}, bỏ qua {result.skipped}
                  {result.errors.length > 0 ? `, lỗi ${result.errors.length}` : ""}.
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                  {result.errors.map((e, i) => (
                    <p key={i}>
                      Dòng {e.rowNumber}: {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
          {step === "upload" && (
            <>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCheckFile}
                disabled={checking}
                className="flex items-center gap-1.5 rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                <UploadCloud className="h-4 w-4" />
                {checking ? "Đang kiểm tra..." : "Kiểm tra file"}
              </button>
            </>
          )}
          {step === "review" && (
            <>
              <button
                onClick={() => setStep("upload")}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Quay lại
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
              >
                {submitting ? "Đang nhập dữ liệu..." : "Nhập dữ liệu"}
              </button>
            </>
          )}
          {step === "result" && (
            <button
              onClick={() => {
                onImported();
                onClose();
              }}
              className="rounded-xl bg-vnpt px-4 py-2 text-xs font-bold text-white hover:bg-vnpt-dark"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
