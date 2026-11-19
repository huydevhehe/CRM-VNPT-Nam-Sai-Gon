"use client";

import { useEffect, useState, FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Copy, Lock } from "lucide-react";
import { ServiceRecord } from "@/lib/crm/types/crm.types";
import {
  getCustomerServices,
  createService,
  updateService,
  deleteService,
  revealInvoiceCredential,
} from "@/lib/api/services.api";
import { isExpiringSoon } from "@/lib/customer-stats";
import { isInvoicePortalServiceName } from "@/lib/crm/invoice-portal";
import { useAuth } from "@/lib/auth/auth-context";

function formatIsoDateVn(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value ?? "—");
}

function formatExpirationVn(value: string | null | undefined): string {
  return value ? formatIsoDateVn(value) : "Không thời hạn";
}

const SERVICE_GROUPS = ["BRCĐ", "CNTT", "Di động"] as const;
const PAYMENT_METHODS = ["Trả trước", "Trả hàng tháng"] as const;

interface ServiceFormState {
  serviceGroup: (typeof SERVICE_GROUPS)[number];
  serviceName: string;
  packageName: string;
  serviceCode: string;
  paymentType: (typeof PAYMENT_METHODS)[number];
  startDate: string;
  expirationDate: string;
  invoicePortalUrl: string;
  invoicePortalUsername: string;
  /** Để trống khi sửa = không đổi mật khẩu đã lưu. */
  invoicePortalPassword: string;
}

const EMPTY_SERVICE_FORM: ServiceFormState = {
  serviceGroup: SERVICE_GROUPS[0],
  serviceName: "",
  packageName: "",
  serviceCode: "",
  paymentType: PAYMENT_METHODS[0],
  startDate: "",
  expirationDate: "",
  invoicePortalUrl: "",
  invoicePortalUsername: "",
  invoicePortalPassword: "",
};

function linkedTitle(service: ServiceRecord): string {
  const code = service.transactionCode ? ` ${service.transactionCode}` : "";
  return `Dịch vụ này sinh từ đơn hàng${code}, nên sửa/xóa ở đơn hàng`;
}

interface CustomerServicesProps {
  customerId: string;
  canManage?: boolean;
  /** Gọi mỗi khi danh sách dịch vụ tải xong hoặc thay đổi để trang cha cập nhật thống kê. */
  onServicesChange?: (services: ServiceRecord[]) => void;
}

