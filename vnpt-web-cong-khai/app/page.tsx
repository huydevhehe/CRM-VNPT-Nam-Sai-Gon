import { getAllArticles, getAllProducts } from "@/lib/data";
import { getCategoryBySlug } from "@/content/category-map";
import Hero from "./_components/home/Hero";
import CustomerNeeds from "./_components/home/CustomerNeeds";
import InternetPackagesSection, {
  type InternetPackageGroup,
} from "./_components/home/InternetPackagesSection";
import CntServices from "./_components/home/CntServices";
import WhyVnpt from "./_components/home/WhyVnpt";
import NewsPromo from "./_components/home/NewsPromo";

function pickBySlug<T extends { slug: string }>(items: T[], slugs: string[]): T[] {
  return slugs.map((s) => items.find((i) => i.slug === s)).filter((x): x is T => Boolean(x));
}

export default function HomePage() {
  const products = getAllProducts();

  const internetPackages = pickBySlug(
    products.filter((p) => p.category === "Internet cá nhân/gia đình"),
    ["home-1", "home-1-mesh", "home-2"],
  );
  const mytvPackages = pickBySlug(
    products.filter((p) => p.category === "Truyền hình MyTV"),
    ["hometv-1", "hometv-1-mesh", "hometv-2"],
  );
  const doanhNghiepPackages = getCategoryBySlug("bang-rong-co-dinh")?.fakeProducts.filter(
    (p) => p.slug === "internet-doanh-nghiep",
  ) ?? [];

  const packageGroups: InternetPackageGroup[] = [
    {
      key: "internet",
      tabLabel: "Internet",
      packages: internetPackages,
      recommendedSlug: "home-1-mesh",
      href: "/san-pham/internet-ca-nhan-gia-dinh",
    },
    {
      key: "internet-mytv",
      tabLabel: "Internet + MyTV",
      packages: mytvPackages,
      recommendedSlug: "hometv-1-mesh",
      href: "/san-pham/truyen-hinh-mytv",
    },
    {
      key: "internet-doanh-nghiep",
      tabLabel: "Internet doanh nghiệp",
      packages: doanhNghiepPackages,
      href: "/san-pham/internet-doanh-nghiep",
    },
  ];

  const news = getAllArticles()
    .filter((a) => /[à-ỹ]/i.test(a.title) && a.images[0])
    .slice(0, 3);

  return (
    <div>
      <Hero />
      <CustomerNeeds />
      <InternetPackagesSection groups={packageGroups} />
      <CntServices />
      <WhyVnpt />
      <NewsPromo articles={news} />
    </div>
  );
}
