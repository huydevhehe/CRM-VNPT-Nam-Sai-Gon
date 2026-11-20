import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Diamond,
  Gift,
  Headset,
  Link2,
  Mail,
  Pill,
  Phone,
  PiggyBank,
  Monitor,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  User,
  UserCheck,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";

export const metadata: Metadata = {
  title: "VNPT Pharmacy — Phần mềm quản lý nhà thuốc | VNPT Nam Sài Gòn",
  description:
    "VNPT Pharmacy: quản lý thuốc, bán hàng, tồn kho và doanh thu trên một nền tảng, dễ sử dụng, an toàn và hiệu quả. Dùng thử miễn phí 15 ngày.",
};

const HERO_MOCKUP_FEATURES = [
  { icon: ShoppingCart, label: "Bán hàng" },
  { icon: Pill, label: "Quản lý thuốc" },
  { icon: Boxes, label: "Quản lý kho" },
  { icon: BarChart3, label: "Báo cáo" },
  { icon: Store, label: "Chuỗi nhà thuốc" },
  { icon: Link2, label: "Liên thông dữ liệu" },
];

const HERO_BADGES = [
  { icon: BadgeCheck, label: "Quản lý nhà thuốc toàn diện" },
  { icon: Cloud, label: "Dữ liệu an toàn trên nền tảng cloud" },
  { icon: ShieldCheck, label: "Hỗ trợ liên thông Dược Quốc gia" },
];

const LOI_ICH = [
  { icon: PiggyBank, value: "Tiết kiệm đến 70%", label: "chi phí vận hành" },
  { icon: Zap, value: "Tiết kiệm", label: "thời gian, công sức" },
  { icon: ShieldCheck, value: "Kiểm soát", label: "tồn kho chính xác" },
  { icon: TrendingUp, value: "Theo dõi doanh thu", label: "hiệu quả" },
  { icon: Cloud, value: "Quản lý dễ dàng", label: "từ xa, mọi lúc, mọi nơi" },
];

const MO_HINH = [
  {
    icon: Store,
    title: "Quầy thuốc",
    desc: "Quản lý bán hàng, tồn kho, hạn dùng đơn giản.",
  },
  {
    icon: Building2,
    title: "Nhà thuốc bán lẻ",
    desc: "Đáp ứng đầy đủ nghiệp vụ quản lý nhà thuốc.",
  },
  {
    icon: Link2,
    title: "Chuỗi nhà thuốc",
    desc: "Quản lý tập trung nhiều cửa hàng, phân quyền và báo cáo hợp nhất.",
  },
];

const BANG_GIA_PLANS = [
  {
    icon: Gift,
    name: "Dùng thử",
    price: "Miễn phí",
    unit: "",
    note: "15 ngày trải nghiệm đầy đủ tính năng",
    cta: "Đăng ký dùng thử →",
    highlight: false,
    badge: null,
  },
  {
    icon: Pill,
    name: "Pharmacy Cơ bản",
    price: "100.000đ",
    unit: "/ tháng",
    note: "3 tài khoản sử dụng",
    cta: "Đăng ký ngay →",
    highlight: true,
    badge: "Phổ biến",
  },
  {
    icon: Diamond,
    name: "Pharmacy Nâng cao",
    price: "180.000đ",
    unit: "/ tháng",
    note: "5 tài khoản sử dụng",
    cta: "Đăng ký ngay →",
    highlight: false,
    badge: null,
  },
];

const BANG_GIA_TONG_QUAN = [
  "Quản lý nhà thuốc toàn diện",
  "Dễ sử dụng, triển khai nhanh",
  "Dữ liệu an toàn, ổn định",
  "Hỗ trợ kỹ thuật tận tâm",
];

const TINH_NANG = [
  { icon: Pill, title: "Quản lý thuốc", desc: "Danh mục, giá bán, lô và hạn sử dụng." },
  { icon: Boxes, title: "Quản lý kho", desc: "Nhập – xuất, kiểm kê và theo dõi tồn kho." },
  { icon: ShoppingCart, title: "Quản lý bán hàng", desc: "Đơn thuốc, đơn hàng và giao dịch." },
  { icon: BarChart3, title: "Báo cáo thống kê", desc: "Doanh thu, hàng hóa, kết quả kinh doanh." },
  { icon: Link2, title: "Liên thông dữ liệu", desc: "Hỗ trợ kết nối với hệ thống Dược Quốc gia ( *)." },
  { icon: Building2, title: "Quản lý chuỗi", desc: "Theo dõi nhiều cửa hàng, phân quyền nhân viên." },
];

const QUY_TRINH = [
  { icon: Headset, title: "Tiếp nhận yêu cầu tư vấn" },
  { icon: Settings, title: "Tư vấn, chọn gói phù hợp" },
  { icon: Monitor, title: "Kích hoạt tài khoản & cấu hình" },
  { icon: UserCheck, title: "Hướng dẫn sử dụng & hỗ trợ" },
];

