import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Headphones,
  Laptop,
  Layers,
  MessageCircle,
  Monitor,
  Phone,
  Share2,
  Star,
  Store,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import ConsultForm from "./ConsultForm";

export const metadata: Metadata = { title: "Internet VNPT - Băng rộng cố định — VNPT Nam Sài Gòn" };

const WHY_CHOOSE = [
  { icon: Zap, title: "Tốc độ cao, ổn định", desc: "Kết nối mượt mà, ổn định đáp ứng mọi nhu cầu." },
  { icon: Wifi, title: "Phủ sóng WiFi toàn nhà", desc: "Hỗ trợ WiFi Mesh, kết nối nhiều thiết bị." },
  { icon: Headphones, title: "Hỗ trợ kỹ thuật 24/7", desc: "Tổng đài kỹ thuật luôn sẵn sàng." },
  { icon: Layers, title: "Gói cước đa dạng", desc: "Phù hợp cho cá nhân, gia đình và doanh nghiệp." },
];

const COMBOS: Array<{
  icon: typeof Camera;
  name: string;
  desc: string;
  points: string[];
  price: string;
  highlight?: boolean;
  badge?: string;
}> = [
  {
    icon: Camera,
    name: "Home Cam",
    desc: "Internet + Camera an ninh",
    points: ["Internet tốc độ cao", "Camera giám sát 24/7", "Quản lý qua ứng dụng"],
    price: "229.000đ",
  },
  {
    icon: Wifi,
    name: "Home Slay",
    desc: "Internet tốc độ cao cho gia đình hiện đại",
    points: ["WiFi phủ rộng, ổn định", "Ưu đãi thiết bị, lắp đặt", "Phù hợp nhiều thiết bị"],
    price: "179.000đ",
    highlight: true,
    badge: "Được ưa chuộng",
  },
  {
    icon: Monitor,
    name: "Home Truyền hình",
    desc: "Internet + Truyền hình MyTV",
    points: ["Internet ổn định, tốc độ cao", "Kho nội dung MyTV đặc sắc", "Giải trí cho cả gia đình"],
    price: "279.000đ",
  },
];

const HOME_PLANS: Array<{ name: string; speed: string; price: string; popular?: boolean }> = [
  { name: "Home 100", speed: "100 Mbps", price: "179.000đ" },
  { name: "Home 150", speed: "150 Mbps", price: "209.000đ" },
  { name: "Home 200", speed: "200 Mbps", price: "249.000đ", popular: true },
  { name: "Home 300", speed: "300 Mbps", price: "299.000đ" },
];

const BUSINESS_FEATURES = [
  { icon: Building2, title: "Internet Văn phòng", desc: "Phù hợp văn phòng, công ty nhỏ, làm việc ổn định." },
  { icon: Store, title: "Internet Kinh doanh", desc: "Phù hợp cửa hàng, chuỗi bán lẻ, nhu cầu kết nối liên tục." },
  { icon: Share2, title: "Kết nối Chuyên biệt", desc: "Băng thông lớn, IP tĩnh, SLA theo yêu cầu." },
];

const BUSINESS_PLANS = [
  { name: "Business 200", speed: "200 Mbps", price: "399.000đ" },
  { name: "Business 300", speed: "300 Mbps", price: "599.000đ" },
  { name: "Business 500", speed: "500 Mbps", price: "999.000đ" },
];

const QUY_TRINH = [
  { icon: ClipboardList, title: "Chọn gói cước phù hợp" },
  { icon: Wifi, title: "Kiểm tra hạ tầng" },
  { icon: FileCheck2, title: "Xác nhận đăng ký" },
  { icon: Wrench, title: "Lắp đặt & bàn giao" },
];

