"use client";

import { useState, type FormEvent } from "react";
import { Mail, Phone, Send, ShieldCheck, User } from "lucide-react";

/**
 * Form "Đăng ký tư vấn Internet VNPT" — bố cục ngang 3 ô theo đúng ảnh design
 * (khác layout dọc của LeadForm dùng chung), nên viết riêng cho trang này.
 */
export default function ConsultForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10";
  const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="rounded-2xl bg-vnpt-light p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vnpt text-white">
              <Mail size={20} />
            </span>
            <div>
              <h2 className="text-lg text-slate-800">
                Đăng ký tư vấn
                <br />
                Internet VNPT
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Nhận báo giá và tư vấn gói cước phù hợp cho nhu cầu của bạn.
              </p>
            </div>
          </div>

          <div>
            {submitted ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-vnpt/20 bg-white p-6 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-vnpt text-white">
                  <ShieldCheck size={20} />
                </div>
                <p className="font-semibold text-vnpt">Cảm ơn bạn đã đăng ký!</p>
                <p className="mt-1 text-sm text-slate-600">
                  Đội ngũ VNPT Nam Sài Gòn sẽ liên hệ với bạn trong thời gian sớm nhất.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Họ và tên <span className="text-red-500">*</span>
                    </span>
                    <span className="relative block">
                      <User size={16} className={iconClass} />
                      <input required name="hoTen" placeholder="Nhập họ và tên" className={fieldClass} />
                    </span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Số điện thoại <span className="text-red-500">*</span>
                    </span>
                    <span className="relative block">
                      <Phone size={16} className={iconClass} />
                      <input required name="soDienThoai" placeholder="Nhập số điện thoại" className={fieldClass} />
                    </span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </span>
                    <span className="relative block">
                      <Mail size={16} className={iconClass} />
                      <input required name="email" type="email" placeholder="Nhập email của bạn" className={fieldClass} />
                    </span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-vnpt py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark hover:shadow-md"
                >
                  <Send size={16} /> Gửi yêu cầu tư vấn
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
