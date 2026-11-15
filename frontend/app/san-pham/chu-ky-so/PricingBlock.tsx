"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, Check, Store } from "lucide-react";

export type PricingPackage = {
  name: string;
  price: string;
  unit: string;
  popular?: boolean;
  features: string[];
};

export default function PricingBlock({
  icon,
  title,
  description,
  deviceLabel,
  deviceIcon,
  packages,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  deviceLabel: string;
  deviceIcon: ReactNode;
  packages: PricingPackage[];
}) {
  const [audience, setAudience] = useState<"hkd" | "dn">("hkd");

  return (
    <div className="rounded-2xl border border-vnpt/10 bg-vnpt-light/60 p-5 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Giới thiệu + thiết bị */}
        <div>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vnpt text-white">
              {icon}
            </span>
            <h2 className="text-lg font-bold leading-snug text-slate-800 font-[family-name:var(--font-montserrat)]">
              {title}
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
          <div className="mt-5 hidden justify-center sm:flex">
            <div className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-vnpt to-vnpt-dark text-white shadow-lg shadow-vnpt/20">
              {deviceIcon}
              <span className="text-[11px] font-bold leading-none">{deviceLabel}</span>
            </div>
          </div>
        </div>

        {/* Toggle + gói giá */}
        <div>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAudience("hkd")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                audience === "hkd"
                  ? "bg-vnpt text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <Store size={16} /> Hộ kinh doanh
            </button>
            <button
              type="button"
              onClick={() => setAudience("dn")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                audience === "dn"
                  ? "bg-vnpt text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <Building2 size={16} /> Doanh nghiệp
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className={`relative flex flex-col rounded-xl bg-white p-4 ${
                  pkg.popular
                    ? "ring-2 ring-vnpt shadow-lg shadow-vnpt/15"
                    : "ring-1 ring-slate-200"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 right-4 rounded-full bg-vnpt-accent px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                    Phổ biến
                  </span>
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {pkg.name}
                </span>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-vnpt font-[family-name:var(--font-montserrat)]">
                    {pkg.price}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/{pkg.unit}</span>
                </div>
                <ul className="mt-3 flex-1 space-y-2">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/lien-he"
                  className={`mt-4 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
                    pkg.popular
                      ? "bg-vnpt text-white hover:bg-vnpt-dark"
                      : "border border-vnpt text-vnpt hover:bg-vnpt-light"
                  }`}
                >
                  Đăng ký ngay →
                </Link>
              </div>
            ))}
          </div>
          {audience === "dn" && (
            <p className="mt-3 text-xs text-slate-400">
              * Bảng giá áp dụng chung, liên hệ để được tư vấn gói phù hợp quy mô doanh nghiệp.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
