import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FolderCheck,
  Headset,
  Infinity as InfinityIcon,
  Laptop2,
  Layers,
  Leaf,
  Mail,
  MessageCircle,
  Phone,
  PiggyBank,
  Rocket,
  Search,
  Send,
  Settings2,
  Shield,
  User,
  UserCog,
  Users,
  UserPlus,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";

export const metadata: Metadata = {
  title: "VNPT-BHXH — Bảo hiểm xã hội điện tử — VNPT Nam Sài Gòn",
  description:
    "VNPT-BHXH: giải pháp hỗ trợ doanh nghiệp kê khai, ký số và nộp hồ sơ BHXH, BHYT, BHTN trực tuyến. Tiết kiệm đến 70% chi phí, kết nối trực tiếp cơ quan BHXH.",
};

const LOI_ICH = [
  { icon: PiggyBank, label: "Tiết kiệm đến 70% chi phí" },
  { icon: Zap, label: "Kê khai nhanh chóng, chính xác" },
  { icon: BadgeCheck, label: "Giao dịch trực tuyến 24/7" },
  { icon: Layers, label: "Quản lý, tra cứu hồ sơ tập trung" },
  { icon: Leaf, label: "Giảm thủ tục giấy tờ, thuận tiện cho kế toán" },
];

const NGHIEP_VU = [
  { icon: Users, label: "Đăng ký tham gia BHXH, BHYT, BHTN" },
  { icon: UserPlus, label: "Báo tăng, báo giảm lao động" },
  { icon: UserCog, label: "Điều chỉnh thông tin người tham gia" },
  { icon: FolderCheck, label: "Lập, ký số và gửi hồ sơ điện tử" },
  { icon: Search, label: "Tra cứu, theo dõi trạng thái hồ sơ" },
  { icon: Database, label: "Lưu trữ hồ sơ an toàn, đầy đủ" },
];

type PackageTier = {
  icon: typeof Users;
  name: string;
  range: string;
  badge?: string;
  prices: { term: string; price: string }[];
};

const GOI_PHAN_MEM: PackageTier[] = [
  {
    icon: Users,
    name: "VAN 10",
    range: "1 – 10 lao động",
    prices: [
      { term: "18 tháng", price: "220.000đ" },
      { term: "33 tháng", price: "352.000đ" },
      { term: "48 tháng", price: "484.000đ" },
    ],
  },
  {
    icon: Users,
    name: "VAN 100",
    range: "1 – 100 lao động",
    badge: "Phổ biến",
    prices: [
      { term: "18 tháng", price: "550.000đ" },
      { term: "33 tháng", price: "880.000đ" },
      { term: "48 tháng", price: "1.210.000đ" },
    ],
  },
  {
    icon: Users,
    name: "VAN 1000",
    range: "1 – 1.000 lao động",
    prices: [
      { term: "18 tháng", price: "880.000đ" },
      { term: "33 tháng", price: "1.408.000đ" },
      { term: "48 tháng", price: "1.936.000đ" },
    ],
  },
  {
    icon: InfinityIcon,
    name: "VAN MAX",
    range: "Không giới hạn lao động",
    prices: [
      { term: "18 tháng", price: "1.210.000đ" },
      { term: "33 tháng", price: "1.936.000đ" },
      { term: "48 tháng", price: "2.662.000đ" },
    ],
  },
];

const GOI_COMBO: PackageTier[] = [
  {
    icon: Users,
    name: "VAN 10 + CKS",
    range: "1 – 10 lao động",
    prices: [
      { term: "18 tháng", price: "1.050.000đ" },
      { term: "33 tháng", price: "1.320.000đ" },
      { term: "48 tháng", price: "1.590.000đ" },
    ],
  },
  {
    icon: Users,
    name: "VAN 100 + CKS",
    range: "1 – 100 lao động",
    badge: "Ưu đãi",
    prices: [
      { term: "18 tháng", price: "1.380.000đ" },
      { term: "33 tháng", price: "1.760.000đ" },
      { term: "48 tháng", price: "2.140.000đ" },
    ],
  },
  {
    icon: Users,
    name: "VAN 1000 + CKS",
    range: "1 – 1.000 lao động",
    prices: [
      { term: "18 tháng", price: "1.710.000đ" },
      { term: "33 tháng", price: "2.310.000đ" },
      { term: "48 tháng", price: "2.910.000đ" },
    ],
  },
  {
    icon: InfinityIcon,
    name: "VAN MAX + CKS",
    range: "Không giới hạn lao động",
    prices: [
      { term: "18 tháng", price: "2.040.000đ" },
      { term: "33 tháng", price: "2.860.000đ" },
      { term: "48 tháng", price: "3.680.000đ" },
    ],
  },
];

