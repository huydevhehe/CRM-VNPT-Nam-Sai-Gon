"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AdminTopbar from "@/components/admin/layout/AdminTopbar";
import { useAuth } from "@/lib/auth/auth-context";
import { canAccessAdminPath } from "@/lib/auth/access";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    } else if (!loading && user?.mustChangePassword) {
      router.replace("/doi-mat-khau");
    } else if (!loading && user?.role === "CTV") {
      // CTV có dashboard riêng, không dùng khu vực quản trị.
      router.replace("/cong-tac-vien/dashboard");
    }
  }, [loading, user, router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !user || user.mustChangePassword || user.role === "CTV") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-slate-500">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  const allowed = canAccessAdminPath(user.role, pathname);

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] text-slate-800">
      {/* Sidebar Navigation */}
      <AdminSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <div className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-5 py-1.5 lg:px-8">
          <span className="text-caption text-slate-500">
            {user.name} ({user.role})
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-label rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </div>
        <main className="flex-1 p-4 lg:p-8">
          {allowed ? (
            children
          ) : (
            <div
              role="alert"
              data-testid="forbidden-page"
              className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
            >
              <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
              <h1 className="mt-4 text-lg font-bold text-slate-800">
                Không có quyền truy cập
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Trang này chỉ dành cho tài khoản Admin. Vui lòng liên hệ quản trị viên nếu bạn cần sử dụng chức năng này.
              </p>
              <Link
                href="/admin/dashboard"
                className="mt-5 inline-block rounded-lg bg-vnpt px-4 py-2 text-sm font-semibold text-white hover:bg-vnpt-darker"
              >
                Về Dashboard
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

