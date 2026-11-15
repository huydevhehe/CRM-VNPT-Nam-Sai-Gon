import { Cloud, Download, Folder, Settings } from "lucide-react";
import Breadcrumb from "@/components/layout/Breadcrumb";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-vnpt via-vnpt-dark to-vnpt-darker px-6 py-10 text-white mx-4 mt-6 sm:mx-6 sm:px-10 sm:py-12 lg:mx-8">
      <div className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

      <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <Breadcrumb
            variant="light"
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "Plugin & Công cụ" },
            ]}
          />
          <h1 className="mt-4 text-white">Plugin &amp; Công cụ</h1>
          <p className="mt-3 text-base text-white/85 sm:text-lg">
            Bộ công cụ, driver và tài liệu tích hợp hỗ trợ sử dụng Chữ ký số VNPT-CA hiệu quả, an
            toàn.
          </p>
        </div>

        <div className="relative hidden h-48 w-full max-w-sm shrink-0 lg:block">
          <span className="absolute top-1 left-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm"><Cloud size={30} strokeWidth={1.75} /></span>
          <span className="absolute top-0 right-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm"><Settings size={26} strokeWidth={1.75} /></span>
          <span className="absolute bottom-6 left-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm"><Folder size={28} strokeWidth={1.75} /></span>
          <div className="absolute bottom-0 left-1/2 flex h-28 w-48 -translate-x-1/2 items-center justify-center rounded-2xl border border-white/30 bg-white/95 shadow-xl"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-vnpt text-white"><Download size={28} strokeWidth={2} /></span></div>
          <div className="absolute right-2 bottom-2 flex h-16 w-6 flex-col items-center justify-end rounded-sm bg-vnpt-darker pb-1 shadow-lg"><span className="mb-1 h-6 w-4 rounded-[2px] bg-white/90" /><span className="text-[6px] font-bold tracking-tight text-white">CA</span></div>
        </div>
      </div>
    </section>
  );
}
