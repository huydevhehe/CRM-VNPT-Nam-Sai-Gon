"use client";

import { useState, type FormEvent } from "react";
import { Headset, Mail, Phone, Send, User } from "lucide-react";

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
    <section id="tu-van" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-10">
      <div className="flex flex-col gap-8 rounded-xl bg-vnpt-light p-6 lg:flex-row lg:items-center lg:p-8">
        <div className="flex items-start gap-3 lg:w-80 lg:shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-vnpt text-white">
            <Headset size={20} />
          </div>
          <div>
            <h2 className="text-slate-800">Đăng ký tư vấn Internet VNPT</h2>
            <p className="mt-1 text-sm text-slate-600">
              Nhận báo giá và tư vấn gói cước phù hợp cho gia đình của bạn.
            </p>
          </div>
        </div>

        <div className="flex-1">
          {submitted ? (
            <div className="rounded-lg border border-vnpt/20 bg-white p-5 text-center">
              <p className="font-semibold text-vnpt">Cảm ơn bạn đã đăng ký!</p>
              <p className="mt-1 text-sm text-slate-600">
                Đội ngũ VNPT Nam Sài Gòn sẽ liên hệ với bạn trong thời gian sớm nhất.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-form-label mb-1 block text-slate-700">Họ và tên *</label>
                  <div className="relative">
                    <User size={16} className={iconClass} />
                    <input required name="hoTen" placeholder="Nhập họ và tên" className={fieldClass} />
                  </div>
                </div>
                <div>
                  <label className="text-form-label mb-1 block text-slate-700">Số điện thoại *</label>
                  <div className="relative">
                    <Phone size={16} className={iconClass} />
                    <input
                      required
                      name="soDienThoai"
                      placeholder="Nhập số điện thoại"
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-form-label mb-1 block text-slate-700">Email</label>
                  <div className="relative">
                    <Mail size={16} className={iconClass} />
                    <input
                      name="email"
                      type="email"
                      placeholder="Nhập email của bạn"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-label flex w-full items-center justify-center gap-2 rounded-lg bg-vnpt py-3 text-white transition hover:bg-vnpt-dark hover:shadow-md"
              >
                <Send size={16} /> Gửi yêu cầu tư vấn
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
