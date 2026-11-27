"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, Search, RefreshCw, FileText } from "lucide-react";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import {
  getCustomers,
  listAllQuoteExports,
  downloadQuoteFile,
  type QuoteExportRecordDto,
} from "@/lib/api/customers.api";
import type { CustomerRecord } from "@/lib/crm/types/crm.types";
import QuoteModal from "@/components/admin/customer/QuoteModal";

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

export default function QuotesPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [exportsList, setExportsList] = useState<QuoteExportRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchCustomerQuery, setSearchCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [customersData, exportsData] = await Promise.all([getCustomers(), listAllQuoteExports()]);
      setCustomers(customersData);
      setExportsList(exportsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(customerId: string, exportId: string, docNumber: string) {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadQuoteFile(customerId, exportId, "docx");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bao-gia_${docNumber}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Không thể tải file");
    } finally {
      setDownloading(false);
    }
  }

  const matchingCustomers = useMemo(() => {
    if (!searchCustomerQuery.trim()) return [];
    const q = searchCustomerQuery.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.identityCode && c.identityCode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [customers, searchCustomerQuery]);

  const columns: Column<QuoteExportRecordDto>[] = [
    {
      header: "Số báo giá",
      accessorKey: "docNumber",
      cell: (item) => <span className="font-mono font-bold text-vnpt">Số: {item.docNumber}</span>,
    },
    {
      header: "Khách hàng",
      accessorKey: "customerName",
      cell: (item) => <span className="font-medium text-slate-900">{item.customerName || "—"}</span>,
    },
    {
      header: "Gói cước",
      accessorKey: "packageName",
      cell: (item) => (
        <div>
          <span className="block font-medium text-slate-800">{item.packageName}</span>
          <span className="text-[11px] text-slate-500">
            {item.quantity} x {formatMoney(item.unitPrice)} ₫
          </span>
        </div>
      ),
    },
    {
      header: "Người lập",
      accessorKey: "exportedBy",
      cell: (item) => <span className="text-slate-700">{item.exportedBy || "Hệ thống"}</span>,
    },
    {
      header: "Thời điểm",
      accessorKey: "exportedAt",
      cell: (item) => (
        <span className="text-slate-500">{new Date(item.exportedAt).toLocaleString("vi-VN")}</span>
      ),
    },
    {
      header: "Thao tác",
      accessorKey: "id",
      cell: (item) => (
        <button
          type="button"
          disabled={downloading}
          onClick={() => handleDownload(item.customerId, item.id, item.docNumber)}
          className="flex h-7 items-center gap-1 rounded-lg bg-sky-50 px-2 text-xs font-semibold text-sky-700 border border-sky-200 hover:bg-sky-100 disabled:opacity-60"
          title="Tải lại file Word này"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Tải lại</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Báo giá</h2>
          <p className="text-xs text-slate-500">
            Tìm khách hàng để lập báo giá dịch vụ, và xem lại lịch sử báo giá đã cấp số
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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Chọn khách hàng để lập báo giá</h3>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={searchCustomerQuery}
            onChange={(e) => setSearchCustomerQuery(e.target.value)}
            placeholder="Gõ tên khách hàng hoặc mã số thuế..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-vnpt focus:outline-none"
          />
        </div>

        {matchingCustomers.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {matchingCustomers.map((cus) => (
              <div key={cus.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                <div>
                  <span className="font-medium text-slate-800">{cus.name}</span>
                  {cus.identityCode && (
                    <span className="ml-2 text-xs font-mono text-slate-500">MST: {cus.identityCode}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(cus)}
                  className="flex items-center gap-1 rounded-lg bg-vnpt px-3 py-1.5 text-xs font-bold text-white hover:bg-vnpt-dark"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Lập báo giá</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
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
            Đang tải lịch sử báo giá...
          </div>
        ) : (
          <DataTable
            title="Lịch sử các lần cấp số báo giá"
            subtitle="Theo dõi số báo giá, khách hàng và người thực hiện"
            columns={columns}
            data={exportsList}
            searchPlaceholder="Tìm theo số báo giá, khách hàng..."
            exportFileName="lich_su_bao_gia"
          />
        )}
      </div>

      {selectedCustomer && (
        <QuoteModal
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onClose={() => {
            setSelectedCustomer(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