const FAQ = [
  {
    q: "VNPT Pharmacy là gì? Phù hợp với mô hình nào?",
    a: "VNPT Pharmacy là phần mềm quản lý nhà thuốc giúp quản lý thuốc, bán hàng, tồn kho và doanh thu trên một nền tảng. Phù hợp với quầy thuốc, nhà thuốc bán lẻ và chuỗi nhà thuốc.",
  },
  {
    q: "Có quản lý nhiều cửa hàng (chuỗi nhà thuốc) được không?",
    a: "Có. VNPT Pharmacy hỗ trợ quản lý tập trung nhiều cửa hàng, phân quyền nhân viên và báo cáo hợp nhất toàn chuỗi.",
  },
  {
    q: "Có quản lý hạn sử dụng thuốc không?",
    a: "Có. Phần mềm theo dõi hạn sử dụng theo từng lô thuốc, cảnh báo khi sắp hết hạn để hạn chế thất thoát.",
  },
  {
    q: "Có dùng thử phần mềm không?",
    a: "Có. Khách hàng được dùng thử miễn phí 15 ngày với đầy đủ tính năng trước khi quyết định đăng ký gói sử dụng.",
  },
  {
    q: "Có liên thông với Cơ sở dữ liệu Dược Quốc gia không?",
    a: "Có. VNPT Pharmacy hỗ trợ liên thông dữ liệu với hệ thống Dược Quốc gia theo đúng quy định hiện hành.",
  },
  {
    q: "Thời gian triển khai và hỗ trợ sử dụng như thế nào?",
    a: "Sau khi đăng ký, đội ngũ VNPT Nam Sài Gòn hỗ trợ kích hoạt tài khoản, cấu hình và hướng dẫn sử dụng trong thời gian ngắn, kèm hỗ trợ kỹ thuật 24/7.",
  },
];

