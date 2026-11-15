"use client";

import { useState, type FormEvent } from "react";
import { Headset, Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

/** Form đăng ký tư vấn dạng ngang, khớp layout trong ảnh design (icon trái, 3 ô input + nút cùng hàng). */
export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <div className="rounded-2xl bg-vnpt-light px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3 lg:w-80 lg:shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vnpt text-white">
            <Headset size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Đăng ký tư vấn Internet Doanh nghiệp</h3>
            <p className="mt-1 text-sm text-slate-500">
              Nhận báo giá và giải pháp phù hợp với nhu cầu của doanh nghiệp bạn.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="flex flex-1 items-center gap-3 rounded-lg border border-vnpt/20 bg-white p-4">
            <ShieldCheck size={20} className="shrink-0 text-vnpt" />
            <p className="text-sm text-slate-600">
              Cảm ơn bạn đã đăng ký! Đội ngũ VNPT Nam Sài Gòn sẽ liên hệ trong thời gian sớm nhất.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid flex-1 gap-3 sm:grid-cols-3 lg:items-end">
            <div className="relative">
              <User size={16} className={iconClass} />
              <input required name="hoTen" placeholder="Nhập họ và tên" className={fieldClass} />
            </div>
            <div className="relative">
              <Phone size={16} className={iconClass} />
              <input required name="soDienThoai" placeholder="Nhập số điện thoại" className={fieldClass} />
            </div>
            <div className="relative">
              <Mail size={16} className={iconClass} />
              <input required name="email" type="email" placeholder="Nhập email của bạn" className={fieldClass} />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-vnpt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark hover:shadow-md sm:col-span-3 lg:col-span-1"
            >
              Gửi yêu cầu tư vấn <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
