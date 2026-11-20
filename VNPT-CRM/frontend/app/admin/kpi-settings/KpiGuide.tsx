"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { DEFAULT_KPI_FORMULAS, type KpiKey, type KpiSegment } from "@/lib/kpi-formula";

/**
 * Khối "Hướng dẫn sử dụng" ở đầu trang Cấu hình KPI. Nội dung viết theo code thực tế:
 * - Cách tính tỷ lệ: backend/src/modules/kpi/kpi.service.ts (getPerformance)
 * - Chỉ tiêu mặc định: backend/src/constants/org.ts (DEFAULT_KPI_TARGETS)
 * - Công thức mặc định: backend/src/modules/kpi/kpi-formula.ts (DEFAULT_KPI_FORMULAS)
 * Chỗ nào chưa chắc ý khách thì ghi "Cần xác nhận".
 */

interface KpiGuideProps {
  /** Bảng công thức đang áp dụng (đã đọc từ server). */
  formulas: Record<KpiKey, KpiSegment[]>;
}

const KPI_GUIDE_ITEMS: {
  key: KpiKey;
  label: string;
  how: string;
  source: string;
  defaultTarget: string;
  note?: string;
}[] = [
  {
    key: "thu_ngay",
    label: "Tỷ lệ thu ngay",
    how: "Tổng số tiền đã thu ÷ Tổng nợ thu ngay, tính trên các dòng công nợ của nhân viên trong tháng đang xem.",
    source:
      "Trang Công nợ: nợ thu ngay lấy từ file nhập (cột CONNO_THUNGAY) hoặc nợ lẻ Admin thêm; số đã thu được ghi khi bấm “Gạch nợ”.",
    defaultTarget: "Không có mặc định. Admin phải nhập chỉ tiêu từng nhân viên theo tháng, chưa nhập thì hiển thị “Chưa có chỉ tiêu” và không có điểm.",
  },
  {
    key: "ghtt_t",
    label: "GHTT tháng T (gia hạn trả trước)",
    how: "Số giao dịch gia hạn có ngày hết hạn trong tháng T và đã chuyển “Hoàn thành” chậm nhất ngày 05 của tháng T+1 ÷ Tổng số giao dịch gia hạn hết hạn trong tháng T.",
    source:
      "Trang Gia hạn: ngày ghi nhận gia hạn thành công là ngày chuyển trạng thái sang “Hoàn thành” (Admin sửa tay được).",
    defaultTarget: "80%",
    note: "Giao dịch hoàn thành trước khi hệ thống có cột ngày gia hạn (dữ liệu cũ) chưa được tính là gia hạn đúng hạn cho đến khi có ngày.",
  },
  {
    key: "ghtt_t1",
    label: "GHTT tháng T+1",
    how: "Giống GHTT tháng T nhưng hạn hoàn thành kéo dài đến ngày 05 của tháng T+2.",
    source: "Như GHTT tháng T.",
    defaultTarget: "90%",
  },
  {
    key: "thu_luy_ke",
    label: "Tỷ lệ thu lũy kế",
    how: "Tổng số tiền đã thu ÷ (Tổng nợ thu ngay + Tổng nợ lũy kế) của nhân viên trong tháng đang xem.",
    source: "Trang Công nợ: nợ lũy kế lấy từ cột CONNO_LUYKE của file nhập; số đã thu dùng chung với Tỷ lệ thu ngay.",
    defaultTarget: "85%",
    note: "Cần xác nhận: cách tính tử số (hiện dùng chung số đã thu với Tỷ lệ thu ngay) và bảng ngưỡng điểm (hiện đang sao chép từ Tỷ lệ thu ngay).",
  },
];

function formatPercent(rate: number): string {
  const value = Math.round(rate * 100000) / 1000;
  return `${String(value).replace(".", ",")}%`;
}

function formatNumber(n: number): string {
  return String(n).replace(".", ",");
}

/** Mô tả 1 khoảng của bảng công thức bằng tiếng Việt, TL tính theo %. */
export function describeSegment(s: KpiSegment): string {
  const lower = s.from === null ? "" : `${formatPercent(s.from)} ${s.fromInclusive ? "≤" : "<"} `;
  const upper = s.to === null ? "" : ` ${s.toInclusive ? "≤" : "<"} ${formatPercent(s.to)}`;
  let range: string;
  if (s.from === null && s.to !== null) {
    range = `TL${upper}`;
  } else if (s.to === null && s.from !== null) {
    range = `TL ${s.fromInclusive ? "≥" : ">"} ${formatPercent(s.from)}`;
  } else {
    range = `${lower}TL${upper}`;
  }
  const score =
    s.a === 0
      ? `${formatNumber(s.b)} điểm`
      : `${formatNumber(s.a)} × TL ${s.b < 0 ? "−" : "+"} ${formatNumber(Math.abs(s.b))}`;
  return `${range} → ${score}`;
}

