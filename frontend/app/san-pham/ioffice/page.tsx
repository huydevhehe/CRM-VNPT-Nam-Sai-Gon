import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileInput,
  FileOutput,
  FileSignature,
  GraduationCap,
  Landmark,
  Laptop,
  Leaf,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  PiggyBank,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";

export const metadata: Metadata = {
  title: "VNPT iOffice - Quản lý văn bản & Điều hành — VNPT Nam Sài Gòn",
  description:
    "VNPT iOffice - Giải pháp văn phòng điện tử giúp số hóa quy trình, quản lý văn bản, điều hành công việc và kết nối tổ chức hiệu quả.",
};

const LOI_ICH = [
  { icon: PiggyBank, label: "Tiết kiệm đến 70% chi phí vận hành" },
  { icon: Zap, label: "Xử lý văn bản nhanh chóng" },
  { icon: ShieldCheck, label: "Quản lý tập trung, minh bạch" },
  { icon: Users, label: "Phối hợp công việc hiệu quả" },
  { icon: Leaf, label: "Góp phần chuyển đổi số tổ chức" },
];

const GIAI_PHAP_CHO = [
  {
    icon: GraduationCap,
    title: "Trường học",
    desc: "Quản lý văn bản, điều hành công việc và hồ sơ nhà trường.",
  },
  {
    icon: Landmark,
    title: "Cơ quan, Phường xã",
    desc: "Số hóa văn bản, điều hành, liên thông theo quy định.",
  },
  {
    icon: Building2,
    title: "Doanh nghiệp",
    desc: "Quản trị văn bản, giao việc, hồ sơ, phê duyệt và ký số nội bộ.",
  },
];

const GOI_CUOC = [
  {
    code: "iOffice 1",
    range: "1 – 10 tài khoản",
    price: "440.000đ",
    yearPrice: "≈ 5.280.000đ / năm",
    popular: false,
  },
  {
    code: "iOffice 2.1",
    range: "11 – 20 tài khoản",
    price: "748.000đ",
    yearPrice: "≈ 8.976.000đ / năm",
    popular: true,
  },
  {
    code: "iOffice 2.2",
    range: "21 – 30 tài khoản",
    price: "1.056.000đ",
    yearPrice: "≈ 12.672.000đ / năm",
    popular: false,
  },
  {
    code: "iOffice 2.3",
    range: "31 – 40 tài khoản",
    price: "1.364.000đ",
    yearPrice: "≈ 12.368.000đ / năm",
    popular: false,
  },
];

const GOI_FEATURES = [
  "Quản lý văn bản",
  "Điều hành công việc",
  "Ký số và phát hành",
  "Lưu trữ an toàn",
  "Làm việc trên Web & Mobile",
];

const TINH_NANG = [
  {
    icon: FileInput,
    title: "Quản lý văn bản đến/đi",
    desc: "Tiếp nhận, trình ký, phát hành và lưu trữ văn bản điện tử.",
  },
  {
    icon: Briefcase,
    title: "Điều hành công việc",
    desc: "Giao việc, theo dõi tiến độ, đánh giá hiệu quả.",
  },
  {
    icon: Calendar,
    title: "Lịch công tác & lịch họp",
    desc: "Tổ chức, quản lý lịch làm việc tập trung cho toàn đơn vị.",
  },
  {
    icon: FileSignature,
    title: "Ký số & phát hành văn bản",
    desc: "Tích hợp chữ ký số, phê duyệt và ban hành văn bản điện tử.",
  },
  {
    icon: Share2,
    title: "Liên thông văn bản",
    desc: "Kết nối, trao đổi văn bản giữa các đơn vị theo quy định.",
  },
  {
    icon: Smartphone,
    title: "Làm việc mọi lúc, mọi nơi",
    desc: "Sử dụng trên máy tính, điện thoại, máy tính bảng (Web & Mobile).",
  },
];

const QUY_TRINH = [
  { icon: MessageCircle, label: "Tiếp nhận yêu cầu tư vấn" },
  { icon: Users, label: "Tư vấn, chọn gói phù hợp" },
  { icon: Laptop, label: "Khởi tạo hệ thống & cấu hình" },
  { icon: Users, label: "Hướng dẫn sử dụng & vận hành" },
];

