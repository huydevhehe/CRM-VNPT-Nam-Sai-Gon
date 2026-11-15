import { MessageCircle, Phone, Wifi } from "lucide-react";

export default function BottomCta() {
  return (
    <section className="bg-vnpt-darker px-6 py-6 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 lg:flex-row">
        <div className="flex items-center gap-3 text-center lg:text-left">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Wifi size={20} />
          </div>
          <div>
            <p className="font-semibold">Đăng ký lắp đặt Internet VNPT ngay hôm nay!</p>
            <p className="text-sm text-white/70">
              Internet cáp quang tốc độ cao – Ổn định – An toàn – Phù hợp cho mọi gia đình.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="tel:0838999333"
            className="btn-label flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-vnpt-dark hover:bg-slate-100"
          >
            <Phone size={16} /> 0838 999 333
          </a>
          <a
            href="https://zalo.me"
            target="_blank"
            rel="noreferrer"
            className="btn-label flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-white hover:bg-white/10"
          >
            <MessageCircle size={16} /> Tư vấn qua Zalo
          </a>
        </div>
      </div>
    </section>
  );
}
