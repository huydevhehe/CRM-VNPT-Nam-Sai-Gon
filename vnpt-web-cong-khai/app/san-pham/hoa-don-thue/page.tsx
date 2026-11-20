import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cpu,
  FilePlus2,
  Gem,
  Handshake,
  Headset,
  Landmark,
  Link2,
  Lock,
  Phone,
  PiggyBank,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Hóa đơn điện tử VNPT — VNPT Nam Sài Gòn",
  description:
    "Hóa đơn điện tử VNPT Invoice, hóa đơn từ máy tính tiền VNPT POS — đáp ứng Thông tư 254/2025/TT-BTC và 91/2025/TT-BTC, kết nối trực tiếp cơ quan thuế.",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-slate-800">
      <span className="text-slate-300">–</span> {children}
    </h2>
  );
}

function ZaloBadge() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-vnpt text-[9px] font-bold text-white">
      Za
    </span>
  );
}

const HERO_CHECKS = [
  "Đáp ứng Thông tư 254/2025/TT-BTC và 91/2025/TT-BTC",
  "Kết nối cơ quan thuế, truyền dữ liệu nhanh chóng",
  "Phù hợp hộ kinh doanh, doanh nghiệp, nhà thuốc, vàng bạc",
];

const HERO_BADGES = [
  { icon: FilePlus2, label: "Phát hành hóa đơn" },
  { icon: Search, label: "Quản lý, tra cứu" },
  { icon: Archive, label: "Lưu trữ an toàn" },
  { icon: Landmark, label: "Kết nối cơ quan thuế" },
];

const LOI_ICH = [
  { icon: PiggyBank, title: "Tiết kiệm đến 30%", sub: "chi phí" },
  { icon: Zap, title: "Phát hành nhanh chóng,", sub: "dễ sử dụng" },
  { icon: ShieldCheck, title: "Tuân thủ đầy đủ", sub: "quy định pháp luật" },
  { icon: Cloud, title: "Lưu trữ an toàn", sub: "đến 10 năm" },
  { icon: Link2, title: "Kết nối, truyền dữ liệu", sub: "đến cơ quan thuế" },
  { icon: Headset, title: "Đội ngũ VNPT", sub: "hỗ trợ 24/7" },
];

const COMBO_HKD_BULLETS = [
  "VNPT SmartCA (ký số từ xa)",
  "1.000 hóa đơn điện tử (MTT)",
  "Đáp ứng đăng ký thuế, BHXH",
];

const COMBO_DN_BULLETS = [
  "VNPT-CA / SmartCA (theo nhu cầu)",
  "Gói hóa đơn linh hoạt (1.000 – 50.000 HĐ)",
  "Tích hợp phần mềm kế toán, bán hàng",
  "Hỗ trợ triển khai và sử dụng",
];

const BANG_GIA_INVOICE = [
  { name: "INVOICE 1.000", sub: "1.000 hóa đơn", price: "800.000đ" },
  { name: "INVOICE 2.000", sub: "2.000 hóa đơn", price: "1.400.000đ" },
  { name: "INVOICE 5.000", sub: "5.000 hóa đơn", price: "3.000.000đ" },
  { name: "INVOICE 10.000", sub: "10.000 hóa đơn", price: "5.500.000đ" },
  { name: "INVOICE 20.000", sub: "20.000 hóa đơn", price: "10.000.000đ" },
];

const BANG_GIA_POS = [
  { name: "POS 1.000", sub: "1.000 hóa đơn", price: "900.000đ" },
  { name: "POS 2.000", sub: "2.000 hóa đơn", price: "1.600.000đ" },
  { name: "POS 5.000", sub: "5.000 hóa đơn", price: "3.500.000đ" },
  { name: "POS 10.000", sub: "10.000 hóa đơn", price: "6.500.000đ" },
];

