"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { Target, UserPlus, PhoneCall, CheckCircle2, TrendingUp, AlertTriangle, X, Pencil, Undo2, Trash2 } from "lucide-react";
import KpiCard from "@/components/admin/shared/KpiCard";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import StatusSelect from "@/components/admin/shared/StatusSelect";
import ChannelDetailPicker from "@/components/admin/shared/ChannelDetailPicker";
import ConfirmDeleteDialog from "@/components/admin/shared/ConfirmDeleteDialog";
import StageRequestsPanel from "./StageRequestsPanel";
import { TableFilter } from "@/lib/table-filters";
import {
  getLeads,
  createLead,
  updateLead,
  updateLeadStatus,
  assignLead,
  updateLeadNote,
  deleteLead,
  requestLeadStageChange,
  getLeadStageRequests,
  UpdateLeadInput,
} from "@/lib/api/leads.api";
import { getTerritories } from "@/lib/api/territories.api";
import { getStaff } from "@/lib/api/staff.api";
import { useAuth } from "@/lib/auth/auth-context";
import { LeadRecord, LeadStatus, StaffRecord, TerritoryRecord } from "@/lib/crm/types/crm.types";
import { LEAD_CHANNELS, LEAD_GROUP_LABEL } from "@/lib/crm/constants/org.constants";
import { isBackwardMove, LEAD_STATUSES } from "@/lib/crm/lead-status";
import {
  ChannelDetailValue,
  EMPTY_CHANNEL_DETAIL,
  channelNeedsDetail,
  formatChannelDetail,
} from "@/lib/crm/channel-detail";

const GROUP_OPTIONS: LeadRecord["group"][] = [
  "Lead KH mới",
  "Lead bán chéo DV",
  "Lead gia hạn",
];

interface LeadFormState {
  customerName: string;
  phone: string;
  email: string;
  group: LeadRecord["group"];
  channel: LeadRecord["channel"];
  staffName: string;
  demandDescription: string;
  detail: ChannelDetailValue;
  expectedValue: string;
  note: string;
}

interface AssignFormState {
  staffName: string;
  territoryId: string;
}

const EMPTY_FORM: LeadFormState = {
  customerName: "",
  phone: "",
  email: "",
  group: GROUP_OPTIONS[0],
  channel: LEAD_CHANNELS[0],
  staffName: "__RANDOM__",
  demandDescription: "",
  detail: EMPTY_CHANNEL_DETAIL,
  expectedValue: "0",
  note: "",
};

function formFromLead(lead: LeadRecord): LeadFormState {
  return {
    customerName: lead.customerName,
    phone: lead.phone,
    email: lead.email ?? "",
    group: lead.group,
    channel: lead.channel,
    staffName: lead.staffName,
    demandDescription: lead.demandDescription ?? "",
    detail: {
      channelSourceId: lead.channelSourceId ?? "",
      referredByCtvId: lead.referredByCtvId ?? "",
    },
    expectedValue: String(lead.expectedValue ?? 0),
    note: lead.note ?? "",
  };
}

type PageTab = "leads" | "requests";

/** Dòng hiển thị: thêm chuỗi "Chi tiết kênh" để tìm kiếm và xuất CSV khớp với cột trên bảng. */
type LeadRowView = LeadRecord & { channelDetail: string };

