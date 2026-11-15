"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Wifi } from "lucide-react";
import type { Product } from "@/lib/types";

type Group = {
  key: string;
  tabLabel: string;
  packages: Product[];
  /** Sản phẩm được gắn badge "Gói đề xuất" (vd: gói có Mesh). */
  recommendedSlug?: string;
  href: string;
};

function extractSpeed(product: Product): string {
  const matches = product.shortDesc.match(/[\d.]+ ?(?:Mbps|Gbps)/g) ?? [];
  const first = matches[0];
  if (!first) return "";
  const last = matches[matches.length - 1];
  return last && last !== first ? `${first} - ${last}` : first;
}

function extractPrice(product: Product): string {
  const row = product.pricing[0]?.rows[0];
  return row?.[row.length - 1] ?? "Liên hệ";
}

function bullets(product: Product): string[] {
  const speed = extractSpeed(product);
  const out: string[] = [];
  if (speed) out.push(`Internet cáp quang ${speed}`);
  if (product.features.some((f) => /2 wifi mesh/i.test(f))) out.push("Tặng 2 WiFi Mesh 6");
  else if (product.features.some((f) => /wifi mesh/i.test(f))) out.push("Tặng 1 WiFi Mesh 6");
  if (product.features.some((f) => /bảo mật/i.test(f))) out.push("Bảo mật GreenNet");
  if (product.features.some((f) => /camera/i.test(f))) out.push("Tặng Camera an ninh");
  if (out.length < 2) out.push("Lắp đặt miễn phí, hỗ trợ 24/7");
  return out.slice(0, 3);
}

function PackageCard({
  product,
  recommended,
  href,
}: Readonly<{ product: Product; recommended: boolean; href: string }>) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        recommended ? "border-vnpt ring-1 ring-vnpt/30" : "border-slate-100"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 right-4 rounded-full bg-vnpt-accent px-3 py-1 text-[11px] font-bold text-white shadow">
          Gói đề xuất
        </span>
      )}
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
        <Wifi size={20} />
      </span>
      <h3 className="mt-3 text-slate-800">{product.title}</h3>
      <p className="text-xs text-slate-500">Tốc độ: {extractSpeed(product) || "Liên hệ"}</p>
      <p className="mt-2 text-2xl font-bold text-vnpt">
        {extractPrice(product)}
        {!extractPrice(product).includes("/") && (
          <span className="text-sm font-medium text-slate-500">/tháng</span>
        )}
      </p>
      <ul className="mt-3 space-y-1.5">
        {bullets(product).map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
            <Check size={15} className="mt-0.5 shrink-0 text-vnpt" />
            {b}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center gap-1 rounded-md bg-vnpt px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
      >
        Đăng ký ngay
      </Link>
    </div>
  );
}

export default function InternetPackagesSection({ groups }: Readonly<{ groups: Group[] }>) {
  const [active, setActive] = useState(0);
  const group = groups[active];

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p className="text-xs font-bold tracking-wide text-vnpt">INTERNET &amp; TRUYỀN HÌNH</p>
      <h2 className="mt-1 text-vnpt-darker">Gói cước Internet VNPT nổi bật</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Khám phá các gói Internet cáp quang, WiFi Mesh và truyền hình MyTV phù hợp với nhu cầu của bạn.
      </p>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {groups.map((g, i) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              i === active ? "bg-vnpt text-white" : "text-slate-500 hover:text-vnpt"
            }`}
          >
            {g.tabLabel}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {group.packages.length === 0 && (
          <p className="text-sm text-slate-500">Đang cập nhật gói cước, vui lòng liên hệ hotline để được tư vấn.</p>
        )}
        {group.packages.map((p) => (
          <PackageCard
            key={p.id}
            product={p}
            recommended={p.slug === group.recommendedSlug}
            href={group.href}
          />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={group.href}
          className="inline-flex items-center gap-1 text-sm font-semibold text-vnpt hover:text-vnpt-dark"
        >
          Xem tất cả gói cước Internet <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

export type { Group as InternetPackageGroup };