const GIAI_PHAP_PHU_HOP = [
  {
    icon: Store,
    title: "Hộ kinh doanh",
    titleLine2: "mới thành lập",
    desc: "Đáp ứng nghĩa vụ thuế theo quy định",
  },
  {
    icon: Building2,
    title: "Doanh nghiệp",
    titleLine2: "mọi quy mô",
    desc: "Quản lý hóa đơn chuyên nghiệp, tích hợp hệ thống",
  },
  {
    icon: Plus,
    title: "Nhà thuốc,",
    titleLine2: "chuỗi nhà thuốc",
    desc: "Đáp ứng quy định liên thông cổng Dược Quốc gia",
  },
  {
    icon: Gem,
    title: "Ngành trang sức,",
    titleLine2: "vàng bạc",
    desc: "Quản lý, phát hành hóa đơn minh bạch, chính xác",
  },
];

const TINH_NANG_NOI_BAT = [
  { icon: FilePlus2, label: "Lập & phát hành hóa đơn điện tử" },
  { icon: Search, label: "Quản lý, tra cứu hóa đơn dễ dàng" },
  { icon: Archive, label: "Lưu trữ an toàn đến 10 năm" },
  { icon: Cpu, label: "Tích hợp API với phần mềm kế toán, bán hàng" },
];

const QUY_TRINH = [
  { icon: Headset, label: "Tiếp nhận yêu cầu" },
  { icon: Settings, label: "Tư vấn và chọn gói" },
  { icon: Handshake, label: "Ký hợp đồng và triển khai" },
  { icon: CheckCircle2, label: "Bàn giao và hướng dẫn" },
];

const FAQ_LEFT = [
  "Hóa đơn điện tử VNPT có đáp ứng Thông tư 254 và 91 không?",
  "Hộ kinh doanh nên chọn VNPT INVOICE hay VNPT POS?",
  "Có thể tích hợp với phần mềm bán hàng, kế toán không?",
];

const FAQ_RIGHT = [
  "Thời hạn lưu trữ hóa đơn là bao lâu?",
  "Chi phí gia hạn và mua thêm hóa đơn như thế nào?",
  "VNPT hỗ trợ triển khai và sử dụng như thế nào?",
];

