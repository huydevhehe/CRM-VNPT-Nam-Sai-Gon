import type { Metadata } from "next";
import BottomCta from "./_components/BottomCta";
import ConsultForm from "./_components/ConsultForm";
import Faq from "./_components/Faq";
import FeaturedPackages from "./_components/FeaturedPackages";
import Hero from "./_components/Hero";
import PricingGrid from "./_components/PricingGrid";
import ProcessSteps from "./_components/ProcessSteps";
import WhyChoose from "./_components/WhyChoose";
import WifiMeshSection from "./_components/WifiMeshSection";
import { getInternetPackages } from "@/content/internet-packages";

export const metadata: Metadata = {
  title: "Internet cá nhân / gia đình — VNPT Nam Sài Gòn",
  description:
    "Gói cước Internet cáp quang VNPT dành cho cá nhân và hộ gia đình: tốc độ cao, WiFi Mesh, tích hợp camera an ninh, truyền hình MyTV.",
};

export default function InternetCaNhanGiaDinhPage() {
  const packages = getInternetPackages("internet-ca-nhan-gia-dinh");

  return (
    <div>
      <Hero />
      <FeaturedPackages />
      <PricingGrid packages={packages} />
      <WifiMeshSection />
      <WhyChoose />
      <ProcessSteps />
      <ConsultForm />
      <Faq />
      <BottomCta />
    </div>
  );
}
