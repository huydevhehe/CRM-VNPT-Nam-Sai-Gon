"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckSquare, Settings2, Clock, AlertTriangle, UploadCloud, Info, CheckCircle2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import KpiCard from "@/components/admin/shared/KpiCard";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import StatusBadge from "@/components/admin/shared/StatusBadge";
import ConfirmDeleteDialog from "@/components/admin/shared/ConfirmDeleteDialog";
import ServiceImportWizard from "@/components/admin/service/ServiceImportWizard";
import { TableFilter } from "@/lib/table-filters";
import { getServices, deleteService } from "@/lib/api/services.api";
import { createTask } from "@/lib/api/tasks.api";
import { ServiceRecord } from "@/lib/crm/types/crm.types";

export default function ServicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState<string | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null);

  // Số liệu các thẻ: đếm thẳng từ danh sách dịch vụ bên dưới (cùng phạm vi quyền của người xem).
  const activeCount = data.filter((item) => !item.isExpired).length;
  const expiringIn30 = data.filter((item) => !item.isExpired && item.daysRemaining <= 30).length;
  const expiringIn7 = data.filter((item) => !item.isExpired && item.daysRemaining <= 7).length;
  const expiredCount = data.filter((item) => item.isExpired).length;
  const cardValue = (n: number) => (loading || error ? "—" : n.toLocaleString("vi-VN"));

  async function handleCreateTask(item: ServiceRecord) {
    setCreatingCode(item.serviceCode);
    setNotice(null);
    try {
      await createTask({
        title: `Chăm sóc dịch vụ sắp hết hạn - ${item.customerName}`,
        relatedTarget: item.serviceCode,
        assignee: item.staffName,
        dueDate: item.expirationDate,
        priority: "Cao",
        status: "Mới",
      });
      setNotice({ type: "success", text: `Đã tạo nhiệm vụ chăm sóc cho ${item.customerName}. Xem tại menu Công việc.` });
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Không thể tạo nhiệm vụ chăm sóc. Vui lòng thử lại.",
      });
    } finally {
      setCreatingCode(null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadServices() {
      setLoading(true);
      setError(null);
      try {
        const services = await getServices();
        if (isMounted) {
          setData(services);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu dịch vụ. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadServices();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleConfirmDeleteService() {
    if (!deleteTarget) return;
    await deleteService(deleteTarget.id);
    setData((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const columns: Column<ServiceRecord>[] = [
    {
      header: "Khách hàng",
      accessorKey: "customerName",
      cell: (item) => (
        <span className="font-bold text-slate-900">{item.customerName}</span>
      ),
    },
    {
      header: "Tên dịch vụ",
      accessorKey: "serviceName",
      cell: (item) => (
        <span className="font-medium text-slate-800">{item.serviceName}</span>
      ),
    },
    {
      header: "Mã thuê bao / Dịch vụ",
      accessorKey: "serviceCode",
      cell: (item) => (
        <span className="font-mono text-blue-700 font-semibold">
          {item.serviceCode}
        </span>
      ),
    },
    {
      header: "Ngày bắt đầu",
      accessorKey: "startDate",
      cell: (item) => item.startDate.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1"),
    },
    {
      header: "Ngày hết hạn",
      accessorKey: "expirationDate",
      cell: (item) => (
        <span
          className={`font-bold ${
            item.isExpired ? "text-rose-600" : "text-amber-700"
          }`}
        >
          {item.expirationDate.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1")}
        </span>
      ),
    },
    {
      header: "Cảnh báo hạn",
      accessorKey: "daysRemaining",
      cell: (item) => {
        if (item.isExpired) {
          return <StatusBadge status="Đã hết hạn" variant="red" />;
        }
        return (
          <StatusBadge
            status={`Còn ${item.daysRemaining} ngày`}
            variant={item.daysRemaining <= 7 ? "red" : "amber"}
          />
        );
      },
    },
    {
      header: "Nhân viên chăm",
      accessorKey: "staffName",
    },
    {
      header: "Hành động",
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleCreateTask(item)}
            disabled={creatingCode === item.serviceCode}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            <CheckSquare className="h-3 w-3" />
            <span>{creatingCode === item.serviceCode ? "Đang tạo..." : "Tạo việc"}</span>
          </button>
          {isAdmin && !item.contractId && (
            <button
              type="button"
              onClick={() => setDeleteTarget(item)}
              title="Xóa dịch vụ nhập tay"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const serviceFilters: TableFilter<ServiceRecord>[] = [
    {
      id: "serviceName",
      label: "Dịch vụ",
      getValue: (r) => r.serviceName,
    },
    {
      id: "staffName",
      label: "Nhân viên phụ trách",
      getValue: (r) => r.staffName,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Dịch vụ & Cảnh báo hết hạn
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi thuê bao sắp hết hạn để kịp liên hệ gia hạn
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowImportWizard(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Nhập dịch vụ (Excel)</span>
            </button>
          )}
          {isAdmin && (
            <Link
              href="/admin/reminders"
              data-testid="services-reminder-config-link"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Settings2 className="h-4 w-4" />
              <span>Cấu hình mốc cảnh báo</span>
            </Link>
          )}
        </div>
      </div>

      {/* Giới thiệu trang */}
      <section
        data-testid="services-intro"
        className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-xs leading-relaxed text-slate-700"
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
          <Info className="h-4 w-4 text-vnpt" />
          Trang này dùng để làm gì?
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Mục đích:</strong> liệt kê các dịch vụ/thuê bao của khách kèm ngày hết hạn, để nhân viên biết dịch vụ nào cần
            liên hệ gia hạn trước. AM chỉ thấy dịch vụ do mình phụ trách.
          </li>
          <li>
            <strong>Dữ liệu lấy từ đâu:</strong> dịch vụ tự sinh khi tạo Đơn hàng (mỗi mã thuê bao một dịch vụ), hoặc Admin nhập từ file
            Excel (nút “Nhập dịch vụ”), hoặc thêm tay trong trang chi tiết khách hàng.
          </li>
          <li>
            <strong>Cảnh báo hạn:</strong> cột “Cảnh báo hạn” tính từ ngày hết hạn đến hôm nay — màu đỏ khi còn từ 7 ngày trở xuống
            hoặc đã hết hạn, màu vàng khi còn nhiều hơn. Bốn thẻ số phía trên được đếm trực tiếp từ danh sách bên dưới.
          </li>
          <li>
            <strong>Nút “Tạo việc”:</strong> tạo một công việc “Chăm sóc dịch vụ sắp hết hạn” giao cho nhân viên phụ trách dịch vụ đó (ưu
            tiên Cao, hạn là ngày hết hạn).{" "}
            {isAdmin
              ? "Email nhắc hạn tự động được cấu hình ở trang Nhắc hạn (nút “Cấu hình mốc cảnh báo”)."
              : "Email nhắc hạn tự động do Admin cấu hình."}
          </li>
        </ul>
      </section>

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          data-testid="services-notice"
          className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-bold underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* KPI Cards: số thật đếm từ danh sách dịch vụ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="services-kpi-cards">
        <KpiCard
          title="DỊCH VỤ CÒN HẠN"
          value={cardValue(activeCount)}
          subtitle="Trong phạm vi bạn được xem"
          icon={BellRing}
        />
        <KpiCard
          title="SẮP HẾT HẠN (30 NGÀY)"
          value={cardValue(expiringIn30)}
          subtitle="Cần liên hệ gia hạn sớm"
          icon={Clock}
        />
        <KpiCard
          title="SẮP HẾT HẠN (7 NGÀY)"
          value={cardValue(expiringIn7)}
          subtitle="Ưu tiên liên hệ ngay"
          icon={CheckSquare}
        />
        <KpiCard
          title="ĐÃ QUÁ HẠN"
          value={cardValue(expiredCount)}
          subtitle="Đã qua ngày hết hạn"
          icon={AlertTriangle}
        />
      </div>

      {/* Table */}
      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">
            Không thể tải dữ liệu dịch vụ
          </p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải dữ liệu dịch vụ...
        </div>
      ) : (
        <DataTable
          title="Danh sách dịch vụ cần theo dõi"
          subtitle="Hiển thị số ngày còn lại và cho phép tạo việc chăm sóc tức thì"
          columns={columns}
          data={data}
          filters={serviceFilters}
          searchPlaceholder="Tìm theo tên dịch vụ, khách hàng, mã thuê bao..."
          exportFileName="vnpt_dich_vu_canh_bao"
          pagination
        />
      )}

      {showImportWizard && (
        <ServiceImportWizard
          onClose={() => setShowImportWizard(false)}
          onImported={() => {
            getServices().then(setData).catch(() => {});
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Xóa dịch vụ"
        description={
          deleteTarget ? (
            <>
              Xóa dịch vụ <strong>{deleteTarget.serviceName}</strong> (mã {deleteTarget.serviceCode}) của khách{" "}
              <strong>{deleteTarget.customerName}</strong>? Thao tác này không thể hoàn tác.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleConfirmDeleteService}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