export default function LeadsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [data, setData] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<PageTab>("leads");
  const [pendingCount, setPendingCount] = useState(0);

  // Form dùng chung cho Tạo mới (editTarget = null) và Sửa thông tin (Admin).
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LeadRecord | null>(null);
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);

  const [assignTarget, setAssignTarget] = useState<LeadRecord | null>(null);
  const [assignForm, setAssignForm] = useState<AssignFormState>({ staffName: "", territoryId: "" });
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [noteTarget, setNoteTarget] = useState<LeadRecord | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Nhân viên xin quay lại bước trước (cần Admin duyệt).
  const [requestTarget, setRequestTarget] = useState<LeadRecord | null>(null);
  const [requestToStatus, setRequestToStatus] = useState<LeadStatus>("Mới tiếp nhận");
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null);

  const activeAms = staffList.filter(
    (s) =>
      (s.role === "AM" || s.role === "AM Bán chăm") &&
      s.status === "Đang hoạt động"
  );

  // Danh mục phụ (Phường cho hộp Phân công, Nhân viên): lỗi ở đây không được làm hỏng bảng Lead.
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getTerritories(), getStaff()]).then(([wards, staff]) => {
      if (!isMounted) return;
      if (wards.status === "fulfilled") setTerritories(wards.value);
      if (staff.status === "fulfilled") setStaffList(staff.value);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const pending = await getLeadStageRequests("Chờ duyệt");
      setPendingCount(pending.length);
    } catch {
      // Số lượng chỉ là thông tin phụ: lỗi không được làm hỏng trang.
    }
  }, [isAdmin]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const reloadLeads = useCallback(async () => {
    try {
      setData(await getLeads());
    } catch {
      // Giữ dữ liệu đang có nếu tải lại thất bại.
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      setLoading(true);
      setError(null);
      try {
        const leads = await getLeads();
        if (isMounted) {
          setData(leads);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu Cơ hội. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadLeads();

    return () => {
      isMounted = false;
    };
  }, []);

  function openCreate() {
    setFormError(null);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(lead: LeadRecord) {
    setFormError(null);
    setEditTarget(lead);
    setForm(formFromLead(lead));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
  }

  // Khi sửa Lead cũ chưa có chi tiết kênh và không đổi kênh thì không bắt buộc chọn chi tiết.
  const originalHasDetail = Boolean(editTarget?.channelSourceId || editTarget?.referredByCtvId);
  const detailRequired = !editTarget || form.channel !== editTarget.channel || originalHasDetail;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editTarget) {
        const patch: UpdateLeadInput = {
          customerName: form.customerName,
          phone: form.phone,
          email: form.email.trim() ? form.email.trim() : null,
          group: form.group,
          demandDescription: form.demandDescription,
          expectedValue: Number(form.expectedValue || 0),
          note: form.note.trim() ? form.note.trim() : null,
        };
        const detailChanged =
          form.channel !== editTarget.channel ||
          form.detail.channelSourceId !== (editTarget.channelSourceId ?? "") ||
          form.detail.referredByCtvId !== (editTarget.referredByCtvId ?? "");
        if (detailChanged) {
          patch.channel = form.channel;
          patch.channelSourceId = form.detail.channelSourceId || null;
          patch.referredByCtvId = form.detail.referredByCtvId || null;
        }
        const updated = await updateLead(editTarget.id, patch);
        setData((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        const created = await createLead({
          customerName: form.customerName,
          phone: form.phone,
          email: form.email.trim() ? form.email.trim() : null,
          group: form.group,
          channel: form.channel,
          staffName: isAdmin ? form.staffName : (user?.name ?? ""),
          status: "Mới tiếp nhận",
          demandDescription: form.demandDescription,
          channelSourceId: form.detail.channelSourceId || null,
          referredByCtvId: form.detail.referredByCtvId || null,
          note: form.note.trim() ? form.note.trim() : undefined,
        });
        setData((prev) => [created, ...prev]);
      }
      closeForm();
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : editTarget
            ? "Không thể lưu thông tin Cơ hội. Vui lòng thử lại."
            : "Không thể tạo Cơ hội. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openEditNote(lead: LeadRecord) {
    setNoteTarget(lead);
    setNoteInput(lead.note || "");
    setNoteError(null);
  }

  async function handleSaveNote(e: FormEvent) {
    e.preventDefault();
    if (!noteTarget) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const updated = await updateLeadNote(noteTarget.id, noteInput);
      setData((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNoteTarget(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Không thể cập nhật ghi chú");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleConfirmDeleteLead() {
    if (!deleteTarget) return;
    await deleteLead(deleteTarget.id);
    setData((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function openAssign(lead: LeadRecord) {
    setAssignError(null);
    setAssignTarget(lead);
    setAssignForm({ staffName: lead.staffName, territoryId: lead.territoryId || "" });
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!assignTarget) return;
    setAssignError(null);
    setAssigning(true);
    try {
      const updated = await assignLead(assignTarget.id, {
        staffName: assignForm.staffName,
        territoryId: assignForm.territoryId || null,
      });
      setData((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setAssignTarget(null);
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Không thể phân công Cơ hội. Vui lòng thử lại."
      );
    } finally {
      setAssigning(false);
    }
  }

  function openRequest(lead: LeadRecord, toStatus?: LeadStatus) {
    const options = LEAD_STATUSES.filter((s) => isBackwardMove(lead.status, s));
    setRequestTarget(lead);
    setRequestToStatus(
      toStatus && options.includes(toStatus) ? toStatus : (options[options.length - 1] ?? "Mới tiếp nhận")
    );
    setRequestReason("");
    setRequestError(null);
  }

  async function handleSubmitRequest(e: FormEvent) {
    e.preventDefault();
    if (!requestTarget) return;
    setRequesting(true);
    setRequestError(null);
    try {
      await requestLeadStageChange(requestTarget.id, { toStatus: requestToStatus, reason: requestReason });
      setRequestTarget(null);
      setRequestNotice("Đã gửi yêu cầu quay lại bước trước. Vui lòng chờ Admin duyệt.");
      await reloadLeads();
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    } finally {
      setRequesting(false);
    }
  }

  async function handleStatusChange(item: LeadRecord, next: LeadStatus) {
    // Nhân viên không được lùi bước: mở hộp xin duyệt thay vì gọi API (API vẫn chặn 409).
    if (!isAdmin && isBackwardMove(item.status, next)) {
      openRequest(item, next);
      return;
    }
    const updated = await updateLeadStatus(item.id, next);
    setData((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
  }

  const rows: LeadRowView[] = data.map((lead) => ({
    ...lead,
    channelDetail: formatChannelDetail(lead.channel, lead.channelSourceName, lead.referredByCtvName),
  }));

  const columns: Column<LeadRowView>[] = [
    {
      header: "Khách hàng / Đầu mối",
      accessorKey: "customerName",
      cell: (item) => (
        <div>
          <div className="font-bold text-slate-900">{item.customerName}</div>
          <div className="text-[11px] text-slate-500">{item.demandDescription}</div>
        </div>
      ),
    },
    {
      header: "Số điện thoại",
      accessorKey: "phone",
      cell: (item) => (
        <span className="font-mono font-semibold text-vnpt">{item.phone}</span>
      ),
    },
    {
      header: "Nhóm cơ hội",
      accessorKey: "group",
      cell: (item) => (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          {LEAD_GROUP_LABEL[item.group] ?? item.group}
        </span>
      ),
    },
    {
      header: "Kênh phát triển",
      accessorKey: "channel",
      cell: (item) => <span className="font-medium text-slate-600">{item.channel}</span>,
    },
    {
      header: "Chi tiết kênh",
      accessorKey: "channelDetail",
      cell: (item) => (
        <span className="text-slate-600" data-testid="lead-channel-detail">
          {item.channelDetail}
        </span>
      ),
    },
    {
      header: "AM Phụ trách",
      accessorKey: "staffName",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span>{item.staffName}</span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => openAssign(item)}
              className="rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-vnpt hover:bg-slate-50"
            >
              Phân công
            </button>
          )}
        </div>
      ),
    },
    {
      header: "Trạng thái",
      accessorKey: "status",
      cell: (item) => (
        <div className="flex flex-col gap-1">
          <StatusSelect
            value={item.status}
            options={LEAD_STATUSES}
            onChange={(next) => handleStatusChange(item, next)}
          />
          {item.pendingStageRequest && (
            <span
              data-testid="lead-pending-request"
              className="text-[10px] font-semibold text-amber-600"
              title={item.pendingStageRequest.reason}
            >
              Chờ Admin duyệt quay lại: {item.pendingStageRequest.toStatus}
            </span>
          )}
          {!isAdmin && !item.pendingStageRequest && item.status !== LEAD_STATUSES[0] && (
            <button
              type="button"
              onClick={() => openRequest(item)}
              data-testid="lead-request-back"
              className="flex items-center gap-1 text-left text-[10px] font-semibold text-slate-500 hover:text-vnpt"
            >
              <Undo2 className="h-3 w-3" />
              Yêu cầu quay lại bước…
            </button>
          )}
        </div>
      ),
    },
    {
      header: "Ghi chú",
      accessorKey: "note",
      cell: (item) => (
        <div className="flex items-center gap-1.5 max-w-[220px]">
          <span
            className="truncate text-xs text-slate-600"
            title={item.note || "Chưa có ghi chú"}
          >
            {item.note
              ? item.note.length > 60
                ? `${item.note.slice(0, 60)}…`
                : item.note
              : "—"}
          </span>
          <button
            type="button"
            onClick={() => openEditNote(item)}
            title="Sửa ghi chú"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
    ...(isAdmin
      ? [
          {
            header: "Thao tác",
            cell: (item: LeadRowView) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  data-testid="lead-edit"
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-vnpt hover:bg-slate-50"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  data-testid="lead-delete"
                  title="Xóa Cơ hội"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          } satisfies Column<LeadRowView>,
        ]
      : []),
  ];

  const leadFilters: TableFilter<LeadRowView>[] = [
    {
      id: "group",
      label: "Loại lead",
      getValue: (r) => LEAD_GROUP_LABEL[r.group] ?? r.group,
    },
    {
      id: "channel",
      label: "Kênh",
      getValue: (r) => r.channel,
    },
    {
      id: "status",
      label: "Trạng thái",
      getValue: (r) => r.status,
    },
    {
      id: "staffName",
      label: "Nhân viên phụ trách",
      getValue: (r) => r.staffName,
    },
  ];

  const isEdit = Boolean(editTarget);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Quản lý Cơ hội kinh doanh
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi cơ hội từ tiếp nhận đến chốt gói cước và chuyển đổi thành hợp đồng
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-vnpt px-3.5 text-xs font-bold text-white shadow-xs hover:bg-vnpt-dark"
        >
          <UserPlus className="h-4 w-4" />
          <span className="btn-label">Tạo Cơ hội mới</span>
        </button>
      </div>

      {requestNotice && (
        <div
          role="status"
          data-testid="lead-request-notice"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span>{requestNotice}</span>
          <button type="button" onClick={() => setRequestNotice(null)} aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="CƠ HỘI ĐƯỢC GIAO"
          value="320"
          subtitle="Trong kỳ tháng T"
          icon={Target}
        />
        <KpiCard
          title="ĐÃ LIÊN HỆ"
          value="278"
          subtitle="Tỷ lệ tiếp cận: 86.9%"
          icon={PhoneCall}
        />
        <KpiCard
          title="CHỐT THÀNH CÔNG"
          value="126"
          subtitle="Tỷ lệ chốt: 39.4%"
          icon={CheckCircle2}
        />
        <KpiCard
          title="ĐANG TƯ VẤN"
          value="84"
          subtitle="Đang chăm sóc bám sát"
          icon={TrendingUp}
        />
      </div>

      {/* Tab: Danh sách / Yêu cầu chờ duyệt (Admin) */}
      {isAdmin && (
        <div className="flex gap-2" role="tablist" aria-label="Chế độ xem Cơ hội">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "leads"}
            onClick={() => setTab("leads")}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
              tab === "leads" ? "bg-vnpt text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Danh sách Cơ hội
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "requests"}
            data-testid="tab-stage-requests"
            onClick={() => setTab("requests")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ${
              tab === "requests" ? "bg-vnpt text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Yêu cầu chờ duyệt
            <span
              data-testid="stage-requests-count"
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                pendingCount > 0 ? "bg-amber-400 text-amber-950" : "bg-slate-200 text-slate-600"
              }`}
            >
              {pendingCount}
            </span>
          </button>
        </div>
      )}

      {isAdmin && tab === "requests" ? (
        <StageRequestsPanel
          onDecided={() => {
            refreshPendingCount();
            reloadLeads();
          }}
        />
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">
            Không thể tải dữ liệu Cơ hội
          </p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải dữ liệu Cơ hội...
        </div>
      ) : (
        <DataTable
          title="Danh sách Cơ hội kinh doanh"
          subtitle="Quản lý phễu khách hàng theo từng kênh và từng AM phụ trách"
          columns={columns}
          data={rows}
          filters={leadFilters}
          searchPlaceholder="Tìm theo tên khách hàng, SĐT, kênh phát triển..."
          exportFileName="vnpt_leads"
        />
      )}

      {/* Create / Edit Lead Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? "Sửa thông tin Cơ hội" : "Tạo Cơ hội mới"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Đóng"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Tên khách hàng / Đầu mối
                </label>
                <input
                  required
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Số điện thoại
                  </label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                {isEdit ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Giá trị dự kiến (₫)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.expectedValue}
                      onChange={(e) => setForm({ ...form, expectedValue: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      AM Phụ trách
                    </label>
                    <select
                      value={isAdmin ? form.staffName : (user?.name ?? "")}
                      onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                      disabled={!isAdmin}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {isAdmin ? (
                        <>
                          <option value="__RANDOM__">🎲 Ngẫu nhiên</option>
                          {activeAms.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value={user?.name ?? ""}>{user?.name ?? ""}</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Email <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Nhóm cơ hội
                  </label>
                  <select
                    value={form.group}
                    onChange={(e) =>
                      setForm({ ...form, group: e.target.value as LeadRecord["group"] })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {LEAD_GROUP_LABEL[g]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Kênh phát triển
                  </label>
                  <select
                    value={form.channel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        channel: e.target.value as LeadRecord["channel"],
                        detail: EMPTY_CHANNEL_DETAIL,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {LEAD_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {channelNeedsDetail(form.channel) && (
                <ChannelDetailPicker
                  channel={form.channel}
                  value={form.detail}
                  onChange={(detail) => setForm({ ...form, detail })}
                  required={detailRequired}
                  currentLabel={editTarget?.channelSourceName ?? editTarget?.referredByCtvName}
                />
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nhu cầu
                </label>
                <textarea
                  value={form.demandDescription}
                  onChange={(e) => setForm({ ...form, demandDescription: e.target.value })}
                  rows={2}
                  placeholder="Mô tả nhu cầu của khách hàng..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Ghi chú
                </label>
                <textarea
                  maxLength={1000}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  placeholder="Ghi chú thêm về khách hàng (tùy chọn, tối đa 1000 ký tự)..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-label rounded-xl bg-vnpt px-3.5 py-2 text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {submitting
                    ? isEdit
                      ? "Đang lưu..."
                      : "Đang tạo..."
                    : isEdit
                      ? "Lưu thay đổi"
                      : "Tạo Cơ hội"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Lead Modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Phân công Cơ hội</h3>
              <button
                onClick={() => setAssignTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">{assignTarget.customerName}</p>

            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nhân viên phụ trách
                </label>
                <select
                  required
                  value={assignForm.staffName}
                  onChange={(e) => setAssignForm({ ...assignForm, staffName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                >
                  {!staffList.some((m) => m.name === assignForm.staffName) && (
                    <option value={assignForm.staffName}>{assignForm.staffName}</option>
                  )}
                  {staffList.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Phường
                </label>
                <select
                  value={assignForm.territoryId}
                  onChange={(e) => setAssignForm({ ...assignForm, territoryId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                >
                  <option value="">— Chưa gán phường —</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.wardName}
                    </option>
                  ))}
                </select>
              </div>

              {assignError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {assignError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignTarget(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="btn-label rounded-xl bg-vnpt px-3.5 py-2 text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {assigning ? "Đang lưu..." : "Lưu phân công"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request stage change Modal (nhân viên xin quay lại bước trước) */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div
            role="dialog"
            aria-label="Yêu cầu quay lại bước trước"
            data-testid="lead-request-dialog"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Yêu cầu quay lại bước trước</h3>
              <button
                type="button"
                onClick={() => setRequestTarget(null)}
                aria-label="Đóng"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-1 text-xs text-slate-500">
              Cơ hội: <span className="font-semibold text-slate-700">{requestTarget.customerName}</span> · đang ở{" "}
              <span className="font-semibold text-slate-700">{requestTarget.status}</span>
            </p>
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt.
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Quay lại trạng thái</label>
                <select
                  value={requestToStatus}
                  onChange={(e) => setRequestToStatus(e.target.value as LeadStatus)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                >
                  {LEAD_STATUSES.filter((s) => isBackwardMove(requestTarget.status, s)).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Lý do <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Vì sao cần quay lại bước này (tối đa 500 ký tự)..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              {requestError && (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {requestError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestTarget(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={requesting || !requestReason.trim()}
                  data-testid="lead-request-submit"
                  className="btn-label rounded-xl bg-vnpt px-3.5 py-2 text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {requesting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Cập nhật Ghi chú Cơ hội</h3>
              <button
                onClick={() => setNoteTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Khách hàng: <span className="font-semibold text-slate-700">{noteTarget.customerName}</span> ({noteTarget.phone})
            </p>

            <form onSubmit={handleSaveNote} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nội dung ghi chú
                </label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Nhập nội dung ghi chú khi xử lý lead (tối đa 1000 ký tự)..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">
                  {noteInput.length}/1000 ký tự
                </div>
              </div>

              {noteError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {noteError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="btn-label rounded-xl bg-vnpt px-3.5 py-2 text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Xóa Cơ hội"
        description={
          deleteTarget ? (
            <>
              Xóa Cơ hội của <strong>{deleteTarget.customerName}</strong> ({deleteTarget.phone})? Thao tác này không
              thể hoàn tác.
            </>
          ) : (
            ""
          )
        }
        onConfirm={handleConfirmDeleteLead}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