const FAQ = [
  {
    q: "VNPT iOffice là gì? Phù hợp với đơn vị nào?",
    a: "VNPT iOffice là nền tảng văn phòng điện tử giúp số hóa quy trình quản lý văn bản, điều hành công việc. Phù hợp với trường học, cơ quan, phường xã và doanh nghiệp mọi quy mô.",
  },
  {
    q: "Tôi có thể mua thêm tài khoản sau này không?",
    a: "Có. Bạn có thể nâng cấp lên gói nhiều tài khoản hơn bất cứ lúc nào, hệ thống hỗ trợ mở rộng linh hoạt theo nhu cầu.",
  },
  {
    q: "Có sử dụng trên điện thoại được không?",
    a: "Có. VNPT iOffice hoạt động trên cả Web và Mobile (iOS, Android), cho phép xử lý công việc mọi lúc, mọi nơi.",
  },
  {
    q: "Thời gian triển khai hệ thống là bao lâu?",
    a: "Thời gian khởi tạo và bàn giao thường chỉ từ 1-3 ngày làm việc sau khi hoàn tất đăng ký và tư vấn.",
  },
  {
    q: "VNPT iOffice có hỗ trợ ký số không?",
    a: "Có. Hệ thống tích hợp sẵn chữ ký số, hỗ trợ phê duyệt và ban hành văn bản điện tử đúng quy định.",
  },
  {
    q: "Có hỗ trợ đào tạo và hướng dẫn sử dụng không?",
    a: "Có. Đội ngũ VNPT Nam Sài Gòn hỗ trợ đào tạo, hướng dẫn sử dụng và đồng hành trong suốt quá trình vận hành.",
  },
];

