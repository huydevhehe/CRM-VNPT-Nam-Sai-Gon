"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, RefreshCw } from "lucide-react";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import {
  downloadContractExportFile,
  getContracts,
  getContractTemplates,
  type ContractExportFormat,
} from "@/lib/api/contracts.api";
import type { ContractRecord, ContractTemplateOption } from "@/lib/crm/types/crm.types";

export default function ContractExportsPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [templates, setTemplates] = useState<ContractTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [contractsData, templatesData] = await Promise.all([getContracts(), getContractTemplates()]);
      setContracts(contractsData);
      setTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  const templateLabel = useMemo(() => {
    const map = new Map(templates.map((t) => [t.key, t.label]));
    return (key: string | null | undefined) => (key ? (map.get(key) ?? key) : "—");
  }, [templates]);

  // Chỉ những đơn đã chọn mẫu hợp đồng mới coi là "đã xuất hợp đồng" — đơn cũ
  // hoặc chưa chọn mẫu thì chưa có hợp đồng nào xuất ra.
  const issued = useMemo(() => contracts.filter((c) => c.contractTemplate), [contracts]);

  async function handleDownload(contractId: string, transactionCode: string, format: ContractExportFormat) {
    setDownloadingId(contractId);
    setDownloadError(null);
    try {
      const blob = await downloadContractExportFile(contractId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Hop-dong_${transactionCode}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Không thể tải file");
    } finally {
      setDownloadingId(null);
    }
  }

  const columns: Column<ContractRecord>[] = [
    {
      header: "Số hợp đồng",
      accessorKey: "contractNumber",
      cell: (item) => (
        <span className="font-mono font-bold text-vnpt">{item.contractNumber || "—"}</span>
      ),
    },
    {
      header: "Mã giao dịch",
      accessorKey: "transactionCode",
      cell: (item) => <span className="font-mono text-slate-700">{item.transactionCode}</span>,
    },
    {
      header: "Khách hàng",
      accessorKey: "customerName",
      cell: (item) => <span className="font-medium text-slate-900">{item.customerName || "—"}</span>,
    },
    {
      header: "Mẫu hợp đồng",
      accessorKey: "contractTemplate",
      cell: (item) => <span className="text-slate-700">{templateLabel(item.contractTemplate)}</span>,
    },
    {
      header: "Ngày ký",
      accessorKey: "signedDate",
      cell: (item) => <span className="text-slate-500">{item.signedDate || "—"}</span>,
    },
    {
      header: "Thao tác",
      accessorKey: "id",
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={downloadingId !== null}
            onClick={() => handleDownload(item.id, item.transactionCode, "docx")}
            className="flex h-7 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
            title="Tải file Word"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloadingId === item.id ? "Đang tải..." : "Word"}</span>
          </button>
          <button
            type="button"
            disabled={downloadingId !== null}
            onClick={() => handleDownload(item.id, item.transactionCode, "pdf")}
            className="flex h-7 items-center gap-1 rounded-lg border border-vnpt px-2 text-xs font-semibold text-vnpt hover:bg-sky-50 disabled:opacity-60"
            title="Tải file PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>PDF</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Hợp đồng</h2>
          <p className="text-xs text-slate-500">
            Danh sách các hợp đồng đã xuất ra từ mẫu — tải lại file Word/PDF bất kỳ lúc nào
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Làm mới</span>
        </button>
      </div>

      {downloadError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{downloadError}</span>
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">Không thể tải dữ liệu</p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải danh sách hợp đồng...
        </div>
      ) : (
        <DataTable
          title="Danh sách hợp đồng đã xuất"
          subtitle="Chỉ hiện đơn hàng đã chọn mẫu hợp đồng (đã xuất ít nhất 1 lần)"
          columns={columns}
          data={issued}
          searchPlaceholder="Tìm theo số hợp đồng, mã giao dịch, khách hàng..."
          exportFileName="vnpt_hop_dong"
          pagination
        />
      )}
    </div>
  );
}
