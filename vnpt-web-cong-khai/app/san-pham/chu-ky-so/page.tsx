import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Clock,
  Cloud,
  FileCheck2,
  FileSignature,
  FileText,
  Headset,
  IdCard,
  Landmark,
  Lock,
  MessageCircle,
  MoreHorizontal,
  PackageSearch,
  PenLine,
  Phone,
  Receipt,
  Shield,
  ShieldCheck,
  Smartphone,
  Umbrella,
  UserCheck2,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import PricingBlock, { type PricingPackage } from "./PricingBlock";
import FaqAccordion, { type FaqItem } from "./FaqAccordion";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Chữ ký số VNPT — An toàn, nhanh chóng, hiệu quả | VNPT Nam Sài Gòn",
  description:
    "Chữ ký số VNPT-CA (USB Token) và VNPT SmartCA (ký số từ xa) cho cá nhân, hộ kinh doanh, doanh nghiệp. Ký mọi lúc mọi nơi, bảo mật tuyệt đối, thủ tục đơn giản.",
};

const HERO_BADGES = [
  { icon: PenLine, label: "Ký số mọi lúc mọi nơi" },
  { icon: Clock, label: "Bảo mật tuyệt đối" },
  { icon: IdCard, label: "Thủ tục đơn giản" },
];

const LOI_ICH = [
  {
    icon: Shield,
    title: "An toàn, bảo mật",
    desc: "Xác thực điện tử tin cậy, đúng quy định pháp luật.",
  },
  {
    icon: Zap,
    title: "Giao dịch nhanh chóng",
    desc: "Ký số mọi lúc, mọi nơi trên máy tính và di động.",
  },
  {
    icon: PackageSearch,
    title: "Đa dạng đối tượng",
    desc: "Phù hợp cho hộ kinh doanh, doanh nghiệp, tổ chức.",
  },
  {
    icon: Headset,
    title: "Hỗ trợ tận nơi",
    desc: "Tư vấn, cài đặt và bàn giao nhanh tại TP.HCM.",
  },
];

const VNPT_CA_PACKAGES: PricingPackage[] = [
  {
    name: "Gói 1 năm",
    price: "1.250.000đ",
    unit: "năm",
    features: [
      "Ký số trên các hệ thống, phần mềm",
      "Đáp ứng đầy đủ quy định pháp luật",
      "Hỗ trợ cài đặt, hướng dẫn sử dụng",
    ],
  },
  {
    name: "Gói 2 năm",
    price: "2.350.000đ",
    unit: "2 năm",
    popular: true,
    features: [
      "Ký số trên các hệ thống, phần mềm",
      "Đáp ứng đầy đủ quy định pháp luật",
      "Hỗ trợ cài đặt, hướng dẫn sử dụng",
    ],
  },
  {
    name: "Gói 3 năm",
    price: "3.500.000đ",
    unit: "3 năm",
    features: [
      "Ký số trên các hệ thống, phần mềm",
      "Đáp ứng đầy đủ quy định pháp luật",
      "Hỗ trợ cài đặt, hướng dẫn sử dụng",
    ],
  },
];

const SMARTCA_PACKAGES: PricingPackage[] = [
  {
    name: "Gói 1 năm",
    price: "100.000đ",
    unit: "năm",
    features: [
      "Ký số mọi lúc, mọi nơi",
      "Đăng ký và giao dịch BHXH",
      "Giao dịch với cơ quan nhà nước",
    ],
  },
  {
    name: "Gói 2 năm",
    price: "180.000đ",
    unit: "2 năm",
    popular: true,
    features: [
      "Ký số mọi lúc, mọi nơi",
      "Đăng ký và giao dịch BHXH",
      "Giao dịch với cơ quan nhà nước",
    ],
  },
  {
    name: "Gói 3 năm",
    price: "270.000đ",
    unit: "3 năm",
    features: [
      "Ký số mọi lúc, mọi nơi",
      "Đăng ký và giao dịch BHXH",
      "Giao dịch với cơ quan nhà nước",
    ],
  },
];

const UNG_DUNG = [
  { icon: FileText, label: "Kê khai, nộp thuế điện tử" },
  { icon: Umbrella, label: "Giao dịch Bảo hiểm xã hội" },
  { icon: Landmark, label: "Thủ tục hành chính điện tử" },
  { icon: Receipt, label: "Ký hóa đơn, hợp đồng điện tử" },
  { icon: Banknote, label: "Giao dịch tài chính, ngân hàng" },
  { icon: MoreHorizontal, label: "Và nhiều giao dịch khác" },
];

