"use client";

import { useEffect, useRef, useState, FormEvent, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  CheckCircle,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  X,
  Edit2,
  DollarSign,
  Download,
  UploadCloud,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import KpiCard from "@/components/admin/shared/KpiCard";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import StatusSelect from "@/components/admin/shared/StatusSelect";
import ContractImportWizard from "@/components/admin/contract/ContractImportWizard";
import PaymentRequestModal from "@/components/admin/contract/PaymentRequestModal";
import ContractExportPreviewModal from "@/components/admin/contract/ContractExportPreviewModal";
import MoneyInput from "@/components/admin/shared/MoneyInput";
import { formatMoney } from "@/lib/money";
import {
  getContracts,
  createContract,
  updateContractInfo,
  updateContractStatus,
  getContractPayments,
  addContractPayment,
  deleteContractPayment,
  getContractTemplates,
  deleteContract,
  ContractPaymentDto,
} from "@/lib/api/contracts.api";
import { getLeads, getCtvOptions, CtvOption } from "@/lib/api/leads.api";
import { getCustomers } from "@/lib/api/customers.api";
import { getStaff } from "@/lib/api/staff.api";
import {
  ContractRecord,
  ContractItemInput,
  ContractTemplateOption,
  LeadRecord,
  CustomerRecord,
  StaffRecord,
} from "@/lib/crm/types/crm.types";
import { LEAD_CHANNELS } from "@/lib/crm/constants/org.constants";
import ChannelDetailPicker from "@/components/admin/shared/ChannelDetailPicker";
import ConfirmDeleteDialog from "@/components/admin/shared/ConfirmDeleteDialog";
import {
  ChannelDetailValue,
  EMPTY_CHANNEL_DETAIL,
  channelNeedsDetail,
  formatChannelDetail,
} from "@/lib/crm/channel-detail";

const CHANNEL_OPTIONS: readonly string[] = LEAD_CHANNELS;
const SERVICE_GROUPS = ["BRCĐ", "CNTT", "Di động"] as const;
const PAYMENT_METHODS = ["Trả trước", "Trả hàng tháng", "Theo giá trị hợp đồng"] as const;
const PREPAID_METHOD = "Trả trước";
// Số tháng trả trước: 6 và 12 là phổ biến nên đứng đầu danh sách.
const PREPAID_MONTH_OPTIONS = [12, 6, 3, 18, 24] as const;
const POPULAR_PREPAID_MONTHS: readonly number[] = [6, 12];
const DEFAULT_PREPAID_MONTHS = "12";
const AM_REQUIRED_MESSAGE = "Vui lòng chọn AM phát triển";
const PREPAID_REQUIRED_MESSAGE =
  "Hình thức Trả trước phải chọn số tháng trả trước: 3, 6, 12, 18 hoặc 24 tháng";

const CUSTOMER_REQUIRED_MESSAGE =
  "Vui lòng chọn Khách hàng. Đơn hàng bắt buộc phải gắn với một khách hàng trong hệ thống";

// T10 (STT 11): mỗi Mã giao dịch bắt buộc chọn 1 mẫu hợp đồng khi tạo mới.
const CONTRACT_TEMPLATE_REQUIRED_MESSAGE = "Vui lòng chọn mẫu hợp đồng";

const DEPLOYMENT_STATUSES: ContractRecord["deploymentStatus"][] = [
  "Chưa triển khai",
  "Đang triển khai",
  "Hoàn tất",
  "Tạm dừng",
  "Hủy",
];

const PAYMENT_STATUSES: ContractRecord["paymentStatus"][] = [
  "Chưa thanh toán",
  "Đã thanh toán",
];

const DOCUMENT_STATUSES: ContractRecord["documentStatus"][] = [
  "Soạn thảo",
  "Khách trình ký",
  "Hoàn thiện bàn giao",
];

// T9 (STT 10): một đơn có thể có nhiều dòng dịch vụ (mỗi dịch vụ 1 mã thuê bao)
// và/hoặc dòng thiết bị (vd TOKEN, không có mã thuê bao).
interface ItemFormRow {
  lineType: "service" | "device";
  serviceGroup: string;
  serviceName: string;
  packageName: string;
  subscriberCode: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_SERVICE_ITEM: ItemFormRow = {
  lineType: "service",
  serviceGroup: SERVICE_GROUPS[0],
  serviceName: "",
  packageName: "",
  subscriberCode: "",
  quantity: "1",
  unitPrice: "",
};

const TOKEN_DEVICE_PRICE = 162000;
const TOKEN_DEVICE_ITEM: ItemFormRow = {
  lineType: "device",
  serviceGroup: "",
  serviceName: "TOKEN",
  packageName: "",
  subscriberCode: "",
  quantity: "1",
  unitPrice: String(TOKEN_DEVICE_PRICE),
};

const ITEMS_REQUIRED_MESSAGE = "Đơn hàng phải có ít nhất một dòng dịch vụ hoặc thiết bị";
const SUBSCRIBER_CODE_REQUIRED_MESSAGE = "Mỗi dòng dịch vụ phải có mã thuê bao";
const UNIT_PRICE_REQUIRED_MESSAGE = "Mỗi dòng phải có đơn giá là số và không âm";

function itemLineAmount(item: ItemFormRow): number {
  const qty = item.lineType === "device" ? Number(item.quantity || 1) : 1;
  const price = Number(item.unitPrice || 0);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

function itemsTotal(items: ItemFormRow[]): number {
  return items.reduce((sum, it) => sum + itemLineAmount(it), 0);
}

function itemRecordToFormRow(item: {
  lineType: "service" | "device";
  serviceGroup: string | null;
  serviceName: string | null;
  packageName: string | null;
  subscriberCode: string | null;
  quantity: number;
  unitPrice: number;
}): ItemFormRow {
  return {
    lineType: item.lineType,
    serviceGroup: item.serviceGroup || (item.lineType === "service" ? SERVICE_GROUPS[0] : ""),
    serviceName: item.serviceName || "",
    packageName: item.packageName || "",
    subscriberCode: item.subscriberCode || "",
    quantity: String(item.quantity || 1),
    unitPrice: String(item.unitPrice ?? ""),
  };
}

interface OrderFormState {
  transactionCode: string;
  items: ItemFormRow[];
  channel: string;
  leadId: string;
  amStaff: string;
  paymentMethod: string;
  prepaidMonths: string;
  customerId: string;
  contractNumber: string;
  signedDate: string;
  termMonths: string;
  detail: ChannelDetailValue;
  /** Mẫu hợp đồng (T10, STT 11) — bắt buộc khi tạo mới. */
  contractTemplate: string;
}

const EMPTY_FORM: OrderFormState = {
  transactionCode: "",
  items: [{ ...EMPTY_SERVICE_ITEM }],
  channel: CHANNEL_OPTIONS[0],
  leadId: "",
  amStaff: "",
  paymentMethod: PAYMENT_METHODS[0],
  prepaidMonths: DEFAULT_PREPAID_MONTHS,
  customerId: "",
  contractNumber: "",
  signedDate: "",
  termMonths: "",
  detail: EMPTY_CHANNEL_DETAIL,
  contractTemplate: "",
};

export default function ContractsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [data, setData] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Thông điệp hoa hồng CTV (vd không có CTV nên không phát sinh, hoặc đã có hoa hồng CTV khác
  // nên không tự ghi đè khi đổi CTV) — hiện ngay sau khi tạo/sửa/đổi trạng thái đơn.
  const [commissionNotice, setCommissionNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const customerPickerRef = useRef<HTMLDivElement>(null);
  const [leadCustomerHint, setLeadCustomerHint] = useState<string | null>(null);

  // Đóng bảng gợi ý khách hàng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!customerPickerOpen) return;
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!customerPickerRef.current?.contains(event.target as Node)) {
        setCustomerPickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setCustomerPickerOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [customerPickerOpen]);

  // Payment Modal state
  const [payingOrder, setPayingOrder] = useState<ContractRecord | null>(null);
  const [payments, setPayments] = useState<ContractPaymentDto[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [addingPayment, setAddingPayment] = useState(false);

  // Export Modal state
  const [exportingOrder, setExportingOrder] = useState<ContractRecord | null>(null);

  // T10 (STT 11): bộ mẫu hợp đồng + xuất hợp đồng + xóa đơn hàng
  const [contractTemplates, setContractTemplates] = useState<ContractTemplateOption[]>([]);
  const [contractPreviewOrder, setContractPreviewOrder] = useState<ContractRecord | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<ContractRecord | null>(null);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [ctvOptions, setCtvOptions] = useState<CtvOption[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);

  // Filters
  const [codeFilter, setCodeFilter] = useState<string | null>(null);
  const [filterServiceGroup, setFilterServiceGroup] = useState<string>("ALL");
  const [filterAmStaff, setFilterAmStaff] = useState<string>("ALL");
  const [filterDeployment, setFilterDeployment] = useState<string>("ALL");
  const [filterPayment, setFilterPayment] = useState<string>("ALL");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");

  const ctvNameById = new Map(ctvOptions.map((c) => [c.id, c.name]));

  const editingOrder = editingId ? (data.find((d) => d.id === editingId) ?? null) : null;

  // Trả trước phải có số tháng; đơn cũ "Trả trước" chưa có số tháng thì chỉ bắt buộc khi đổi hình thức/đã có số tháng.
  const isPrepaid = form.paymentMethod === PREPAID_METHOD;
  const legacyPrepaidWithoutMonths = Boolean(
    editingOrder && editingOrder.paymentMethod === PREPAID_METHOD && !editingOrder.prepaidMonths
  );
  const prepaidRequired = isPrepaid && !legacyPrepaidWithoutMonths;
  const prepaidMonthsPayload = isPrepaid && form.prepaidMonths ? Number(form.prepaidMonths) : null;

  // Admin chọn được mọi khách; AM chỉ chọn khách mình phụ trách (khớp quy tắc backend).
  const selectableCustomers = useMemo(() => {
    if (isAdmin) return customers;
    const me = (user?.name ?? "").trim();
    return customers.filter(
      (c) => me !== "" && (c.amStaff?.trim() === me || c.amCaringStaff?.trim() === me)
    );
  }, [customers, isAdmin, user?.name]);

  const selectedCustomer = form.customerId
    ? (customers.find((c) => c.id === form.customerId) ?? null)
    : null;
  const sameAsEditing = Boolean(editingOrder && editingOrder.customerId === form.customerId);
  const selectedCustomerName =
    selectedCustomer?.name ?? (sameAsEditing ? (editingOrder?.customerName ?? "") : "");
  const selectedCustomerTaxCode =
    selectedCustomer?.identityCode ?? (sameAsEditing ? (editingOrder?.taxCode ?? "") : "");

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const pool = q
      ? selectableCustomers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.identityCode ?? "").toLowerCase().includes(q) ||
            (c.phone ?? "").toLowerCase().includes(q)
        )
      : selectableCustomers;
    return pool.slice(0, 8);
  }, [customerQuery, selectableCustomers]);

  // Lead đã chốt thành công mà chưa gắn đơn hàng nào
  const linkableLeads = leads.filter(
    (l) => l.status === "Chốt thành công" && !data.some((c) => c.leadId === l.id)
  );

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      getLeads(),
      getCtvOptions(),
      getCustomers(),
      getStaff({ status: "ACTIVE" }),
      getContractTemplates(),
    ]).then(([leadRes, ctvRes, custRes, staffRes, templateRes]) => {
      if (!isMounted) return;
      if (leadRes.status === "fulfilled") setLeads(leadRes.value);
      if (ctvRes.status === "fulfilled") setCtvOptions(ctvRes.value);
      if (custRes.status === "fulfilled") setCustomers(custRes.value);
      if (staffRes.status === "fulfilled") setStaffList(staffRes.value);
      if (templateRes.status === "fulfilled") setContractTemplates(templateRes.value);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ma");
    if (code) setCodeFilter(code);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadContracts() {
      setLoading(true);
      setError(null);
      try {
        const contracts = await getContracts();
        if (isMounted) {
          setData(contracts);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu Đơn hàng. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadContracts();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSelectLead(leadId: string) {
    const lead = linkableLeads.find((l) => l.id === leadId);
    if (!lead) {
      setForm({ ...form, leadId: "" });
      setLeadCustomerHint(null);
      return;
    }
    const leadName = lead.customerName.trim().toLowerCase();
    const sameName = selectableCustomers.filter((c) => c.name.trim().toLowerCase() === leadName);
    const matched = sameName.length === 1 ? sameName[0] : null;
    setLeadCustomerHint(
      matched
        ? null
        : `Lead "${lead.customerName}" chưa có khách hàng tương ứng trong hệ thống (hoặc có nhiều khách trùng tên). Vui lòng chọn hoặc tạo khách hàng trước khi lưu đơn.`
    );
    setCustomerQuery("");
    setForm({
      ...form,
      leadId,
      customerId: matched ? matched.id : "",
      items: [{ ...EMPTY_SERVICE_ITEM, unitPrice: String(lead.expectedValue) }],
      channel: lead.channel,
      amStaff: lead.staffName || "",
      // Kế thừa chi tiết kênh + CTV của Lead; người dùng vẫn sửa được trước khi lưu.
      detail: {
        channelSourceId: lead.channelSourceId ?? "",
        referredByCtvId: lead.referredByCtvId ?? "",
      },
    });
  }

  function handleSelectCustomer(customerId: string) {
    setForm({ ...form, customerId });
    setCustomerQuery("");
    setCustomerPickerOpen(false);
    setFormError(null);
  }

  function handleClearCustomer() {
    setForm({ ...form, customerId: "" });
    setCustomerQuery("");
    setCustomerPickerOpen(true);
  }

  function handleOpenCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setCustomerQuery("");
    setCustomerPickerOpen(false);
    setLeadCustomerHint(null);
    setShowForm(true);
  }

  async function handleOpenPaymentModal(order: ContractRecord) {
    setPayingOrder(order);
    setPaymentAmount("");
    setPaymentDate(new Date().toLocaleDateString("en-CA"));
    setPaymentNote("");
    setPaymentError(null);
    setLoadingPayments(true);
    try {
      const list = await getContractPayments(order.id);
      setPayments(list);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Không thể tải lịch sử thu tiền");
    } finally {
      setLoadingPayments(false);
    }
  }

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!payingOrder) return;
    const num = Number(paymentAmount);
    if (!num || num <= 0) {
      setPaymentError("Số tiền phải lớn hơn 0");
      return;
    }

    setAddingPayment(true);
    setPaymentError(null);
    try {
      const updated = await addContractPayment(payingOrder.id, {
        amount: num,
        paidDate: paymentDate || undefined,
        note: paymentNote || undefined,
      });

      // Update in data table
      setData((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setPayingOrder(updated);

      // Reload payments list
      const list = await getContractPayments(updated.id);
      setPayments(list);
      setPaymentAmount("");
      setPaymentNote("");
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Không thể ghi nhận thu tiền");
    } finally {
      setAddingPayment(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!payingOrder) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa lần thu tiền này?")) return;

    try {
      const updated = await deleteContractPayment(paymentId);
      setData((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setPayingOrder(updated);

      const list = await getContractPayments(updated.id);
      setPayments(list);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Không thể xóa lần thu tiền");
    }
  }

  function handleOpenExportModal(order: ContractRecord) {
    setExportingOrder(order);
  }

  function handleOpenEdit(order: ContractRecord) {
    setEditingId(order.id);
    const items =
      order.items && order.items.length > 0
        ? order.items.map(itemRecordToFormRow)
        : [
            {
              ...EMPTY_SERVICE_ITEM,
              serviceGroup: order.serviceGroup || SERVICE_GROUPS[0],
              serviceName: order.serviceName || "",
              packageName: order.packageName || "",
              subscriberCode: order.subscriberCodes[0] || "",
              unitPrice: String(order.totalValue),
            },
          ];
    setForm({
      transactionCode: order.transactionCode,
      items,
      channel: order.channel,
      leadId: order.leadId || "",
      amStaff: order.amStaff || "",
      paymentMethod: order.paymentMethod || PAYMENT_METHODS[0],
      prepaidMonths: order.prepaidMonths ? String(order.prepaidMonths) : "",
      customerId: order.customerId || "",
      contractNumber: order.contractNumber || "",
      signedDate: order.signedDate || "",
      termMonths: order.termMonths ? String(order.termMonths) : "",
      detail: {
        channelSourceId: order.channelSourceId ?? "",
        referredByCtvId: order.referredByCtvId ?? "",
      },
      contractTemplate: order.contractTemplate || "",
    });
    setFormError(null);
    setCustomerQuery("");
    setCustomerPickerOpen(false);
    setLeadCustomerHint(null);
    setShowForm(true);
  }

  /** Xuất hợp đồng từ mẫu (T10, STT 11): mở modal xem trước, chọn tải Word/PDF trong đó. */
  function handleOpenContractPreview(order: ContractRecord) {
    setContractPreviewOrder(order);
  }

  function handleOpenDelete(order: ContractRecord) {
    setDeleteBlockedReason(null);
    setDeletingOrder(order);
  }

  async function handleConfirmDelete() {
    if (!deletingOrder) return;
    const result = await deleteContract(deletingOrder.id);
    setData((prev) => prev.filter((row) => row.id !== deletingOrder.id));
    setDeletingOrder(null);
    return result;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.customerId) {
      setFormError(CUSTOMER_REQUIRED_MESSAGE);
      setCustomerPickerOpen(true);
      return;
    }

    const amStaffValue = (isAdmin ? form.amStaff : (user?.name ?? "")).trim();
    if (!amStaffValue) {
      setFormError(AM_REQUIRED_MESSAGE);
      return;
    }

    if (prepaidRequired && !form.prepaidMonths) {
      setFormError(PREPAID_REQUIRED_MESSAGE);
      return;
    }

    // T10 (STT 11): bắt buộc chọn mẫu hợp đồng khi TẠO MỚI. Đơn cũ (sửa) thiếu
    // mẫu vẫn sửa các trường khác được, backend sẽ chặn khi chuyển "Hoàn tất".
    if (!editingId && !form.contractTemplate) {
      setFormError(CONTRACT_TEMPLATE_REQUIRED_MESSAGE);
      return;
    }

    if (form.items.length === 0) {
      setFormError(ITEMS_REQUIRED_MESSAGE);
      return;
    }
    for (const item of form.items) {
      if (item.lineType === "service" && !item.subscriberCode.trim()) {
        setFormError(SUBSCRIBER_CODE_REQUIRED_MESSAGE);
        return;
      }
      if (item.unitPrice.trim() === "" || Number(item.unitPrice) < 0 || Number.isNaN(Number(item.unitPrice))) {
        setFormError(UNIT_PRICE_REQUIRED_MESSAGE);
        return;
      }
    }
    const serviceCodes = form.items
      .filter((i) => i.lineType === "service")
      .map((i) => i.subscriberCode.trim().toLowerCase());
    if (new Set(serviceCodes).size !== serviceCodes.length) {
      setFormError("Mã thuê bao bị trùng giữa các dòng trong đơn");
      return;
    }

    setSubmitting(true);

    try {
      const items: ContractItemInput[] = form.items.map((item) => ({
        lineType: item.lineType,
        serviceGroup: item.lineType === "service" ? item.serviceGroup || null : null,
        serviceName: item.serviceName || null,
        packageName: item.lineType === "service" ? item.packageName || null : null,
        subscriberCode: item.lineType === "service" ? item.subscriberCode.trim() : null,
        quantity: item.lineType === "device" ? Number(item.quantity || 1) : 1,
        unitPrice: Number(item.unitPrice || 0),
        termMonths: form.termMonths ? Number(form.termMonths) : null,
      }));

      if (editingId) {
        const updated = await updateContractInfo(editingId, {
          items,
          channel: form.channel,
          leadId: form.leadId || null,
          amStaff: amStaffValue,
          paymentMethod: form.paymentMethod || null,
          prepaidMonths: prepaidMonthsPayload,
          customerId: form.customerId,
          contractNumber: form.contractNumber || null,
          signedDate: form.signedDate || null,
          termMonths: form.termMonths ? Number(form.termMonths) : null,
          channelSourceId: form.detail.channelSourceId || null,
          referredByCtvId: form.detail.referredByCtvId || null,
          contractTemplate: form.contractTemplate || null,
        });

        setData((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
        setShowForm(false);
        setCommissionNotice(updated.commissionNotice ?? null);
      } else {
        const created = await createContract({
          transactionCode: form.transactionCode,
          items,
          channel: form.channel,
          leadId: form.leadId || null,
          amStaff: amStaffValue,
          paymentMethod: form.paymentMethod || null,
          prepaidMonths: prepaidMonthsPayload,
          customerId: form.customerId,
          contractNumber: form.contractNumber || null,
          signedDate: form.signedDate || null,
          termMonths: form.termMonths ? Number(form.termMonths) : null,
          channelSourceId: form.detail.channelSourceId || null,
          referredByCtvId: form.detail.referredByCtvId || null,
          contractTemplate: form.contractTemplate || null,
        });

        setData((prev) => [created, ...prev]);
        setShowForm(false);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Thao tác không thành công. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered data
  const visibleData = useMemo(() => {
    return data.filter((item) => {
      if (codeFilter && item.transactionCode !== codeFilter) return false;
      if (filterServiceGroup !== "ALL" && item.serviceGroup !== filterServiceGroup) return false;
      if (filterAmStaff !== "ALL" && item.amStaff !== filterAmStaff) return false;
      if (filterDeployment !== "ALL" && item.deploymentStatus !== filterDeployment) return false;
      if (filterPayment !== "ALL" && item.paymentStatus !== filterPayment) return false;
      if (filterChannel !== "ALL" && item.channel !== filterChannel) return false;
      return true;
    });
  }, [
    data,
    codeFilter,
    filterServiceGroup,
    filterAmStaff,
    filterDeployment,
    filterPayment,
    filterChannel,
  ]);

  const uniqueAmStaffList = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.amStaff) set.add(d.amStaff);
    });
    return Array.from(set);
  }, [data]);

  const columns: Column<ContractRecord>[] = [
    {
      header: "Mã giao dịch",
      accessorKey: "transactionCode",
      sticky: true,
      width: 130,
      cell: (item) => (
        <span className="font-mono font-bold text-vnpt">{item.transactionCode}</span>
      ),
    },
    {
      header: "Khách hàng",
      accessorKey: "customerName",
      sticky: true,
      width: 260,
      cell: (item) => (
        <div>
          <span className="block truncate font-bold text-slate-900" title={item.customerName}>
            {item.customerName}
          </span>
          {item.taxCode && (
            <span className="text-[11px] text-slate-500 font-mono block">MST: {item.taxCode}</span>
          )}
          {!item.customerId && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Chưa gắn khách hàng
            </span>
          )}
        </div>
      ),
    },
    {
      header: "AM phát triển",
      accessorKey: "amStaff",
      sticky: true,
      width: 150,
      cell: (item) =>
        item.amStaff ? (
          <span className="font-medium text-slate-800">{item.amStaff}</span>
        ) : (
          <span className="text-slate-400 italic">Chưa có AM</span>
        ),
    },
    {
      header: "Nhóm DV",
      accessorKey: "serviceGroup",
      cell: (item) =>
        item.serviceGroup ? (
          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
            {item.serviceGroup}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      header: "Gói cước",
      accessorKey: "packageName",
      width: 210,
      cell: (item) => {
        const items = item.items ?? [];
        const serviceCount = items.filter((i) => i.lineType === "service").length;
        const deviceCount = items.filter((i) => i.lineType === "device").length;
        return (
          <div>
            <span className="block truncate font-medium text-slate-800" title={item.packageName || undefined}>
              {item.packageName || "—"}
            </span>
            {item.serviceName && (
              <span className="block truncate text-[11px] text-slate-500" title={item.serviceName}>
                {item.serviceName}
              </span>
            )}
            {items.length > 0 && (
              <span className="mt-0.5 block text-[11px] font-semibold text-sky-700">
                {serviceCount} dịch vụ{deviceCount > 0 ? ` + ${deviceCount} thiết bị` : ""}
              </span>
            )}
            {item.subscriberCodes.length > 0 && (
              <span
                className="block truncate text-[11px] text-slate-400"
                title={item.subscriberCodes.join(", ")}
              >
                Mã TB: {item.subscriberCodes.join(", ")}
              </span>
            )}
            {item.termMonths ? (
              <span className="block text-[11px] text-slate-400">Thời hạn {item.termMonths} tháng</span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "Hình thức TT",
      accessorKey: "paymentMethod",
      cell: (item) =>
        item.paymentMethod ? (
          <span className="font-medium text-slate-800">
            {item.paymentMethod === PREPAID_METHOD && item.prepaidMonths
              ? `${item.paymentMethod} ${item.prepaidMonths} tháng`
              : item.paymentMethod}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      header: "Đã thu / Giá trị",
      accessorKey: "totalValue",
      width: 150,
      cell: (item) => {
        const collected = item.collectedAmount || 0;
        return (
          <div className="text-right">
            <span className="font-bold text-slate-900 block">{formatMoney(item.totalValue)}</span>
            <span
              className={`text-[11px] font-semibold ${
                collected >= item.totalValue
                  ? "text-emerald-600"
                  : collected > 0
                  ? "text-amber-600"
                  : "text-slate-400"
              }`}
            >
              Đã thu: {formatMoney(collected)}
            </span>
          </div>
        );
      },
    },
    {
      header: "Kênh",
      accessorKey: "channel",
    },
    {
      header: "Chi tiết kênh",
      accessorKey: "channelSourceId",
      width: 170,
      cell: (item) => {
        const ctvName = item.referredByCtvId ? (ctvNameById.get(item.referredByCtvId) ?? item.referredByCtvId) : null;
        const text = formatChannelDetail(item.channel, item.channelSourceName, ctvName);
        return text === "—" ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="font-medium text-slate-700">{text}</span>
        );
      },
    },
    {
      header: "Triển khai",
      accessorKey: "deploymentStatus",
      width: 175,
      cell: (item) => (
        <StatusSelect
          value={item.deploymentStatus}
          options={DEPLOYMENT_STATUSES}
          onChange={async (next) => {
            const updated = await updateContractStatus(item.id, {
              deploymentStatus: next,
            });
            setData((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
            setCommissionNotice(updated.commissionNotice ?? null);
          }}
        />
      ),
    },
    {
      header: "Thanh toán",
      accessorKey: "paymentStatus",
      width: 175,
      cell: (item) => (
        <StatusSelect
          value={item.paymentStatus}
          options={PAYMENT_STATUSES}
          onChange={async (next) => {
            const updated = await updateContractStatus(item.id, {
              paymentStatus: next,
            });
            setData((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
          }}
        />
      ),
    },
    {
      header: "Thao tác",
      accessorKey: "id",
      width: 420,
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenPaymentModal(item)}
            className="flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            title="Thu tiền đơn hàng"
          >
            <Banknote className="h-3.5 w-3.5" />
            <span>Thu tiền</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenExportModal(item)}
            className="flex h-7 items-center gap-1 rounded-lg bg-sky-50 px-2 text-xs font-semibold text-sky-700 border border-sky-200 hover:bg-sky-100"
            title="Xuất đề nghị thanh toán"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Đề nghị TT</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenContractPreview(item)}
            className="flex h-7 items-center gap-1 rounded-lg bg-violet-50 px-2 text-xs font-semibold text-violet-700 border border-violet-200 hover:bg-violet-100"
            title="Xem trước & xuất hợp đồng từ mẫu"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Hợp đồng</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEdit(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            title="Chỉnh sửa đơn hàng"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleOpenDelete(item)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
              title="Xóa đơn hàng"
              data-testid="contract-delete-button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Quản lý hợp đồng
          </h2>
          <p className="text-xs text-slate-500">
            Quản lý theo mã giao dịch nguồn, AM phát triển, nhóm dịch vụ và tình trạng thanh toán
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowImportWizard(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <UploadCloud className="h-4 w-4" />
              <span className="btn-label">Nhập hợp đồng (Excel)</span>
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-vnpt px-3.5 text-xs font-bold text-white shadow-xs hover:bg-vnpt-dark"
          >
            <Plus className="h-4 w-4" />
            <span className="btn-label">Tạo đơn hàng</span>
          </button>
        </div>
      </div>

      {commissionNotice && (
        <div
          role="status"
          data-testid="commission-notice"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800"
        >
          <span>{commissionNotice}</span>
          <button
            type="button"
            onClick={() => setCommissionNotice(null)}
            className="shrink-0 font-bold text-amber-600 hover:text-amber-800"
          >
            Đóng
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="ĐƠN HÀNG THÁNG NÀY"
          value={data.length}
          subtitle="Tổng số đơn ghi nhận"
          icon={FileText}
        />
        <KpiCard
          title="TRIỂN KHAI HOÀN TẤT"
          value={data.filter((c) => c.deploymentStatus === "Hoàn tất").length}
          subtitle="Đã hoàn tất lắp đặt"
          icon={CheckCircle}
        />
        <KpiCard
          title="CHƯA THANH TOÁN"
          value={data.filter((c) => c.paymentStatus === "Chưa thanh toán").length}
          subtitle="Cần theo dõi thu tiền"
          icon={Banknote}
        />
        <KpiCard
          title="ĐÃ THANH TOÁN"
          value={data.filter((c) => c.paymentStatus === "Đã thanh toán").length}
          subtitle="Đã thu đủ tiền đơn hàng"
          icon={ShieldCheck}
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-xs shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">Nhóm DV:</span>
          <select
            value={filterServiceGroup}
            onChange={(e) => setFilterServiceGroup(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
          >
            <option value="ALL">Tất cả</option>
            {SERVICE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">AM phát triển:</span>
          <select
            value={filterAmStaff}
            onChange={(e) => setFilterAmStaff(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
          >
            <option value="ALL">Tất cả AM</option>
            {uniqueAmStaffList.map((am) => (
              <option key={am} value={am}>
                {am}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">Triển khai:</span>
          <select
            value={filterDeployment}
            onChange={(e) => setFilterDeployment(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
          >
            <option value="ALL">Tất cả</option>
            {DEPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">Thanh toán:</span>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
          >
            <option value="ALL">Tất cả</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">Kênh:</span>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-vnpt focus:outline-none"
          >
            <option value="ALL">Tất cả</option>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {(filterServiceGroup !== "ALL" ||
          filterAmStaff !== "ALL" ||
          filterDeployment !== "ALL" ||
          filterPayment !== "ALL" ||
          filterChannel !== "ALL" ||
          codeFilter) && (
          <button
            type="button"
            onClick={() => {
              setFilterServiceGroup("ALL");
              setFilterAmStaff("ALL");
              setFilterDeployment("ALL");
              setFilterPayment("ALL");
              setFilterChannel("ALL");
              setCodeFilter(null);
            }}
            className="ml-auto font-bold text-vnpt hover:underline"
          >
            Đặt lại bộ lọc
          </button>
        )}
      </div>

      {codeFilter && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <span>
            Đang lọc theo mã giao dịch <b className="font-mono">{codeFilter}</b>
          </span>
          <button
            type="button"
            onClick={() => setCodeFilter(null)}
            className="font-bold text-vnpt hover:underline"
          >
            Bỏ lọc
          </button>
        </div>
      )}

      {/* Table */}
      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">
            Không thể tải dữ liệu Đơn hàng
          </p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải dữ liệu Đơn hàng...
        </div>
      ) : (
        <DataTable
          title="Danh sách đơn hàng"
          subtitle="Theo dõi tiến độ triển khai kỹ thuật, AM phát triển, nhóm dịch vụ và thanh toán"
          columns={columns}
          data={visibleData}
          resizableColumns
          searchPlaceholder="Tìm theo mã giao dịch, khách hàng, AM, mã thuê bao..."
          exportFileName="vnpt_don_hang"
        />
      )}

      {/* Create / Edit Order Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? "Chỉnh sửa đơn hàng" : "Tạo đơn hàng"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Chọn từ Lead chốt thành công (tùy chọn)
                  </label>
                  <select
                    value={form.leadId}
                    onChange={(e) => handleSelectLead(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    <option value="">— Nhập tay không qua Lead —</option>
                    {linkableLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.customerName} · AM: {l.staffName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Mã giao dịch <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    disabled={Boolean(editingId)}
                    value={form.transactionCode}
                    onChange={(e) => setForm({ ...form, transactionCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none disabled:bg-slate-100"
                  />
                </div>

              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Khách hàng <span className="text-rose-500">*</span>
                </label>

                {editingOrder && !editingOrder.customerId && !form.customerId && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Đơn hàng này chưa gắn khách hàng. Vui lòng chọn khách hàng để lưu thay đổi.
                  </p>
                )}
                {leadCustomerHint && !form.customerId && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {leadCustomerHint}{" "}
                    <Link
                      href={(() => {
                        const lead = linkableLeads.find((l) => l.id === form.leadId);
                        const params = new URLSearchParams({
                          prefillName: lead?.customerName ?? "",
                          prefillPhone: lead?.phone ?? "",
                          prefillEmail: lead?.email ?? "",
                        });
                        return `/admin/customers?${params.toString()}`;
                      })()}
                      target="_blank"
                      className="font-semibold text-vnpt underline"
                    >
                      Mở trang Khách hàng (điền sẵn thông tin Cơ hội)
                    </Link>
                  </p>
                )}

                {form.customerId ? (
                  <div
                    data-testid="selected-customer"
                    className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {selectedCustomerName || form.customerId}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600">
                        MST/CCCD: {selectedCustomerTaxCode || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="shrink-0 text-xs font-bold text-vnpt hover:underline"
                    >
                      Đổi khách hàng
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={customerPickerRef}>
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={customerQuery}
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        setCustomerPickerOpen(true);
                      }}
                      onFocus={() => setCustomerPickerOpen(true)}
                      placeholder="Tìm khách hàng theo tên, MST/CCCD hoặc số điện thoại..."
                      aria-label="Tìm khách hàng"
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-vnpt focus:outline-none"
                    />
                    {customerPickerOpen && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {customerMatches.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-500">
                            Không tìm thấy khách hàng phù hợp
                            {!isAdmin ? " trong danh sách khách bạn phụ trách" : ""}.
                          </p>
                        ) : (
                          customerMatches.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCustomer(c.id)}
                              className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                            >
                              <span className="block text-sm font-semibold text-slate-900">{c.name}</span>
                              <span className="block font-mono text-[11px] text-slate-500">
                                MST/CCCD: {c.identityCode || "—"}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Tên khách hàng và MST được lấy tự động từ khách hàng đã chọn.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3" data-testid="order-items-editor">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    Dịch vụ trong đơn <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      data-testid="add-service-line"
                      onClick={() =>
                        setForm({ ...form, items: [...form.items, { ...EMPTY_SERVICE_ITEM }] })
                      }
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" /> Thêm dòng
                    </button>
                    <button
                      type="button"
                      data-testid="add-token-device"
                      onClick={() => setForm({ ...form, items: [...form.items, { ...TOKEN_DEVICE_ITEM }] })}
                      className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      <Plus className="h-3 w-3" /> Thiết bị TOKEN ({TOKEN_DEVICE_PRICE.toLocaleString("vi-VN")})
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div
                      key={idx}
                      data-testid={`order-item-row-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-12 sm:items-end"
                    >
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">Loại</label>
                        <select
                          data-testid={`item-line-type-${idx}`}
                          value={item.lineType}
                          onChange={(e) => {
                            const lineType = e.target.value as "service" | "device";
                            const next = [...form.items];
                            next[idx] = {
                              ...item,
                              lineType,
                              subscriberCode: lineType === "device" ? "" : item.subscriberCode,
                              serviceGroup: lineType === "device" ? "" : item.serviceGroup || SERVICE_GROUPS[0],
                            };
                            setForm({ ...form, items: next });
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                        >
                          <option value="service">Dịch vụ</option>
                          <option value="device">Thiết bị</option>
                        </select>
                      </div>
                      {item.lineType === "service" && (
                        <div className="sm:col-span-2">
                          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                            Nhóm dịch vụ
                          </label>
                          <select
                            value={item.serviceGroup}
                            onChange={(e) => {
                              const next = [...form.items];
                              next[idx] = { ...item, serviceGroup: e.target.value };
                              setForm({ ...form, items: next });
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                          >
                            {SERVICE_GROUPS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className={item.lineType === "service" ? "sm:col-span-2" : "sm:col-span-3"}>
                        <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                          Tên dịch vụ/thiết bị
                        </label>
                        <input
                          value={item.serviceName}
                          onChange={(e) => {
                            const next = [...form.items];
                            next[idx] = { ...item, serviceName: e.target.value };
                            setForm({ ...form, items: next });
                          }}
                          placeholder="VD: FiberVNN, TOKEN..."
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                        />
                      </div>
                      {item.lineType === "service" ? (
                        <>
                          <div className="sm:col-span-2">
                            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                              Gói cước
                            </label>
                            <input
                              value={item.packageName}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, packageName: e.target.value };
                                setForm({ ...form, items: next });
                              }}
                              placeholder="VD: Home Net 2"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                              Mã thuê bao <span className="text-rose-500">*</span>
                            </label>
                            <input
                              required
                              data-testid={`item-subscriber-code-${idx}`}
                              value={item.subscriberCode}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, subscriberCode: e.target.value };
                                setForm({ ...form, items: next });
                              }}
                              placeholder="0901234567"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="sm:col-span-1">
                          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">SL</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...form.items];
                              next[idx] = { ...item, quantity: e.target.value };
                              setForm({ ...form, items: next });
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                          />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                          Đơn giá (₫) <span className="text-rose-500">*</span>
                        </label>
                        <MoneyInput
                          required
                          data-testid={`item-unit-price-${idx}`}
                          value={item.unitPrice}
                          onChange={(digits) => {
                            const next = [...form.items];
                            next[idx] = { ...item, unitPrice: digits };
                            setForm({ ...form, items: next });
                          }}
                          placeholder="VD: 300.000"
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-vnpt focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 sm:col-span-1">
                        <span className="text-[11px] font-bold text-slate-700">
                          {itemLineAmount(item).toLocaleString("vi-VN")}
                        </span>
                        <button
                          type="button"
                          aria-label="Xóa dòng"
                          data-testid={`remove-item-${idx}`}
                          disabled={form.items.length <= 1}
                          onClick={() =>
                            setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
                          }
                          className="shrink-0 rounded-lg p-1 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                  <span className="text-xs font-semibold text-slate-500">Tổng đơn hàng:</span>
                  <span data-testid="order-total-preview" className="text-lg font-bold text-vnpt">
                    {formatMoney(itemsTotal(form.items))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Hình thức thanh toán
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      setForm({
                        ...form,
                        paymentMethod: method,
                        prepaidMonths:
                          method === PREPAID_METHOD ? form.prepaidMonths || DEFAULT_PREPAID_MONTHS : "",
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {isPrepaid && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">
                        Số tháng trả trước{" "}
                        {prepaidRequired && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        data-testid="prepaid-months"
                        value={form.prepaidMonths}
                        onChange={(e) => setForm({ ...form, prepaidMonths: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                      >
                        {!prepaidRequired && <option value="">— Chưa chọn —</option>}
                        {PREPAID_MONTH_OPTIONS.map((m) => (
                          <option key={m} value={String(m)}>
                            {m} tháng{POPULAR_PREPAID_MONTHS.includes(m) ? " (phổ biến)" : ""}
                          </option>
                        ))}
                      </select>
                      {legacyPrepaidWithoutMonths && !form.prepaidMonths && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Đơn cũ chưa có số tháng trả trước — nên chọn để đề nghị thanh toán ghi đúng.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    AM phát triển <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    data-testid="am-staff"
                    value={isAdmin ? form.amStaff : (user?.name ?? "")}
                    onChange={(e) => setForm({ ...form, amStaff: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {isAdmin && <option value="">— Chọn AM phát triển —</option>}
                    {(isAdmin ? staffList : staffList.filter((s) => s.name === user?.name)).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Mẫu hợp đồng {!editingId && <span className="text-rose-500">*</span>}
                </label>
                <select
                  value={form.contractTemplate}
                  onChange={(e) => setForm({ ...form, contractTemplate: e.target.value })}
                  required={!editingId}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                >
                  <option value="">— Chọn mẫu hợp đồng —</option>
                  {contractTemplates.map((t) => (
                    <option key={t.key} value={t.key} disabled={!t.available}>
                      {t.label}
                      {!t.available ? " (Chưa có mẫu)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Mỗi Mã giao dịch phải gắn đúng 1 hợp đồng theo bộ mẫu. Mẫu "Chưa có mẫu" chưa có
                  file trong hệ thống, chưa chọn/xuất được.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Số hợp đồng
                  </label>
                  <input
                    value={form.contractNumber}
                    onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                    placeholder="Tự sinh nếu để trống"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Ngày ký / ngày tạo đơn
                  </label>
                  <input
                    type="date"
                    value={form.signedDate}
                    onChange={(e) => setForm({ ...form, signedDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Thời hạn (tháng)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.termMonths}
                    onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                    placeholder="Mặc định 12 tháng"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Kênh phát triển
                  </label>
                  <select
                    value={form.channel}
                    onChange={(e) =>
                      setForm({ ...form, channel: e.target.value, detail: EMPTY_CHANNEL_DETAIL })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {CHANNEL_OPTIONS.map((c) => (
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
                  required
                />
              )}

              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-label rounded-xl bg-vnpt px-3.5 py-2 text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {submitting ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo đơn hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ghi nhận thu tiền — {payingOrder.transactionCode}
                </h3>
                <p className="text-xs text-slate-500">
                  Khách hàng: <span className="font-semibold text-slate-800">{payingOrder.customerName}</span> · Giá trị:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatMoney(payingOrder.totalValue)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setPayingOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Warning if over-collected */}
            {Number(payingOrder.collectedAmount || 0) > payingOrder.totalValue && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Cảnh báo: Tổng tiền đã thu vượt quá giá trị đơn hàng!
                </div>
                <div className="mt-1">
                  Đã thu:{" "}
                  <b>{formatMoney(Number(payingOrder.collectedAmount || 0))}</b> / Giá trị đơn:{" "}
                  <b>{formatMoney(payingOrder.totalValue)}</b> (Dư:{" "}
                  <b>{formatMoney(Number(payingOrder.collectedAmount || 0) - payingOrder.totalValue)}</b>
                  )
                </div>
              </div>
            )}

            {/* Status summary */}
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
              <div>
                <span className="block text-[11px] text-slate-500">Giá trị đơn</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatMoney(payingOrder.totalValue)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Đã thu</span>
                <span className="text-sm font-bold text-emerald-600">
                  {formatMoney(Number(payingOrder.collectedAmount || 0))}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Còn lại</span>
                <span className="text-sm font-bold text-rose-600">
                  {formatMoney(
                    Math.max(0, payingOrder.totalValue - Number(payingOrder.collectedAmount || 0))
                  )}
                </span>
              </div>
            </div>

            {/* Payments List */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                Lịch sử các lần thu ({payments.length})
              </h4>
              {loadingPayments ? (
                <div className="py-4 text-center text-xs text-slate-400">Đang tải lịch sử thu tiền...</div>
              ) : payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 italic">
                  Chưa có lần thu tiền nào được ghi nhận.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {formatMoney(p.amount)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ngày thu: {p.paidDate} {p.createdBy ? `· Thu bởi: ${p.createdBy}` : ""}
                        </div>
                        {p.note && <div className="text-[11px] text-slate-600 italic">"{p.note}"</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(p.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Xóa lần thu này"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Payment Form */}
            <form onSubmit={handleAddPayment} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Thêm lần thu tiền mới
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Số tiền thu (₫) <span className="text-rose-500">*</span>
                  </label>
                  <MoneyInput
                    required
                    data-testid="payment-amount"
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    placeholder="VD: 2.000.000"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Ngày thu
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Ghi chú
                </label>
                <input
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="VD: Thu chuyển khoản đợt 1..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              {paymentError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {paymentError}
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={addingPayment}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {addingPayment ? "Đang lưu..." : "Ghi nhận thu tiền"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Xuất đề nghị thanh toán: xem trước -> xác nhận lấy số -> tải Word/PDF */}
      {exportingOrder && (
        <PaymentRequestModal
          order={exportingOrder}
          onClose={() => setExportingOrder(null)}
          onEditOrder={handleOpenEdit}
        />
      )}

      {/* Nhập hợp đồng từ Excel */}
      {showImportWizard && (
        <ContractImportWizard
          onClose={() => setShowImportWizard(false)}
          onImported={() => {
            getContracts().then(setData).catch(() => {});
          }}
        />
      )}

      {/* Xem trước & xuất hợp đồng từ mẫu (T10, STT 11) */}
      {contractPreviewOrder && (
        <ContractExportPreviewModal
          order={contractPreviewOrder}
          onClose={() => setContractPreviewOrder(null)}
        />
      )}

      {/* Xóa đơn hàng (T10, STT 11) — chỉ Admin, cascade, chặn 409 khi đã có hoa hồng đã chi. */}
      <ConfirmDeleteDialog
        open={Boolean(deletingOrder)}
        title="Xóa đơn hàng"
        description={
          deletingOrder ? (
            <>
              Xóa đơn <strong>{deletingOrder.transactionCode}</strong> của khách{" "}
              <strong>{deletingOrder.customerName}</strong>? Toàn bộ dòng dịch vụ/thiết bị, lịch sử
              thu tiền và lịch sử xuất đề nghị thanh toán của đơn này sẽ bị xóa theo.
            </>
          ) : (
            ""
          )
        }
        blockedReason={deleteBlockedReason}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingOrder(null)}
      />
    </div>
  );
}
