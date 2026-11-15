"use client";

import { useState, type FormEvent } from "react";
import { Headset, Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

export default function CloudLeadForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-white/0 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-vnpt-accent";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <section
      id="dang-ky-tu-van"
      className="scroll-mt-20 bg-gradient-to-br from-vnpt-darker via-vnpt-dark to-vnpt px-6 py-10 text-white"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Headset size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Đăng ký tư vấn VNPT Smart Cloud</h2>
            <p className="mt-1 text-sm text-white/80">
              Nhận tư vấn giải pháp và báo giá phù hợp cho doanh nghiệp của bạn.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="rounded-lg bg-white/10 p-5 text-center sm:text-left">
            <p className="font-semibold text-white">Cảm ơn bạn đã đăng ký!</p>
            <p className="mt-1 text-sm text-white/80">
              Đội ngũ VNPT Nam Sài Gòn sẽ liên hệ với bạn trong thời gian sớm nhất.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="relative">
              <User size={16} className={iconClass} />
              <input required name="hoTen" placeholder="Họ và tên *" className={fieldClass} />
            </div>
            <div className="relative">
              <Phone size={16} className={iconClass} />
              <input required name="soDienThoai" placeholder="Số điện thoại *" className={fieldClass} />
            </div>
            <div className="relative">
              <Mail size={16} className={iconClass} />
              <input required name="email" type="email" placeholder="Email *" className={fieldClass} />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-vnpt transition hover:bg-white/90"
            >
              Gửi yêu cầu tư vấn <Send size={16} />
            </button>
          </form>
        )}
      </div>
      <p className="mx-auto mt-3 flex max-w-7xl items-center gap-1.5 text-xs text-white/60 lg:ml-[calc(16.666%+0.5rem)]">
        <ShieldCheck size={13} /> Thông tin của bạn được bảo mật tuyệt đối
      </p>
    </section>
  );
}