export default function PharmacyPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-light via-white to-vnpt-light px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "Sản phẩm", href: "/san-pham" },
              { label: "VNPT Pharmacy" },
            ]}
          />

          <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1fr_420px_260px]">
            {/* Text + CTA */}
            <div>
              <h1 className="leading-tight text-slate-800">
                VNPT <span className="italic text-vnpt">Pharmacy</span>
              </h1>
              <p className="mt-1 text-lg font-semibold text-slate-700">
                Phần mềm quản lý nhà thuốc
              </p>
              <p className="mt-3 max-w-md text-sm text-slate-500">
                Quản lý thuốc, bán hàng, tồn kho và doanh thu trên một nền tảng, dễ sử dụng,
                an toàn và hiệu quả.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="#dang-ky-tu-van"
                  className="rounded-md bg-vnpt px-5 py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
                >
                  Đăng ký ngay →
                </Link>
                <Link
                  href="#dang-ky-tu-van"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-vnpt hover:text-vnpt"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                    Zalo
                  </span>
                  Tư vấn qua Zalo
                </Link>
              </div>
            </div>

            {/* Mockup laptop */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl bg-gradient-to-br from-vnpt-dark to-vnpt-darker p-4 shadow-xl">
                <div className="flex items-center gap-2 text-white">
                  <Pill size={18} />
                  <span className="text-sm font-bold">VNPT Pharmacy</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {HERO_MOCKUP_FEATURES.map((f) => (
                    <div
                      key={f.label}
                      className="flex flex-col items-center gap-1.5 rounded-lg bg-white/10 py-3 text-center backdrop-blur-sm"
                    >
                      <f.icon size={18} className="text-white" />
                      <span className="text-[10px] leading-tight text-white/90">
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* laptop base */}
              <div className="mx-auto h-3 w-[88%] rounded-b-xl bg-slate-300" />
              <div className="mx-auto h-1.5 w-[55%] rounded-b-md bg-slate-400" />

              {/* avatar decoration */}
              <div className="absolute -right-4 -top-6 hidden h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-vnpt-light sm:flex">
                <User size={40} className="text-vnpt" />
              </div>
              {/* pill decoration */}
              <div className="absolute -bottom-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg">
                <Pill size={22} className="text-vnpt-accent" />
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-row flex-wrap gap-3 lg:flex-col">
              {HERO_BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-md"
                >
                  <b.icon size={16} className="shrink-0 text-emerald-500" />
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* LỢI ÍCH NỔI BẬT */}
        <section>
          <h2 className="flex items-center gap-2 text-slate-800">
            <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
            Lợi ích nổi bật khi sử dụng VNPT Pharmacy
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {LOI_ICH.map((l) => (
              <div
                key={l.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-5 text-center shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <l.icon size={22} />
                </div>
                <span className="text-sm font-bold text-slate-800">{l.value}</span>
                <span className="text-xs text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* GIẢI PHÁP PHÙ HỢP CHO NHIỀU MÔ HÌNH */}
        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-slate-800">
            <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
            Giải pháp phù hợp cho nhiều mô hình
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {MO_HINH.map((m) => (
              <div
                key={m.title}
                className="flex items-center gap-4 rounded-xl border border-slate-100 p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
                  <m.icon size={28} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{m.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BẢNG GIÁ */}
        <section id="bang-gia" className="mt-14 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-slate-800">
            <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
            Bảng giá VNPT Pharmacy
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {/* Tổng quan */}
            <div className="rounded-xl bg-gradient-to-br from-vnpt-dark to-vnpt-darker p-6 text-white">
              <Monitor size={28} />
              <h3 className="mt-3 text-lg font-bold">VNPT Pharmacy</h3>
              <ul className="mt-4 space-y-2.5">
                {BANG_GIA_TONG_QUAN.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-white/90">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {BANG_GIA_PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-xl border p-6 text-center shadow-sm ${
                  p.highlight ? "border-vnpt bg-vnpt-light" : "border-slate-100"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-white">
                    ★ {p.badge}
                  </span>
                )}
                <div className="mx-auto flex items-center gap-2 text-sm font-bold text-slate-800">
                  <p.icon size={18} className="text-vnpt" />
                  {p.name}
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-vnpt">{p.price}</span>
                  {p.unit && <span className="text-sm text-slate-500">{p.unit}</span>}
                </div>
                <p className="mt-2 text-xs text-slate-500">{p.note}</p>
                <Link
                  href="#dang-ky-tu-van"
                  className="mt-5 block rounded-md bg-vnpt py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <ShieldCheck size={14} className="shrink-0 text-vnpt" />
            Lưu ý: Bảng giá tham khảo, có thể thay đổi theo chương trình và nhu cầu thực tế. Vui
            lòng liên hệ để nhận báo giá chi tiết.
          </p>
        </section>

        {/* TÍNH NĂNG NỔI BẬT */}
        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-slate-800">
            <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
            Tính năng nổi bật của VNPT Pharmacy
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TINH_NANG.map((t) => (
              <div
                key={t.title}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-5 text-center shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <t.icon size={22} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">{t.title}</h3>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* QUY TRÌNH ĐĂNG KÝ & TRIỂN KHAI */}
        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-slate-800">
            <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
            Quy trình đăng ký & triển khai
          </h2>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-y-6">
            {QUY_TRINH.map((q, i) => (
              <div key={q.title} className="flex items-start">
                <div className="flex w-28 flex-col items-center gap-2 text-center sm:w-36">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light">
                    <q.icon size={24} className="text-vnpt" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-vnpt text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
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

        {/* ĐĂNG KÝ TƯ VẤN */}
        <section id="dang-ky-tu-van" className="mt-14 scroll-mt-24">
          <div className="rounded-xl border border-slate-100 bg-vnpt-light p-6 shadow-sm sm:p-8">
            <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
              <div className="flex items-center gap-4 lg:w-72 lg:shrink-0">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                  <Headset size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Đăng ký tư vấn VNPT Pharmacy
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Nhận báo giá và tư vấn giải pháp phù hợp cho nhà thuốc của bạn.
                  </p>
                </div>
              </div>

              <form className="grid w-full flex-1 gap-3 sm:grid-cols-3">
                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    required
                    name="hoTen"
                    placeholder="Họ và tên *"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
                  />
                </div>
                <div className="relative">
                  <Phone
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    required
                    name="soDienThoai"
                    placeholder="Số điện thoại *"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
                  />
                </div>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email của bạn"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-md bg-vnpt py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark sm:col-span-3"
                >
                  Gửi yêu cầu tư vấn <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-14 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-slate-800">
              <span className="h-5 w-1 rounded bg-vnpt" aria-hidden />
              Câu hỏi thường gặp (FAQ)
            </h2>
            <Link href="/lien-he" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-lg border border-slate-100 p-4 open:shadow-sm"
              >
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
      </div>

      {/* CTA DƯỚI CÙNG */}
      <div className="bg-gradient-to-r from-vnpt-darker to-vnpt px-6 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Store size={26} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Triển khai VNPT Pharmacy ngay hôm nay!</h3>
              <p className="mt-1 text-sm text-white/80">
                Giải pháp quản lý nhà thuốc hiện đại – An toàn – Hiệu quả – Dễ sử dụng.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt hover:bg-white/90"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <Link
              href="#dang-ky-tu-van"
              className="flex items-center gap-2 rounded-full border border-white/50 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
                Zalo
              </span>
              Tư vấn qua Zalo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
