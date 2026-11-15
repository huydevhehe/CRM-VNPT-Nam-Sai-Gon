import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cog,
  Database,
  FileText,
  FileSignature,
  FolderCog,
  GraduationCap,
  HeartPulse,
  Headset,
  Layers,
  Leaf,
  PenLine,
  Phone,
  PiggyBank,
  Plug,
  Rocket,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import EContractForm from "./EContractForm";

export const metadata: Metadata = {
  title: "VNPT eContract — Hợp đồng điện tử | VNPT Nam Sài Gòn",
  description:
    "VNPT eContract — giải pháp ký kết, quản lý và lưu trữ hợp đồng số an toàn, hợp pháp, tiết kiệm cho doanh nghiệp. Đăng ký ngay để nhận tư vấn và báo giá.",
};

const HERO_BADGES = [
  { icon: ShieldCheck, label: "Ký kết hợp pháp" },
  { icon: Zap, label: "Nhanh chóng, linh hoạt" },
  { icon: Layers, label: "Quản lý tập trung" },
  { icon: Cloud, label: "Lưu trữ an toàn" },
];

const LOI_ICH = [
  { icon: PiggyBank, title: "Tiết kiệm", desc: "đến 70% chi phí" },
  { icon: Zap, title: "Ký kết từ xa", desc: "mọi lúc, mọi nơi" },
  { icon: ShieldCheck, title: "Đảm bảo", desc: "giá trị pháp lý" },
  { icon: Layers, title: "Quản lý", desc: "tra cứu tập trung" },
  { icon: Leaf, title: "Thân thiện", desc: "môi trường" },
];

const UNG_DUNG = [
  { icon: Users, label: "Hợp đồng thương mại" },
  { icon: Briefcase, label: "Hợp đồng với đối tác" },
  { icon: FileSignature, label: "Hợp đồng lao động điện tử" },
  { icon: Building2, label: "Hợp đồng cung ứng dịch vụ" },
  { icon: GraduationCap, label: "Hợp đồng trong giáo dục" },
  { icon: HeartPulse, label: "Hợp đồng trong y tế" },
  { icon: Layers, label: "Các loại hợp đồng khác" },
];

const GOI_CUOC = [
  { ma: "E50", hopDong: "50 hợp đồng", dungLuong: "250 MB lưu trữ", gia: "350.000đ", vat: "378.000đ", noiBat: false },
  { ma: "E100", hopDong: "100 hợp đồng", dungLuong: "500 MB lưu trữ", gia: "650.000đ", vat: "702.000đ", noiBat: true },
  { ma: "E200", hopDong: "200 hợp đồng", dungLuong: "1 GB lưu trữ", gia: "1.250.000đ", vat: "1.350.000đ", noiBat: false },
  { ma: "E500", hopDong: "500 hợp đồng", dungLuong: "3 GB lưu trữ", gia: "2.750.000đ", vat: "2.970.000đ", noiBat: false },
];

const PHI_TRIEN_KHAI = [
  { icon: Rocket, label: "Phí khởi tạo hệ thống", gia: "2.000.000đ", vat: "2.160.000đ" },
  { icon: Plug, label: "Mở cổng tích hợp API", gia: "5.000.000đ", vat: "5.400.000đ" },
];

const TINH_NANG = [
  { icon: FileText, label: "Tạo và soạn thảo hợp đồng điện tử" },
  { icon: PenLine, label: "Ký số hợp đồng (USB Token/SmartCA)" },
  { icon: FolderCog, label: "Quản lý, phân quyền và theo dõi trạng thái" },
  { icon: Cloud, label: "Lưu trữ an toàn đến 10 năm" },
  { icon: Plug, label: "Tích hợp API (hệ thống ERP, CRM...)" },
  { icon: Bell, label: "Nhắc ký, cảnh báo và báo cáo thống kê" },
];

const QUY_TRINH = [
  { icon: Headset, title: "Tiếp nhận yêu cầu tư vấn" },
  { icon: Settings, title: "Tư vấn, lựa chọn gói phù hợp" },
  { icon: FileText, title: "Khởi tạo hệ thống và hướng dẫn sử dụng" },
  { icon: Check, title: "Bàn giao và hỗ trợ vận hành" },
];

