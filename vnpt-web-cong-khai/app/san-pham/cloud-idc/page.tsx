import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Database,
  FileCheck2,
  Globe,
  HardDrive,
  Headset,
  Layers,
  Link2,
  Lock,
  MessageCircle,
  Network,
  Phone,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import FaqAccordion from "./FaqAccordion";
import CloudLeadForm from "./CloudLeadForm";

export const metadata: Metadata = {
  title: "VNPT Smart Cloud — VNPT Nam Sài Gòn",
};

const HERO_BADGES = [
  { icon: CheckCircle2, label: "Hạ tầng Data Center hiện đại" },
  { icon: CheckCircle2, label: "Bảo mật, an toàn dữ liệu" },
  { icon: CheckCircle2, label: "Sẵn sàng mở rộng linh hoạt" },
  { icon: CheckCircle2, label: "Hỗ trợ kỹ thuật 24/7" },
];

const HE_SINH_THAI = [
  { icon: Server, title: "Cloud Server", desc: "Máy chủ ảo linh hoạt, hiệu năng cao" },
  { icon: Layers, title: "Cloud Storage", desc: "Lưu trữ dữ liệu an toàn, quy mô lớn" },
  { icon: RefreshCw, title: "Cloud Backup", desc: "Sao lưu, khôi phục dữ liệu nhanh chóng" },
  { icon: Lock, title: "Private Cloud / VPC", desc: "Hạ tầng Cloud riêng, kiểm soát toàn diện" },
  { icon: Database, title: "Cloud Database", desc: "Cơ sở dữ liệu ổn định, bảo mật cao" },
  { icon: Cpu, title: "Cloud GPU", desc: "Xử lý AI, đồ họa, tính toán chuyên sâu" },
];

type CloudServerPlan = {
  name: string;
  popular?: boolean;
  specs: string[];
  price: string;
};

const CLOUD_SERVER_PLANS: CloudServerPlan[] = [
  { name: "SMC 4", specs: ["4 vCPU", "4 GB RAM", "40 GB SSD NVMe"], price: "549.000đ" },
  { name: "SMC 5", popular: true, specs: ["4 vCPU", "8 GB RAM", "40 GB SSD NVMe"], price: "549.000đ" },
  { name: "SMC 7", specs: ["8 vCPU", "8 GB RAM", "80 GB SSD NVMe"], price: "1.120.000đ" },
  { name: "SMC 8", specs: ["8 vCPU", "16 GB RAM", "100 GB SSD NVMe"], price: "1.660.000đ" },
];

const CLOUD_STORAGE_TAGS = [
  { icon: Layers, label: "Dung lượng linh hoạt" },
  { icon: ShieldCheck, label: "Bảo mật đa lớp" },
  { icon: Globe, label: "Truy cập mọi nơi" },
];

const CLOUD_BACKUP_TAGS = [
  { icon: ClipboardList, label: "Sao lưu định kỳ" },
  { icon: RefreshCw, label: "Khôi phục nhanh chóng" },
  { icon: ShieldCheck, label: "An toàn & đáng tin cậy" },
];

const KET_NOI_HA_TANG = [
  {
    icon: Network,
    title: "MetroNet",
    desc: "Kết nối mạng nội bộ giữa các địa điểm trong cùng khu vực đô thị.",
  },
  {
    icon: Globe,
    title: "MegaWAN",
    desc: "Mạng riêng doanh nghiệp (MPLS VPN), kết nối nhiều chi nhánh toàn quốc.",
  },
  {
    icon: Link2,
    title: "Leased Line",
    desc: "Đường truyền Internet chuyên biệt, băng thông lớn, ổn định và an toàn.",
  },
];

const VI_SAO = [
  { icon: Shield, title: "Hạ tầng Data Center", sub: "chuẩn quốc tế" },
  { icon: Zap, title: "Hiệu năng cao,", sub: "ổn định (SLA)" },
  { icon: Layers, title: "Linh hoạt mở rộng,", sub: "tối ưu chi phí" },
  { icon: Headset, title: "Hỗ trợ kỹ thuật", sub: "24/7 từ VNPT" },
];

