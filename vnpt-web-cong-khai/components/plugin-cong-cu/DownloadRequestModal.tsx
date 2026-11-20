"use client";

import { useState, type FormEvent } from "react";
import { Download, Mail, Phone, User, X } from "lucide-react";

export type DownloadableDoc = {
  label: string;
  url: string;
};

export default function DownloadRequestModal({
  doc,
  onClose,
}: {
  doc: DownloadableDoc | null;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  if (!doc) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.open(doc.url, "_blank", "noreferrer");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tải tài liệu tích hợp"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vnpt-light text-vnpt">
              <Download size={18} />
            </span>
            <h3 className="text-vnpt-dark">Tải tài liệu tích hợp</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Vui lòng cung cấp thông tin để tải về &ldquo;{doc.label}&rdquo;.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-form-label text-slate-700">
              Họ và tên <span className="text-red-500">*</span>
            </span>
            <div className="relative mt-1.5">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                name="hoTen"
                placeholder="Nhập họ và tên"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-form-label text-slate-700">
              Số điện thoại <span className="text-red-500">*</span>
            </span>
            <div className="relative mt-1.5">
              <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                name="soDienThoai"
                placeholder="Nhập số điện thoại"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-form-label text-slate-700">
              Email <span className="text-red-500">*</span>
            </span>
            <div className="relative mt-1.5">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="email"
                name="email"
                placeholder="Nhập email của bạn"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-vnpt focus:ring-4 focus:ring-vnpt/10"
              />
            </div>
          </label>

          <label className="flex items-start gap-2 pt-1">
            <input
              required
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-vnpt focus:ring-vnpt"
            />
            <span className="text-xs leading-relaxed text-slate-500">
              Tôi đồng ý cho VNPT Nam Sài Gòn thu thập và sử dụng thông tin để hỗ trợ, tư vấn dịch
              vụ phù hợp. Xem chi tiết{" "}
              <a href="/chinh-sach-bao-mat" className="text-vnpt underline underline-offset-2 hover:text-vnpt-dark">
                Chính sách bảo mật
              </a>
              .
            </span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-vnpt py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
            >
              <Download size={16} /> Tải về
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
