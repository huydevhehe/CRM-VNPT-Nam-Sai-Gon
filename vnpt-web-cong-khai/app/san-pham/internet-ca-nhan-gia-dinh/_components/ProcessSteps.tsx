import { ClipboardCheck, ClipboardList, Wifi, Wrench } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, title: "Chọn gói cước phù hợp" },
  { icon: Wifi, title: "Kiểm tra hạ tầng" },
  { icon: ClipboardCheck, title: "Xác nhận đăng ký" },
  { icon: Wrench, title: "Lắp đặt & bàn giao" },
];

export default function ProcessSteps() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="border-l-4 border-vnpt pl-4">
        <h2 className="text-slate-800">Quy trình đăng ký &amp; lắp đặt</h2>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative flex flex-col items-center text-center">
            {i < STEPS.length - 1 && (
              <div className="absolute left-1/2 top-7 hidden h-px w-full -translate-x-0 translate-x-1/2 border-t border-dashed border-vnpt/30 lg:block" />
            )}
            <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
              <s.icon size={24} />
            </div>
            <span className="absolute left-1/2 top-0 z-20 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-vnpt text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-3 text-sm text-slate-800">{s.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
