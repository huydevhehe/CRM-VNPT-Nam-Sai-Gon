"use client";

import { useState, type FormEvent } from "react";
import { Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

export default function EContractForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  if (submitted) {
    return (
      <div className="rounded-lg border border-vnpt/20 bg-white p-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-vnpt text-white">
          <ShieldCheck size={18} />
        </div>
        <p className="text-sm font-semibold text-vnpt">Cảm ơn bạn đã đăng ký!</p>
        <p className="mt-1 text-xs text-slate-500">
          Đội ngũ VNPT Nam Sài Gòn sẽ liên hệ với bạn trong thời gian sớm nhất.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
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
          <input
            required
            name="email"
            type="email"
            placeholder="Nhập email của bạn"
            className={fieldClass}
          />
        </div>
      </div>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-vnpt py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark hover:shadow-md sm:w-auto sm:px-8"
      >
        Gửi yêu cầu tư vấn <Send size={16} />
      </button>
    </form>
  );
}
