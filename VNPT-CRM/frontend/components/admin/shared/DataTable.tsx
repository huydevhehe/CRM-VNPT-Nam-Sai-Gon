"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { Search, Download, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  TableFilter,
  FilterValues,
  applyTableFilters,
  distinctOptions,
} from "@/lib/table-filters";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
  /** Độ rộng khởi tạo (px). Người dùng có thể kéo giãn thêm nếu `resizableColumns` bật. */
  width?: number;
  /** Ghim cột này bên trái khi cuộn ngang (vd cột mã thuê bao / mã giao dịch). */
  sticky?: boolean;
}

export interface SelectionProps<T> {
  getRowId: (row: T) => string;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
/** Độ rộng tối thiểu mặc định cho cột không khai báo `width` khi bật resizableColumns. */
const DEFAULT_COL_WIDTH = 140;

interface DataTableProps<T> {
  title?: string;
  subtitle?: string;
  columns: Column<T>[];
  data: T[];
  filters?: TableFilter<T>[];
  searchPlaceholder?: string;
  exportFileName?: string;
  actionButton?: React.ReactNode;
  /** Tuỳ chọn: hiện cột checkbox chọn dòng (Đợt 8, Task 5). Không truyền thì bảng hoạt động như trước. */
  selection?: SelectionProps<T>;
  /** Bật phân trang phía client với các lựa chọn 10/20/50/100. Không truyền = hiện toàn bộ (hành vi cũ). */
  pagination?: boolean;
  /** Cho phép kéo giãn độ rộng từng cột bằng chuột. */
  resizableColumns?: boolean;
  /** Nhóm các dòng theo khoá trả về (vd tháng) — chèn dòng tiêu đề nhóm. Dữ liệu nên đã được sắp xếp theo cùng thứ tự với khoá nhóm. */
  groupBy?: (row: T) => string;
}

export default function DataTable<T extends Record<string, any>>({
  title,
  subtitle,
  columns,
  data,
  filters,
  searchPlaceholder = "Tìm kiếm trong bảng...",
  exportFileName = "vnpt_crm_export",
  actionButton,
  selection,
  pagination = false,
  resizableColumns = false,
  groupBy,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const thRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  // Cột ghim (sticky) có thể nằm liên tiếp nhau (vd 3 cột đầu) — mỗi cột cần
  // offset `left` bằng tổng độ rộng các cột ghim đứng trước nó, không phải 0.
  const stickyLeftOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
      offsets[i] = acc;
      if (columns[i].sticky) {
        acc += colWidths[i] ?? columns[i].width ?? thRefs.current[i]?.offsetWidth ?? DEFAULT_COL_WIDTH;
      }
    }
    return offsets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, colWidths]);

  // Khi bật resizableColumns, bảng cần một độ rộng THẬT (tổng độ rộng các cột) thay vì
  // w-full co vừa khung — nếu không, table-layout:fixed sẽ ép co hết các cột lại cho vừa
  // màn hình thay vì tràn ra để overflow-x-auto cuộn được.
  const totalTableWidth = useMemo(() => {
    let total = selection ? 40 : 0;
    for (let i = 0; i < columns.length; i++) {
      total += colWidths[i] ?? columns[i].width ?? DEFAULT_COL_WIDTH;
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, colWidths, selection]);

  const dataAfterFilters = filters
    ? applyTableFilters(data, filters, filterValues)
    : data;

  const filteredData = dataAfterFilters.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) => {
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) return val.join(" ").toLowerCase().includes(term);
      return String(val).toLowerCase().includes(term);
    });
  });

  const totalPages = pagination ? Math.max(1, Math.ceil(filteredData.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const pagedData = pagination
    ? filteredData.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredData;

  const selectedCount = selection
    ? filteredData.filter((row) => selection.selectedIds.has(selection.getRowId(row))).length
    : 0;
  const allVisibleSelected = selection ? filteredData.length > 0 && selectedCount === filteredData.length : false;

  function toggleSelectAllVisible(checked: boolean) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    for (const row of filteredData) {
      const id = selection.getRowId(row);
      if (checked) next.add(id);
      else next.delete(id);
    }
    selection.onChange(next);
  }

  function toggleSelectRow(id: string, checked: boolean) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  }

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(1);
  }

  function startResize(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[idx] ?? columns[idx]?.width ?? thRefs.current[idx]?.offsetWidth ?? 140;

    function onMove(ev: MouseEvent) {
      const next = Math.max(60, startWidth + (ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [idx]: next }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const hasActiveFilter = Object.values(filterValues).some(
    (v) => v !== "" && v !== undefined
  );

  const handleClearFilters = () => {
    setFilterValues({});
  };

  const handleExportCsv = () => {
    if (!filteredData.length) return;

    const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`);
    const rows = filteredData.map((row) =>
      columns.map((col) => {
        let val = col.accessorKey ? row[col.accessorKey] : "";
        if (Array.isArray(val)) val = val.join("; ");
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        return `"${String(val ?? "").replace(/"/g, '""')}"`;
      })
    );

    const csvContent =
      "﻿" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stickyLeftClass = "sticky z-10";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {title && (
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-48 rounded-xl border border-slate-200 bg-slate-50/70 pr-3 pl-8 text-xs text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-hidden sm:w-60"
            />
          </div>

          {/* Filters */}
          {filters &&
            filters.map((f) => {
              const options = distinctOptions(data, f);
              return (
                <select
                  key={f.id}
                  aria-label={f.label}
                  value={filterValues[f.id] || ""}
                  onChange={(e) => {
                    setFilterValues((prev) => ({ ...prev, [f.id]: e.target.value }));
                    setPage(1);
                  }}
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-hidden"
                >
                  <option value="">Tất cả {f.label}</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            })}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Xóa tất cả bộ lọc"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Xóa lọc</span>
            </button>
          )}

          {/* Export CSV button */}
          <button
            onClick={handleExportCsv}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Xuất file Excel / CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Xuất CSV</span>
          </button>

          {/* Optional Action Button */}
          {actionButton}
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table
          className={resizableColumns ? "text-left text-xs" : "w-full min-w-160 text-left text-xs"}
          style={
            resizableColumns
              ? { tableLayout: "fixed", width: totalTableWidth, minWidth: totalTableWidth }
              : undefined
          }
        >
          {resizableColumns && (
            <colgroup>
              {selection && <col style={{ width: 40 }} />}
              {columns.map((col, idx) => (
                <col
                  key={idx}
                  style={{ width: colWidths[idx] ?? col.width ?? DEFAULT_COL_WIDTH }}
                />
              ))}
            </colgroup>
          )}
          <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <tr>
              {selection && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  ref={(el) => {
                    thRefs.current[idx] = el;
                  }}
                  className={`relative px-4 py-3 ${col.sticky ? `${stickyLeftClass} bg-slate-50` : ""} ${col.className || ""}`}
                  style={{
                    ...(!resizableColumns && col.width ? { width: col.width } : {}),
                    ...(col.sticky ? { left: stickyLeftOffsets[idx] } : {}),
                  }}
                >
                  {col.header}
                  {resizableColumns && (
                    <span
                      onMouseDown={(e) => startResize(idx, e)}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-300/60"
                      title="Kéo để đổi độ rộng cột"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {pagedData.length > 0 ? (
              pagedData.map((row, rIdx) => {
                const groupLabel = groupBy ? groupBy(row) : null;
                const prevGroupLabel =
                  groupBy && rIdx > 0 ? groupBy(pagedData[rIdx - 1]) : null;
                const showGroupHeader = groupBy && groupLabel !== prevGroupLabel;

                return (
                  <Fragment key={row.id || rIdx}>
                    {showGroupHeader && (
                      <tr className="bg-slate-100/80">
                        <td
                          colSpan={columns.length + (selection ? 1 : 0)}
                          className="px-4 py-2 text-[11px] font-bold tracking-wide text-slate-600 uppercase"
                        >
                          {groupLabel}
                        </td>
                      </tr>
                    )}
                    <tr className="transition-colors hover:bg-blue-50/30">
                      {selection && (
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            aria-label="Chọn dòng"
                            checked={selection.selectedIds.has(selection.getRowId(row))}
                            onChange={(e) => toggleSelectRow(selection.getRowId(row), e.target.checked)}
                          />
                        </td>
                      )}
                      {columns.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-4 py-3.5 whitespace-nowrap ${
                            resizableColumns ? "overflow-hidden text-ellipsis" : ""
                          } ${col.sticky ? `${stickyLeftClass} bg-white` : ""} ${col.className || ""}`}
                          style={col.sticky ? { left: stickyLeftOffsets[cIdx] } : undefined}
                        >
                          {col.cell
                            ? col.cell(row)
                            : col.accessorKey
                            ? Array.isArray(row[col.accessorKey])
                              ? row[col.accessorKey].join(", ")
                              : String(row[col.accessorKey] ?? "—")
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="py-12 text-center text-xs text-slate-400"
                >
                  Không tìm thấy dữ liệu phù hợp với tìm kiếm
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count + pagination */}
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị{" "}
          <strong>
            {pagination && filteredData.length > 0
              ? `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filteredData.length)}`
              : filteredData.length}
          </strong>{" "}
          / <strong>{data.length}</strong> bản ghi
        </span>

        {pagination && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Số dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-500 focus:outline-hidden"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-medium text-slate-600">
              Trang {safePage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Trang sau"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <span className="text-[11px] text-slate-400">
          VNPT Nam Sài Gòn · CRM V2
        </span>
      </div>
    </div>
  );
}
