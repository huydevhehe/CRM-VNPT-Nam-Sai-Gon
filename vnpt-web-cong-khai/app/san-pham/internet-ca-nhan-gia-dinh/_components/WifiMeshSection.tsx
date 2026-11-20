import Link from "next/link";
import { Home, Layers, Wifi } from "lucide-react";

const POINTS = [
  { icon: Wifi, label: "Phủ sóng toàn nhà" },
  { icon: Home, label: "Kết nối ổn định" },
  { icon: Layers, label: "Dễ dàng mở rộng" },
];

function MeshDeviceIcon() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex h-16 w-14 flex-col items-center justify-center rounded-lg bg-white shadow-sm"
        >
          <span className="text-[10px] font-bold text-vnpt">VNPT</span>
          <Wifi size={16} className="mt-1 text-vnpt" />
        </div>
      ))}
    </div>
  );
}

export default function WifiMeshSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-6 rounded-xl bg-vnpt-light p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <MeshDeviceIcon />
          <div>
            <h2 className="text-slate-800">WiFi Mesh VNPT</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-600">
              Giải pháp mở rộng vùng phủ sóng, loại bỏ &ldquo;điểm chết&rdquo; WiFi cho mọi không
              gian.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {POINTS.map((pt) => (
            <div key={pt.label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                <pt.icon size={18} />
              </div>
              <span className="text-xs font-medium text-slate-600">{pt.label}</span>
            </div>
          ))}
          <Link
            href="#tu-van"
            className="btn-label whitespace-nowrap rounded-md bg-vnpt px-5 py-2.5 text-white transition hover:bg-vnpt-dark"
          >
            Tìm hiểu WiFi Mesh →
          </Link>
        </div>
      </div>
    </section>
  );
}