const FAQ = [
  {
    q: "Hợp đồng điện tử VNPT eContract có giá trị pháp lý không?",
    a: "Có. Hợp đồng ký trên VNPT eContract tuân thủ Luật Giao dịch điện tử và các quy định hiện hành, có giá trị pháp lý tương đương hợp đồng giấy khi ký bằng chữ ký số hợp lệ.",
  },
  {
    q: "Thời hạn lưu trữ hợp đồng là bao lâu?",
    a: "Hợp đồng điện tử được lưu trữ an toàn trên hệ thống đến 10 năm, tra cứu và tải về nhanh chóng bất cứ lúc nào.",
  },
  {
    q: "Cần chuẩn bị gì để đăng ký và sử dụng dịch vụ?",
    a: "Doanh nghiệp chỉ cần cung cấp thông tin đăng ký và chữ ký số (USB Token hoặc SmartCA) để kích hoạt, không cần đầu tư thêm hạ tầng.",
  },
  {
    q: "Có thể mua thêm số lượng hợp đồng khi hết gói không?",
    a: "Có. Khách hàng có thể nâng cấp gói hoặc mua thêm số lượng hợp đồng bất kỳ lúc nào, hệ thống cộng dồn ngay sau khi thanh toán.",
  },
  {
    q: "Có thể sử dụng chữ ký số SmartCA để ký hợp đồng không?",
    a: "Có. VNPT eContract hỗ trợ ký bằng SmartCA, USB Token và nhiều hình thức chữ ký số khác, phù hợp cả cá nhân và doanh nghiệp.",
  },
  {
    q: "VNPT eContract có thể tích hợp với phần mềm của doanh nghiệp không?",
    a: "Có. Dịch vụ cung cấp API để tích hợp với hệ thống ERP, CRM hoặc phần mềm quản lý nội bộ sẵn có của doanh nghiệp.",
  },
];

