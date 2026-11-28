"use client";

import { useEffect, useState, useRef, ChangeEvent } from "react";
import { Download, Trash2, UploadCloud, FileText, Eye, X } from "lucide-react";
import {
  CustomerDocumentRecord,
  getCustomerDocuments,
  uploadCustomerDocument,
  deleteCustomerDocument,
  downloadCustomerDocument,
  fetchCustomerDocumentPreviewPdf,
} from "@/lib/api/customers.api";
import { DocumentType } from "@/lib/crm/types/crm.types";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from "@/lib/crm/constants/org.constants";

interface CustomerDocumentsProps {
  customerId: string;
  /** Chỉ Admin được xóa giấy tờ (theo route backend requireAdmin). */
  canDelete?: boolean;
}

function formatSize(size: number | null): string {
  if (!size) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CustomerDocuments({ customerId, canDelete }: CustomerDocumentsProps) {
  const [docs, setDocs] = useState<CustomerDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocumentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const fileInputs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    GPKD: null,
    CCCD: null,
    KHAC: null,
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await getCustomerDocuments(customerId);
        if (isMounted) setDocs(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách giấy tờ");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  async function reload() {
    try {
      const data = await getCustomerDocuments(customerId);
      setDocs(data);
    } catch {
      // Giữ danh sách cũ nếu reload lỗi; lỗi upload/xóa đã báo riêng.
    }
  }

  async function handleUpload(docType: DocumentType, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploadingType(docType);
    try {
      await uploadCustomerDocument(customerId, docType, file);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải lên giấy tờ thất bại");
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDownload(doc: CustomerDocumentRecord) {
    try {
      await downloadCustomerDocument(doc.id, doc.originalName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải file thất bại");
    }
  }

  async function handleDelete(doc: CustomerDocumentRecord) {
    setError(null);
    try {
      await deleteCustomerDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa giấy tờ thất bại");
    }
  }

  async function handlePreview(doc: CustomerDocumentRecord) {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const blob = await fetchCustomerDocumentPreviewPdf(doc.id);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Không xem trước được file này");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewDoc(null);
    setPreviewUrl(null);
    setPreviewError(null);
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Đang tải danh sách giấy tờ...</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>
      )}

      {DOCUMENT_TYPES.map((docType) => {
        const docsOfType = docs.filter((d) => d.docType === docType);
        return (
          <div key={docType} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h5 className="text-xs font-bold text-slate-700">{DOCUMENT_TYPE_LABEL[docType]}</h5>
              <div>
                <input
                  ref={(el) => {
                    fileInputs.current[docType] = el;
                  }}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleUpload(docType, e)}
                />
                <button
                  type="button"
                  disabled={uploadingType === docType}
                  onClick={() => fileInputs.current[docType]?.click()}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-vnpt hover:border-vnpt disabled:opacity-60"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  {uploadingType === docType ? "Đang tải lên..." : "Tải lên"}
                </button>
              </div>
            </div>

            {docsOfType.length === 0 ? (
              <p className="text-[11px] text-slate-400">Chưa có file</p>
            ) : (
              <div className="space-y-1.5">
                {docsOfType.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div className="truncate text-xs">
                        <div className="truncate font-medium text-slate-700">{doc.originalName}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatSize(doc.size)}
                          {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                          {doc.createdAt ? ` · ${doc.createdAt.slice(0, 10)}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreview(doc)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-vnpt"
                        title="Xem trước"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-vnpt"
                        title="Tải về"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="truncate text-sm font-bold text-slate-900">{previewDoc.originalName}</h3>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl bg-slate-50">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Đang tải bản xem trước...
                </div>
              ) : previewError ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-rose-600">
                  {previewError}
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} title={previewDoc.originalName} className="h-full w-full" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
