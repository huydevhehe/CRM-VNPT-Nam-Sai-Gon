import Link from "next/link";
import { Wifi } from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";

/**
 * Minh hoạ gia đình + router bằng SVG dựng tay (không dùng ảnh ngoài),
 * bố cục bám theo ảnh thiết kế: sóng wifi bên trái, cụm người bên phải,
 * router VNPT góc dưới phải.
 */
function FamilyIllustration() {
  return (
    <svg viewBox="0 0 420 260" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="personA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe0ff" />
          <stop offset="100%" stopColor="#8fc4f5" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="120" r="150" fill="url(#glow)" />

      {/* Sóng wifi lớn bên trái */}
      <g stroke="#9fd2ff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M40 150a90 90 0 0 1 150-66" />
        <path d="M62 168a62 62 0 0 1 104-46" />
        <path d="M84 186a34 34 0 0 1 56-26" />
      </g>
      <circle cx="108" cy="196" r="7" fill="#ffd166" />

      {/* Cụm người cách điệu: bố, mẹ, 2 con, laptop ở giữa */}
      <g>
        {/* bố */}
        <circle cx="210" cy="96" r="20" fill="#ffe0b2" />
        <path d="M172 190v-36a38 38 0 0 1 76 0v36z" fill="url(#personA)" />
        {/* mẹ */}
        <circle cx="270" cy="102" r="18" fill="#ffe0b2" />
        <path d="M238 190v-32a32 32 0 0 1 64 0v32z" fill="#ffd3e0" />
        {/* con 1 */}
        <circle cx="300" cy="140" r="13" fill="#ffe0b2" />
        <path d="M278 196v-24a22 22 0 0 1 44 0v24z" fill="#ffe29a" />
        {/* con 2 */}
        <circle cx="150" cy="144" r="13" fill="#ffe0b2" />
        <path d="M128 196v-22a22 22 0 0 1 44 0v22z" fill="#c8f0d8" />
      </g>

      {/* Laptop phía trước */}
      <g>
        <rect x="178" y="188" width="66" height="8" rx="2" fill="#0b1220" opacity="0.85" />
        <path d="M184 188l6-34h34l6 34z" fill="#0b1220" opacity="0.7" />
        <path d="M190 187l5-27h24l5 27z" fill="#bfe3ff" />
      </g>

      {/* Router VNPT góc dưới phải */}
      <g transform="translate(330,150)">
        <rect x="0" y="40" width="58" height="46" rx="8" fill="#ffffff" />
        <text x="29" y="68" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0a66c2">
          VNPT
        </text>
        <rect x="10" y="4" width="5" height="40" rx="2.5" fill="#ffffff" />
        <rect x="26" y="-4" width="5" height="48" rx="2.5" fill="#ffffff" />
        <rect x="42" y="4" width="5" height="40" rx="2.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Breadcrumb
          variant="light"
          items={[
            { label: "Trang chủ", href: "/" },
            { label: "Gói cước", href: "/san-pham" },
            { label: "Internet cá nhân / Gia đình" },
          ]}
        />

        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="italic leading-tight">
              Internet VNPT
              <br />
              Cá nhân / Gia đình
            </h1>
            <p className="mt-4 max-w-xl text-white/85">
              Internet cáp quang tốc độ cao, ổn định, an toàn, phù hợp cho học tập, làm việc, giải
              trí và kết nối cả gia đình.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#bang-gia"
                className="btn-label rounded-md border border-white/60 px-5 py-3 text-white transition hover:bg-white/10"
              >
                Xem bảng giá →
              </Link>
              <Link
                href="#tu-van"
                className="btn-label flex items-center gap-2 rounded-md bg-white px-5 py-3 text-vnpt-dark transition hover:bg-slate-100"
              >
                Đăng ký lắp đặt →
              </Link>
            </div>
          </div>

          <div className="relative hidden h-64 lg:block">
            <div className="absolute right-6 top-0 flex items-center gap-1 text-white/90">
              <Wifi size={18} />
              <span className="text-xs font-medium">WiFi Mesh toàn nhà</span>
            </div>
            <FamilyIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