export default function CustomerServices({ customerId, canManage, onServicesChange }: CustomerServicesProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mật khẩu hệ thống hóa đơn đã "Hiện" (chỉ giữ tạm trong state, không cache lâu dài).
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealError, setRevealError] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) onServicesChange?.(services);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, loading]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomerServices(customerId);
      setServices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách dịch vụ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await getCustomerServices(customerId);
        if (isMounted) setServices(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách dịch vụ");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_SERVICE_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(service: ServiceRecord) {
    setEditingId(service.id);
    setForm({
      serviceGroup: (service.serviceGroup as ServiceFormState["serviceGroup"]) || SERVICE_GROUPS[0],
      serviceName: service.serviceName,
      packageName: service.packageName || "",
      serviceCode: service.serviceCode,
      paymentType: (service.paymentType as ServiceFormState["paymentType"]) || PAYMENT_METHODS[0],
      startDate: service.startDate,
      expirationDate: service.expirationDate ?? "",
      invoicePortalUrl: service.invoicePortalUrl || "",
      invoicePortalUsername: service.invoicePortalUsername || "",
      invoicePortalPassword: "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleReveal(service: ServiceRecord) {
    setRevealError((prev) => ({ ...prev, [service.id]: "" }));
    setRevealingId(service.id);
    try {
      const data = await revealInvoiceCredential(service.id);
      setRevealedPasswords((prev) => ({ ...prev, [service.id]: data.password || "" }));
    } catch (err) {
      setRevealError((prev) => ({
        ...prev,
        [service.id]: err instanceof Error ? err.message : "Không thể xem mật khẩu",
      }));
    } finally {
      setRevealingId(null);
    }
  }

  function hideRevealed(serviceId: string) {
    setRevealedPasswords((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Trình duyệt chặn clipboard (vd không phải HTTPS) — bỏ qua, không chặn người dùng.
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      // Mật khẩu: để trống khi SỬA nghĩa là "không đổi" (ô mật khẩu không bao giờ
      // hiện lại giá trị cũ) — chỉ gửi lên khi người dùng thực sự gõ mật khẩu mới.
      const { invoicePortalPassword, ...rest } = form;
      const payload = {
        ...rest,
        // Để trống = không có thời hạn (vd: hóa đơn điện tử), không phải lỗi thiếu ngày.
        expirationDate: rest.expirationDate || null,
        ...(invoicePortalPassword ? { invoicePortalPassword } : {}),
      };
      if (editingId) {
        await updateService(editingId, payload);
      } else {
        await createService({ customerId, ...payload });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không thể lưu dịch vụ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(service: ServiceRecord) {
    setError(null);
    try {
      await deleteService(service.id);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa dịch vụ");
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Đang tải danh sách dịch vụ...</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1 rounded-lg bg-vnpt px-3 py-1.5 text-xs font-bold text-white hover:bg-vnpt-dark"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm dịch vụ
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nhóm</th>
              <th className="px-3 py-2">Tên dịch vụ</th>
              <th className="px-3 py-2">Gói</th>
              <th className="px-3 py-2">Mã thuê bao</th>
              <th className="px-3 py-2">Đơn hàng</th>
              <th className="px-3 py-2">Hình thức</th>
              <th className="px-3 py-2">Bắt đầu</th>
              <th className="px-3 py-2">Kết thúc</th>
              {canManage && <th className="px-3 py-2">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-3 py-6 text-center text-slate-400">
                  Chưa có dịch vụ nào
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr
                  key={service.id}
                  className={service.expirationDate && isExpiringSoon(service.expirationDate) ? "bg-amber-50" : ""}
                >
                  <td className="px-3 py-2">{service.serviceGroup || "—"}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{service.serviceName}</td>
                  <td className="px-3 py-2">{service.packageName || "—"}</td>
                  <td className="px-3 py-2 font-mono">{service.serviceCode}</td>
                  <td className="px-3 py-2 font-mono">{service.transactionCode || "—"}</td>
                  <td className="px-3 py-2">{service.paymentType || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatIsoDateVn(service.startDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatExpirationVn(service.expirationDate)}</td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(service)}
                          disabled={Boolean(service.contractId)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-vnpt disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          title={service.contractId ? linkedTitle(service) : "Sửa"}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(service)}
                          disabled={Boolean(service.contractId)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          title={service.contractId ? linkedTitle(service) : "Xóa"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Thông tin đăng nhập hệ thống hóa đơn — chỉ hiện với dịch vụ "Hóa đơn điện tử". */}
      {services
        .filter((s) => s.isInvoicePortalService)
        .map((service) => {
          const revealed = revealedPasswords[service.id];
          return (
            <div
              key={`cred-${service.id}`}
              data-testid="invoice-credential-block"
              className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs"
            >
              <h4 className="flex items-center gap-1.5 font-bold text-slate-700">
                <Lock className="h-3.5 w-3.5" />
                Thông tin đăng nhập hệ thống hóa đơn — {service.serviceName}
              </h4>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <InfoRow label="Link" value={service.invoicePortalUrl} />
                <InfoRow label="Tài khoản" value={service.invoicePortalUsername} />
                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Mật khẩu</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-700">
                      {revealed ?? service.invoicePortalPasswordMasked ?? "—"}
                    </span>
                    {isAdmin && service.invoicePortalPasswordMasked && (
                      <>
                        {revealed ? (
                          <>
                            <button
                              type="button"
                              title="Ẩn mật khẩu"
                              onClick={() => hideRevealed(service.id)}
                              className="rounded p-0.5 text-slate-400 hover:text-vnpt"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sao chép"
                              onClick={() => copyToClipboard(revealed)}
                              className="rounded p-0.5 text-slate-400 hover:text-vnpt"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title="Hiện mật khẩu"
                            disabled={revealingId === service.id}
                            onClick={() => handleReveal(service)}
                            className="rounded p-0.5 text-slate-400 hover:text-vnpt disabled:opacity-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {revealError[service.id] && (
                    <p className="mt-0.5 text-[11px] text-rose-500">{revealError[service.id]}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? "Sửa dịch vụ" : "Thêm dịch vụ"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="svc-group" className="mb-1 block text-xs font-semibold text-slate-600">
                    Nhóm dịch vụ
                  </label>
                  <select
                    id="svc-group"
                    value={form.serviceGroup}
                    onChange={(e) =>
                      setForm({ ...form, serviceGroup: e.target.value as ServiceFormState["serviceGroup"] })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {SERVICE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="svc-payment" className="mb-1 block text-xs font-semibold text-slate-600">
                    Hình thức
                  </label>
                  <select
                    id="svc-payment"
                    value={form.paymentType}
                    onChange={(e) =>
                      setForm({ ...form, paymentType: e.target.value as ServiceFormState["paymentType"] })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="svc-name" className="mb-1 block text-xs font-semibold text-slate-600">
                  Tên dịch vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="svc-name"
                  required
                  value={form.serviceName}
                  onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="svc-package" className="mb-1 block text-xs font-semibold text-slate-600">
                    Gói
                  </label>
                  <input
                    id="svc-package"
                    value={form.packageName}
                    onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="svc-code" className="mb-1 block text-xs font-semibold text-slate-600">
                    Mã thuê bao
                  </label>
                  <input
                    id="svc-code"
                    value={form.serviceCode}
                    onChange={(e) => setForm({ ...form, serviceCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="svc-start" className="mb-1 block text-xs font-semibold text-slate-600">
                    Ngày bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="svc-start"
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="svc-end" className="mb-1 block text-xs font-semibold text-slate-600">
                    Ngày kết thúc
                  </label>
                  <input
                    id="svc-end"
                    type="date"
                    value={form.expirationDate}
                    onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Để trống nếu dịch vụ không có thời hạn (vd: hóa đơn điện tử)</p>
                </div>
              </div>

              {isInvoicePortalServiceName(form.serviceName) && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Lock className="h-3.5 w-3.5" />
                    Thông tin đăng nhập hệ thống hóa đơn
                  </h4>
                  <div>
                    <label htmlFor="svc-inv-url" className="mb-1 block text-xs font-semibold text-slate-600">
                      Link hệ thống
                    </label>
                    <input
                      id="svc-inv-url"
                      type="url"
                      placeholder="https://..."
                      value={form.invoicePortalUrl}
                      onChange={(e) => setForm({ ...form, invoicePortalUrl: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="svc-inv-user" className="mb-1 block text-xs font-semibold text-slate-600">
                        Tài khoản
                      </label>
                      <input
                        id="svc-inv-user"
                        value={form.invoicePortalUsername}
                        onChange={(e) => setForm({ ...form, invoicePortalUsername: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="svc-inv-pass" className="mb-1 block text-xs font-semibold text-slate-600">
                        Mật khẩu
                      </label>
                      <input
                        id="svc-inv-pass"
                        type="password"
                        placeholder={editingId ? "Để trống = không đổi" : ""}
                        value={form.invoicePortalPassword}
                        onChange={(e) => setForm({ ...form, invoicePortalPassword: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mật khẩu được mã hóa khi lưu; chỉ Admin xem lại được bằng nút &quot;Hiện mật khẩu&quot;.
                  </p>
                </div>
              )}

              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
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
                  className="rounded-xl bg-vnpt px-3.5 py-2 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
                >
                  {submitting ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
      <div className="truncate text-slate-700">{value || "—"}</div>
    </div>
  );
}