export default function HoaDonThuePage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-light via-white to-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Hóa đơn điện tử" }]} />

          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_420px]">
            {/* Nội dung trái */}
            <div>
              <h1 className="text-slate-900">Hóa đơn điện tử VNPT</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Quản lý, phát hành và lưu trữ hóa đơn đúng quy định – An toàn – Tiết kiệm
              </p>

              <div className="mt-5 space-y-2">
                {HERO_CHECKS.map((c) => (
                  <div key={c} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                    {c}
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="#dang-ky-tu-van"
                  className="inline-flex items-center gap-2 rounded-md bg-vnpt px-6 py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
                >
                  Đăng ký ngay <ArrowRight size={16} />
                </Link>
                <a
                  href="https://zalo.me"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-vnpt px-6 py-3 text-sm font-semibold text-vnpt transition hover:bg-vnpt-light"
                >
                  <ZaloBadge /> Tư vấn qua Zalo
                </a>
              </div>
            </div>

            {/* Minh họa + badge phải */}
            <div className="flex gap-4">
              <div className="relative h-64 flex-1 overflow-hidden rounded-2xl bg-gradient-to-br from-vnpt-dark via-vnpt to-vnpt-darker shadow-xl">
                <div className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                  <Cloud size={18} />
                </div>
                <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                  <Lock size={16} />
                </div>

                {/* Màn hình laptop */}
                <div className="absolute left-1/2 top-8 w-52 -translate-x-1/2 rounded-lg bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-vnpt">
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-vnpt text-white">
                      <FilePlus2 size={10} />
                    </span>
                    HÓA ĐƠN ĐIỆN TỬ
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded bg-slate-200" />
                    <div className="h-1.5 w-4/5 rounded bg-slate-200" />
                    <div className="h-1.5 w-3/5 rounded bg-slate-200" />
                  </div>
                </div>
                {/* Chân laptop */}
                <div className="absolute left-1/2 top-[7.5rem] h-2.5 w-64 -translate-x-1/2 rounded-b-xl bg-slate-300/80" />

                {/* Hóa đơn nổi */}
                <div className="absolute bottom-5 right-5 w-28 rotate-3 rounded-lg bg-white p-2.5 shadow-lg">
                  <p className="text-center text-[8px] font-bold leading-tight text-vnpt">
                    HÓA ĐƠN
                    <br />
                    ĐIỆN TỬ
                  </p>
                  <div className="mx-auto mt-1.5 grid h-8 w-8 grid-cols-3 gap-[1.5px]">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span
                        key={i}
                        className={`rounded-[1px] ${i % 2 === 0 ? "bg-slate-700" : "bg-slate-200"}`}
                      />
                    ))}
                  </div>
                  <div className="mx-auto mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check size={12} />
                  </div>
                </div>
              </div>

              <div className="hidden w-44 shrink-0 flex-col justify-center gap-3 sm:flex">
                {HERO_BADGES.map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-md"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                      <b.icon size={15} />
                    </span>
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-14">
        {/* LỢI ÍCH */}
        <section>
          <h2 className="text-center text-vnpt">
            Lợi ích khi sử dụng Hóa đơn điện tử VNPT
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {LOI_ICH.map((l) => (
              <div key={l.title} className="flex flex-col items-center gap-2.5 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <l.icon size={24} />
                </span>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-800">{l.title}</span>
                  <br />
                  {l.sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* COMBO */}
        <section className="mt-16">
          <SectionTitle>Combo Chữ ký số &amp; Hóa đơn điện tử</SectionTitle>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Combo hộ kinh doanh */}
            <div className="rounded-2xl border border-slate-100 bg-vnpt-light/40 p-6 shadow-sm">
              <span className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                Combo Hộ kinh doanh
              </span>
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                    <Store size={20} />
                  </span>
                  <div>
                    <h3 className="text-slate-800">Chữ ký số + Hóa đơn điện tử</h3>
                    <ul className="mt-2 space-y-1.5">
                      {COMBO_HKD_BULLETS.map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="shrink-0 text-center sm:text-right">
                  <p className="text-xs text-slate-500">Chỉ từ</p>
                  <p className="text-2xl font-bold text-vnpt">800.000đ</p>
                  <span className="mt-1 inline-block rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Tiết kiệm đến 30%
                  </span>
                  <Link
                    href="#dang-ky-tu-van"
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-vnpt px-4 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                  >
                    Đăng ký ngay <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Combo doanh nghiệp */}
            <div className="rounded-2xl border border-slate-100 bg-vnpt-light/40 p-6 shadow-sm">
              <span className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                Combo Doanh nghiệp
              </span>
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                    <Building2 size={20} />
                  </span>
                  <div>
                    <h3 className="text-slate-800">Chữ ký số + Hóa đơn điện tử</h3>
                    <ul className="mt-2 space-y-1.5">
                      {COMBO_DN_BULLETS.map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="shrink-0 text-center sm:text-right">
                  <p className="text-xs text-slate-500">Ưu đãi đến</p>
                  <p className="text-2xl font-bold text-vnpt">30%</p>
                  <Link
                    href="#dang-ky-tu-van"
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-vnpt px-4 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                  >
                    Đăng ký ngay <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BẢNG GIÁ INVOICE */}
        <section className="mt-16">
          <div className="grid gap-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col justify-center bg-gradient-to-br from-vnpt-dark to-vnpt-darker p-6 text-white">
              <FilePlus2 size={28} />
              <h3 className="mt-3 text-base font-bold text-white">Bảng giá VNPT INVOICE</h3>
              <p className="mt-1 text-xs text-white/75">Hóa đơn điện tử (thông thường)</p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-5">
              {BANG_GIA_INVOICE.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-1 p-5 text-center">
                  <span className="text-xs font-bold text-vnpt">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.sub}</span>
                  <span className="mt-1 text-lg font-bold text-slate-800">{p.price}</span>
                  <span className="text-[11px] text-slate-400">(đã VAT 8%)</span>
                  <Link
                    href="#dang-ky-tu-van"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-vnpt px-3 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                  >
                    Đăng ký ngay <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BẢNG GIÁ POS */}
        <section className="mt-8">
          <div className="grid gap-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col justify-center bg-gradient-to-br from-vnpt-dark to-vnpt-darker p-6 text-white">
              <Store size={28} />
              <h3 className="mt-3 text-base font-bold text-white">Bảng giá VNPT POS</h3>
              <p className="mt-1 text-xs text-white/75">
                Hóa đơn điện tử khởi tạo từ máy tính tiền
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
              {BANG_GIA_POS.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-1 p-5 text-center">
                  <span className="text-xs font-bold text-vnpt">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.sub}</span>
                  <span className="mt-1 text-lg font-bold text-slate-800">{p.price}</span>
                  <span className="text-[11px] text-slate-400">(đã VAT 8%)</span>
                  <Link
                    href="#dang-ky-tu-van"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-vnpt px-3 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                  >
                    Đăng ký ngay <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GIẢI PHÁP PHÙ HỢP CHO */}
        <section className="mt-16">
          <SectionTitle>Giải pháp phù hợp cho</SectionTitle>
          <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {GIAI_PHAP_PHU_HOP.map((g) => (
              <div key={g.title} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <g.icon size={24} />
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  {g.title}
                  <br />
                  {g.titleLine2}
                </p>
                <p className="text-xs text-slate-500">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TÍNH NĂNG NỔI BẬT + QUY TRÌNH */}
        <section className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle>Tính năng nổi bật</SectionTitle>
            <div className="mt-6 grid grid-cols-2 gap-5">
              {TINH_NANG_NOI_BAT.map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                    <t.icon size={22} />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Quy trình đăng ký đơn giản</SectionTitle>
            <div className="mt-6 flex items-start justify-between gap-2">
              {QUY_TRINH.map((q, i) => (
                <div key={q.label} className="flex items-start">
                  <div className="flex w-20 flex-col items-center gap-2 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                      <q.icon size={22} />
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {i + 1}. {q.label}
                    </span>
                  </div>
                  {i < QUY_TRINH.length - 1 && (
                    <ChevronRight size={16} className="mt-5 shrink-0 text-slate-300" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FORM ĐĂNG KÝ */}
        <section className="mt-16">
          <RegisterForm />
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <div className="flex items-center justify-between">
            <SectionTitle>Câu hỏi thường gặp</SectionTitle>
            <Link href="/lien-he" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi
            </Link>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              {FAQ_LEFT.map((q) => (
                <details key={q} className="group rounded-lg border border-slate-100 p-4 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-medium text-slate-700">
                    {q}
                    <ChevronDown
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-180"
                    />
                  </summary>
                </details>
              ))}
            </div>
            <div className="space-y-3">
              {FAQ_RIGHT.map((q) => (
                <details key={q} className="group rounded-lg border border-slate-100 p-4 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-medium text-slate-700">
                    {q}
                    <ChevronDown
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-180"
                    />
                  </summary>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* CTA BANNER CUỐI */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="flex flex-col items-center justify-between gap-5 rounded-2xl bg-gradient-to-br from-vnpt-dark to-vnpt-darker p-6 text-white sm:flex-row sm:p-8">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:flex">
              <FilePlus2 size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">
                Đăng ký Hóa đơn điện tử VNPT ngay hôm nay!
              </h3>
              <p className="mt-1 text-sm text-white/80">
                Giải pháp an toàn, đúng quy định, đồng hành cùng sự phát triển của doanh nghiệp.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-md border border-white/50 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-vnpt-dark transition hover:bg-slate-100"
            >
              <ZaloBadge /> Tư vấn qua Zalo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