const TINH_NANG_NOI_BAT = [
  { icon: Laptop2, label: "Kê khai hồ sơ điện tử" },
  { icon: FolderCheck, label: "Ký số và nộp hồ sơ trực tuyến" },
  { icon: Users, label: "Quản lý lao động và hồ sơ" },
  { icon: Bell, label: "Cảnh báo hồ sơ cần xử lý" },
  { icon: BarChart3, label: "Báo cáo, tra cứu linh hoạt" },
];

const QUY_TRINH = [
  { icon: MessageCircle, label: "Tiếp nhận yêu cầu" },
  { icon: Settings2, label: "Tư vấn, chọn gói" },
  { icon: Rocket, label: "Kích hoạt và hướng dẫn" },
  { icon: CheckCircle2, label: "Sử dụng & hỗ trợ kỹ thuật" },
];

const FAQ = [
  {
    q: "VNPT-BHXH là gì? Có phải là cơ quan BHXH không?",
    a: "VNPT-BHXH là phần mềm do VNPT phát triển, hỗ trợ doanh nghiệp kê khai, ký số và nộp hồ sơ BHXH, BHYT, BHTN trực tuyến. Đây không phải là cơ quan BHXH mà là đơn vị trung gian cung cấp dịch vụ IVAN kết nối với cơ quan BHXH.",
  },
  {
    q: "Doanh nghiệp đã có chữ ký số có dùng được không?",
    a: "Có. Doanh nghiệp đã có chữ ký số hợp lệ có thể dùng ngay với gói phần mềm VNPT-BHXH. Nếu chưa có, có thể chọn gói Combo VNPT-BHXH + Chữ ký số VNPT-CA để triển khai trọn gói.",
  },
  {
    q: "Nên chọn gói VAN 10, VAN 100, VAN 1000 hay VAN MAX?",
    a: "Lựa chọn theo quy mô lao động của doanh nghiệp: VAN 10 phù hợp doanh nghiệp nhỏ dưới 10 lao động, VAN 100/VAN 1000 cho doanh nghiệp vừa, VAN MAX cho doanh nghiệp không giới hạn số lượng lao động.",
  },
  {
    q: "Thời hạn gói dịch vụ là bao lâu?",
    a: "VNPT-BHXH cung cấp các gói thời hạn 18 tháng, 33 tháng và 48 tháng, giúp doanh nghiệp chủ động lựa chọn theo nhu cầu sử dụng.",
  },
  {
    q: "Gia hạn dịch vụ VNPT-BHXH như thế nào?",
    a: "Trước khi hết hạn, đội ngũ VNPT Nam Sài Gòn sẽ chủ động liên hệ hỗ trợ gia hạn, đảm bảo doanh nghiệp không gián đoạn trong quá trình kê khai và nộp hồ sơ.",
  },
  {
    q: "VNPT có hỗ trợ cài đặt và hướng dẫn sử dụng không?",
    a: "Có. Đội ngũ kỹ thuật VNPT Nam Sài Gòn hỗ trợ cài đặt, hướng dẫn sử dụng và đồng hành kỹ thuật 24/7 trong suốt quá trình sử dụng.",
  },
];

function PackageCard({ tier, ctaLabel }: { tier: PackageTier; ctaLabel: string }) {
  const Icon = tier.icon;
  return (
    <div className="relative flex flex-col overflow-visible rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      {tier.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-slate-800 shadow">
          {tier.badge}
        </span>
      )}
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-vnpt" />
        <span className="font-bold text-slate-800">{tier.name}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{tier.range}</p>

      <div className="mt-4 space-y-2">
        {tier.prices.map((p) => (
          <div key={p.term} className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{p.term}</span>
            <span className="font-bold text-vnpt">{p.price}</span>
          </div>
        ))}
      </div>

      <Link
        href="#dang-ky-tu-van"
        className="mt-4 block rounded-full bg-vnpt py-2.5 text-center text-sm font-semibold text-white transition hover:bg-vnpt-dark"
      >
        Đăng ký ngay →
      </Link>
    </div>
  );
}