const QUY_TRINH = [
  { icon: ClipboardList, title: "Tiếp nhận yêu cầu" },
  { icon: PackageSearch, title: "Tư vấn và chọn gói" },
  { icon: UserCheck2, title: "Ký hợp đồng và triển khai" },
  { icon: CheckCircle2, title: "Bàn giao và hướng dẫn" },
];

const FAQ: FaqItem[] = [
  {
    q: "Chữ ký số VNPT dùng để làm gì?",
    a: "Chữ ký số VNPT dùng để ký kê khai, nộp thuế điện tử, giao dịch bảo hiểm xã hội, thủ tục hành chính, hóa đơn và hợp đồng điện tử, giao dịch tài chính - ngân hàng và nhiều giao dịch điện tử khác có giá trị pháp lý tương đương chữ ký tay, con dấu.",
  },
  {
    q: "Thời hạn sử dụng chữ ký số là bao lâu?",
    a: "VNPT cung cấp các gói chữ ký số với thời hạn 1 năm, 2 năm hoặc 3 năm, khách hàng có thể lựa chọn gói phù hợp với nhu cầu sử dụng và gia hạn dễ dàng khi hết hạn.",
  },
  {
    q: "SmartCA và USB Token khác nhau thế nào?",
    a: "USB Token (VNPT-CA) là chữ ký số gắn với thiết bị phần cứng, cần cắm vào máy tính khi ký. SmartCA là chữ ký số từ xa, lưu trữ trên hệ thống bảo mật của VNPT, ký trực tiếp trên điện thoại hoặc máy tính mà không cần thiết bị USB.",
  },
  {
    q: "Có hỗ trợ cài đặt và hướng dẫn sử dụng không?",
    a: "Có. Đội ngũ kỹ thuật VNPT Nam Sài Gòn hỗ trợ cài đặt, hướng dẫn sử dụng tận nơi và đồng hành xử lý sự cố trong suốt quá trình sử dụng dịch vụ.",
  },
  {
    q: "Hộ kinh doanh nên chọn gói nào?",
    a: "Hộ kinh doanh thường phù hợp với gói VNPT SmartCA do chi phí thấp, đăng ký nhanh và đáp ứng tốt nhu cầu kê khai thuế, giao dịch bảo hiểm xã hội. Liên hệ VNPT để được tư vấn gói phù hợp nhất.",
  },
  {
    q: "Có xuất hóa đơn cho dịch vụ chữ ký số không?",
    a: "Có. VNPT xuất hóa đơn điện tử đầy đủ cho mọi gói dịch vụ chữ ký số, hỗ trợ khách hàng hạch toán chi phí theo đúng quy định.",
  },
];

