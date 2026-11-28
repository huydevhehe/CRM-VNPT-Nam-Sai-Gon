"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { registerCtv } from "@/lib/api/auth.api";

export default function CtvRegisterPage() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      setError("Vui lòng nhập tên đăng nhập");
      return;
    }
    if (!trimmedName) {
      setError("Vui lòng nhập họ và tên");
      return;
    }
    if (!trimmedPhone) {
      setError("Vui lòng nhập số điện thoại");
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setError("Số điện thoại phải gồm 10 chữ số");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await registerCtv({
        username: trimmedUsername,
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        password,
      });
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể gửi yêu cầu đăng ký";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-vnpt-light px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-vnpt-darker text-xl font-bold">VNPT Nam Sài Gòn</h1>
          <p className="text-caption mt-1 text-slate-500">
            Đăng ký làm Cộng tác viên kinh doanh
          </p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-slate-800">
                Đăng ký thành công!
              </h2>
              <p className="text-sm text-slate-600">
                Yêu cầu đăng ký đã được gửi thành công và đang chờ Admin duyệt.
              </p>
            </div>
            <Link
              href="/login"
              className="btn-label inline-flex w-full items-center justify-center rounded-xl bg-vnpt px-4 py-2.5 text-white transition-colors hover:bg-vnpt-dark"
            >
              Quay lại Đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="text-form-label mb-1.5 block text-slate-700"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-3 pl-10 text-sm text-slate-800 transition-all focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="VD: ctv_nguyenvana"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="name"
                className="text-form-label mb-1.5 block text-slate-700"
              >
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-3 pl-10 text-sm text-slate-800 transition-all focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="VD: Nguyễn Văn An"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="text-form-label mb-1.5 block text-slate-700"
              >
                Số điện thoại
              </label>
              <div className="relative">
                <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-3 pl-10 text-sm text-slate-800 transition-all focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="VD: 0901234567"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-form-label mb-1.5 block text-slate-700"
              >
                Email (không bắt buộc)
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-3 pl-10 text-sm text-slate-800 transition-all focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="VD: ctv@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-form-label mb-1.5 block text-slate-700"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-3 pl-10 text-sm text-slate-800 transition-all focus:border-vnpt focus:bg-white focus:outline-hidden"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-label flex w-full items-center justify-center rounded-xl bg-vnpt px-4 py-2.5 text-white transition-colors hover:bg-vnpt-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Đang gửi đăng ký..." : "Gửi đăng ký"}
            </button>
          </form>
        )}

        <p className="text-caption mt-6 text-center text-slate-500">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-semibold text-vnpt hover:text-vnpt-dark"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