export default function BhxhPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Breadcrumb
            variant="light"
            items={[{ label: "Trang chủ", href: "/" }, { label: "VNPT-BHXH" }]}
          />

          <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative z-10 text-white">
              <h1 className="leading-tight">VNPT-BHXH</h1>
              <p className="mt-1 text-2xl font-bold text-vnpt-accent">
                Bảo hiểm xã hội điện tử
              </p>
              <p className="mt-4 max-w-xl text-white/85">
                Giải pháp hỗ trợ doanh nghiệp kê khai, ký số và nộp hồ sơ BHXH, BHYT, BHTN
                trực tuyến.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#dang-ky-tu-van"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-vnpt hover:bg-white/90"
                >
                  Đăng ký ngay →
                </Link>
                <Link
                  href="#dang-ky-tu-van"
                  className="flex items-center gap-2 rounded-full border border-white/60 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-400 text-[10px] font-bold text-white">
                    Z
                  </span>
                  Tư vấn qua Zalo
                </Link>
              </div>
            </div>

            {/* Minh họa: màn hình kê khai + checklist + badge hỗ trợ */}
            <div className="relative hidden lg:block">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Laptop2 size={18} className="text-white" />
                  <span className="text-sm font-semibold text-white">VNPT-BHXH</span>
                </div>
                <ul className="mt-4 space-y-3">
                  {[
                    "Kê khai hồ sơ BHXH điện tử",
                    "Báo tăng, báo giảm lao động",
                    "Quản lý và tra cứu hồ sơ",
                    "Kết nối cơ quan BHXH",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/90">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-vnpt-darker">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="absolute -right-4 -top-6 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
                <Shield size={28} className="text-vnpt" />
              </div>
              <div className="absolute -bottom-5 right-8 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg">
                <Headset size={18} className="text-vnpt" />
                <span className="text-xs font-semibold text-slate-700">Hỗ trợ 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* LỢI ÍCH */}
        <section>
          <h2 className="text-slate-800">Lợi ích khi sử dụng VNPT-BHXH</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {LOI_ICH.map((d) => (
              <div
                key={d.label}
                className="flex flex-col items-center gap-3 rounded-xl border border-slate-100 p-5 text-center shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light">
                  <d.icon size={24} className="text-vnpt" />
                </div>
                <span className="text-sm font-medium text-slate-700">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* NGHIỆP VỤ HỖ TRỢ */}
        <section className="mt-14">
          <h2 className="text-slate-800">Nghiệp vụ hỗ trợ</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {NGHIEP_VU.map((d) => (
              <div
                key={d.label}
                className="flex flex-col items-center gap-3 rounded-xl border border-slate-100 p-5 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light">
                  <d.icon size={22} className="text-vnpt" />
                </div>
                <span className="text-xs font-medium text-slate-700">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BẢNG GIÁ PHẦN MỀM */}
        <section id="bang-gia" className="mt-14 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-slate-800">Bảng giá Phần mềm VNPT-BHXH</h2>
            <p className="text-xs text-slate-400">
              Gói dịch vụ phần mềm giao dịch BHXH điện tử (chưa bao gồm chữ ký số)
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-slate-100 bg-vnpt-light p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt text-white">
                <Laptop2 size={22} />
              </div>
              <h3 className="mt-4 font-bold text-slate-800">VNPT-BHXH</h3>
              <p className="mt-1 text-sm text-slate-600">
                Phần mềm kê khai bảo hiểm xã hội điện tử
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Kê khai và nộp hồ sơ BHXH",
                  "Quản lý lao động, hồ sơ",
                  "Kết nối cơ quan BHXH",
                  "Phù hợp mọi quy mô",
                ].map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-vnpt" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
              {GOI_PHAN_MEM.map((tier) => (
                <PackageCard key={tier.name} tier={tier} ctaLabel="Đăng ký ngay" />
              ))}
            </div>
          </div>
        </section>

        {/* BẢNG GIÁ COMBO */}
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-slate-800">
              Bảng giá Combo VNPT-BHXH + Chữ ký số VNPT-CA
            </h2>
            <p className="text-xs text-slate-400">
              Gói trọn bộ Phần mềm VNPT-BHXH và Chữ ký số VNPT-CA
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-slate-100 bg-vnpt-light p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt text-white">
                <FolderCheck size={22} />
              </div>
              <h3 className="mt-4 font-bold text-slate-800">
                Combo VNPT-BHXH + Chữ ký số
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Đầy đủ phần mềm và CKS
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Kê khai – ký số – nộp hồ sơ",
                  "Triển khai nhanh, đồng bộ",
                  "Hỗ trợ kỹ thuật trọn gói",
                ].map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-vnpt" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
              {GOI_COMBO.map((tier) => (
                <PackageCard key={tier.name} tier={tier} ctaLabel="Đăng ký ngay" />
              ))}
            </div>
          </div>
        </section>

        {/* TÍNH NĂNG NỔI BẬT + QUY TRÌNH */}
        <section className="mt-14 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-slate-800">Tính năng nổi bật</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {TINH_NANG_NOI_BAT.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center"
                >
                  <t.icon size={24} className="text-vnpt" />
                  <span className="text-xs font-medium text-slate-700">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-slate-800">Quy trình đăng ký &amp; triển khai</h2>
            <div className="mt-6 flex flex-wrap items-start gap-y-6">
              {QUY_TRINH.map((q, i) => (
                <div key={q.label} className="flex items-start">
                  <div className="flex w-20 flex-col items-center gap-2 text-center sm:w-24">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light">
                      <q.icon size={20} className="text-vnpt" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{q.label}</span>
                  </div>
                  {i < QUY_TRINH.length - 1 && (
                    <ChevronRight
                      size={18}
                      className="mt-5 hidden shrink-0 text-slate-300 sm:block"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ĐĂNG KÝ TƯ VẤN */}
        <section id="dang-ky-tu-van" className="mt-14 scroll-mt-24">
          <div className="grid items-center gap-6 rounded-2xl bg-vnpt-light p-6 lg:grid-cols-[1fr_1.3fr] lg:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vnpt text-white">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  Đăng ký tư vấn VNPT-BHXH
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Nhận báo giá và tư vấn giải pháp phù hợp cho đơn vị của bạn.
                </p>
              </div>
            </div>

            <BhxhLeadForm />
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-slate-800">Câu hỏi thường gặp</h2>
            <Link href="#faq" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi →
            </Link>
          </div>
          <div id="faq" className="mt-6 grid gap-3 sm:grid-cols-2">
            {FAQ.map((f, i) => (
              <details
                key={f.q}
                className="group rounded-lg border border-slate-100 p-4 open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-semibold text-slate-800">
                  <span>
                    {i + 1}. {f.q}
                  </span>
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

      {/* CTA BOTTOM */}
      <div className="bg-vnpt-dark">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
              <FolderCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Đăng ký VNPT-BHXH ngay hôm nay!</h3>
              <p className="text-sm text-white/80">
                Kê khai nhanh chóng – Đúng quy định – Đồng hành cùng doanh nghiệp.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-vnpt-dark hover:bg-white/90"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <Link
              href="#dang-ky-tu-van"
              className="flex items-center gap-2 rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-400 text-[10px] font-bold text-white">
                Z
              </span>
              Tư vấn qua Zalo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function BhxhLeadForm() {
  return (
    <form className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative">
          <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            required
            name="hoTen"
            placeholder="Họ và tên *"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
          />
        </div>
        <div className="relative">
          <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            required
            name="soDienThoai"
            placeholder="Số điện thoại *"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
          />
        </div>
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            required
            name="email"
            type="email"
            placeholder="Email *"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
          />
        </div>
      </div>
      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-full bg-vnpt px-6 py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark sm:w-fit"
      >
        Gửi yêu cầu tư vấn <Send size={16} />
      </button>
    </form>
  );
}