function sameSegments(a: KpiSegment[], b: KpiSegment[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function KpiGuide({ formulas }: KpiGuideProps) {
  const [open, setOpen] = useState(true);

  return (
    <section
      data-testid="kpi-guide"
      className="rounded-2xl border border-blue-100 bg-blue-50/50 shadow-xs"
    >
      <button
        type="button"
        data-testid="kpi-guide-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <BookOpen className="h-4 w-4 text-vnpt" />
          Hướng dẫn sử dụng
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
          {open ? "Thu gọn" : "Mở rộng"}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-blue-100 px-5 pb-5 pt-4 text-xs leading-relaxed text-slate-700">
          <div>
            <div className="mb-1 text-[13px] font-bold text-slate-900">1. Điểm KPI được tính thế nào?</div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Với mỗi chỉ tiêu: <strong>Tỷ lệ thực hiện</strong> (tính từ dữ liệu thật, xem bảng bên dưới) ÷{" "}
                <strong>Chỉ tiêu</strong> của nhân viên trong tháng = <strong>TL</strong> (tỷ lệ hoàn thành, 100% = 1).
              </li>
              <li>
                Hệ thống tìm khoảng của bảng công thức chứa TL rồi tính <strong>Điểm = a × TL + b</strong>, làm tròn 2 chữ số thập phân.
              </li>
              <li>
                Không có điểm (hiển thị “—”) khi mẫu số bằng 0 (chưa có dữ liệu trong tháng) hoặc chưa có chỉ tiêu.
              </li>
              <li>
                Điểm được <strong>tính lại mỗi lần xem</strong>, không lưu cố định theo tháng.
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-bold text-slate-900">2. Từng chỉ tiêu</div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Chỉ tiêu</th>
                    <th className="px-3 py-2">Tỷ lệ thực hiện tính thế nào</th>
                    <th className="px-3 py-2">Dữ liệu lấy từ đâu</th>
                    <th className="px-3 py-2">Chỉ tiêu mặc định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {KPI_GUIDE_ITEMS.map((item) => (
                    <tr key={item.key} data-testid={`kpi-guide-row-${item.key}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">{item.label}</td>
                      <td className="px-3 py-2">
                        {item.how}
                        {item.note && (
                          <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                            <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{item.note}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.source}</td>
                      <td className="px-3 py-2">{item.defaultTarget}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-bold text-slate-900">3. Ngưỡng điểm đang áp dụng</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {KPI_GUIDE_ITEMS.map((item) => {
                const segments = formulas[item.key] ?? DEFAULT_KPI_FORMULAS[item.key];
                const isDefault = sameSegments(segments, DEFAULT_KPI_FORMULAS[item.key]);
                return (
                  <div
                    key={item.key}
                    data-testid={`kpi-guide-thresholds-${item.key}`}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          isDefault ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isDefault ? "Mặc định VNPT" : "Đã chỉnh"}
                      </span>
                    </div>
                    <ul className="space-y-0.5 font-mono text-[11px] text-slate-700">
                      {segments.map((s, idx) => (
                        <li key={idx}>{describeSegment(s)}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-amber-700">
              Cần xác nhận: ngưỡng của “Tỷ lệ thu lũy kế” hiện đang sao chép từ “Tỷ lệ thu ngay”, chờ khách xác nhận bảng riêng.
            </p>
          </div>

          <div>
            <div className="mb-1 text-[13px] font-bold text-slate-900">4. Cách sửa và khi nào có hiệu lực</div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Tab “Công thức”</strong> (chỉ Admin sửa): mỗi chỉ tiêu một bảng khoảng. Điền <em>Từ (%)</em>, <em>Đến (%)</em>,
                đánh dấu “Gồm” nếu khoảng bao gồm đầu mút đó, nhập hệ số <em>a</em> và <em>b</em>. Khoảng đầu để trống “Từ” (−∞), khoảng
                cuối để trống “Đến” (+∞); các khoảng phải liền nhau, không hở, không chồng lấn — sai thì hệ thống báo lỗi và không lưu.
                Dùng ô “Thử tính” để kiểm tra trước. Bấm <strong>Lưu</strong> để áp dụng; <strong>Khôi phục mặc định VNPT</strong> để quay về
                bảng gốc.
              </li>
              <li>
                <strong>Có hiệu lực:</strong> ngay sau khi lưu, cho mọi tháng (kể cả khi xem lại tháng cũ, vì điểm tính lúc xem).
                <span className="text-amber-700"> Cần xác nhận: có cần “chốt” công thức theo từng tháng để tháng cũ không bị đổi điểm không?</span>
              </li>
              <li>
                <strong>Tab “Chỉ tiêu”</strong>: chọn tháng, nhập chỉ tiêu (%) cho từng nhân viên rồi bấm <strong>Lưu chỉ tiêu</strong>.
                Chỉ tiêu có giá trị trong khoảng lớn hơn 0 và tối đa 200%. Các ô đã hiện sẵn giá trị mặc định (GHTT T 80%, GHTT T+1 90%,
                thu lũy kế 85%); khi bấm Lưu, mọi ô có giá trị sẽ được ghi riêng cho tháng đó. Dùng{" "}
                <strong>Sao chép từ tháng trước</strong> để lấy nhanh chỉ tiêu tháng liền trước. Chỉ tiêu chỉ áp dụng cho đúng tháng đã chọn.
              </li>
              <li>
                Nhân viên (AM) chỉ xem được chỉ tiêu và kết quả của chính mình; cấu hình công thức và chỉ tiêu chỉ Admin được làm.
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