export default function ChuKySoPage() {
  return (
    <div>
      {/* BREADCRUMB + HERO */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <Breadcrumb
            items={[{ label: "Trang chủ", href: "/" }, { label: "Chữ ký số VNPT" }]}
          />
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-10 pt-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight text-slate-900 font-[family-name:var(--font-montserrat)] sm:text-4xl">
                Chữ ký số VNPT
              </h1>
              <p className="mt-1 text-lg font-bold text-vnpt-accent">
                An toàn - Nhanh chóng - Hiệu quả
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
                Giải pháp chữ ký số hàng đầu Việt Nam, giúp cá nhân, hộ kinh doanh và doanh
                nghiệp giao dịch điện tử nhanh chóng, bảo mật, hợp pháp.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/lien-he"
                  className="flex items-center gap-2 rounded-lg bg-vnpt px-5 py-3 text-sm font-semibold text-white shadow-md shadow-vnpt/25 transition hover:bg-vnpt-dark"
                >
                  <PenLine size={16} /> Đăng ký ngay
                </Link>
                <Link
                  href="https://zalo.me"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <MessageCircle size={16} className="text-sky-500" /> Tư vấn qua Zalo
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="grid grid-cols-[1fr_auto] items-center gap-6">
                {/* Minh hoạ: laptop ký số */}
                <div className="relative flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br from-vnpt-light to-white">
                  <div className="relative flex h-32 w-44 flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-vnpt to-vnpt-dark text-white shadow-xl shadow-vnpt/25">
                    <div className="flex gap-2">
                      <Shield size={22} className="text-white" />
                      <Lock size={20} className="text-white/80" />
                    </div>
                    <FileSignature size={26} className="text-white" />
                  </div>
                  <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-vnpt-dark px-3 py-1 text-[10px] font-bold text-white">
                    VNPT-CA
                  </span>
                </div>
                {/* Minh hoạ: điện thoại SmartCA */}
                <div className="flex h-40 w-24 flex-col items-center justify-center gap-2 rounded-2xl bg-white shadow-lg ring-1 ring-slate-100">
                  <Smartphone size={28} className="text-vnpt" />
                  <Cloud size={16} className="text-vnpt-accent" />
                  <span className="text-center text-[10px] font-bold leading-tight text-slate-700">
                    VNPT
                    <br />
                    SmartCA
                  </span>
                </div>
              </div>

              {/* 3 badge bên phải */}
              <div className="mt-5 flex flex-col gap-2.5 sm:ml-auto sm:w-64">
                {HERO_BADGES.map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center gap-2.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100"
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

      {/* 4 CỘT LỢI ÍCH */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {LOI_ICH.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
                  <item.icon size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800">{item.title}</div>
                  <div className="mt-0.5 text-xs leading-snug text-slate-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VNPT-CA + SMARTCA */}
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <PricingBlock
          icon={<PenLine size={22} />}
          deviceIcon={<FileCheck2 size={30} />}
          deviceLabel="VNPT-CA"
          title="VNPT - CA (USB Token)"
          description="Chữ ký số bằng thiết bị USB Token, phù hợp cho giao dịch trên phần mềm, hệ thống của doanh nghiệp và cơ quan nhà nước."
          packages={VNPT_CA_PACKAGES}
        />
        <PricingBlock
          icon={<Cloud size={22} />}
          deviceIcon={<Smartphone size={30} />}
          deviceLabel="VNPT SmartCA"
          title="VNPT SmartCA (Ký số từ xa)"
          description="Chữ ký số từ xa, không cần USB Token. Ký số trực tuyến nhanh chóng, linh hoạt trên mọi thiết bị."
          packages={SMARTCA_PACKAGES}
        />
      </section>

      {/* ỨNG DỤNG CHỮ KÝ SỐ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 font-[family-name:var(--font-montserrat)]">
            <span className="h-5 w-1 rounded-full bg-vnpt" /> Ứng dụng chữ ký số
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Đáp ứng đầy đủ các giao dịch điện tử phổ biến hiện nay.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {UNG_DUNG.map((u) => (
              <div
                key={u.label}
                className="flex flex-col items-center gap-2 rounded-xl p-3 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <u.icon size={24} />
                </span>
                <span className="text-xs font-semibold leading-snug text-slate-700">
                  {u.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUY TRÌNH ĐĂNG KÝ */}
      <section className="bg-vnpt-light/40">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 font-[family-name:var(--font-montserrat)]">
            <ArrowRight size={18} className="text-vnpt" /> Quy trình đăng ký đơn giản
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {QUY_TRINH.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                {i < QUY_TRINH.length - 1 && (
                  <ArrowRight
                    size={18}
                    className="absolute -right-5 top-6 hidden text-vnpt/40 sm:block"
                  />
                )}
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vnpt text-white shadow-sm">
                  <step.icon size={22} />
                </span>
                <span className="mt-2 text-sm font-semibold text-slate-800">
                  {i + 1}. {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM ĐĂNG KÝ TƯ VẤN */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <RegisterForm />
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800 font-[family-name:var(--font-montserrat)]">
              Câu hỏi thường gặp
            </h2>
            <Link href="/lien-he" className="text-sm font-semibold text-vnpt hover:underline">
              Xem tất cả câu hỏi
            </Link>
          </div>
          <FaqAccordion items={FAQ} />
        </div>
      </section>

      {/* CTA BANNER CUỐI */}
      <section className="bg-gradient-to-r from-vnpt-darker to-vnpt-dark">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-white font-[family-name:var(--font-montserrat)]">
                Đăng ký Chữ ký số VNPT ngay hôm nay!
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Giải pháp ký số an toàn, hợp pháp, hỗ trợ triển khai nhanh chóng.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-3">
            <Link
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt-dark transition hover:bg-slate-100"
            >
              <Phone size={16} /> 0838 999 333
            </Link>
            <Link
              href="https://zalo.me"
              className="flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <MessageCircle size={16} /> Tư vấn qua Zalo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
