"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, AlertTriangle } from "lucide-react";
import DataTable, { Column } from "@/components/admin/shared/DataTable";
import { TableFilter } from "@/lib/table-filters";
import { getAuditLogs } from "@/lib/api/reports.api";
import { getPermissionMatrix, type PermissionMatrix, type PermissionRoleName } from "@/lib/api/staff.api";
import AccessBadge from "@/components/admin/staff/AccessBadge";
import { AuditLogRecord } from "@/lib/crm/types/crm.types";

const ROLE_CARD_STYLES: Record<PermissionRoleName, { border: string; badge: string; icon: string }> = {
  Admin: { border: "border-blue-200", badge: "bg-blue-100 text-blue-800", icon: "text-blue-600" },
  AM: { border: "border-slate-200", badge: "bg-emerald-100 text-emerald-800", icon: "text-emerald-600" },
  "AM Bán chăm": { border: "border-slate-200", badge: "bg-emerald-100 text-emerald-800", icon: "text-emerald-600" },
};

export default function SettingsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMatrix() {
      setMatrixLoading(true);
      setMatrixError(null);
      try {
        const data = await getPermissionMatrix();
        if (isMounted) {
          setMatrix(data);
        }
      } catch (err) {
        if (isMounted) {
          setMatrixError(
            err instanceof Error
              ? err.message
              : "Không thể tải ma trận phân quyền. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setMatrixLoading(false);
        }
      }
    }

    loadMatrix();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAuditLogs();
        if (isMounted) {
          setLogs(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu Nhật ký hệ thống. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<AuditLogRecord>[] = [
    {
      header: "Thời gian",
      accessorKey: "timestamp",
      cell: (item) => (
        <span className="font-mono text-slate-600 font-medium">
          {item.timestamp}
        </span>
      ),
    },
    {
      header: "Người dùng thao tác",
      accessorKey: "user",
      cell: (item) => (
        <span className="font-bold text-slate-900">{item.user}</span>
      ),
    },
    {
      header: "Hành động",
      accessorKey: "action",
      cell: (item) => (
        <span className="font-semibold text-blue-700">{item.action}</span>
      ),
    },
    {
      header: "Chi tiết thay đổi",
      accessorKey: "details",
      cell: (item) => <span className="text-slate-600">{item.details}</span>,
    },
  ];

  const logFilters: TableFilter<AuditLogRecord>[] = [
    {
      id: "user",
      label: "Người dùng thao tác",
      getValue: (r) => r.user,
    },
    {
      id: "action",
      label: "Hành động",
      getValue: (r) => r.action,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Tài khoản, Phân quyền & Nhật ký hệ thống (Audit Log)
        </h2>
        <p className="text-xs text-slate-500">
          Quyền hạn của 3 vai trò Admin, AM, AM Bán chăm và lưu vết toàn bộ thay đổi dữ liệu quan trọng
        </p>
      </div>

      {/* Role cards + permission matrix */}
      {matrixError ? (
        <div
          data-testid="permissions-error"
          className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center"
        >
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">Không thể tải ma trận phân quyền</p>
          <p className="text-xs text-rose-600">{matrixError}</p>
        </div>
      ) : matrixLoading || !matrix ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải ma trận phân quyền...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="role-cards">
            {matrix.roles.map((role) => {
              const style = ROLE_CARD_STYLES[role.role];
              const Icon = role.role === "Admin" ? ShieldCheck : UserCheck;
              return (
                <div
                  key={role.role}
                  data-testid={`role-card-${role.role}`}
                  className={`rounded-2xl border bg-white p-5 shadow-xs ${style.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${style.icon}`} />
                      <h3 className="font-bold text-slate-900 text-sm">{role.label}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>
                      {role.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{role.description}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Ma trận phân quyền theo vai trò</h3>
              <p className="text-xs text-slate-500">
                Mức quyền của từng vai trò với từng chức năng. &quot;Chỉ dữ liệu của mình&quot; nghĩa là chỉ thấy và
                xử lý dữ liệu do chính mình phụ trách hoặc khách được giao.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {matrix.levels.map((level) => (
                  <AccessBadge key={level} level={level} />
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="permission-matrix">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2">Chức năng</th>
                    {matrix.roles.map((role) => (
                      <th key={role.role} className="px-3 py-2">
                        {role.role}
                      </th>
                    ))}
                    <th className="px-5 py-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.modules.map((m) => (
                    <tr
                      key={m.key}
                      data-testid={`matrix-row-${m.key}`}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-5 py-2 font-semibold text-slate-900">{m.label}</td>
                      {matrix.roles.map((role) => (
                        <td key={role.role} className="px-3 py-2">
                          <AccessBadge level={m.access[role.role]} />
                        </td>
                      ))}
                      <td className="px-5 py-2 text-xs text-slate-500">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Audit Log Table */}
      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold text-rose-700">
            Không thể tải dữ liệu Nhật ký hệ thống
          </p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Đang tải dữ liệu Nhật ký hệ thống...
        </div>
      ) : (
        <DataTable
          title="Nhật ký thao tác hệ thống (Audit Log)"
          subtitle="Lưu vết người thực hiện, thời điểm và giá trị trước/sau cho mọi biến động quan trọng"
          columns={columns}
          data={logs}
          filters={logFilters}
          searchPlaceholder="Tìm theo người dùng, hành động..."
          exportFileName="vnpt_audit_log"
          pagination
        />
      )}
    </div>
  );
}