const FAQS = [
  {
    q: "Làm sao biết khu vực của tôi có lắp được Internet VNPT?",
    a: "Bạn để lại thông tin qua form đăng ký hoặc gọi hotline 0838 999 333, đội ngũ VNPT Nam Sài Gòn sẽ kiểm tra hạ tầng miễn phí tại địa chỉ lắp đặt.",
  },
  {
    q: "Có thể nâng cấp tốc độ hoặc thêm dịch vụ (Camera, MyTV) không?",
    a: "Có. Bạn có thể nâng cấp gói cước hoặc đăng ký thêm Camera an ninh, Truyền hình MyTV bất kỳ lúc nào trong quá trình sử dụng.",
  },
  {
    q: "Giá cước đã bao gồm modem WiFi chưa?",
    a: "Giá cước đã bao gồm modem WiFi, khách hàng không phải trả thêm phí thuê thiết bị hàng tháng.",
  },
  {
    q: "Thời gian lắp đặt Internet VNPT là bao lâu?",
    a: "Sau khi khảo sát hạ tầng, đội ngũ kỹ thuật thi công và bàn giao trong vòng 24 giờ đối với khu vực đã có hạ tầng sẵn.",
  },
];

function SectionHeading({ title, center = true }: { title: string; center?: boolean }) {
  if (center) {
    return (
      <div className="flex items-center justify-center gap-4">
        <span className="h-px w-10 bg-slate-300" />
        <h2 className="text-center text-slate-800">{title}</h2>
        <span className="h-px w-10 bg-slate-300" />
      </div>
    );
  }
  return (
    <h2 className="border-l-4 border-vnpt pl-3 text-slate-800">{title}</h2>
  );
}

