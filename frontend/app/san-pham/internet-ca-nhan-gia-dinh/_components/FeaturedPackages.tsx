import Link from "next/link";
import { Camera, Check, Layers, Star, Tv } from "lucide-react";

type FeaturedPackage = {
  icon: typeof Camera;
  name: string;
  tagline: string;
  features: string[];
  price: string;
  highlighted?: boolean;
};

const FEATURED: FeaturedPackage[] = [
  {
    icon: Camera,
    name: "Home Cam Pro",
    tagline: "Internet + Camera an ninh",
    features: ["Tốc độ cao, ổn định", "Camera giám sát 24/7", "Quản lý qua ứng dụng"],
    price: "215.000đ",
  },
  {
    icon: Layers,
    name: "Home Mesh Pro",
    tagline: "Internet + WiFi Mesh",
    features: ["Tốc độ cao, ổn định", "Phủ sóng WiFi toàn nhà", "Kết nối mượt mà"],
    price: "240.000đ",
    highlighted: true,
  },
  {
    icon: Tv,
    name: "Home TV Pro",
    tagline: "Internet + Truyền hình MyTV",
    features: ["Tốc độ cao, ổn định", "Gần 200 kênh đặc sắc", "Giải trí đa dạng cho gia đình"],
    price: "279.000đ",
  },
];

export default function FeaturedPackages() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="border-l-4 border-vnpt pl-4">
        <h2 className="text-slate-800">3 gói Internet chuyên nghiệp</h2>
        <p className="mt-1 text-slate-500">
          Giải pháp trọn gói, đáp ứng đa dạng nhu cầu kết nối, giải trí và an ninh cho gia đình.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {FEATURED.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              p.highlighted ? "border-vnpt/50 shadow-md" : "border-slate-100"
            }`}
          >
            {p.highlighted && (
              <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-vnpt-darker">
                <Star size={12} className="fill-vnpt-darker" /> Được ưa chuộng
              </span>
            )}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
              <p.icon size={24} />
            </div>
            <h3 className="mt-4 text-slate-800">{p.name}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{p.tagline}</p>

            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={15} className="shrink-0 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-slate-500">
              Chỉ từ <span className="text-xl font-bold text-rose-600">{p.price}</span>
              <span className="text-slate-400"> /tháng</span>
            </p>

            <Link
              href="#tu-van"
              className="btn-label mt-4 rounded-md bg-vnpt py-2.5 text-center text-white transition hover:bg-vnpt-dark"
            >
              Đăng ký ngay →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