export default function HopDongDienTuPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Breadcrumb
            variant="light"
            items={[{ label: "Trang chủ", href: "/" }, { label: "Hợp đồng điện tử" }]}
          />

          <div className="mt-6 grid items-center gap-6 lg:grid-cols-[1.4fr_0.85fr_260px]">
            <div className="text-white">
              <h1 className="leading-tight">
                VNPT eContract
                <br />
                Hợp đồng điện tử
              </h1>
              <p className="mt-3 max-w-md text-white/85">
                Giải pháp ký kết, quản lý và lưu trữ hợp đồng số an toàn, hợp pháp, tiết kiệm
                cho doanh nghiệp
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="#dang-ky-tu-van"
                  className="flex items-center gap-2 whitespace-nowrap rounded-md bg-vnpt px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
                >
                  Đăng ký ngay <ChevronRight size={16} />
                </Link>
                <a
                  href="https://zalo.me"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 whitespace-nowrap rounded-md border border-white/60 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500 text-[10px] font-bold">
                    Za
                  </span>
                  Tư vấn qua Zalo
                </a>
              </div>
            </div>

            {/* Minh hoạ laptop / phone — placeholder bằng icon, không tải ảnh ngoài */}
            <div className="relative hidden h-56 items-center justify-center lg:flex">
              <div className="relative flex h-40 w-64 -rotate-1 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-sm">
                <FileSignature size={52} className="text-white/90" />
                <span className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-vnpt-accent text-white shadow-lg">
                  <Check size={20} />
                </span>
              </div>
              <div className="absolute -right-4 bottom-0 flex h-28 w-14 rotate-3 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-sm">
                <ShieldCheck size={22} className="text-white/90" />
              </div>
              <Cloud size={34} className="absolute -top-2 left-4 text-white/60" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {HERO_BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-vnpt-dark shadow-md"
                >
                  <b.icon size={16} className="shrink-0 text-vnpt" />
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* LỢI ÍCH */}
        <section>
          <h2 className="text-slate-800">Lợi ích khi sử dụng VNPT eContract</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {LOI_ICH.map((l) => (
              <div
                key={l.title}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-5 text-center shadow-sm"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <l.icon size={22} />
                </span>
                <p className="text-sm text-slate-700">
                  {l.title} <span className="font-bold text-vnpt">{l.desc}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ỨNG DỤNG THỰC TẾ */}
        <section className="mt-14">
          <h2 className="text-slate-800">Ứng dụng thực tế</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {UNG_DUNG.map((u) => (
              <div
                key={u.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <u.icon size={22} />
                </span>
                <span className="text-xs font-medium text-slate-700">{u.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BẢNG GIÁ */}
        <section id="bang-gia" className="mt-14 scroll-mt-24">
          <h2 className="text-slate-800">Bảng giá VNPT eContract</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="flex flex-col justify-center rounded-xl bg-gradient-to-br from-vnpt-darker to-vnpt-dark p-6 text-white">
              <FileText size={28} className="text-white/90" />
              <h3 className="mt-3 text-lg font-bold leading-snug">
                Gói dịch vụ
                <br />
                VNPT eContract
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-white/90">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Ký và quản lý
                  hợp đồng điện tử
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Lưu trữ an
                  toàn
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Triển khai
                  nhanh
                </li>
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GOI_CUOC.map((g) => (
                <div
                  key={g.ma}
                  className={`relative flex flex-col rounded-xl border p-5 ${
                    g.noiBat
                      ? "border-vnpt bg-vnpt-light shadow-lg"
                      : "border-slate-100 shadow-sm"
                  }`}
                >
                  {g.noiBat && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-vnpt-darker shadow">
                      Phổ biến
                    </span>
                  )}
                  <div className="text-center text-lg font-extrabold text-vnpt-dark">{g.ma}</div>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-center gap-1.5">
                      <FileText size={14} className="text-vnpt" /> {g.hopDong}
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <Database size={14} className="text-vnpt" /> {g.dungLuong}
                    </div>
                  </div>
                  <div className="mt-3 text-center text-xl font-extrabold text-vnpt-darker">
                    {g.gia}
                  </div>
                  <div className="text-center text-[11px] text-slate-400">
                    (VAT 8%: {g.vat})
                  </div>
                  <Link
                    href="#dang-ky-tu-van"
                    className={`mt-4 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${
                      g.noiBat
                        ? "bg-vnpt text-white hover:bg-vnpt-dark"
                        : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                    }`}
                  >
                    Đăng ký ngay <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PHÍ TRIỂN KHAI & DỊCH VỤ TÍCH HỢP */}
        <section className="mt-6">
          <div className="flex flex-col gap-6 rounded-xl border border-slate-100 bg-vnpt-light/60 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt text-white">
                <Cog size={22} />
              </span>
              <h3 className="text-sm font-bold leading-snug text-slate-800">
                Phí triển khai &amp;
                <br />
                Dịch vụ tích hợp
              </h3>
            </div>
            <div className="grid flex-1 gap-6 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
              {PHI_TRIEN_KHAI.map((p) => (
                <div key={p.label} className="flex items-center gap-3 sm:pl-6 first:sm:pl-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                    <p.icon size={20} />
                  </span>
                  <div>
                    <div className="text-sm text-slate-600">{p.label}</div>
                    <div className="text-lg font-extrabold text-vnpt-darker">{p.gia}</div>
                    <div className="text-xs text-slate-400">(VAT 8%: {p.vat})</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TÍNH NĂNG NỔI BẬT */}
        <section className="mt-14">
          <h2 className="text-slate-800">Tính năng nổi bật</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TINH_NANG.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <t.icon size={22} />
                </span>
                <span className="text-xs font-medium text-slate-700">{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* QUY TRÌNH */}
        <section className="mt-14">
          <h2 className="text-slate-800">Quy trình đăng ký &amp; triển khai</h2>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-y-6">
            {QUY_TRINH.map((q, i) => (
              <div key={q.title} className="flex items-start">
                <div className="relative flex w-28 flex-col items-center gap-2 text-center sm:w-36">
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-vnpt-accent text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                    <q.icon size={24} />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{q.title}</span>
                </div>
                {i < QUY_TRINH.length - 1 && (
                  <ChevronRight
                    size={18}
                    className="mt-6 hidden shrink-0 text-slate-300 sm:block"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* FORM ĐĂNG KÝ TƯ VẤN */}
        <section id="dang-ky-tu-van" className="mt-14 scroll-mt-24">
          <div className="grid items-center gap-6 overflow-hidden rounded-xl border border-slate-100 bg-vnpt-light/40 p-6 lg:grid-cols-[1fr_1.3fr_auto] lg:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vnpt text-white">
                <Headset size={22} />
              </span>
              <div>
                <h3 className="text-lg font-bold leading-snug text-slate-800">
                  Đăng ký tư vấn
                  <br />
                  VNPT eContract
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Nhận báo giá và tư vấn giải pháp phù hợp cho doanh nghiệp của bạn.
                </p>
              </div>
            </div>

            <EContractForm />

            <div className="hidden justify-center lg:flex">
              <div className="flex h-40 w-40 items-center justify-center rounded-full bg-vnpt/10">
                <UserRound size={88} className="text-vnpt" />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-14 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-800">Câu hỏi thường gặp</h2>
            <Link href="/lien-he" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-lg border border-slate-100 p-4 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-semibold text-slate-800">
                  <span>{f.q}</span>
                  <ChevronDown
                    size={16}
                    className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-180"
                  />
                </summary>
                <p className="mt-2 text-sm text-slate-500">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA CUỐI TRANG */}
        <section className="mt-14">
          <div className="flex flex-col items-center justify-between gap-6 rounded-xl bg-gradient-to-r from-vnpt-darker to-vnpt p-8 text-white lg:flex-row">
            <div className="flex items-center gap-3 text-center lg:text-left">
              <span className="hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 sm:flex">
                <FileSignature size={22} />
              </span>
              <div>
                <div className="text-lg font-bold">Đăng ký VNPT eContract ngay hôm nay!</div>
                <p className="mt-1 text-sm text-white/80">
                  Ký kết an toàn – Quản lý tập trung – Tối ưu chi phí cho doanh nghiệp.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <a
                href="tel:0838999333"
                className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-vnpt-dark hover:bg-slate-100"
              >
                <Phone size={16} /> 0838 999 333
              </a>
              <a
                href="https://zalo.me"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500 text-[10px] font-bold">
                  Za
                </span>
                Tư vấn qua Zalo
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