const QUY_TRINH = [
  { icon: ClipboardList, title: "Tiếp nhận", sub: "nhu cầu" },
  { icon: Search, title: "Tư vấn &", sub: "đề xuất giải pháp" },
  { icon: FileCheck2, title: "Báo giá &", sub: "ký hợp đồng" },
  { icon: Rocket, title: "Triển khai, cấu hình", sub: "& bàn giao" },
];

const FAQ = [
  {
    q: "VNPT Smart Cloud khác VPS truyền thống như thế nào?",
    a: "VNPT Smart Cloud sử dụng hạ tầng ảo hóa hiện đại, tự động mở rộng tài nguyên, đặt tại Data Center đạt chuẩn quốc tế, đảm bảo hiệu năng và độ ổn định cao hơn VPS truyền thống.",
  },
  {
    q: "Có thể nâng cấp CPU, RAM và SSD không?",
    a: "Có. Bạn có thể nâng cấp cấu hình (CPU, RAM, SSD) bất kỳ lúc nào theo nhu cầu sử dụng mà không gián đoạn dịch vụ.",
  },
  {
    q: "Có thể sử dụng Windows Server hoặc Linux không?",
    a: "Có. VNPT Smart Cloud hỗ trợ đầy đủ các hệ điều hành phổ biến như Windows Server, CentOS, Ubuntu, Debian...",
  },
  {
    q: "Giá thuê Cloud Server đã bao gồm IP và băng thông chưa?",
    a: "Giá thuê đã bao gồm 1 địa chỉ IP public và băng thông theo gói. Liên hệ để được tư vấn chi tiết theo nhu cầu sử dụng.",
  },
];

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-3 text-xl font-bold text-slate-800 sm:text-2xl">
        <span className="h-6 w-1.5 shrink-0 rounded-full bg-vnpt" />
        {title}
      </h2>
      {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function CloudHeroArt() {
  return (
    <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center sm:h-80">
      <div className="absolute h-56 w-56 rounded-full bg-vnpt-neon/30 blur-3xl sm:h-72 sm:w-72" />
      <svg viewBox="0 0 320 260" className="relative h-full w-full">
        <defs>
          <linearGradient id="cloudFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f6fd6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a66c2" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="platformGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* platform glow */}
        <ellipse cx="160" cy="228" rx="110" ry="16" fill="url(#platformGlow)" />
        <ellipse cx="160" cy="228" rx="78" ry="6" fill="#38bdf8" opacity="0.5" />

        {/* satellite dish on top of cloud */}
        <g stroke="#bfe0ff" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M150 58 L150 40" />
          <path d="M136 50 a16 16 0 0 1 28 0" />
        </g>
        <circle cx="150" cy="40" r="4" fill="#bfe0ff" />

        {/* cloud shape */}
        <path
          d="M96 112 a30 30 0 0 1 20-45 38 38 0 0 1 73-8 28 28 0 0 1 34 44 26 26 0 0 1-4 52 H112 a24 24 0 0 1-16-43z"
          fill="url(#cloudFill)"
          stroke="#8fc4ff"
          strokeWidth="2"
        />

        {/* badge inside cloud */}
        <g>
          <rect x="118" y="96" width="84" height="44" rx="8" fill="#063d78" opacity="0.85" />
          <text x="160" y="113" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">
            VNPT
          </text>
          <text x="160" y="126" textAnchor="middle" fontSize="8" fill="#bfe0ff">
            Smart Cloud
          </text>
        </g>

        {/* server towers */}
        {[108, 160, 212].map((x, i) => (
          <g key={x}>
            <rect
              x={x - 22}
              y={150 + (i === 1 ? -8 : 0)}
              width="44"
              height={66 + (i === 1 ? 8 : 0)}
              rx="4"
              fill="#0c2f5c"
              stroke="#3b82c7"
              strokeWidth="1.5"
            />
            {[0, 1, 2, 3].map((row) => (
              <rect
                key={row}
                x={x - 16}
                y={160 + (i === 1 ? -8 : 0) + row * 14}
                width="32"
                height="6"
                rx="2"
                fill={row % 2 === 0 ? "#60d4ff" : "#1b4d85"}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function CloudIdcPage() {
  return (
    <div>
      {/* BREADCRUMB */}
      <div className="border-b border-slate-100 bg-white px-6 py-3">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "Dịch vụ VNPT", href: "/san-pham" },
              { label: "VNPT Smart Cloud" },
            ]}
          />
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt px-6 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr_0.85fr]">
            {/* left content */}
            <div>
              <h1 className="text-2xl font-extrabold leading-tight text-white sm:whitespace-nowrap sm:text-3xl">
                VNPT Smart Cloud
              </h1>
              <p className="mt-3 max-w-md text-sm text-white/80 sm:text-base">
                Hệ sinh thái điện toán đám mây và Data Center của VNPT an toàn, linh hoạt, hiệu quả
                cho doanh nghiệp số.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="#dang-ky-tu-van"
                  className="flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-vnpt transition hover:bg-white/90"
                >
                  Nhận tư vấn giải pháp <ArrowRight size={16} />
                </Link>
                <Link
                  href="#bang-gia"
                  className="flex items-center gap-2 rounded-md border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Xem bảng giá <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* illustration */}
            <CloudHeroArt />

            {/* badges */}
            <div className="flex flex-col gap-3">
              {HERO_BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg"
                >
                  <b.icon size={15} className="shrink-0 text-emerald-500" />
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HỆ SINH THÁI */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <SectionHeading
          title="Hệ sinh thái VNPT Smart Cloud"
          subtitle="Đa dạng dịch vụ Cloud và hạ tầng số, đáp ứng toàn diện nhu cầu từ máy chủ, lưu trữ, sao lưu đến kết nối và môi trường Cloud riêng cho doanh nghiệp."
        />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {HE_SINH_THAI.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
                <item.icon size={24} />
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-800">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BẢNG GIÁ CLOUD SERVER */}
      <section id="bang-gia" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-10">
        <SectionHeading
          title="Bảng giá Cloud Server tiêu biểu"
          subtitle="Các gói máy chủ ảo VNPT Cloud được thiết kế tối ưu cho nhiều nhu cầu từ website, ứng dụng đến hệ thống doanh nghiệp."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CLOUD_SERVER_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl border p-5 ${
                plan.popular ? "border-vnpt shadow-lg shadow-vnpt/10" : "border-slate-100 shadow-sm"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-vnpt-accent px-3 py-1 text-xs font-semibold text-white shadow">
                  <Star size={12} className="fill-white" /> Phổ biến
                </span>
              )}
              <div className="flex items-center gap-2">
                <Server size={20} className="text-vnpt" />
                <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {plan.specs.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> {s}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <span className="text-xl font-extrabold text-red-600">{plan.price}</span>
                <span className="text-sm text-slate-400"> /tháng</span>
              </div>
              <Link
                href="/san-pham/cloud-idc/cloud-vnpt-cloud-server"
                className={`mt-4 flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition ${
                  plan.popular
                    ? "bg-vnpt text-white hover:bg-vnpt-dark"
                    : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                }`}
              >
                Đăng ký ngay <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/san-pham/cloud-idc/cloud-vnpt-cloud-server"
            className="inline-flex items-center gap-1.5 rounded-md border border-vnpt px-5 py-2.5 text-sm font-semibold text-vnpt hover:bg-vnpt-light"
          >
            Xem tất cả cấu hình Cloud Server <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* CLOUD STORAGE */}
      <section className="mx-auto max-w-7xl px-6 pb-6">
        <div className="flex flex-col gap-5 rounded-xl bg-vnpt-light p-6 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center justify-center lg:w-28">
            <Layers size={48} className="text-vnpt" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-vnpt">Cloud Storage</h3>
            <p className="mt-1 text-sm text-slate-600">
              Lưu trữ dữ liệu an toàn, linh hoạt, đáp ứng nhu cầu lưu trữ lớn và truy cập mọi lúc,
              mọi nơi.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            {CLOUD_STORAGE_TAGS.map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-1 text-center text-xs font-semibold text-slate-600">
                <t.icon size={20} className="text-vnpt" />
                <span className="max-w-[80px]">{t.label}</span>
              </div>
            ))}
          </div>
          <Link
            href="#dang-ky-tu-van"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-vnpt px-5 py-2.5 text-sm font-semibold text-white hover:bg-vnpt-dark"
          >
            Nhận báo giá <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* CLOUD BACKUP */}
      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="flex flex-col gap-5 rounded-xl bg-vnpt-light p-6 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center justify-center lg:w-28">
            <ShieldCheck size={48} className="text-vnpt" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-vnpt">Cloud Backup</h3>
            <p className="mt-1 text-sm text-slate-600">
              Sao lưu dữ liệu tự động, định kỳ, giúp doanh nghiệp bảo vệ và phục hồi dữ liệu nhanh
              chóng.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            {CLOUD_BACKUP_TAGS.map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-1 text-center text-xs font-semibold text-slate-600">
                <t.icon size={20} className="text-vnpt" />
                <span className="max-w-[80px]">{t.label}</span>
              </div>
            ))}
          </div>
          <Link
            href="#dang-ky-tu-van"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-vnpt px-5 py-2.5 text-sm font-semibold text-white hover:bg-vnpt-dark"
          >
            Nhận báo giá <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* KẾT NỐI HẠ TẦNG CLOUD */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <SectionHeading title="Giải pháp kết nối hạ tầng Cloud" />
        <div className="grid gap-5 sm:grid-cols-3">
          {KET_NOI_HA_TANG.map((k) => (
            <div key={k.title} className="rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
                <k.icon size={22} />
              </div>
              <h3 className="mt-3 font-bold text-slate-800">{k.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{k.desc}</p>
              <Link
                href="#dang-ky-tu-van"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-vnpt hover:underline"
              >
                Nhận báo giá <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* VÌ SAO CHỌN */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <SectionHeading title="Vì sao chọn VNPT Smart Cloud?" />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {VI_SAO.map((v) => (
            <div
              key={v.title}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-5 text-center shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                <v.icon size={22} />
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {v.title}
                <br />
                {v.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* QUY TRÌNH TRIỂN KHAI */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <SectionHeading title="Quy trình triển khai dịch vụ" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {QUY_TRINH.map((q, i) => (
            <div key={q.title} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <q.icon size={24} />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-vnpt text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <div className="text-sm font-semibold leading-tight text-slate-800">
                  {q.title}
                  <br />
                  {q.sub}
                </div>
              </div>
              {i < QUY_TRINH.length - 1 && (
                <ArrowRight className="mx-2 hidden shrink-0 text-slate-300 sm:block" size={20} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FORM ĐĂNG KÝ TƯ VẤN */}
      <CloudLeadForm />

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-800 sm:text-2xl">
            <span className="h-6 w-1.5 shrink-0 rounded-full bg-vnpt" />
            Câu hỏi thường gặp (FAQ)
          </h2>
          <Link href="/lien-he" className="hidden shrink-0 text-sm font-semibold text-vnpt hover:underline sm:inline">
            Xem tất cả câu hỏi →
          </Link>
        </div>
        <FaqAccordion items={FAQ} />
      </section>

      {/* CTA BANNER CUỐI */}
      <section className="bg-vnpt-darker px-6 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 sm:flex">
              <Headset size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Triển khai VNPT Smart Cloud cho doanh nghiệp của bạn!
              </h3>
              <p className="mt-1 text-sm text-white/70">
                Hạ tầng mạnh mẽ – Dữ liệu an toàn – Vận hành linh hoạt – Đồng hành cùng chuyển đổi số
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt hover:bg-white/90"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <MessageCircle size={16} /> Tư vấn qua Zalo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
