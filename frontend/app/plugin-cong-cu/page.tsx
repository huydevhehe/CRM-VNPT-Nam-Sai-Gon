import type { Metadata } from "next";
import DownloadCatalog from "@/components/plugin-cong-cu/DownloadCatalog";
import HeroSection from "@/components/plugin-cong-cu/HeroSection";

export const metadata: Metadata = {
  title: "Plugin & Công cụ — VNPT Nam Sài Gòn",
  description:
    "Tải bộ cài plugin ký số, driver USB Token và tài liệu tích hợp chữ ký số VNPT-CA. File tải trực tiếp từ máy chủ chính thức của VNPT.",
};

export default function PluginCongCuPage() {
  return (
    <div className="bg-[#eef4fb] pb-16">
      <HeroSection />
      <DownloadCatalog />
    </div>
  );
}
