import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe,
  Headset,
  Layers,
  LayoutGrid,
  Link2,
  MapPin,
  Network,
  Phone,
  Search,
  Server,
  ShieldCheck,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import PricingTable from "@/components/product/PricingTable";
import ContactForm from "./ContactForm";
import {
  FAQS,
  HERO_HIGHLIGHTS,
  NETWORK_SERVICES,
  OTHER_PACKAGES_TABLE,
  PACKAGES,
  REASONS,
  STATIC_IP_BOXES,
  STEPS,
} from "./data";

export const metadata: Metadata = {
  title: "Internet Doanh nghiệp — VNPT Nam Sài Gòn",
  description:
    "Internet VNPT Doanh nghiệp: kết nối tốc độ cao, ổn định và bảo mật cho mọi quy mô doanh nghiệp, IP tĩnh, MetroNet, MegaWAN, Leased Line.",
};

const REASON_ICONS = [Zap, ShieldCheck, Headset, Layers];

/** Tiêu đề section theo đúng phong cách ảnh design: gạch đứng xanh + chữ đậm navy. */
function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 h-6 w-1.5 shrink-0 rounded-full bg-vnpt" />
      <div>
        <h2 className="text-xl text-slate-800 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function InternetDoanhNghiepPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb
            variant="light"
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "Internet VNPT", href: "/san-pham/bang-rong-co-dinh" },
              { label: "Internet Doanh nghiệp" },
            ]}
          />

          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1.3fr_1fr_auto]">
            <div>
              <h1 className="flex items-center gap-3 leading-tight">
                <Wifi size={30} className="shrink-0 text-vnpt-accent" />
                Internet VNPT Doanh nghiệp
              </h1>
              <p className="mt-3 max-w-xl text-white/85">
                Kết nối tốc độ cao, ổn định và bảo mật cho mọi quy mô doanh nghiệp, từ văn phòng nhỏ đến hệ
                thống nhiều chi nhánh.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/lien-he"
                  className="rounded-md border border-white/70 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Tư vấn giải pháp
                </Link>
                <Link
                  href="#bang-gia"
                  className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-vnpt-dark hover:bg-slate-100"
                >
                  Nhận báo giá
                </Link>
              </div>
            </div>

            <div className="relative hidden h-56 overflow-hidden rounded-2xl lg:block">
              <Image
                src="/images/hero/hero-datacenter.jpg"
                alt="Internet VNPT Doanh nghiệp"
                fill
                sizes="(max-width: 1024px) 0px, 30vw"
                quality={90}
                priority
                className="object-cover"
              />
            </div>

            <ul className="flex flex-col gap-2">
              {HERO_HIGHLIGHTS.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  <CheckCircle2 size={14} className="shrink-0 text-vnpt" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* BẢNG GIÁ */}
      <section id="bang-gia" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-12">
        <SectionHeading
          title="Bảng giá Internet Doanh nghiệp"
          subtitle="Các gói Internet cáp quang doanh nghiệp phổ biến, đáp ứng đa dạng nhu cầu sử dụng."
        />

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PACKAGES.map((p) => (
            <div
              key={p.code}
              className={`relative flex flex-col rounded-2xl p-5 transition ${
                p.featured
                  ? "border-2 border-vnpt bg-white shadow-lg shadow-vnpt/10"
                  : "border border-slate-200 bg-white hover:border-vnpt/40 hover:shadow-md"
              }`}
            >
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-vnpt-accent px-3 py-1 text-[11px] font-bold text-white shadow">
                  ★ Phổ biến
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
                  <Building2 size={18} />
                </span>
                <h3 className="text-base text-slate-800">{p.name}</h3>
              </div>
              <p className="mt-2 text-xs text-slate-500">{p.desc}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <Check size={15} className="mt-0.5 shrink-0 text-vnpt" /> {f}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <p className="text-xl font-bold text-red-600">
                  {p.price}
                  {p.priceSuffix && <span className="ml-1 text-xs font-medium text-slate-400">{p.priceSuffix}</span>}
                </p>
                <Link
                  href="/lien-he"
                  className={`mt-3 flex items-center justify-center gap-1.5 rounded-md py-2.5 text-center text-sm font-semibold transition ${
                    p.featured
                      ? "bg-vnpt text-white hover:bg-vnpt-dark"
                      : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                  }`}
                >
                  {p.cta} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CÁC GÓI KHÁC */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:grid-cols-[1fr_2.2fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
              <Layers size={20} />
            </span>
            <h3 className="text-base text-slate-800">Các gói Internet khác cho doanh nghiệp</h3>
          </div>

          <div className="overflow-x-auto lg:border-x lg:border-slate-100 lg:px-6">
            <PricingTable
              pricing={[
                {
                  columns: OTHER_PACKAGES_TABLE.columns,
                  rows: OTHER_PACKAGES_TABLE.rows,
                },
              ]}
            />
          </div>

          <Link
            href="/san-pham/bang-rong-co-dinh"
            className="flex items-center gap-3 text-sm font-semibold text-vnpt hover:underline lg:flex-col lg:text-center"
          >
            <LayoutGrid size={22} className="text-vnpt" />
            <span>
              Xem tất cả
              <br className="hidden lg:block" /> gói cước doanh nghiệp
            </span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* IP TĨNH */}
      <section className="bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <SectionHeading title="Internet doanh nghiệp với IP tĩnh" />
              <p className="mt-3 text-sm text-slate-600">
                Cung cấp địa chỉ IP công cộng cố định, phù hợp cho hệ thống máy chủ, VPN, camera, truy cập từ
                xa, website...
              </p>
              <div className="mt-5 flex h-28 items-center justify-center rounded-xl bg-vnpt-light">
                <Server size={40} className="text-vnpt" />
              </div>
            </div>

            {STATIC_IP_BOXES.map((box) => (
              <div key={box.title} className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-vnpt">
                  <Globe size={18} />
                  <h3 className="text-base text-slate-800">{box.title}</h3>
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {box.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-sm text-slate-600">
                      <Check size={15} className="mt-0.5 shrink-0 text-vnpt" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/lien-he"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-vnpt py-2.5 text-sm font-semibold text-vnpt hover:bg-vnpt-light"
                >
                  {box.cta} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MẠNG RIÊNG DOANH NGHIỆP: MetroNet / MegaWAN / Leased Line */}
      <section className="mx-auto max-w-7xl space-y-5 px-6 py-12">
        {NETWORK_SERVICES.map((svc, i) => {
          const Icon = [MapPin, Network, Link2][i] ?? Network;
          return (
            <div
              key={svc.name}
              className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-start gap-3 lg:w-72 lg:shrink-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="text-base text-slate-800">{svc.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{svc.desc}</p>
                </div>
              </div>

              <ul className="grid flex-1 gap-2 sm:grid-cols-3">
                {svc.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <Check size={15} className="mt-0.5 shrink-0 text-vnpt" /> {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/lien-he"
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-vnpt px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-vnpt-dark"
              >
                {svc.cta} <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </section>

      {/* VÌ SAO CHỌN */}
      <section className="bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeading title="Vì sao chọn Internet VNPT?" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map((r, i) => {
              const Icon = REASON_ICONS[i] ?? ShieldCheck;
              return (
                <div key={r.title} className="flex flex-col items-center gap-3 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                    <Icon size={24} />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">{r.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* QUY TRÌNH */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionHeading title="Quy trình đăng ký & triển khai" />
        <div className="relative mt-10 grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = [ClipboardList, Search, FileText, Wrench][i] ?? ClipboardList;
            return (
              <div key={s.step} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="absolute right-[-20px] top-6 hidden text-slate-300 sm:block"
                  />
                )}
                <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                  <Icon size={22} />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-vnpt-accent text-[10px] font-bold text-white">
                    {s.step}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800">{s.title}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ĐĂNG KÝ TƯ VẤN */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <ContactForm />
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="flex items-center justify-between">
          <SectionHeading title="Câu hỏi thường gặp (FAQ)" />
          <Link href="/lien-he" className="shrink-0 text-sm font-semibold text-vnpt hover:underline">
            Xem tất cả câu hỏi →
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-lg border border-slate-100 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                {f.q}
                <ArrowRight size={14} className="shrink-0 text-vnpt transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm text-slate-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="bg-gradient-to-r from-vnpt-darker to-vnpt px-6 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center lg:flex-row lg:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Wifi size={22} />
            </span>
            <div>
              <div className="text-lg font-bold">Tư vấn giải pháp Internet Doanh nghiệp ngay hôm nay!</div>
              <p className="mt-1 text-sm text-white/80">
                Kết nối ổn định – Bảo mật – Linh hoạt – Đồng hành cùng doanh nghiệp.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="tel:0838999333"
              className="flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-vnpt-dark hover:bg-slate-100"
            >
              <Phone size={16} /> 0838 999 333
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-white/60 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-vnpt-dark">
                Z
              </span>
              Tư vấn qua Zalo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