export default function BangRongCoDinhPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb
            variant="light"
            items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm", href: "/san-pham" }, { label: "Internet VNPT" }]}
          />

          <div className="mt-6 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="italic text-white">Internet VNPT</h1>
              <p className="mt-1 text-xl font-semibold text-white/95 sm:text-2xl">
                Kết nối tốc độ cao cho mọi nhu cầu
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
                Internet cáp quang, WiFi Mesh, Camera an ninh và Truyền hình MyTV cho gia đình và
                doanh nghiệp.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/lien-he"
                  className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-vnpt-dark hover:bg-slate-100"
                >
                  Đăng ký lắp đặt <ArrowRight size={16} />
                </Link>
                <Link
                  href="/lien-he"
                  className="inline-flex items-center gap-2 rounded-md border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <MessageCircle size={16} /> Tư vấn qua Zalo
                </Link>
              </div>
            </div>

            {/* Minh hoạ dựng tay bằng icon/SVG (không có ảnh thật) */}
            <div className="relative hidden h-72 items-center justify-center lg:flex">
              <div className="absolute h-56 w-56 rounded-full bg-white/10" />
              <div className="absolute h-40 w-40 rounded-full border border-white/20" />
              <div className="relative flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Laptop size={40} className="text-white" />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-vnpt shadow-lg">
                    <Wifi size={28} />
                  </span>
                  <div className="rounded-xl bg-vnpt-accent px-3 py-2 text-center shadow-lg">
                    <div className="text-xs font-bold leading-tight text-white">myTV</div>
                  </div>
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Camera size={32} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VÌ SAO CHỌN INTERNET VNPT */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionHeading title="Vì sao chọn Internet VNPT?" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {WHY_CHOOSE.map((item) => (
            <div key={item.title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                <item.icon size={26} />
              </span>
              <div className="text-sm font-semibold text-slate-800">{item.title}</div>
              <div className="text-xs text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMBO INTERNET NỔI BẬT */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <SectionHeading title="Combo Internet nổi bật" center={false} />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {COMBOS.map((combo) => (
            <div
              key={combo.name}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                combo.highlight ? "border-vnpt ring-1 ring-vnpt/15" : "border-slate-100"
              }`}
            >
              {combo.badge && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-white">
                  <Star size={12} fill="currentColor" /> {combo.badge}
                </span>
              )}
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
                  <combo.icon size={28} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{combo.name}</h3>
                  <p className="text-xs text-slate-500">{combo.desc}</p>
                </div>
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {combo.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {p}
                  </li>
                ))}
              </ul>

              <div className="mt-5 text-sm text-slate-500">
                Giá từ <span className="text-lg font-extrabold text-vnpt">{combo.price}</span> /tháng
              </div>

              <Link
                href="/lien-he"
                className={`mt-4 inline-flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold ${
                  combo.highlight
                    ? "bg-vnpt text-white hover:bg-vnpt-dark"
                    : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                }`}
              >
                Đăng ký ngay <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* BẢNG GIÁ GIA ĐÌNH / CÁ NHÂN */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <SectionHeading title="Bảng giá Internet gia đình / cá nhân" center={false} />
        <p className="mt-2 text-sm text-slate-500">
          Các gói Internet cáp quang tốc độ cao, phù hợp học tập, làm việc và giải trí tại nhà.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-5 text-center shadow-sm ${
                plan.popular ? "border-vnpt ring-1 ring-vnpt/15" : "border-slate-100"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-vnpt px-3 py-1 text-xs font-semibold text-white">
                  <Star size={12} fill="currentColor" /> Phổ biến
                </span>
              )}
              <div className="flex items-center justify-center gap-2">
                <Wifi size={18} className="text-vnpt" />
                <span className="font-bold text-slate-800">{plan.name}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Tốc độ {plan.speed}</p>
              <p className="mt-2 text-xl font-extrabold text-red-600">
                {plan.price} <span className="text-xs font-normal text-slate-400">/tháng</span>
              </p>
              <Link
                href="/lien-he"
                className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold ${
                  plan.popular
                    ? "bg-vnpt text-white hover:bg-vnpt-dark"
                    : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                }`}
              >
                Đăng ký ngay <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* INTERNET DOANH NGHIỆP */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <SectionHeading title="Internet doanh nghiệp" center={false} />
        <p className="mt-2 text-sm text-slate-500">
          Giải pháp Internet ổn định, băng thông lớn cho văn phòng, cửa hàng và doanh nghiệp.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {BUSINESS_FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
                <f.icon size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{f.title}</div>
                <div className="text-xs text-slate-500">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[180px_1fr]">
          <Link
            href="/san-pham/internet-doanh-nghiep"
            className="flex items-center justify-center gap-2 rounded-xl bg-vnpt-darker px-4 py-5 text-center text-sm font-bold text-white hover:bg-vnpt-dark lg:py-0"
          >
            Các gói nổi bật <ChevronRight size={18} />
          </Link>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUSINESS_PLANS.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <Zap size={18} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">Tốc độ {p.speed} | IP tĩnh (tùy chọn)</div>
                  <div className="text-base font-extrabold text-red-600">
                    {p.price} <span className="text-xs font-normal text-slate-400">/tháng</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUY TRÌNH ĐĂNG KÝ & LẮP ĐẶT */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <SectionHeading title="Quy trình đăng ký & lắp đặt" center={false} />
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {QUY_TRINH.map((step, i) => (
            <div key={step.title} className="relative text-center">
              {i < QUY_TRINH.length - 1 && (
                <ArrowRight size={16} className="absolute right-[-20px] top-7 hidden text-slate-300 sm:block" />
              )}
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                <step.icon size={24} />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-vnpt text-[11px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-800">{step.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ĐĂNG KÝ TƯ VẤN */}
      <ConsultForm />

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <SectionHeading title="Câu hỏi thường gặp (FAQ)" center={false} />
          <Link href="/lien-he" className="hidden text-sm font-semibold text-vnpt hover:underline sm:block">
            Xem tất cả câu hỏi
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-lg border border-slate-100 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                {f.q}
                <ChevronRight size={14} className="shrink-0 text-vnpt transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm text-slate-500">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-4 text-center sm:hidden">
          <Link href="/lien-he" className="text-sm font-semibold text-vnpt hover:underline">
            Xem tất cả câu hỏi →
          </Link>
        </div>
      </section>

      {/* CTA BANNER CUỐI */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="flex flex-col items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-vnpt-darker to-vnpt px-6 py-6 text-white sm:flex-row">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:flex">
              <Wifi size={24} />
            </span>
            <div>
              <h2 className="text-white">Đăng ký lắp đặt Internet VNPT ngay hôm nay!</h2>
              <p className="mt-1 text-sm text-white/80">
                Internet cáp quang – WiFi Mesh – Camera an ninh – Truyền hình MyTV
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <a
              href="tel:0838999333"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt-dark hover:bg-slate-100"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <Link
              href="/lien-he"
              className="inline-flex items-center gap-2 rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <MessageCircle size={16} /> Tư vấn qua Zalo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
