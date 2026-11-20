"use client";

import { useState, type FormEvent } from "react";
import { Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

export default function RegisterForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <div
      id="dang-ky-tu-van"
      className="scroll-mt-24 rounded-2xl border border-vnpt-light bg-white p-6 shadow-sm lg:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-center">
        <div className="flex items-start gap-3 lg:block">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
            <Mail size={22} />
          </div>
          <div className="lg:mt-3">
            <h2 className="text-lg text-slate-800">
              Đăng ký tư vấn
              <br />
              <span className="text-vnpt">Hóa đơn điện tử VNPT</span>
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Nhận báo giá và tư vấn giải pháp phù hợp cho đơn vị của bạn.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="flex items-center gap-3 rounded-lg bg-vnpt-light px-4 py-3 text-sm font-semibold text-vnpt">
            <ShieldCheck size={20} className="shrink-0" />
            Cảm ơn bạn! VNPT Nam Sài Gòn sẽ liên hệ trong thời gian sớm nhất.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Họ và tên *</span>
              <span className="relative block">
                <User size={16} className={iconClass} />
                <input required name="hoTen" placeholder="Nhập họ và tên" className={fieldClass} />
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Số điện thoại *</span>
              <span className="relative block">
                <Phone size={16} className={iconClass} />
                <input
                  required
                  name="soDienThoai"
                  placeholder="Nhập số điện thoại"
                  className={fieldClass}
                />
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email *</span>
              <span className="relative block">
                <Mail size={16} className={iconClass} />
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="Nhập email của bạn"
                  className={fieldClass}
                />
              </span>
            </label>
            <button
              type="submit"
              aria-label="Gửi yêu cầu tư vấn"
              title="Gửi yêu cầu tư vấn"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vnpt text-white transition hover:bg-vnpt-dark hover:shadow-md"
            >
              <Send size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