export default function IOfficePage() {
  return (
    <div>
      {/* BREADCRUMB */}
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Breadcrumb
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "VNPT iOffice" },
            ]}
          />
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 text-white">
              <h1>
                <span className="text-white">VNPT </span>
                <span className="italic text-sky-300">iOffice</span>
              </h1>
              <p className="mt-2 text-2xl font-bold text-white">
                Quản lý văn bản &amp; Điều hành
              </p>
              <p className="mt-4 max-w-lg text-white/85">
                Giải pháp văn phòng điện tử giúp số hóa quy trình, quản lý văn bản, điều
                hành công việc và kết nối tổ chức hiệu quả.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/lien-he"
                  className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-vnpt-dark shadow-lg transition hover:bg-white/90"
                >
                  Đăng ký ngay →
                </Link>
                <a
                  href="https://zalo.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <MessageCircle size={18} /> Tư vấn qua Zalo
                </a>
              </div>
            </div>

            {/* MOCKUP */}
            <div className="relative hidden lg:block">
              <div className="relative mx-auto max-w-md">
                <div className="rounded-2xl border border-white/10 bg-white/95 p-4 shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 flex items-center gap-1.5 text-xs font-bold text-vnpt">
                      <MonitorSmartphone size={14} /> VNPT iOffice
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { icon: FileInput, label: "Văn bản đến" },
                      { icon: FileOutput, label: "Văn bản đi" },
                      { icon: Send, label: "Giao việc" },
                      { icon: Calendar, label: "Lịch công tác" },
                      { icon: Archive, label: "Hồ sơ lưu trữ" },
                      { icon: BarChart3, label: "Báo cáo" },
                    ].map((it) => (
                      <div
                        key={it.label}
                        className="flex flex-col items-center gap-1.5 rounded-lg bg-vnpt-light p-3 text-center"
                      >
                        <it.icon size={20} className="text-vnpt" />
                        <span className="text-[11px] font-medium text-slate-600">
                          {it.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-6 w-28 rounded-2xl border border-white/10 bg-vnpt-darker p-3 shadow-2xl">
                  <div className="flex flex-col items-center gap-1 rounded-lg bg-white/10 py-4 text-center">
                    <MonitorSmartphone size={22} className="text-white" />
                    <span className="text-[11px] font-bold leading-tight text-white">
                      VNPT
                      <br />
                      iOffice
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* LOI ICH */}
        <section>
          <h2 className="text-slate-800">Lợi ích nổi bật khi sử dụng VNPT iOffice</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {LOI_ICH.map((l) => (
              <div
                key={l.label}
                className="flex flex-col items-center gap-3 rounded-xl border border-slate-100 p-5 text-center shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light">
                  <l.icon size={22} className="text-vnpt" />
                </div>
                <span className="text-sm font-medium text-slate-700">{l.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* GIAI PHAP PHU HOP CHO */}
        <section className="mt-14">
          <h2 className="text-slate-800">Giải pháp phù hợp cho</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {GIAI_PHAP_CHO.map((g) => (
              <div
                key={g.title}
                className="overflow-hidden rounded-xl border border-slate-100 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-vnpt-light to-vnpt/20">
                  <g.icon size={40} className="text-vnpt/70" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <g.icon size={18} className="text-vnpt" />
                    <h3 className="text-slate-800">{g.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BANG GIA */}
        <section id="bang-gia" className="mt-14 scroll-mt-24">
          <h2 className="text-slate-800">Bảng giá VNPT iOffice</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-[220px_repeat(4,1fr)]">
            <div className="rounded-xl bg-vnpt-darker p-5 text-white">
              <MonitorSmartphone size={28} />
              <h3 className="mt-3 text-base font-bold text-white">VNPT iOffice</h3>
              <ul className="mt-4 space-y-2.5">
                {GOI_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/85">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {GOI_CUOC.map((g) => (
              <div
                key={g.code}
                className={`relative flex flex-col rounded-xl border p-5 ${
                  g.popular
                    ? "border-2 border-vnpt shadow-lg"
                    : "border-slate-100 shadow-sm"
                }`}
              >
                {g.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-slate-800">
                    Phổ biến
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-vnpt" />
                  <span className="font-bold text-slate-800">{g.code}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{g.range}</p>
                <p className="mt-4">
                  <span className="text-2xl font-extrabold text-vnpt">{g.price}</span>
                  <span className="text-sm text-slate-500"> / tháng</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">({g.yearPrice})</p>
                <Link
                  href="/lien-he"
                  className={`mt-5 inline-flex items-center justify-center gap-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                    g.popular
                      ? "bg-vnpt text-white hover:bg-vnpt-dark"
                      : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                  }`}
                >
                  Đăng ký ngay →
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Lưu ý: Bảng giá tham khảo, có thể thay đổi theo nhu cầu thực tế, số lượng tài
            khoản và phạm vi triển khai. Vui lòng liên hệ để nhận báo giá chi tiết.
          </p>
        </section>

        {/* TINH NANG */}
        <section className="mt-14">
          <h2 className="text-slate-800">Tính năng nổi bật của VNPT iOffice</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TINH_NANG.map((t) => (
              <div
                key={t.title}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center shadow-sm transition hover:shadow-md"
              >
                <t.icon size={26} className="text-vnpt" />
                <h3 className="text-sm font-bold text-slate-800">{t.title}</h3>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* QUY TRINH */}
        <section className="mt-14">
          <h2 className="text-slate-800">Quy trình đăng ký &amp; triển khai</h2>
          <div className="mt-8 grid grid-cols-2 gap-y-8 sm:grid-cols-4">
            {QUY_TRINH.map((q, i) => (
              <div key={q.label} className="relative flex flex-col items-center gap-2 text-center">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light">
                  <q.icon size={24} className="text-vnpt" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-800">
                    {i + 1}
                  </span>
                </div>
                <span className="max-w-[9rem] text-xs font-medium text-slate-700">
                  {q.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* DANG KY TU VAN */}
        <section className="mt-14 overflow-hidden rounded-2xl border border-slate-100 bg-vnpt-light">
          <div className="grid items-center gap-8 p-8 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <h2 className="text-slate-800">Đăng ký tư vấn VNPT iOffice</h2>
              <p className="mt-2 text-sm text-slate-600">
                Nhận báo giá và tư vấn giải pháp phù hợp cho đơn vị của bạn.
              </p>
            </div>

            <form className="grid gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  required
                  name="hoTen"
                  placeholder="Nhập họ và tên"
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
                  placeholder="Nhập số điện thoại"
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
                  placeholder="Nhập email của bạn"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-lg bg-vnpt py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark sm:col-span-3"
              >
                <Send size={16} /> Gửi yêu cầu tư vấn
              </button>
            </form>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-14 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-800">Câu hỏi thường gặp (FAQ)</h2>
            <Link href="#faq" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

      {/* CTA BAR */}
      <section className="bg-vnpt-darker">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
              <MonitorSmartphone size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Triển khai VNPT iOffice ngay hôm nay!
              </h3>
              <p className="text-sm text-white/80">
                Số hóa văn bản – Điều hành hiệu quả – Nâng cao năng suất tổ chức.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt-dark hover:bg-white/90"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <MessageCircle size={16} /> Tư vấn qua Zalo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
