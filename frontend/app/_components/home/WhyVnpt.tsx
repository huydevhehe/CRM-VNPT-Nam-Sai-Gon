import { Headset, Layers, ShieldCheck, Workflow } from "lucide-react";

const REASONS = [
  {
    icon: Layers,
    title: "Hệ sinh thái đa dạng",
    desc: "Viễn thông và giải pháp CNTT",
  },
  {
    icon: ShieldCheck,
    title: "Giải pháp theo nhu cầu",
    desc: "Phù hợp từng nhóm khách hàng",
  },
  {
    icon: Workflow,
    title: "Tư vấn chuyên nghiệp",
    desc: "Hỗ trợ tận tâm, nhanh chóng",
  },
  {
    icon: Headset,
    title: "Hỗ trợ triển khai",
    desc: "Đồng hành lâu dài",
  },
];

export default function WhyVnpt() {
  return (
    <section className="bg-vnpt-light/60 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-vnpt-darker">Vì sao lựa chọn VNPT?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Kết nối và đồng hành cùng hệ sinh thái dịch vụ ONT
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {REASONS.map((r) => (
            <div key={r.title} className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-vnpt shadow-sm">
                <r.icon size={24} />
              </span>
              <h3 className="mt-3 text-sm text-slate-800">{r.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
