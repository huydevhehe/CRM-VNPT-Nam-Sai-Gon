"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Cloud,
  FileCheck,
  FileSignature,
  Fingerprint,
  Inbox,
  Network,
  Pill,
  Receipt,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ServiceIcon = { icon: LucideIcon; label: string; href: string };

const DOANH_NGHIEP: ServiceIcon[] = [
  { icon: Fingerprint, label: "Định danh điện tử", href: "/san-pham" },
  { icon: Receipt, label: "Hoá đơn điện tử", href: "/san-pham/hoa-don-thue" },
  { icon: FileCheck, label: "Hợp đồng điện tử", href: "/san-pham/hop-dong-dien-tu" },
  { icon: FileSignature, label: "Chữ ký số SmartCA", href: "/san-pham/chu-ky-so" },
  { icon: ShieldCheck, label: "BHXH điện tử", href: "/san-pham/bhxh" },
  { icon: Pill, label: "VNPT Pharmacy", href: "/san-pham/pharmacy" },
  { icon: Inbox, label: "iOffice", href: "/san-pham/ioffice" },
  { icon: Inbox, label: "iOffice - Quản lý văn bản", href: "/san-pham/ioffice" },
];

const HA_TANG_SO: ServiceIcon[] = [
  { icon: Cloud, label: "Cloud Server", href: "/san-pham/cloud-idc" },
  { icon: Server, label: "Data Center", href: "/san-pham/cloud-idc" },
  { icon: Network, label: "Kênh thuê riêng MetroNet", href: "/san-pham/bang-rong-co-dinh" },
  { icon: ShieldCheck, label: "Bảo mật hạ tầng", href: "/san-pham/cloud-idc" },
];

const TABS = [
  { label: "Doanh nghiệp", items: DOANH_NGHIEP },
  { label: "Hạ tầng số", items: HA_TANG_SO },
];

export default function CntServices() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs font-bold tracking-wide text-vnpt">CHUYỂN ĐỔI SỐ</p>
          <h2 className="mt-1 text-vnpt-darker">Dịch vụ &amp; Giải pháp CNTT</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            Giải pháp công nghệ hỗ trợ quản lý, vận hành và phát triển hoạt động kinh doanh.
          </p>

          <div className="mt-5 inline-flex rounded-lg bg-vnpt-light p-1">
            {TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                  i === active ? "bg-vnpt text-white shadow" : "text-vnpt-darker hover:text-vnpt"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tab.items.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="group flex flex-col items-start gap-2 rounded-lg border border-slate-100 bg-white p-3 shadow-sm transition hover:border-vnpt/40 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
                  <s.icon size={18} />
                </span>
                <span className="text-xs font-semibold leading-snug text-slate-800">{s.label}</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-vnpt">
                  Tìm hiểu thêm <ArrowRight size={10} />
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="relative hidden h-72 overflow-hidden rounded-2xl lg:block">
          <Image
            src="/images/dich-vu-cntt/banner-dich-vu-cntt.jpg"
            alt="Dịch vụ và giải pháp CNTT VNPT"
            fill
            sizes="40vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
