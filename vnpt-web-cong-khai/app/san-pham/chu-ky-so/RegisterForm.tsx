"use client";

import { useState, type FormEvent } from "react";
import { Headset, Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

export default function RegisterForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <div className="rounded-2xl border border-vnpt/10 bg-vnpt-light/60 p-5 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vnpt text-white">
            <Headset size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-snug text-slate-800 font-[family-name:var(--font-montserrat)]">
              Đăng ký tư vấn Chữ ký số VNPT
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Để được tư vấn nhanh nhất, vui lòng để lại thông tin liên hệ.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
            Cảm ơn bạn đã đăng ký! VNPT Nam Sài Gòn sẽ liên hệ trong thời gian sớm nhất.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative flex-1">
              <User size={16} className={iconClass} />
              <input required name="hoTen" placeholder="Họ và tên *" className={fieldClass} />
            </div>
            <div className="relative flex-1">
              <Phone size={16} className={iconClass} />
              <input required name="soDienThoai" placeholder="Số điện thoại *" className={fieldClass} />
            </div>
            <div className="relative flex-1">
              <Mail size={16} className={iconClass} />
              <input required name="email" type="email" placeholder="Email *" className={fieldClass} />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-vnpt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark hover:shadow-md"
            >
              Gửi yêu cầu tư vấn <Send size={16} />
            </button>
          </form>
        )}
        {!submitted && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:col-start-2">
            <ShieldCheck size={13} className="text-vnpt" /> Thông tin của bạn được bảo mật tuyệt đối
          </p>
        )}
      </div>
    </div>
  );
}
