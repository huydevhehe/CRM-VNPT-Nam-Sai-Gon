import { Headset, Layers, ShieldCheck, Zap } from "lucide-react";

const REASONS = [
  { icon: Zap, title: "Tốc độ cao, ổn định", desc: "Kết nối mượt mà cho mọi nhu cầu" },
  { icon: ShieldCheck, title: "An toàn, bảo mật", desc: "Hạ tầng hiện đại, tin cậy" },
  { icon: Headset, title: "Hỗ trợ kỹ thuật 24/7", desc: "Tư vấn và xử lý nhanh chóng" },
  { icon: Layers, title: "Gói cước linh hoạt", desc: "Phù hợp mọi gia đình" },
];

export default function WhyChoose() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="border-l-4 border-vnpt pl-4">
        <h2 className="text-slate-800">Vì sao chọn Internet VNPT?</h2>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((r) => (
          <div
            key={r.title}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
              <r.icon size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">{r.title}</div>
              <div className="text-xs text-slate-500">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
