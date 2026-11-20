"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ChevronDown, Check, Gauge, Home } from "lucide-react";
import type { Product } from "@/lib/types";

const ICON_BY_KEYWORD: { match: (title: string) => boolean; icon: typeof Home }[] = [
  { match: (t) => t.toUpperCase().includes("CAM"), icon: Camera },
  { match: (t) => t.toUpperCase().includes("HOME 2"), icon: Gauge },
];

function iconFor(title: string) {
  return ICON_BY_KEYWORD.find((r) => r.match(title))?.icon ?? Home;
}

function speedLabel(product: Product) {
  const line = product.features[0] ?? product.shortDesc;
  const match = line.match(/[\d.,]+\s?(Mbps|Gbps)(?:\s?(?:đến|-)\s?[\d.,]+\s?(Mbps|Gbps))?/i);
  return match ? `Tốc độ ${line.match(/Internet\s+(.*?)\./i)?.[1] ?? match[0]}` : line;
}

function priceOf(product: Product) {
  return product.pricing[0]?.rows[0]?.[1]?.replace("/tháng", "") ?? "Liên hệ";
}

/** 4 gói tiêu biểu hiển thị mặc định, đúng thứ tự trong ảnh thiết kế. */
const FEATURED_SLUGS = ["home-1", "home-2", "home-3", "home-cam-2"];

export default function PricingGrid({ packages }: { packages: Product[] }) {
  const [expanded, setExpanded] = useState(false);
  const featured = FEATURED_SLUGS.map((slug) => packages.find((p) => p.slug === slug)).filter(
    (p): p is Product => Boolean(p),
  );
  const rest = packages.filter((p) => !FEATURED_SLUGS.includes(p.slug));

  const renderCard = (p: Product) => {
    const Icon = iconFor(p.title);
    return (
      <div
        key={p.id}
        className="flex flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-vnpt/40 hover:shadow-md"
      >
        <div className="flex items-center gap-2 text-vnpt">
          <Icon size={20} />
          <h3 className="text-base text-slate-800">{p.title}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{speedLabel(p)}</p>
        <p className="mt-3">
          <span className="text-2xl font-bold text-rose-600">{priceOf(p)}</span>
          <span className="text-sm text-slate-400"> / tháng</span>
        </p>
        <ul className="mt-3 flex-1 space-y-1.5">
          {p.features.slice(0, 2).map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
              <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {f}
            </li>
          ))}
        </ul>
        <Link
          href="#tu-van"
          className="btn-label mt-4 rounded-md bg-vnpt py-2 text-center text-sm text-white transition hover:bg-vnpt-dark"
        >
          Đăng ký ngay →
        </Link>
      </div>
    );
  };

  return (
    <section id="bang-gia" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-12">
      <div className="border-l-4 border-vnpt pl-4">
        <h2 className="text-slate-800">Bảng giá Internet Cá nhân / Gia đình</h2>
        <p className="mt-1 text-slate-500">
          Đa dạng gói cước, tốc độ cao, linh hoạt lựa chọn theo nhu cầu sử dụng.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map(renderCard)}</div>

      {rest.length > 0 && (
        <>
          {expanded && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rest.map(renderCard)}
            </div>
          )}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="btn-label inline-flex items-center gap-2 rounded-md border border-vnpt/30 px-5 py-2.5 text-vnpt transition hover:bg-vnpt-light"
            >
              {expanded ? "Thu gọn danh sách gói cước" : `Xem tất cả ${packages.length} gói cước Internet Cá nhân / Gia đình`}
              <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
