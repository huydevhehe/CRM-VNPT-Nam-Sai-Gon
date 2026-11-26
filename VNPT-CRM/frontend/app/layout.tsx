import type { Metadata } from "next";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";

export const metadata: Metadata = {
  title: "VNPT Nam Sài Gòn - Đồng hành cùng bạn trên hành trình Chuyển đổi số",
  description:
    "Giải pháp số toàn diện cho Cá nhân, Hộ kinh doanh, Doanh nghiệp và Cơ quan Nhà nước.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-white text-slate-800">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
